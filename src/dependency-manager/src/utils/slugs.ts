export type ArchitectSlug = string; // a string that passes Slugs.ArchitectSlugValidator (ie "account-name")
export type ComponentTag = string; // "tag"

export class Slugs {

  public static DEFAULT_TAG = 'latest';

  public static NAMESPACE_DELIMITER = '/';
  public static TAG_DELIMITER = ':';
  public static SLUG_CHAR_LIMIT = 32;

  public static ArchitectSlugDescription = `must contain only lower alphanumeric and single hyphens in the middle; max length ${Slugs.SLUG_CHAR_LIMIT}`;
  static CharacterCountLookahead = `(?=.{1,${Slugs.SLUG_CHAR_LIMIT}}(\\${Slugs.NAMESPACE_DELIMITER}|${Slugs.TAG_DELIMITER}|$))`;
  static ArchitectSlugRegexBase = `${Slugs.CharacterCountLookahead}[a-z0-9]+(-[a-z0-9]+)*`;
  public static ArchitectSlugValidator = new RegExp(`^${Slugs.ArchitectSlugRegexBase}$`);

  public static ComponentTagDescription = 'must contain only lower alphanumeric, with single hyphens or periods in the middle';
  public static ComponentTagRegexBase = `[a-z0-9]+(-[a-z0-9]+)*(\\.[a-z0-9]+)*`;
  public static ComponentTagValidator = new RegExp(`^${Slugs.ComponentTagRegexBase}$`);

  // static ArchitectSlugRegexBase = `${Slugs.CharacterCountLookahead}[a-z0-9]+(-[a-z0-9]+)*`;

  public static IMAGE_REGEX = '[a-z0-9-]+';
  public static REPOSITORY_REGEX = `[a-z0-9-]+\\/[a-z0-9-]+`;
  // https://github.com/docker/distribution/blob/v2.7.1/reference/reference.go#L15
  public static TAG_REGEX = '[\\w][\\w\\.-]{0,127}';
  public static REPOSITORY_TAG_REGEX = `[a-z0-9-]+\\/[a-z0-9-]+(?::${Slugs.TAG_REGEX})?`;

  public static UrlSafeSlugDescription = 'must be of the form partial-slug--partial-slug--partial-slug-...';
  public static UrlSafeSlugRegexBase = `^${Slugs.ArchitectSlugRegexBase}(--${Slugs.ArchitectSlugRegexBase})*`;
  public static UrlSafeSlugValidator = new RegExp(`/^${Slugs.UrlSafeSlugRegexBase}$/`);
}

export interface SlugParser<T extends string, U extends ParsedSlug> {
  description: string;
  validator: RegExp;
  parse: (slug: T) => U;
  build: (...any: any) => T;
}

export class OrderedSlugs {

  public component_slug =

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
}
export class ComponentSlugs {
  public static description = 'must be of the form <account-name>/<component-name>';

  static regex_base = `${Slugs.ArchitectSlugRegexBase}${Slugs.NAMESPACE_DELIMITER}${Slugs.ArchitectSlugRegexBase}`;

  public static validator = new RegExp(`^${ComponentSlugs.regex_base}$`);

  public static build = (account_name: string, component_name: string): ComponentSlug => {
    return `${account_name}${Slugs.NAMESPACE_DELIMITER}${component_name}`;
  };

  public static parse = (slug: ComponentSlug): ParsedComponentSlug => {
    if (!ComponentSlugs.validator.test(slug)) {
      throw new Error(ComponentSlugs.description);
    }
    const [account_name, component_name] = slug.split(Slugs.NAMESPACE_DELIMITER);
    return {
      kind: 'component',
      component_account_name: account_name,
      component_name: component_name,
    };
  };
}

export type ComponentVersionSlug = string; // "<account-name>/<component-name>:<tag>"

export interface ParsedComponentVersionSlug extends ParsedSlug {
  kind: 'component_version';
  component_account_name: string;
  component_name: string;
  tag: string;
}

export class ComponentVersionSlugs {
  public static description = 'must be of the form <account-name>/<component-name>:<tag>';

  public static regex_base = `${ComponentSlugs.regex_base}${Slugs.TAG_DELIMITER}${Slugs.ComponentTagRegexBase}`;

  public static validator = new RegExp(`^${ComponentVersionSlugs.regex_base}$`);

  public static build = (component_account_name: string, component_name: string, tag: string = Slugs.DEFAULT_TAG): ComponentVersionSlug => {
    return `${component_account_name}${Slugs.NAMESPACE_DELIMITER}${component_name}${Slugs.TAG_DELIMITER}${tag}`;
  };

  public static parse = (slug: ComponentVersionSlug): ParsedComponentVersionSlug => {
    if (!ComponentVersionSlugs.validator.test(slug)) {
      throw new Error(ComponentVersionSlugs.description);
    }
    const [component_slug, tag] = slug.split(Slugs.TAG_DELIMITER);
    if (!Slugs.ComponentTagValidator.test(tag)) {
      throw new Error(Slugs.ComponentTagDescription);
    }
    const { component_account_name, component_name } = ComponentSlugs.parse(component_slug);
    return {
      kind: 'component_version',
      component_account_name,
      component_name,
      tag,
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
export class ServiceSlugs {

  public static description = 'must be of the form <account-name>/<component-name>/<service-name>';
  public static regex_base = `${Slugs.ArchitectSlugRegexBase}${Slugs.NAMESPACE_DELIMITER}${Slugs.ArchitectSlugRegexBase}${Slugs.NAMESPACE_DELIMITER}${Slugs.ArchitectSlugRegexBase}`;
  public static validator = new RegExp(`^${ServiceSlugs.regex_base}$`);

  public static build = (account_name: string, component_name: string, service_name: string): ServiceSlug => {
    return `${account_name}${Slugs.NAMESPACE_DELIMITER}${component_name}${Slugs.NAMESPACE_DELIMITER}${service_name}`;
  };

  public static parse = (slug: ServiceSlug): ParsedServiceSlug => {
    if (!ServiceSlugs.validator.test(slug)) {
      throw new Error(ServiceSlugs.description);
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
}
export class ServiceVersionSlugs {

  public static description = 'must be of the form <account-name>/<component-name>/<service-name>:<tag>';
  public static regex_base = `${ServiceSlugs.regex_base}${Slugs.TAG_DELIMITER}${Slugs.ComponentTagRegexBase}`;
  public static validator = new RegExp(`^${ServiceVersionSlugs.regex_base}$`);

  public static build = (account_name: string, component_name: string, service_name: string, tag: string): ServiceVersionSlug => {
    return `${account_name}${Slugs.NAMESPACE_DELIMITER}${component_name}${Slugs.NAMESPACE_DELIMITER}${service_name}${Slugs.TAG_DELIMITER}${tag}`;
  };

  public static parse = (slug: ServiceVersionSlug): ParsedServiceVersionSlug => {
    if (!ServiceVersionSlugs.validator.test(slug)) {
      throw new Error(ServiceVersionSlugs.description);
    }
    const [service_slug, tag] = slug.split(Slugs.TAG_DELIMITER);
    if (!Slugs.ComponentTagValidator.test(tag)) {
      throw new Error(Slugs.ComponentTagDescription);
    }
    const { component_account_name, component_name, service_name } = ServiceSlugs.parse(service_slug);

    return {
      kind: 'service_version',
      component_account_name,
      component_name,
      service_name,
      tag,
    };
  };
}

export type EnvironmentSlug = string; // "<account-name>/<environment-name>"

export interface ParsedEvironmentSlug extends ParsedSlug {
  kind: 'environment';
  environment_account_name: string;
  environment_name: string;
}

export class EnvironmentSlugs {

  public static description = 'must be of the form <account-name>/<environment-name>';
  public static regex_base = `${Slugs.ArchitectSlugRegexBase}${Slugs.NAMESPACE_DELIMITER}${Slugs.ArchitectSlugRegexBase}`;
  public static validator = new RegExp(`^${EnvironmentSlugs.regex_base}$`);

  public static build = (account_name: string, environment_name: string): EnvironmentSlug => {
    return `${account_name}${Slugs.NAMESPACE_DELIMITER}${environment_name}`;
  };

  public static parse = (slug: EnvironmentSlug): ParsedEvironmentSlug => {
    if (!EnvironmentSlugs.validator.test(slug)) {
      throw new Error(EnvironmentSlugs.description);
    }
    const [account_slug, environment_slug] = slug.split(Slugs.NAMESPACE_DELIMITER);
    return {
      kind: 'environment',
      environment_account_name: account_slug,
      environment_name: environment_slug,
    };
  };
}

export type InterfaceSlug = string; // <account-name>/<component-name>:<tag>-interfaces

export interface ParsedInterfacesSlug extends ParsedSlug {
  kind: 'interfaces';
  component_account_name: string;
  component_name: string;
  tag: string;
}

export class InterfaceSlugs {
  public static suffix = `-interfaces`; // this is temporary while we combine interafes into one node on the graph

  public static description = 'must be of the form <account-name>/<component-name>:<tag>-interfaces';
  public static regex_base = `${ComponentVersionSlugs.regex_base}${InterfaceSlugs.suffix}`;
  public static validator = new RegExp(`^${ComponentVersionSlugs.regex_base}$`);

  public static build = (component_account_name: string, component_name: string, tag: string): InterfaceSlug => {
    return `${component_account_name}${Slugs.NAMESPACE_DELIMITER}${component_name}${Slugs.TAG_DELIMITER}${tag}${InterfaceSlugs.suffix}`;
  };

  public static parse = (slug: InterfaceSlug): ParsedInterfacesSlug => {
    if (!InterfaceSlugs.validator.test(slug)) {
      throw new Error(InterfaceSlugs.description);
    }
    const slug_without_suffix = slug.replace(InterfaceSlugs.suffix, '');
    const { component_account_name, component_name, tag } = ComponentVersionSlugs.parse(slug_without_suffix);
    return {
      kind: 'interfaces',
      component_account_name,
      component_name,
      tag,
    };
  };
}

export type GatewaySlug = 'gateway'; // the string-literal

export interface ParsedGatewaySlug extends ParsedSlug {
  kind: 'gateway';
}

export class GatewaySlugs {
  public static string_literal = `gateway`; // the gateway slug is a special case

  public static description = 'must be \'gateway\'';
  public static validator = new RegExp(`^${GatewaySlugs.string_literal}$`);

  public static build = (): GatewaySlug => {
    return `gateway`;
  };

  public static parse = (slug: string): ParsedGatewaySlug => {
    if (!GatewaySlugs.validator.test(slug)) {
      throw new Error(GatewaySlugs.description);
    }
    return {
      kind: 'gateway',
    };
  };
}
