# Contributing

Thanks for your interest in contributing to Windows Autopilot Agent.

## Reporting issues

Please include a concise description, reproducible steps, expected and actual behavior, Windows version, PowerShell/Command Prompt version, and Python version. **Never include API keys, passwords, private keys, tokens, personal file paths, or unredacted logs.** Review logs and screenshots before attaching them.

## Pull requests

1. Fork the repository and create a focused branch.
2. Keep changes compatible with Windows 10/11 and Windows PowerShell 5.1 or PowerShell 7 unless the change explicitly documents otherwise.
3. Preserve the Python standard-library-only runtime dependency policy.
4. Run `py -3 -m py_compile windows_autopilot.py` and manually check relevant PowerShell and Command Prompt behavior.
5. Describe the change, tests, and any behavior changes in the pull request.

Risk classification changes should remain conservative: when uncertain, ask for confirmation. Do not commit local history, credentials, or generated runtime state.

By submitting a contribution, you agree that it is provided under the repository's MIT license.
