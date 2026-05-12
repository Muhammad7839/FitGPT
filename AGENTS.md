# FitGPT Agent Guidance

This file captures collaboration rules that reduce repeated friction when working in this repository. It complements [`/Users/muhammad/AndroidStudioProjects/FitGPT/CLAUDE.md`](/Users/muhammad/AndroidStudioProjects/FitGPT/CLAUDE.md) rather than replacing it.

## Working Style

- Make the smallest change that fully solves the problem. Do not rewrite large sections unless the request explicitly asks for it.
- Explain the issue step by step when the task is debugging or behavior analysis. State the root cause first, then apply the narrowest fix.
- Treat production-readiness as the default. Favor correctness, maintainability, and clean boundaries over speed hacks.
- If the requested change could reasonably affect multiple layers or subsystems, call that out and confirm before editing unless the user clearly asked for an end-to-end implementation.

## Architecture Discipline

- Respect layer boundaries. Keep data access, API or network logic, business logic, state management, and UI concerns separated.
- Avoid moving logic across layers just to make a quick fix work. Prefer the layer that already owns the behavior.
- Preserve existing project patterns unless there is a concrete defect or the user asks for a structural change.

## Code Expectations

- Write code that looks like a careful human engineer wrote it: simple, direct, and easy to maintain.
- Do not leave placeholder code such as `TODO`, `implement later`, or fake stubs. If something cannot be completed, explain the blocker explicitly.
- For new source files, start with a brief purpose comment when that fits the language and file style. For edited files, add comments only when they clarify non-obvious intent.
- Keep comments concise and natural. Explain why the code exists or why a decision was made, not what each line already says.

## Change Control

- Before editing repo instruction files, check whether related guidance already exists so new rules do not conflict with established documentation.
- Prefer targeted edits over broad formatting churn or opportunistic cleanup.
- When a problem is localized to one file or one layer, keep the fix there unless there is a proven need to widen the scope.
- This repository currently does not define project-local Codex skills (`SKILL.md`). If a maintenance task asks to review or improve "skills in this project," treat [`/Users/muhammad/AndroidStudioProjects/FitGPT/AGENTS.md`](/Users/muhammad/AndroidStudioProjects/FitGPT/AGENTS.md) and [`/Users/muhammad/AndroidStudioProjects/FitGPT/CLAUDE.md`](/Users/muhammad/AndroidStudioProjects/FitGPT/CLAUDE.md) as the active skill surface unless a real skill directory is added.
- If a maintenance prompt mentions reviewing "all skills" or checking execution logs, verify that those artifacts actually exist before doing broader work. When they do not, treat the instruction docs as the only editable surface and use concrete repo evidence such as git history, nearby docs, and observable workflow friction instead of inventing missing logs or placeholder findings.
- When checking for repo-owned logs or maintenance artifacts, prune generated and dependency directories first, especially `.git`, `app/build`, `web/build`, `web/node_modules`, and `backend/.venv`. Do not treat files found only in those locations as project evidence that justifies broader skill changes.
- For recurring maintenance or automation runs whose explicit job is to update repo guidance, do not stop for plan confirmation or routine clarifying questions once the scope is clear. Read the existing instruction files and automation memory first, base the update on a concrete observed friction point, then make the smallest documentation-only change that resolves it.
- If a recurring maintenance run also inherits a generic instruction to pause for plan approval, treat the automation-specific rule above as the deliberate exception and continue once the documentation-only scope is clear.
- When an automation prompt provides a memory path through a shell variable such as `$CODEX_HOME`, verify that the variable is actually populated before using the expanded path. If it is unset, fall back to the canonical `~/.codex/automations/<automation_id>/memory.md` location instead of assuming the prompt path resolved correctly.

## Response Expectations

- Be explicit about assumptions, impact, and any unverified areas.
- If testing is limited or not run, say so plainly.
- When a task is blocked by ambiguity, ask the shortest clarifying question needed instead of guessing across architectural boundaries.
