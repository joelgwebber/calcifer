---
name: self-customize
description: Customize your own agent — add capabilities, install packages, add MCP servers, edit code or CLAUDE.md. Use when the user asks you to add a feature, install a tool, or modify how you work. For non-trivial code changes, delegate to a builder agent via create_agent.
---

# Self-Customization

You can modify your own environment. Different kinds of changes have different workflows.

## Decision Tree

**What needs to change?**

- **Memory or standing instructions** → Edit `memory/` or `instructions.prepend.md` directly, no approval needed. The workspace is persisted on the host. The composed provider document (`CLAUDE.md` or `AGENTS.md`) is regenerated every spawn and must not be edited.
- **System package (apt) or global npm package** → `install_packages`. Requires admin approval. On approval, image rebuild + container restart happen automatically.
- **MCP server** → `add_mcp_server`. Requires admin approval. On approval, container restarts with the new server wired up (no rebuild — bun runs TS directly).
- **Your source code, a new bundled skill, or the Dockerfile** → If your container has the project repo mounted **read-write** (owner agents do — see "Growing a New Skill" for how to tell), edit it there and commit. Otherwise delegate to a builder agent via `create_agent` (see below).
- **A new specialist capability** → `create_agent` to spin up a dedicated agent for it.

## Workflow: Code Changes via Builder Agent

For anything that requires editing source files (your own code, Dockerfile, etc.), **do not edit directly** — delegate to a builder agent. This gives the user a reviewable boundary and keeps your main session focused.

1. Describe what you need changed in concrete terms (files, behavior, acceptance criteria)
2. Call `create_agent({ name: "Builder", instructions: "<builder prompt>" })` — the returned agent group ID is your builder
3. Call `send_to_agent({ agentGroupId, text: "<task description with specific files and changes>" })`
4. The builder works in its own container, makes the changes, and reports back
5. You review the builder's summary and confirm with the user. Source-code edits inside `/app/src` are picked up automatically on the next container start — no rebuild step needed (bun runs TS directly). If the builder also installed packages, its own `install_packages` approval will have rebuilt the image.

### Builder Agent Instructions (use as CLAUDE.md when creating)

```
You are a builder agent. Your job is to make precise, minimal code changes to NanoClaw source files when the main agent requests it.

## Rules

- **Minimal scope.** Only change what was requested. Do not refactor surrounding code, "improve" unrelated files, or add features not asked for.
- **Diff size limits.** Reject any change that exceeds 200 new lines or 150 modified lines in a single task. If the change is larger, push back and ask for it to be split into smaller tasks.
- **Read before writing.** Always read the target file fully before editing. Understand the existing patterns.
- **Test if possible.** If there are relevant tests, run them after your change.
- **Report back.** When done, use send_to_agent to tell the requesting agent: (a) what files you changed, (b) a summary of the changes, (c) any follow-up needed (rebuild, tests, migrations).
- **No silent failures.** If you can't complete the task, explain why — don't produce partial work without flagging it.

## Safety

- Never edit files outside the requested scope
- Never commit or push anything
- Never modify secrets, credentials, or .env files
- If a change would break existing tests, stop and report
```

## Diff Size Limits — Why

A 50-line focused change is reviewable. A 500-line sweep is not. Hard limits force the agent to decompose work into reviewable chunks, which:

- Makes human approval meaningful (you can actually read 150 lines)
- Catches runaway edits early (if the first task hits the limit, the scope was wrong)
- Forces clear acceptance criteria per task

The limits are **per builder task**, not per session. A 500-line feature is fine as 4 sequential builder tasks of ~125 lines each, each with its own scope.

## Example: Adding a New MCP Tool to Yourself

User: "Can you add a tool for reading RSS feeds?"

1. Check [mcp.so](https://mcp.so) for an existing RSS MCP server
2. If one exists → `add_mcp_server({ name: "rss", command: "npx", args: ["some-rss-mcp"] })` → admin approves → container restarts with the new server → done
3. If nothing suitable exists → delegate to a builder agent:
   - `create_agent({ name: "RSS Tool Builder", instructions: "<builder prompt from above>" })`
   - `send_to_agent({ agentGroupId, text: "Add an MCP tool 'read_rss' to container/agent-runner/src/mcp-tools/. It should fetch an RSS URL and return the latest N items. Register it in mcp-tools/index.ts. Target: <200 new lines." })`
   - Wait for builder's report — new tool code is picked up on the next container start (bun runs TS directly)

## Example: Installing a System Tool

User: "Can you transcribe audio?"

1. Check what's available — `which ffmpeg` (likely not installed in base image)
2. Decide approach: `@xenova/transformers` (npm, workspace-local) or `whisper.cpp` (apt + compile)
3. For persistent system tool: `install_packages({ apt: ["ffmpeg"], npm: ["@xenova/transformers"], reason: "Audio transcription for voice messages" })`
4. Wait for admin approval — on approve, the image is rebuilt and your container is restarted automatically
5. Test the new capability once the container restarts

## When NOT to Self-Customize

- **The change is for a one-off task** — just do it in your workspace, don't modify the container
- **The request is ambiguous** — ask the user what they actually need before spinning up builders or requesting installs
- **You don't know if it will work** — prototype in your workspace first (`pnpm install` in `/workspace/agent/`), then promote to container-level install if it proves useful

## Growing a New Skill (idea → play → real, tracked skill)

A capability you build yourself has a natural lifecycle. Ride it deliberately — and
track the moment it stops being a toy.

**The trap to avoid:** writing a `SKILL.md` under `container/skills/<name>/` that merely
*documents* code which only exists in your gitignored workspace (`groups/*`). That ships
a doc with no body — nobody else can install it, and the code is one `rm` away from gone.

### The glide-path

1. **Play.** Prototype freely in your workspace (`/workspace/agent/<name>/`). No yak
   needed — this is throwaway exploration, and it's where live runtime state (config, DB,
   `node_modules`) belongs for good. `pnpm install` here; iterate until it works.

2. **Decide it's real.** The moment you want it to persist, be reliable, or be reusable,
   stop and open tracking **before** writing promoted code. Per the yaks workflow you may
   not write "real" code without a shaving yak. Create a yak — or a small herd (a parent
   feature yak + child tasks for the pieces: scaffold, each source/integration, alerts,
   scheduling). Shave the one you're starting. Park future ideas/extensions as additional
   hairy yaks so they're tracked instead of lost; slaughter ideas you've decided against.

3. **Promote** the code out of the gitignored workspace into a **version-controlled,
   self-contained** skill at `container/skills/<name>/`. Two routes for the actual edit:
   - **Direct (owner agents):** if the project repo is mounted read-write in your
     container, edit it there and you own the whole loop. Check `/workspace/extra/` for a
     writable checkout (your `CLAUDE.local.md` names the exact path, e.g.
     `/workspace/extra/<project>`). This is the same tree your yaks CLI already runs in.
   - **Builder agent:** if you have no writable repo mount, delegate to a builder agent
     via `create_agent` (see above) with the prototype path + the checklist below as
     acceptance criteria.

   Leave the running workspace prototype in place so you don't disrupt a live deployment;
   repoint any schedule at the skill copy once it's verified.

4. **Commit + push.** Stage the new skill files **together with the shorn yak** that
   tracked the work and commit them in one commit (yaks norm: the shear and the code land
   together), then push. Keep the commit scoped: do not sweep in unrelated working-tree
   changes, `node_modules`, or installation-specific files (`groups/*`, local configs,
   `.claude/settings.json`).

5. **Iterate.** Further work — a new source, a bug fix, hardening — is new yaks under the
   herd, each shaved before you touch code and shorn + committed when done.

### A promoted skill is self-contained — checklist

- [ ] **Code lives in the skill dir** (`container/skills/<name>/`), not only in the workspace. The skill mount is **read-only** at `/app/skills/<name>`; runnable code is fine there, writes are not.
- [ ] **No hardcoded group/workspace paths in code.** Resolve a writable data dir from an env var with a sensible default (e.g. `process.env.MY_DIR ?? '/workspace/agent/<name>'`). Writable state (config, DB, `node_modules`, caches) lives in that data dir — never in the RO skill mount.
- [ ] **Behaviour is config-driven, not user-specific.** No one person's neighbourhoods/IDs/accounts baked into the code; read them from a `config.json` and ship a `config.example.json`.
- [ ] **Dependencies are declared** (a `package.json` in the skill) and installed into the data dir during a documented one-time setup step — not committed `node_modules`.
- [ ] **No live runtime identifiers in docs.** Don't hardcode a scheduled-task ID or session ID in `SKILL.md`; they're created at registration time and go stale. Tell the reader how to look them up.
- [ ] **No dead code.** If you inlined something, delete the abandoned module.
