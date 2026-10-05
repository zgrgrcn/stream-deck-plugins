import assert from "node:assert/strict";
import { test } from "node:test";

import { bitrate } from "./render.ts";
import { parseNetstat, parseVmStat } from "./sample.ts";

test("netstat sums en* link rows, skips loopback, tunnels and address rows", () => {
	const out = `Name       Mtu   Network       Address            Ipkts Ierrs     Ibytes    Opkts Oerrs     Obytes  Coll
lo0        16384 <Link#1>                        110494     0   21596383   110494     0   21596383     0
en0        1500  <Link#7>    c8:80:6d:2a:a5:63 21910892     0 28016148438 10766456     0 1665376401     0
en0        1500  192.168.1     192.168.1.20    21910892     - 28016148438 10766456     - 1665376401     -
en1        1500  <Link#13>                           10     0       1000       20     0       2000     0
utun3      1380  <Link#20>                          500     0     999999      500     0     999999     0`;
	assert.deepEqual(parseNetstat(out), { rx: 28016149438, tx: 1665378401 });
});

test("vm_stat used memory = active + wired + compressed", () => {
	const out = `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                                    12383.
Pages active:                                 100.
Pages wired down:                             50.
Pages stored in compressor:                   999.
Pages occupied by compressor:                 50.`;
	assert.equal(parseVmStat(out, 400 * 16384), 50);
});

test("bitrate units", () => {
	assert.deepEqual(bitrate(850e3), ["850", "Kbps"]);
	assert.deepEqual(bitrate(12.34e6), ["12.3", "Mbps"]);
	assert.deepEqual(bitrate(345e6), ["345", "Mbps"]);
});
