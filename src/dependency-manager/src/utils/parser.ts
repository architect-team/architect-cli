// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { LooseParser } from 'acorn-loose';
import estraverse from 'estraverse';
import { EXPRESSION_REGEX_STRING } from '../spec/utils/interpolation';

function parseIdentifier(node: any): string {
  if (node.type === 'Identifier') {
    return node.name;
  }
  const res = [];
  while (node.type === 'MemberExpression') {
    res.unshift(node.property.name || node.property.value);
    if (node.object.type === 'Identifier') {
      res.unshift(node.object.name);
    }
    node = node.object;
  }
  return res.join('.');
}

const matches = (text: string, pattern: RegExp) => ({
  [Symbol.iterator]: function* () {
    const clone = new RegExp(pattern.source, pattern.flags);
    let match = null;
    do {
      match = clone.exec(text);
      if (match) {
        yield match;
        clone.lastIndex = match.index + 1; // Support overlapping match groups
      }
    } while (match);
  },
});

const interpolation_regex = new RegExp(EXPRESSION_REGEX_STRING, 'g');

export function parseExpression(program: string, context: any, ignore_keys: string[] = [], max_depth = 25): any {
  const MyParser = LooseParser.extend();
  const ast = MyParser.parse(program, { ecmaVersion: 2020 });

  estraverse.replace(ast, {
    enter: function (node: any, parent: any) {
      if (node.type === 'EmptyStatement') {
        return estraverse.VisitorOption.Remove;
      }

      if (node.type === 'Identifier' || node.type === 'MemberExpression') {
        const context_key = parseIdentifier(node);
        const value = context[context_key];

        if (value === undefined) {
          const ignored = ignore_keys.some((k) => context_key.startsWith(k));
          if (!ignored) {
            // misses.add(interpolation_ref);
            throw new Error(`Invalid context key: ${context_key}`);
          }
        }
        return {
          type: 'Literal',
          // TODO detect loop
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          value: parseString(context[context_key], context),
        };
      }
    },
    leave: function (node: any, parent: any) {
      if (node.type === 'ExpressionStatement') {
        return {
          type: 'Literal',
          value: node.expression.value,
        };
      }
      if (node.type === 'UnaryExpression') {
        let value: boolean | number;
        if (node.operator === '!') {
          value = !node.argument.value;
        } else if (node.operator === '-') {
          value = -node.argument.value;
        } else {
          throw new Error(`Unsupported node.operator: ${node.operator} node.type: ${node.type}`);
        }
        return {
          type: 'Literal',
          value: value,
        };
      } else if (node.type === 'ConditionalExpression') {
        return {
          type: 'Literal',
          value: node.test.value ? node.consequent.value : node.alternative.value,
        };
      } else if (node.type === 'BinaryExpression') {
        const left_value = node.left.value;
        const right_value = node.right.value;
        let value: boolean | number | string;
        if (node.operator === '==') {
          value = left_value === right_value;
        } else if (node.operator === '!=') {
          value = left_value !== right_value;
        } else if (node.operator === '>') {
          value = left_value > right_value;
        } else if (node.operator === '>=') {
          value = left_value >= right_value;
        } else if (node.operator === '<') {
          value = left_value < right_value;
        } else if (node.operator === '<=') {
          value = left_value <= right_value;
        } else if (node.operator === '+') {
          value = left_value + right_value;
        } else if (node.operator === '-') {
          value = left_value - right_value;
        } else if (node.operator === '*') {
          value = left_value * right_value;
        } else if (node.operator === '/') {
          value = left_value / right_value;
        } else {
          throw new Error(`Unsupported node.operator: ${node.operator} node.type: ${node.type}`);
        }
        return {
          type: 'Literal',
          value: value,
        };
      } else if (node.type === 'LogicalExpression') {
        const left_value = node.left.value;
        const right_value = node.right.value;
        let value: boolean;
        if (node.operator === '&&') {
          value = left_value && right_value;
        } else if (node.operator === '||') {
          value = left_value || right_value;
        } else {
          throw new Error(`Unsupported node.operator: ${node.operator} node.type: ${node.type}`);
        }
        return {
          type: 'Literal',
          value: value,
        };
      } else if (node.type == 'IfStatement') {
        if (node.test.type === 'Literal') {
          return {
            type: 'Literal',
            value: !!node.test.value,
          };
        } else {
          throw new Error(`Unsupported node.test.type: ${node.test.type}`);
        }
      } else if (node.type !== 'Literal' && node.type !== 'Program') {
        throw new Error(`Unsupported node.type: ${node.type}`);
      }
    },
  });

  return ast;
}

export function parseString(program: string, context: any, ignore_keys: string[] = [], max_depth = 25): any {
  let res = program;
  for (const match of matches(program, interpolation_regex)) {
    const ast = parseExpression(match[1], context, ignore_keys, max_depth);
    res = res.replace(match[0], ast.body[0].value);
  }
  return res;
}
