import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { resolve } from "node:path";

const CLI_PATH = resolve(import.meta.dirname, "../dist/cli.js");

function run(
  args: string[],
  env?: Record<string, string>,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((res) => {
    execFile(
      "node",
      [CLI_PATH, ...args],
      { env: { ...process.env, ...env, EP_API_KEY: undefined as unknown as string }, timeout: 10_000 },
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
// Help
// ---------------------------------------------------------------------------

describe("CLI --help", () => {
  it("prints usage with 'npx eloquentpolls' and exits 0", async () => {
    const { stdout, exitCode } = await run(["--help"]);
    expect(stdout).toContain("npx eloquentpolls");
    expect(stdout).toContain("--options");
    expect(exitCode).toBe(0);
  });

  it("no args prints help and exits 0", async () => {
    const { stdout, exitCode } = await run([]);
    expect(stdout).toContain("npx eloquentpolls");
    expect(exitCode).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Argument validation
// ---------------------------------------------------------------------------

describe("CLI argument validation", () => {
  it("missing --options prints error to stderr, exits 1", async () => {
    const { stderr, exitCode } = await run(
      ["Some question?", "--key", "ep_k_fake"],
    );
    expect(stderr).toContain("--options");
    expect(exitCode).toBe(1);
  });

  it("single option (< 2) prints error to stderr, exits 1", async () => {
    const { stderr, exitCode } = await run(
      ["Some question?", "--options", "OnlyOne", "--key", "ep_k_fake"],
    );
    expect(stderr).toContain("2 options");
    expect(exitCode).toBe(1);
  });

  it("missing API key prints error to stderr, exits 1", async () => {
    const { stderr, exitCode } = await run(
      ["Some question?", "--options", "A,B"],
      { EP_API_KEY: "" },
    );
    expect(stderr).toContain("API key");
    expect(exitCode).toBe(1);
  });
});
