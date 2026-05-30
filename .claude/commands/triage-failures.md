Analyze test failures from the most recent test run.

First check the current stage:
```bash
python3 tests3/lib/stage.py probe
```

If not in `triage` or `validate` stage, inform the user of the required transition.

Then analyze failures:
1. Look for test result files in `tests3/reports/`
2. Categorize failures by type (assertion, timeout, import, config)
3. Identify the likely root cause for each failure
4. Suggest specific fixes for each issue
5. Group related failures that may share a common cause

Output a structured triage report with:
- Failure category
- Affected files/services
- Suggested fix
- Priority (high/medium/low)
