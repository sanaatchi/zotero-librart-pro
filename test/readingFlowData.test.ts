import { describe, expect, it } from "vitest";
import {
  DEFAULT_FLOW_DATA,
  formatProgressLabel,
  formatRelativeDate,
  getDisplayProgress,
  inferStatus,
  mergeFlowData,
  normalizeFlowData,
  READ_PROGRESS_THRESHOLD,
} from "../src/vendor/reading-flow/flowData";

describe("readingFlow flowData", () => {
  it("normalizes empty input to defaults", () => {
    expect(normalizeFlowData(null)).toEqual(DEFAULT_FLOW_DATA);
  });

  it("merges progress and bumps timestamp", () => {
    const base = normalizeFlowData({ p: { "1": 0.2 }, ts: 100 });
    const merged = mergeFlowData(base, { p: { "1": 0.5 } }, 200);
    expect(merged.p["1"]).toBe(0.5);
    expect(merged.ts).toBe(200);
  });

  it("infers read status near completion threshold", () => {
    const data = normalizeFlowData({ p: { "9": READ_PROGRESS_THRESHOLD } });
    expect(inferStatus(data)).toBe("read");
    expect(getDisplayProgress(data)).toBe(READ_PROGRESS_THRESHOLD);
  });

  it("formats progress labels", () => {
    expect(formatProgressLabel(0)).toBe("");
    expect(formatProgressLabel(0.42)).toBe("42%");
    expect(formatProgressLabel(12)).toBe("p. 12");
  });

  it("formats relative dates", () => {
    const now = Date.UTC(2026, 6, 29, 12, 0, 0);
    expect(formatRelativeDate(now - 30_000, now)).toBe("now");
    expect(formatRelativeDate(now - 3600_000, now)).toBe("1h");
  });
});
