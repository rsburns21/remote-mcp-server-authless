import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Burns Legal Remote - Unified for Claude + ChatGPT
export class BurnsLegalRemote extends McpAgent {
	server = new McpServer({
		name: "Burns Legal Remote",
		version: "1.0.0",
	});

	async init() {
		// Universal search tool (ChatGPT-compatible name)
		this.server.tool(
			"search",
			{
				query: z.string().describe("Natural language query"),
				limit: z.number().min(1).max(100).default(20)
			},
			async ({ query, limit }) => {
				const response = await fetch("https://burns-legal-remote.rburns-fresno.workers.dev", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						jsonrpc: "2.0",
						id: 1,
						method: "tools/call",
						params: { name: "search", arguments: { query, limit } }
					})
				});
				const data = await response.json();
				return data.result || { content: [{ type: "text", text: "Search failed" }] };
			}
		);

		// Universal fetch tool (ChatGPT-compatible name)
		this.server.tool(
			"fetch",
			{
				id: z.string().describe("Resource ID (Ex###, claim_*, numeric, or doc id)")
			},
			async ({ id }) => {
				const response = await fetch("https://burns-legal-remote.rburns-fresno.workers.dev", {
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

		// Vector search embeddings
		this.server.tool(
			"vector_search_embeddings",
			{
				query: z.string(),
				limit: z.number().min(1).max(100).default(20),
				threshold: z.number().min(0).max(1).default(0.7)
			},
			async ({ query, limit, threshold }) => {
				const response = await fetch("https://burns-legal-remote.rburns-fresno.workers.dev", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						jsonrpc: "2.0",
						id: 1,
						method: "tools/call",
						params: { name: "vector_search_embeddings", arguments: { query, limit, threshold } }
					})
				});
				const data = await response.json();
				return data.result || { content: [{ type: "text", text: "Vector search failed" }] };
			}
		);

		// Keyword search
		this.server.tool(
			"keyword_search",
			{
				query: z.string(),
				limit: z.number().default(20)
			},
			async ({ query, limit }) => {
				const response = await fetch("https://burns-legal-remote.rburns-fresno.workers.dev", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						jsonrpc: "2.0",
						id: 1,
						method: "tools/call",
						params: { name: "keyword_search", arguments: { query, limit } }
					})
				});
				const data = await response.json();
				return data.result || { content: [{ type: "text", text: "Keyword search failed" }] };
			}
		);

		// Fetch exhibit
		this.server.tool(
			"fetch_exhibit",
			{
				id: z.string()
			},
			async ({ id }) => {
				const response = await fetch("https://burns-legal-remote.rburns-fresno.workers.dev", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						jsonrpc: "2.0",
						id: 1,
						method: "tools/call",
						params: { name: "fetch_exhibit", arguments: { id } }
					})
				});
				const data = await response.json();
				return data.result || { content: [{ type: "text", text: "Exhibit not found" }] };
			}
		);

		// Fetch claim
		this.server.tool(
			"fetch_claim",
			{
				claim_id: z.string()
			},
			async ({ claim_id }) => {
				const response = await fetch("https://burns-legal-remote.rburns-fresno.workers.dev", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						jsonrpc: "2.0",
						id: 1,
						method: "tools/call",
						params: { name: "fetch_claim", arguments: { claim_id } }
					})
				});
				const data = await response.json();
				return data.result || { content: [{ type: "text", text: "Claim not found" }] };
			}
		);

		// Get facts by claim
		this.server.tool(
			"get_facts_by_claim",
			{
				claim_id: z.string(),
				fact_type: z.string().optional(),
				includeMetadata: z.boolean().default(false)
			},
			async ({ claim_id, fact_type, includeMetadata }) => {
				const response = await fetch("https://burns-legal-remote.rburns-fresno.workers.dev", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						jsonrpc: "2.0",
						id: 1,
						method: "tools/call",
						params: { name: "get_facts_by_claim", arguments: { claim_id, fact_type, includeMetadata } }
					})
				});
				const data = await response.json();
				return data.result || { content: [{ type: "text", text: "No facts found" }] };
			}
		);

		// Analyze claim risk
		this.server.tool(
			"analyze_claim_risk",
			{
				claim_id: z.string()
			},
			async ({ claim_id }) => {
				const response = await fetch("https://burns-legal-remote.rburns-fresno.workers.dev", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						jsonrpc: "2.0",
						id: 1,
						method: "tools/call",
						params: { name: "analyze_claim_risk", arguments: { claim_id } }
					})
				});
				const data = await response.json();
				return data.result || { content: [{ type: "text", text: "Risk analysis failed" }] };
			}
		);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return BurnsLegalRemote.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return BurnsLegalRemote.serve("/mcp").fetch(request, env, ctx);
		}

		// Discovery endpoint
		if (url.pathname === "/.well-known/mcp.json") {
			return new Response(JSON.stringify({
				mcpVersion: "2025-06-18",
				name: "Burns Legal Remote",
				description: "Unified MCP server (Claude + ChatGPT)",
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