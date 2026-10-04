# Publishing `agent-blackbox` to PyPI

The package is built and verified (`python -m build`, `twine check` pass; a clean virtual environment installs
it, `blackbox --help` lists every command, the MCP server loads 28 tools). The name `agent-blackbox` was free
on PyPI on 4 Oct 2026. Publishing needs **your** PyPI account; it takes about 5 minutes.

## One-time: account and token
1. Create an account at **https://pypi.org/account/register/** and verify the email.
2. Turn on two-factor authentication (PyPI requires it to upload): Account settings → Add 2FA.
3. Account settings → **API tokens** → **Add API token** → name `agent-blackbox`, scope **Entire account**
   (the project does not exist yet) → copy the token (starts with `pypi-`). It is shown once.

## Publish
```powershell
cd E:\Hackathons\AIBlackBox
git checkout main; git pull
Remove-Item -Recurse -Force dist, build -ErrorAction SilentlyContinue
py -3 -m build
py -3 -m twine check dist/*
py -3 -m twine upload dist/*
```
At the prompt: username `__token__`, password: paste the token.

Then anyone can run `pip install agent-blackbox`, and the page is https://pypi.org/project/agent-blackbox/.

## After the first upload
- Replace the account-wide token with a project-scoped one (API tokens → scope: `agent-blackbox`).
- A new release needs a new version: bump `version` in `pyproject.toml` (PyPI never accepts the same version twice).
- Never put the token in the repository or `.env` files that might be shared.
