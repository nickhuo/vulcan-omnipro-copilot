import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { getManifest } from "../manifest";
import type { StreamFrame } from "../../lib/types";

type Emit = (frame: StreamFrame) => void;

function byKind(tenantId: string, kind: string) {
  return getManifest(tenantId).figures.filter((f) => f.data?.kind === kind);
}

/** Artifact tools return structured props (a curated React component renders them).
 *  All values are copied from the manifest — never invented. */
export function artifactTools(tenantId: string, emit: Emit) {
  const polarityTool = tool(
    "render_polarity_diagram",
    "Render an interactive polarity setup diagram for a welding process, showing which cable goes in which socket (DCEP vs DCEN), alongside the real manual figure. Use for any question about polarity, electrode positive/negative, or which socket a cable plugs into. The manual specifies polarity for MIG and FluxCore only.",
    { process: z.enum(["MIG", "FluxCore", "TIG", "Stick"]).describe("Welding process") },
    async (args) => {
      const fig = byKind(tenantId, "polarity").find(
        (f) => f.data?.kind === "polarity" && f.data.process === args.process,
      );
      if (!fig || fig.data?.kind !== "polarity") {
        return {
          content: [
            {
              type: "text",
              text: `The manual does not specify a polarity diagram for ${args.process}. It documents polarity for MIG (DCEP) and Flux-Cored (DCEN) only. Do not guess the others.`,
            },
          ],
          isError: true,
        };
      }
      const d = fig.data;
      emit({
        type: "tool_result",
        name: "render_polarity_diagram",
        output: {
          component: "PolarityDiagram",
          process: d.process,
          electrode: d.electrode,
          current: d.current,
          torchSocket: d.torchSocket,
          groundSocket: d.groundSocket,
          shieldingGas: d.shieldingGas,
          sourceImage: fig.image,
          caption: fig.caption,
          citation: fig.citation,
          page: fig.page,
        },
      });
      return {
        content: [
          {
            type: "text",
            text: `Rendered ${d.process} polarity (${d.current}). ${d.groundSocket}; ${d.torchSocket}. ${fig.citation}.`,
          },
        ],
      };
    },
  );

  const dutyCycleTool = tool(
    "render_duty_cycle_calculator",
    "Render an interactive duty-cycle calculator for a process. The user drags amperage/voltage and the matching cell is highlighted live on the real manual specifications page. Use for any duty-cycle, 'how long can I weld', amperage, or overheating question.",
    { process: z.enum(["MIG", "TIG", "Stick"]).describe("Welding process") },
    async (args) => {
      const fig = byKind(tenantId, "duty_cycle_matrix").find(
        (f) => f.data?.kind === "duty_cycle_matrix" && f.data.process === args.process,
      );
      if (!fig || fig.data?.kind !== "duty_cycle_matrix") {
        return { content: [{ type: "text", text: `No duty-cycle data for ${args.process}.` }], isError: true };
      }
      const d = fig.data;
      emit({
        type: "tool_result",
        name: "render_duty_cycle_calculator",
        output: {
          component: "DutyCycleCalculator",
          process: d.process,
          pageImage: d.pageImage,
          pageWidth: d.pageWidth,
          pageHeight: d.pageHeight,
          rows: d.rows,
          citation: fig.citation,
        },
      });
      const summary = d.rows
        .map((r) => `${r.inputVoltage} ${r.amperage}A → ${r.dutyCyclePct}%`)
        .join("; ");
      return { content: [{ type: "text", text: `Duty cycle for ${d.process}: ${summary}. ${fig.citation}.` }] };
    },
  );

  const troubleshootTool = tool(
    "render_troubleshooting_tree",
    "Render a troubleshooting guide for a weld defect or machine symptom (e.g. porosity, unstable arc), showing causes and fixes with the source manual page. Use for any 'why is my weld…', defect, or 'what should I check' question.",
    {
      symptom: z.string().describe("The defect or symptom, e.g. 'porosity' or 'unstable arc'"),
    },
    async (args) => {
      const figs = byKind(tenantId, "troubleshooting");
      const q = args.symptom.toLowerCase();
      const terms = q.split(/\s+/).filter((t) => t.length > 3);
      const symptomText = (f: (typeof figs)[number]) =>
        f.data?.kind === "troubleshooting" ? f.data.symptom.toLowerCase() : "";
      const fig =
        figs.find((f) => symptomText(f).includes(q)) ||
        figs.find((f) => terms.some((t) => symptomText(f).includes(t)));
      if (!fig || fig.data?.kind !== "troubleshooting") {
        return {
          content: [
            {
              type: "text",
              text: `No troubleshooting entry matches "${args.symptom}". Available: ${figs
                .map((f) => (f.data?.kind === "troubleshooting" ? f.data.symptom : ""))
                .join("; ")}.`,
            },
          ],
          isError: true,
        };
      }
      const d = fig.data;
      emit({
        type: "tool_result",
        name: "render_troubleshooting_tree",
        output: {
          component: "TroubleshootingTree",
          symptom: d.symptom,
          processScope: d.processScope,
          causes: d.causes,
          sourceImage: fig.image,
          citation: fig.citation,
          page: fig.page,
        },
      });
      return {
        content: [
          {
            type: "text",
            text: `Rendered troubleshooting for "${d.symptom}" (${d.processScope}) with ${d.causes.length} causes. ${fig.citation}.`,
          },
        ],
      };
    },
  );

  const settingsTool = tool(
    "render_settings_configurator",
    "Render an interactive process selector from the welding selection chart. The user picks material, thickness, and gas availability and sees which process(es) fit. Use for 'which process should I use', 'what settings for [material]', or process-choice questions.",
    {},
    async () => {
      const fig = byKind(tenantId, "selection_chart")[0];
      if (!fig || fig.data?.kind !== "selection_chart") {
        return { content: [{ type: "text", text: "No selection chart available." }], isError: true };
      }
      emit({
        type: "tool_result",
        name: "render_settings_configurator",
        output: {
          component: "SettingsConfigurator",
          processes: fig.data.processes,
          citation: fig.citation,
        },
      });
      return {
        content: [
          {
            type: "text",
            text: `Rendered the process selector with ${fig.data.processes.length} processes from the ${fig.citation}.`,
          },
        ],
      };
    },
  );

  return [polarityTool, dutyCycleTool, troubleshootTool, settingsTool];
}
