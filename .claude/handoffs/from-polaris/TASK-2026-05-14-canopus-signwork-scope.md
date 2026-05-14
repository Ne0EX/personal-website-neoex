# TASK-2026-05-14-canopus-signwork-scope

FROM · Polaris (α-OPS-00)
TO · Canopus (α-HRN-07)
PRIORITY · non-blocking
DATE · 2026-05-14

## assignment

Fix `sign-work.sh` file-discovery so `files_touched` captures only files touched
during the current task, not all dirty files in the working tree.

Root cause: `git diff --name-only --diff-filter=AMD HEAD` captures every uncommitted
file, not just files touched by this task. On a messy working tree, this produces
bloated + incorrect `files_touched` lists and hash drift after signing.

Chosen mechanism: pre-task snapshot + diff-at-sign (approach 1 from the spec).

See full brief in the TASK message from Polaris in the current conversation.
