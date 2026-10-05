import type { Pace } from "./pace";

const GREEN = "#3fb950";
const AMBER = "#d29922";
const RED = "#f85149";
const GRAY = "#8b949e";

export type KeyView = {
	label: string;
	percent?: number;
	/** 0..1 share of the window already elapsed; drawn as the even-pace tick on the bar. */
	elapsed?: number;
	resetsIn?: number;
	pace?: Pace;
	note?: string;
	dim?: boolean;
};

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

export function duration(ms: number): string {
	const m = Math.max(0, Math.round(ms / 60_000));
	if (m < 60) return `${m}m`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h${String(m % 60).padStart(2, "0")}`;
	return `${Math.floor(h / 24)}d${h % 24}h`;
}

function forecast(p: Pace | undefined, now: Date): { text: string; color: string } {
	if (!p || p.projected === null) return { text: "…", color: GRAY };
	if (p.emptyAt) {
		const sameDay = p.emptyAt.toDateString() === now.toDateString();
		const at = sameDay
			? p.emptyAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })
			: p.emptyAt.toLocaleDateString(undefined, { weekday: "short" }) + " " + p.emptyAt.getHours() + "h";
		return { text: `OUT ${at}`, color: RED };
	}
	return { text: `→ ${Math.round(p.projected)}%`, color: p.projected >= 80 ? AMBER : GREEN };
}

export function renderKey(v: KeyView, now = new Date()): string {
	const f = v.note ? { text: v.note, color: GRAY } : forecast(v.pace, now);
	const pct = v.percent === undefined ? "—" : `${Math.round(v.percent)}%`;
	const fill = Math.min(100, Math.max(0, v.percent ?? 0)) * 1.2;
	const tick = v.elapsed === undefined ? "" : `<rect x="${12 + v.elapsed * 120 - 1.5}" y="90" width="3" height="16" fill="#fff"/>`;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144" opacity="${v.dim ? 0.4 : 1}">
<rect width="144" height="144" fill="#0d1117"/>
<text x="12" y="28" font-family="Helvetica, Arial" font-size="17" font-weight="700" fill="${GRAY}">${esc(v.label)}</text>
<text x="132" y="28" font-family="Helvetica, Arial" font-size="17" fill="${GRAY}" text-anchor="end">${v.resetsIn === undefined ? "" : duration(v.resetsIn)}</text>
<text x="72" y="80" font-family="Helvetica, Arial" font-size="50" font-weight="700" fill="#fff" text-anchor="middle">${pct}</text>
<rect x="12" y="93" width="120" height="10" rx="5" fill="#30363d"/>
<rect x="12" y="93" width="${fill}" height="10" rx="5" fill="${f.color}"/>
${tick}
<text x="72" y="132" font-family="Helvetica, Arial" font-size="22" font-weight="700" fill="${f.color}" text-anchor="middle">${esc(f.text)}</text>
</svg>`;
	return `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`;
}
