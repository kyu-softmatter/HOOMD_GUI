# Contributing

## Language

All source code, identifiers, comments, docstrings, logs, errors, tests, API fields, default UI copy, developer documentation, and commit messages must be written in English.

## Plan Synchronization

The repository maintains two implementation plans:

- `plan.md` is the public English plan tracked by Git.
- `plan.ko.md` is a local Korean plan excluded by `.gitignore`.

GitHub Actions cannot inspect an ignored local file, so synchronization is enforced by a repository-managed pre-commit hook.

Install the hook once after cloning:

```bash
python3 scripts/install_git_hooks.py
```

When the local Korean plan changes:

1. Update `plan.ko.md`.
2. Apply the same intent and scope changes to `plan.md` in English.
3. Review both documents.
4. Record the reviewed source digest:

   ```bash
   python3 scripts/record_plan_sync.py --confirm
   ```

5. Verify synchronization:

   ```bash
   python3 scripts/check_plan_sync.py
   ```

6. Commit the public files. Never force-add `plan.ko.md`.

The pre-commit hook blocks a commit when the local Korean plan exists and its digest differs from the marker in `plan.md`. The marker detects unsynchronized edits but cannot evaluate translation quality.
