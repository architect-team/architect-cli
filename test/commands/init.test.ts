import {expect, test} from '@oclif/test';
import * as inquirer from 'inquirer';
import * as os from 'os';
import * as sinon from 'sinon';

import Init from '../../src/commands/init';
import {INIT_INTRO_TEXT} from '../../src/common/i18n';
import ServiceConfig from '../../src/common/service-config';

interface InitInput {
  name: string;
  version: string;
  description: string;
  keywords: string[];
  author: string;
  license: string;
}

const MOCK_SERVICE_CONFIG: InitInput = {
  name: 'test-service',
  version: '0.1.0',
  description: 'Test description',
  keywords: ['test', 'this'],
  author: 'Architect',
  license: 'MIT'
};

describe('init', () => {
  let _sinon: sinon.SinonSandbox;

  beforeEach(() => {
    _sinon = sinon.createSandbox();
  });

  afterEach(() => {
    // @ts-ignore
    _sinon.restore();
  });

  describe('unit', () => {
    it('should generate default name from path', () => {
      _sinon.stub(process, 'cwd').returns('/test/path/service-name');
      expect(Init.getDefaultServiceName()).to.be.eq('service-name');
    });
  });

  describe('integration', () => {
    beforeEach(() => {
      _sinon.stub(inquirer, 'prompt')
        .callsFake(function (questions: inquirer.Question[]) {
          let mock_config: InitInput = MOCK_SERVICE_CONFIG;

          questions.forEach((question: inquirer.Question) => {
            if (
              question.hasOwnProperty('default') &&
              question.name !== undefined &&
              Object.keys(mock_config).includes(question.name)
            ) {
              // @ts-ignore
              mock_config[question.name] = question.default;
            }
          });

          return mock_config;
        });
    });

    test
      .stdout()
      .command(['init', '--output', os.tmpdir()])
      .exit(0)
      .it('should match default values', ctx => {
        const config = new ServiceConfig()
          .setName(MOCK_SERVICE_CONFIG.name)
          .setDescription(MOCK_SERVICE_CONFIG.description)
          .setVersion(MOCK_SERVICE_CONFIG.version)
          .setKeywords(MOCK_SERVICE_CONFIG.keywords)
          .setLicense(MOCK_SERVICE_CONFIG.license)
          .setAuthor(MOCK_SERVICE_CONFIG.author);
        expect(ctx.stdout).to.contain(INIT_INTRO_TEXT);
        expect(ctx.stdout).to.contain(JSON.stringify(config, null, 2));
      });

    test
      .stdout()
      .command(['init', '--name', 'test', '--output', os.tmpdir()])
      .exit(0)
      .it('should match provided name', ctx => {
        const config = new ServiceConfig()
          .setName('test')
          .setDescription(MOCK_SERVICE_CONFIG.description)
          .setVersion(MOCK_SERVICE_CONFIG.version)
          .setKeywords(MOCK_SERVICE_CONFIG.keywords)
          .setLicense(MOCK_SERVICE_CONFIG.license)
          .setAuthor(MOCK_SERVICE_CONFIG.author);
        expect(ctx.stdout).to.contain(INIT_INTRO_TEXT);
        expect(ctx.stdout).to.contain(JSON.stringify(config, null, 2));
      });

    test
      .stdout()
      .command([
        'init',
        '--description', 'test',
        '--version', '1.2.3',
        '--keywords', 'test,this',
        '--author', 'Architect',
        '--license', 'Apache',
        '--output', os.tmpdir()
      ])
      .exit(0)
      .it('should match all other fields', ctx => {
        const config = new ServiceConfig()
          .setName(MOCK_SERVICE_CONFIG.name)
          .setDescription('test')
          .setVersion('1.2.3')
          .setKeywords(['test', 'this'])
          .setLicense('Apache')
          .setAuthor('Architect');
        expect(ctx.stdout).to.contain(INIT_INTRO_TEXT);
        expect(ctx.stdout).to.contain(JSON.stringify(config, null, 2));
      });
  });
});
