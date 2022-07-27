const { GIT_BRANCH: branch } = process.env;

const commitAnalyzer = "@semantic-release/commit-analyzer";
const releaseNotesGenerator = "@semantic-release/release-notes-generator";
const git = [
  "@semantic-release/git",
  {
    "assets": [
      "CHANGELOG.md",
      "README.md",
      "package.json",
      "package-lock.json",
      "architect-yml.md",
      "src/dependency-manager/schema/architect.schema.json",
    ]
  }
];
const exec = [
  "@semantic-release/exec",
  {
    "publishCmd": "npm run pack"
  }
];
const npm = "@semantic-release/npm";
const github = [
  "@semantic-release/github",
  {
    "assets": [
      {
        "path": "dist/*.tar.gz",
        "label": "Architect-CLI ${nextRelease.version}"
      }
    ]
  }
];
const changelog = [
  "@semantic-release/changelog",
  {
    "changelogFile": "CHANGELOG.md"
  }
];


const default_plugins = [
  commitAnalyzer,
  releaseNotesGenerator,
  npm,
  git
]

const main_plugins = [
  commitAnalyzer,
  releaseNotesGenerator,
  changelog,
  exec,
  npm,
  git,
  github
]

module.exports = {
  "branches": [
    "main",
    {
      "name": "rc",
      "prerelease": true
    },
    {
      "name": "arc-*",
      "prerelease": true
    }
  ],
  plugins: branch === 'main' ? main_plugins : default_plugins,
};

console.log(module.exports);
