import {Hook} from '@oclif/config';
import isCI from 'is-ci';

const hook: Hook<'init'> = async function (options) {
  if (isCI || !process.stdout.isTTY) {
    process.stdout.isTTY = undefined;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const inquirer = require('inquirer');

    inquirer.prompt = async function (prompts: any) {
      if (!Array.isArray(prompts)) {
        prompts = [prompts];
      }
      for (const prompt of prompts) {
        if (prompt.when !== false && prompt.default == undefined) {
          throw new Error(`${prompt.name} is required`);
        }
      }
      return prompts.reduce((d: any, prompt: any) => {
        if ((prompt.when == undefined || prompt.when === true) && prompt.default != undefined) {
          d[prompt.name] = prompt.default;
        }
        return d;
      }, {});
    };
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    inquirer.prompt.registerPrompt = function () { };
  }
};

export default hook;
