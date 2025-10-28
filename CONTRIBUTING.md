# Contributing

Thanks for your interest in NotebookLM → PDF! Contributions are welcome. Please follow the steps below to get started.

## Getting Started

1. Fork the repository and clone your fork:
   ```bash
   git clone git@github.com:dylanmccavitt/notebooklm-exporter.git
   cd notebooklm-exporter
   ```

2. Install the optional tooling dependencies:
   ```bash
   npm install
   ```

3. Load the extension for testing:
   - Open `chrome://extensions`
   - Enable **Developer mode**
   - Click **Load unpacked** and choose the repo root
   - The extension loads from `manifest.json` + `src/`

## Making Changes

- Work in a feature branch based on `main`.
- Keep changes focused (one feature or fix per pull request).
- Follow the existing code style (plain JS, minimal comments unless useful).
- Place new assets/scripts under `src/`.

## Testing Checklist

Before submitting a PR:

1. Reload the extension in `chrome://extensions`.
2. Visit <https://notebooklm.google.com> and confirm the **Export PDF** button appears next to Refresh.
3. Click **Export PDF** and verify the print page loads with KaTeX-rendered math where applicable.
4. If you touched the print pipeline, run `bash src/scripts/pack.sh` to ensure the zip builds without errors.

## Submitting a Pull Request

1. Push your branch to your fork.
2. Open a pull request against `main`.
3. Describe the change and how you tested it.
4. Respond to review feedback; maintainers will squash/merge once it’s ready.


