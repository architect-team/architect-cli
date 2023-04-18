import yaml from 'js-yaml';

let schema: yaml.Schema | undefined;
export function getYamlSchema(): yaml.Schema {
  if (!schema) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const options = Object.assign({}, yaml.types.float.options) as yaml.TypeConstructorOptions;

    const old = options.construct!;
    options.construct = function (data: any) {
      const float = old(data);
      if (`${float}` !== data) {  // Lost precision - default to string
        return data;
      } else {
        return float;
      }
    };

    const SafeFloatType = new yaml.Type('tag:yaml.org,2002:float', options);

    schema = yaml.DEFAULT_SCHEMA.extend({ implicit: [SafeFloatType] });
  }
  return schema;
}
