---
name: cut-release
description: >-
  Use when preparing or publishing a release of the BookShelf API. Moves the
  CHANGELOG Unreleased section into a version, bumps package.json, tags, and
  drafts the GitHub Release. The project uses SemVer + Keep a Changelog.
---

# Cutting a BookShelf API release

The project is pre-1.0, so most releases bump the **minor** (`0.x.0`) for
features and **patch** (`0.x.y`) for fixes only. `1.0.0` is a deliberate call by
the user, not automatic.

## 1. Pick the version

- Breaking API change or notable feature set -> minor (`0.2.0`).
- Bug fixes / internal only -> patch (`0.1.1`).
- Confirm the number with the user if unsure.

## 2. Update `CHANGELOG.md`

- Rename `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD` (today's date).
- Add a fresh empty `## [Unreleased]` above it.
- Update the link references at the bottom:
  ```
  [Unreleased]: https://github.com/bookshelf-web/bookshelf-api/compare/vX.Y.Z...HEAD
  [X.Y.Z]: https://github.com/bookshelf-web/bookshelf-api/releases/tag/vX.Y.Z
  ```
- Keep entries grouped under `Added` / `Changed` / `Fixed` / `Removed`, and mark
  anything that changes the HTTP contract as **BREAKING (API)**.

## 3. Bump the version

Edit `"version"` in `package.json`, then sync the lockfile:

```
npm install --package-lock-only
```

Also update `version` in `src/config/swagger.ts` to match.

## 4. Commit

```
chore(release): vX.Y.Z
```

(Conventional Commits, English, no AI-attribution trailer.)

## 5. Tag

```
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin main   # only if the user asked to push
git push origin vX.Y.Z
```

Tags `v*` are meant to be protected (immutable) once a ruleset is in place — do
not move or delete a published tag.

## 6. GitHub Release

`gh release create` requires an account with write access. The `gh` CLI in this
environment is read-only on the repo, so unless the user has re-authenticated:

- Tell the user to create the Release from tag `vX.Y.Z` in the GitHub UI.
- Notes = the `[X.Y.Z]` section of `CHANGELOG.md`.
- Mark it **pre-release** while the project is < 1.0.

If write access is available:

```
gh release create vX.Y.Z --title "vX.Y.Z" --notes-file <changelog section> --prerelease
```

## 7. After release

- `main` auto-deploys to Render — verify `https://<render-url>/health` and, for a
  contract change, hit one endpoint to confirm the new behavior is live.
- If the API contract changed, remind the user the `bookshelf-frontend` repo
  needs a matching update.
