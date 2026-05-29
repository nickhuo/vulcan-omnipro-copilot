/**
 * Grounding verification — the win/lose metric.
 * Runs the hard sample questions through the real agent and asserts each one
 * routes to the right tool, surfaces the right manual source, and (for the
 * out-of-manual case) declines instead of fabricating.
 *
 * Needs ANTHROPIC_API_KEY in .env.  Run: bun run verify
 */
import { runAgent } from "../src/agent/runAgent";
import { DEFAULT_TENANT } from "../src/agent/manifest";
import type { StreamFrame, ToolOutput } from "../src/lib/types";

interface Case {
  q: string;
  expectTool?: string; // tool that must be called
  expectInText?: RegExp; // must appear in the assistant text or artifact
  expectArtifact?: ToolOutput["component"];
  declines?: boolean; // true => must NOT fabricate (out-of-manual)
  forbidArtifact?: ToolOutput["component"];
}

const CASES: Case[] = [
  {
    q: "What polarity setup do I need for flux-cored welding? Which socket does the ground clamp go in?",
    expectTool: "render_polarity_diagram",
    expectArtifact: "PolarityDiagram",
    expectInText: /positive|DCEN/i,
  },
  {
    q: "What's the duty cycle for MIG welding at 200A on 240V?",
    expectTool: "render_duty_cycle_calculator",
    expectArtifact: "DutyCycleCalculator",
    expectInText: /25\s*%|25 percent/i,
  },
  {
    q: "I'm getting porosity in my flux-cored welds. What should I check?",
    expectTool: "render_troubleshooting_tree",
    expectArtifact: "TroubleshootingTree",
    expectInText: /polarity|shielding|clean/i,
  },
  {
    q: "I want to weld 1/4 inch steel but I don't have shielding gas. Which process should I use?",
    expectTool: "render_settings_configurator",
    expectArtifact: "SettingsConfigurator",
    expectInText: /flux/i,
  },
  {
    // Out-of-manual: the manual specifies polarity only for MIG + Flux-Cored.
    // A grounded agent must decline, not invent TIG polarity.
    q: "What polarity and socket setup do I need for TIG welding on this machine?",
    declines: true,
    forbidArtifact: "PolarityDiagram",
    expectInText: /does not|doesn'?t|not specif|only.*(MIG|flux)|MIG.*flux/i,
  },
];

async function runOne(c: Case) {
  let text = "";
  const tools: string[] = [];
  const artifacts: string[] = [];
  await runAgent(
    c.q,
    (f: StreamFrame) => {
      if (f.type === "text_delta") text += f.text;
      else if (f.type === "tool_call") tools.push(f.name);
      else if (f.type === "tool_result") artifacts.push(f.output.component);
    },
    DEFAULT_TENANT,
  );

  const checks: [string, boolean][] = [];
  if (c.expectTool) checks.push([`calls ${c.expectTool}`, tools.includes(c.expectTool)]);
  if (c.expectArtifact) checks.push([`renders ${c.expectArtifact}`, artifacts.includes(c.expectArtifact)]);
  if (c.forbidArtifact) checks.push([`no ${c.forbidArtifact}`, !artifacts.includes(c.forbidArtifact)]);
  if (c.expectInText) checks.push([`text ${c.expectInText}`, c.expectInText.test(text)]);
  const pass = checks.every(([, ok]) => ok);
  return { pass, checks, tools, artifacts, text };
}

let passed = 0;
for (const c of CASES) {
  const r = await runOne(c);
  if (r.pass) passed++;
  console.log(`\n${r.pass ? "✅ PASS" : "❌ FAIL"}  ${c.q}`);
  console.log(`   tools: ${r.tools.join(", ") || "(none)"} | artifacts: ${r.artifacts.join(", ") || "(none)"}`);
  for (const [label, ok] of r.checks) console.log(`     ${ok ? "✓" : "✗"} ${label}`);
  if (!r.pass) console.log(`   text: ${r.text.slice(0, 160)}…`);
}

console.log(`\n═══════════════════════════════════\nGROUNDING SCORE: ${passed}/${CASES.length}\n`);
process.exit(passed === CASES.length ? 0 : 1);
