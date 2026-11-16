#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
    name: "math-server",
    version: "1.0.0",
});

server.registerTool(
    "add",
    {
        description: "Add two numbers and return the sum.",
        inputSchema: { a: z.number(), b: z.number() },
    },
    async ({ a, b }) => ({
        content: [{ type: "text", text: String(a + b) }],
    }),
);

server.registerTool(
    "subtract",
    {
        description: "Subtract b from a and return the difference.",
        inputSchema: { a: z.number(), b: z.number() },
    },
    async ({ a, b }) => ({
        content: [{ type: "text", text: String(a - b) }],
    }),
);

server.registerTool(
    "multiply",
    {
        description: "Multiply two numbers and return the product.",
        inputSchema: { a: z.number(), b: z.number() },
    },
    async ({ a, b }) => ({
        content: [{ type: "text", text: String(a * b) }],
    }),
);

server.registerTool(
    "divide",
    {
        description: "Divide a by b. Returns an error message if b is zero.",
        inputSchema: { a: z.number(), b: z.number() },
    },
    async ({ a, b }) => {
        if (b === 0) {
            return {
                isError: true,
                content: [{ type: "text", text: "Division by zero is undefined." }],
            };
        }
        return { content: [{ type: "text", text: String(a / b) }] };
    },
);

server.registerTool(
    "sqrt",
    {
        description: "Return the square root of a non-negative number.",
        inputSchema: { x: z.number().min(0) },
    },
    async ({ x }) => ({
        content: [{ type: "text", text: String(Math.sqrt(x)) }],
    }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
