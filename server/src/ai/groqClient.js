import { config } from '../config/env.js';

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_ATTEMPTS = 2;
const MAX_BACKOFF_MS = 4000;

export class LlmError extends Error {
  constructor(code, message, { status, retryable = false } = {}) {
    super(message);
    this.name = 'LlmError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export function isLlmConfigured() {
  return Boolean(config.ai.apiKey);
}

// gpt-oss models reason before answering; "low" keeps those hidden tokens (which
// are billed) small. Qwen needs its <think> block hidden explicitly.
function reasoningOptions(model) {
  if (model.startsWith('openai/gpt-oss')) return { reasoning_effort: 'low', include_reasoning: false };
  if (model.startsWith('qwen/')) return { reasoning_format: 'hidden' };
  return {};
}

function backoffMs(attempt, response) {
  const retryAfter = Number(response?.headers.get('retry-after'));
  const ms = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt;
  return Math.min(ms, MAX_BACKOFF_MS);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function requestOnce(body) {
  let response;
  try {
    response = await fetch(GROQ_CHAT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.ai.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.ai.timeoutMs),
    });
  } catch (err) {
    const timedOut = err.name === 'TimeoutError';
    throw new LlmError(timedOut ? 'TIMEOUT' : 'NETWORK_ERROR', err.message, { retryable: true });
  }

  if (response.ok) return response.json();

  const payload = await response.json().catch(() => ({}));
  const message = payload.error?.message ?? `Groq responded with ${response.status}`;
  if (response.status === 429) {
    throw Object.assign(new LlmError('RATE_LIMITED', message, { status: 429, retryable: true }), { response });
  }
  if (response.status >= 500) {
    throw Object.assign(new LlmError('PROVIDER_ERROR', message, { status: response.status, retryable: true }), {
      response,
    });
  }
  // 4xx other than 429 (bad key, bad request) will not succeed on retry.
  throw new LlmError(response.status === 401 ? 'AUTH_ERROR' : 'BAD_REQUEST', message, { status: response.status });
}

/**
 * Single chat completion against one model, retrying transient failures.
 * Returns { content, model, usage: { promptTokens, completionTokens }, latencyMs }.
 */
export async function chatCompletion({ model, messages, maxTokens, temperature = 0.2, jsonSchema }) {
  if (!isLlmConfigured()) throw new LlmError('NOT_CONFIGURED', 'GROQ_API_KEY is not set');

  const body = {
    model,
    messages,
    temperature,
    max_completion_tokens: maxTokens,
    ...reasoningOptions(model),
    ...(jsonSchema
      ? { response_format: { type: 'json_schema', json_schema: { name: jsonSchema.name, strict: true, schema: jsonSchema.schema } } }
      : {}),
  };

  const startedAt = Date.now();
  for (let attempt = 0; ; attempt += 1) {
    try {
      const data = await requestOnce(body);
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) throw new LlmError('EMPTY_RESPONSE', 'Model returned an empty response');
      return {
        content,
        model: data.model ?? model,
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? null,
          completionTokens: data.usage?.completion_tokens ?? null,
        },
        latencyMs: Date.now() - startedAt,
      };
    } catch (err) {
      if (!(err instanceof LlmError) || !err.retryable || attempt + 1 >= MAX_ATTEMPTS) {
        err.latencyMs = Date.now() - startedAt;
        throw err;
      }
      await sleep(backoffMs(attempt, err.response));
    }
  }
}
