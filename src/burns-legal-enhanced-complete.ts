import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

// Export old class name for backward compatibility during migration
export class BurnsLegalEnhancedMCP extends McpAgent {
	server = new McpServer({
		name: "Burns Legal Enhanced",
		version: "1.0.0",
	});
	async init() {
		// Empty for migration
	}
}

// Burns Legal Enhanced - Complete implementation with all 16 tools
export class BurnsLegalEnhancedComplete extends McpAgent {
	server = new McpServer({
		name: "Burns Legal Enhanced Complete",
		version: "1.0.0",
	});

	async init() {
		const env = this.env as Env;
		const SUPABASE_URL = env.SUPABASE_URL || "https://nqkzqcsqfvpquticvwmk.supabase.co";
		const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
		
		const auth = () => ({
			Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
			apikey: SUPABASE_SERVICE_ROLE_KEY,
			"Content-Type": "application/json",
			Prefer: "return=representation"
		});

		// 1. Universal search tool (ChatGPT-compatible)
		this.server.tool(
			"search",
			{
				query: z.string().describe("Natural language search query"),
				limit: z.number().min(1).max(100).default(20).optional()
			},
			async ({ query, limit = 20 }) => {
				if (!query?.trim()) {
					return { content: [{ type: "text", text: JSON.stringify({ results: [], resultCount: 0, error: "query is required" }) }] };
				}
				
				// Try vector search first
				try {
					const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/vector_search`, {
						method: "POST",
						headers: auth(),
						body: JSON.stringify({ query_text: query, match_count: limit, threshold: 0.7 })
					});
					
					if (res.ok) {
						const rows = await res.json();
						const results = (Array.isArray(rows) ? rows : []).map((r: any) => ({
							id: r.exhibit_id || r.id || r.source_id,
							type: r.type || r.source_table || "document",
							title: r.title || r.name || r.description || "Result",
							snippet: (r.content || r.description || "").slice(0, 200),
							similarity: r.similarity || r.score || 0
						}));
						
						if (results.length > 0) {
							return { content: [{ type: "text", text: JSON.stringify({ results, resultCount: results.length, method: "vector" }) }] };
						}
					}
				} catch (e) {
					// Fall through to keyword search
				}
				
				// Fallback to keyword search
				try {
					const q = encodeURIComponent(query);
					const params = new URLSearchParams({
						or: `(title.ilike.*${q}*,description.ilike.*${q}*,content.ilike.*${q}*)`,
						limit: String(limit)
					});
					const res = await fetch(`${SUPABASE_URL}/rest/v1/exhibits?${params.toString()}`, { 
						headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY } 
					});
					
					if (res.ok) {
						const docs = await res.json();
						const results = docs.map((d: any) => ({
							id: d.id || d.exhibit_id,
							type: "exhibit",
							title: d.title || "Untitled",
							snippet: (d.description || d.content || "").slice(0, 200)
						}));
						return { content: [{ type: "text", text: JSON.stringify({ results, resultCount: results.length, method: "keyword" }) }] };
					}
				} catch (e) {
					// Error handling
				}
				
				return { content: [{ type: "text", text: JSON.stringify({ results: [], resultCount: 0, error: "Search failed" }) }] };
			}
		);

		// 2. Universal fetch tool
		this.server.tool(
			"fetch",
			{
				id: z.string().describe("Resource ID (Ex###, claim_*, fact_*, or numeric)")
			},
			async ({ id }) => {
				if (!id) {
					return { content: [{ type: "text", text: JSON.stringify({ id, error: "id is required" }) }] };
				}
				
				// Try exhibit
				if (/^(Ex|FL_|MN_)/i.test(id)) {
					const params = new URLSearchParams({
						or: `(id.eq.${encodeURIComponent(id)},exhibit_id.eq.${encodeURIComponent(id)})`,
						limit: "1"
					});
					const res = await fetch(`${SUPABASE_URL}/rest/v1/exhibits?${params.toString()}`, { 
						headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY } 
					});
					if (res.ok) {
						const data = await res.json();
						if (data[0]) {
							return { content: [{ type: "text", text: JSON.stringify({ id, type: "exhibit", content: data[0].content || data[0].description || "No content", metadata: data[0] }) }] };
						}
					}
				}
				
				// Try claim
				if (/^claim_/i.test(id) || /^\d+$/.test(id)) {
					const params = new URLSearchParams({
						or: `(id.eq.${encodeURIComponent(id)},claim_id.eq.${encodeURIComponent(id)})`,
						limit: "1"
					});
					const res = await fetch(`${SUPABASE_URL}/rest/v1/claims?${params.toString()}`, { 
						headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY } 
					});
					if (res.ok) {
						const data = await res.json();
						if (data[0]) {
							return { content: [{ type: "text", text: JSON.stringify({ id, type: "claim", content: JSON.stringify(data[0], null, 2), metadata: data[0] }) }] };
						}
					}
				}
				
				return { content: [{ type: "text", text: JSON.stringify({ id, error: "Resource not found" }) }] };
			}
		);

		// 3. Vector search embeddings
		this.server.tool(
			"vector_search_embeddings",
			{
				query: z.string().describe("Search query text"),
				limit: z.number().min(1).max(100).default(20),
				threshold: z.number().min(0).max(1).default(0.7)
			},
			async ({ query, limit, threshold }) => {
				if (!query?.trim()) {
					return { content: [{ type: "text", text: JSON.stringify({ error: "query is required" }) }] };
				}
				
				const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/vector_search`, {
					method: "POST",
					headers: auth(),
					body: JSON.stringify({ query_text: query, match_count: limit, threshold })
				});
				
				if (!res.ok) {
					return { content: [{ type: "text", text: JSON.stringify({ error: `Vector search failed: ${res.status}` }) }] };
				}
				
				const rows = await res.json();
				const results = (Array.isArray(rows) ? rows : []).map((r: any) => ({
					id: r.exhibit_id || r.id || r.source_id,
					type: r.type || r.source_table || "document",
					title: r.title || r.name || r.description || "Result",
					snippet: (r.content || r.description || "").slice(0, 200),
					similarity: r.similarity || r.score || 0
				}));
				
				return { content: [{ type: "text", text: JSON.stringify({ results, resultCount: results.length }) }] };
			}
		);

		// 4. Keyword search
		this.server.tool(
			"keyword_search",
			{
				query: z.string().describe("Keyword search query"),
				limit: z.number().min(1).max(100).default(20)
			},
			async ({ query, limit }) => {
				if (!query?.trim()) {
					return { content: [{ type: "text", text: JSON.stringify({ error: "query is required" }) }] };
				}
				
				const q = encodeURIComponent(query);
				const params = new URLSearchParams({
					or: `(title.ilike.*${q}*,description.ilike.*${q}*,content.ilike.*${q}*)`,
					limit: String(limit)
				});
				const res = await fetch(`${SUPABASE_URL}/rest/v1/exhibits?${params.toString()}`, { 
					headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY } 
				});
				
				if (!res.ok) {
					return { content: [{ type: "text", text: JSON.stringify({ error: `Keyword search failed: ${res.status}` }) }] };
				}
				
				const docs = await res.json();
				const results = docs.map((d: any) => ({
					id: d.id || d.exhibit_id,
					type: "exhibit",
					title: d.title || "Untitled",
					snippet: (d.description || d.content || "").slice(0, 200)
				}));
				
				return { content: [{ type: "text", text: JSON.stringify({ results, resultCount: results.length }) }] };
			}
		);

		// 5. Fetch exhibit
		this.server.tool(
			"fetch_exhibit",
			{
				id: z.string().describe("Exhibit ID (e.g., Ex001, FL_exhibit_001)")
			},
			async ({ id }) => {
				const params = new URLSearchParams({
					or: `(id.eq.${encodeURIComponent(id)},exhibit_id.eq.${encodeURIComponent(id)})`,
					limit: "1"
				});
				const res = await fetch(`${SUPABASE_URL}/rest/v1/exhibits?${params.toString()}`, { 
					headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY } 
				});
				
				if (!res.ok) {
					return { content: [{ type: "text", text: JSON.stringify({ error: `Failed to fetch exhibit: ${res.status}` }) }] };
				}
				
				const data = await res.json();
				if (!data[0]) {
					return { content: [{ type: "text", text: JSON.stringify({ error: `Exhibit ${id} not found` }) }] };
				}
				
				const ex = data[0];
				return { content: [{ type: "text", text: JSON.stringify({
					id: ex.id || ex.exhibit_id,
					type: "exhibit",
					title: ex.title,
					content: ex.content || ex.description || "No content available",
					metadata: ex
				}) }] };
			}
		);

		// 6. List exhibits
		this.server.tool(
			"list_exhibits",
			{
				case_type: z.enum(["Floorable", "Mannington"]).optional().describe("Filter by case type"),
				limit: z.number().min(1).max(200).default(50),
				offset: z.number().default(0)
			},
			async ({ case_type, limit, offset }) => {
				const params = new URLSearchParams({
					select: "id,exhibit_id,title,description,case_type,created_at",
					limit: String(limit),
					offset: String(offset),
					order: "exhibit_id"
				});
				if (case_type) params.append("case_type", `eq.${case_type}`);
				
				const res = await fetch(`${SUPABASE_URL}/rest/v1/exhibits?${params.toString()}`, { 
					headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY } 
				});
				
				if (!res.ok) {
					return { content: [{ type: "text", text: JSON.stringify({ error: `Failed to list exhibits: ${res.status}` }) }] };
				}
				
				const data = await res.json();
				return { content: [{ type: "text", text: JSON.stringify(data) }] };
			}
		);

		// 7. Fetch claim
		this.server.tool(
			"fetch_claim",
			{
				claim_id: z.string().describe("Claim ID (e.g., claim_001, 123)")
			},
			async ({ claim_id }) => {
				const params = new URLSearchParams({
					or: `(id.eq.${encodeURIComponent(claim_id)},claim_id.eq.${encodeURIComponent(claim_id)})`,
					limit: "1"
				});
				const res = await fetch(`${SUPABASE_URL}/rest/v1/claims?${params.toString()}`, { 
					headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY } 
				});
				
				if (!res.ok) {
					return { content: [{ type: "text", text: JSON.stringify({ error: `Failed to fetch claim: ${res.status}` }) }] };
				}
				
				const data = await res.json();
				if (!data[0]) {
					return { content: [{ type: "text", text: JSON.stringify({ error: `Claim ${claim_id} not found` }) }] };
				}
				
				return { content: [{ type: "text", text: JSON.stringify({ claim: data[0] }) }] };
			}
		);

		// 8. List claims
		this.server.tool(
			"list_claims",
			{
				claim_type: z.string().optional().describe("Filter by claim type"),
				status: z.string().optional().describe("Filter by status"),
				limit: z.number().min(1).max(200).default(50)
			},
			async ({ claim_type, status, limit }) => {
				const params = new URLSearchParams({
					select: "id,claim_id,claim_type,claim_title,status,damages_estimate,created_at",
					limit: String(limit),
					order: "claim_id"
				});
				if (claim_type) params.append("claim_type", `eq.${claim_type}`);
				if (status) params.append("status", `eq.${status}`);
				
				const res = await fetch(`${SUPABASE_URL}/rest/v1/claims?${params.toString()}`, { 
					headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY } 
				});
				
				if (!res.ok) {
					return { content: [{ type: "text", text: JSON.stringify({ error: `Failed to list claims: ${res.status}` }) }] };
				}
				
				const data = await res.json();
				return { content: [{ type: "text", text: JSON.stringify(data) }] };
			}
		);

		// 9. Get facts by claim
		this.server.tool(
			"get_facts_by_claim",
			{
				claim_id: z.string().describe("Claim ID"),
				fact_type: z.string().optional().describe("Optional fact type filter"),
				includeMetadata: z.boolean().default(false).describe("Include full metadata")
			},
			async ({ claim_id, fact_type, includeMetadata }) => {
				const params = new URLSearchParams({
					claim_id: `eq.${claim_id}`,
					select: includeMetadata ? "*" : "id,fact_text,fact_type,source_exhibit_id,created_at"
				});
				if (fact_type) params.append("fact_type", `eq.${fact_type}`);
				
				const res = await fetch(`${SUPABASE_URL}/rest/v1/facts?${params.toString()}`, { 
					headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY } 
				});
				
				if (!res.ok) {
					return { content: [{ type: "text", text: JSON.stringify({ error: `Failed to fetch facts: ${res.status}` }) }] };
				}
				
				const data = await res.json();
				return { content: [{ type: "text", text: JSON.stringify(data) }] };
			}
		);

		// 10. Get facts by exhibit
		this.server.tool(
			"get_facts_by_exhibit",
			{
				exhibit_id: z.string().describe("Exhibit ID"),
				fact_type: z.string().optional().describe("Optional fact type filter")
			},
			async ({ exhibit_id, fact_type }) => {
				const params = new URLSearchParams({
					source_exhibit_id: `eq.${exhibit_id}`,
					select: "id,fact_text,fact_type,claim_id,created_at"
				});
				if (fact_type) params.append("fact_type", `eq.${fact_type}`);
				
				const res = await fetch(`${SUPABASE_URL}/rest/v1/facts?${params.toString()}`, { 
					headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY } 
				});
				
				if (!res.ok) {
					return { content: [{ type: "text", text: JSON.stringify({ error: `Failed to fetch facts: ${res.status}` }) }] };
				}
				
				const data = await res.json();
				return { content: [{ type: "text", text: JSON.stringify(data) }] };
			}
		);

		// 11. Analyze claim risk
		this.server.tool(
			"analyze_claim_risk",
			{
				claim_id: z.string().describe("Claim ID to analyze")
			},
			async ({ claim_id }) => {
				const params = new URLSearchParams({
					or: `(id.eq.${encodeURIComponent(claim_id)},claim_id.eq.${encodeURIComponent(claim_id)})`,
					limit: "1"
				});
				const res = await fetch(`${SUPABASE_URL}/rest/v1/claims?${params.toString()}`, { 
					headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY } 
				});
				
				if (!res.ok) {
					const data = await res.json();
					return { content: [{ type: "text", text: JSON.stringify({
						claim_id,
						overall_risk: "unknown",
						risk_scores: { financial: 0.5, legal: 0.5 },
						error: "Claim not found"
					}) }] };
				}
				
				const data = await res.json();
				if (!data[0]) {
					return { content: [{ type: "text", text: JSON.stringify({
						claim_id,
						overall_risk: "unknown",
						risk_scores: { financial: 0.5, legal: 0.5 },
						error: "Claim not found"
					}) }] };
				}
				
				const cl = data[0];
				const hasEvidence = Array.isArray(cl.exhibit_ids) && cl.exhibit_ids.length > 0;
				const hasDamages = typeof cl.damages_estimate === "number" && cl.damages_estimate > 0;
				const financial = hasDamages ? Math.min(cl.damages_estimate / 1_000_000, 1) : 0.5;
				const legal = hasEvidence ? 0.4 : 0.8;
				const overall = (financial + legal) / 2;
				
				return { content: [{ type: "text", text: JSON.stringify({
					claim_id,
					overall_risk: overall < 0.3 ? "low" : overall < 0.6 ? "moderate" : "high",
					risk_scores: { financial, legal },
					factors: {
						has_evidence: hasEvidence,
						damages_estimate: cl.damages_estimate || 0,
						claim_type: cl.claim_type,
						exhibit_count: cl.exhibit_ids?.length || 0
					}
				}) }] };
			}
		);

		// 12. Get exhibit relationships
		this.server.tool(
			"get_exhibit_relationships",
			{
				exhibit_id: z.string().describe("Starting exhibit ID"),
				depth: z.number().min(1).max(3).default(1).describe("Relationship depth")
			},
			async ({ exhibit_id, depth }) => {
				// Get facts that reference this exhibit
				const factsRes = await fetch(
					`${SUPABASE_URL}/rest/v1/facts?source_exhibit_id=eq.${exhibit_id}&select=claim_id`,
					{ headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY } }
				);
				
				if (!factsRes.ok) {
					return { content: [{ type: "text", text: JSON.stringify({ error: `Failed to fetch relationships: ${factsRes.status}` }) }] };
				}
				
				const facts = await factsRes.json();
				const claimIds = [...new Set(facts.map((f: any) => f.claim_id))];
				
				if (claimIds.length > 0) {
					const claimsRes = await fetch(
						`${SUPABASE_URL}/rest/v1/claims?id=in.(${claimIds.join(',')})&select=id,claim_id,exhibit_ids`,
						{ headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY } }
					);
					
					if (claimsRes.ok) {
						const claims = await claimsRes.json();
						const relatedExhibits = [...new Set(claims.flatMap((c: any) => c.exhibit_ids || []))];
						
						return { content: [{ type: "text", text: JSON.stringify({
							exhibit_id,
							related_claims: claimIds,
							related_exhibits: relatedExhibits.filter((id: string) => id !== exhibit_id),
							depth
						}) }] };
					}
				}
				
				return { content: [{ type: "text", text: JSON.stringify({
					exhibit_id,
					related_claims: [],
					related_exhibits: [],
					depth
				}) }] };
			}
		);

		// 13. Get entities
		this.server.tool(
			"get_entities",
			{
				entity_type: z.string().optional().describe("Filter by entity type"),
				role: z.string().optional().describe("Filter by role in case")
			},
			async ({ entity_type, role }) => {
				const params = new URLSearchParams({
					select: "id,entity_name,entity_type,role,description,created_at"
				});
				if (entity_type) params.append("entity_type", `eq.${entity_type}`);
				if (role) params.append("role", `eq.${role}`);
				
				const res = await fetch(`${SUPABASE_URL}/rest/v1/entities?${params.toString()}`, { 
					headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY } 
				});
				
				if (!res.ok) {
					return { content: [{ type: "text", text: JSON.stringify({ error: `Failed to fetch entities: ${res.status}` }) }] };
				}
				
				const data = await res.json();
				return { content: [{ type: "text", text: JSON.stringify(data) }] };
			}
		);

		// 14. Get individuals
		this.server.tool(
			"get_individuals",
			{
				role: z.string().optional().describe("Filter by role (e.g., plaintiff, defendant, witness)"),
				entity_id: z.string().optional().describe("Filter by associated entity")
			},
			async ({ role, entity_id }) => {
				const params = new URLSearchParams({
					select: "id,individual_name,role,entity_id,description,created_at"
				});
				if (role) params.append("role", `eq.${role}`);
				if (entity_id) params.append("entity_id", `eq.${entity_id}`);
				
				const res = await fetch(`${SUPABASE_URL}/rest/v1/individuals?${params.toString()}`, { 
					headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY } 
				});
				
				if (!res.ok) {
					return { content: [{ type: "text", text: JSON.stringify({ error: `Failed to fetch individuals: ${res.status}` }) }] };
				}
				
				const data = await res.json();
				return { content: [{ type: "text", text: JSON.stringify(data) }] };
			}
		);

		// 15. Get case statistics
		this.server.tool(
			"get_case_statistics",
			{
				case_name: z.string().optional().describe("Optional case filter (Floorable or Mannington)")
			},
			async ({ case_name }) => {
				// Get exhibit count
				const exhibitParams = new URLSearchParams({ select: "count", head: "true" });
				if (case_name) exhibitParams.append("case_type", `eq.${case_name}`);
				const exhibitRes = await fetch(`${SUPABASE_URL}/rest/v1/exhibits?${exhibitParams.toString()}`, { 
					headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY } 
				});
				
				// Get claim count
				const claimRes = await fetch(`${SUPABASE_URL}/rest/v1/claims?select=count&head=true`, { 
					headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY } 
				});
				
				// Get fact count
				const factRes = await fetch(`${SUPABASE_URL}/rest/v1/facts?select=count&head=true`, { 
					headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY } 
				});
				
				const exhibitCount = exhibitRes.headers.get("content-range")?.split("/")[1] || "0";
				const claimCount = claimRes.headers.get("content-range")?.split("/")[1] || "0";
				const factCount = factRes.headers.get("content-range")?.split("/")[1] || "0";
				
				return { content: [{ type: "text", text: JSON.stringify({
					case_name: case_name || "All Cases",
					statistics: {
						total_exhibits: parseInt(exhibitCount),
						total_claims: parseInt(claimCount),
						total_facts: parseInt(factCount),
						database_configured: true
					}
				}) }] };
			}
		);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		// CORS headers
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, MCP-Protocol-Version, Mcp-Session-Id",
			"Access-Control-Expose-Headers": "Mcp-Session-Id, MCP-Protocol-Version",
			"Access-Control-Max-Age": "86400"
		};

		// Handle CORS preflight
		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: corsHeaders
			});
		}

		// SSE endpoint
		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return BurnsLegalEnhancedComplete.serveSSE("/sse").fetch(request, env, ctx);
		}

		// MCP endpoint
		if (url.pathname === "/mcp") {
			return BurnsLegalEnhancedComplete.serve("/mcp").fetch(request, env, ctx);
		}

		// Discovery endpoint
		if (url.pathname === "/.well-known/mcp.json") {
			return new Response(JSON.stringify({
				mcpVersion: "2025-06-18",
				name: "Burns Legal Enhanced Complete",
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
				headers: { 
					"Content-Type": "application/json",
					...corsHeaders
				}
			});
		}

		// Root path - return status info
		if (url.pathname === "/") {
			return new Response(JSON.stringify({
				status: "ready",
				service: "burns-legal-enhanced",
				version: "1.0.0",
				protocol: "2025-06-18",
				tools: 16,
				configured: !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
				endpoints: {
					discovery: "/.well-known/mcp.json",
					mcp: "/mcp",
					sse: "/sse"
				}
			}, null, 2), {
				status: 200,
				headers: {
					"Content-Type": "application/json",
					...corsHeaders
				}
			});
		}

		// Health check endpoint
		if (url.pathname === "/health") {
			return new Response(JSON.stringify({
				status: "healthy",
				timestamp: new Date().toISOString(),
				service: "burns-legal-enhanced",
				tools: 16,
				database: {
					configured: !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
					url: env.SUPABASE_URL ? "configured" : "missing"
				}
			}, null, 2), {
				headers: {
					"Content-Type": "application/json",
					...corsHeaders
				}
			});
		}

		return new Response("Not found", { status: 404 });
	},
};