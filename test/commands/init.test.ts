import {expect, test} from '@oclif/test';
import * as inquirer from 'inquirer';
import * as sinon from 'sinon';

interface InitInput {
  name?: string;
  version?: string;
  description?: string;
  keywords?: string[];
  author?: string[];
  license?: string;
}

const MOCK_SERVICE_CONFIG: InitInput = {
  name: 'test-service',
  version: '0.1.0',
  description: 'Test description',
  keywords: ['test', 'this'],
  author: ['Architect'],
  license: 'MIT'
};

describe('init', () => {
  beforeEach(() => {
    sinon.stub(inquirer, 'prompt')
      .resolves((questions: inquirer.Question[]) => {
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

  afterEach(() => {
    // @ts-ignore
    inquirer.prompt.restore();
  });


  // START TESTS
  test
    .stdout()
    .command(['init'])
    .it('should match default', ctx => {
      // Check filesystem for config file
      expect(ctx.stdout).to.contain('hello world');
    });

  test
    .stdout()
    .command(['init', '--name', 'jeff'])
    .it('runs hello --name jeff', ctx => {
      expect(ctx.stdout).to.contain('hello jeff');
    });
});
