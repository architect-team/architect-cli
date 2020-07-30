
export type ArchitectSlug = string; // simply string that passes: ArchitectSlugValidator (ie "account-name")
export type ComponentSlug = string; // "account-name/component-name"
export type ComponentTag = string; // "tag"
export type ComponentVersionSlug = string; // "account-name/component-name:tag"
export type ServiceSlug = string; // "account-name/component-name/service-name"
export type ServiceVersionSlug = string; // "account-name/component-name/service-name:tag"
export type EnvironmentSlug = string; // "@environment-account-name/environment-name"
export type ServiceInstanceSlug = string; // "account-name/component-name/service-name:tag@environment-account-name/environment-name"
export type GatewaySlug = 'gateway'; // the string-literal
export type InterfacesSlug = string; // <account-name>/<component-name>:<tag>-interfaces

export type SlugKind = 'component' | 'component_version' | 'service' | 'service_version' | 'environment' | 'service_instance' | 'gateway' | 'interfaces';

/**
 * Represents the unique elements of a fully parsed slug. This object will have different fields depending on the
 * type of slug (ie was it a tagged component vs an untagged component vs a service slug)
 */
export interface ParsedSlug {
  kind: SlugKind;
  component_account_name?: string;
  component_name?: string;
  service_name?: string;
  tag?: string;
  environment_account_name?: string;
  environment_name?: string;
}

export interface ParsedComponentSlug extends ParsedSlug {
  kind: 'component';
  component_account_name: string;
  component_name: string;
}

export interface ParsedComponentVersionSlug extends ParsedSlug {
  kind: 'component_version';
  component_account_name: string;
  component_name: string;
  tag: string;
}

export interface ParsedServiceSlug extends ParsedSlug {
  kind: 'service';
  component_account_name: string;
  component_name: string;
  service_name: string;
}

export interface ParsedServiceVersionSlug extends ParsedSlug {
  kind: 'service_version';
  component_account_name: string;
  component_name: string;
  service_name: string;
  tag: string;
}

export interface ParsedServiceInstanceSlug extends ParsedSlug {
  kind: 'service_instance';
  component_account_name: string;
  component_name: string;
  service_name: string;
  tag: string;
  environment_account_name: string;
  environment_name: string;
}

export interface ParsedEvironmentSlug extends ParsedSlug {
  kind: 'environment';
  environment_account_name: string;
  environment_name: string;
}

export interface ParsedGatewaySlug extends ParsedSlug {
  kind: 'gateway';
}

export interface ParsedInterfacesSlug extends ParsedSlug {
  kind: 'interfaces';
  component_account_name: string;
  component_name: string;
  tag: string;
}

export class Slugs {

  public static DEFAULT_TAG = 'latest';

  public static NAMESPACE_DELIMITER = '/';
  public static TAG_DELIMITER = ':';
  public static ENV_DELIMITER = '@';
  public static SlugCharacterLimit = 32;

  public static ArchitectSlugDescription = `must contain only lower alphanumeric and single hyphens in the middle; max length ${Slugs.SlugCharacterLimit}`;
  static CharacterCountLookahead = `(?=.{1,${Slugs.SlugCharacterLimit}}(\\${Slugs.NAMESPACE_DELIMITER}|${Slugs.TAG_DELIMITER}|${Slugs.ENV_DELIMITER}|$))`;
  static ArchitectSlugRegexBase = `[a-z0-9]+(?:-[a-z0-9]+)*`;

  static ArchitectSlugRegexBaseMaxLength = `${Slugs.CharacterCountLookahead}${Slugs.ArchitectSlugRegexBase}`;
  public static ArchitectSlugValidator = new RegExp(`^${Slugs.ArchitectSlugRegexBaseMaxLength}$`);

  // https://github.com/docker/distribution/blob/v2.7.1/reference/reference.go#L15

  public static ComponentTagDescription = 'must contain only lower alphanumeric, with single hyphens or periods in the middle';
  public static ComponentTagRegexBase = `[\\w][\\w\\.-]{0,127}`;
  public static ComponentParameterRegexBase = `[a-zA-Z0-9_-]+`;
  public static ComponentTagValidator = new RegExp(`^${Slugs.ComponentTagRegexBase}$`);

  public static ComponentSlugDescription = 'must be of the form <account-name>/<component-name>';
  public static ComponentSlugRegexBase = `${Slugs.ArchitectSlugRegexBase}${Slugs.NAMESPACE_DELIMITER}${Slugs.ArchitectSlugRegexBase}`;
  public static ComponentSlugRegexMaxLength = `${Slugs.ArchitectSlugRegexBaseMaxLength}${Slugs.NAMESPACE_DELIMITER}${Slugs.ArchitectSlugRegexBaseMaxLength}`;
  public static ComponentSlugValidator = new RegExp(`^${Slugs.ComponentSlugRegexMaxLength}$`);

  public static REPOSITORY_REGEX = Slugs.ComponentSlugRegexBase;
  public static REPOSITORY_TAG_REGEX = `${Slugs.REPOSITORY_REGEX}(?::${Slugs.ComponentTagRegexBase})?`;

  public static buildComponentSlug = (account_name: string, component_name: string): ComponentSlug => {
    return `${account_name}${Slugs.NAMESPACE_DELIMITER}${component_name}`;
  };
  public static splitComponentSlug = (slug: ComponentSlug): ParsedComponentSlug => {
    if (!Slugs.ComponentSlugValidator.test(slug)) {
      throw new Error(Slugs.ComponentSlugDescription);
    }
    const [account_name, component_name] = slug.split(Slugs.NAMESPACE_DELIMITER);
    return {
      kind: 'component',
      component_account_name: account_name,
      component_name: component_name,
    };
  };

  public static ComponentVersionSlugDescription = 'must be of the form <account-name>/<component-name>:<tag>';
  public static ComponentVersionSlugRegexBase = `${Slugs.ComponentSlugRegexBase}(?:${Slugs.TAG_DELIMITER}${Slugs.ComponentTagRegexBase})`;
  public static ComponentOptionalVersionSlug = `${Slugs.ComponentSlugRegexBase}(?:${Slugs.TAG_DELIMITER}${Slugs.ComponentTagRegexBase})?`;
  public static ComponentVersionSlugRegexMaxLength = `${Slugs.ComponentSlugRegexMaxLength}(?:${Slugs.TAG_DELIMITER}${Slugs.ComponentTagRegexBase})`;
  public static ComponentVersionSlugValidator = new RegExp(`^${Slugs.ComponentVersionSlugRegexBase}$`);
  public static buildComponentVersionSlug = (component_account_name: string, component_name: string, tag: string = Slugs.DEFAULT_TAG): ComponentVersionSlug => {
    return `${component_account_name}${Slugs.NAMESPACE_DELIMITER}${component_name}${Slugs.TAG_DELIMITER}${tag}`;
  };
  public static splitComponentVersionSlug = (slug: ComponentVersionSlug): ParsedComponentVersionSlug => {
    if (!Slugs.ComponentVersionSlugValidator.test(slug)) {
      throw new Error(Slugs.ComponentVersionSlugDescription);
    }
    const [component_slug, tag] = slug.split(Slugs.TAG_DELIMITER);
    if (!Slugs.ComponentTagValidator.test(tag)) {
      throw new Error(Slugs.ComponentTagDescription);
    }
    const { component_account_name, component_name } = Slugs.splitComponentSlug(component_slug);
    return {
      kind: 'component_version',
      component_account_name,
      component_name,
      tag,
    };
  };

  public static ServiceSlugDescription = 'must be of the form <account-name>/<component-name>/<service-name>';
  public static ServiceSlugRegexBase = `${Slugs.ArchitectSlugRegexBaseMaxLength}${Slugs.NAMESPACE_DELIMITER}${Slugs.ArchitectSlugRegexBaseMaxLength}${Slugs.NAMESPACE_DELIMITER}${Slugs.ArchitectSlugRegexBaseMaxLength}`;
  public static ServiceSlugValidator = new RegExp(`^${Slugs.ServiceSlugRegexBase}$`);
  public static buildServiceSlug = (account_name: string, component_name: string, service_name: string): ServiceSlug => {
    return `${account_name}${Slugs.NAMESPACE_DELIMITER}${component_name}${Slugs.NAMESPACE_DELIMITER}${service_name}`;
  };
  public static splitServiceSlug = (slug: ServiceSlug): ParsedServiceSlug => {
    if (!Slugs.ServiceSlugValidator.test(slug)) {
      throw new Error(Slugs.ServiceSlugDescription);
    }
    const [account_name, component_name, service_name] = slug.split(Slugs.NAMESPACE_DELIMITER);
    return {
      kind: 'service',
      component_account_name: account_name,
      component_name: component_name,
      service_name: service_name,
    };
  };

  public static ServiceVersionSlugDescription = 'must be of the form <account-name>/<component-name>/<service-name>:<tag>';
  public static ServiceVersionSlugRegexBase = `${Slugs.ServiceSlugRegexBase}${Slugs.TAG_DELIMITER}${Slugs.ComponentTagRegexBase}`;
  public static ServiceVersionSlugValidator = new RegExp(`^${Slugs.ServiceVersionSlugRegexBase}$`);
  public static buildServiceVersionSlug = (account_name: string, component_name: string, service_name: string, tag: string): ServiceVersionSlug => {
    return `${account_name}${Slugs.NAMESPACE_DELIMITER}${component_name}${Slugs.NAMESPACE_DELIMITER}${service_name}${Slugs.TAG_DELIMITER}${tag}`;
  };
  public static splitServiceVersionSlug = (slug: ServiceVersionSlug): ParsedServiceVersionSlug => {
    if (!Slugs.ServiceVersionSlugValidator.test(slug)) {
      throw new Error(Slugs.ServiceVersionSlugDescription);
    }
    const [service_slug, tag] = slug.split(Slugs.TAG_DELIMITER);
    if (!Slugs.ComponentTagValidator.test(tag)) {
      throw new Error(Slugs.ComponentTagDescription);
    }
    const { component_account_name, component_name, service_name } = Slugs.splitServiceSlug(service_slug);
    return {
      kind: 'service_version',
      component_account_name,
      component_name,
      service_name,
      tag,
    };
  };

  public static EnvironmentSlugDescription = 'must be of the form <account-name>/<environment-name>';
  public static EnvironmentSlugRegexBase = `${Slugs.ArchitectSlugRegexBaseMaxLength}${Slugs.NAMESPACE_DELIMITER}${Slugs.ArchitectSlugRegexBaseMaxLength}`;
  public static EnvironmentSlugValidator = new RegExp(`^${Slugs.EnvironmentSlugRegexBase}$`);
  public static buildEnvironmentSlug = (account_name: string, environment_name: string): EnvironmentSlug => {
    return `${account_name}${Slugs.NAMESPACE_DELIMITER}${environment_name}`;
  };
  public static splitEnvironmentSlug = (slug: EnvironmentSlug): ParsedEvironmentSlug => {
    if (!Slugs.EnvironmentSlugValidator.test(slug)) {
      throw new Error(Slugs.EnvironmentSlugDescription);
    }
    const [account_slug, environment_slug] = slug.split(Slugs.NAMESPACE_DELIMITER);
    return {
      kind: 'environment',
      environment_account_name: account_slug,
      environment_name: environment_slug,
    };
  };

  public static ServiceInstanceSlugDescription = 'must be of the form <account-name>/<component-name>/<service-name>:<tag>@<environment-account-name>/<environment-name>';
  public static ServiceInstanceSlugRegexBase = `^${Slugs.ServiceVersionSlugRegexBase}${Slugs.ENV_DELIMITER}${Slugs.EnvironmentSlugRegexBase}`;
  public static ServiceInstanceSlugValidator = new RegExp(`^${Slugs.ServiceInstanceSlugRegexBase}$`);
  public static buildServiceInstanceSlug = (account_name: string, component_name: string, service_name: string, tag: string, environment_account_name: string, environment_name: string): ServiceInstanceSlug => {
    return `${account_name}${Slugs.NAMESPACE_DELIMITER}${component_name}${Slugs.NAMESPACE_DELIMITER}${service_name}${Slugs.TAG_DELIMITER}${tag}${Slugs.ENV_DELIMITER}${account_name}${Slugs.NAMESPACE_DELIMITER}${environment_name}`;
  };
  public static splitServiceInstanceSlug = (slug: ServiceInstanceSlug): ParsedServiceInstanceSlug => {
    if (!Slugs.ServiceInstanceSlugValidator.test(slug)) {
      throw new Error(Slugs.ServiceInstanceSlugDescription);
    }
    const [service_version_slug, environment_slug] = slug.split(Slugs.ENV_DELIMITER);
    const { environment_account_name, environment_name } = Slugs.splitEnvironmentSlug(environment_slug);
    const { component_account_name, component_name, service_name, tag } = Slugs.splitServiceVersionSlug(service_version_slug);
    if (!Slugs.ComponentTagValidator.test(tag)) {
      throw new Error(Slugs.ComponentTagDescription);
    }
    return {
      kind: 'service_instance',
      component_account_name,
      component_name,
      service_name,
      tag,
      environment_account_name,
      environment_name,
    };
  };

  public static GatewaySlugDescription = 'must be \'gateway\'';
  public static GatewaySlugLiteral = `gateway`;
  public static GatewaySlugValidator = new RegExp(`^${Slugs.GatewaySlugLiteral}$`);
  public static buildGatewaySlug = (): GatewaySlug => {
    return `gateway`;
  };
  public static splitGatewaySlug = (slug: string): ParsedGatewaySlug => {
    if (!Slugs.GatewaySlugValidator.test(slug)) {
      throw new Error(Slugs.GatewaySlugDescription);
    }
    return {
      kind: 'gateway',
    };
  };

  public static InterfacesSlugDescription = 'must be of the form <account-name>/<component-name>:<tag>-interfaces';
  public static InterfacesSlugSuffix = `-interfaces`;
  public static InterfacesSlugRegexBase = `${Slugs.ComponentVersionSlugRegexBase}${Slugs.InterfacesSlugSuffix}`;
  public static InterfacesSlugValidator = new RegExp(`^${Slugs.InterfacesSlugRegexBase}$`);
  public static buildInterfacesSlug = (component_account_name: string, component_name: string, tag: string): InterfacesSlug => {
    return `${component_account_name}${Slugs.NAMESPACE_DELIMITER}${component_name}${Slugs.TAG_DELIMITER}${tag}${Slugs.InterfacesSlugSuffix}`;
  };
  public static splitInterfacesSlug = (slug: string): ParsedInterfacesSlug => {
    if (!Slugs.InterfacesSlugValidator.test(slug)) {
      throw new Error(Slugs.InterfacesSlugDescription);
    }
    const slug_without_interfaces = slug.replace(Slugs.InterfacesSlugSuffix, '');
    const { component_account_name, component_name, tag } = Slugs.splitComponentVersionSlug(slug_without_interfaces);
    return {
      kind: 'interfaces',
      component_account_name,
      component_name,
      tag,
    };
  };

  public static UrlSafeSlugDescription = 'must be of the form partial-slug--partial-slug--partial-slug-...';
  public static UrlSafeSlugRegexBase = `^${Slugs.ArchitectSlugRegexBaseMaxLength}(--${Slugs.ArchitectSlugRegexBaseMaxLength})*`;
  public static UrlSafeSlugValidator = new RegExp(`/^${Slugs.UrlSafeSlugRegexBase}$/`);
}
