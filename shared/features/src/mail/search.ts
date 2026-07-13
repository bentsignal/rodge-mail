export const SEMANTIC_SEARCH_MIN_SCORE = 0.75;

export function getStrongSemanticMessageIds<Id>(
  matches: { messageId: Id; score: number }[],
) {
  return matches
    .filter((match) => match.score >= SEMANTIC_SEARCH_MIN_SCORE)
    .map((match) => match.messageId);
}

export function mergeSearchResults<T>(
  lexical: T[],
  semantic: T[],
  getId: (item: T) => string,
) {
  const seen = new Set(lexical.map(getId));
  return [
    ...lexical,
    ...semantic.filter((item) => {
      const id = getId(item);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    }),
  ];
}
