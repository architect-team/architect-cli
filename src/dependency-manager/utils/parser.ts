import { isIdentifierChar, isIdentifierStart } from 'acorn';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { LooseParser } from 'acorn-loose';
import assert from 'assert';
import estraverse from 'estraverse';
import { EXPRESSION_REGEX } from '../spec/utils/interpolation';
import { ValidationError } from './errors';
import { matches } from './regex';

function isIdentifier(node: any): boolean {
  if (node.type === 'Identifier') {
    return true;
  } else if (node.type === 'MemberExpression') {
    return true;
  } else {
    return false;
  }
}

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

function codePointToString(code: number) {
  // UTF-16 Decoding
  if (code <= 0xFFFF) return String.fromCharCode(code);
  code -= 0x10000;
  return String.fromCharCode((code >> 10) + 0xD800, (code & 1023) + 0xDC00);
}

function getArchitectAcornParser(Parser: any) {
  return class extends Parser {
    // https://github.com/acornjs/acorn/blob/27f01d6dccfd193ee4d892140b5e5844a83f0073/acorn/src/tokenize.js#L776
    // Override to support '-' or '/'
    readWord1() {
      this.containsEsc = false;
      let word = "", first = true, chunkStart = this.pos;
      const astral = this.options.ecmaVersion >= 6;
      while (this.pos < this.input.length) {
        const ch = this.fullCharCodeAtPos();
        if (isIdentifierChar(ch, astral) || ch === 45 || ch === 47) {  // Override to support '-' or '/'
          this.pos += ch <= 0xffff ? 1 : 2;
        } else if (ch === 92) { // "\"
          this.containsEsc = true;
          word += this.input.slice(chunkStart, this.pos);
          const escStart = this.pos;
          if (this.input.charCodeAt(++this.pos) !== 117) // "u"
            this.invalidStringToken(this.pos, "Expecting Unicode escape sequence \\uXXXX");
          ++this.pos;
          const esc = this.readCodePoint();
          if (!(first ? isIdentifierStart : isIdentifierChar)(esc, astral))
            this.invalidStringToken(escStart, "Invalid Unicode escape");
          word += codePointToString(esc);
          chunkStart = this.pos;
        } else {
          break;
        }
        first = false;
      }
      return word + this.input.slice(chunkStart, this.pos);
    }
  };
}

LooseParser.BaseParser = LooseParser.BaseParser.extend(getArchitectAcornParser);

export class ArchitectParser {
  errors: ValidationError[];

  constructor() {
    this.errors = [];
  }

  protected parseExpression(program: string, context_map: any, _depth = 0): any {
    const ast = LooseParser.parse(program, { ecmaVersion: 2020 });

    estraverse.replace(ast, {
      enter: (node: any, parent: any) => {
        if (node.type === 'EmptyStatement') {
          return estraverse.VisitorOption.Remove;
        }

        if (isIdentifier(node)) {
          // Function callee identifier
          if (parent?.callee === node) {
            return {
              type: 'Literal',
              value: node.name,
            };
          }
          const context_key = parseIdentifier(node);
          const value = context_map[context_key];

          if (!(context_key in context_map)) {
            this.errors.push(new ValidationError({
              component: context_map.name,
              path: '', // Set in interpolation.ts
              message: `Invalid interpolation ref: \${{ ${context_key} }}`,
              value: context_key,
            }));
            return {
              type: 'Literal',
              value: `<error: ${context_key}>`,
            };
          }
          return {
            type: 'Literal',
            value: this.parseString(value, context_map, _depth + 1),
          };
        }
      },
      leave: (node: any, parent: any) => {
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
            value: node.test.value ? node.consequent.value : node.alternate.value,
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
        } else if (node.type == 'CallExpression') {
          let value;
          if (node.callee.value === 'trim') {
            value = node.arguments[0].value.trim();
          } else if (node.callee.value === 'startsWith') {
            value = node.arguments[0].value.startsWith(node.arguments[1].value);
          } else {
            throw new Error(`Unsupported node.callee.value: ${node.callee.value} node.type: ${node.type}`);
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

  public parseString(program: string, context_map: any, _depth = 0): any {
    if (_depth === 0) {
      this.errors = [];
    }
    assert(_depth < 25);
    let res = program;

    let last_value;
    for (const match of matches(program, EXPRESSION_REGEX)) {
      const ast = this.parseExpression(match[1], context_map, _depth);
      if (this.errors.length === 0) {
        res = res.replace(match[0], ast.body[0].value);
        last_value = ast.body[0].value;
      }
    }

    // Handle case where value a number or boolean. Ex ${{ secrets.replicas }} is a number
    if (res === `${last_value}`) {
      return last_value;
    }

    return res;
  }
}
