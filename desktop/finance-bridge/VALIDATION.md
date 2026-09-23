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

## 0.2.1 installer correction — 2026-09-23

- The supplied screenshot showed the old installer's generic Python-not-detected branch. It does not identify whether Python, the launcher, the supported version or optional components are absent.
- Added interpreter discovery beyond py.exe: standard per-user/system locations, Python Install Manager locations, registered PythonCore executable paths, PATH executables excluding generic Windows Store aliases, and an explicit executable argument.
- Added check_python.py and specific messages for wrong runtime, missing Tcl/Tk, and missing venv/ensurepip. No registry/PATH modifications.
- Added INSTALL-LOG.txt for detection and installer output. The log may contain local Windows paths; no accounting inspection occurs during installation.
- Five new mocked Python capability tests pass (14 protocol/runtime tests total). Python syntax and TypeScript checks pass.
- Windows batch discovery, registry access, pip installation and desktop shortcut creation have NOT been executed on real Windows here. These remain user acceptance checks.
- Runtime component version is now 0.2.1. The web panel remains compatible with 0.2.0 and 0.2.1.
