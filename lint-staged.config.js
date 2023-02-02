const { ESLint } = require('eslint');

const removeIgnoredFiles = async (files) => {
  const eslint = new ESLint();
  const ignoredFiles = await Promise.all(files.map((file) => eslint.isPathIgnored(file)));
  const filteredFiles = files.filter((_, i) => !ignoredFiles[i]);
  return filteredFiles.join(' ');
};

module.exports = {
  '*.{js,ts}': async (files) => {
    const filesToLint = await removeIgnoredFiles(files);
    return [
      `eslint --fix --max-warnings=0 ${filesToLint}`,
      'npm run test',
      'npm run check-circular'
    ];
  },
};
