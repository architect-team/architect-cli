const { GIT_BRANCH: branch } = process.env;


const plugins = [
  "@semantic-release/commit-analyzer",
  "@semantic-release/release-notes-generator",
  [
    "@semantic-release/changelog",
    {
      "changelogFile": "CHANGELOG.md"
    }
  ],
  [
    "@semantic-release/git",
    {
      "assets": [
        "CHANGELOG.md",
        "README.md",
        "package.json",
        "package-lock.json"
      ]
    }
  ],
  [
    "@semantic-release/github",
    {
      "assets": [
        {
          "path": "dist/*.tar.gz",
          "label": "Architect-CLI ${nextRelease.version}"
        }
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
