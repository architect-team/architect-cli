import sinon from 'sinon';
import AuthClient from '../../src/app-config/auth';

// if using this or any other mocks, be sure to restore sinon at the end of each test:
//   test
//      .do(ctx => mockAuth())
//      .finally(() => sinon.restore())
//
export const mockAuth = () => {
  sinon.stub(AuthClient.prototype, "init");
  sinon.stub(AuthClient.prototype, "login_from_cli");
  sinon.stub(AuthClient.prototype, "generate_browser_url").returns("http://mockurl.com");
  sinon.stub(AuthClient.prototype, "login_from_browser");
  sinon.stub(AuthClient.prototype, "logout");
  sinon.stub(AuthClient.prototype, "dockerLogin");
  sinon.stub(AuthClient.prototype, "getToken").returns(Promise.resolve({
    account: 'test-user',
    password: 'test-password'
  }));
  sinon.stub(AuthClient.prototype, "refreshToken");
}
