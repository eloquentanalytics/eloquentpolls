#!/usr/bin/env node
/**
 * Eloquent Poll CLI
 * Usage: npx eloquentpolls "Question?" --options "A,B,C" --key ep_k_xxx
 */

const args = process.argv.slice(2);

function getFlag(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

async function main() {
  if (hasFlag("help") || args.length === 0) {
    console.log(`
Eloquent Poll CLI - Multi-model consensus polling

Usage:
  npx eloquentpolls "Your question here?" --options "Option A,Option B,Option C" --key ep_k_xxx

Options:
  --options     Comma-separated list of options (required)
  --key         API key (or set EP_API_KEY env var)
  --preset      Model preset: broad, fast, strong (default: broad)
  --threshold   Confidence threshold 0-1 (default: 0.95)
  --max-cost    Maximum cost in USD (default: 1.00)
  --base-url    API base URL (default: https://polls.eloquentanalytics.com)
  --dry-run     Validate and estimate cost without running
  --json        Output raw JSON response
  --help        Show this help message
`);
    process.exit(0);
  }

  // Find question (first non-flag argument)
  const question = args.find((a) => !a.startsWith("--") && args.indexOf(a) === 0 || (args.indexOf(a) > 0 && !args[args.indexOf(a) - 1].startsWith("--")));

  if (!question) {
    console.error("Error: Question is required as the first argument");
    process.exit(1);
  }

  const optionsStr = getFlag("options");
  if (!optionsStr) {
    console.error("Error: --options is required");
    process.exit(1);
  }

  const options = optionsStr.split(",").map((o) => o.trim()).filter((o) => o.length > 0);
  if (options.length < 2) {
    console.error("Error: At least 2 options are required");
    process.exit(1);
  }

  const apiKey = getFlag("key") || process.env.EP_API_KEY;
  if (!apiKey) {
    console.error("Error: API key required. Use --key or set EP_API_KEY env var");
    process.exit(1);
  }

  const baseUrl = (getFlag("base-url") || process.env.EP_BASE_URL || "https://polls.eloquentanalytics.com").replace(/\/$/, "");
  const preset = getFlag("preset") || "broad";
  const threshold = parseFloat(getFlag("threshold") || "0.95");
  const maxCost = parseFloat(getFlag("max-cost") || "1.00");
  const dryRun = hasFlag("dry-run");
  const jsonOutput = hasFlag("json");

  if (dryRun) {
    const url = `${baseUrl}/api/poll/dry-run`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "eloquentpolls/1.0.0",
      },
      body: JSON.stringify({
        question,
        options,
        preset,
        confidence_threshold: threshold,
        max_cost_usd: maxCost,
      }),
    });

    const result = await response.json();
    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      const data = result as { valid: boolean; errors: string[]; estimates: { estimated_cost_usd: number; estimated_models_invoked: number; total_models: number; estimated_latency_ms: number } };
      console.log(`\nDry Run Results:`);
      console.log(`  Valid: ${data.valid ? "Yes" : "No"}`);
      if (data.errors?.length > 0) {
        console.log(`  Errors: ${data.errors.join(", ")}`);
      }
      console.log(`  Estimated cost: $${data.estimates?.estimated_cost_usd?.toFixed(4)}`);
      console.log(`  Models: ~${data.estimates?.estimated_models_invoked} of ${data.estimates?.total_models}`);
      console.log(`  Est. latency: ${data.estimates?.estimated_latency_ms}ms`);
    }
    return;
  }

  console.log(`\nPolling: "${question}"`);
  console.log(`Options: ${options.join(", ")}`);
  console.log(`Preset: ${preset} | Threshold: ${threshold} | Max cost: $${maxCost}`);
  console.log(`Waiting for consensus...\n`);

  const response = await fetch(`${baseUrl}/api/poll`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "eloquentpolls/1.0.0",
    },
    body: JSON.stringify({
      question,
      options,
      preset,
      confidence_threshold: threshold,
      max_cost_usd: maxCost,
      surface: "cli_wrapper",
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    console.error(`Error (${response.status}): ${(error as { error: string }).error}`);
    process.exit(1);
  }

  const result = await response.json() as {
    poll_id: string;
    status: string;
    winning_option: string | null;
    is_tie: boolean;
    tally: Record<string, number>;
    early_terminated: boolean;
    termination_reason: string | null;
    timing: { total_ms: number };
    costs: { total_estimated_cost: number };
    votes: Array<{ model_id: string; chosen_option: string | null }>;
  };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Poll ID: ${result.poll_id}`);
  console.log(`Status: ${result.status}`);
  console.log(`Winner: ${result.winning_option || (result.is_tie ? "TIE" : "N/A")}`);
  console.log(`\nTally:`);
  for (const [option, count] of Object.entries(result.tally)) {
    const bar = "\u2588".repeat(count);
    console.log(`  ${option}: ${bar} (${count})`);
  }
  console.log(`\nEarly terminated: ${result.early_terminated} (${result.termination_reason})`);
  console.log(`Time: ${result.timing.total_ms}ms | Cost: $${result.costs.total_estimated_cost.toFixed(4)}`);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
