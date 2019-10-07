
const disableTTY = () => {
  process.stdout.isTTY = undefined;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const inquirer = require('inquirer');
  inquirer.prompt = async function (prompts) {
    if (!Array.isArray(prompts)) {
      prompts = [prompts];
    }
    for (const prompt of prompts) {
      if (prompt.when) {
        throw new Error(`${prompt.name} is required`);
      }
    }
    return {};
  };
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  inquirer.prompt.registerPrompt = function () { };
};

module.exports = disableTTY;
