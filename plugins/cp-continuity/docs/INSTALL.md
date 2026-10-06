# Install CP Continuity

> **Fastest route (GitHub marketplace):** in a Claude Code session run `/plugin marketplace add C-Pearson31/cp-continuity` then `/plugin install cp-continuity@chatcpt-mods` (replace C-Pearson31/cp-continuity with the repository this came from). The rest of this page is the ZIP route, where Claude does the setup for you; there the marketplace is named `cp-local` instead.

Use Claude Desktop's **Code** tab in a **Local** session. This package does not provide automatic monitoring in ordinary Claude Chat, Projects, or Cowork. Do not select Cloud or WSL for this installation.

## The easy route

1. Download the ZIP and extract it. On Windows, right-click it and choose **Extract All**. On Mac, double-click it. Keep the extracted files in a permanent folder.
2. In Claude Desktop, open **Code**, start a **Local** session, and select the extracted folder. Do not choose worktree isolation for this setup.
3. Open `INSTALL_PROMPT.txt`, copy its entire contents, and paste them into that Code conversation. Claude will do the file and command work, while preserving your existing settings.
4. If Claude asks you to restart the session or run a command in the conversation, follow that specific instruction. An installer cannot reliably reload its own running mod or issue a slash command on your behalf.

The prompt installs at user scope so the mod is available in your other local Code projects. Its selective mode chooses which conversations merit protection. It begins with normal handling for a disposable smoke test, then activates Auto only after a real handoff succeeds. Nothing is published to a public repository.

## What successful installation looks like

- The installed plugin is `cp-continuity@cp-local` and is enabled.
- `/cp-handoff status` responds in a newly opened local Code session.
- A manual checkpoint saves a brief that can be opened and checked.
- A disposable manual handoff preserves an exact test requirement and resumes successfully.
- Auto is enabled only after those checks pass. A syntax check alone is not proof of this.

Required versions, according to Anthropic's documentation checked October 6, 2026: terminal Claude Code **2.1.287+**, or Desktop's embedded Claude Code **2.1.286+**. In Desktop Code use `/status` to check the embedded version. This is different from the Desktop application's version number. Update the app if its embedded Code version is too old. Managed company policy may prevent custom mods from loading; the installer should explain the blocking policy rather than bypass it.

## Everyday controls

| Command | Purpose |
|---|---|
| `/cp-handoff status` | Inspect the current state and any blocker |
| `/cp-handoff auto` | Let selective activation decide whether to protect this session |
| `/cp-handoff protect` | Protect this session explicitly |
| `/cp-handoff normal` | Leave this session to native context management |
| `/cp-handoff checkpoint` | Save and validate a checkpoint without clearing |
| `/cp-handoff now` | Request a validated handoff now |
| `/cp-handoff reconcile` | Check recovery state after an interrupted handoff |

Commands must be verified against the package and live runtime. If a command is unrecognized, report that error; do not substitute an ordinary `/clear`.

## Turn it off

For the current session, use `/cp-handoff normal`. To disable the installed mod across future sessions, open **+ > Plugins > Manage plugins**, find CP Continuity, and disable it. Start a new session to verify it has stopped. Ask Claude to restore any competing handoff plugin that the installer disabled. Keep the saved checkpoint files unless you intentionally want them deleted.

## If something does not work

Paste: “Read docs/INSTALL.md and INSTALL_PROMPT.txt. Diagnose CP Continuity without clearing this conversation, bypassing policy, or replacing unrelated settings. Tell me the exact failed check and the smallest next step.”

This package was developed outside your Claude installation. Unit tests and static checks do not establish that installation or real session reset works on your computer. The installation prompt explicitly tests that boundary.

## Official installation references

- [Mods: versions and supported surfaces](https://code.claude.com/docs/en/plugins/mods/overview)
- [Install plugins and choose scope](https://code.claude.com/docs/en/plugins/install)
- [Create and install a local marketplace](https://code.claude.com/docs/en/plugin-marketplaces)
- [Desktop Code plugin management](https://code.claude.com/docs/en/desktop)
