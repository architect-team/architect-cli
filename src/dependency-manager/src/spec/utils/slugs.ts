import { ArchitectError } from '../../utils/errors';

export type ArchitectSlug = string; // a string that passes Slugs.ArchitectSlugValidator (ie "account-name")
export type ComponentTag = string; // "tag"

export class Slugs {

  public static DEFAULT_TAG = 'latest';

  public static NAMESPACE_DELIMITER = '/';
  public static RESOURCE_DELIMITER = '\\.';
  public static TAG_DELIMITER = ':';
  public static INSTANCE_DELIMITER = '@';
  public static SLUG_CHAR_LIMIT = 32;

  public static ArchitectSlugDescription = `must contain only lower alphanumeric and single hyphens or underscores in the middle; max length ${Slugs.SLUG_CHAR_LIMIT}`;
  static CharacterCountLookahead = `(?=.{1,${Slugs.SLUG_CHAR_LIMIT}}(\\${Slugs.NAMESPACE_DELIMITER}|${Slugs.TAG_DELIMITER}|$))`;
  public static ArchitectSlugRegexBase = `(?!-)(?!.*--)[a-z0-9-]{1,${Slugs.SLUG_CHAR_LIMIT}}(?<!-)`;
  public static ArchitectSlugValidator = new RegExp(`^${Slugs.ArchitectSlugRegexBase}$`);

  public static LabelMax = 63;
  public static LabelSlugDescription = `max length ${Slugs.LabelMax} characters, must begin and end with an alphanumeric character ([a-z0-9A-Z]), could contain dashes (-), underscores (_), dots (.), and alphanumerics between.`;
  // TODO:344 remove nomaxlength
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

export interface ParsedSlug {
  component_account_name?: string;
}

export type ComponentSlug = string; // "<account-name>/<component-name>"
export interface ParsedComponentSlug extends ParsedSlug {
  component_account_name?: string;
  component_name: string;
  instance_name: string;
}

function SlugUtils<S extends string, P extends ParsedSlug>(): any {
  abstract class SlugUtilsMixin {
    public static Description: string;
    public static Validator: RegExp;
    public static RegexBase: string;

    public static parse<T extends typeof SlugUtilsMixin>(this: T, slug: S): P {
      if (!this.Validator.test(slug)) {
        throw new ArchitectError(`${slug} ${this.Description}`);
      }

      const matches = slug.match(this.RegexBase);
      return matches?.groups as any;
    }
  }
  return SlugUtilsMixin;
}

export class ComponentSlugUtils extends SlugUtils<ComponentSlug, ParsedComponentSlug>() {

  // TODO:344 change description
  public static Description = 'Must be prefixed with a valid Architect account and separated by a slash (e.g. architect/component-name). The following slug must be kebab-case: alphanumerics punctuated only by dashes.';

  static RegexName = `(?:(?<component_account_name>${Slugs.ArchitectSlugRegexBase})${Slugs.NAMESPACE_DELIMITER})?(?<component_name>${Slugs.ArchitectSlugRegexBase})`;
  static RegexInstance = `(?:${Slugs.INSTANCE_DELIMITER}(?<instance_name>${Slugs.ComponentTagRegexBase}))?`;

  static RegexBase = `${ComponentSlugUtils.RegexName}${ComponentSlugUtils.RegexInstance}`;

  public static Validator = new RegExp(`^${ComponentSlugUtils.RegexBase}$`);

  public static build = (account_name: string | undefined, component_name: string): ComponentSlug => {
    if (account_name)
      return `${account_name}${Slugs.NAMESPACE_DELIMITER}${component_name}`;
    else
      return component_name;
  };
}

export type ComponentVersionSlug = string; // "<account-name>/<component-name>:<tag>"
export interface ParsedComponentVersionSlug extends ParsedSlug {
  component_account_name?: string;
  component_name: string;
  tag: string;
  instance_name: string;
}
export class ComponentVersionSlugUtils extends SlugUtils<ComponentVersionSlug, ParsedComponentVersionSlug>() {

  public static Description = `must be of the form <account-name>/<component-name>:<tag> OR <account-name>/<component-name>. The latter will assume \`${Slugs.DEFAULT_TAG}\` tag`;

  public static RegexTag = `(?:${Slugs.TAG_DELIMITER}(?<tag>${Slugs.ComponentTagRegexBase}))`;

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
}

export type ResourceSlug = string;
export interface ParsedResourceSlug extends ParsedSlug {
  component_account_name?: string;
  component_name: string;
  resource_type: string;
  resource_name: string;
}
export class ResourceSlugUtils extends SlugUtils<ResourceSlug, ParsedResourceSlug>() {

  public static Description = 'must be of the form <account-name>/<component-name>.services|tasks.<resource-name>';
  // TODO:344 support instance name
  public static RegexBase = `${ComponentSlugUtils.RegexName}${Slugs.RESOURCE_DELIMITER}(?<resource_type>services|tasks)${Slugs.RESOURCE_DELIMITER}(?<resource_name>${Slugs.ArchitectSlugRegexBase})${ComponentSlugUtils.RegexInstance}`;
  public static Validator = new RegExp(`^${ResourceSlugUtils.RegexBase}$`);

  public static build = (account_name: string | undefined, component_name: string, resource_type: string, resource_name: string): ResourceSlug => {
    let slug = `${component_name}${Slugs.RESOURCE_DELIMITER}${resource_type}${Slugs.RESOURCE_DELIMITER}${resource_name}`;
    if (account_name) {
      slug = `${account_name}${Slugs.NAMESPACE_DELIMITER}${slug}`;
    }
    return slug;
  };
}

export type ResourceVersionSlug = string;
export interface ParsedResourceVersionSlug extends ParsedSlug {
  component_account_name?: string;
  component_name: string;
  resource_type: string;
  resource_name: string;
  tag: string;
  instance_name?: string;
}
export class ResourceVersionSlugUtils extends SlugUtils<ResourceVersionSlug, ParsedResourceVersionSlug>() {

  public static Description = 'must be of the form <account-name>/<component-name>.services|tasks.<resource-name>:<tag>';
  public static RegexBase = `${ComponentSlugUtils.RegexName}${Slugs.RESOURCE_DELIMITER}(services|tasks)${Slugs.RESOURCE_DELIMITER}${Slugs.ArchitectSlugRegexBase}${ComponentVersionSlugUtils.RegexTag}${ComponentSlugUtils.RegexInstance}`;
  public static Validator = new RegExp(`^${ResourceVersionSlugUtils.RegexBase}$`);

  public static build = (account_name: string | undefined, component_name: string, resource_type: string, resource_name: string, tag = Slugs.DEFAULT_TAG, instance_name = ''): ResourceVersionSlug => {
    let slug = `${component_name}${Slugs.RESOURCE_DELIMITER}${resource_type}${Slugs.RESOURCE_DELIMITER}${resource_name}${Slugs.TAG_DELIMITER}${tag}`;
    if (account_name) {
      slug = `${account_name}${Slugs.NAMESPACE_DELIMITER}${slug}`;
    }
    if (instance_name) {
      slug = `${slug}${Slugs.INSTANCE_DELIMITER}${instance_name}`;
    }
    return slug;
  };
}

type ParsedUnknownSlug = ParsedComponentSlug | ParsedComponentVersionSlug | ParsedResourceSlug | ParsedResourceVersionSlug;
export const parseUnknownSlug = (unknown: string): ParsedUnknownSlug => {
  try {
    return ComponentSlugUtils.parse(unknown);
    // eslint-disable-next-line no-empty
  } catch { }
  try {
    return ComponentVersionSlugUtils.parse(unknown);
    // eslint-disable-next-line no-empty
  } catch { }
  try {
    return ResourceSlugUtils.parse(unknown);
    // eslint-disable-next-line no-empty
  } catch { }
  return ResourceVersionSlugUtils.parse(unknown);
};
