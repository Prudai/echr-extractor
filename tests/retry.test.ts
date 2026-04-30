import { describe, it, expect, vi } from "vitest";
import { withRetry } from "../src/utils/retry.js";

describe("withRetry", () => {
  it("returns the value on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withRetry(fn, { retryAttempts: 2 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and eventually resolves", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("ok");
    await expect(
      withRetry(fn, { retryAttempts: 3, maxBackoffMs: 1 }),
    ).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("nope"));
    await expect(
      withRetry(fn, { retryAttempts: 2, maxBackoffMs: 1 }),
    ).rejects.toThrow("nope");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
