import { test } from '@oclif/test';
import path from 'path';
import AuthClient from '../../src/app-config/auth';
import { DockerComposeUtils } from '../../src/common/docker-compose';
import DockerBuildXUtils from '../../src/common/utils/docker-buildx.utils';
import * as Docker from '../../src/common/utils/docker';

export const MOCK_API_HOST = 'http://mock.api.localhost';

export const TMP_DIR = path.join(__dirname, '../tmp')

export const mockArchitectAuth = test
  .stub(AuthClient.prototype, 'init', () => { })
  .stub(AuthClient.prototype, 'loginFromCli', () => { })
  .stub(AuthClient.prototype, 'generateBrowserUrl', () => { return 'http://mockurl.com' })
  .stub(AuthClient.prototype, 'loginFromBrowser', () => { })
  .stub(AuthClient.prototype, 'logout', () => { })
  .stub(AuthClient.prototype, 'dockerLogin', () => { })
  .stub(AuthClient.prototype, 'getToken', () => {
    return {
      account: 'test-user',
      password: 'test-password'
    }
  })
  .stub(AuthClient.prototype, 'refreshToken', () => { })
  .stub(Docker, 'verify', () => { })
  .stub(DockerComposeUtils, 'dockerCompose', () => { })
  .stub(DockerComposeUtils, 'writeCompose', () => { })
  .stub(DockerBuildXUtils, 'writeBuildkitdConfigFile', () => { })
  .stub(DockerBuildXUtils, 'dockerBuildX', () => { })
  .stub(DockerBuildXUtils, 'getBuilder', () => { })
  .stub(DockerBuildXUtils, 'normalizePlatforms', () => { })
