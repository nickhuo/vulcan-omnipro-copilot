import type { ToolOutput } from "@/lib/types";
import FigureCard from "../FigureCard";
import PageImage from "../PageImage";
import PolarityDiagram from "./PolarityDiagram";
import DutyCycleCalculator from "./DutyCycleCalculator";
import TroubleshootingTree from "./TroubleshootingTree";
import SettingsConfigurator from "./SettingsConfigurator";

/** Maps a structured tool result to its curated React component. Unknown
 *  components degrade gracefully (never broken HTML). */
export default function ArtifactRenderer({ output }: { output: ToolOutput }) {
  switch (output.component) {
    case "PolarityDiagram":
      return <PolarityDiagram output={output} />;
    case "DutyCycleCalculator":
      return <DutyCycleCalculator output={output} />;
    case "TroubleshootingTree":
      return <TroubleshootingTree output={output} />;
    case "SettingsConfigurator":
      return <SettingsConfigurator output={output} />;
    case "FigureCard":
      return <FigureCard output={output} />;
    case "PageImage":
      return (
        <PageImage
          image={output.image}
          width={output.width}
          height={output.height}
          citation={output.citation}
          highlight={output.highlight}
        />
      );
    default:
      return null;
  }
}
