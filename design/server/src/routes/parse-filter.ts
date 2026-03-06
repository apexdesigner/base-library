export function parseFilter(query: unknown) {
  if (typeof query === 'string') {
    return JSON.parse(query);
  }
  return undefined;
}
