import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import type { DynamicStructuredTool } from "@langchain/core/tools";

// Create the LLM — free Groq endpoint with Llama 3.3 70B.
function makeLLM(): ChatOpenAI {
  if (!process.env.GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is not set",
    );
  }
  return new ChatOpenAI({
    model: "openai/gpt-oss-20b",
    apiKey: process.env.GROQ_API_KEY,
    configuration: { baseURL: "https://api.groq.com/openai/v1" },
    temperature: 0,
  });
}

// Build a ReAct agent with whatever tools were discovered.
export function buildAgent(tools: DynamicStructuredTool[]) {
  return createReactAgent({
    llm: makeLLM(),
    tools,
    prompt:
      "You are a helpful assistant with MCP tools including MongoDB, math, and get_weather. Use get_weather for any current-weather question. For MongoDB tools requiring a connectionId, use 'preconfigured' (or call list-connections to inspect available connections). Always invoke your MCP tools instead of saying you lack real-time data.",
  });
}

// Run the agent on a single question and return the answer text.
export async function runAgent(agent: any, question: string): Promise<string> {
  const result = await agent.invoke(
    { messages: [new HumanMessage(question)] },
    { recursionLimit: 12 },
  );


  // Grab the last AI message that has text content
  const messages: any[] = result.messages || [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m instanceof AIMessage && m.content && !m.tool_calls?.length) {
      // Log tool calls for visibility
      if (m.tool_calls?.length) {
        for (const tc of m.tool_calls) {
          console.error(`[tool] ${tc.name}(${JSON.stringify(tc.args)})`);
        }
      }
      return typeof m.content === "string" ? m.content : String(m.content);
    }
  }
  return "(no answer)";
}
