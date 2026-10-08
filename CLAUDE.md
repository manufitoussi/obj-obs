# Conventions

- Default branch is `main`; work starts from `develop`.
- One branch per change: `feat/<feature>` or `fix/<fix>`, created from `develop`.
- Merge into `develop` semi-linearly: rebase the branch on `develop`, then merge with `--no-ff`.
  Exception: a single-commit branch with no other work in progress on `develop` is merged fast-forward.
- Commits are authored by the repository owner. No `Co-Authored-By` or other AI attribution lines in commit messages.
- Before pushing: `yarn typecheck && yarn test && yarn build`.
