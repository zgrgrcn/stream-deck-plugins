import { execFile } from "node:child_process";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
// Built next to the bundled plugin.js by `npm run build:native`.
const SMC_POWER = fileURLToPath(new URL("./smc-power", import.meta.url));

export type Sample = { cpu: number; ram: number; power: number | null; down: number; up: number };

/** Memory in use the way Activity Monitor counts it: active + wired + compressed. */
export function parseVmStat(out: string, totalBytes: number): number {
	const pageSize = Number(/page size of (\d+) bytes/.exec(out)?.[1] ?? 16384);
	const pages = (name: string) => Number(new RegExp(`${name}:\\s+(\\d+)`).exec(out)?.[1] ?? 0);
	const used = (pages("Pages active") + pages("Pages wired down") + pages("Pages occupied by compressor")) * pageSize;
	return (used / totalBytes) * 100;
}

/** Total bytes in/out across en* interfaces (one <Link#> row each). Tunnels and bridges are skipped: their traffic also crosses an en* interface. */
export function parseNetstat(out: string): { rx: number; tx: number } {
	let rx = 0;
	let tx = 0;
	for (const line of out.split("\n")) {
		const c = line.trim().split(/\s+/);
		if (!c[2]?.startsWith("<Link#") || !/^en\d+$/.test(c[0])) continue;
		// The Address column can be empty, so count from the end: Ibytes is 5th, Obytes 2nd from last.
		rx += Number(c[c.length - 5]) || 0;
		tx += Number(c[c.length - 2]) || 0;
	}
	return { rx, tx };
}

function cpuTicks() {
	let idle = 0;
	let total = 0;
	for (const { times } of os.cpus()) {
		idle += times.idle;
		total += times.user + times.nice + times.sys + times.idle + times.irq;
	}
	return { idle, total };
}

export class Sampler {
	private prev: { at: number; cpu: ReturnType<typeof cpuTicks>; net: { rx: number; tx: number } } | null = null;

	/** First call only primes the counters and returns null. */
	async sample(): Promise<Sample | null> {
		const [vm, net, power] = await Promise.all([
			exec("vm_stat").then((r) => r.stdout),
			exec("netstat", ["-ibn"]).then((r) => parseNetstat(r.stdout)),
			exec(SMC_POWER).then((r) => Number(r.stdout), () => null),
		]);
		const now = { at: Date.now(), cpu: cpuTicks(), net };
		const prev = this.prev;
		this.prev = now;
		if (!prev) return null;

		const secs = (now.at - prev.at) / 1000;
		const total = now.cpu.total - prev.cpu.total;
		return {
			cpu: total > 0 ? (1 - (now.cpu.idle - prev.cpu.idle) / total) * 100 : 0,
			ram: parseVmStat(vm, os.totalmem()),
			power,
			// Counters reset when an interface goes down; clamp so that shows as 0, not a negative spike.
			down: Math.max(0, (net.rx - prev.net.rx) * 8) / secs,
			up: Math.max(0, (net.tx - prev.net.tx) * 8) / secs,
		};
	}
}
