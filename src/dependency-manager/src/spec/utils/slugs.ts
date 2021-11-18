export type ArchitectSlug = string; // a string that passes Slugs.ArchitectSlugValidator (ie "account-name")
export type ComponentTag = string; // "tag"

export class Slugs {

  public static DEFAULT_TAG = 'latest';

  public static NAMESPACE_DELIMITER = '/';
  public static TAG_DELIMITER = ':';
  public static INSTANCE_DELIMITER = '@';
  public static SLUG_CHAR_LIMIT = 32;

  public static ArchitectSlugDescriptionNoMaxLength = `must contain only lower alphanumeric and single hyphens or underscores in the middle`;
  public static ArchitectSlugRegexNoMaxLength = `[a-z0-9]+(?:[-_][a-z0-9]+)*`; // does not contain character count lookaheads
  public static ArchitectSlugNoMaxLengthValidator = new RegExp(`^${Slugs.ArchitectSlugRegexNoMaxLength}$`);

  public static ArchitectSlugDescription = `${Slugs.ArchitectSlugDescriptionNoMaxLength}; max length ${Slugs.SLUG_CHAR_LIMIT}`;
  static CharacterCountLookahead = `(?=.{1,${Slugs.SLUG_CHAR_LIMIT}}(\\${Slugs.NAMESPACE_DELIMITER}|${Slugs.TAG_DELIMITER}|$))`;
  public static ArchitectSlugRegexBase = `${Slugs.CharacterCountLookahead}${Slugs.ArchitectSlugRegexNoMaxLength}`;
  public static ArchitectSlugValidator = new RegExp(`^${Slugs.ArchitectSlugRegexBase}$`);

  public static LabelMax = 63;
  public static LabelSlugDescription = `max length ${Slugs.LabelMax} characters, must begin and end with an alphanumeric character ([a-z0-9A-Z]), could contain dashes (-), underscores (_), dots (.), and alphanumerics between.`;
  public static LabelValueSlugRegexNoMaxLength = '(([A-Za-z0-9][-A-Za-z0-9_.]*)?[A-Za-z0-9])?';
  public static LabelValueSlugValidatorString = `^(?=.{1,${Slugs.LabelMax}})${Slugs.LabelValueSlugRegexNoMaxLength}$`;
  public static LabelValueSlugValidator = new RegExp(Slugs.LabelValueSlugValidatorString);
  public static LabelKeySlugRegexNoMaxLength = '(([a-z0-9][-a-z0-9_.]*)?[a-z0-9])?';
  public static LabelKeySlugValidatorString = `^(?=(.{1,${Slugs.LabelMax}}/)?.{1,${Slugs.LabelMax}}$)(${Slugs.LabelKeySlugRegexNoMaxLength}/)?${Slugs.LabelValueSlugRegexNoMaxLength}$`;
  public static LabelKeySlugValidator = new RegExp(Slugs.LabelKeySlugValidatorString);

  public static ComponentTagDescription = 'max length 127 characters, must begin and end with an alphanumeric character ([a-z0-9A-Z]), could contain dashes (-), dots (.), and alphanumerics between.';
  public static ComponentTagRegexBase = `[\\w][\\w\\.-]{0,127}`;
  public static ComponentTagValidator = new RegExp(`^${Slugs.ComponentTagRegexBase}$`);

  public static ComponentParameterDescription = 'must contain alphanumeric character ([a-z0-9A-Z]), could contain dashes (-), underscores (_), and alphanumerics between.';
  public static ComponentParameterRegexBase = `[a-zA-Z0-9_-]+`;
  public static ComponentParameterValidator = new RegExp(`^${Slugs.ComponentParameterRegexBase}$`);
}

export type SlugKind = 'component' | 'component_version' | 'service' | 'service_version' | 'environment' | 'gateway' | 'interfaces';
export interface ParsedSlug {
  kind: SlugKind;
  component_account_name?: string;
  component_name?: string;
  service_name?: string;
  tag?: string;
  environment_account_name?: string;
  environment_name?: string;
}

export type ComponentSlug = string; // "<account-name>/<component-name>"
export interface ParsedComponentSlug extends ParsedSlug {
  kind: 'component';
  component_account_name: string;
  component_name: string;
  instance_name: string;
}

export abstract class SlugUtils {
  public static Description: string;
  public static Validator: RegExp;
  public static parse: (slug: string) => ParsedSlug;
}

export class ComponentSlugUtils extends SlugUtils {

  public static Description = 'Must be prefixed with a valid Architect account and separated by a slash (e.g. architect/component-name). The following slug must be kebab-case: alphanumerics punctuated only by dashes.';

  static RegexNoMaxLength = `${Slugs.ArchitectSlugRegexNoMaxLength}${Slugs.NAMESPACE_DELIMITER}${Slugs.ArchitectSlugRegexNoMaxLength}`; // does not contain character count lookaheads
  static RegexBase = `${Slugs.ArchitectSlugRegexBase}${Slugs.NAMESPACE_DELIMITER}${Slugs.ArchitectSlugRegexBase}(?:${Slugs.INSTANCE_DELIMITER}${Slugs.ComponentTagRegexBase})?`;

  public static Validator = new RegExp(`^${ComponentSlugUtils.RegexBase}$`);

  public static build = (account_name: string, component_name: string): ComponentSlug => {
    return `${account_name}${Slugs.NAMESPACE_DELIMITER}${component_name}`;
  };

  public static parse = (slug: ComponentSlug): ParsedComponentSlug => {
    if (!ComponentSlugUtils.Validator.test(slug)) {
      throw new Error(ComponentSlugUtils.Description);
    }

    const [full_component_slug, instance_name] = slug.split(Slugs.INSTANCE_DELIMITER);
    const [account_name, component_name] = full_component_slug.split(Slugs.NAMESPACE_DELIMITER);
    return {
      kind: 'component',
      component_account_name: account_name,
      component_name: component_name,
      instance_name: instance_name || '',
    };
  };
}

export type ComponentVersionSlug = string; // "<account-name>/<component-name>:<tag>"
export interface ParsedComponentVersionSlug extends ParsedSlug {
  kind: 'component_version';
  component_account_name: string;
  component_name: string;
  tag: string;
  instance_name: string;
}
export class ComponentVersionSlugUtils extends SlugUtils {

  public static Description = `must be of the form <account-name>/<component-name>:<tag> OR <account-name>/<component-name>. The latter will assume \`${Slugs.DEFAULT_TAG}\` tag`;

  public static RegexNoMaxLength = `${ComponentSlugUtils.RegexNoMaxLength}(?:${Slugs.TAG_DELIMITER}${Slugs.ComponentTagRegexBase})`;
  public static RegexOptionalTag = `${ComponentSlugUtils.RegexNoMaxLength}(?:${Slugs.TAG_DELIMITER}${Slugs.ComponentTagRegexBase})?`; // for when the tag is optional
  public static RegexBase = `${ComponentSlugUtils.RegexBase}(?:${Slugs.TAG_DELIMITER}${Slugs.ComponentTagRegexBase})(?:${Slugs.INSTANCE_DELIMITER}${Slugs.ComponentTagRegexBase})?`; // tag is required

  public static Validator = new RegExp(`^${ComponentVersionSlugUtils.RegexBase}$`);

  public static build = (component_account_name: string, component_name: string, tag: string = Slugs.DEFAULT_TAG, instance_name = ''): ComponentVersionSlug => {
    let slug = `${component_account_name}${Slugs.NAMESPACE_DELIMITER}${component_name}${Slugs.TAG_DELIMITER}${tag}`;
    if (instance_name) {
      slug = `${slug}${Slugs.INSTANCE_DELIMITER}${instance_name}`;
    }
    return slug;
  };

  public static toComponentSlug(slug: ComponentVersionSlug): ComponentSlug {
    const parsed = ComponentVersionSlugUtils.parse(slug);
    return ComponentSlugUtils.build(parsed.component_account_name, parsed.component_name);
  }

  public static parse = (slug: ComponentVersionSlug): ParsedComponentVersionSlug => {
    if (!ComponentVersionSlugUtils.Validator.test(slug)) {
      // if it doesn't pass the ComponentVersionSlug validator, try parsing it with the ComponentSlugUtils, and set the tag to DEFAULT ("latest")
      try {
        return {
          ...ComponentSlugUtils.parse(slug),
          tag: Slugs.DEFAULT_TAG,
          kind: 'component_version',
        };
        // eslint-disable-next-line no-empty
      } catch { }
      throw new Error(ComponentVersionSlugUtils.Description);
    }
    const [full_component_slug, instance_name] = slug.split(Slugs.INSTANCE_DELIMITER);
    const [component_slug, tag] = full_component_slug.split(Slugs.TAG_DELIMITER);
    if (!Slugs.ComponentTagValidator.test(tag)) {
      throw new Error(Slugs.ComponentTagDescription);
    }
    const { component_account_name, component_name } = ComponentSlugUtils.parse(component_slug);
    return {
      kind: 'component_version',
      component_account_name,
      component_name,
      tag,
      instance_name: instance_name || '',
    };
  };
}

export type ServiceSlug = string; // "account-name/component-name/service-name"
export interface ParsedServiceSlug extends ParsedSlug {
  kind: 'service';
  component_account_name: string;
  component_name: string;
  service_name: string;
}
export class ServiceSlugUtils extends SlugUtils {

  public static Description = 'must be of the form <account-name>/<component-name>/<service-name>';
  public static RegexBase = `${Slugs.ArchitectSlugRegexBase}${Slugs.NAMESPACE_DELIMITER}${Slugs.ArchitectSlugRegexBase}${Slugs.NAMESPACE_DELIMITER}${Slugs.ArchitectSlugRegexBase}`;
  public static Validator = new RegExp(`^${ServiceSlugUtils.RegexBase}$`);

  public static build = (account_name: string, component_name: string, service_name: string): ServiceSlug => {
    return `${account_name}${Slugs.NAMESPACE_DELIMITER}${component_name}${Slugs.NAMESPACE_DELIMITER}${service_name}`;
  };

  public static parse = (slug: ServiceSlug): ParsedServiceSlug => {
    if (!ServiceSlugUtils.Validator.test(slug)) {
      throw new Error(ServiceSlugUtils.Description);
    }
    const [account_name, component_name, service_name] = slug.split(Slugs.NAMESPACE_DELIMITER);
    return {
      kind: 'service',
      component_account_name: account_name,
      component_name: component_name,
      service_name: service_name,
    };
  };
}

export type ServiceVersionSlug = string; // "<account-name>/<component-name>/<service-name>:<tag>"
export interface ParsedServiceVersionSlug extends ParsedSlug {
  kind: 'service_version';
  component_account_name: string;
  component_name: string;
  service_name: string;
  tag: string;
  instance_name?: string;
}
export class ServiceVersionSlugUtils extends SlugUtils {

  public static Description = 'must be of the form <account-name>/<component-name>/<service-name>:<tag>';
  public static RegexBase = `${ServiceSlugUtils.RegexBase}${Slugs.TAG_DELIMITER}${Slugs.ComponentTagRegexBase}(?:${Slugs.INSTANCE_DELIMITER}${Slugs.ComponentTagRegexBase})?`;
  public static Validator = new RegExp(`^${ServiceVersionSlugUtils.RegexBase}$`);

  public static build = (account_name: string, component_name: string, service_name: string, tag = Slugs.DEFAULT_TAG, instance_name = ''): ServiceVersionSlug => {
    let slug = `${account_name}${Slugs.NAMESPACE_DELIMITER}${component_name}${Slugs.NAMESPACE_DELIMITER}${service_name}${Slugs.TAG_DELIMITER}${tag}`;
    if (instance_name) {
      slug = `${slug}${Slugs.INSTANCE_DELIMITER}${instance_name}`;
    }
    return slug;
  };

  public static parse = (slug: ServiceVersionSlug): ParsedServiceVersionSlug => {
    if (!ServiceVersionSlugUtils.Validator.test(slug)) {
      throw new Error(ServiceVersionSlugUtils.Description);
    }
    const [full_service_slug, instance_name] = slug.split(Slugs.INSTANCE_DELIMITER);
    const [service_slug, tag] = full_service_slug.split(Slugs.TAG_DELIMITER);
    if (!Slugs.ComponentTagValidator.test(tag)) {
      throw new Error(Slugs.ComponentTagDescription);
    }
    const { component_account_name, component_name, service_name } = ServiceSlugUtils.parse(service_slug);

    return {
      kind: 'service_version',
      component_account_name,
      component_name,
      service_name,
      tag,
      instance_name: instance_name || '',
    };
  };
}

export type EnvironmentSlug = string; // "<account-name>/<environment-name>"
export interface ParsedEvironmentSlug extends ParsedSlug {
  kind: 'environment';
  environment_account_name: string;
  environment_name: string;
}
export class EnvironmentSlugUtils extends SlugUtils {

  public static Description = 'must be of the form <account-name>/<environment-name>';
  public static RegexBase = `${Slugs.ArchitectSlugRegexBase}${Slugs.NAMESPACE_DELIMITER}${Slugs.ArchitectSlugRegexBase}`;
  public static Validator = new RegExp(`^${EnvironmentSlugUtils.RegexBase}$`);

  public static build = (account_name: string, environment_name: string): EnvironmentSlug => {
    return `${account_name}${Slugs.NAMESPACE_DELIMITER}${environment_name}`;
  };

  public static parse = (slug: EnvironmentSlug): ParsedEvironmentSlug => {
    if (!EnvironmentSlugUtils.Validator.test(slug)) {
      throw new Error(EnvironmentSlugUtils.Description);
    }
    const [account_slug, environment_slug] = slug.split(Slugs.NAMESPACE_DELIMITER);
    return {
      kind: 'environment',
      environment_account_name: account_slug,
      environment_name: environment_slug,
    };
  };
}

export type GatewaySlug = 'gateway'; // the string-literal
export interface ParsedGatewaySlug extends ParsedSlug {
  kind: 'gateway';
}
export class GatewaySlugUtils extends SlugUtils {
  public static StringLiteral = `gateway`; // the gateway slug is a special case

  public static Description = 'must be \'gateway\'';
  public static Validator = new RegExp(`^${GatewaySlugUtils.StringLiteral}$`);

  public static build = (): GatewaySlug => {
    return `gateway`;
  };

  public static parse = (slug: string): ParsedGatewaySlug => {
    if (!GatewaySlugUtils.Validator.test(slug)) {
      throw new Error(GatewaySlugUtils.Description);
    }
    return {
      kind: 'gateway',
    };
  };
}
