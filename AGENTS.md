# AGENTS Instructions

## Default Skill
Always use [$senior-fullstack-engineer](/Users/muhammad/.codex/skills/senior-fullstack-engineer/SKILL.md) for coding tasks in this project.

## Skill Routing Rules
Use [$senior-fullstack-engineer](/Users/muhammad/.codex/skills/senior-fullstack-engineer/SKILL.md) for feature work, refactors, architecture-safe implementation, and end-to-end integration tasks.

Use [$codebase-auditor](/Users/muhammad/.codex/skills/codebase-auditor/SKILL.md) when requests involve repository audit, architecture review, security review, maintainability review, or analysis before building.

Use [$bug-hunter](/Users/muhammad/.codex/skills/bug-hunter/SKILL.md) when requests involve bug fixing, crashes, stack traces, failing tests, unexpected behavior, race conditions, or root-cause analysis.

Use [$pdf](/Users/muhammad/.codex/skills/pdf/SKILL.md) only for PDF extraction, editing, generation, or layout checks.

Use [$openai-docs](/Users/muhammad/.codex/skills/.system/openai-docs/SKILL.md) only for OpenAI API and product documentation questions.

Use [$skill-creator](/Users/muhammad/.codex/skills/.system/skill-creator/SKILL.md) and [$skill-installer](/Users/muhammad/.codex/skills/.system/skill-installer/SKILL.md) only for creating or installing skills.

Use [$fitgpt-stack-engineer](/Users/muhammad/.codex/skills/fitgpt-stack-engineer/SKILL.md) for FastAPI plus Jetpack Compose end-to-end implementation, integration, and review tasks.

## Automation Maintenance Rules
When the task is recurring AGENTS maintenance, treat it as a documentation task grounded in recent evidence. Review the current conversation, the automation memory file, and the existing `AGENTS.md` before editing. If no memory file exists yet, create it after the run and note that this was the first baseline.

Prefer small instruction updates that address repeated friction, ambiguity, or avoidable misunderstandings. Do not rewrite unrelated sections or add speculative rules that are not supported by recent interactions.

For recurring automation runs, do not block on confirmation after the brief plan unless the required change is genuinely ambiguous or would alter project workflow in a broad way. Make the smallest safe improvement, then summarize what pattern was observed and why the new guidance should reduce future friction.

## Available Skills
- [$senior-fullstack-engineer](/Users/muhammad/.codex/skills/senior-fullstack-engineer/SKILL.md)
- [$codebase-auditor](/Users/muhammad/.codex/skills/codebase-auditor/SKILL.md)
- [$bug-hunter](/Users/muhammad/.codex/skills/bug-hunter/SKILL.md)
- [$pdf](/Users/muhammad/.codex/skills/pdf/SKILL.md)
- [$openai-docs](/Users/muhammad/.codex/skills/.system/openai-docs/SKILL.md)
- [$skill-creator](/Users/muhammad/.codex/skills/.system/skill-creator/SKILL.md)
- [$skill-installer](/Users/muhammad/.codex/skills/.system/skill-installer/SKILL.md)
- [$fitgpt-stack-engineer](/Users/muhammad/.codex/skills/fitgpt-stack-engineer/SKILL.md)
