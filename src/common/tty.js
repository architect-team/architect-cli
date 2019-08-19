
const disableTTY = () => {
  process.stdout.isTTY = undefined;
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
  };
  inquirer.prompt.registerPrompt = function () { };
};

module.exports = disableTTY;
