# Eltropy Skill Builder

> Mission Control for Agentic AI on the Front Office.
> The authoring layer that turns the *App Store of banking* into reality.

The PRD lives in [`docs/PRD.md`](docs/PRD.md) (also as [`docs/PRD.pdf`](docs/PRD.pdf)).

## What this is

A working prototype of the five core surfaces of the Skill Builder application layer:

1. **Sub-agent Canvas** (`/sub-agents`) - list + detail. Each sub-agent has closed, controlled agency: a scope domain, a bound Skill allowlist, and a Guardrail Policy. The Main Orchestrator routes intents here.
2. **Skill Editor** (`/skills/[id]`) - two-pane Markdown SOP with **pill-rendered** tool calls. Inline lint flags out-of-scope Tools, undefined refs, missing required params. Out-of-scope Tools are dimmed in the palette so they cannot be summoned by typo.
3. **Tool Registry** (`/tools`) - typed API wrappers grouped by domain. Side-effect classification (read / write / **financial**). Financial Tools wear a persistent red badge.
4. **Test Harness** (`/test`) - paste a member transcript, run a shadow trace. Mocked Tool responses. Full audit trace. The author sees the guardrail act before publish.
5. **Publish & Versioning** (`/publish`) - lint gate, regression-set gate, Guardrail Policy diff, Compliance Reviewer approval gate. Published Skills are immutable.

Plus an RBAC role switcher in the sidebar (Eltropy FDPM / CU AI Lead / Fintech Partner / Compliance Reviewer).

## Grading metrics this build targets

- **Guardrails.** First-class objects. Five families: scope, tool, data, behavioural, audit. Every Skill carries a Guardrail Policy Diff in its version history.
- **Usability.** Time-to-first-published-Skill target: under 30 minutes for a CU AI Lead with Postman-level fluency.
- **Affordance** (Don Norman sense, not "ease of use"). Bounded chip-pickers for scope, pill-rendered tool calls, persistent financial-side-effect badge, dimmed out-of-scope Tools, inline "why blocked?" lint with line numbers.

## Stack

- Next.js 16 (App Router, Turbopack)
- React 19.2
- Tailwind CSS v4
- TypeScript 5
- In-memory seed data (no DB needed for the prototype). Production design lives in the PRD.

## Run it

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## File map

```
app/
├── layout.tsx              # AppShell wrap
├── page.tsx                # Overview / stats / quick-start
├── sub-agents/
│   ├── page.tsx            # Surface 1 - canvas
│   └── [id]/page.tsx       # detail
├── skills/
│   ├── page.tsx            # registry
│   └── [id]/page.tsx       # Surface 2 - editor host
├── tools/page.tsx          # Surface 3 - registry
├── test/page.tsx           # Surface 4 - harness
└── publish/page.tsx        # Surface 5 - publish flow

components/
├── AppShell.tsx            # sidebar nav + RBAC switcher
├── SkillEditor.tsx         # the moneyshot - editor + preview + palette
├── ToolCallPill.tsx        # pill-rendered {{tool: …}} call
└── TestHarness.tsx         # transcript input + traced execution

lib/
├── types.ts                # Tool / Skill / SubAgent / GuardrailSet / AuditEvent
├── seed.ts                 # Authentication + Account Services + Loan Servicing reference
├── parser.ts               # parse + lint the curly-brace tool-call syntax
└── trace.ts                # mock orchestrator -> sub-agent -> skill -> tool chain

docs/
├── PRD.md
└── PRD.pdf
```

## Key conventions

**Tool call syntax** (Claude-skills style, Saahil's specification):

```text
1. Authenticate the member: {{tool: authenticate_member(member_id=$member.id, channel=$channel)}}
2. If auth fails: {{handback: orchestrator}}
3. Otherwise: {{tool: get_loan_status(loan_id=$loan.id)}}
```

**Composition contract:**

```
Sub-agent ::= role + intent-routing + skill bundle + guardrail policy
Skill     ::= Markdown SOP + tool calls
Tool      ::= named, schema-typed wrapper over one API
```

**Closed, controlled agency:** a sub-agent can only invoke Skills on its allowlist, and Skills can only invoke Tools allowed within the sub-agent's scope. The Skill Editor blocks out-of-scope Tool references at author time.

## What is intentionally out of scope (v1)

- The runtime harness execution engine (lives in the AI Engineering team's domain).
- Real DB persistence (in-memory seed for the prototype).
- Real authentication, real RBAC enforcement (the role switcher is a UI demo).
- Billing / revenue-share infrastructure (the economic model itself is the strategic alignment ask in PRD §9).
- Voice-channel authoring patterns (TTS, barge-in).

## License

Demonstration prototype - not licensed for redistribution.
