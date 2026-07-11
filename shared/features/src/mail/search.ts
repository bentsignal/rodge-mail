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
