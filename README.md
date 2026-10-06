# CP Continuity for Claude Code

**Long chats shouldn't mean lost context.**

![How it works](media/cp-continuity-explainer.gif)

Claude Code sessions eventually fill their context window. Native compaction then summarizes the conversation, and exact details ("cutoff is **July 1**, not July 2", "field `Contract_Loaded_Date__c` must survive") can quietly disappear.

CP Continuity is a Claude Code **mod** that:

1. **Records** the conversation word for word into a local archive (secrets are redacted by pattern).
2. **Saves a handoff note** with every real message you typed, quoted exactly, plus summaries whose quotes must match the archive verbatim.
3. **Verifies** the note (exact-text checks, read-back, a semantic review). If anything fails, nothing is cleared.
4. **Clears and resumes**: the fresh session is told to read the note and carry on.

> **Status: pilot (0.1.2).** The manual flow (`/cp-handoff checkpoint`, `/cp-handoff now`) was verified live once on Claude Code 2.1.288 (Desktop Code tab, Windows) in a short test. The automatic trigger at ~72% of the context window is **not yet verified live**. Not production-validated. Read the limitations in [plugins/cp-continuity/README.md](plugins/cp-continuity/README.md) before using it on important work.

## Install (2 commands)

Requires Claude Code **2.1.287+** (terminal) or **Desktop Code tab 2.1.286+**, and `git`. Mods are not available in WSL sessions, ordinary Chat, Projects or Cowork.

In a Claude Code session:

```
/plugin marketplace add C-Pearson31/cp-continuity
/plugin install cp-continuity@chatcpt-mods
```

Run these as-is; they point at this repository. Choose **user scope** to have it in all your local projects. Then start a **new** session (or run `/reload-plugins`).

No GitHub? Use the zip: extract it, open the folder in a local Claude Code session, and paste the contents of `plugins/cp-continuity/INSTALL_PROMPT.txt`; Claude performs the setup.

## Use

| Command | What it does |
|---|---|
| `/cp-handoff status` | Mode, capacity, archive coverage, blockers |
| `/cp-handoff protect` | Protect this session |
| `/cp-handoff checkpoint` | Save and verify a handoff, no clear |
| `/cp-handoff now` | Save, verify, clear, resume |
| `/cp-handoff normal` | Native compaction handles this session |
| `/cp-handoff auto` | Selective protection for this session |

It installs in **normal** mode. Try `protect` + `checkpoint` + `now` in a throwaway session first. To make `auto` the default, set the plugin option `mode` to `auto` (plugin configuration) after you are comfortable.

## Know before you install

- A mod is code that runs **with your permissions** inside Claude Code. Read `plugins/cp-continuity/hooks/` (it makes no network or shell calls; `claude plugin validate` lists every host call it makes).
- It archives **every local session**, even in normal mode, as plain files under `~/.claude/state/cp-continuity/`. Redaction is pattern-based and incomplete. Do not use on a machine/account where that is not acceptable.
- Disable: `claude plugin disable cp-continuity@chatcpt-mods`.

## Files

- `.claude-plugin/marketplace.json`: makes this repo an installable Claude Code marketplace
- `plugins/cp-continuity/`: the plugin (`CHANGELOG.md`, `VALIDATION.md`, tests)
- `media/`: the animated explainer (`.gif`, `.svg`)

Concept inspired by [Alex Hillman's claude-auto-handoff](https://github.com/alexknowshtml/claude-auto-handoff). Independent implementation; not an official Anthropic product. MIT licensed.
