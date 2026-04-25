#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";

const server = new McpServer({
  name: "nullcost-render-probe",
  version: "0.1.0",
});

const OSC8_OPEN = "\u001b]8;;";
const OSC8_CLOSE = "\u0007";
const ANSI_RESET = "\u001b[0m";

const STYLE_DEFS = [
  {
    id: "markdown",
    summary: "Markdown emphasis, headings, lists, table, and links.",
    expectations: [
      "Markdown hosts may style this.",
      "Plain terminals will show raw markdown characters.",
    ],
  },
  {
    id: "ascii_card",
    summary: "Unicode box-drawing card with compact fallback rows.",
    expectations: [
      "Works well in fixed-width terminals.",
      "Hosts with weak Unicode support may misalign box characters.",
    ],
  },
  {
    id: "compact_rows",
    summary: "Dense single-line ranked rows.",
    expectations: [
      "Best for narrow chat panes.",
      "Long labels may wrap awkwardly in some hosts.",
    ],
  },
  {
    id: "ansi_color",
    summary: "ANSI colors, bold, underline, and inverse video.",
    expectations: [
      "Real terminals may render colors.",
      "Chat panes often strip or escape ANSI sequences.",
    ],
  },
  {
    id: "html_css",
    summary: "Raw HTML, CSS, inline font and size hints.",
    expectations: [
      "Most chat hosts will escape or ignore this.",
      "Useful for confirming sanitization behavior.",
    ],
  },
  {
    id: "links",
    summary: "Raw URLs, markdown links, HTML anchors, and OSC 8 links.",
    expectations: [
      "Raw URLs are the safest fallback.",
      "OSC 8 is terminal-dependent and often stripped elsewhere.",
    ],
  },
  {
    id: "wrap_stress",
    summary: "Long lines, long tokens, tabs, and spacing stress.",
    expectations: [
      "Shows wrapping and truncation behavior.",
      "Hosts may collapse multiple spaces or tabs.",
    ],
  },
  {
    id: "unicode_mix",
    summary: "Wide characters, symbols, and mixed glyph sets.",
    expectations: [
      "Good for testing alignment drift.",
      "Some fonts will render widths differently.",
    ],
  },
  {
    id: "font_size_hacks",
    summary: "Heading scale and legacy HTML font/size hints.",
    expectations: [
      "Useful for checking if anything affects perceived size.",
      "Actual font control is usually ignored by the host.",
    ],
  },
];

const STYLE_IDS = STYLE_DEFS.map((style) => style.id);

function clampWidth(width) {
  if (!Number.isFinite(width)) {
    return 84;
  }

  return Math.max(56, Math.min(120, Math.trunc(width)));
}

function fill(width, char = "─") {
  return char.repeat(Math.max(0, width));
}

function padRight(text, width) {
  const sliced = [...text].slice(0, width).join("");
  return sliced + " ".repeat(Math.max(0, width - [...sliced].length));
}

function padLabelValue(label, value, innerWidth) {
  const left = `${label}`.padEnd(10, " ");
  return padRight(`${left}${value}`, innerWidth);
}

function makeAsciiCard(width) {
  const outerWidth = clampWidth(width);
  const innerWidth = outerWidth - 2;
  const lines = [
    `╭${fill(innerWidth, "─")}╮`,
    `│${padRight(" Nullcost: hosting for public MCP", innerWidth)}│`,
    `│${padLabelValue(" Best fit", "Vercel Functions                              score 92", innerWidth)}│`,
    `│${padLabelValue(" Why", "Fastest deploy + strong custom domains", innerWidth)}│`,
    `│${padLabelValue(" Price", "Free to start", innerWidth)}│`,
    `│${padLabelValue(" Referral", "None used in ranking", innerWidth)}│`,
    `│${padLabelValue(" Actions", "[o] official  [d] discount  [w] why rank", innerWidth)}│`,
    `├${fill(innerWidth, "─")}┤`,
    `│${padRight(" 2 Render   fast setup · starter pricing visible · user discount", innerWidth)}│`,
    `│${padRight(" 3 Fly.io   more control · usage based pricing · credits only", innerWidth)}│`,
    `╰${fill(innerWidth, "─")}╯`,
  ];

  return lines.join("\n");
}

function makeCompactRows() {
  return [
    "1  Vercel     best fit     free to start   no referral impact   [o] [w]",
    "2  Render     alt          starter plan    user discount        [o] [d]",
    "3  Fly.io     budget ctrl  usage based     credits only         [o] [w]",
  ].join("\n");
}

function makeAnsiColor() {
  return [
    `${ANSI_RESET}\u001b[1;32mBest fit\u001b[0m   Vercel Functions   \u001b[1mfree to start\u001b[0m`,
    `${ANSI_RESET}\u001b[33mAlt\u001b[0m        Render             starter plan visible`,
    `${ANSI_RESET}\u001b[7mInverse\u001b[0m    highlight row       \u001b[4munderlined link hint\u001b[0m`,
    `${ANSI_RESET}\u001b[31mWarning\u001b[0m    ANSI may be stripped or escaped by chat hosts`,
  ].join("\n");
}

function makeHtmlCss() {
  return [
    "<style>",
    "  .probe-title { font-size: 32px; color: #27c794; font-family: 'Comic Sans MS', cursive; }",
    "  .probe-body { font-size: 13px; letter-spacing: 0.18em; color: #ff5f7a; }",
    "</style>",
    "<div class=\"probe-title\">HTML title at 32px</div>",
    "<div class=\"probe-body\">Inline CSS, font family, and size test.</div>",
    "<font size=\"7\" color=\"#ffaa00\">Legacy font tag probe</font>",
    "<a href=\"https://vercel.com\">HTML anchor</a>",
  ].join("\n");
}

function makeLinks() {
  const osc8Link = `${OSC8_OPEN}https://vercel.com${OSC8_CLOSE}OSC8 terminal link${OSC8_OPEN}${OSC8_CLOSE}`;

  return [
    "Raw URL: https://vercel.com",
    "Markdown link: [Official site](https://vercel.com)",
    "Discount URL: https://example.com/r/ref-123",
    "HTML anchor: <a href=\"https://example.com/r/ref-123\">Discount link</a>",
    `OSC 8 link: ${osc8Link}`,
  ].join("\n");
}

function makeWrapStress(width) {
  const token = "LONGTOKEN_".repeat(Math.max(4, Math.floor(clampWidth(width) / 10)));
  return [
    `Long unbroken token: ${token}`,
    "Wide row: 1  Vercel  best fit  free to start  strong custom domains  no referral bias  [o] [w] [d]",
    "Tabs/spaces: col1\tcol2\tcol3",
    "Spacing   probe      with      repeated      gaps",
  ].join("\n");
}

function makeUnicodeMix() {
  return [
    "Unicode box: ┌─ best fit ─┐",
    "Symbols: ✓ ✕ → ↳ ◆ ◉",
    "Mixed width: 日本語 sample | 한국어 sample | emoji 😀",
    "Fallback row: Vercel · Render · Fly.io",
  ].join("\n");
}

function makeMarkdown() {
  return [
    "# Markdown Probe",
    "",
    "## Visual hierarchy",
    "- **Bold**",
    "- *Italic*",
    "- `Inline code`",
    "- ~~Strike~~",
    "",
    "| Provider | Price | Link |",
    "| --- | --- | --- |",
    "| Vercel | Free to start | [Official](https://vercel.com) |",
    "| Render | Starter plan | [Discount](https://example.com/r/ref-123) |",
    "",
    "```text",
    "1  Vercel   best fit",
    "2  Render   alt",
    "```",
  ].join("\n");
}

function makeFontSizeHacks() {
  return [
    "# H1 heading probe",
    "## H2 heading probe",
    "### H3 heading probe",
    "",
    "<span style=\"font-size: 40px; font-family: Papyrus; color: #ff5f7a;\">Inline span at 40px</span>",
    "<small>Small tag probe</small>",
    "<big>Big tag probe</big>",
    "",
    "Perceived-size fallback:",
    "BEST FIT: VERCEL FUNCTIONS",
    "winner -> fastest deploy + strong custom domains",
  ].join("\n");
}

function makeStyle(style, width) {
  switch (style) {
    case "markdown":
      return makeMarkdown();
    case "ascii_card":
      return makeAsciiCard(width);
    case "compact_rows":
      return makeCompactRows();
    case "ansi_color":
      return makeAnsiColor();
    case "html_css":
      return makeHtmlCss();
    case "links":
      return makeLinks();
    case "wrap_stress":
      return makeWrapStress(width);
    case "unicode_mix":
      return makeUnicodeMix();
    case "font_size_hacks":
      return makeFontSizeHacks();
    default:
      return `Unknown style: ${style}`;
  }
}

function findStyle(style) {
  return STYLE_DEFS.find((candidate) => candidate.id === style);
}

server.registerTool(
  "list_probe_styles",
  {
    description: "List the output probe styles available for rendering stress tests.",
  },
  async () => {
    const lines = STYLE_DEFS.map((style) => `- ${style.id}: ${style.summary}`);
    return {
      content: [
        {
          type: "text",
          text: ["Nullcost render probe styles", ...lines].join("\n"),
        },
      ],
      structuredContent: {
        styles: STYLE_DEFS,
      },
    };
  },
);

server.registerTool(
  "render_probe",
  {
    description: "Render one output style to test what the host preserves, escapes, or strips.",
    inputSchema: {
      style: z.enum(STYLE_IDS).describe("The rendering style preset to emit."),
      width: z
        .number()
        .int()
        .min(56)
        .max(120)
        .optional()
        .describe("Approximate target width for fixed-width layouts."),
      includeExpectations: z
        .boolean()
        .optional()
        .describe("Append notes describing what this style is expected to test."),
    },
  },
  async ({ style, width = 84, includeExpectations = true }) => {
    const matched = findStyle(style);
    const body = makeStyle(style, width);
    const expectations = includeExpectations && matched
      ? `\n\nExpected observations:\n- ${matched.expectations.join("\n- ")}`
      : "";

    return {
      content: [
        {
          type: "text",
          text: `${body}${expectations}`,
        },
      ],
      structuredContent: {
        style,
        width: clampWidth(width),
        summary: matched?.summary ?? null,
        expectations: matched?.expectations ?? [],
        rawText: body,
        lineCount: body.split("\n").length,
      },
    };
  },
);

server.registerTool(
  "render_probe_bundle",
  {
    description: "Emit multiple output blocks at once to test block separation and rendering fidelity.",
    inputSchema: {
      width: z
        .number()
        .int()
        .min(56)
        .max(120)
        .optional()
        .describe("Approximate target width for fixed-width layouts."),
    },
  },
  async ({ width = 84 }) => {
    const renderedBlocks = STYLE_DEFS.map((style) => ({
      style: style.id,
      rawText: makeStyle(style.id, width),
    }));
    const blocks = renderedBlocks.map((block) => ({
      type: "text",
      text: `=== ${block.style} ===\n${block.rawText}`,
    }));

    return {
      content: blocks,
      structuredContent: {
        styleCount: STYLE_DEFS.length,
        styles: STYLE_DEFS.map((style) => style.id),
        width: clampWidth(width),
        blocks: renderedBlocks,
      },
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("nullcost-render-probe MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
