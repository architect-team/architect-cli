
export const EXPRESSION_REGEX_STRING = `\\\${{\\s*(.*?)\\s*}}`;
export const EXPRESSION_REGEX = new RegExp(EXPRESSION_REGEX_STRING, 'g');
export const IF_EXPRESSION_REGEX = new RegExp(`\\\${{\\s*if(.*?)\\s*}}`, 'g');
