import { ArchitectError } from '../../';

export default class MissingContextError extends ArchitectError {
  constructor() {
    super();
    this.name = 'missing_build_context';
    this.message = 'No context was provided. Please specify a path to a valid Architect component.';
  }
}
