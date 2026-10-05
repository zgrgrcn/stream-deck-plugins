import assert from "node:assert/strict";
import { test } from "node:test";

import { pace, WINDOW_MS } from "./pace.ts";

const now = new Date("2026-10-05T12:00:00Z");
const hours = (h: number) => new Date(now.getTime() + h * 3_600_000);

test("half the week gone at 40% lands at 80%", () => {
	const p = pace(40, hours(84), WINDOW_MS.weekly, now);
	assert.equal(Math.round(p.projected!), 80);
	assert.equal(p.emptyAt, null);
});

test("2.5h into the session at 75% runs out 50 min before reset", () => {
	const p = pace(75, hours(2.5), WINDOW_MS.session, now);
	assert.equal(Math.round(p.projected!), 150);
	assert.equal(p.emptyAt!.getTime(), hours(2.5 * 25 / 75).getTime());
});

test("too early to project", () => {
	assert.equal(pace(5, hours(4.9), WINDOW_MS.session, now).projected, null);
});

test("already at the limit", () => {
	assert.equal(pace(100, hours(1), WINDOW_MS.session, now).emptyAt, now);
});
