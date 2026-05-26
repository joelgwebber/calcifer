---
id: calcifer-2e0a
title: Background project agents with Calcifer-mediated HITL
type: feature
priority: 2
created: '2026-03-02T05:17:29Z'
updated: '2026-05-26T03:34:24Z'
---

Design a secure workflow that allows restricted agents to perform research and development work, then propose changes to a privileged agent for vetting and user approval before integration into core codebase.

PROBLEM:
Currently agents have either:
- Read-only access to /workspace/project (can read code but not modify)
- Read-write access to /workspace/group (can modify but changes don't affect running system)

This creates a gap for development workflows where we want agents to:
1. Research and prototype solutions
2. Write working code
3. Have changes reviewed and vetted
4. Get integrated into core after approval

PROPOSED SOLUTION: R&D Agent Workflow

ROLES:
1. Research Agent (restricted) - Can read core, write to workspace
2. Privileged Agent (elevated) - Can review proposals and modify core
3. User - Final approval authority

WORKFLOW PHASES:

Phase 1: Research & Prototype (Research Agent)
- Agent reads /workspace/project/src (read-only)
- Agent researches solutions (web search, documentation)
- Agent writes prototype to /workspace/group/proposals/PROPOSAL_ID/
- Agent creates proposal manifest with metadata
- Agent notifies privileged agent via IPC

Phase 2: Review & Vet (Privileged Agent)
- Privileged agent receives proposal notification
- Reviews code in /workspace/group/proposals/PROPOSAL_ID/
- Runs security checks (file access patterns, network calls, credentials)
- Tests in isolated environment
- Generates review report with approval/rejection/questions

Phase 3: User Approval
- User reviews proposal summary and privileged agent's assessment
- User can ask questions, request changes, or approve
- If approved, privileged agent integrates changes

Phase 4: Integration (Privileged Agent)
- Copy approved files to /workspace/project/src/
- Update configurations
- Run tests
- Create commit with co-authorship attribution

SECURITY CONSIDERATIONS:

Isolation:
- Research agent never writes to core directly
- All proposals in isolated workspace directory
- Privileged agent reviews before any core modifications

Vetting Checklist:
- Does code access sensitive files? (.env, credentials, tokens)
- Does code make network calls? (document endpoints)
- Does code execute shell commands? (audit for injection)
- Does code modify existing behavior unexpectedly?
- Are dependencies safe and necessary?
- Is error handling appropriate?
- Are secrets properly managed?

Trust Boundaries:
- Research Agent: Untrusted, sandboxed, read-only core access
- Privileged Agent: Trusted, can modify core, enforces security policy
- User: Ultimate authority, approves all core changes

Audit Trail:
- All proposals logged with timestamps
- Review decisions recorded
- Integration commits tagged with proposal ID
- Research agent and privileged agent both credited

IMPLEMENTATION REQUIREMENTS:

1. Proposal System:
   - /workspace/group/proposals/ directory structure
   - Proposal manifest format (YAML or JSON)
   - Unique proposal IDs
   - Status tracking (draft, submitted, under_review, approved, rejected, integrated)

2. IPC Communication:
   - Research agent → Privileged agent: submit_proposal
   - Privileged agent → User: request_approval
   - User → Privileged agent: approve/reject/request_changes
   - Privileged agent → Research agent: feedback

3. Privileged Agent Capabilities:
   - Read/write access to /workspace/project/src/
   - Can run tests and builds
   - Can create git commits
   - Can install dependencies
   - Can modify configuration files

4. Research Agent Constraints:
   - Read-only /workspace/project/ access
   - Read-write /workspace/group/ access
   - Cannot directly trigger builds or deploys
   - Cannot modify running system
   - Cannot access user credentials directly

5. Review Tools:
   - Static analysis for security issues
   - Dependency vulnerability scanning
   - Code diff visualization
   - Test execution in sandbox
   - Documentation generation

EXAMPLE WORKFLOW:

User: "Add Twilio WhatsApp support"
↓
Research Agent:
- Researches Twilio WhatsApp API
- Reads current WhatsApp implementation
- Creates prototype in /workspace/group/proposals/twilio-whatsapp-001/
- Writes manifest describing changes needed
- Submits proposal via IPC
↓
Privileged Agent:
- Receives proposal notification
- Reviews code in proposal directory
- Checks security: webhook signature validation ✓, no credential leaks ✓
- Tests prototype (if possible)
- Generates review: APPROVED with minor suggestions
- Requests user approval with summary
↓
User:
- Reviews summary: "Add official Twilio WhatsApp API support, ~500 lines, webhook server, requires TWILIO_* env vars"
- Checks privileged agent's security assessment
- Approves: "Yes, proceed with integration"
↓
Privileged Agent:
- Copies files from proposal to src/channels/
- Updates src/index.ts with channel selection
- Adds dependencies to package.json
- Creates commit: "Add Twilio WhatsApp channel\n\nCo-authored-by: Research Agent\nProposal: twilio-whatsapp-001"
- Notifies user: Integration complete
↓
User: Rebuilds and deploys

BENEFITS:

1. Security: Changes vetted before touching core
2. Efficiency: Research agent can prototype freely
3. Accountability: Clear audit trail and attribution
4. Collaboration: Multiple agents can work on proposals
5. Iteration: Easy to request changes and revise
6. Learning: Research agent learns from privileged agent feedback

OPEN QUESTIONS:

1. How to spawn privileged agent securely?
   - Separate container with elevated permissions?
   - User-triggered via explicit command?
   - Scheduled review process?

2. What level of automation for integration?
   - Full automation after user approval?
   - Semi-automated with user confirmation for each step?
   - Manual integration with privileged agent guidance?

3. How to handle proposal revisions?
   - New proposal ID or version number?
   - Preserve revision history?
   - How to reference previous feedback?

4. Multi-agent collaboration on proposals?
   - Can multiple research agents contribute?
   - How to coordinate and merge contributions?
   - Conflict resolution process?

5. Testing and validation?
   - What tests can research agent run?
   - What tests require privileged agent?
   - Integration test requirements?

SUCCESS CRITERIA:

- Research agent can propose code changes safely
- Privileged agent can vet proposals with security checks
- User has clear visibility into proposed changes
- Integration process is auditable
- No unauthorized core modifications possible
- Workflow is efficient and practical

---
▸ 2026-04-22T02:56:34Z
Also consider just trying out Langchain's OpenSWE

---
▸ 2026-04-23T18:38:46Z
Design finalized. Key decisions:

ARCHITECTURE:
- Project agents run in existing NanoClaw containers (new mount profile)
- /workspace/task/ = fresh git clone of target repo (named Docker volume for persistence)
- /workspace/context/ = injected task manifest + CLAUDE.md supplement
- Container provides blast radius for --dangerously-skip-permissions
- claude CLI runs headless (-p) with broad tool permissions

HUMAN-IN-THE-LOOP:
- ask_human MCP server runs as sidecar inside container
- Tool signature: ask_human(question, context, screenshot?) -> string
- Writes pending_question to SQLite, sends Calcifer message to initiating JID, polls for reply
- Calcifer reply router: if incoming message matches pending_question, write answer and unblock
- No new communication infrastructure needed -- reuses existing channel routing

TASK LIFECYCLE:
- New project_tasks SQLite table: id, project, yak_id, status, container_id, initiated_by_jid, started_at, result_branch
- States: queued -> running -> blocked -> running -> done/failed
- Triggered via Calcifer chat ('work on gnusto yak gnusto-3a2f')

PROJECT CONFIGURATION:
- projects/{name}/config.yaml: repo URL, runtime (python/node/rust), clone_flags, submodule_depth, test_cmd
- projects/{name}/CLAUDE.md: Calcifer supplement (how to use ask_human, push conventions, yaks workflow)
- Project's own repo CLAUDE.md is injected from clone -- both are active
- .mcp.json and .claude/ in project repo picked up automatically by claude CLI (path-based discovery)

CONTAINER MATRIX:
- runtime field in config.yaml selects container image
- python image: python 3.11+, uv, yak CLI
- node image: node 20+, npm, yak CLI
- All images: git, yak CLI, ask_human MCP server

ISSUE TRACKING:
- Yaks used universally across all personal projects
- Yak CLI available in all container images
- Agent shaves/shorns yaks as it works

OUTPUT:
- Agent pushes a branch, Calcifer notifies with branch name
- Optional: open GitHub PR via gh CLI

FIRST BUILD SLICE: ask_human MCP server (~100 lines) + pending_questions SQLite table + Calcifer reply routing patch (~30 lines). Everything else wires up around this.

---
▸ 2026-05-04T02:11:56Z
Design evolution: per-yak git worktrees + long-running containers.

After building out single-run project agents, the iterative workflow exposed a gap: serial yaks on the same project work fine, but 'putting a yak on ice' while working on others is effectively concurrent — and a single shared workspace cannot handle that.

REVISED ARCHITECTURE:

Filesystem layout:
  data/projects/{name}/
    config.yaml              # unchanged
    repo/                    # main git clone (replaces workspace/)
    worktrees/{yakId}/       # git worktree per active yak, branch yak-{yakId}
    sessions/{yakId}/.claude # per-yak Claude SDK state (was shared)
    context/                 # unchanged
    ipc/                     # unchanged
    logs/                    # unchanged

Migration: if workspace/ exists and repo/ does not, treat workspace/ as repo/.

Container identity: nanoclaw-project-{name}-{yakId} (stable, not timestamp-based).
Container mode: long-running detached (-d), not one-shot stdin.
IPC: Calcifer writes JSON to /workspace/ipc/input/; container polls.
Session continuity: sessionId persisted per yak; each turn resumes prior context.

Implementation breakdown:
  2e0a.13 -- worktree-manager.ts + container-per-yak refactor (foundational)
  2e0a.14 -- poll-loop / multi-turn IPC in project-index.ts (interactive behavior)
  2e0a.11 -- create/delete/list now depends on 2e0a.13 (create clones repo, delete prunes worktrees)
