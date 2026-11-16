# Dynamic MCP AI Agent

Build an AI agent that **discovers its own tools at runtime** using the Model Context Protocol (MCP) and LangGraph. No hardcoded tool lists and no custom integration code for each new tool.

## The Problem

Every time an AI app needs to do something beyond chat (query a database, run a calculation, call an API), a developer writes custom integration code for that specific tool and that specific LLM's function-calling format. Switch providers or add a tool, and you rewrite it all. Tools end up hardwired to agents: **N tools × M agents = N×M custom integrations**.

## The Solution

MCP is a standard "socket" for AI tools. Each tool lives in its own MCP server and describes itself over a common protocol. This project's generic client connects to those servers, asks *"what tools do you have?"*, converts the answers into LangChain tools, and hands them to a LangGraph ReAct agent.

Add a new MCP server tomorrow and the agent gains its tools with **zero agent code changes**.

## How It Works

```
User question
      │
      ▼
LangGraph ReAct agent (reason → act → observe → repeat)
      │
      ▼
Generic MCP client (src/lib/mcp.ts)
  ├─ listTools()        discover tools at runtime
  ├─ jsonSchemaToZod()  convert MCP JSON Schema → Zod
  └─ callTool()         forward the agent's call to the server
      │
      ├── stdio ──► Math server
      ├── stdio ──► Weather server (OpenWeather API)
      └── HTTP  ──► MongoDB server
```

1. **Discovery:** the client calls `tools/list` on each MCP server.
2. **Conversion:** each tool's JSON Schema is converted to a Zod schema and wrapped as a LangChain `DynamicStructuredTool`.
3. **Reasoning:** the ReAct agent decides which tool to call and with what arguments.
4. **Execution:** the wrapper forwards the call to the right MCP server and returns the result as text.
5. **Resilience:** tool errors are returned as strings (not thrown), so the agent can read them and recover.

## Features

- Runtime tool discovery, with no hardcoded tool names or schemas
- Two transports used in this repo: **stdio** (math, weather) and **Streamable HTTP** (MongoDB)
- LLM-agnostic client layer: swap the model without touching the tools
- Interactive chat over stdin
- Clean connection cleanup when the session ends

## Tech Stack

Node.js · TypeScript · LangGraph · LangChain · Model Context Protocol SDK · Zod · MongoDB · Groq · OpenWeather

## Project Structure

```
.
├── src/
│   ├── index.ts                 # Entry: MCP registry + interactive chat
│   ├── lib/
│   │   ├── mcp.ts               # MCP client: connect, discover tools, wrap as LangChain tools
│   │   ├── agent.ts             # LangGraph ReAct agent + Groq LLM setup
│   │   └── schema.ts            # jsonSchemaToZod converter
│   └── mcp-servers/
│       ├── math.ts              # add, subtract, multiply, divide, sqrt
│       └── weather.ts           # get_weather via OpenWeather
├── .env.example
├── package.json
└── README.md
```

After `npm run build`, compiled files live in `dist/`. The agent spawns the math and weather servers from `dist/mcp-servers/*.js`.

## MCP Servers Included

| Server | Transport | Tools |
|---|---|---|
| `math-server` | stdio | `add`, `subtract`, `multiply`, `divide`, `sqrt` |
| `weather-server` | stdio | `get_weather` (OpenWeather current weather by city, metric units) |
| MongoDB MCP server | HTTP (`http://localhost:3000/mcp`) | Exposed by `mongodb-mcp-server` (discovered at runtime) |

The weather tool needs `OPENWEATHER_API_KEY`. It returns city, temperature, feels-like, humidity, and a short weather description.

## Getting Started

### Prerequisites

- Node.js 18+
- A free [Groq API key](https://console.groq.com/keys)
- An [OpenWeather API key](https://openweathermap.org/api)
- A MongoDB connection string
- A running MongoDB MCP server on Streamable HTTP at `http://localhost:3000/mcp` (the URL is currently hardcoded in `src/index.ts`)

### Install

```bash
git clone <your-repo-url>
cd mcp-agent-yt
npm install
```

### Configure environment

```bash
cp .env.example .env
```

Fill in your values:

```dotenv
MDB_MCP_CONNECTION_STRING=your_mongodb_connection_string_here
OPENWEATHER_API_KEY=your_openweather_api_key_here
GROQ_API_KEY=your_groq_api_key_here
```

> Never commit `.env`. It is listed in `.gitignore`.

### Build and run

The stdio servers are launched from compiled JS, so build first:

```bash
npm run build
npm start
```

This opens an interactive chat. Type `exit` or `quit` to stop.

## Example

```
you> What is 12 multiplied by 7, then take the square root?
[tool] multiply({"a":12,"b":7})
[tool] sqrt({"x":84})
assistant> 12 × 7 = 84, and the square root of 84 is about 9.165.

you> What's the weather in London?
[tool] get_weather({"city":"London"})
assistant> In London it is currently 11°C, feels like 9°C, with light rain and 82% humidity.
```

## Adding Your Own MCP Server

1. Build a server with `@modelcontextprotocol/sdk` (see `src/mcp-servers/math.ts` or `src/mcp-servers/weather.ts` as a template).
2. Add an entry to the `MCP_SERVERS` array in `src/index.ts`:

```ts
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
```

3. Rebuild and restart. The agent discovers the new tools automatically.

## Known Limitations and Next Steps

- The system prompt in `src/lib/agent.ts` mentions MongoDB, math, and `get_weather` by name; ideally this would stay generic and be configured per server.
- The MongoDB MCP URL is hardcoded to `http://localhost:3000/mcp`.
- Stdio servers inherit the full parent environment. Use an explicit allowlist for anything beyond local demos.
- `jsonSchemaToZod` should have unit tests covering nested objects, enums, and optional fields.
- Small models can struggle with multi-step tool chains. Try a stronger model for complex tasks.

## Roadmap

- [ ] GitHub MCP server
- [ ] Slack MCP server
- [ ] RAG MCP server (ChromaDB / Qdrant / Pinecone)
- [ ] Make the MongoDB HTTP URL configurable
- [ ] Unit tests for schema conversion

## Learn More

- [Model Context Protocol](https://modelcontextprotocol.io)
- [LangGraph.js docs](https://langchain-ai.github.io/langgraphjs/)
- [OpenWeather Current Weather API](https://openweathermap.org/current)
