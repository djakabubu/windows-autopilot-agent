# Windows Autopilot Agent

A Windows-only, terminal-based AI assistant for PowerShell administration and troubleshooting. It connects to OpenRouter and runs PowerShell commands only after local risk classification.

## Status

This project is an independent personal project and is not affiliated with Microsoft, OpenRouter, or any other vendor. AI-generated commands can be incorrect. The local risk checks are not a security boundary or a sandbox; inspect each command before approving it.

## Requirements

- Windows 10 or 11
- Python 3.9 or newer
- Windows PowerShell 5.1 or PowerShell 7 (`pwsh`)
- An OpenRouter API key

No third-party Python packages are required. The provided CMD launcher is optional; run the Python file directly from PowerShell or Command Prompt.

## Quick start (PowerShell)

```powershell
# Set for this PowerShell session only; substitute your own key.
$env:OPENROUTER_API_KEY = 'your-openrouter-key'

# Run in the project directory.
py -3 windows_autopilot.py

# Or submit one request.
py -3 windows_autopilot.py "show free space on each drive"
```

Alternatively, run `windows_autopilot.cmd` from Command Prompt after setting the environment variable:

```bat
set OPENROUTER_API_KEY=your-openrouter-key
windows_autopilot.cmd
```

For persistent user-level configuration, set `OPENROUTER_API_KEY` in Windows Environment Variables. Avoid putting real credentials in source files, command history, screenshots, or issues. If a key is exposed, revoke and rotate it.

## Behavior and safety

- Every command is classified locally as `SAFE`, `CAUTION`, or `DANGEROUS`.
- Commands not confidently recognized as harmless ask for confirmation.
- Output sent to the model is truncated and passed through best-effort secret redaction.
- Each action executes in a new PowerShell process; shell variables and location do not persist between actions. Use `:cd` to change the working directory.
- `:autopilot` disables confirmation prompts. Use only when you understand and accept the risk.
- This tool executes commands on your computer. Review proposed actions, back up important data, and do not treat its risk rules as a substitute for security controls.

## Options

| Option | Purpose | Default |
| --- | --- | --- |
| `--model NAME` | OpenRouter model | `deepseek/deepseek-v4-flash-0731` |
| `--max-steps N` | Maximum steps for a task | `25` |
| `--timeout N` | Command timeout in seconds | `600` |
| `--no-color` | Disable terminal colors | Off |
| `--ascii-ui` | Use ASCII decorations | Auto in Command Prompt |
| `--version` | Print version | — |

Configuration environment variables: `OPENROUTER_API_KEY` (required), `OPENROUTER_BASE_URL`, `AGENT_MODEL`, `AGENT_MAX_STEPS`, `AGENT_COMMAND_TIMEOUT`, `AGENT_MAX_OUTPUT`, `AGENT_MAX_CONTEXT_MESSAGES`, `AGENT_MAX_COMMAND`, `AGENT_POWERSHELL`, `AGENT_ASCII_UI`, `AGENT_HTTP_REFERER`, `AGENT_X_TITLE`, and `AGENT_NO_COLOR`.

## Interactive commands

`:help`, `:status`, `:clear`, `:history`, `:history clear`, `:autopilot`, `:model NAME`, `:cd PATH`, and `:quit`.

Runtime history files are created beside the program and are intentionally ignored by Git.

## Development

The program uses only the Python standard library. Validate syntax with:

```powershell
py -3 -m py_compile windows_autopilot.py
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines and [RELEASE_NOTES.md](RELEASE_NOTES.md) for release notes.

## License

MIT. See [LICENSE](LICENSE).
