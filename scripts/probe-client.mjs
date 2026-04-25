#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  CallToolResultSchema,
  ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";

const command = process.argv[2] ?? "list";
const isExplicitRender = command === "render";
const style = isExplicitRender ? process.argv[3] ?? "markdown" : command;
const widthSource = isExplicitRender ? process.argv[4] : process.argv[3];
const widthArg = Number(widthSource ?? 84);
const width = Number.isFinite(widthArg) ? widthArg : 84;

function printContentBlocks(result) {
  result.content.forEach((item, index) => {
    console.log(`\n--- content block ${index + 1} ---`);
    if (item.type === "text") {
      console.log(item.text);
      return;
    }

    console.log(JSON.stringify(item, null, 2));
  });

  if (result.structuredContent) {
    console.log("\n--- structured content ---");
    console.log(JSON.stringify(result.structuredContent, null, 2));
  }
}

async function connectClient() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["./mcp/render-probe-server.mjs"],
    cwd: process.cwd(),
    stderr: "pipe",
  });

  if (transport.stderr) {
    transport.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
    });
  }

  const client = new Client({
    name: "nullcost-render-probe-client",
    version: "0.1.0",
  });

  await client.connect(transport);
  return { client, transport };
}

async function listTools(client) {
  const result = await client.request(
    {
      method: "tools/list",
      params: {},
    },
    ListToolsResultSchema,
  );

  console.log("Available tools:");
  result.tools.forEach((tool) => {
    console.log(`- ${tool.name}: ${tool.description}`);
  });
}

async function callTool(client, name, args = {}) {
  return client.request(
    {
      method: "tools/call",
      params: {
        name,
        arguments: args,
      },
    },
    CallToolResultSchema,
  );
}

async function main() {
  const { client, transport } = await connectClient();

  try {
    if (command === "list") {
      await listTools(client);
      const styles = await callTool(client, "list_probe_styles");
      printContentBlocks(styles);
      return;
    }

    if (command === "all") {
      const result = await callTool(client, "render_probe_bundle", { width });
      printContentBlocks(result);
      return;
    }

    const result = await callTool(client, "render_probe", {
      style,
      width,
      includeExpectations: true,
    });
    printContentBlocks(result);
  } finally {
    await transport.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
