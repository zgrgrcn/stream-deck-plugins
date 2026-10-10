const HOUR = 3_600_000;

export const WINDOW_MS: Record<string, number> = {
	session: 5 * HOUR,
	weekly: 7 * 24 * HOUR,
};

export type Pace = {
	/** Percent at reset if usage continues at the average rate so far; null while too early to tell. */
	projected: number | null;
};

// ponytail: linear average over the window so far; switch to a recent-rate estimate if bursts make it jumpy.
export function pace(percent: number, resetsAt: Date, windowMs: number, now = new Date()): Pace {
	const left = resetsAt.getTime() - now.getTime();
	const elapsed = windowMs - left;
	if (percent >= 100) return { projected: percent };
	if (elapsed < windowMs * 0.1 || percent <= 0) return { projected: percent <= 0 ? 0 : null };

	return { projected: (percent * windowMs) / elapsed };
}
