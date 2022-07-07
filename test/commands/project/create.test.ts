import sinon from 'sinon';
import { expect, test } from '@oclif/test';
import ProjectUtils from '../../../src/architect/project/project.utils';

describe('project:create', function () {
  // set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
  const print = false;

  const selections = {
    frontend: {
      name: 'React',
      project: 'https://github.com/architect-templates/react'
    },
    backend: {
      name: 'NodeJS',
      project: 'https://github.com/architect-templates/node-rest-api'
    },
    database: { name: 'PostgreSQL', image: 'postgres' }
  }

  test
    .stub(ProjectUtils, 'getSelections', () => {
      return selections;
    })
    .stub(ProjectUtils, 'downloadGitHubRepos', sinon.stub())
    .stub(ProjectUtils, 'createNewArchitectYaml', sinon.stub())
    .stdout({ print })
    .stderr({ print })
    .command(['project:create', 'my-project'])
    .it('Create project successfully', async ctx => {
      expect(ctx.stdout).to.contain('Successfully created project');
      const download_repos = ProjectUtils.downloadGitHubRepos as sinon.SinonStub;
      expect(download_repos.callCount).to.eq(1);
      const create_yml = ProjectUtils.createNewArchitectYaml as sinon.SinonStub;
      expect(create_yml.callCount).to.eq(1);
    })

  test
    .stub(ProjectUtils, 'getSelections', () => {
      return selections;
    })
    .stub(ProjectUtils, 'downloadGitHubRepos', sinon.stub())
    .stub(ProjectUtils, 'createNewArchitectYaml', sinon.stub())
    .stdout({ print })
    .stderr({ print })
    .command(['project:create', '-p', 'react', 'my-react-project'])
    .it('Create project successfully with project flag', async ctx => {
      expect(ctx.stdout).to.contain('Successfully created project');
      const download_repos = ProjectUtils.downloadGitHubRepos as sinon.SinonStub;
      expect(download_repos.callCount).to.eq(1);
      const create_yml = ProjectUtils.createNewArchitectYaml as sinon.SinonStub;
      expect(create_yml.callCount).to.eq(1);
    })
});
