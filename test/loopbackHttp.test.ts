// @ajan: cursor · @etiket: loopback-http, test
import { describe, expect, it } from "vitest";
import { isLoopbackHttpUrl } from "../src/utils/loopbackHttp";

describe("isLoopbackHttpUrl", () => {
  it("accepts loopback http", () => {
    expect(isLoopbackHttpUrl("http://127.0.0.1:8000")).toBe(
      "http://127.0.0.1:8000",
    );
    expect(isLoopbackHttpUrl("http://localhost:8767/")).toBe(
      "http://localhost:8767",
    );
  });

  it("rejects non-loopback and junk", () => {
    expect(isLoopbackHttpUrl("http://example.com")).toBeNull();
    expect(isLoopbackHttpUrl("ftp://127.0.0.1")).toBeNull();
    expect(isLoopbackHttpUrl("")).toBeNull();
    expect(isLoopbackHttpUrl(null)).toBeNull();
  });
});
