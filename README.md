# Windows Autopilot Agent

A Windows-only AI assistant for PowerShell administration and troubleshooting, available as a terminal CLI and an optional React desktop preview. It connects to OpenRouter and runs PowerShell commands only after local risk classification.

## Status

This project is an independent personal project and is not affiliated with Microsoft, OpenRouter, or any other vendor. AI-generated commands can be incorrect. The local risk checks are not a security boundary or a sandbox; inspect each command before approving it.

## Requirements

- Windows 10 or 11
- Python 3.9 or newer
- Windows PowerShell 5.1 or PowerShell 7 (`pwsh`)
- An OpenRouter API key

The CLI uses only the Python standard library. The optional desktop UI requires Node.js 20.19 or newer (or 22.12 or newer), the WebView2 Runtime, and the extra Python dependency described below.

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

## Optional desktop app (preview)

The desktop app uses a React + TypeScript frontend hosted in a native Windows window by pywebview. The Python agent remains responsible for model requests, local risk assessment, explicit command approval, and PowerShell execution. The UI is bundled locally; it does not expose a network API or send commands directly to PowerShell.

1. Install the optional Python desktop host:

   ```powershell
   python -m pip install -r requirements-gui.txt
   ```

2. Build the React UI:

   ```powershell
   Push-Location ui
   npm ci
   npm run build
   Pop-Location
   ```

3. Configure `OPENROUTER_API_KEY` in the Windows user environment, then launch `run_gui.pyw`. You can also run `python .\run_gui.pyw` from a PowerShell session where the key is set; that launch method may leave the terminal window open.

The desktop preview is Windows-only and requires WebView2. It starts with confirmation enabled; there is no GUI autopilot mode. The UI asks before every locally classified non-safe command and displays its exact PowerShell text, risk level, and rationale. This preview has no installer yet: Python, the optional pywebview dependency, Node.js for building, and the WebView2 Runtime must be installed separately. The CLI remains independently usable without these GUI dependencies.

## Development

Validate the Python engine and run the focused task-event tests with:

```powershell
python -m py_compile windows_autopilot.py desktop_backend.py run_gui.pyw
python -m unittest discover -s tests
```

Build and type-check the desktop frontend from `ui` with `npm ci` and `npm run build`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines and [RELEASE_NOTES.md](RELEASE_NOTES.md) for release notes.

## License

MIT. See [LICENSE](LICENSE).
