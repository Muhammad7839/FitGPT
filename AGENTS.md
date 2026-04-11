# AGENTS Instructions

## Default Skill
Default to [$senior-fullstack-engineer](/Users/muhammad/.codex/skills/senior-fullstack-engineer/SKILL.md) only when no narrower route below matches.

## Skill Routing Rules
For plain-language requests without an explicit `$skill`, select exactly one closest-match skill, pass the user intent directly to that skill, and do not chain skills.

- git / branch / repo / status / sync -> [$git-preflight](/Users/muhammad/.codex/skills/git-preflight/SKILL.md)
- bug / error / crash / failing / not working / fix -> [$bug-hunter](/Users/muhammad/.codex/skills/bug-hunter/SKILL.md)
- audit / review / architecture / structure / security / maintainability -> [$codebase-auditor](/Users/muhammad/.codex/skills/codebase-auditor/SKILL.md)
- feature / backend / android / API implementation / integration -> [$fitgpt-stack-engineer](/Users/muhammad/.codex/skills/fitgpt-stack-engineer/SKILL.md)
- production / deploy / release / final hardening -> [$senior-fullstack-engineer](/Users/muhammad/.codex/skills/senior-fullstack-engineer/SKILL.md)

If intent is unclear, choose the single closest match. Do not load multiple skills.

Use [$pdf](/Users/muhammad/.codex/skills/pdf/SKILL.md) only for PDF extraction, editing, generation, or layout checks.

Use [$openai-docs](/Users/muhammad/.codex/skills/.system/openai-docs/SKILL.md) only for OpenAI API and product documentation questions.

Use [$skill-creator](/Users/muhammad/.codex/skills/.system/skill-creator/SKILL.md) and [$skill-installer](/Users/muhammad/.codex/skills/.system/skill-installer/SKILL.md) only for creating or installing skills.

Do not use [$fitgpt-dev-orchestrator](/Users/muhammad/.codex/skills/fitgpt-dev-orchestrator/SKILL.md) unless the user explicitly asks for orchestration or FitGPT session triage.

## Automation Maintenance Rules
When the task is recurring AGENTS maintenance, treat it as a documentation task grounded in recent evidence. Review the current conversation, the automation memory file, and the existing `AGENTS.md` before editing. If no memory file exists yet, create it after the run and note that this was the first baseline.

Prefer small instruction updates that address repeated friction, ambiguity, or avoidable misunderstandings. Do not rewrite unrelated sections or add speculative rules that are not supported by recent interactions.

For this recurring maintenance workflow, the automation-specific rule to make the smallest safe improvement without blocking takes precedence over the general non-trivial-task rule to wait for confirmation. If the recent evidence is too thin to support a real instruction change, leave `AGENTS.md` unchanged and only record the baseline in memory.

When reviewing shared skills, treat `$CODEX_HOME/skill-logs/` as the current execution log location. Resolve `$CODEX_HOME` first and fall back to `~/.codex` if the variable is unset in the shell session. Check for both ``Current status: `failure``` and ``Current status: `started``` entries before concluding a workflow is healthy, because the log format wraps statuses in backticks and lingering `started` entries indicate incomplete runs. When searching those lines from a shell, use a shell-safe quoted pattern such as `rg 'Current status: `started`|Current status: `failure`' "$LOG_ROOT" -g '*.md'` so backticks are not executed by the shell. Treat old `started` entries that never gain a matching `Finished` line as stale incomplete runs, not healthy completions. Capture the exact action names from stale or failed logs in memory, and if a later run finds the same cluster with no newer failures, avoid speculative skill edits and only record the unchanged evidence. If the relevant skill files live outside writable roots for the current automation run, do not force broader changes; record the concrete evidence, the blocked file paths, and the exact recommended patch in memory so the next writable run can apply it directly.

For recurring automation runs, do not block on confirmation after the brief plan unless the required change is genuinely ambiguous or would alter project workflow in a broad way. Make the smallest safe improvement, then summarize what pattern was observed and why the new guidance should reduce future friction.

## Available Skills
- [$senior-fullstack-engineer](/Users/muhammad/.codex/skills/senior-fullstack-engineer/SKILL.md)
- [$git-preflight](/Users/muhammad/.codex/skills/git-preflight/SKILL.md)
- [$codebase-auditor](/Users/muhammad/.codex/skills/codebase-auditor/SKILL.md)
- [$bug-hunter](/Users/muhammad/.codex/skills/bug-hunter/SKILL.md)
- [$pdf](/Users/muhammad/.codex/skills/pdf/SKILL.md)
- [$openai-docs](/Users/muhammad/.codex/skills/.system/openai-docs/SKILL.md)
- [$skill-creator](/Users/muhammad/.codex/skills/.system/skill-creator/SKILL.md)
- [$skill-installer](/Users/muhammad/.codex/skills/.system/skill-installer/SKILL.md)
- [$fitgpt-stack-engineer](/Users/muhammad/.codex/skills/fitgpt-stack-engineer/SKILL.md)
- [$fitgpt-dev-orchestrator](/Users/muhammad/.codex/skills/fitgpt-dev-orchestrator/SKILL.md)
