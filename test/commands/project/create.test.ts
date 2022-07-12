import sinon from 'sinon';
import { expect, test } from '@oclif/test';
import ProjectUtils from '../../../src/architect/project/project.utils';

describe('project:create', function () {
  // set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
  const print = false;

  const selections = {
    database: {
      name: 'mariadb',
      architect_yml: { name: 'MariaDB' },
      depends_on: ''
    },
    frontend: {
      name: 'react',
      architect_yml: {
        name: 'react',
      },
      depends_on: 'backend'
    },
    backend: {
      name: 'node-rest-api',
      architect_yml: {
        name: 'node-rest-api',
      },
      depends_on: 'database'
    }
  }

  test
    .stub(ProjectUtils, 'getSelections', () => {
      return selections;
    })
    .stub(ProjectUtils, 'downloadGitHubRepos', sinon.stub())
    .stub(ProjectUtils, 'createArchitectYaml', sinon.stub())
    .stdout({ print })
    .stderr({ print })
    .command(['project:create', '-p', 'react', 'my-react-project'])
    .it('Create project successfully with project flag', async ctx => {
      expect(ctx.stdout).to.contain('Successfully created project');
      const download_repos = ProjectUtils.downloadGitHubRepos as sinon.SinonStub;
      expect(download_repos.callCount).to.eq(1);
      const create_yml = ProjectUtils.createArchitectYaml as sinon.SinonStub;
      expect(create_yml.callCount).to.eq(1);
    })
});
