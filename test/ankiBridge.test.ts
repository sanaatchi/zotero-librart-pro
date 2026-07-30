// @ajan: cursor · @etiket: f7, anki, vitest
import { describe, expect, it } from "vitest";
import {
  AnkiConnectClient,
  defaultAnkiEndpoint,
} from "../src/vendor/yanki-connect/ankiConnectClient";
import {
  ANKI_EXTRA_PREFIX,
  buildBasicFields,
  decideNoteId,
  findNotesQuery,
  isAnkiMissingNoteError,
  itemKeyTag,
  parseAnkiLink,
  writeAnkiLink,
} from "../src/vendor/yanki-connect/ankiNotePayload";

describe("ankiNotePayload", () => {
  it("round-trips Extra link line", () => {
    const data = {
      v: 1 as const,
      noteId: 42,
      deck: "LibRart",
      model: "Basic",
      updatedAt: 1000,
    };
    const extra = writeAnkiLink("ReadingFlow: {}\nother", data);
    expect(extra).toContain(ANKI_EXTRA_PREFIX);
    expect(extra).toContain("ReadingFlow:");
    expect(parseAnkiLink(extra)).toEqual(data);
  });

  it("replaces existing Anki line", () => {
    const first = writeAnkiLink("", {
      v: 1,
      noteId: 1,
      deck: "A",
      model: "Basic",
      updatedAt: 1,
    });
    const second = writeAnkiLink(first, {
      v: 1,
      noteId: 2,
      deck: "B",
      model: "Basic",
      updatedAt: 2,
    });
    expect(
      second.split("\n").filter((l) => l.startsWith(ANKI_EXTRA_PREFIX)),
    ).toHaveLength(1);
    expect(parseAnkiLink(second)?.noteId).toBe(2);
  });

  it("builds Basic fields and item-key tag", () => {
    const fields = buildBasicFields({
      key: "ABCD1234",
      title: "Hello <world>",
      creators: "Doe, Jane",
      year: "2024",
      abstractNote: "Short abstract",
      doi: "10.1/x",
    });
    expect(fields.Front).toContain("Hello");
    expect(fields.Front).toContain("&lt;world&gt;");
    expect(fields.Back).toContain("Doe, Jane");
    expect(fields.Back).toContain("zotero:ABCD1234");
    expect(itemKeyTag("ABCD1234")).toBe("librart:itemKey=ABCD1234");
    expect(findNotesQuery("ABCD1234")).toBe("tag:librart:itemKey=ABCD1234");
  });

  it("decides note id from Extra then findNotes", () => {
    expect(decideNoteId(99, [1, 2])).toBe(99);
    expect(decideNoteId(null, [7, 8])).toBe(7);
    expect(decideNoteId(undefined, [])).toBeNull();
  });

  it("detects missing-note AnkiConnect errors", () => {
    expect(isAnkiMissingNoteError(new Error("Note was not found: 12345"))).toBe(
      true,
    );
    expect(isAnkiMissingNoteError(new Error("deck was not found"))).toBe(false);
  });
});

describe("AnkiConnectClient", () => {
  it("builds default endpoint", () => {
    expect(defaultAnkiEndpoint()).toBe("http://127.0.0.1:8765");
    expect(defaultAnkiEndpoint("http://localhost/", 9000)).toBe(
      "http://localhost:9000",
    );
  });

  it("invokes actions and surfaces Anki errors", async () => {
    const calls: { url: string; body: string }[] = [];
    const client = new AnkiConnectClient({
      transport: async (url, body) => {
        calls.push({ url, body });
        const req = JSON.parse(body) as { action: string };
        if (req.action === "version") {
          return JSON.stringify({ result: 6, error: null });
        }
        if (req.action === "addNote") {
          return JSON.stringify({ result: 12345, error: null });
        }
        return JSON.stringify({ result: null, error: "deck missing" });
      },
    });

    expect(await client.versionProbe()).toBe(6);
    expect(
      await client.addNote({
        deckName: "LibRart",
        modelName: "Basic",
        fields: { Front: "Q", Back: "A" },
        tags: ["librart"],
      }),
    ).toBe(12345);

    await expect(client.findNotes("tag:x")).rejects.toThrow("deck missing");
    expect(calls[0].url).toBe("http://127.0.0.1:8765");
    expect(JSON.parse(calls[0].body).version).toBe(6);
  });

  it("includes optional API key", async () => {
    let body = "";
    const client = new AnkiConnectClient({
      key: "secret",
      transport: async (_url, raw) => {
        body = raw;
        return JSON.stringify({ result: 6, error: null });
      },
    });
    await client.versionProbe();
    expect(JSON.parse(body).key).toBe("secret");
  });
});
