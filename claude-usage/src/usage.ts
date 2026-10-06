import streamDeck from "@elgato/streamdeck";
import { execFile } from "node:child_process";
import { userInfo } from "node:os";
import { promisify } from "node:util";

const exec = promisify(execFile);

// Undocumented endpoints behind Claude Code's /usage and login; they can change without notice.
const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const TOKEN_URL = "https://platform.claude.com/v1/oauth/token";
const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e"; // Claude Code's public OAuth client id
const KEYCHAIN_SERVICE = "Claude Code-credentials";
const REFRESH_RETRY_MS = 10 * 60_000;

export type Limit = {
	kind: "session" | "weekly_all" | "weekly_scoped" | string;
	percent: number;
	resets_at: string;
	scope: { model?: { display_name?: string | null } | null } | null;
};

export type Usage = { limits: Limit[] } | { error: "auth" | "network" };

type Oauth = {
	accessToken: string;
	refreshToken?: string;
	expiresAt: number;
	refreshTokenExpiresAt?: number;
	scopes?: string[];
};
type Credentials = Record<string, unknown> & { claudeAiOauth?: Oauth };

/** Claude Code keeps its OAuth login in the macOS Keychain. */
async function readCredentials(): Promise<Credentials | null> {
	try {
		const { stdout } = await exec("security", ["find-generic-password", "-s", KEYCHAIN_SERVICE, "-w"]);
		return JSON.parse(stdout);
	} catch {
		return null;
	}
}

async function writeCredentials(creds: Credentials): Promise<void> {
	// Same command Claude Code uses, so it picks up the rotated pair on its next read.
	const hex = Buffer.from(JSON.stringify(creds)).toString("hex");
	await exec("security", ["add-generic-password", "-U", "-a", userInfo().username, "-s", KEYCHAIN_SERVICE, "-X", hex]);
}

let refreshFailedAt = 0;

/**
 * Rotate an expired token with the refresh token and store the new pair, as Claude Code would.
 * Only runs while the claude CLI is not up: a running CLI refreshes on its own, and two refreshers
 * sharing one rotating refresh token would sign each other out.
 */
async function refreshAccessToken(creds: Credentials, oauth: Oauth): Promise<string | null> {
	if (!oauth.refreshToken || Date.now() - refreshFailedAt < REFRESH_RETRY_MS || (await cliRunning())) return null;
	try {
		const res = await fetch(TOKEN_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				grant_type: "refresh_token",
				refresh_token: oauth.refreshToken,
				client_id: CLIENT_ID,
				scope: oauth.scopes?.join(" "),
			}),
			signal: AbortSignal.timeout(15_000),
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const t = (await res.json()) as {
			access_token: string;
			refresh_token?: string;
			expires_in: number;
			refresh_token_expires_in?: number;
		};
		const next: Oauth = {
			...oauth,
			accessToken: t.access_token,
			refreshToken: t.refresh_token ?? oauth.refreshToken,
			expiresAt: Date.now() + t.expires_in * 1000,
			...(t.refresh_token_expires_in ? { refreshTokenExpiresAt: Date.now() + t.refresh_token_expires_in * 1000 } : {}),
		};
		await writeCredentials({ ...creds, claudeAiOauth: next });
		streamDeck.logger.info("refreshed Claude Code token");
		return next.accessToken;
	} catch (e) {
		refreshFailedAt = Date.now();
		streamDeck.logger.warn(`token refresh failed: ${e instanceof Error ? e.message : e}`);
		return null;
	}
}

async function accessToken(): Promise<string | null> {
	const creds = await readCredentials();
	const oauth = creds?.claudeAiOauth;
	if (!creds || !oauth?.accessToken) return null;
	if (oauth.expiresAt > Date.now()) return oauth.accessToken;
	return refreshAccessToken(creds, oauth);
}

/** The claude CLI only; the desktop app is "Claude" and keeps its own login. */
async function cliRunning(): Promise<boolean> {
	try {
		await exec("pgrep", ["-x", "claude"]);
		return true;
	} catch {
		return false;
	}
}

/** True while the Claude desktop app or the claude CLI is running (both have the process name "claude"). */
export async function claudeRunning(): Promise<boolean> {
	try {
		await exec("pgrep", ["-ix", "claude"]);
		return true;
	} catch {
		return false;
	}
}

export async function fetchUsage(): Promise<Usage> {
	const token = await accessToken();
	if (!token) return { error: "auth" };
	try {
		const res = await fetch(USAGE_URL, {
			headers: {
				Authorization: `Bearer ${token}`,
				"anthropic-beta": "oauth-2025-04-20",
				"User-Agent": "claude-usage-streamdeck/0.1 (https://github.com/zgrgrcn/stream-deck-plugins)",
			},
			signal: AbortSignal.timeout(15_000),
		});
		if (res.status === 401 || res.status === 403) return { error: "auth" };
		if (!res.ok) return { error: "network" };
		const body = (await res.json()) as { limits?: unknown };
		return { limits: Array.isArray(body.limits) ? (body.limits as Limit[]) : [] };
	} catch {
		return { error: "network" };
	}
}

/** Setting value is "session", "weekly", or a model name such as "Fable". */
export function findLimit(limits: Limit[], which: string): Limit | undefined {
	if (which === "session") return limits.find((l) => l.kind === "session");
	if (which === "weekly") return limits.find((l) => l.kind === "weekly_all");
	return limits.find(
		(l) => l.kind === "weekly_scoped" && l.scope?.model?.display_name?.toLowerCase() === which.toLowerCase(),
	);
}
