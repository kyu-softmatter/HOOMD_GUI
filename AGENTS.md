# Repository Instructions

- Write all source code, identifiers, comments, docstrings, logs, errors, tests, API fields, default UI copy, developer documentation, and commit messages in English.
- Treat `plan.ko.md` as the local Korean planning source. It must remain ignored and untracked.
- Treat `plan.md` as the public English implementation plan.
- If a task changes `plan.ko.md`, update the corresponding English content in `plan.md` during the same turn.
- After reviewing both plans, run `python3 scripts/record_plan_sync.py --confirm` and `python3 scripts/check_plan_sync.py`.
- Never commit or force-add `plan.ko.md`.
- Do not update the synchronization marker without reviewing the semantic equivalence of the two plans.
