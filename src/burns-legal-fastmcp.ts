import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Burns Legal FastMCP - Comprehensive legal tools
export class BurnsLegalFastMCP extends McpAgent {
	server = new McpServer({
		name: "Burns Legal FastMCP",
		version: "1.0.0",
	});

	async init() {
		// Search legal documents
		this.server.tool(
			"search_legal_documents",
			{
				query: z.string().describe("Search query keywords"),
				limit: z.number().min(1).max(100).default(10).describe("Maximum number of results"),
			},
			async ({ query, limit }) => {
				const response = await fetch("https://burns-legal-fastmcp.rburns-fresno.workers.dev", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						jsonrpc: "2.0",
						id: 1,
						method: "tools/call",
						params: { name: "search_legal_documents", arguments: { query, limit } }
					})
				});
				const data = await response.json();
				return data.result || { content: [{ type: "text", text: "Search failed" }] };
			}
		);

		// Vector search with embeddings
		this.server.tool(
			"vector_search_embeddings",
			{
				query: z.string().describe("Natural language query"),
				limit: z.number().min(1).max(100).default(20),
				threshold: z.number().min(0).max(1).default(0.7),
			},
			async ({ query, limit, threshold }) => {
				const response = await fetch("https://burns-legal-fastmcp.rburns-fresno.workers.dev", {
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

		// Fetch exhibit
		this.server.tool(
			"fetch_exhibit",
			{
				id: z.string().describe("Exhibit ID to fetch"),
			},
			async ({ id }) => {
				const response = await fetch("https://burns-legal-fastmcp.rburns-fresno.workers.dev", {
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

		// Fetch claim with related data
		this.server.tool(
			"fetch_claim",
			{
				claim_id: z.string().describe("Claim ID to fetch"),
				include: z.array(z.enum(["facts", "exhibits", "entities", "individuals", "statutes"])).default([]),
			},
			async ({ claim_id, include }) => {
				const response = await fetch("https://burns-legal-fastmcp.rburns-fresno.workers.dev", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						jsonrpc: "2.0",
						id: 1,
						method: "tools/call",
						params: { name: "fetch_claim", arguments: { claim_id, include } }
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
				claim_id: z.string().describe("Claim ID"),
				fact_type: z.string().optional(),
				includeMetadata: z.boolean().default(false),
			},
			async ({ claim_id, fact_type, includeMetadata }) => {
				const response = await fetch("https://burns-legal-fastmcp.rburns-fresno.workers.dev", {
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
				claim_id: z.string().describe("Claim ID to analyze"),
			},
			async ({ claim_id }) => {
				const response = await fetch("https://burns-legal-fastmcp.rburns-fresno.workers.dev", {
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
			return BurnsLegalFastMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return BurnsLegalFastMCP.serve("/mcp").fetch(request, env, ctx);
		}

		// Add discovery endpoint
		if (url.pathname === "/.well-known/mcp.json") {
			return new Response(JSON.stringify({
				mcpVersion: "2025-06-18",
				name: "Burns Legal FastMCP",
				description: "Comprehensive legal search and analysis",
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