# Validation — Windows Bridge 0.2.0

2026-09-23. Source based on the previous Hesabyar UI inspection component.

Completed in Linux with Python unittest and mocked Windows UI:
- 9 automated tests pass: denied mutation endpoints, exact origin/host/token checks, JSON and request limits, session/selection expiry, process identity and backend checks, password-control exclusion, explicit opt-in for image capture, and bounded UI traversal.
- Python syntax compilation passes for bridge, GUI launcher and installer.
- Tests deliberately mock Windows APIs. These results do not demonstrate compatibility with a particular accounting program.

Not tested: real Windows installation, dependency installation from PyPI on the user's machine, shortcut creation, Windows UI Automation, browser local-network permission, real accounting reports, accessibility/elevation restrictions.

Package is a per-user Python installer, not a signed standalone EXE/MSI. Python 3.11 or 3.12 plus network access to PyPI is required. It installs no background service or scheduler. Stop the old connector before starting this one.

Run portable protocol tests: python tests/test_bridge.py
Full source is included. Install with INSTALL.cmd; run after installation using the Desktop shortcut.

No financial data is preloaded. Automated navigation, complete report export, AI financial analysis, document posting and daily scheduling are not included.
