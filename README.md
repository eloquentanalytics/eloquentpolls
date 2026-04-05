# eloquentpolls

[![npm version](https://img.shields.io/npm/v/eloquentpolls.svg)](https://www.npmjs.com/package/eloquentpolls)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

TypeScript SDK and CLI for the [Eloquent Poll](https://polls.eloquentanalytics.com) multi-model consensus polling API.

Eloquent Poll runs your question across multiple frontier LLMs simultaneously and returns the consensus answer, confidence tally, and per-model votes. One API call, many models, one winner.

## Install

```bash
npm install eloquentpolls
```

Or run the CLI directly:

```bash
npx eloquentpolls "Your question?" --options "A,B,C" --key ep_k_xxx
```

## SDK usage

```typescript
import { EloquentPoll } from "eloquentpolls";

const client = new EloquentPoll({ apiKey: "ep_k_xxx" });

// Run a poll
const result = await client.poll({
  question: "Which JavaScript framework has the best DX?",
  options: ["React", "Vue", "Svelte"],
  preset: "broad",         // broad | fast | strong
  max_cost_usd: 1.00,
});

console.log(result.winning_option); // "React"
console.log(result.tally);          // { React: 5, Vue: 2, Svelte: 1 }

// Get a previous result
const detail = await client.getResult(result.poll_id);

// Check balance
const balance = await client.getBalance();
console.log(balance.balance); // "$9.42"
```

## CLI usage

```bash
npx eloquentpolls "Which color is best?" --options "Red,Blue,Green" --key ep_k_xxx
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--options` | Comma-separated list of options (required) | -- |
| `--key` | API key (or set `EP_API_KEY` env var) | -- |
| `--preset` | Model preset: `broad`, `fast`, `strong` | `broad` |
| `--threshold` | Confidence threshold 0-1 | `0.95` |
| `--max-cost` | Maximum cost in USD | `1.00` |
| `--base-url` | API base URL | `https://polls.eloquentanalytics.com` |
| `--dry-run` | Estimate cost without running | -- |
| `--json` | Output raw JSON | -- |

### Example output

```
Polling: "Which color is best?"
Options: Red, Blue, Green
Preset: broad | Threshold: 0.95 | Max cost: $1.00
Waiting for consensus...

Poll ID: ep_abc123
Status: success
Winner: Blue

Tally:
  Red: ██ (2)
  Blue: █████ (5)
  Green: █ (1)

Early terminated: true (mathematical_lock)
Time: 3241ms | Cost: $0.0087
```

## API

### `new EloquentPoll({ apiKey, baseUrl? })`

Create a client. `baseUrl` defaults to `https://polls.eloquentanalytics.com`.

### `client.poll(request): Promise<PollResponse>`

Run a multi-model consensus poll. Returns the winner, tally, per-model votes, timing, and cost.

**PollRequest fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `question` | `string` | Yes | The question to poll |
| `options` | `string[]` | Yes | 2+ options to choose from |
| `preset` | `"broad" \| "fast" \| "strong"` | No | Model roster preset |
| `confidence_threshold` | `number` | No | 0-1, default 0.95 |
| `max_cost_usd` | `number` | No | Budget cap per poll |
| `surface` | `string` | No | Tracking surface identifier |

### `client.getResult(pollId): Promise<ResultDetail>`

Retrieve a previous poll result by ID.

### `client.getBalance(): Promise<Balance>`

Check your account balance and usage.

### `EloquentPollError`

Thrown on API errors. Exposes `statusCode` and `message`.

```typescript
try {
  await client.poll({ question: "Q?", options: ["A"] });
} catch (e) {
  if (e instanceof EloquentPollError) {
    console.log(e.statusCode); // 400
    console.log(e.message);    // "At least 2 options are required"
  }
}
```

## Types

Full TypeScript types are included and exported:

- `PollRequest` -- input to `poll()`
- `PollResponse` -- poll result with winner, tally, votes, timing, cost
- `ResultDetail` -- stored result retrieved by ID
- `Balance` -- account balance and usage
- `VoteResult` -- individual model vote
- `EloquentPollConfig` -- constructor options

## Links

- [npm package](https://www.npmjs.com/package/eloquentpolls)
- [API documentation](https://polls.eloquentanalytics.com/api/docs)
- [Eloquent Analytics](https://polls.eloquentanalytics.com)

## License

MIT
