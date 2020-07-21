import chalk from 'chalk';

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

export const EnvironmentNameValidator = new RegExp('^[a-z0-9]([-a-z0-9]*[a-z0-9])?$');
export const PlatformNameValidator = new RegExp('^[a-z0-9]([-a-z0-9]*[a-z0-9])?$');
export const ServiceNameValidator = new RegExp('^[a-z0-9]([-a-z0-9]*[a-z0-9])?(/[a-z0-9]([-a-z0-9]*[a-z0-9])?)?$');
export const EnvNameValidator = new RegExp('^[-._a-zA-Z][-._a-zA-Z0-9]*$');

export enum ValidationSeverity {
  INFO = 0,
  WARNING = 1,
  ERROR = 2,
}

export interface ValidationResult {
  valid: boolean;
  slug: string;
  rule: string;
  doc_ref: string;
  severity: ValidationSeverity;
  details?: string;
}

export class ValidationClient {

  public static summarize(validation_results: ValidationResult[]) {
    const failing_rules = validation_results.filter(r => !r.valid);
    const passing_rules = validation_results.filter(r => r.valid);
    const error_count = failing_rules.filter(r => !r.valid && r.severity === ValidationSeverity.ERROR).length;
    const warning_count = failing_rules.filter(r => !r.valid && r.severity === ValidationSeverity.WARNING).length;
    const info_count = failing_rules.filter(r => !r.valid && r.severity === ValidationSeverity.INFO).length;

    return {
      all_passing: passing_rules.length === validation_results.length,
      passing_count: passing_rules.length,
      message: (
        (error_count ? ValidationClient.resolve_color_function(ValidationSeverity.ERROR)(`${error_count} error${error_count > 1 ? 's ' : ' '}`) : ' ') +
        (warning_count ? ValidationClient.resolve_color_function(ValidationSeverity.WARNING)(`${warning_count} warning${warning_count > 1 ? 's ' : ' '}`) : ' ') +
        (info_count ? ValidationClient.resolve_color_function(ValidationSeverity.INFO)(`${info_count} info${info_count > 1 ? 's ' : ' '}`) : ' ')
      ),
      blocker_count: error_count,
      failure_report: ValidationClient.build_all_failure_messages(failing_rules),
    };
  }

  public static build_all_failure_messages(failures: ValidationResult[]) {
    let failure_message = '';
    for (const failure of failures) {
      failure_message = failure_message + ValidationClient.build_failure_message(failure);
    }
    return failure_message;
  }

  public static build_failure_message(failure: ValidationResult) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    const color_fnc = ValidationClient.resolve_color_function(failure.severity);
    let failure_message = color_fnc(ValidationSeverity[failure.severity] + ': ' + failure.rule) + '\n';

    if (failure.details) {
      failure_message = failure_message + `\t${color_fnc('Details: ' + failure.details)}\n`;
    }
    failure_message = failure_message + `\t${color_fnc(failure.doc_ref)}\n`;
    failure_message = failure_message + '\n';
    return failure_message;
  }

  public static resolve_color_function(severity: ValidationSeverity) {
    switch (severity) {
      case ValidationSeverity.ERROR:
        return chalk.red;
      case ValidationSeverity.WARNING:
        return chalk.yellow;
      case ValidationSeverity.INFO:
        return chalk.blue;
      default:
        return chalk.white;
    }
  }

}
