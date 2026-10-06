# Validation record

Build: CP Continuity 0.1.0. Date: October 6, 2026.

## Completed locally

- JavaScript syntax checks for `hooks/core.js` and `hooks/register.js`.
- 26 Node tests passed: policy/ledger checks and a simulated Claude Code host.
- Confirmed the original reviewed auto-handoff repository was left unchanged.

Tests cover: casual chats producing no extra model calls; project activation; runtime capacity over published maximum; smaller window and effort reserve; exact segmentation; earliest/long requirements after 5,000 synthetic rows; missing/changed evidence; bad summaries and invented quotes; secret redaction; manual checkpoint; simulated clear/seed with raw history carried forward; model failure; disk failure; corrupted read-back; rejected semantic review; corrections during preparation and after clear is queued; running agents; uncertain MCP outcomes; explicit reconciliation; model switches; normal-mode native handling; unknown capacity; capped bootstrap; separate session paths and pending records.

These are meaningful offline checks, not evidence that a real Claude Desktop session loaded the mod or reset successfully.

## Required in your Claude Code installation

- `claude plugin validate` against the installed version's APIs.
- Confirm `/cp-handoff status` responds, measured capacity is present, coverage is complete.
- Manual checkpoint with the exact field, cutoff, rejected approach, and unfinished action in the install prompt.
- Disposable `/cp-handoff now` test confirming live clear, seed and exact evidence retention.
- Enable Auto only after these checks pass. Keep Normal if the host refuses the plugin or any live test fails.

## Acceptance limits

This pilot does not include automatic historical JSONL streaming beyond the capped bootstrap, transfer of non-text attachments, automatic registry refresh scheduling, validated provider/plan discovery outside runtime metadata, a universal background-job adapter, automatic crash recovery, automatic retention cleanup, or a tested Cowork/Codex integration.

Exact user evidence is preserved rather than silently pruned. If size or coverage prevents a safe handoff, reset stops and explains the blocker. No claim of hallucination prevention, perfect interpretation, production readiness or live installation is made.

## Update: 0.1.2 live check (2026-10-06)
- `claude plugin validate` passes on Claude Code 2.1.288 (0.1.0 did not: missing manifest description; `$` passed to non-top-level helpers).
- Live, Desktop Code tab, Claude Code 2.1.288: `/cp-handoff status`, `protect`, `checkpoint` (all four test details exact in the brief) and `now` (plugin-origin /clear ran, the resume prompt arrived, the fresh context read the brief and recalled the details) all worked once.
- Found and fixed by live testing: Claude Code rejects `$.command.run` called from inside a `command.run` hook (0.1.1: the clear is requested from a timer); a summarizer evidence label outside the fixed list aborted checkpoints (0.1.2: labels normalized, quotes still verified exactly, one retry).
- Not exercised live: threshold-triggered automatic reset (turn.step / turn.complete / session.compact), a correction typed right after `now`, background jobs/agents, chained handoffs, large histories.
