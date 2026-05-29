# Vulcan OmniPro 220 Copilot

A multimodal reasoning agent for the [Vulcan OmniPro 220](https://www.harborfreight.com/omnipro-220-industrial-multiprocess-welder-with-120240v-input-57812.html) multiprocess welder, built on the **Anthropic Claude Agent SDK**. Ask it anything about setting up or troubleshooting the machine. It answers in plain English, **shows the real manual diagram**, **cites the exact page**, and renders **interactive artifacts** — a duty-cycle calculator, polarity diagrams, a troubleshooting guide, and a process selector.

<img src="product.webp" alt="Vulcan OmniPro 220" width="380" /> <img src="product-inside.webp" alt="inside panel" width="380" />

> Built for the Prox Founding Engineer Challenge. The original brief is in [CHALLENGE.md](./CHALLENGE.md).

## Run it in under 2 minutes

```bash
git clone <this-fork>
cd vulcan-omnipro-copilot
cp .env.example .env        # paste your ANTHROPIC_API_KEY
bun install                 # ~30s, single TypeScript stack
bun run dev                 # open http://localhost:3000
```

That's it. No PDF processing, no Python, no database — the manual is already extracted and committed.

Try these:
- *"What polarity setup do I need for flux-cored welding? Which socket does the ground clamp go in?"*
- *"What's the duty cycle for MIG welding at 200A on 240V?"* — then **drag the amperage slider** and watch the matching cell highlight on the real spec page.
- *"I'm getting porosity in my flux-cored welds. What should I check?"*
- *"I want to weld 1/4 inch steel but I don't have shielding gas. Which process should I use?"*

## How it works

```
 ┌─────────────────┐   one-time, offline   ┌──────────────────────────┐
 │  3 manual PDFs  │ ───────────────────▶  │  data/manifest.json      │  committed
 │  (48pp + 2)     │   PyMuPDF (uv)        │  public/manual/*.png     │  to the repo
 └─────────────────┘                       └──────────────────────────┘
                                                       │  read at runtime (no PDF parsing)
                                                       ▼
        browser  ◀──NDJSON stream──  Next.js route  ◀──  Claude Agent SDK loop
       (curated React               (text deltas +        + in-process MCP tools
        components)                  tool results)         (retrieval + artifacts)
```

**The agent** (`src/agent`) runs the Claude Agent SDK `query()` loop with a custom in-process MCP server. Its tools fall in two groups:
- **Retrieval** — `search_manual`, `get_figure`, `get_page_image`. These read the committed manifest and return the real manual text/images.
- **Artifacts** — `render_polarity_diagram`, `render_duty_cycle_calculator`, `render_troubleshooting_tree`, `render_settings_configurator`. These return *structured props*; the browser renders each with a matching curated React component.

**The streaming route** (`src/app/api/chat/route.ts`) forwards the agent's text deltas and tool results to the browser as NDJSON. The client (`src/components/Chat.tsx`) maps each tool result to its component via a registry (`ArtifactRenderer`).

## Design decisions

**No vector RAG — deterministic named retrieval instead.** The corpus is a fixed ~50 pages. A vector store would add a *retrieval-miss* failure mode on exactly the cross-reference questions reviewers test. Instead, every figure and table is extracted once into `manifest.json` with a stable id, and the agent retrieves by id. The full figure catalog is injected into the system prompt, so the model picks the right source deterministically. Result: **5/5 on the hard sample questions** (see `bun run verify`).

**Knowledge extraction is exhaustive and committed.** The owner's manual uses CID-keyed fonts (a naive text scrape returns garbage), so extraction runs through PyMuPDF, which resolves the font CMaps and gives clean text + bounding boxes. Critical data that lives *only* in images — the welding selection chart, the polarity diagrams, the duty-cycle matrix — is transcribed into structured JSON and the source regions are cropped to PNGs. All of it is committed, so the reviewer never runs a slow build.

**Curated components, not model-authored HTML.** Artifacts are pre-built React components the agent invokes as tools with validated props. This trades a little "generate-anything" magic for total reliability: every artifact is polished and every number in it is copied from the manual, never invented. Questions with no matching component fall back to grounded text + citation — never broken HTML.

**Grounding is enforced, not hoped for.** The system prompt forbids stating any spec without first retrieving it, and forbids adding values beyond what the tools return. When the manual doesn't cover something (e.g. TIG/Stick polarity, which it genuinely omits), the agent says so instead of guessing. The duty-cycle calculator snaps to documented amperages and labels anything in between as "between documented values."

**Single TypeScript runtime.** The Agent SDK runs in TypeScript inside Next.js, so the whole app is one `bun install` and one process. Python (`uv`) is used *only* for the offline extraction and never ships to the runtime.

## The showpiece — live cross-highlight

Ask about duty cycle and drag the amperage slider. The calculator highlights the **exact cell on the real p.7 specifications page** as you move, and the citation re-pins to the documented row. The interactive widget *is* the manual — visibly, not just claimed.

## Verify the grounding

```bash
bun run verify
```

Runs all five hard questions through the real agent and asserts each routes to the right tool, surfaces the right source, and (for the out-of-manual TIG case) declines instead of fabricating. Expected: `GROUNDING SCORE: 5/5`.

## Regenerating the extraction (maintainers only)

You don't need this to run the app — the outputs are committed. To rebuild from the PDFs:

```bash
cd extraction
uv sync
uv run python extract.py         # render pages + extract text/bboxes
uv run python build_manifest.py  # assemble data/manifest.json
```

Figure crops are taken in pixel space so highlight overlays need no runtime conversion.

## Deployment

The Agent SDK spawns a bundled engine subprocess, so deploy to a **long-running Node host** (Render, Railway, Fly) rather than serverless edge functions. Set `ANTHROPIC_API_KEY` and run `bun run build && bun run start`. Local `bun run dev` is the fastest way to evaluate.

## Project layout

| Path | What |
|------|------|
| `src/agent/` | Agent loop, system prompt, manifest loader, MCP tools |
| `src/components/` | Chat UI + curated artifact components |
| `src/app/api/chat/route.ts` | Streaming NDJSON endpoint |
| `data/manifest.json` + `manifest.schema.ts` | The committed knowledge base + its zod schema |
| `public/manual/` | Committed page renders + figure crops |
| `extraction/` | Offline PyMuPDF pipeline (uv) |
| `scripts/verify-grounding.ts` | The 5/5 grounding test |

## Stack

Next.js 15 · React 19 · Claude Agent SDK (TypeScript) · Claude Sonnet 4.6 · zod · react-markdown · PyMuPDF (offline) · Bun · Tailwind v4.

## Environment

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `ANTHROPIC_API_KEY` | yes | — | Your Anthropic key |
| `CLAUDE_MODEL` | no | `claude-sonnet-4-6` | Override the agent model |
