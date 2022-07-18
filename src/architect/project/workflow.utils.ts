import * as fs from 'fs';
import inquirer from 'inquirer';
import * as path from 'path';
import AppService from '../../app-config/service';
import Account from '../account/account.entity';
import AccountUtils from '../account/account.utils';
import Environment from '../environment/environment.entity';
import { EnvironmentUtils } from '../environment/environment.utils';
import PlatformUtils from '../platform/platform.utils';

export default class WorkflowUtils {
  private static async prompt(choices: any[], message: string): Promise<any> {
    inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));
    const answers: { selected: any } = await inquirer.prompt([
      {
        type: 'autocomplete',
        name: 'selected',
        message: message,
        source: async () => {
          return choices.map((p) => ({ name: p.name, value: p }));
        },
      },
    ]);
    return answers.selected;
  }

  private static async promptFreeform(message: string) {
    const answers: any = await inquirer.prompt([
      {
        type: 'input',
        name: 'answer',
        message: message,
        filter: value => value.toLowerCase(),
        validate: (value: any) => {
          if ((new RegExp('^[a-z][a-z-]+[a-z]$').test(value))) {
            return true;
          }
          return `Component name can only contain lowercase letters and dashes, and must start and end with a letter.`;
        },
      },
    ]);
    return answers.answer;
  }

  private static async generatePreviewWorkflow(app_service: AppService, account: Account, components: string[], root_component: string, root_dir: string) {
    const platform = await PlatformUtils.getPlatform(app_service.api, account);
    const preview_prefix = await this.promptFreeform("Please enter a prefix for any preview generated env. ex. preview-");
    const env_ttl = await this.promptFreeform("Please enter a the TTL(Time To Live) for the preview enviroment. The TTL of the environment is in a duration of time, ex. 30d, 12h, or 30m");

    const register_template = components.map(component => {
      return `      - name: Register ${component} w/ Architect
        run: architect register ${component} -t \${{ env.PREVIEW_TAG }}`
    }).join('\n');
    const template = `name: Architect Preview Deployment

on:
  pull_request_target:
    branches:
      - main
    types:
      - opened
      - synchronize
      - reopened
      - closed

env:
  ARCHITECT_GENERATED: true
  ARCHITECT_PREVIEW: true
  PREVIEW_PREFIX: ${preview_prefix}
  PREVIEW_TAG: ${preview_prefix}-\${{ github.event.number }}
  ARCHITECT_ACCOUNT: ${account.name}
  PLATFORM_NAME: ${platform.name}
  ROOT_COMPONENT_NAME: ${root_component}
  ENVIRONMENT_TTL: ${env_ttl}

jobs:
  architect_remove_preview:
    if: github.event.action == 'closed'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '14'
      - name: Install Architect CLI
        run: sudo npm install -g @architect-io/cli
      - name: Login to Architect Cloud
        run: architect login -e \${{ secrets.ARCHITECT_EMAIL }} -p \${{ secrets.ARCHITECT_PASSWORD }}
      - name: Remove preview environment
        run: architect environment:destroy \${{ env.PREVIEW_TAG }} --auto-approve -f || exit 0
  architect_create_preview:
    if: github.event.action != 'closed'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '14'
      - name: Install Architect CLI
        run: sudo npm install -g @architect-io/cli
      - name: Login to Architect Cloud
        run: architect login -e \${{ secrets.ARCHITECT_EMAIL }} -p \${{ secrets.ARCHITECT_PASSWORD }} # These secrets were created on your behalf
${register_template}
      - name: Create env if not exists
        run: architect environment:create \${{ env.PREVIEW_TAG }} --platform \${{ env.PLATFORM_NAME }} \${{ env.ENVIRONMENT_TTL }} || exit 0
      - name: Deploy component
        run: architect deploy --auto-approve -e \${{ env.PREVIEW_TAG }} \${{ env.ROOT_COMPONENT_NAME }}:\${{ env.PREVIEW_TAG }}`;
    fs.writeFileSync(path.join(root_dir, '/.github/workflows/', `${account.name}-${platform.name}-${preview_prefix}-preview-workflow.yml`), template);
  }

  private static async generateMainWorkflow(app_service: AppService, account: Account, components: string[], root_component: string, root_dir: string) {
    const branch_name = this.promptFreeform("What is the name of the branch you would like to automatically deploy?");

    const should_generate_emv = await this.prompt(["createw new environment", "use exisiting environment"], "Would you like to create a new environment or use one that already exists?");
    let environment: Environment;
    if (should_generate_emv == 'createw new environment') {
      const platform = await PlatformUtils.getPlatform(app_service.api, account);
      const name = await this.promptFreeform("Please enter a name for you environment");
      await EnvironmentUtils.createEnvironment(app_service.api, account, platform, name);
      environment = await EnvironmentUtils.getEnvironment(app_service.api, account, name);
    } else {
      environment = await EnvironmentUtils.getEnvironment(app_service.api, account);
    }

    const register_template = components.map(component => {
      return `      - name: Register ${component} w/ Architect
        run: architect register ${component} -t latest`
    }).join('\n');

    let template = `name: Architect ${branch_name} Branch Deployment

on:
  push:
    branches:
      - ${branch_name}

env:
  ARCHITECT_GENERATED: true
  ARCHITECT_BRANCH: true
  ARCHITECT_ACCOUNT: ${account.name}
  ENVIRONMENT_NAME: ${environment.name}
  BRANCH_NAME: ${branch_name}
  ROOT_COMPONENT_NAME: ${root_component}

jobs:
  architect_create_branch_deployments:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
        with:
          ref: \${{ env.BRANCH_NAME }}
      - uses: actions/setup-node@v2
        with:
          node-version: '14'
      - name: Install Architect CLI
        run: sudo npm install -g @architect-io/cli
      - name: Login to Architect Cloud
        run: architect login -e \${{ secrets.ARCHITECT_EMAIL }} -p \${{ secrets.ARCHITECT_PASSWORD }} # These secrets were created on your behalf
${register_template}
      - name: Deploy component
        run: architect deploy --auto-approve -e \${{ env.ENVIRONMENT_NAME }} \${{ env.ROOT_COMPONENT_NAME }}:latest`;
    fs.writeFileSync(path.join(root_dir, '/.github/workflows/', `${account.name}-${environment.name}-${branch_name}-workflow.yml`), template);
  }

  static async generateWorkflows(app_service: AppService, components: string[], root_component: string, root_dir: string) {
    const should_generate_wrokflow = await this.prompt(["yes", "no"], "Would you like help automating your Continous Integration pipelines?");
    if (should_generate_wrokflow == 'no') {
      return;
    }
    fs.mkdirSync(path.join(root_dir, '/.github/workflows/'));
    const account = await AccountUtils.getAccount(app_service, undefined, {
      account_message: "Which account would you like to associate with this project?",
      ask_local_account: false
    });
    // TODO Generate secrets
    while (true) {
      const should_deploy_main = await this.prompt(["yes", "no"], "Would you like to have your app auto deploy your application when commits are made to a specific branch?");
      if (should_deploy_main == 'yes') {
        await this.generateMainWorkflow(app_service, account, components, root_component, root_dir);
      } else {
        break;
      }
    }
    const should_deploy_main = await this.prompt(["yes", "no"], "Would you like to generate preview environments when you create or update branches?");
    if (should_deploy_main == 'yes') {
      await this.generatePreviewWorkflow(app_service, account, components, root_component, root_dir);
    }
  }
}
