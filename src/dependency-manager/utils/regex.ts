export const matches = (text: string, pattern: RegExp): { [Symbol.iterator]: () => Generator<RegExpExecArray, void, unknown>; } => ({
  [Symbol.iterator]: function* () {
    const clone = new RegExp(pattern.source, pattern.flags);
    let match = null;
    do {
      match = clone.exec(text);
      if (match) {
        yield match;
        clone.lastIndex = match.index + 1; // Support overlapping match groups
      }
    } while (match);
  },
});

export function escapeRegex(string: string): string {
  return string.replace(/[$()*+./?[\\\]^{|}-]/g, '\\$&');
}
