// eslint-disable-next-line @typescript-eslint/ban-types
export type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;

export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };
