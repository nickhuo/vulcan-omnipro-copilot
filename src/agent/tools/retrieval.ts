import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { getFigure, getPage, docTitle, searchManual } from "../manifest";
import type { StreamFrame } from "../../lib/types";

type Emit = (frame: StreamFrame) => void;

/** Retrieval tools read the committed manifest. They emit a renderable frame to the
 *  browser AND return a text summary so Claude knows what it surfaced. */
export function retrievalTools(tenantId: string, emit: Emit) {
  const getFigureTool = tool(
    "get_figure",
    "Surface a specific manual figure, diagram, schematic, or photo by its exact id. Use this to SHOW the user the real manual image instead of only describing it. Returns the figure and renders it in the UI with its caption and page citation.",
    { id: z.string().describe("The exact figure id from the catalog, e.g. 'fig-polarity-flux'") },
    async (args) => {
      const fig = getFigure(tenantId, args.id);
      if (!fig) {
        return {
          content: [{ type: "text", text: `No figure with id "${args.id}". Pick an id from the catalog.` }],
          isError: true,
        };
      }
      emit({
        type: "tool_result",
        name: "get_figure",
        output: {
          component: "FigureCard",
          id: fig.id,
          image: fig.image,
          caption: fig.caption,
          citation: fig.citation,
          page: fig.page,
        },
      });
      return {
        content: [
          {
            type: "text",
            text: `Surfaced figure ${fig.id} (${fig.citation}): ${fig.caption}${
              fig.data ? `\nData: ${JSON.stringify(fig.data)}` : ""
            }`,
          },
        ],
      };
    },
  );

  const getPageImageTool = tool(
    "get_page_image",
    "Show a full page of a manual document as an image, optionally so the user can read it in context. Use when the answer is best shown by the whole page rather than a cropped figure.",
    {
      doc: z.string().describe("Document id: 'owner-manual', 'quick-start', or 'selection-chart'"),
      page: z.number().int().positive().describe("1-based page number"),
    },
    async (args) => {
      const pg = getPage(tenantId, args.doc, args.page);
      if (!pg) {
        return {
          content: [{ type: "text", text: `No page ${args.page} in "${args.doc}".` }],
          isError: true,
        };
      }
      const citation = `${docTitle(tenantId, pg.doc)}, p.${pg.page}`;
      emit({
        type: "tool_result",
        name: "get_page_image",
        output: {
          component: "PageImage",
          image: pg.image,
          width: pg.width,
          height: pg.height,
          citation,
        },
      });
      return { content: [{ type: "text", text: `Surfaced ${citation}.` }] };
    },
  );

  const searchTool = tool(
    "search_manual",
    "Search the manuals by keyword to find which pages and figures are relevant. Use this first when you are not sure which page or figure answers the question. Returns matching pages with snippets and related figure ids.",
    {
      query: z.string().describe("Keywords to search for, e.g. 'flux core polarity socket'"),
      topK: z.number().int().positive().max(10).optional().describe("Max results (default 5)"),
    },
    async (args) => {
      const hits = searchManual(tenantId, args.query, args.topK ?? 5);
      if (hits.length === 0) {
        return { content: [{ type: "text", text: `No matches for "${args.query}".` }] };
      }
      const text = hits
        .map((h) => `${h.citation} [figures: ${h.figureIds.join(", ") || "none"}]\n  ${h.snippet}`)
        .join("\n\n");
      return { content: [{ type: "text", text }] };
    },
  );

  return [searchTool, getFigureTool, getPageImageTool];
}
