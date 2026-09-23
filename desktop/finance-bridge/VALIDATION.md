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

## 0.2.2 launch/shortcut correction — 2026-09-23

- Previous installer announced completion before verifying the launched GUI. The user's exact local failure is not yet known because no startup traceback has been received.
- Added a logged entry point (START-LOG.txt), startup error message, and a unique per-launch readiness marker written only after the Tk window is viewable. Installer checks the child process and readiness before reporting success.
- Added desktop and Start Menu shortcuts targeting the venv Python executable directly, with saved-target/file validation. Opens the actual install folder and provides OPEN.cmd in the extracted package as an alternate launch path.
- Added seven portable tests for startup confirmation: no marker/timeout, process exit with 0/nonzero, wrong process marker, valid confirmation, explicit startup error, and a real entrypoint exception with log output. All 21 Python protocol/runtime/startup tests pass. Python syntax and TypeScript checks pass.
- No Windows session is available here. Actual Tk rendering, Windows shortcuts, registry, installation and accounting access remain unverified on the user's PC. These tests exercise control logic, not Windows GUI compatibility.

## 0.2.3 missing-runtime / false-success correction — 2026-09-23

- User screenshot explicitly reports: No runtime installed that matches 3.12, followed by incorrect batch success messages. It proves runtime selection failed, not that the Python installer or GUI executed.
- The old batch checks used IF ERRORLEVEL 1, which only catches codes >= 1. Negative nonzero exit codes could fall through. The screenshot does not show the numeric exit code, so that exact local code has not been measured.
- Both signs of nonzero exit code now stop the flow. Runtime selection additionally requires a fresh exact receipt written by check_python.py; installer completion requires a different fresh receipt written only after successful install and GUI checks. Removed the batch's independent unverified Installation completed message.
- Added guidance for the manager's py install 3.12 command and version check.
- Four new tests verify failure removes stale receipts, failed installation cannot issue confirmation, and confirmation follows success. All 25 portable Python tests pass; Python syntax and TypeScript checks pass.
- Actual Windows CMD/manager execution is not tested here. User must first install runtime 3.12, then run this package. No claim of successful installation on the user's PC is made.

## 0.2.4 window discovery / diagnostics — 2026-09-23

- User reports both UIA and Win32 cannot read/select a window. Root cause on their Windows computer is not established. The prior user screenshot confirms that a bridge GUI opened, not that accounting data was readable.
- Confirmed code issue: discovery silently discarded every per-window exception, including failures to read optional executable paths. These failures are now counted by stage/type/numeric code; optional executable/name failures no longer remove otherwise identifiable windows. PID, process creation time and selected-window checks remain required.
- Worker COM mode changed from STA to MTA, matching Microsoft UI Automation guidance: https://learn.microsoft.com/en-us/windows/win32/winauto/uiauto-threading . This is a compatibility correction, not proof of the user's failure cause.
- Added independent bounded UIA and Win32 probes (18 seconds each); a hung probe does not prevent the next method. Reports exclude window titles, UI text, images, full paths, tokens and raw exception messages. No accounting action, typing or posting is added.
- CHECK.cmd uses an existing installed bridge environment to run diagnostics from the extracted package without reinstalling anything; opens DIAGNOSTICS.json in Notepad. GUI also provides diagnostic and copy-report buttons.
- Web page explicitly distinguishes a responding bridge, empty discovery, discovery errors and read/screenshot errors. Actual bridge version is shown; 0.2.0 through 0.2.4 remain compatible.
- Seven new portable tests cover optional-path permission failures, required identity failures, error-vs-empty distinction, report privacy, screenshot failure, isolated timeout and failed-process output privacy. Total 32 Python tests pass; syntax and TypeScript checks pass.
- No Windows host is available here. Native COM, the new CHECK.cmd, Notepad opening, GUI rendering and real accounting compatibility are NOT tested on Windows. The user's diagnostic report is the next acceptance evidence.
