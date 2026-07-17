---
description: Full quality gate — typecheck, tests, then a deep read-only bug scan of recent changes via the bug-hunter agent
---

# Deepcheck

Run the complete quality gate for Bankrolly and report the results in one summary.

## Steps

1. Run `npm run typecheck`. If it fails, list the errors and stop — fixing comes first.
2. Run `npm test` (Vitest). If tests fail, show the failing assertions and stop.
3. Invoke the `bug-hunter` agent (Agent tool, subagent_type "bug-hunter") to scan the recent changes for logic bugs. Wait for its report.
4. Summarize: typecheck status, test count, and the bug-hunter findings ranked most-severe first. For each finding, say in one sentence what you recommend (fix now / fix later / ignore, with reason).

## Rules

- Never fix anything during deepcheck — this command only reports. The user decides what gets fixed.
- If everything is clean, say so plainly: "Typecheck ✅, N tests ✅, no findings."
