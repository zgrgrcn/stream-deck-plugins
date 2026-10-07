import streamDeck, {
	action,
	DidReceiveSettingsEvent,
	KeyAction,
	KeyDownEvent,
	SingletonAction,
	WillAppearEvent,
	WillDisappearEvent,
} from "@elgato/streamdeck";

import { pace, WINDOW_MS } from "../pace";
import { renderKey, type KeyView } from "../render";
import { claudeRunning, fetchUsage, findLimit, type Usage } from "../usage";

type Settings = { limit?: string };

const POLL_MS = 5 * 60_000; // the usage endpoint rate-limits (429) at one call a minute
const LABELS: Record<string, string> = { session: "5H", weekly: "WEEK", status: "UPDATED" };

@action({ UUID: "com.zgrgrcn.claude-usage.limit" })
export class UsageLimit extends SingletonAction<Settings> {
	private settings = new Map<string, Settings>();
	private last: Usage | null = null;
	private lastOk: Date | null = null;
	private paused = false;
	private timer: NodeJS.Timeout | null = null;

	override async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
		this.settings.set(ev.action.id, ev.payload.settings);
		this.timer ??= setInterval(() => this.refresh(), POLL_MS);
		if (this.last) await this.draw(ev.action as KeyAction<Settings>);
		else await this.refresh();
	}

	override onWillDisappear(ev: WillDisappearEvent<Settings>): void {
		this.settings.delete(ev.action.id);
		if (this.settings.size === 0 && this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<Settings>): Promise<void> {
		this.settings.set(ev.action.id, ev.payload.settings);
		await this.draw(ev.action as KeyAction<Settings>);
	}

	override async onKeyDown(): Promise<void> {
		await this.refresh(true);
	}

	private async refresh(force = false): Promise<void> {
		this.paused = !force && !(await claudeRunning());
		if (!this.paused) {
			const usage = await fetchUsage();
			if ("error" in usage) streamDeck.logger.warn(`usage fetch failed: ${usage.error}`);
			else this.lastOk = new Date();
			// Keep the last good numbers on a network blip; show auth errors.
			if (!("error" in usage) || usage.error === "auth" || !this.last) this.last = usage;
		}
		await Promise.all(this.actions.map((a) => (a.isKey() ? this.draw(a) : undefined)));
	}

	private async draw(a: KeyAction<Settings>): Promise<void> {
		const which = this.settings.get(a.id)?.limit || "session";
		const label = LABELS[which] ?? which.toUpperCase();
		await a.setImage(renderKey(this.view(which, label)));
	}

	private view(which: string, label: string): KeyView {
		const u = this.last;
		if (which === "status") return this.statusView(label);
		if (!u) return { label, note: "…", dim: this.paused };
		if ("error" in u) return { label, note: u.error === "auth" ? "RUN claude" : "OFFLINE", dim: true };
		const limit = findLimit(u.limits, which);
		if (!limit) return { label, note: "N/A", dim: true };

		const now = new Date();
		const resetsAt = new Date(limit.resets_at);
		const windowMs = limit.kind === "session" ? WINDOW_MS.session : WINDOW_MS.weekly;
		const left = resetsAt.getTime() - now.getTime();
		return {
			label,
			percent: limit.percent,
			elapsed: Math.min(1, Math.max(0, 1 - left / windowMs)),
			resetsIn: left,
			pace: pace(limit.percent, resetsAt, windowMs, now),
			dim: this.paused,
		};
	}

	/** Time of the last successful fetch; the key press refreshes like any other key. */
	private statusView(label: string): KeyView {
		const u = this.last;
		const failed = !!u && "error" in u;
		return {
			label,
			value: this.lastOk?.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }) ?? "—",
			note: this.paused ? "PAUSED" : !u ? "…" : failed ? (u.error === "auth" ? "RUN claude" : "OFFLINE") : "REFRESH",
			dim: this.paused || failed,
		};
	}
}
