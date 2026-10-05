export type Metric = "cpu" | "ram" | "power" | "down" | "up";

type Style = { label: string; color: string; /** Fixed graph ceiling; omitted = scale to the history's peak. */ max?: number; floor?: number };

export const STYLES: Record<Metric, Style> = {
	cpu: { label: "CPU", color: "#58a6ff", max: 100 },
	ram: { label: "RAM", color: "#f2cc60", max: 100 },
	power: { label: "WATT", color: "#f0883e", floor: 10 },
	down: { label: "↓", color: "#3fb950", floor: 1e6 },
	up: { label: "↑", color: "#bc8cff", floor: 1e6 },
};

/** Bits per second → short value and unit. */
export function bitrate(bps: number): [string, string] {
	if (bps >= 1e9) return [(bps / 1e9).toFixed(1), "Gbps"];
	if (bps >= 1e6) return [(bps / 1e6).toFixed(bps >= 1e8 ? 0 : 1), "Mbps"];
	return [(bps / 1e3).toFixed(0), "Kbps"];
}

export function format(metric: Metric, v: number | null): [string, string] {
	if (v === null) return ["—", ""];
	if (metric === "down" || metric === "up") return bitrate(v);
	if (metric === "power") return [v.toFixed(v < 10 ? 1 : 0), "W"];
	return [String(Math.round(v)), "%"];
}

export function renderKey(metric: Metric, history: (number | null)[]): string {
	const s = STYLES[metric];
	const values = history.map((v) => v ?? 0);
	const max = s.max ?? Math.max(s.floor ?? 1, ...values) * 1.15;
	const [value, unit] = format(metric, history.at(-1) ?? null);

	// Graph area: x 0..144, y 92..144. Oldest sample on the left.
	const n = Math.max(values.length - 1, 1);
	const pts = values.map((v, i) => `${((i / n) * 144).toFixed(1)},${(144 - Math.min(v / max, 1) * 50).toFixed(1)}`);
	const graph = pts.length < 2 ? "" : `
<path d="M0,144 L${pts.join(" L")} L144,144 Z" fill="${s.color}" fill-opacity="0.25"/>
<polyline points="${pts.join(" ")}" fill="none" stroke="${s.color}" stroke-width="4" stroke-linejoin="round"/>`;

	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
<rect width="144" height="144" fill="#0d1117"/>
<text x="72" y="54" font-family="Helvetica, Arial" font-size="${value.length > 4 ? 40 : 50}" font-weight="700" fill="${s.color}" text-anchor="middle">${value}<tspan font-size="24">${unit === "%" || unit === "W" ? unit : ""}</tspan></text>
<text x="72" y="82" font-family="Helvetica, Arial" font-size="18" font-weight="700" fill="#8b949e" text-anchor="middle" letter-spacing="1">${s.label}${unit === "%" || unit === "W" ? "" : " " + unit}</text>${graph}
</svg>`;
	return `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`;
}
