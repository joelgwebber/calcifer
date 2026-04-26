---
name: projects
description: Workflow guide for managing background project agents — building, serving, and iterating on software projects via start_project, serve_project, stop_serve, and serve_status MCP tools.
---

# Project Agent Workflow

Background project agents let you run software tasks asynchronously in isolated containers. The agent clones the repo, does the work, commits results, and sends a summary when done. A separate serve container can expose the output in a browser.

## Discovering configured projects

Read project configs to know what's available:

```bash
ls /workspace/extra/projects/
cat /workspace/extra/projects/*/config.yaml
```

Key fields: `name`, `runtime`, `serve_cmd`, `serve_port`. If `serve_cmd` is set, the project can be served after a build.

## Build → Serve → Iterate lifecycle

### 1. Start a build

```
mcp__nanoclaw__start_project(project_name, prompt?, yak_id?)
```

Returns immediately. The summary arrives as a follow-up message when the agent finishes (may take several minutes). Do not poll — just wait.

### 2. After build completes

When the completion message arrives:
- If the project has `serve_cmd` configured (or the user asks to see the result), call `serve_project`.
- If a serve is already running, stop it first with `stop_serve`, then `serve_project`.

```
mcp__nanoclaw__stop_serve(project_name)     # if already serving
mcp__nanoclaw__serve_project(project_name)  # start serve container
```

The host replies with the URL (e.g., `http://hearth:8100`). Pass it to the user.

### 3. Iterating (build again, refresh serve)

When the user asks for another change after a serve is already running:

```
mcp__nanoclaw__start_project(project_name, prompt)
# wait for completion message, then:
mcp__nanoclaw__restart_serve(project_name)
```

`restart_serve` stops any running serve and starts a fresh one atomically. Use `stop_serve` + `serve_project` only if you need to pass different `serve_cmd`/`serve_port` arguments.

### 4. Checking status

```
mcp__nanoclaw__project_status(project_name)  # is a build running?
mcp__nanoclaw__serve_status(project_name)    # is it serving, and at what URL?
```

## Serve config resolution

`serve_project` resolves the command in this order:
1. Explicit `serve_cmd`/`serve_port` args passed to the tool
2. `serve.json` in the workspace root (written by the build agent)
3. `serve_cmd`/`serve_port` in the project's `config.yaml`

If none are found, serve_project will tell you what's missing.

## Telling build agents to produce serve.json

When you start a build that should be serveable (e.g., "build a web UI"), include this in the prompt:

> If you produce something that can be served, write a `serve.json` to the workspace root with `{"serve_cmd": "...", "serve_port": N}` so it can be started automatically.

## Project task tracking

Three task systems exist — don't confuse them:

| System | What it is | When you use it |
|--------|-----------|-----------------|
| `schedule_task` / `list_tasks` | Time-based scheduler for Calcifer's own reminders and recurring actions | Scheduling things for yourself |
| `yak` skill | Task tracking discipline for agents working *inside* a project repo. Only active when `.yaks/` is in the workspace. | You never invoke this — build agents do |
| `yak_project` tool | Your window into a project's `.yaks/` tracker from the outside | Any time the user asks about project tasks |

Each project has its own task tracker in `.yaks/` within the cloned repo. Use `yak_project` to read and manage tasks from Calcifer's side.

### Your role

You are the **external observer**: read task state, add tasks from user requests, add notes, and check that the build agent is tracking its work. You don't shave or shorn project tasks — the build agent owns that.

### Common operations

```
# List open tasks
yak_project(project_name="hello-world", args=["list"])

# View a task
yak_project(project_name="hello-world", args=["show", "hello-world-abc1"])

# Add a task from a user request
yak_project(project_name="hello-world", args=["create", "--title", "Add dark mode", "--type", "feature", "--priority", "2", "--description", "..."])

# Add a progress note
yak_project(project_name="hello-world", args=["update", "hello-world-abc1", "--note", "Checking progress..."])

# Initialize (run once when setting up a new project)
yak_project(project_name="hello-world", args=["init"])
```

### Initializing a new project

When a project is first set up, run `yak_project init` after the first build completes (so the workspace is cloned). The `.yaks/` directory will be created in the workspace root and committed to the project repo by the build agent.

### Passing tasks to the build agent

When starting a build for a specific task, look up the task ID first, then pass it:

```
yak_project(project_name="hello-world", args=["list"])
# → find task ID, e.g. hello-world-abc1
start_project(project_name="hello-world", yak_id="hello-world-abc1")
```

The build agent looks up the task, shaves it, does the work, and shawns it when done.

## GitHub workflow

### Choosing a strategy

Before starting a build, read the user's request and decide:

- **Direct commit** — small fix, typo, single-file change: commit to the default branch, push, done
- **Branch + PR** — new feature, significant change, anything the user might want to review: branch, commit, push, open a PR, report the URL

If intent is ambiguous, ask before starting the build. Don't guess on ambiguous cases; the cost of an unwanted PR is low, but the cost of a direct commit the user wanted to review is higher.

### Branch + PR steps (in the build agent)

The build agent has `gh` CLI pre-installed and `GITHUB_TOKEN` for push access.

1. `git checkout -b <descriptive-branch>` (e.g. `feat/dark-mode`)
2. Do the work, commit
3. `git push -u origin <branch>`
4. `gh pr create --title "..." --body "what changed and why"`
5. `mcp__nanoclaw__send_message(text="PR opened: <url>")` — send URL to user

### Iterating on a PR

When the user requests changes after a PR is open, start a new build. The workspace persists, so the build agent will find itself on the feature branch. It should:

1. Check current branch: `git branch --show-current`
2. Check for open PRs: `gh pr list --state open`
3. Make changes, commit, push — PR updates automatically
4. When user says "looks good" or "merge it": `gh pr merge --squash`

### Web UI: visual verification with subtext

When the change involves a web UI (HTML, CSS, JS frontend, any visual component):

1. After building, start the dev server locally (e.g. `npm start &`)
2. Use subtext tunnel to connect: `/subtext-visual-verification`
3. Capture a screenshot or session recording
4. Include the subtext link in the PR body (`gh pr edit --body "..."`) or completion message

If `SUBTEXT_API_KEY` is not set, describe the visual changes in the completion message instead.

## Behavioral guidance

- **Proactively offer to serve** after a successful build if the project has `serve_cmd` configured or the user's intent was to see a result.
- **Don't start a build if one is already running** — check `project_status` first if unsure.
- **Pass the URL to the user directly** — don't make them ask for it.
- **One serve container per project** — stop the old one before starting a new one.
- **Builds are one-shot** — the build agent exits when done. There is no way to resume it or send it follow-up messages. Start a new build for each change.
