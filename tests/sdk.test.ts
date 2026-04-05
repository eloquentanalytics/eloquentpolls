import { describe, it, expect, vi, beforeEach } from "vitest";
import { EloquentPoll, EloquentPollError } from "../src/index.js";
import type { PollResponse, ResultDetail, Balance } from "../src/types.js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_API_KEY = "ep_k_test_123";
const PKG_DIR = resolve(import.meta.dirname, "..");

function mockFetchOk(body: unknown): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}

function mockFetchError(status: number, body?: unknown): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: `HTTP ${status}`,
    json: body !== undefined
      ? () => Promise.resolve(body)
      : () => Promise.reject(new Error("no json")),
  });
}

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe("EloquentPoll constructor", () => {
  it("uses default base URL when none provided", () => {
    const client = new EloquentPoll({ apiKey: MOCK_API_KEY });
    // Verify by making a fetch call and checking the URL
    const fetch = mockFetchOk({ balance_cents: 0, balance: "$0.00", usage_cents: 0 });
    vi.stubGlobal("fetch", fetch);
    client.getBalance();
    expect(fetch).toHaveBeenCalledWith(
      "https://polls.eloquentanalytics.com/api/balance",
      expect.anything(),
    );
  });

  it("strips trailing slash from custom baseUrl", () => {
    const client = new EloquentPoll({ apiKey: MOCK_API_KEY, baseUrl: "https://custom.example.com/" });
    const fetch = mockFetchOk({ balance_cents: 0, balance: "$0.00", usage_cents: 0 });
    vi.stubGlobal("fetch", fetch);
    client.getBalance();
    expect(fetch).toHaveBeenCalledWith(
      "https://custom.example.com/api/balance",
      expect.anything(),
    );
  });

  it("stores apiKey and uses it in Authorization header", async () => {
    const client = new EloquentPoll({ apiKey: "ep_k_secret" });
    const fetch = mockFetchOk({ balance_cents: 100, balance: "$1.00", usage_cents: 0 });
    vi.stubGlobal("fetch", fetch);
    await client.getBalance();
    const [, opts] = fetch.mock.calls[0];
    expect(opts.headers["Authorization"]).toBe("Bearer ep_k_secret");
  });
});

// ---------------------------------------------------------------------------
// poll()
// ---------------------------------------------------------------------------

describe("EloquentPoll.poll()", () => {
  let client: EloquentPoll;

  beforeEach(() => {
    client = new EloquentPoll({ apiKey: MOCK_API_KEY });
  });

  const MOCK_RESPONSE: PollResponse = {
    poll_id: "poll_123",
    status: "success",
    outcome: "consensus",
    question: "Which color?",
    options: ["red", "blue"],
    poll_type: "fptp",
    winning_option: "blue",
    is_tie: false,
    confidence_threshold: 0.95,
    max_cost_usd: 1.0,
    early_terminated: true,
    termination_reason: "mathematical_lock",
    models_skipped: 2,
    tally: { red: 1, blue: 4 },
    votes: [],
    timing: { gather_ms: 500, total_ms: 600 },
    costs: { total_estimated_cost: 0.0012 },
  };

  it("sends POST to /api/poll with correct body", async () => {
    const fetch = mockFetchOk(MOCK_RESPONSE);
    vi.stubGlobal("fetch", fetch);

    await client.poll({ question: "Which color?", options: ["red", "blue"] });

    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe("https://polls.eloquentanalytics.com/api/poll");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body);
    expect(body.question).toBe("Which color?");
    expect(body.options).toEqual(["red", "blue"]);
  });

  it("sets Authorization, User-Agent, and Content-Type headers", async () => {
    const fetch = mockFetchOk(MOCK_RESPONSE);
    vi.stubGlobal("fetch", fetch);

    await client.poll({ question: "Q?", options: ["A", "B"] });

    const headers = fetch.mock.calls[0][1].headers;
    expect(headers["Authorization"]).toBe(`Bearer ${MOCK_API_KEY}`);
    expect(headers["User-Agent"]).toBe("eloquentpolls/1.0.0");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("defaults surface to 'installable_client_libraries' if not provided", async () => {
    const fetch = mockFetchOk(MOCK_RESPONSE);
    vi.stubGlobal("fetch", fetch);

    await client.poll({ question: "Q?", options: ["A", "B"] });

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.surface).toBe("installable_client_libraries");
  });

  it("passes through all PollRequest fields", async () => {
    const fetch = mockFetchOk(MOCK_RESPONSE);
    vi.stubGlobal("fetch", fetch);

    await client.poll({
      question: "Q?",
      options: ["A", "B"],
      preset: "fast",
      confidence_threshold: 0.8,
      max_cost_usd: 0.5,
      surface: "custom_surface",
    });

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.preset).toBe("fast");
    expect(body.confidence_threshold).toBe(0.8);
    expect(body.max_cost_usd).toBe(0.5);
    expect(body.surface).toBe("custom_surface");
  });

  it("returns parsed PollResponse on 200", async () => {
    vi.stubGlobal("fetch", mockFetchOk(MOCK_RESPONSE));
    const result = await client.poll({ question: "Q?", options: ["A", "B"] });
    expect(result.poll_id).toBe("poll_123");
    expect(result.winning_option).toBe("blue");
    expect(result.tally).toEqual({ red: 1, blue: 4 });
  });

  it("throws EloquentPollError with statusCode on 400", async () => {
    vi.stubGlobal("fetch", mockFetchError(400, { error: "Bad request" }));
    await expect(client.poll({ question: "Q?", options: ["A", "B"] }))
      .rejects.toThrow(EloquentPollError);
    try {
      await client.poll({ question: "Q?", options: ["A", "B"] });
    } catch (e) {
      expect(e).toBeInstanceOf(EloquentPollError);
      expect((e as EloquentPollError).statusCode).toBe(400);
    }
  });

  it("throws EloquentPollError on 401", async () => {
    vi.stubGlobal("fetch", mockFetchError(401, { error: "Unauthorized" }));
    await expect(client.poll({ question: "Q?", options: ["A", "B"] }))
      .rejects.toThrow(EloquentPollError);
  });

  it("throws EloquentPollError on 402", async () => {
    vi.stubGlobal("fetch", mockFetchError(402, { error: "Insufficient funds" }));
    await expect(client.poll({ question: "Q?", options: ["A", "B"] }))
      .rejects.toThrow(EloquentPollError);
  });

  it("throws EloquentPollError on 500", async () => {
    vi.stubGlobal("fetch", mockFetchError(500, { error: "Internal error" }));
    await expect(client.poll({ question: "Q?", options: ["A", "B"] }))
      .rejects.toThrow(EloquentPollError);
  });

  it("handles non-JSON error responses gracefully", async () => {
    vi.stubGlobal("fetch", mockFetchError(503));
    await expect(client.poll({ question: "Q?", options: ["A", "B"] }))
      .rejects.toThrow(EloquentPollError);
    try {
      await client.poll({ question: "Q?", options: ["A", "B"] });
    } catch (e) {
      expect((e as EloquentPollError).message).toContain("HTTP 503");
    }
  });
});

// ---------------------------------------------------------------------------
// getResult()
// ---------------------------------------------------------------------------

describe("EloquentPoll.getResult()", () => {
  let client: EloquentPoll;

  beforeEach(() => {
    client = new EloquentPoll({ apiKey: MOCK_API_KEY });
  });

  const MOCK_RESULT: ResultDetail = {
    poll_id: "poll_456",
    status: "success",
    question: "Which?",
    options: ["A", "B"],
    poll_type: "fptp",
    winning_option: "A",
    is_tie: false,
    tally: { A: 3, B: 1 },
    votes: [],
    models_requested: 5,
    models_succeeded: 4,
    created_at: "2026-01-01T00:00:00Z",
  };

  it("sends GET to /api/results/{pollId}", async () => {
    const fetch = mockFetchOk(MOCK_RESULT);
    vi.stubGlobal("fetch", fetch);

    await client.getResult("poll_456");

    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe("https://polls.eloquentanalytics.com/api/results/poll_456");
    expect(opts.method).toBe("GET");
  });

  it("URL-encodes the pollId", async () => {
    const fetch = mockFetchOk(MOCK_RESULT);
    vi.stubGlobal("fetch", fetch);

    await client.getResult("poll/special chars");

    expect(fetch.mock.calls[0][0]).toBe(
      "https://polls.eloquentanalytics.com/api/results/poll%2Fspecial%20chars",
    );
  });

  it("returns parsed ResultDetail on 200", async () => {
    vi.stubGlobal("fetch", mockFetchOk(MOCK_RESULT));
    const result = await client.getResult("poll_456");
    expect(result.poll_id).toBe("poll_456");
    expect(result.winning_option).toBe("A");
  });

  it("throws EloquentPollError on 404", async () => {
    vi.stubGlobal("fetch", mockFetchError(404, { error: "Not found" }));
    await expect(client.getResult("nonexistent"))
      .rejects.toThrow(EloquentPollError);
    try {
      await client.getResult("nonexistent");
    } catch (e) {
      expect((e as EloquentPollError).statusCode).toBe(404);
    }
  });
});

// ---------------------------------------------------------------------------
// getBalance()
// ---------------------------------------------------------------------------

describe("EloquentPoll.getBalance()", () => {
  let client: EloquentPoll;

  beforeEach(() => {
    client = new EloquentPoll({ apiKey: MOCK_API_KEY });
  });

  it("sends GET to /api/balance", async () => {
    const fetch = mockFetchOk({ balance_cents: 1000, balance: "$10.00", usage_cents: 50 });
    vi.stubGlobal("fetch", fetch);

    await client.getBalance();

    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe("https://polls.eloquentanalytics.com/api/balance");
    expect(opts.method).toBe("GET");
  });

  it("returns parsed Balance on 200", async () => {
    vi.stubGlobal("fetch", mockFetchOk({ balance_cents: 1000, balance: "$10.00", usage_cents: 50 }));
    const result = await client.getBalance();
    expect(result.balance_cents).toBe(1000);
    expect(result.balance).toBe("$10.00");
    expect(result.usage_cents).toBe(50);
  });

  it("throws on auth error", async () => {
    vi.stubGlobal("fetch", mockFetchError(401, { error: "Invalid API key" }));
    await expect(client.getBalance()).rejects.toThrow(EloquentPollError);
  });
});

// ---------------------------------------------------------------------------
// EloquentPollError
// ---------------------------------------------------------------------------

describe("EloquentPollError", () => {
  it("is instanceof Error", () => {
    const err = new EloquentPollError("test", 400);
    expect(err).toBeInstanceOf(Error);
  });

  it("has correct name property", () => {
    const err = new EloquentPollError("test", 400);
    expect(err.name).toBe("EloquentPollError");
  });

  it("exposes statusCode", () => {
    const err = new EloquentPollError("bad", 422);
    expect(err.statusCode).toBe(422);
    expect(err.message).toBe("bad");
  });
});

// ---------------------------------------------------------------------------
// Build verification (Phase 5)
// ---------------------------------------------------------------------------

describe("Build artifacts", () => {
  it("dist/cli.js starts with shebang", () => {
    const cliPath = resolve(PKG_DIR, "dist/cli.js");
    const content = readFileSync(cliPath, "utf-8");
    expect(content.startsWith("#!/usr/bin/env node")).toBe(true);
  });

  it("dist/index.js exists", () => {
    expect(existsSync(resolve(PKG_DIR, "dist/index.js"))).toBe(true);
  });

  it("dist/index.d.ts exists", () => {
    expect(existsSync(resolve(PKG_DIR, "dist/index.d.ts"))).toBe(true);
  });

  it("package.json exports and bin point to existing files", () => {
    const pkg = JSON.parse(readFileSync(resolve(PKG_DIR, "package.json"), "utf-8"));
    expect(existsSync(resolve(PKG_DIR, pkg.main))).toBe(true);
    expect(existsSync(resolve(PKG_DIR, pkg.types))).toBe(true);
    expect(existsSync(resolve(PKG_DIR, pkg.bin.eloquentpolls))).toBe(true);
    expect(existsSync(resolve(PKG_DIR, pkg.exports["."].import))).toBe(true);
    expect(existsSync(resolve(PKG_DIR, pkg.exports["."].types))).toBe(true);
  });
});
