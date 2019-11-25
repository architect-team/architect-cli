export default class MissingContextError extends Error {
  constructor() {
    super();
    this.name = 'missing_build_context';
    this.message = 'No context was provided. Please specify either an ' +
      'environment config or service config path.';
  }
}
