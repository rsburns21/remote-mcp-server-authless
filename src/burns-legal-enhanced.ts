import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Keep the old class name for backward compatibility
export class BurnsLegalEnhancedMCP extends McpAgent {
	server = new McpServer({
		name: "Burns Legal Enhanced",
		version: "1.0.0",
	});

	async init() {
		// Empty init for backward compatibility
	}
}

// Burns Legal Enhanced - Complete implementation with all 16 tools
export class BurnsLegalEnhanced extends McpAgent {
	server = new McpServer({
		name: "Burns Legal Enhanced",
		version: "1.0.0",
	});

	async init() {
		// Universal search tool (ChatGPT-compatible name)
		this.server.tool(
			"search",
			{
				query: z.string().describe("Natural language query"),
				limit: z.number().min(1).max(100).default(20).optional(),
				offset: z.number().default(0).optional()
			},
			async ({ query, limit = 20, offset = 0 }) => {
				const response = await fetch("https://burns-legal-enhanced-authless.rburns-fresno.workers.dev", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						jsonrpc: "2.0",
						id: 1,
						method: "tools/call",
						params: { name: "search", arguments: { query, limit, offset } }
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
				id: z.string().describe("Resource ID (Ex###, claim_*, fact_*, numeric, or doc id)")
			},
			async ({ id }) => {
				const response = await fetch("https://burns-legal-enhanced-authless.rburns-fresno.workers.dev", {
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
				query: z.string().describe("Search query text"),
				limit: z.number().min(1).max(100).default(20),
				threshold: z.number().min(0).max(1).default(0.7)
			},
			async ({ query, limit, threshold }) => {
				const response = await fetch("https://burns-legal-enhanced-authless.rburns-fresno.workers.dev", {
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
				query: z.string().describe("Keyword search query"),
				limit: z.number().min(1).max(100).default(20)
			},
			async ({ query, limit }) => {
				const response = await fetch("https://burns-legal-enhanced-authless.rburns-fresno.workers.dev", {
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
				id: z.string().describe("Exhibit ID (e.g., Ex001, FL_exhibit_001)")
			},
			async ({ id }) => {
				const response = await fetch("https://burns-legal-enhanced-authless.rburns-fresno.workers.dev", {
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

		// List exhibits
		this.server.tool(
			"list_exhibits",
			{
				case_type: z.enum(["Floorable", "Mannington"]).optional().describe("Filter by case type"),
				limit: z.number().min(1).max(200).default(50),
				offset: z.number().default(0)
			},
			async ({ case_type, limit, offset }) => {
				const response = await fetch("https://burns-legal-enhanced-authless.rburns-fresno.workers.dev", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						jsonrpc: "2.0",
						id: 1,
						method: "tools/call",
						params: { name: "list_exhibits", arguments: { case_type, limit, offset } }
					})
				});
				const data = await response.json();
				return data.result || { content: [{ type: "text", text: "Failed to list exhibits" }] };
			}
		);

		// Fetch claim
		this.server.tool(
			"fetch_claim",
			{
				claim_id: z.string().describe("Claim ID (e.g., claim_001, 123)")
			},
			async ({ claim_id }) => {
				const response = await fetch("https://burns-legal-enhanced-authless.rburns-fresno.workers.dev", {
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

		// List claims
		this.server.tool(
			"list_claims",
			{
				claim_type: z.string().optional().describe("Filter by claim type"),
				status: z.string().optional().describe("Filter by status"),
				limit: z.number().min(1).max(200).default(50)
			},
			async ({ claim_type, status, limit }) => {
				const response = await fetch("https://burns-legal-enhanced-authless.rburns-fresno.workers.dev", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						jsonrpc: "2.0",
						id: 1,
						method: "tools/call",
						params: { name: "list_claims", arguments: { claim_type, status, limit } }
					})
				});
				const data = await response.json();
				return data.result || { content: [{ type: "text", text: "Failed to list claims" }] };
			}
		);

		// Get facts by claim
		this.server.tool(
			"get_facts_by_claim",
			{
				claim_id: z.string().describe("Claim ID"),
				fact_type: z.string().optional().describe("Optional fact type filter"),
				includeMetadata: z.boolean().default(false).describe("Include full metadata")
			},
			async ({ claim_id, fact_type, includeMetadata }) => {
				const response = await fetch("https://burns-legal-enhanced-authless.rburns-fresno.workers.dev", {
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

		// Get facts by exhibit
		this.server.tool(
			"get_facts_by_exhibit",
			{
				exhibit_id: z.string().describe("Exhibit ID"),
				fact_type: z.string().optional().describe("Optional fact type filter")
			},
			async ({ exhibit_id, fact_type }) => {
				const response = await fetch("https://burns-legal-enhanced-authless.rburns-fresno.workers.dev", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						jsonrpc: "2.0",
						id: 1,
						method: "tools/call",
						params: { name: "get_facts_by_exhibit", arguments: { exhibit_id, fact_type } }
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
				claim_id: z.string().describe("Claim ID to analyze")
			},
			async ({ claim_id }) => {
				const response = await fetch("https://burns-legal-enhanced-authless.rburns-fresno.workers.dev", {
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

		// Get exhibit relationships
		this.server.tool(
			"get_exhibit_relationships",
			{
				exhibit_id: z.string().describe("Starting exhibit ID"),
				depth: z.number().min(1).max(3).default(1).describe("Relationship depth")
			},
			async ({ exhibit_id, depth }) => {
				const response = await fetch("https://burns-legal-enhanced-authless.rburns-fresno.workers.dev", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						jsonrpc: "2.0",
						id: 1,
						method: "tools/call",
						params: { name: "get_exhibit_relationships", arguments: { exhibit_id, depth } }
					})
				});
				const data = await response.json();
				return data.result || { content: [{ type: "text", text: "Failed to get relationships" }] };
			}
		);

		// Get entities
		this.server.tool(
			"get_entities",
			{
				entity_type: z.string().optional().describe("Filter by entity type"),
				role: z.string().optional().describe("Filter by role in case")
			},
			async ({ entity_type, role }) => {
				const response = await fetch("https://burns-legal-enhanced-authless.rburns-fresno.workers.dev", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						jsonrpc: "2.0",
						id: 1,
						method: "tools/call",
						params: { name: "get_entities", arguments: { entity_type, role } }
					})
				});
				const data = await response.json();
				return data.result || { content: [{ type: "text", text: "Failed to get entities" }] };
			}
		);

		// Get individuals
		this.server.tool(
			"get_individuals",
			{
				role: z.string().optional().describe("Filter by role (e.g., plaintiff, defendant, witness)"),
				entity_id: z.string().optional().describe("Filter by associated entity")
			},
			async ({ role, entity_id }) => {
				const response = await fetch("https://burns-legal-enhanced-authless.rburns-fresno.workers.dev", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						jsonrpc: "2.0",
						id: 1,
						method: "tools/call",
						params: { name: "get_individuals", arguments: { role, entity_id } }
					})
				});
				const data = await response.json();
				return data.result || { content: [{ type: "text", text: "Failed to get individuals" }] };
			}
		);

		// Get case statistics
		this.server.tool(
			"get_case_statistics",
			{
				case_name: z.string().optional().describe("Optional case filter (Floorable or Mannington)")
			},
			async ({ case_name }) => {
				const response = await fetch("https://burns-legal-enhanced-authless.rburns-fresno.workers.dev", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						jsonrpc: "2.0",
						id: 1,
						method: "tools/call",
						params: { name: "get_case_statistics", arguments: { case_name } }
					})
				});
				const data = await response.json();
				return data.result || { content: [{ type: "text", text: "Failed to get statistics" }] };
			}
		);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return BurnsLegalEnhanced.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return BurnsLegalEnhanced.serve("/mcp").fetch(request, env, ctx);
		}

		// Discovery endpoint
		if (url.pathname === "/.well-known/mcp.json") {
			return new Response(JSON.stringify({
				mcpVersion: "2025-06-18",
				name: "Burns Legal Enhanced",
				description: "Enhanced Burns Legal MCP Server with 16 comprehensive tools",
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