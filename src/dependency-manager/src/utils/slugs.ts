/* eslint-disable no-empty */
export type ArchitectSlug = string; // a string that passes Slugs.ArchitectSlugValidator (ie "account-name")
export type ComponentTag = string; // "tag"

export class Slugs {

  public static DEFAULT_TAG = 'latest';

  public static NAMESPACE_DELIMITER = '/';
  public static TAG_DELIMITER = ':';
  public static SLUG_CHAR_LIMIT = 32;

  public static ArchitectSlugDescription = `must contain only lower alphanumeric and single hyphens in the middle; max length ${Slugs.SLUG_CHAR_LIMIT}`;
  static CharacterCountLookahead = `(?=.{1,${Slugs.SLUG_CHAR_LIMIT}}(\\${Slugs.NAMESPACE_DELIMITER}|${Slugs.TAG_DELIMITER}|$))`;

  public static ArchitectSlugRegexNoMaxLength = `[a-z0-9]+(?:-[a-z0-9]+)*`; // does not contain character count lookaheads
  public static ArchitectSlugRegexBase = `${Slugs.CharacterCountLookahead}${Slugs.ArchitectSlugRegexNoMaxLength}`;

  public static ArchitectSlugValidator = new RegExp(`^${Slugs.ArchitectSlugRegexBase}$`);

  public static ComponentTagDescription = 'must contain only lower alphanumeric, with single hyphens or periods in the middle';
  public static ComponentTagRegexBase = `[\\w][\\w\\.-]{0,127}`;
  public static ComponentTagValidator = new RegExp(`^${Slugs.ComponentTagRegexBase}$`);
  public static ComponentParameterRegexBase = `[a-zA-Z0-9_-]+`;
}

export type SlugKind = 'component' | 'component_version' | 'resource' | 'resource_version' | 'environment' | 'gateway' | 'interfaces';
export interface ParsedSlug {
  kind?: SlugKind;
  component_account_name?: string;
  component_name?: string;
  resource_name?: string;
  tag?: string;
  environment_account_name?: string;
  environment_name?: string;
}

export abstract class SlugUtils {
  public static Description: string;
  public static Validator: RegExp;
  public static parse: (slug: string) => ParsedSlug;
  public static build: (obj: ParsedSlug) => string;
}

export type ComponentSlug = string; // "<account-name>/<component-name>"
export interface ParsedComponentSlug extends ParsedSlug {
  kind: 'component';
  component_account_name: string;
  component_name: string;
}

export class ComponentSlugUtils extends SlugUtils {

  public static Description = 'must be of the form <account-name>/<component-name>';

  static RegexNoMaxLength = `${Slugs.ArchitectSlugRegexNoMaxLength}${Slugs.NAMESPACE_DELIMITER}${Slugs.ArchitectSlugRegexNoMaxLength}`; // does not contain character count lookaheads
  static RegexBase = `${Slugs.ArchitectSlugRegexBase}${Slugs.NAMESPACE_DELIMITER}${Slugs.ArchitectSlugRegexBase}`;

  public static Validator = new RegExp(`^${ComponentSlugUtils.RegexBase}$`);

  public static build = (obj: ParsedSlug): ComponentSlug => {
    if (!obj.component_account_name || !obj.component_name) {
      throw new Error(`Object ${JSON.stringify(obj)} does not have fields required to build a ComponentSlug`);
    }
    return `${obj.component_account_name}${Slugs.NAMESPACE_DELIMITER}${obj.component_name}`;
  };

  public static parse = (slug: ComponentSlug): ParsedComponentSlug => {
    if (!ComponentSlugUtils.Validator.test(slug)) {
      throw new Error(ComponentSlugUtils.Description);
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
  namespaced_component_name: string;
  tag: string;
}
export class ComponentVersionSlugUtils extends SlugUtils {

  public static Description = 'must be of the form <account-name>/<component-name>:<tag>';

  public static RegexNoMaxLength = `${ComponentSlugUtils.RegexNoMaxLength}(?:${Slugs.TAG_DELIMITER}${Slugs.ComponentTagRegexBase})`;
  public static RegexOptionalTag = `${ComponentSlugUtils.RegexNoMaxLength}(?:${Slugs.TAG_DELIMITER}${Slugs.ComponentTagRegexBase})?`; // for when the tag is optional
  public static RegexBase = `${ComponentSlugUtils.RegexBase}(?:${Slugs.TAG_DELIMITER}${Slugs.ComponentTagRegexBase})`; // tag is required

  public static Validator = new RegExp(`^${ComponentVersionSlugUtils.RegexBase}$`);

  public static build = (obj: ParsedSlug): ComponentVersionSlug => {
    if (!obj.component_account_name || !obj.component_name || !obj.tag) {
      throw new Error(`Object ${JSON.stringify(obj)} does not have the fields required to build a ComponentVersionSlugUtils`);
    }
    return `${obj.component_account_name}${Slugs.NAMESPACE_DELIMITER}${obj.component_name}${Slugs.TAG_DELIMITER}${obj.tag}`;
  };

  public static parse = (slug: ComponentVersionSlug): ParsedComponentVersionSlug => {
    if (!ComponentVersionSlugUtils.Validator.test(slug)) {
      throw new Error(ComponentVersionSlugUtils.Description);
    }
    const [component_slug, tag] = slug.split(Slugs.TAG_DELIMITER);
    if (!Slugs.ComponentTagValidator.test(tag)) {
      throw new Error(Slugs.ComponentTagDescription);
    }
    const { component_account_name, component_name } = ComponentSlugUtils.parse(component_slug);
    return {
      kind: 'component_version',
      component_account_name,
      component_name,
      namespaced_component_name: `${component_account_name}/${component_name}`,
      tag,
    };
  };
}

export type ResourceSlug = string; // "account-name/component-name/resource-name"
export interface ParsedResourceSlug extends ParsedSlug {
  kind: 'resource';
  component_account_name: string;
  component_name: string;
  resource_name: string;
}
export class ResourceSlugUtils extends SlugUtils {

  public static Description = 'must be of the form <account-name>/<component-name>/<resource-name>';
  public static RegexBase = `${Slugs.ArchitectSlugRegexBase}${Slugs.NAMESPACE_DELIMITER}${Slugs.ArchitectSlugRegexBase}${Slugs.NAMESPACE_DELIMITER}${Slugs.ArchitectSlugRegexBase}`;
  public static Validator = new RegExp(`^${ResourceSlugUtils.RegexBase}$`);

  public static build = (obj: ParsedSlug): ResourceSlug => {
    if (!obj.component_account_name || !obj.component_name || !obj.resource_name) {
      throw new Error(`Object ${JSON.stringify(obj)} does not have the fields required to build a ResourceSlug`);
    }
    return `${obj.component_account_name}${Slugs.NAMESPACE_DELIMITER}${obj.component_name}${Slugs.NAMESPACE_DELIMITER}${obj.resource_name}`;
  };

  public static parse = (slug: ResourceSlug): ParsedResourceSlug => {
    if (!ResourceSlugUtils.Validator.test(slug)) {
      throw new Error(ResourceSlugUtils.Description);
    }
    const [account_name, component_name, resource_name] = slug.split(Slugs.NAMESPACE_DELIMITER);
    return {
      kind: 'resource',
      component_account_name: account_name,
      component_name: component_name,
      resource_name: resource_name,
    };
  };
}

export type ResourceVersionSlug = string; // "<account-name>/<component-name>/<resource-name>:<tag>"
export interface ParsedResourceVersionSlug extends ParsedSlug {
  kind: 'resource_version';
  component_account_name: string;
  component_name: string;
  resource_name: string;
  tag: string;
}
export class ResourceVersionSlugUtils extends SlugUtils {

  public static Description = 'must be of the form <account-name>/<component-name>/<resource-name>:<tag>';
  public static RegexBase = `${ResourceSlugUtils.RegexBase}${Slugs.TAG_DELIMITER}${Slugs.ComponentTagRegexBase}`;
  public static Validator = new RegExp(`^${ResourceVersionSlugUtils.RegexBase}$`);

  public static build = (obj: ParsedSlug): ResourceVersionSlug => {
    if (!obj.component_account_name || !obj.component_name || !obj.resource_name || !obj.tag) {
      throw new Error(`Object ${JSON.stringify(obj)} does not have the fields required to build a ResourceVersionSlug`);
    }
    return `${obj.component_account_name}${Slugs.NAMESPACE_DELIMITER}${obj.component_name}${Slugs.NAMESPACE_DELIMITER}${obj.resource_name}${Slugs.TAG_DELIMITER}${obj.tag}`;
  };

  public static parse = (slug: ResourceVersionSlug): ParsedResourceVersionSlug => {
    if (!ResourceVersionSlugUtils.Validator.test(slug)) {
      throw new Error(ResourceVersionSlugUtils.Description);
    }
    const [resource_slug, tag] = slug.split(Slugs.TAG_DELIMITER);
    if (!Slugs.ComponentTagValidator.test(tag)) {
      throw new Error(Slugs.ComponentTagDescription);
    }
    const { component_account_name, component_name, resource_name } = ResourceSlugUtils.parse(resource_slug);

    return {
      kind: 'resource_version',
      component_account_name,
      component_name,
      resource_name,
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
export class EnvironmentSlugUtils extends SlugUtils {

  public static Description = 'must be of the form <account-name>/<environment-name>';
  public static RegexBase = `${Slugs.ArchitectSlugRegexBase}${Slugs.NAMESPACE_DELIMITER}${Slugs.ArchitectSlugRegexBase}`;
  public static Validator = new RegExp(`^${EnvironmentSlugUtils.RegexBase}$`);

  public static build = (obj: ParsedSlug): EnvironmentSlug => {
    if (!obj.environment_account_name || !obj.environment_name) {
      throw new Error(`Object ${JSON.stringify(obj)} does not have the fields required to build a EnvironmentSlug`);
    }
    return `${obj.environment_account_name}${Slugs.NAMESPACE_DELIMITER}${obj.environment_name}`;
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

export type InterfaceSlug = string; // <account-name>/<component-name>:<tag>-interfaces
export interface ParsedInterfacesSlug extends ParsedSlug {
  kind: 'interfaces';
  component_account_name: string;
  component_name: string;
  tag: string;
}
export class InterfaceSlugUtils extends SlugUtils {
  public static Suffix = `-interfaces`; // this is temporary while we combine interafes into one node on the graph

  public static Description = 'must be of the form <account-name>/<component-name>:<tag>-interfaces';
  public static RegexBase = `${ComponentVersionSlugUtils.RegexNoMaxLength}${InterfaceSlugUtils.Suffix}`;
  public static Validator = new RegExp(`^${InterfaceSlugUtils.RegexBase}$`);

  public static build = (obj: ParsedSlug): InterfaceSlug => {
    if (!obj.component_account_name || !obj.component_name || !obj.tag) {
      throw new Error(`Object ${JSON.stringify(obj)} does not have the fields required to build a InterfaceSlug`);
    }
    return `${obj.component_account_name}${Slugs.NAMESPACE_DELIMITER}${obj.component_name}${Slugs.TAG_DELIMITER}${obj.tag}${InterfaceSlugUtils.Suffix}`;
  };

  public static parse = (slug: InterfaceSlug): ParsedInterfacesSlug => {
    if (!InterfaceSlugUtils.Validator.test(slug)) {
      throw new Error(InterfaceSlugUtils.Description);
    }
    const slug_without_suffix = slug.replace(InterfaceSlugUtils.Suffix, '');
    const { component_account_name, component_name, tag } = ComponentVersionSlugUtils.parse(slug_without_suffix);
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
export class GatewaySlugUtils extends SlugUtils {
  public static StringLiteral = `gateway`; // the gateway slug is a special case

  public static Description = 'must be \'gateway\'';
  public static Validator = new RegExp(`^${GatewaySlugUtils.StringLiteral}$`);

  public static build = (_: ParsedSlug): GatewaySlug => {
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

export class SlugParser {

  // order matters here, this should be in order from most specific to least specific; opposite of below
  public static parse = (slug: string): ParsedSlug => {
    try { return InterfaceSlugUtils.parse(slug); } catch { }
    try { return GatewaySlugUtils.parse(slug); } catch { }
    try { return EnvironmentSlugUtils.parse(slug); } catch { }
    try { return ResourceVersionSlugUtils.parse(slug); } catch { }
    try { return ResourceSlugUtils.parse(slug); } catch { }
    try { return ComponentVersionSlugUtils.parse(slug); } catch { }
    try { return ComponentSlugUtils.parse(slug); } catch { }
    throw new Error(`Slug ${slug} could not be parsed into any meaningful Architect entity`);
  };

  // order matters here, this should be in order from least specific to most specific; opposite of above
  public static build = (obj: ParsedSlug): string => {
    try { return ComponentSlugUtils.build(obj); } catch { }
    try { return ComponentVersionSlugUtils.build(obj); } catch { }
    try { return ResourceSlugUtils.build(obj); } catch { }
    try { return ResourceVersionSlugUtils.build(obj); } catch { }
    try { return EnvironmentSlugUtils.build(obj); } catch { }
    try { return GatewaySlugUtils.build(obj); } catch { }
    try { return InterfaceSlugUtils.build(obj); } catch { }
    throw new Error(`Object ${obj} could not be built into any meaningful Architect slug`);
  };
}
