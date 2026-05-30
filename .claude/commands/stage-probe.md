Check the current stage of the Vexa release state machine.

```bash
python3 tests3/lib/stage.py probe
```

After running the probe:
1. Display the current stage, legal next stages, and objective
2. Suggest what actions are appropriate for the current stage
3. Remind the user of any restrictions from the stage's "may NOT" list
