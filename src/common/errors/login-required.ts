export default class LoginRequiredError extends Error {
  constructor() {
    super();
    this.name = 'login_required';
    this.message = 'Please login by running `architect login`';
  }
}
