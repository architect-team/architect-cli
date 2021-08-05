export interface Dictionary<T> {
  [key: string]: T;
}

export const transformDictionary = <T, U>(transform: (key: string, value: T) => U, input?: Dictionary<T>): Dictionary<U> => {
  if (!input) {
    return {};
  }

  const output: Dictionary<U> = {};
  for (const [key, value] of Object.entries(input)) {
    output[key] = transform(key, value);
  }
  return output;
};
