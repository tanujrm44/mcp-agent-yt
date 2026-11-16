import "dotenv/config";
import { createInterface } from "readline";
import path from "path";
import { discoverTools, closeAll } from "./lib/mcp.js";
import { buildAgent, runAgent } from "./lib/agent.js";

// -----------------------------------------------------------------------------
// MCP server registry
//
// Each entry spawns a child process over stdio. The agent has NO knowledge of
// what tools these servers expose — it discovers them at runtime via tools/list.
// Swap, add, or remove servers here without touching the agent code.
// -----------------------------------------------------------------------------

/*
  1: Build MCP Servers
  2: Discover tools from servers at run time
  3: Build react agent using langgraph
  4: Build Interactive chat
  5: Use SSE Transport
*/
const CONNECTION_STRING =
  process.env.MDB_MCP_CONNECTION_STRING || "mongodb://localhost:27017";

const MATH_SERVER_PATH = path.resolve(
  "dist",
  "mcp-servers",
  "math.js",
);

const WEATHER_SERVER_PATH = path.resolve(
  "dist",
  "mcp-servers",
  "weather.js",
);

const MCP_SERVERS = [
  {
    transport: "http" as const,
    url: "http://localhost:3000/mcp",
    name: "mongodb",
    command: "npx",
    args: ["-y", "mongodb-mcp-server@3.0.4", "--readOnly"],
    env: {
      ...process.env,
      MDB_MCP_CONNECTION_STRING: CONNECTION_STRING,
    },
  },
  {
    transport: "stdio" as const,
    name: "math",
    command: process.execPath,
    args: [MATH_SERVER_PATH],
  },
  {
    transport: "stdio" as const,
    name: "weather",
    command: process.execPath,
    args: [WEATHER_SERVER_PATH],
  },
];

// const DEMO_QUESTIONS = [
//   "List all databases available in the MongoDB connection.",
//   "Calculate sqrt(144) + 25 * 4 using math tools.",
//   "Look up what LangGraph is in the knowledge base and tell me the word count of its description.",
// ];

async function main(): Promise<void> {
  const { tools, connections } = await discoverTools(MCP_SERVERS);

  if (!tools.length) {
    console.error("\nNo tools were discovered from the MCP servers. Exiting.");
    await closeAll(connections);
    process.exit(1);
  }

  console.error(`\n✓ Agent ready with ${tools.length} dynamically-bound tool(s).`);

  const agent = buildAgent(tools);

  try {
    await interactiveChat(agent);
  } finally {
    await closeAll(connections);
    console.error("\n→ Closed MCP connection.");
  }
}

async function interactiveChat(agent: any): Promise<void> {
  console.log("\n=== Interactive chat ===");
  console.log("Ask questions about your MongoDB data. Type 'exit' or Ctrl-C to quit.\n");

  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
    prompt: "you> ",
  });

  return new Promise((resolve) => {
    rl.prompt();
    rl.on("line", (line: string) => {
      const input = line.trim();
      if (!input) return rl.prompt();
      if (input.toLowerCase() === "exit" || input.toLowerCase() === "quit") {
        rl.close();
        return resolve();
      }

      runAgent(agent, input)
        .then((answer) => {
          console.log(`\nassistant> ${answer || "(no answer)"}\n`);
          rl.prompt();
        })
        .catch((err: any) => {
          console.error(`\nassistant> Error: ${err.message}\n`);
          rl.prompt();
        });
    });
    rl.on("close", resolve);
  });
}

main().catch((err: any) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
