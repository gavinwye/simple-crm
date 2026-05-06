# gstack

For all web browsing, use the `/browse` skill from gstack. Never use `mcp__Claude_in_Chrome__*` tools directly.

Available gstack skills:
- `/office-hours` — Office hours
- `/plan-ceo-review` — CEO review planning
- `/plan-eng-review` — Engineering review planning
- `/plan-design-review` — Design review planning
- `/design-consultation` — Design consultation
- `/design-shotgun` — Design shotgun
- `/design-html` — Design to HTML
- `/review` — Code review
- `/ship` — Ship code
- `/land-and-deploy` — Land and deploy
- `/canary` — Canary deployment
- `/benchmark` — Benchmarking
- `/browse` — Web browsing (use this for all browsing)
- `/connect-chrome` — Connect Chrome browser
- `/qa` — QA testing
- `/qa-only` — QA only
- `/design-review` — Design review
- `/setup-browser-cookies` — Set up browser cookies
- `/setup-deploy` — Set up deployment
- `/setup-gbrain` — Set up gbrain
- `/retro` — Retrospective
- `/investigate` — Investigation
- `/document-release` — Document a release
- `/codex` — Codex
- `/cso` — CSO
- `/autoplan` — Auto-planning
- `/plan-devex-review` — DevEx review planning
- `/devex-review` — DevEx review
- `/careful` — Careful mode
- `/freeze` — Freeze
- `/guard` — Guard
- `/unfreeze` — Unfreeze
- `/gstack-upgrade` — Upgrade gstack
- `/learn` — Learn

Teammates: install gstack with `git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup`.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
