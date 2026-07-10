export function openAiApiKey() {
  return process.env.OPENAI_API_KEY;
}

export function classificationModelOverride() {
  return process.env.AI_CLASSIFICATION_MODEL;
}

export function embeddingModelOverride() {
  return process.env.AI_EMBEDDING_MODEL;
}
