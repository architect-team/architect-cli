export const EXPRESSION_REGEX = new RegExp(`\\\${{\\s*(.*?)\\s*}}`, 'g');
export const IF_EXPRESSION_REGEX = new RegExp(`^\\\${{\\s*if(.*?)\\s*}}$`);
export const DEPENDENCY_EXPRESSION_REGEX = new RegExp('^\\${{\\s*dependencies\\.[^}]*}}$');
export const DEPRECATED_DEPENDENCY_EXPRESSION_REGEX = new RegExp('\\$\\{\\{ dependencies\\.[^.]*\\.(ingresses|interfaces)\\.[^.]*\\.url }}');
export const ARCHITECT_EXPRESSION_REGEX = new RegExp('^\\${{\\s*architect\\.[^}]*}}');
export const ENVIRONMENT_EXPRESSION_REGEX = new RegExp('^\\${{\\s*environment\\.[^}]*}}');
