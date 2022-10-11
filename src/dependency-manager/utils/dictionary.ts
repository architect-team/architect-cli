import { IF_EXPRESSION_REGEX } from '../spec/utils/interpolation';

export interface Dictionary<T> {
  [key: string]: T;
}

export const transformDictionary = <T, U>(transform: (key: string, value: T, ...args: any) => U, input?: Dictionary<T>, ...args: any): Dictionary<U> => {
  if (!input) {
    return {};
  }

  const output: Dictionary<U> = {};
  for (const [key, value] of Object.entries(input)) {
    if (IF_EXPRESSION_REGEX.test(key)) {
      continue;
    }
    output[key] = transform(key, value, ...args);
  }
  return output;
};

export const sortOnKeys = <T>(dict: Dictionary<T>): Dictionary<T> => {
  const sorted = [];
  // eslint-disable-next-line guard-for-in
  for (const key in dict) {
    sorted[sorted.length] = key;
  }
  sorted.sort();

  const tempDict: Dictionary<T> = {};
  for (let i = 0; i < sorted.length; i++) {
    tempDict[sorted[i]] = dict[sorted[i]];
  }

  return tempDict;
};
