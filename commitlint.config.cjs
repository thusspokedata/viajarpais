/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      [
        "admin",
        "public",
        "db",
        "auth",
        "geo",
        "i18n",
        "ci",
        "infra",
        "deps",
        "repo",
      ],
    ],
    "scope-empty": [2, "never"],
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "chore",
        "docs",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "style",
        "revert",
      ],
    ],
  },
};
