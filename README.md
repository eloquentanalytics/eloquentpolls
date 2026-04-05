# eloquentpolls

TypeScript SDK and CLI for the [Eloquent Poll](https://polls.eloquentanalytics.com) multi-model consensus polling API.

## Install

```bash
npm install eloquentpolls
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
| `--options` | Comma-separated list of options (required) | — |
| `--key` | API key (or set `EP_API_KEY` env var) | — |
| `--preset` | Model preset: `broad`, `fast`, `strong` | `broad` |
| `--threshold` | Confidence threshold 0–1 | `0.95` |
| `--max-cost` | Maximum cost in USD | `1.00` |
| `--base-url` | API base URL | `https://polls.eloquentanalytics.com` |
| `--dry-run` | Estimate cost without running | — |
| `--json` | Output raw JSON | — |

## API

### `new EloquentPoll({ apiKey, baseUrl? })`

Create a client. `baseUrl` defaults to `https://polls.eloquentanalytics.com`.

### `client.poll(request): Promise<PollResponse>`

Run a multi-model consensus poll. Returns the winner, tally, per-model votes, timing, and cost.

### `client.getResult(pollId): Promise<ResultDetail>`

Retrieve a previous poll result by ID.

### `client.getBalance(): Promise<Balance>`

Check your account balance and usage.

### `EloquentPollError`

Thrown on API errors. Exposes `statusCode` and `message`.

## Types

Full TypeScript types are included: `PollRequest`, `PollResponse`, `ResultDetail`, `Balance`, `VoteResult`, `EloquentPollConfig`.

## License

MIT
