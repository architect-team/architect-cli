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
      `prettier --write ${files.join(' ')}`,
      `eslint --fix --max-warnings=0 ${filesToLint}`,
    ];
  },
  '*.{js,ts,__parallel1__}': ['npm run check-circular'],
  ...(process.env.NO_TEST ? {} : { '*.{js,ts,__parallel2__}': ['npm run test'] }),
};
