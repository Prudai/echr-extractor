import { describe, it, expect, vi } from "vitest";
import { fetchMetadata } from "../src/hudoc/client.js";

describe("fetchMetadata", () => {
  it("paginates until the result count is reached", async () => {
    let call = 0;
    const fetchImpl = vi.fn(async () => {
      call++;
      const remaining = call === 1 ? 500 : 250;
      return new Response(
        JSON.stringify({
          resultcount: 750,
          results: Array.from({ length: remaining }, (_, i) => ({
            columns: { itemid: `id-${call}-${i}`, ecli: `ECLI-${call}-${i}` },
          })),
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const cases = await fetchMetadata({ fetchImpl, batchSize: 500 });
    expect(cases).toHaveLength(750);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("stops at endId when provided", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          resultcount: 10000,
          results: Array.from({ length: 100 }, (_, i) => ({
            columns: { itemid: `id-${i}` },
          })),
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as unknown as typeof fetch;
    const cases = await fetchMetadata({
      fetchImpl,
      batchSize: 100,
      endId: 100,
    });
    expect(cases).toHaveLength(100);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
