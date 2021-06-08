import ArchitectError from './architect';

export default class LoginRequiredError extends ArchitectError {
  constructor() {
    super();
    this.name = 'login_required';
    this.message = 'Please login by running `architect login`';
  }
}
