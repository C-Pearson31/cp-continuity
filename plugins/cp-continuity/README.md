# CP Continuity 0.1.0

A Claude Code plugin for selective, proactive continuity. **Pilot build.** 0.1.2 passes `claude plugin validate` and 35 offline tests, and the manual path (`/cp-handoff checkpoint` and `/cp-handoff now`: save, verify, clear, resume) was verified live once, in a short test on Claude Code 2.1.288 (Desktop Code tab, Windows). The threshold-triggered automatic reset, background-job holds, long histories and the late-correction race have **not** been exercised live. Not production-validated; use `protect` on sessions you choose before relying on `auto`.

## Easiest installation

Extract this ZIP into a permanent folder. Open that folder in **Claude Desktop → Code → Local**. Open `INSTALL_PROMPT.txt`, copy its entire contents, and paste it into that Code session. Claude performs the setup and walks you through live checks. Details: `docs/INSTALL.md`.

Starts in **Normal** so installation does not unexpectedly clear an important conversation. After the disposable live smoke test, select **Auto** in this plugin's configuration for future sessions. The `/cp-handoff auto` command changes the current session, not the default for every future session.

**Only Claude Code.** Not ordinary Claude Chat, Projects, Cowork, or Codex. Desktop WSL is not a supported plugin environment. Use a local session for the installation pilot. Do not install alongside another automatic context-reset mod.

## What this build does

- **Normal:** records a lightweight local archive but leaves native compaction in control. No extra model calls unless you explicitly request a checkpoint.
- **Auto:** tests for reusable work, not conversation length. Simple questions do not invoke the classifier or summarizer. When heuristics indicate research, revisions, requirements or a project, one model classification confirms activation. Maximum two classification attempts per session; protection stays active until you change it.
- **Protect:** explicitly activates continuity for the current session.
- Uses the current runtime's context window and model, checks before requests, and recalculates its trigger after model changes. Default 72% plus recovery headroom is an adjustable operating policy, not an established hallucination threshold. Higher reasoning effort adds reserve, never fictitious capacity.
- Records complete text from user prompts, model steps and observed tool results into numbered, read-back-verified shards. Bootstraps earlier text from the host snapshot. Does not shorten user messages to 2,000 characters or select only the latest 120.
- Preserves **all recorded real user messages verbatim after secret redaction**, with identifiers and chronological order, rather than letting a summarizer decide which corrections can be discarded. Latest corrections take precedence. This conservative evidence ledger can become too large: the mod blocks clearing rather than silently dropping it.
- Summarizes archived history in contiguous chunks, caches unchanged chunks, and retains original chunk references. Actual tool output is archived, not only tool input. Sources/drafts remain recoverable from the original archive even when a summary omits nuance.
- Rejects malformed summaries, unsupported evidence quotations, omitted/changed user evidence, incomplete archive coverage, missing latest request/status/next action, failed semantic review and failed read-back. The semantic review is fallible; deterministic checks enforce the exact recorded user text.
- Saves immutable JSON and Markdown handoffs plus a committed manifest before `/clear`. Rechecks conversation revision immediately before queued clearing. A late correction cancels the reset.
- Tracks in-flight calls, running agents, known background shell patterns and uncertain MCP/shell failure outcomes. A hold must be explicitly reconciled by you after checking the real operation. It never retries external operations itself.
- Resumes from the verified brief and carries raw history into the new archive. Guards consecutive handoffs and a fresh session with too little growth space.
- No HTTP viewer, public server, Tailscale dependency, telemetry, npm dependencies, or automatic model-registry network calls.

## Commands

| Command | Effect |
|---|---|
| `/cp-handoff status` | Mode, current model/capacity/trigger, archive coverage, holds and saved checkpoint |
| `/cp-handoff protect` | Force protection for this session |
| `/cp-handoff normal` | Restore native handling and stop plugin-managed auto handoffs |
| `/cp-handoff auto` | Selective protection for this session |
| `/cp-handoff checkpoint` | Save and validate a handoff without clearing |
| `/cp-handoff now` | Save and validate, then clear and resume; test first in a disposable session |
| `/cp-handoff reconcile` | Explicitly clear operation holds after personally checking outstanding operations |

The command intentionally waits for the current turn rather than executing a reset in the middle of a tool call. Normal leaves the archive collector active; disabling the plugin stops collection too.

## Pilot limitations and trade-offs

1. No universal hallucination detector or perfect semantic completeness guarantee. Preserving exact user text does not prove the next model will interpret it correctly.
2. The current host snapshot is capped at 4,096 messages. A bootstrap reaching that cap blocks reset. Start a fresh protected conversation with a reviewed handoff instead of asserting old coverage. Files/images and other non-text attachments also block reset because this build cannot prove they transfer.
3. Local archive collection occurs even for casual sessions; its overhead is local writes, not classifier/model calls. Common secrets are redacted, but heuristic redaction cannot identify every secret or sensitive business fact. Use only an approved machine/account for company material. Archives are plain local files under your home directory with normal OS permissions.
4. Preserve user instructions by quoting them all: safe but potentially large. If the evidence exceeds the fresh-session budget, clearing is blocked. User-approved supersession/pruning and richer task extraction are future improvements. This build does not promise endless unattended resets.
5. A checkpoint makes up to `maxSummaryCalls` (12 default) chunk requests, one task-status request, and one semantic review. Cached chunks reduce repeat calls. Registry API activity is optional and separate. No dollar-cost claims are made.
6. Known background operations are held; arbitrary detached processes and remote jobs are not universally detectable. Audit custom Bash/MCP workflows before enabling unattended handoff. Successful asynchronous tool responses may still need a custom adapter.
7. A crash or reload during clear/seed does not automatically consume another session's pending transaction. Recovery is deliberately manual: inspect the saved brief and resume the original session or paste the brief path into a new session. No claim of guaranteed exactly-once external work.
8. Local chunk references are available on the same machine. Cross-product transfer needs copying the referenced artifacts too; this ZIP does not add a Codex or Cowork integration.
9. Original files/URLs referred to in conversations are not guaranteed to remain available. Archive and summary source shards are verified; external artifacts must be checked on resume.
10. Integration with a specific installed Claude Code version is not validated here. Public declarations can lag current docs. The install prompt must run the installed version's validator and live smoke tests before Auto.

## Configuration

Use the plugin configuration UI for persistent defaults. Defaults: Normal mode, 0.72 trigger fraction, minimum 24,000-token reserve, Sonnet summaries, 12 new chunk calls per checkpoint, two unattended consecutive handoffs, optional registry path blank. Values are validated. Snapshot/bootstrap and local archive paths are project/session separated.

Archives: `~/.claude/state/cp-continuity/<project-fingerprint>/<session-id>/`. On Windows the home directory uses `USERPROFILE`. No automatic deletion policy: remove a specific project's archive only after disabling the plugin and saving any recovery brief you want. Do not delete an archive needed by an active or resumable handoff.

Runtime capacity is authoritative. If unavailable, an optional positive, fresh Anthropic API registry can supply a fallback. This fallback only suits direct Anthropic API environments, not provider aliases/gateways with lower or unknown limits. The helper `scripts/update-model-registry.py OUTPUT.json` refreshes official metadata, requires `ANTHROPIC_API_KEY`, and does not save or print the key. It is **not** scheduled or automatically invoked by the plugin. Most subscription users do not need it. Unavailable/null/stale metadata blocks resetting.

## Developer verification

```sh
node --test tests/*.test.js
python3 scripts/check-package.py
claude plugin validate /absolute/path/to/cp-continuity
```

The first two run offline. The third and live smoke tests require installed Claude Code and are not claimed completed. Validation details: `VALIDATION.md`.

Concept inspired by [Alex Hillman's auto-handoff](https://github.com/alexknowshtml/claude-auto-handoff). This is a separate implementation; it is not Mark Kashef's demonstrated mod or an official Anthropic product.

Official capability references consulted October 6, 2026:

- https://code.claude.com/docs/en/plugins/mods/reference
- https://code.claude.com/docs/en/plugins/mods/overview
- https://github.com/anthropics/claude-code/blob/main/mods/types/claude-code.d.ts
- https://platform.claude.com/docs/en/api/models/list

## Disable / rollback

For the current session: `/cp-handoff normal`. To stop the plugin entirely, disable `cp-continuity` in `/plugin` → Installed using its installation scope. Preserve archives and original transcripts. Restore only the settings and competing plugin states recorded by the installer; do not overwrite unrelated settings. Restart/reload according to Claude Code's documented plugin workflow.
