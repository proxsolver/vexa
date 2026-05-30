Run the Vexa test suite.

```bash
python3 tests3/lib/stage.py probe
```

First check the current stage. Tests should only be run in the `validate` stage (entered from `deploy`). If not in validate, inform the user of the required transition.

If in the correct stage, run:
```bash
cd tests3 && make test
```

After tests complete:
- If GREEN: summarize passing tests and suggest transitioning to `human` stage
- If RED: list failures and suggest transitioning to `triage` stage
