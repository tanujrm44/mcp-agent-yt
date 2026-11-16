import "dotenv/config";
import { spawn } from "node:child_process";

const connStr =
  process.env.MDB_MCP_CONNECTION_STRING || "mongodb://localhost:27017";

console.log("→ Starting MongoDB MCP HTTP Server on port 3000...");
console.log("→ MCP Endpoint: http://localhost:3000/mcp");

const child = spawn(
  "npx",
  [
    "-y",
    "supergateway",
    "--stdio",
    "npx -y mongodb-mcp-server@latest --readOnly",
    "--port",
    "3000",
    "--outputTransport",
    "streamableHttp",
    "--streamableHttpPath",
    "/mcp",
    "--stateful",
    "--cors",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      MDB_MCP_CONNECTION_STRING: connStr,
    },
  }
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
