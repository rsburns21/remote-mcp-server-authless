import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Burns Legal ChatGPT - Optimized for ChatGPT with search and fetch
export class BurnsLegalChatGPT extends McpAgent {
	server = new McpServer({
		name: "Burns Legal ChatGPT",
		version: "1.0.0",
	});

	async init() {
		// ChatGPT-required search tool
		this.server.tool(
			"search",
			{
				query: z.string().describe("Natural language search query"),
				options: z.object({
					limit: z.number().default(20),
					offset: z.number().default(0)
				}).optional()
			},
			async ({ query, options }) => {
				const limit = options?.limit || 20;
				const response = await fetch("https://burns-legal-chatgpt.rburns-fresno.workers.dev", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						jsonrpc: "2.0",
						id: 1,
						method: "tools/call",
						params: { name: "search", arguments: { query, options: { limit } } }
					})
				});
				const data = await response.json();
				return data.result || { content: [{ type: "text", text: "Search failed" }] };
			}
		);

		// ChatGPT-required fetch tool
		this.server.tool(
			"fetch",
			{
				id: z.string().describe("Resource ID to fetch (e.g., Ex001, claim_123, doc id)")
			},
			async ({ id }) => {
				const response = await fetch("https://burns-legal-chatgpt.rburns-fresno.workers.dev", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						jsonrpc: "2.0",
						id: 1,
						method: "tools/call",
						params: { name: "fetch", arguments: { id } }
					})
				});
				const data = await response.json();
				return data.result || { content: [{ type: "text", text: "Resource not found" }] };
			}
		);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return BurnsLegalChatGPT.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return BurnsLegalChatGPT.serve("/mcp").fetch(request, env, ctx);
		}

		// Discovery endpoint
		if (url.pathname === "/.well-known/mcp.json") {
			return new Response(JSON.stringify({
				mcpVersion: "2025-06-18",
				name: "Burns Legal ChatGPT",
				description: "Burns Legal MCP optimized for ChatGPT",
				vendor: "Burns Legal",
				authorization: { type: "none" },
				capabilities: {
					tools: { listChanged: true },
					prompts: { listChanged: false },
					resources: { listChanged: false }
				},
				endpoints: {
					http: "/mcp",
					sse: "/sse"
				}
			}, null, 2), {
				headers: { "Content-Type": "application/json" }
			});
		}

		return new Response("Not found", { status: 404 });
	},
};