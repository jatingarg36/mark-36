# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Added
- In-note search UI with keyboard navigation and match tracking.
- Markdown to `.docx` export utility behind an experiment flag (`EXPORT_DOCX`).
- Chrome theme color integration utilities to dynamically style the app from browser theme colors.
- New experiment configuration module for centralized feature flag management.

### Changed
- Expanded editor toolbar capabilities and command organization for richer formatting workflows.
- Updated editor, preview, and sidebar interactions to support search and export-related flows.
- Refined top bar actions and app-level state wiring for new editor features.
- Refreshed global styles for toolbar, search, and preview polish.

### Dependencies
- Added `docx` to support Word document export.
