import { describe, expect, it } from "vitest";
import {
  formatBytes,
  formatScore,
  formatYears,
  scoreTone,
  titleCase,
} from "@/lib/utils";

describe("formatting helpers", () => {
  it("formats scores to one decimal and falls back to an em dash", () => {
    expect(formatScore(82.56)).toBe("82.6");
    expect(formatScore(0)).toBe("0.0");
    expect(formatScore(null)).toBe("—");
    expect(formatScore(undefined)).toBe("—");
  });

  it("formats years with correct pluralisation and unknown values", () => {
    expect(formatYears(3)).toBe("3 yrs");
    expect(formatYears(1)).toBe("1 yr");
    expect(formatYears(2.5)).toBe("2.5 yrs");
    expect(formatYears(0)).toBe("None detected");
    expect(formatYears(null)).toBe("Unknown");
  });

  it("maps scores onto label tones at the documented thresholds", () => {
    expect(scoreTone(85)).toBe("success");
    expect(scoreTone(84.9)).toBe("primary");
    expect(scoreTone(70)).toBe("primary");
    expect(scoreTone(69.9)).toBe("warning");
    expect(scoreTone(50)).toBe("warning");
    expect(scoreTone(49.9)).toBe("danger");
    expect(scoreTone(null)).toBe("warning");
  });

  it("formats byte sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });

  it("title-cases status labels", () => {
    expect(titleCase("shortlisted")).toBe("Shortlisted");
    expect(titleCase("interview")).toBe("Interview");
  });
});
