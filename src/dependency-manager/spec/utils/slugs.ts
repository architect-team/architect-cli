import { ArchitectError } from '../../utils/errors';

export type ArchitectSlug = string; // a string that passes Slugs.ArchitectSlugValidator (ie "account-name")
export type ComponentTag = string; // "tag"

// Check to see if lookbehind is supported https://github.com/WebKit/WebKit/pull/7109
let REGEX_LOOKBEHIND = true;
try {
  new RegExp('(?!-)(?!.{0,10}--)[a-z0-9-]{1,10}(?<!-)').test('support');
} catch {
  REGEX_LOOKBEHIND = false;
}

export class Slugs {
  public static DEFAULT_TAG = 'latest';

  public static NAMESPACE_DELIMITER = '/';
  public static RESOURCE_DELIMITER = '.';
  public static TAG_DELIMITER = ':';
  public static INSTANCE_DELIMITER = '@';
  public static SLUG_CHAR_LIMIT = 32;

  public static ArchitectSlugDescription = `must contain only lower alphanumeric and single hyphens or underscores in the middle; max length ${Slugs.SLUG_CHAR_LIMIT}`;
  public static ArchitectSlugRegexBase = REGEX_LOOKBEHIND ? `(?!-)(?!.{0,${Slugs.SLUG_CHAR_LIMIT}}--)[a-z0-9-]{1,${Slugs.SLUG_CHAR_LIMIT}}(?<!-)` : `[a-z0-9]+(-[a-z0-9]+)*`;
  public static ArchitectSlugValidator = new RegExp(`^${Slugs.ArchitectSlugRegexBase}$`);

  public static ArchitectSlugDescriptionCaseInsensitive = `must contain only alphanumeric and single hyphens or underscores in the middle; max length ${Slugs.SLUG_CHAR_LIMIT}`;
  public static ArchitectSlugRegexBaseCaseInsensitive = REGEX_LOOKBEHIND ? `(?!-)(?!.{0,${Slugs.SLUG_CHAR_LIMIT}}--)[A-Za-z0-9-]{1,${Slugs.SLUG_CHAR_LIMIT}}(?<!-)` : `[A-Za-z0-9]+(-[A-Za-z0-9]+)*`;
  public static ArchitectSlugValidatorCaseInsensitive = new RegExp(`^${Slugs.ArchitectSlugRegexBaseCaseInsensitive}$`);

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

  public static ComponentSecretDescription = 'must contain alphanumeric character ([a-z0-9A-Z]), could contain dashes (-), underscores (_), and alphanumerics between.';
  public static ComponentSecretRegexBase = `[a-zA-Z0-9_-]+`;
  public static ComponentSecretValidator = new RegExp(`^${Slugs.ComponentSecretRegexBase}$`);

  public static ComponentSubdomainRegexBase = '([A-Za-z0-9](?:[A-Za-z0-9\\-]{0,61}[A-Za-z0-9])|[^\\W\\D\\s\\t\\n\\r\\/]+|[\\@\\*]?)';
  public static ComponentSubdomainDescription = 'must contain alphanumeric characters ([a-z0-9A-Z]), could contain dashes (-) and alphanumerics between.';
  public static ComponentSubdomainValidator = new RegExp(`^${Slugs.ComponentSubdomainRegexBase}$`);

  public static ComponentDatabaseDescription = 'must be of the format <engine>:<version> (e.g. postgres:13)';
  public static ComponentDatabaseRegexBase = `([^:]+):([0-9]+)`;
  public static ComponentDatabaseValidator = new RegExp(`^${Slugs.ComponentDatabaseRegexBase}$`);
}

export interface ParsedSlug {
  component_account_name?: string;
}

export type ComponentSlug = string; // "<component-name>"
export interface ParsedComponentSlug extends ParsedSlug {
  component_account_name?: string;
  component_name: string;
  instance_name?: string;
}

abstract class SlugUtils {
  public static Description: string;
  public static Validator: RegExp;
  public static RegexBase: string;
}

function parseCurry<S extends string, P extends ParsedSlug>() {
  function parse<T extends typeof SlugUtils>(this: T, slug: S): P {
    if (!this.Validator.test(slug)) {
      throw new ArchitectError(`${slug} ${this.Description}`);
    }

    const matches = slug.match(this.RegexBase);

    const groups = matches?.groups || {};
    if ('tag' in groups && groups.tag === undefined) {
      groups.tag = Slugs.DEFAULT_TAG;
    }
    return groups as any;
  }
  return parse;
}

export class ComponentSlugUtils extends SlugUtils {
  public static Description = Slugs.ArchitectSlugDescription;

  static RegexName = `(?:(?<component_account_name>${Slugs.ArchitectSlugRegexBase})${Slugs.NAMESPACE_DELIMITER})?(?<component_name>${Slugs.ArchitectSlugRegexBase})`;
  static RegexInstance = `(?:${Slugs.INSTANCE_DELIMITER}(?<instance_name>${Slugs.ComponentTagRegexBase}))?`;

  static RegexBase = `${ComponentSlugUtils.RegexName}${ComponentSlugUtils.RegexInstance}`;

  public static Validator = new RegExp(`^${ComponentSlugUtils.RegexBase}$`);

  public static build = (account_name: string | undefined, component_name: string, instance_name = ''): ComponentSlug => {
    let slug = component_name;
    if (account_name) {
      slug = `${account_name}${Slugs.NAMESPACE_DELIMITER}${slug}`;
    }
    if (instance_name) {
      slug = `${slug}${Slugs.INSTANCE_DELIMITER}${instance_name}`;
    }
    return slug;
  };

  public static parse = parseCurry<ComponentSlug, ParsedComponentSlug>();
}

export type ComponentVersionSlug = string; // "<component-name>:<tag>"
export interface ParsedComponentVersionSlug extends ParsedSlug {
  component_account_name?: string;
  component_name: string;
  tag: string;
  instance_name?: string;
}

export class ComponentVersionSlugUtils extends SlugUtils {
  public static Description = ComponentSlugUtils.Description;

  public static RegexTag = `(?:${Slugs.TAG_DELIMITER}(?<tag>${Slugs.ComponentTagRegexBase}))?`;

  public static RegexBase = `${ComponentSlugUtils.RegexName}${ComponentVersionSlugUtils.RegexTag}${ComponentSlugUtils.RegexInstance}`; // tag is required

  public static Validator = new RegExp(`^${ComponentVersionSlugUtils.RegexBase}$`);

  public static build = (component_account_name: string | undefined, component_name: string, tag: string = Slugs.DEFAULT_TAG, instance_name = ''): ComponentVersionSlug => {
    let slug = `${component_name}${Slugs.TAG_DELIMITER}${tag}`;
    if (component_account_name) {
      slug = `${component_account_name}${Slugs.NAMESPACE_DELIMITER}${slug}`;
    }
    if (instance_name) {
      slug = `${slug}${Slugs.INSTANCE_DELIMITER}${instance_name}`;
    }
    return slug;
  };

  public static parse = parseCurry<ComponentVersionSlug, ParsedComponentVersionSlug>();
}

export type ResourceType = 'services' | 'tasks';

export type ResourceSlug = string;
export interface ParsedResourceSlug extends ParsedSlug {
  component_account_name?: string;
  component_name: string;
  resource_type: ResourceType;
  resource_name: string;
  instance_name?: string;
}
export class ResourceSlugUtils extends SlugUtils {
  public static Description = 'must be of the form <component-name>.services|tasks.<resource-name>';

  public static RegexResource = `${ComponentSlugUtils.RegexName}\\${Slugs.RESOURCE_DELIMITER}(?<resource_type>services|tasks)\\${Slugs.RESOURCE_DELIMITER}(?<resource_name>${Slugs.ArchitectSlugRegexBase})`;

  public static RegexBase = `${ResourceSlugUtils.RegexResource}${ComponentSlugUtils.RegexInstance}`;
  public static Validator = new RegExp(`^${ResourceSlugUtils.RegexBase}$`);

  // eslint-disable-next-line max-params
  public static build = (account_name: string | undefined, component_name: string, resource_type: ResourceType, resource_name: string, instance_name = ''): ResourceSlug => {
    let slug = `${component_name}${Slugs.RESOURCE_DELIMITER}${resource_type}${Slugs.RESOURCE_DELIMITER}${resource_name}`;
    if (account_name) {
      slug = `${account_name}${Slugs.NAMESPACE_DELIMITER}${slug}`;
    }
    if (instance_name) {
      slug = `${slug}${Slugs.INSTANCE_DELIMITER}${instance_name}`;
    }
    return slug;
  };

  public static parse = parseCurry<ResourceSlug, ParsedResourceSlug>();
}

export interface ParsedUnknownSlug extends ParsedSlug {
  component_account_name?: string;
  component_name: string;
  resource_type?: ResourceType;
  resource_name?: string;
  instance_name?: string;
}

export const parseUnknownSlug = (unknown: string): ParsedUnknownSlug => {
  try {
    return ComponentSlugUtils.parse(unknown);
  } catch { }
  try {
    return ComponentVersionSlugUtils.parse(unknown);
  } catch { }
  return ResourceSlugUtils.parse(unknown);
};
