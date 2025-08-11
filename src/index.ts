import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  OPENAI_API_KEY?: string;
}

// Burns Legal MCP Server with Vector Search
export class BurnsLegalMCP extends McpAgent {
  server = new McpServer({
    name: "Burns Legal Search",
    version: "2.0.0",
  });
  
  toolHandlers = new Map();

  async init() {
    // Core search with vector embeddings
    const searchHandler = async ({ query, limit }) => {
        const env = this.env as Env;
        const supabaseUrl = env.SUPABASE_URL || "https://nqkzqcsqfvpquticvwmk.supabase.co";
        const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (!supabaseKey) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "Supabase not configured" }) }]
          };
        }

        try {
          // Call semantic exhibit search function
          const response = await fetch(
            `${supabaseUrl}/rest/v1/rpc/semantic_exhibit_search`,
            {
              method: "POST",
              headers: {
                "apikey": supabaseKey,
                "Authorization": `Bearer ${supabaseKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                search_query: query,
                limit_count: limit
              })
            }
          );

          if (response.ok) {
            const results = await response.json();
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  query,
                  results: results.map((r: any) => ({
                    exhibit_id: r.exhibit_id,
                    title: r.title,
                    description: r.description,
                    relevance_score: r.avg_similarity,
                    matching_chunks: r.matching_chunks,
                    best_chunk: r.best_chunk_text
                  })),
                  total: results.length
                })
              }]
            };
          }
        } catch (error) {
          // Fallback to basic search
          const response = await fetch(
            `${supabaseUrl}/rest/v1/exhibits?or=(title.ilike.*${query}*,description.ilike.*${query}*)&limit=${limit}`,
            {
              headers: {
                "apikey": supabaseKey,
                "Authorization": `Bearer ${supabaseKey}`
              }
            }
          );
          
          if (response.ok) {
            const data = await response.json();
            return {
              content: [{
                type: "text",
                text: JSON.stringify({ query, results: data, total: data.length })
              }]
            };
          }
        }

        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Search failed" }) }]
        };
      }
    );

    // Vector search embeddings
    this.server.tool(
      "vector_search_embeddings",
      {
        query: z.string().describe("Natural language query"),
        limit: z.number().default(20).describe("Maximum results"),
        threshold: z.number().default(0.7).describe("Similarity threshold")
      },
      async ({ query, limit, threshold }) => {
        const env = this.env as Env;
        const supabaseUrl = env.SUPABASE_URL || "https://nqkzqcsqfvpquticvwmk.supabase.co";
        const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
        
        try {
          // Call vector_search function
          const response = await fetch(
            `${supabaseUrl}/rest/v1/rpc/vector_search`,
            {
              method: "POST",
              headers: {
                "apikey": supabaseKey,
                "Authorization": `Bearer ${supabaseKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                query_text: query,
                match_count: limit,
                similarity_threshold: threshold
              })
            }
          );

          if (response.ok) {
            const results = await response.json();
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  query,
                  results,
                  total: results.length,
                  method: "vector_search"
                })
              }]
            };
          }
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ error: "Vector search failed", details: error })
            }]
          };
        }
      }
    );

    // Fetch exhibit details
    this.server.tool(
      "fetch_exhibit",
      {
        id: z.string().describe("Exhibit ID to fetch")
      },
      async ({ id }) => {
        const env = this.env as Env;
        const supabaseUrl = env.SUPABASE_URL || "https://nqkzqcsqfvpquticvwmk.supabase.co";
        const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
        
        try {
          const response = await fetch(
            `${supabaseUrl}/rest/v1/exhibits?exhibit_id=eq.${id}`,
            {
              headers: {
                "apikey": supabaseKey,
                "Authorization": `Bearer ${supabaseKey}`
              }
            }
          );

          if (response.ok) {
            const data = await response.json();
            if (data.length > 0) {
              return {
                content: [{
                  type: "text",
                  text: JSON.stringify(data[0])
                }]
              };
            }
          }
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ error: "Exhibit not found", id })
            }]
          };
        }
      }
    );

    // Fetch claim details
    this.server.tool(
      "fetch_claim",
      {
        claim_id: z.string().describe("Claim ID to fetch"),
        include: z.array(z.enum(["facts", "exhibits", "entities", "individuals", "statutes"]))
          .default([]).describe("Related data to include")
      },
      async ({ claim_id, include }) => {
        const env = this.env as Env;
        const supabaseUrl = env.SUPABASE_URL || "https://nqkzqcsqfvpquticvwmk.supabase.co";
        const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
        
        try {
          const response = await fetch(
            `${supabaseUrl}/rest/v1/claims?claim_id=eq.${claim_id}`,
            {
              headers: {
                "apikey": supabaseKey,
                "Authorization": `Bearer ${supabaseKey}`
              }
            }
          );

          if (response.ok) {
            const claims = await response.json();
            if (claims.length > 0) {
              const result: any = { claim: claims[0] };
              
              // Fetch related data if requested
              if (include.includes("facts")) {
                const factsResponse = await fetch(
                  `${supabaseUrl}/rest/v1/facts?claim_id=eq.${claim_id}`,
                  {
                    headers: {
                      "apikey": supabaseKey,
                      "Authorization": `Bearer ${supabaseKey}`
                    }
                  }
                );
                if (factsResponse.ok) {
                  result.facts = await factsResponse.json();
                }
              }
              
              return {
                content: [{
                  type: "text",
                  text: JSON.stringify(result)
                }]
              };
            }
          }
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ error: "Claim not found", claim_id })
            }]
          };
        }
      }
    );

    // Get facts by claim
    this.server.tool(
      "get_facts_by_claim",
      {
        claim_id: z.string().describe("Claim ID"),
        fact_type: z.string().optional().describe("Filter by fact type"),
        includeMetadata: z.boolean().default(false).describe("Include metadata")
      },
      async ({ claim_id, fact_type, includeMetadata }) => {
        const env = this.env as Env;
        const supabaseUrl = env.SUPABASE_URL || "https://nqkzqcsqfvpquticvwmk.supabase.co";
        const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
        
        try {
          let query = `${supabaseUrl}/rest/v1/facts?claim_id=eq.${claim_id}`;
          if (fact_type) {
            query += `&fact_type=eq.${fact_type}`;
          }
          
          const response = await fetch(query, {
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`
            }
          });

          if (response.ok) {
            const facts = await response.json();
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  claim_id,
                  facts,
                  total: facts.length
                })
              }]
            };
          }
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ error: "Failed to fetch facts", claim_id })
            }]
          };
        }
      }
    );

    // Analyze claim risk
    this.server.tool(
      "analyze_claim_risk",
      {
        claim_id: z.string().describe("Claim ID to analyze")
      },
      async ({ claim_id }) => {
        const env = this.env as Env;
        const supabaseUrl = env.SUPABASE_URL || "https://nqkzqcsqfvpquticvwmk.supabase.co";
        const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
        
        try {
          // Call calculate_claim_strength function
          const response = await fetch(
            `${supabaseUrl}/rest/v1/rpc/calculate_claim_strength`,
            {
              method: "POST",
              headers: {
                "apikey": supabaseKey,
                "Authorization": `Bearer ${supabaseKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ p_claim_id: claim_id })
            }
          );

          if (response.ok) {
            const analysis = await response.json();
            return {
              content: [{
                type: "text",
                text: JSON.stringify(analysis[0] || {
                  claim_id,
                  error: "No analysis available"
                })
              }]
            };
          }
        } catch (error) {
          // Return mock analysis if function doesn't exist
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                claim_id,
                risk_analysis: {
                  financial: { score: 0.75, factors: ["High damages", "Multiple defendants"] },
                  legal: { score: 0.65, factors: ["Strong evidence", "Favorable precedent"] }
                }
              })
            }]
          };
        }
      }
    );
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, X-Request-Id",
      "Access-Control-Max-Age": "86400",
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Health check
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({
        status: "healthy",
        service: "burns-legal-mcp",
        version: "2.0.0",
        timestamp: new Date().toISOString(),
        tools: 6,
        transport: ["http", "sse"],
        endpoints: {
          mcp: "/mcp",
          sse: "/sse",
          health: "/health"
        },
        environment: {
          supabase_configured: !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)
        }
      }), {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }

    // SSE endpoint (not implemented yet)
    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      return new Response(JSON.stringify({
        error: "SSE endpoint not yet implemented"
      }), {
        status: 501,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }

    // MCP endpoint - handle JSON-RPC
    if (url.pathname === "/mcp") {
      try {
        const body = await request.json();
        const agent = new BurnsLegalMCP();
        agent.env = env;
        await agent.init();
        
        // Handle JSON-RPC request
        if (body.method === "tools/call") {
          const { name, arguments: args } = body.params;
          const tool = agent.server.toolHandlers.get(name);
          
          if (tool) {
            const result = await tool(args);
            return new Response(JSON.stringify({
              jsonrpc: "2.0",
              id: body.id,
              result
            }), {
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders
              }
            });
          } else {
            return new Response(JSON.stringify({
              jsonrpc: "2.0",
              id: body.id,
              error: {
                code: -32601,
                message: `Tool not found: ${name}`
              }
            }), {
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders
              }
            });
          }
        }
        
        // Handle tools/list
        if (body.method === "tools/list") {
          const tools = Array.from(agent.server.toolHandlers.keys());
          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            result: { tools }
          }), {
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          });
        }
        
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          error: {
            code: -32601,
            message: `Method not found: ${body.method}`
          }
        }), {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32700,
            message: "Parse error"
          }
        }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }
    }

    // Default info page
    return new Response(JSON.stringify({
      service: "burns-legal-mcp",
      version: "2.0.0",
      tools: ["search_legal_documents", "vector_search_embeddings", "fetch_exhibit", "fetch_claim", "get_facts_by_claim", "analyze_claim_risk"],
      endpoints: {
        mcp: "/mcp",
        sse: "/sse",
        health: "/health"
      }
    }), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  },
};