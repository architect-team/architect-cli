export type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

// a typing for the raw result of js-yaml.load();
// eslint-disable-next-line @typescript-eslint/ban-types
export type ParsedYaml = object | string | number | null | undefined;
