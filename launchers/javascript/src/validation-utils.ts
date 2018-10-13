export interface StringValidator {
  test(str: string): boolean;
}

export class SemvarValidator implements StringValidator {
  test(str: string) {
    return str.match(
      /\bv?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[\da-z-]+(?:\.[\da-z-]+)*)?(?:\+[\da-z-]+(?:\.[\da-z-]+)*)?\b/ig
    ) !== null;
  }
}
