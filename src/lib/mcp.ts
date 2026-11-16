import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { jsonSchemaToZod } from "./schema.js";

// Connect to every MCP server, discover their tools, and return LangChain tools.
export async function discoverTools(servers:any) {
  const connections = [];
  const tools = [];

  for (const server of servers) {
    const transport = createTransport(server);
    const client = new Client(
      { name: "langgraph-mcp-agent", version: "1.0.0" },
      { capabilities: {} },
    );

    await client.connect(transport);

    // Keep the connection alive
    connections.push({
      server,
      client,
      transport,
    });

    const { tools: mcpTools } = await client.listTools();
    console.error(
      `[mcp] ${server.name}: ${mcpTools.map((t) => t.name).join(", ") || "(no tools)"}`,
    );

    for (const mcpTool of mcpTools) {
      tools.push(makeTool(client, mcpTool));
    }
  }

  return {
    tools,
    connections,
  };
}

// Create the appropriate transport based on the config type.
function createTransport(cfg:any) {
  if (cfg.transport === "stdio") {
    return new StdioClientTransport({
      command: cfg.command,
      args: cfg.args || [],
      env: { ...process.env, ...cfg.env },
    });
  }

  if (!cfg.url) {
    throw new Error(
      `MCP server "${cfg.name}" uses ${cfg.transport} transport but has no url`,
    );
  }

  return new StreamableHTTPClientTransport(new URL(cfg.url), {
    requestInit: cfg.headers ? { headers: cfg.headers } : undefined,
  });
}

// Convert MCP tool into LangChain tool
function makeTool(client: Client, mcpTool: any) {
  return new DynamicStructuredTool({
    name: mcpTool.name,
    description: mcpTool.description ?? "",
    schema: jsonSchemaToZod(mcpTool.inputSchema),
    func: async (args) => {
      try {
        const { content, isError } = await client.callTool({
          name: mcpTool.name,
          arguments: args || {},
        });
        const text = ((content as any[]) || [])
          .map((c: any) => (c.type === "text" ? c.text : JSON.stringify(c)))
          .join("\n");

        if (isError) {
          return `Error from tool ${mcpTool.name}: ${text || "Unknown error"}`;
        }
        return text || "(Tool executed successfully with no text output)";
      } catch (err: any) {
        return `Failed to execute tool ${mcpTool.name}: ${err?.message || String(err)}`;
      }
    },
  });
}

// Close all MCP connections.
export async function closeAll(connections: any[]): Promise<void> {
  await Promise.allSettled(
    connections.map((c) => (c.client ?? c).close()),
  );
}
