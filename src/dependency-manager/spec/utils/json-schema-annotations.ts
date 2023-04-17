import { SchemaObject } from 'ajv';
import { DecoratorSchema } from 'class-validator-jsonschema/build/decorators';
import { EXPRESSION_REGEX } from './interpolation';

export const REF_PREFIX = '#/definitions/';
const PRIMITIVES = new Set(['integer', 'number', 'string', 'boolean', 'object', 'null', 'array']);

/**
 * Returns a partial JSON Schema to define a disjunctive type
 *
 * @param args must be a primitive string (see PRIMITIVES) or a class name that is already defined somewhere else in the JSON Schema
 * @returns
 */
export const AnyOf = (...args: any): DecoratorSchema => {
  const anyOf = [];

  for (const arg of args) {
    if (typeof arg === 'string' && PRIMITIVES.has(arg)) {
      anyOf.push({
        type: arg,
      });
    } else if (typeof arg === 'function') {
      anyOf.push({
        $ref: `${REF_PREFIX}${arg.name}`,
      });
    } else if (typeof arg === 'object' && 'type' in arg && 'pattern' in arg) {
      anyOf.push(arg);
    } else {
      console.error(arg);
      throw new Error('Illegal arg for JsonSchema in AnyOf. You must specify either a primitive string or a Type.');
    }
  }

  return {
    anyOf,
  } as DecoratorSchema;
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
    if (typeof arg === 'string' && PRIMITIVES.has(arg)) {
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
    type: 'array',
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

export const RequiredOr = (...properties: string[]): DecoratorSchema => {
  const anyOf = properties.map(p => {
    return {
      type: 'object',
      required: [p],
    };
  });

  return {
    anyOf,
  } as DecoratorSchema;
};

/**
 * Should be used in a class-level @JSONSchema() annotation
 *
 * Returns a partial JSON Schema to define an exclusive OR between property names
 *
 * @param args must be an array of property names. each property should already exist on the class where this is used.
 * @returns
 */
export const ExclusiveOr = (...properties: string[]): DecoratorSchema => {
  const oneOf = properties.map(p => {
    return {
      type: 'object',
      required: [p],
    };
  });

  return {
    oneOf,
  } as DecoratorSchema;
};

/**
 * Should be used in a class-level @JSONSchema() annotation
 *
 * Returns a partial JSON Schema to define an exclusive OR between property names or allow none of the listed properties
 *
 * @param args must be an array of property names. each property should already exist on the class where this is used.
 * @returns
 */
export const ExclusiveOrNeither = (...properties: string[]): DecoratorSchema => {
  return {
    not: {
      type: 'object',
      required: [...properties],
    },
  } as DecoratorSchema;
};

/**
 * Should be used in a class-level @JSONSchema() annotation
 *
 * Returns a partial JSON Schema that requires that at least one of the named properties is
 *
 * @param args must be an array of property names. each property should already exist on the class where this is used.
 * @returns
 */
export const OneOf = (...properties: string[]): DecoratorSchema => {
  const anyOf = properties.map(p => {
    return {
      type: 'object',
      required: [p],
    };
  });

  return {
    anyOf, // though it might feel weird to use AnyOf here, it is correct
  } as DecoratorSchema;
};

/**
 * Returns a partial JSON Schema that matches the disjunctive type: string[] | string
 */
export const StringOrStringArray = (): DecoratorSchema => {
  return {
    anyOf: [
      {
        type: 'array',
        items: {
          type: 'string',
        },
      },
      {
        type: 'string',
      },
    ],
  };
};

/**
 * Wraps the given schema objects in a `oneOf` expression next to an ExpressionRegex
 *
 * Effectively allows the field to match either the given schema OR an interpolation expression
 */
export const ExpressionOr = (...schema: SchemaObject[]): DecoratorSchema => {
  return {
    anyOf: [
      ...schema,
      {
        type: 'string',
        pattern: EXPRESSION_REGEX.source,
        errorMessage: {
          // __arc__ is replaced later to avoid json pointer issues with ajv
          pattern: 'must be an interpolation ref ex. $__arc__{{ secrets.example }}',
        },
      },
    ],
  };
};

/**
 * Wraps the given schema object in a `oneOf` expression next to an ExpressionRegex
 *
 * Effectively allows the field to match either the given schema OR an interpolation expression
 */
export const ExpressionOrString = (options = {}): DecoratorSchema => {
  return ExpressionOr({ type: 'string', ...options });
};
