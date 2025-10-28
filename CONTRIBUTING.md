# Contributing

Thanks for your interest in NotebookLM -> PDF! Contributions are welcome. Please follow the steps below to get started. 

## Getting Started

1. Fork the repository and clone your fork:
```bash
git clone git@github.com:dylanmccavitt/notebooklm-exporter.git
cd notebooklm-exporter```

## Install dependencies (only for tooling/scripts)

1. ```bash
npm install```

2. Load the extensions for testing:
- Open chrome://extensions
- Enable Developer mode
- Click Load unpacked and choose the repo root
- The extension loads from manifest.json + src/.

3. Making changes:
- Work in a feature branch based on main
- Keep changes focused (one feature or fix per pull request)
- Follow existing code style (plain JS, minimal comments unless needed)
- If you add new assets/scripts, keep them under src/

## Testing
- Before submitting a PR
1. reload the extension in chome://extensions
2. Visit https://notebooklm.google.com, confirm the Export PDF button appears next to Refresh.
3. Click Export PDF and verify the print pages loads with KaTeX math rendering (if using math in NLM)
4. If you touched the print pipeline, run bash src/scripts/pack.sh to ensure the zip builds. 

## Submitting a Pull Request
1. Push your branch to your fork.
2. Open a pull request against main.
3. Explain what changed/testing done.



