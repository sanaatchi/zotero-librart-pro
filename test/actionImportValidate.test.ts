// @ajan: cursor · @etiket: f0, vitest, yaml, security
import { describe, expect, it } from "vitest";
import {
  parseActionImportYaml,
  validateActionImportPayload,
} from "../src/utils/actionImportValidate";
import { ActionEventTypes, ActionOperationTypes } from "../src/utils/actions";

describe("parseActionImportYaml", () => {
  it("parses a minimal valid backup document", () => {
    const raw = `
type: LibRartProBackup
author: test
actions:
  a1:
    event: ${ActionEventTypes.createItem}
    operation: ${ActionOperationTypes.add}
    data: "/unread"
`;
    const parsed = parseActionImportYaml(raw);
    expect(validateActionImportPayload(parsed)).toBe(true);
  });

  it("rejects unknown backup type", () => {
    const parsed = parseActionImportYaml(`
type: EvilBackup
actions:
  x:
    event: 1
    operation: 1
    data: ok
`);
    expect(validateActionImportPayload(parsed)).toBe(false);
  });

  it("rejects prototype pollution keys", () => {
    const parsed = {
      type: "LibRartProBackup",
      actions: {
        __proto__: {
          event: ActionEventTypes.createItem,
          operation: ActionOperationTypes.add,
          data: "/x",
        },
      },
    };
    expect(validateActionImportPayload(parsed)).toBe(false);
  });
});
