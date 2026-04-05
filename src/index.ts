export type { PollRequest, PollResponse, ResultDetail, Balance, VoteResult, EloquentPollConfig } from "./types.js";
import type { PollRequest, PollResponse, ResultDetail, Balance, EloquentPollConfig } from "./types.js";

const DEFAULT_BASE_URL = "https://polls.eloquentanalytics.com";

export class EloquentPoll {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: EloquentPollConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${this.apiKey}`,
      "User-Agent": "eloquentpolls/1.0.0",
    };

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new EloquentPollError(
        (error as { error?: string }).error || `HTTP ${response.status}`,
        response.status,
      );
    }

    return response.json() as Promise<T>;
  }

  async poll(input: PollRequest): Promise<PollResponse> {
    return this.request<PollResponse>("POST", "/api/poll", {
      ...input,
      surface: input.surface || "installable_client_libraries",
    });
  }

  async getResult(pollId: string): Promise<ResultDetail> {
    return this.request<ResultDetail>("GET", `/api/results/${encodeURIComponent(pollId)}`);
  }

  async getBalance(): Promise<Balance> {
    return this.request<Balance>("GET", "/api/balance");
  }
}

export class EloquentPollError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = "EloquentPollError";
  }
}
