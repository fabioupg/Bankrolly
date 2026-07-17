---
description: Prepare an App Store release — version bump check, quality gate, commit, push, and draft release notes
argument-hint: [new version, e.g. 1.2.1]
---

# Release

Prepare Bankrolly for an App Store release. Version argument: $ARGUMENTS (if empty, propose one).

## Steps

1. Read `expo.version` from `app.json`. Compare with the requested version; propose minor bump for feature releases, patch for fixes. Ask before changing it.
2. Remind: `runtimeVersion` uses the `appVersion` policy — if native modules changed since the last binary, the version MUST be bumped.
3. Run `npm run typecheck` and `npm test`. Both must pass — stop and report otherwise.
4. Show `git status --short`. If there are uncommitted changes, propose a commit message (repo style: imperative summary + bullet body) and commit after confirmation.
5. Push to `origin master`.
6. Draft App Store release notes (German + English, bullet style, user-facing wording — no internal jargon) based on the commits since the last version bump, plus a short "Notes for Review" text for Apple if the release adds new permissions or native capabilities.

## Rules

- Never bump the version, commit or push without showing what will happen first.
- The user builds with EAS themselves — do not run `eas build`.
