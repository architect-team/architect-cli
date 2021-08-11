export interface Dictionary<T> {
  [key: string]: T;
}

export const transformDictionary = <T, U>(transform: (key: string, value: T, ...args: any) => U, input?: Dictionary<T>, ...args: any): Dictionary<U> => {
  if (!input) {
    return {};
  }

  const output: Dictionary<U> = {};
  for (const [key, value] of Object.entries(input)) {
    output[key] = transform(key, value, args);
  }
  return output;
};
