const { GIT_BRANCH: branch } = process.env;

const plugins = [
  "@semantic-release/commit-analyzer",
  "@semantic-release/release-notes-generator",
  [
    "@semantic-release/git",
    {
      "assets": [
        "CHANGELOG.md",
        "README.md",
        "package.json",
        "package-lock.json",
        "docs/5-reference/2-architect-yml.md",
        "src/dependency-manager/schema/architect.schema.json",
      ]
    }
  ],
  [
    "@semantic-release/exec",
    {
      "publishCmd": "npm run pack"
    }
  ],
  "@semantic-release/npm"
];

const main_plugins = plugins.concat([[
  "@semantic-release/github",
  {
    "assets": [
      {
        "path": "dist/*.tar.gz",
        "label": "Architect-CLI ${nextRelease.version}"
      }
    ]
  }
], [
  "@semantic-release/changelog",
  {
    "changelogFile": "CHANGELOG.md"
  }
]]);

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
  plugins: branch === 'main' ? main_plugins : plugins,
};
