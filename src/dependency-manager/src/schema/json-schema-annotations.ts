import { DecoratorSchema } from 'class-validator-jsonschema/build/decorators';

export const REF_PREFIX = '#/definitions/';
const PRIMITIVES = ['integer', 'number', 'string', 'boolean', 'object', 'null', 'array'];

/**
 * Returns a partial JSON Schema to define a Dictionary of disjunctive types
 *
 * @param args must be a primitive string (see PRIMITIVES) or a class name that is already defined somewhere else in the JSON Schema
 * @returns
 */
export const DictionaryOfAny = (...args: any): DecoratorSchema => {
  const anyOf = [];

  for (const arg of args) {
    if (typeof arg === 'string' && PRIMITIVES.includes(arg)) {
      anyOf.push({
        type: arg,
      });
    } else if (typeof arg === 'function') {
      anyOf.push({
        $ref: `${REF_PREFIX}${arg.name}`,
      });
    } else {
      console.error(arg);
      throw new Error('Illegal arg for JsonSchema in DictionaryOfAny. You must specify either a primitive string or a Type.');
    }
  }

  return {
    type: "object",
    additionalProperties: {
      anyOf,
    },
  } as DecoratorSchema;
};

/**
 * Returns a partial JSON Schema to define a disjunctive type
 *
 * @param args must be a primitive string (see PRIMITIVES) or a class name that is already defined somewhere else in the JSON Schema
 * @returns
 */
export const AnyOf = (...args: any): DecoratorSchema => {
  const anyOf = [];

  for (const arg of args) {
    if (typeof arg === 'string' && PRIMITIVES.includes(arg)) {
      anyOf.push({
        type: arg,
      });
    } else if (typeof arg === 'function') {
      anyOf.push({
        $ref: `${REF_PREFIX}${arg.name}`,
      });
    } else {
      console.error(arg);
      throw new Error('Illegal arg for JsonSchema in AnyOf. You must specify either a primitive string or a Type.');
    }
  }

  return {
    type: "object",
    properties: {
      name: {
        anyOf,
      },
    },
  } as DecoratorSchema;
};

/**
 * Returns a partial JSON Schema to define a Dictionary
 *
 * @param arg must be a primitive string (see PRIMITIVES) or a class name that is already defined somewhere else in the JSON Schema
 * @returns
 */
export const DictionaryOf = (arg: any): DecoratorSchema => {
  return DictionaryOfAny(arg);
};

/**
 * Returns a partial JSON Schema to define a Dictionary of disjunctive types
 *
 * @param args must be a primitive string (see PRIMITIVES) or a class name that is already defined somewhere else in the JSON Schema
 * @returns
 */
export const ArrayOfAny = (...args: any): DecoratorSchema => {
  const anyOf = [];

  for (const arg of args) {
    if (typeof arg === 'string' && PRIMITIVES.includes(arg)) {
      anyOf.push({
        type: arg,
      });
    } else if (typeof arg === 'function') {
      anyOf.push({
        $ref: `${REF_PREFIX}${arg.name}`,
      });
    } else {
      console.error(arg);
      throw new Error('Illegal arg for JsonSchema in ArrayOfAny. You must specify either a primitive string or a Type.');
    }
  }

  return {
    type: "array",
    items: {
      anyOf,
    },
  } as DecoratorSchema;
};

/**
 * Returns a partial JSON Schema to define a Dictionary of disjunctive types
 *
 * @param args must be a primitive string (see PRIMITIVES) or a class name that is already defined somewhere else in the JSON Schema
 * @returns
 */
export const ArrayOf = (arg: any): DecoratorSchema => {
  return ArrayOfAny(arg);
};
