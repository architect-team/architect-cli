export const EXPRESSION_REGEX = new RegExp(`\\\${{\\s*(.*?)\\s*}}`, 'g');
export const IF_EXPRESSION_REGEX = new RegExp(`^\\\${{\\s*if(.*?)\\s*}}$`);
