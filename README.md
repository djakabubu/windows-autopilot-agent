# Windows Autopilot Agent

A Windows-only AI assistant for PowerShell administration and troubleshooting, available as a terminal CLI and an optional React desktop preview. It connects to OpenRouter and runs PowerShell commands only after local risk classification.

## Status

This project is an independent personal project and is not affiliated with Microsoft, OpenRouter, or any other vendor. AI-generated commands can be incorrect. The local risk checks are not a security boundary or a sandbox; inspect each command before approving it.

## Requirements

- Windows 10 or 11
- Python 3.9 or newer
- Windows PowerShell 5.1 or PowerShell 7 (`pwsh`)
- An OpenRouter API key

The CLI and desktop server use only the Python standard library. Node.js 20.19 or newer (or 22.12 or newer) is needed only to build the optional desktop UI.

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

The desktop app uses a locally hosted React + TypeScript frontend in a Microsoft Edge app window. A hidden Python process serves the UI and a loopback-only API; the Python agent remains responsible for model requests, local risk assessment, explicit command approval, and PowerShell execution. No Electron, WebView host, or extra Python package is used.

1. Build the React UI (Node.js 20.19+ or 22.12+):

   ```powershell
   Push-Location ui
   npm ci
   npm run build
   Pop-Location
   ```

2. Configure `OPENROUTER_API_KEY` in the Windows user environment, then double-click `run_gui.cmd`. It launches a hidden local Python server and opens the UI in an Edge app window. The launcher installs frontend packages only if needed and builds the UI if its build output is missing.

The desktop app is Windows-only and requires Python 3.9+ and Node.js only when the UI needs to be built. Microsoft Edge is used when installed; otherwise the default browser opens. The server listens only on `127.0.0.1:43127`, requires a local `Host`, and shuts down a few seconds after the last app window closes. For development, run `python .\run_gui.pyw --server` to keep the server alive, then open `http://127.0.0.1:43127/`. The app starts with confirmation enabled; there is no GUI autopilot mode. The UI asks before every locally classified non-safe command and displays its exact PowerShell text, risk level, and rationale. This preview has no installer yet. The CLI remains independently usable without the desktop dependencies.

Server errors are recorded in `%LOCALAPPDATA%\WindowsAutopilotAgent\error.log`. Agent activity is recorded locally in `%LOCALAPPDATA%\WindowsAutopilotAgent\activity.log` as JSON Lines: prompts/replies, proposed PowerShell commands, approval decisions, command output and exit codes, plus server errors. Secrets matching the agent's redaction rules are masked; logs rotate at 5 MiB with one backup. The log is for inspection only and is not a replayable `.ps1` script. UI status and event checks run every 2 seconds.

## Development

Validate the Python engine and run the focused task-event tests with:

```powershell
python -m py_compile windows_autopilot.py desktop_backend.py desktop_server.py run_gui.pyw
python -m unittest discover -s tests
```

To develop the UI with Vite, run the Python API server and the React dev server in separate PowerShell terminals:

```powershell
# Terminal 1: API server (stays running until you stop it)
python .\run_gui.pyw --server

# Terminal 2
Push-Location ui
npm ci
npm run dev
Pop-Location
```

Vite proxies `/api` requests to the local Python server. For a production-style frontend build, run `npm ci` and `npm run build` from `ui`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines and [RELEASE_NOTES.md](RELEASE_NOTES.md) for release notes.

## License

MIT. See [LICENSE](LICENSE).
