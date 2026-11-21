import { describe, expect, it, vi, beforeEach } from "vitest";
import { ApiError, api } from "@/lib/api";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api service layer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed JSON on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ status: "ok", version: "1.0.0" }));
    await expect(api.health()).resolves.toEqual({ status: "ok", version: "1.0.0" });
  });

  it("turns a backend error payload into an ApiError with the message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ detail: "Screening not found." }, 404));
    await expect(api.getScreening(42)).rejects.toMatchObject({
      message: "Screening not found.",
      status: 404,
    });
  });

  it("exposes field-level validation details", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        { detail: "Some fields need attention.", errors: [{ field: "job_title", message: "too short" }] },
        422,
      ),
    );
    try {
      await api.createScreening({
        job_title: "",
        job_description: "x",
        requirements: {
          required_skills: [],
          preferred_skills: [],
          responsibilities: [],
          minimum_experience: null,
          education_requirements: [],
          domain_requirements: [],
          raw_text: "",
        },
      });
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).details?.[0].field).toBe("job_title");
    }
  });

  it("reports an unreachable API instead of a network stack trace", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(api.overview()).rejects.toMatchObject({
      message: "Cannot reach the HireLens API. Check that the backend is running.",
      status: 0,
    });
  });

  it("builds comparison query strings correctly", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ candidates: [] }));
    await api.compare([3, 5]);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/candidates/compare?ids=3&ids=5"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});
