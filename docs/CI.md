# Black Box CI: a regression firewall for agent code

Unit tests check functions. Agents fail differently: a one-word prompt edit can change which tool the agent calls
three steps later. Black Box CI replays **real recorded runs** of your agent against every pull request.

## How it works
1. **Pin** recorded runs into a regression pack and commit it. The pack embeds the runs, so CI needs no data folder:
   ```bash
   blackbox ci pin --fail 5 --pass 5          # or: blackbox ci pin <run_id> <run_id> ...
   git add .blackbox/pack.json
   ```
2. On every PR, **replay** each pinned run against the new code. Every step's request is compared with the recording:
   - `same`: the code asks exactly what it asked before. No behaviour change, and no model calls needed.
   - `changed`: the code now asks something different at **step k** (a prompt edit, a new tool call, a new argument).
3. With `--live`, each changed run is **re-run from step k** with the new code; the steps before k still come from
   the recording, so only the changed part costs model calls. Each run is then classified:
   - `fixed`: it failed before and passes now
   - `regression`: it passed before and fails now. **The build fails.**
   - `held`: same outcome as before
4. A Markdown report (job summary and PR comment) and JUnit XML are written. Money-moving tools never execute.

## GitHub Actions
```yaml
# .github/workflows/blackbox.yml
on: pull_request
jobs:
  blackbox-ci:
    runs-on: ubuntu-latest
    permissions: { contents: read, pull-requests: write }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - uses: Aryan-lomte05/Half_a_Byte_maharashtra_round/.github/actions/blackbox-ci@dev
        with:
          imports: my_project.agents          # the module that registers your agents
          live: "true"                        # re-run changed runs (needs model keys below)
        env:
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
```
Inputs: `pack` (default `.blackbox/pack.json`), `live`, `imports`, `install` (pip target), `comment`.
This repository runs the same action on itself (job `blackbox-ci` in `.github/workflows/ci.yml`).

## Locally
```bash
blackbox ci run                        # offline: what changed, and where
blackbox ci run --live --report ci.md  # plus the new outcomes
```
Exit code 1 on any regression, or when a pinned run cannot be read or re-run.

## Verified
- The wheel (`pip wheel .`) installs into a clean virtual environment and `blackbox ci run` passes on an
  8-run pack from our recordings (QA, Math and Shop agents), with no repository and no data folder present.
- `tests/test_ci.py`: unchanged code replays the same; a harmless prompt edit is detected at the exact step and
  held when re-run; a misleading prompt edit is a regression that fails the build (report and JUnit say so).
