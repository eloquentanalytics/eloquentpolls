import { describe, it, expect } from "vitest";
import { EloquentPoll, EloquentPollError } from "../src/index.js";
import { execFile } from "node:child_process";
import { resolve } from "node:path";

const API_KEY = process.env.EP_API_KEY;
const BASE_URL = process.env.EP_BASE_URL || "https://polls.eloquentanalytics.com";
const CLI_PATH = resolve(import.meta.dirname, "../dist/cli.js");
const SKIP = !API_KEY;

function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((res) => {
    execFile(
      "node",
      [CLI_PATH, ...args],
      { env: { ...process.env }, timeout: 120_000 },
      (error, stdout, stderr) => {
        res({
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          exitCode: error?.code !== undefined ? (error as unknown as { status: number }).status ?? 1 : 0,
        });
      },
    );
  });
}

// ---------------------------------------------------------------------------
// SDK integration
// ---------------------------------------------------------------------------

describe.skipIf(SKIP)("SDK integration", () => {
  const client = new EloquentPoll({ apiKey: API_KEY!, baseUrl: BASE_URL });

  it("getBalance() returns a valid Balance object", async () => {
    const balance = await client.getBalance();
    expect(balance).toHaveProperty("balance_cents");
    expect(balance).toHaveProperty("balance");
    expect(balance).toHaveProperty("usage_cents");
    expect(typeof balance.balance_cents).toBe("number");
    expect(typeof balance.balance).toBe("string");
  });

  it("poll() with a simple 2-option question returns a valid PollResponse", async () => {
    const result = await client.poll({
      question: "Integration test: Is the sky blue or green?",
      options: ["Blue", "Green"],
      preset: "fast",
      max_cost_usd: 0.50,
    });

    expect(result).toHaveProperty("poll_id");
    expect(result).toHaveProperty("winning_option");
    expect(result).toHaveProperty("tally");
    expect(typeof result.poll_id).toBe("string");
    expect(result.poll_id.length).toBeGreaterThan(0);
  }, 120_000);

  it("getResult() with a poll_id returns matching ResultDetail", async () => {
    // Run a poll first to get a valid id
    const poll = await client.poll({
      question: "Integration test: cats or dogs?",
      options: ["Cats", "Dogs"],
      preset: "fast",
      max_cost_usd: 0.50,
    });

    const result = await client.getResult(poll.poll_id);
    expect(result.poll_id).toBe(poll.poll_id);
    expect(result).toHaveProperty("tally");
    expect(result).toHaveProperty("votes");
  }, 120_000);

  it("poll() with 1 option throws EloquentPollError with status 400", async () => {
    await expect(
      client.poll({
        question: "Bad poll",
        options: ["OnlyOne"],
      }),
    ).rejects.toThrow(EloquentPollError);

    try {
      await client.poll({ question: "Bad poll", options: ["OnlyOne"] });
    } catch (e) {
      expect((e as EloquentPollError).statusCode).toBe(400);
    }
  });
});

// ---------------------------------------------------------------------------
// CLI integration
// ---------------------------------------------------------------------------

describe.skipIf(SKIP)("CLI integration", () => {
  it("runs a poll with --json and returns valid JSON with poll_id", async () => {
    const { stdout, exitCode } = await runCli([
      "Integration test: red or blue?",
      "--options", "Red,Blue",
      "--key", API_KEY!,
      "--base-url", BASE_URL,
      "--preset", "fast",
      "--max-cost", "0.50",
      "--json",
    ]);

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty("poll_id");
    expect(typeof parsed.poll_id).toBe("string");
  }, 120_000);

  it("runs a dry run with --json and returns estimates", async () => {
    const { stdout, exitCode } = await runCli([
      "Integration test: dry run?",
      "--options", "Yes,No",
      "--key", API_KEY!,
      "--base-url", BASE_URL,
      "--dry-run",
      "--json",
    ]);

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty("valid");
    expect(parsed).toHaveProperty("estimates");
  }, 30_000);
});
