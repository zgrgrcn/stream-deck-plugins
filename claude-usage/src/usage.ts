import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

// Undocumented endpoint behind Claude Code's /usage; it can change without notice.
const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";

export type Limit = {
	kind: "session" | "weekly_all" | "weekly_scoped" | string;
	percent: number;
	resets_at: string;
	scope: { model?: { display_name?: string | null } | null } | null;
};

export type Usage = { limits: Limit[] } | { error: "auth" | "network" };

/** Claude Code keeps its OAuth login in the macOS Keychain. Read only: refreshing it here would rotate Claude Code's tokens. */
async function accessToken(): Promise<string | null> {
	try {
		const { stdout } = await exec("security", ["find-generic-password", "-s", "Claude Code-credentials", "-w"]);
		const oauth = JSON.parse(stdout).claudeAiOauth;
		if (!oauth?.accessToken || oauth.expiresAt < Date.now()) return null;
		return oauth.accessToken;
	} catch {
		return null;
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
