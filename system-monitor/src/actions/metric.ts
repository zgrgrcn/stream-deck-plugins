import streamDeck, {
	action,
	DidReceiveSettingsEvent,
	KeyAction,
	SingletonAction,
	WillAppearEvent,
	WillDisappearEvent,
} from "@elgato/streamdeck";

import { renderKey, type Metric } from "../render";
import { Sampler, type Sample } from "../sample";

type Settings = { metric?: Metric };

const INTERVAL_MS = 2_000;
const HISTORY = 30; // one minute of samples

@action({ UUID: "com.zgrgrcn.system-monitor.metric" })
export class SystemMetric extends SingletonAction<Settings> {
	private settings = new Map<string, Settings>();
	private history: Sample[] = [];
	private sampler = new Sampler();
	private timer: NodeJS.Timeout | null = null;

	override async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
		this.settings.set(ev.action.id, ev.payload.settings);
		if (!this.timer) {
			this.timer = setInterval(() => this.tick(), INTERVAL_MS);
			await this.tick();
		}
		await this.draw(ev.action as KeyAction<Settings>);
	}

	override onWillDisappear(ev: WillDisappearEvent<Settings>): void {
		this.settings.delete(ev.action.id);
		// Sample only while a key is on screen; the graph starts fresh next time.
		if (this.settings.size === 0 && this.timer) {
			clearInterval(this.timer);
			this.timer = null;
			this.history = [];
			this.sampler = new Sampler();
		}
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<Settings>): Promise<void> {
		this.settings.set(ev.action.id, ev.payload.settings);
		await this.draw(ev.action as KeyAction<Settings>);
	}

	private async tick(): Promise<void> {
		try {
			const s = await this.sampler.sample();
			if (s) this.history = [...this.history, s].slice(-HISTORY);
		} catch (err) {
			streamDeck.logger.warn(`sample failed: ${err}`);
		}
		await Promise.all(this.actions.map((a) => (a.isKey() ? this.draw(a) : undefined)));
	}

	private async draw(a: KeyAction<Settings>): Promise<void> {
		const metric = this.settings.get(a.id)?.metric ?? "cpu";
		await a.setImage(renderKey(metric, this.history.map((s) => s[metric])));
	}
}
