export interface PollRequest {
  question: string;
  options: string[];
  poll_type?: "fptp";
  preset?: "broad" | "fast" | "strong";
  confidence_threshold?: number;
  max_cost_usd?: number;
  surface?: string;
}

export interface VoteResult {
  model_id: string;
  success: boolean;
  chosen_option: string | null;
  transition: string;
  latency_ms: number;
  estimated_cost: number;
  error: string | null;
}

export interface PollResponse {
  poll_id: string;
  status: "success" | "partial" | "failed";
  outcome: string;
  question: string;
  options: string[];
  poll_type: string;
  winning_option: string | null;
  is_tie: boolean;
  confidence_threshold: number;
  max_cost_usd: number;
  early_terminated: boolean;
  termination_reason: string | null;
  models_skipped: number;
  tally: Record<string, number>;
  votes: VoteResult[];
  timing: { gather_ms: number; total_ms: number };
  costs: { total_estimated_cost: number };
}

export interface ResultDetail {
  poll_id: string;
  status: string;
  question: string | null;
  options: string[];
  poll_type: string;
  winning_option: string | null;
  is_tie: boolean;
  tally: Record<string, number>;
  votes: VoteResult[];
  models_requested: number;
  models_succeeded: number;
  created_at: string;
}

export interface Balance {
  balance_cents: number;
  balance: string;
  usage_cents: number;
}

export interface EloquentPollConfig {
  apiKey: string;
  baseUrl?: string;
}
