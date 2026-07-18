export const AI_DAILY_LIMIT_USD = 1;

interface TokenUsage {
  inputTokens: number;
  cachedInputTokens?: number;
  outputTokens?: number;
}

export function calculateModelCostUsd(model: string, usage: TokenUsage) {
  const pricing = pricingForModel(model);
  const inputTokens = nonnegativeInteger(usage.inputTokens);
  const cachedInputTokens = Math.min(
    inputTokens,
    nonnegativeInteger(usage.cachedInputTokens ?? 0),
  );
  const uncachedInputTokens = inputTokens - cachedInputTokens;
  const outputTokens = nonnegativeInteger(usage.outputTokens ?? 0);
  return (
    (uncachedInputTokens * pricing.inputPerMillion +
      cachedInputTokens * pricing.cachedInputPerMillion +
      outputTokens * pricing.outputPerMillion) /
    1_000_000
  );
}

export function reserveResponseCostUsd(args: {
  model: string;
  inputCharacters: number;
  maxOutputTokens: number;
}) {
  return calculateModelCostUsd(args.model, {
    inputTokens: Math.max(1, Math.ceil(args.inputCharacters)),
    outputTokens: args.maxOutputTokens,
  });
}

export function reserveEmbeddingCostUsd(
  model: string,
  inputCharacters: number,
) {
  return calculateModelCostUsd(model, {
    inputTokens: Math.max(1, Math.ceil(inputCharacters)),
  });
}

export function utcDayBounds(now: number) {
  const date = new Date(now);
  const start = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  return { start, end: start + 24 * 60 * 60 * 1_000 };
}

export function canReserveDailyUsage(
  spentUsd: number,
  reservedCostUsd: number,
  limitUsd = AI_DAILY_LIMIT_USD,
) {
  return (
    Number.isFinite(spentUsd) &&
    Number.isFinite(reservedCostUsd) &&
    spentUsd >= 0 &&
    reservedCostUsd > 0 &&
    reservedCostUsd <= limitUsd &&
    spentUsd + reservedCostUsd <= limitUsd
  );
}

function pricingForModel(model: string) {
  if (model === "gpt-5-nano" || model.startsWith("gpt-5-nano-")) {
    return {
      inputPerMillion: 0.05,
      cachedInputPerMillion: 0.005,
      outputPerMillion: 0.4,
    };
  }
  if (model === "text-embedding-3-small") {
    return {
      inputPerMillion: 0.02,
      cachedInputPerMillion: 0.02,
      outputPerMillion: 0,
    };
  }
  throw new Error(`AI usage pricing is not configured for model ${model}`);
}

function nonnegativeInteger(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}
