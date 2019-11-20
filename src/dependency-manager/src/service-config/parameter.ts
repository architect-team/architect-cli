export default abstract class ServiceParameter {
  abstract getAliases(): string[];
  abstract isRequired(): boolean;

  getDescription(): string {
    return '';
  }

  getDefaultValue(): string | number | undefined {
    return undefined;
  }
}
