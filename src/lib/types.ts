/** Wire protocol between the streaming chat route and the browser client. */

export type StreamFrame =
  | { type: "text_delta"; text: string }
  | { type: "tool_call"; name: string }
  | { type: "tool_result"; name: string; output: ToolOutput }
  | { type: "error"; message: string }
  | { type: "done" };

/** Every renderable tool output carries a `component` key for the client registry. */
export type ToolOutput =
  | FigureOutput
  | PageImageOutput
  | PolarityDiagramOutput
  | DutyCycleOutput
  | TroubleshootingOutput
  | SettingsConfiguratorOutput;

export interface DutyCycleRowOut {
  inputVoltage: "120V" | "240V";
  amperage: number;
  dutyCyclePct: number;
  cellBbox: [number, number, number, number];
}

export interface DutyCycleOutput {
  component: "DutyCycleCalculator";
  process: "MIG" | "TIG" | "Stick";
  pageImage: string;
  pageWidth: number;
  pageHeight: number;
  rows: DutyCycleRowOut[];
  citation: string;
}

export interface TroubleshootingOutput {
  component: "TroubleshootingTree";
  symptom: string;
  processScope: string;
  causes: { cause: string; fix: string; processNote?: string }[];
  sourceImage: string;
  citation: string;
  page: number;
}

export interface SettingsConfiguratorOutput {
  component: "SettingsConfigurator";
  processes: {
    process: string;
    gas: "required" | "not required";
    materials: string[];
    thickness: string;
    cleanliness: string;
    applications: string[];
  }[];
  citation: string;
}

export interface FigureOutput {
  component: "FigureCard";
  id: string;
  image: string;
  caption: string;
  citation: string;
  page: number;
}

export interface PageImageOutput {
  component: "PageImage";
  image: string;
  width: number;
  height: number;
  citation: string;
  /** optional pixel-space region to highlight on the page */
  highlight?: [number, number, number, number];
}

export interface PolarityDiagramOutput {
  component: "PolarityDiagram";
  process: "MIG" | "FluxCore" | "TIG" | "Stick";
  electrode: "positive" | "negative";
  current: "DCEP" | "DCEN";
  torchSocket: string;
  groundSocket: string;
  shieldingGas?: string;
  /** real manual figure shown alongside the rendered diagram, as proof */
  sourceImage: string;
  caption: string;
  citation: string;
  page: number;
}
