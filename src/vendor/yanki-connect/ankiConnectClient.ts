// @ajan: cursor · @etiket: f7, anki, yanki-connect, vendor
// AnkiConnect HTTP client — protocol compatible with yanki-connect (MIT).
// Transport is injectable so Vitest can run without Zotero.HTTP.

export type AnkiHttpTransport = (
  url: string,
  body: string,
) => Promise<string>;

export type AnkiConnectClientOptions = {
  host?: string;
  port?: number;
  version?: number;
  key?: string;
  transport: AnkiHttpTransport;
  timeoutMs?: number;
};

export type AnkiNotePayload = {
  deckName: string;
  modelName: string;
  fields: Record<string, string>;
  tags?: string[];
  options?: {
    allowDuplicate?: boolean;
  };
};

export type AnkiConnectResponse<T = unknown> = {
  result: T;
  error: string | null;
};

export { AnkiConnectClient, defaultAnkiEndpoint, zoteroAnkiTransport };

const DEFAULT_HOST = "http://127.0.0.1";
const DEFAULT_PORT = 8765;
const DEFAULT_VERSION = 6;

function defaultAnkiEndpoint(host?: string, port?: number): string {
  const h = (host || DEFAULT_HOST).replace(/\/$/, "");
  const p = typeof port === "number" && Number.isFinite(port) ? port : DEFAULT_PORT;
  return `${h}:${p}`;
}

async function zoteroAnkiTransport(
  url: string,
  body: string,
  timeoutMs = 15000,
): Promise<string> {
  const xhr = await Zotero.HTTP.request("POST", url, {
    headers: { "Content-Type": "application/json" },
    body,
    timeout: timeoutMs,
    responseType: "text",
  });
  return String(xhr.responseText ?? "");
}

class AnkiConnectClient {
  private readonly host: string;
  private readonly port: number;
  private readonly version: number;
  private readonly key: string | undefined;
  private readonly transport: AnkiHttpTransport;

  constructor(options: AnkiConnectClientOptions) {
    this.host = options.host || DEFAULT_HOST;
    this.port =
      typeof options.port === "number" && Number.isFinite(options.port)
        ? options.port
        : DEFAULT_PORT;
    this.version = options.version ?? DEFAULT_VERSION;
    this.key = options.key?.trim() ? options.key.trim() : undefined;
    this.transport = options.transport;
  }

  endpoint(): string {
    return defaultAnkiEndpoint(this.host, this.port);
  }

  async invoke<T = unknown>(
    action: string,
    params?: Record<string, unknown>,
  ): Promise<T> {
    const payload: Record<string, unknown> = {
      action,
      version: this.version,
    };
    if (params !== undefined) payload.params = params;
    if (this.key) payload.key = this.key;

    let text: string;
    try {
      text = await this.transport(this.endpoint(), JSON.stringify(payload));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`AnkiConnect unreachable (${this.endpoint()}): ${msg}`);
    }

    let json: AnkiConnectResponse<T>;
    try {
      json = JSON.parse(text) as AnkiConnectResponse<T>;
    } catch {
      throw new Error(`AnkiConnect returned non-JSON: ${text.slice(0, 120)}`);
    }

    if (!json || typeof json !== "object") {
      throw new Error("AnkiConnect response missing body");
    }
    if (!("error" in json) || !("result" in json)) {
      throw new Error("AnkiConnect response missing result/error fields");
    }
    if (json.error) {
      throw new Error(json.error);
    }
    return json.result;
  }

  versionProbe(): Promise<number> {
    return this.invoke<number>("version");
  }

  createDeck(deck: string): Promise<number | null> {
    return this.invoke<number | null>("createDeck", { deck });
  }

  addNote(note: AnkiNotePayload): Promise<number | null> {
    return this.invoke<number | null>("addNote", { note });
  }

  updateNoteFields(note: {
    id: number;
    fields: Record<string, string>;
  }): Promise<null> {
    return this.invoke<null>("updateNoteFields", { note });
  }

  findNotes(query: string): Promise<number[]> {
    return this.invoke<number[]>("findNotes", { query });
  }
}
