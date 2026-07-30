// @ajan: cursor · @etiket: connection-map, scope, test
import { describe, expect, it } from "vitest";
import { CONNECTION_MAP_MAX_NODES } from "../src/utils/connectionMapScope";

describe("connectionMapScope constants", () => {
  it("keeps a usable display ceiling", () => {
    expect(CONNECTION_MAP_MAX_NODES).toBeGreaterThanOrEqual(40);
    expect(CONNECTION_MAP_MAX_NODES).toBeLessThanOrEqual(200);
  });
});
