import { test } from '@oclif/test';
import path from 'path';
import AuthClient from '../../src/app-config/auth';
import SecretUtils from '../../src/architect/secret/secret.utils';
import { DockerComposeUtils } from '../../src/common/docker-compose';
import DockerBuildXUtils from '../../src/common/docker/buildx.utils';
import fs from 'fs-extra';

export const MOCK_API_HOST = 'http://mock.api.localhost';
export const MOCK_APP_HOST = 'http://mock.app.localhost';
export const MOCK_REGISTRY_HOST = 'http://mock.registry.localhost';

export const TMP_DIR = path.join(__dirname, '../tmp');
export const EXAMPLE_PROJECT_PATHS =
  fs
    .readdirSync('test/mocks/examples', { withFileTypes: true })
    .filter(f => f.isFile)
    // eslint-disable-next-line unicorn/no-array-reduce
    .reduce((accumulator, current_file) => {
      return accumulator.set(current_file.name, path.join(__dirname, '../', 'mocks', 'examples', current_file.name));
    }, new Map<string, string>());

export const getArchitectExampleProjectPath = (project_name: string): string => {
  let config_path = '';
  if (project_name && project_name.length > 0) {
    config_path = EXAMPLE_PROJECT_PATHS.get(`${project_name}.architect.yml`) || '';
  }
  if (!config_path || config_path.length === 0) {
    throw new Error(`unable to find example mock project ${project_name}.architect.yml`);
  }
  return config_path;
};

export const getArchitectExampleProjectContext = (project_name: string): string => {
  if (!EXAMPLE_PROJECT_PATHS.has(`${project_name}.architect.yml`)) {
    throw new Error(`unable to find example mock architect.yml ${project_name}`);
  }
  return path.join(__dirname, '../', 'mocks', 'examples');
};

export const mockArchitectAuth = () =>
  test
    .stub(AuthClient.prototype, 'init', () => { })
    .stub(AuthClient.prototype, 'loginFromCli', () => { })
    .stub(AuthClient.prototype, 'generateBrowserUrl', () => {
 return 'http://mockurl.com';
})
    .stub(AuthClient.prototype, 'loginFromBrowser', () => { })
    .stub(AuthClient.prototype, 'logout', () => { })
    .stub(AuthClient.prototype, 'dockerLogin', () => { })
    .stub(AuthClient.prototype, 'getToken', () => {
      return {
        account: 'test-user',
        password: 'test-password',
      };
    })
    .stub(AuthClient.prototype, 'refreshToken', () => { })
    .stub(DockerComposeUtils, 'dockerCompose', () => { })
    .stub(DockerComposeUtils, 'writeCompose', () => { })
    .stub(DockerBuildXUtils, 'writeBuildkitdConfigFile', () => { })
    .stub(DockerBuildXUtils, 'dockerBuildX', () => { })
    .stub(DockerBuildXUtils, 'getBuilder', () => { })
    .stub(SecretUtils, 'getSecrets', () => [])
    .stub(SecretUtils, 'batchUpdateSecrets', () => [])
    .stub(DockerBuildXUtils, 'convertToBuildxPlatforms', () => { });
