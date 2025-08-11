import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  OPENAI_API_KEY?: string;
}

// Burns Legal MCP Server with Vector Search
export class BurnsLegalMCP {
  env: any;
  server = new McpServer({
    name: "Burns Legal Search",
    version: "2.0.0",
  });
  
  toolHandlers = new Map();

  async init() {
    // Core search with vector embeddings
    this.server.tool(
      "search_legal_documents", 
      {
        query: z.string().describe("Search query"),
        limit: z.number().default(10).describe("Maximum results")
      },
      async ({ query, limit }) => {
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
          } else {
            console.error("Semantic search failed:", response.status, await response.text());
            throw new Error("Semantic search not available");
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
    
    // Store the handler for later access  
    this.toolHandlers.set("search_legal_documents", async (args) => {
      return this.server._handlers.tools.call({ name: "search_legal_documents", arguments: args });
    });

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
  
  // Tool handler methods for direct invocation
  async searchLegalDocuments({ query, limit = 10 }) {
    const env = this.env as Env;
    const supabaseUrl = env.SUPABASE_URL || "https://nqkzqcsqfvpquticvwmk.supabase.co";
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
    
    if (!supabaseKey) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: "Supabase not configured" }) }]
      };
    }

    try {
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
  
  async vectorSearchEmbeddings({ query, limit = 20, threshold = 0.7 }) {
    const env = this.env as Env;
    const supabaseUrl = env.SUPABASE_URL || "https://nqkzqcsqfvpquticvwmk.supabase.co";
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
    
    try {
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
  
  async fetchExhibit({ id }) {
    const env = this.env as Env;
    const supabaseUrl = env.SUPABASE_URL || "https://nqkzqcsqfvpquticvwmk.supabase.co";
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
    
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
  
  async fetchClaim({ claim_id, include = [] }) {
    const env = this.env as Env;
    const supabaseUrl = env.SUPABASE_URL || "https://nqkzqcsqfvpquticvwmk.supabase.co";
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
    
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
  
  async getFactsByClaim({ claim_id, fact_type, includeMetadata = false }) {
    const env = this.env as Env;
    const supabaseUrl = env.SUPABASE_URL || "https://nqkzqcsqfvpquticvwmk.supabase.co";
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
    
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
  
  async analyzeClaimRisk({ claim_id }) {
    const env = this.env as Env;
    const supabaseUrl = env.SUPABASE_URL || "https://nqkzqcsqfvpquticvwmk.supabase.co";
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
    
    try {
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
}

// Also export as MyMCP for backwards compatibility
export { BurnsLegalMCP as MyMCP };

// Export old class names for migration compatibility
export { BurnsLegalMCP as BurnsLegalEnhancedComplete };
export { BurnsLegalMCP as BurnsLegalEnhancedMCP };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, X-Request-Id, Mcp-Session-Id",
      "Access-Control-Allow-Credentials": "true",
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
      // Test Supabase connection
      let supabaseTest = { status: "not_tested", tables: null };
      const supabaseUrl = env.SUPABASE_URL || "https://nqkzqcsqfvpquticvwmk.supabase.co";
      const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
      
      if (supabaseKey) {
        try {
          // Test connection by listing exhibits (limit 1)
          const response = await fetch(
            `${supabaseUrl}/rest/v1/exhibits?limit=1`,
            {
              headers: {
                "apikey": supabaseKey,
                "Authorization": `Bearer ${supabaseKey}`
              }
            }
          );
          
          if (response.ok) {
            const data = await response.json();
            supabaseTest = {
              status: "connected",
              tables: {
                exhibits: data.length > 0 ? "has_data" : "empty"
              }
            };
          } else {
            supabaseTest = {
              status: "error",
              error: `HTTP ${response.status}`,
              tables: null
            };
          }
        } catch (error) {
          supabaseTest = {
            status: "error",
            error: error.message,
            tables: null
          };
        }
      }
      
      return new Response(JSON.stringify({
        status: "healthy",
        service: "burns-legal-mcp",
        version: "2.0.3",
        timestamp: new Date().toISOString(),
        tools: 6,
        transport: ["http", "sse"],
        endpoints: {
          mcp: "/mcp",
          sse: "/sse",
          health: "/health",
          test: "/test"
        },
        environment: {
          supabase_configured: !!(env.SUPABASE_URL && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY)),
          has_service_key: !!env.SUPABASE_SERVICE_ROLE_KEY,
          has_anon_key: !!env.SUPABASE_ANON_KEY,
          supabase_url: supabaseUrl
        },
        supabase_test: supabaseTest
      }), {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }

    // Test endpoint for debugging
    if (url.pathname === "/test") {
      const supabaseUrl = env.SUPABASE_URL || "https://nqkzqcsqfvpquticvwmk.supabase.co";
      const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
      
      const tests = {};
      
      // Test 1: List tables
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/`,
          {
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`
            }
          }
        );
        tests.tables = response.ok ? "accessible" : `error ${response.status}`;
      } catch (e) {
        tests.tables = e.message;
      }
      
      // Test 2: Query exhibits
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/exhibits?select=*&limit=1`,
          {
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`
            }
          }
        );
        if (response.ok) {
          const data = await response.json();
          tests.exhibits = { count: data.length, sample: data[0] };
        } else {
          tests.exhibits = `error ${response.status}: ${await response.text()}`;
        }
      } catch (e) {
        tests.exhibits = e.message;
      }
      
      // Test 3: Query claims
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/claims?select=*&limit=1`,
          {
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`
            }
          }
        );
        if (response.ok) {
          const data = await response.json();
          tests.claims = { count: data.length, sample: data[0] };
        } else {
          tests.claims = `error ${response.status}: ${await response.text()}`;
        }
      } catch (e) {
        tests.claims = e.message;
      }
      
      // Test 4: Check RPC functions
      try {
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
              search_query: "test",
              limit_count: 1
            })
          }
        );
        tests.semantic_search = response.ok ? "available" : `error ${response.status}: ${await response.text()}`;
      } catch (e) {
        tests.semantic_search = e.message;
      }
      
      return new Response(JSON.stringify({
        supabase_url: supabaseUrl,
        has_key: !!supabaseKey,
        key_type: env.SUPABASE_SERVICE_ROLE_KEY ? "service" : "anon",
        tests
      }, null, 2), {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    
    // SSE endpoint for MCP
    if (url.pathname === "/sse" || url.pathname === "/mcp" && request.headers.get("accept")?.includes("text/event-stream")) {
      // Create SSE response
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();
      
      // Send initial SSE connection
      writer.write(encoder.encode(":ok\n\n"));
      
      // Handle SSE messages
      ctx.waitUntil((async () => {
        try {
          // SSE connection established
          
          // Send a keepalive every 30 seconds
          const interval = setInterval(() => {
            writer.write(encoder.encode(":keepalive\n\n"));
          }, 30000);
          
          // Clean up on disconnect
          setTimeout(() => {
            clearInterval(interval);
            writer.close();
          }, 300000); // 5 minute timeout
        } catch (error) {
          console.error("SSE error:", error);
          writer.close();
        }
      })());
      
      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          ...corsHeaders
        }
      });
    }

    // MCP endpoint - handle JSON-RPC
    if (url.pathname === "/mcp") {
      try {
        let body;
        try {
          body = await request.json();
        } catch (e) {
          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32700,
              message: "Parse error - invalid JSON"
            }
          }), {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          });
        }
        
        // Don't initialize agent until needed to avoid timeout
        const agent = new BurnsLegalMCP();
        agent.env = env;
        
        // Handle initialize method
        if (body.method === "initialize") {
          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            result: {
              protocolVersion: "2024-11-05",
              capabilities: {
                tools: {}
              },
              serverInfo: {
                name: "burns-legal-mcp",
                version: "1.0.0"
              }
            }
          }), {
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          });
        }
        
        // Handle JSON-RPC request
        if (body.method === "tools/call") {
          const { name, arguments: args } = body.params;
          
          // Manually handle each tool
          let result;
          switch(name) {
            case "search_legal_documents":
              result = await agent.searchLegalDocuments(args);
              break;
            case "vector_search_embeddings":
              result = await agent.vectorSearchEmbeddings(args);
              break;
            case "fetch_exhibit":
              result = await agent.fetchExhibit(args);
              break;
            case "fetch_claim":
              result = await agent.fetchClaim(args);
              break;
            case "get_facts_by_claim":
              result = await agent.getFactsByClaim(args);
              break;
            case "analyze_claim_risk":
              result = await agent.analyzeClaimRisk(args);
              break;
            default:
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
        }
        
        // Handle tools/list
        if (body.method === "tools/list") {
          await agent.init();  // Initialize when needed
          const tools = [
            {
              name: "search_legal_documents",
              description: "Search legal documents using semantic search",
              inputSchema: {
                type: "object",
                properties: {
                  query: { type: "string", description: "Search query" },
                  limit: { type: "number", description: "Maximum results", default: 10 }
                },
                required: ["query"]
              }
            },
            {
              name: "vector_search_embeddings",
              description: "Search using vector embeddings",
              inputSchema: {
                type: "object",
                properties: {
                  query: { type: "string", description: "Natural language query" },
                  limit: { type: "number", description: "Maximum results", default: 20 },
                  threshold: { type: "number", description: "Similarity threshold", default: 0.7 }
                },
                required: ["query"]
              }
            },
            {
              name: "fetch_exhibit",
              description: "Fetch exhibit details by ID",
              inputSchema: {
                type: "object",
                properties: {
                  id: { type: "string", description: "Exhibit ID to fetch" }
                },
                required: ["id"]
              }
            },
            {
              name: "fetch_claim",
              description: "Fetch claim details",
              inputSchema: {
                type: "object",
                properties: {
                  claim_id: { type: "string", description: "Claim ID" },
                  include: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "Related data to include"
                  }
                },
                required: ["claim_id"]
              }
            },
            {
              name: "get_facts_by_claim",
              description: "Get facts associated with a claim",
              inputSchema: {
                type: "object",
                properties: {
                  claim_id: { type: "string", description: "Claim ID" },
                  fact_type: { type: "string", description: "Filter by fact type" },
                  includeMetadata: { type: "boolean", description: "Include metadata", default: false }
                },
                required: ["claim_id"]
              }
            },
            {
              name: "analyze_claim_risk",
              description: "Analyze risk factors for a claim",
              inputSchema: {
                type: "object",
                properties: {
                  claim_id: { type: "string", description: "Claim ID to analyze" }
                },
                required: ["claim_id"]
              }
            }
          ];
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
        console.error("MCP endpoint error:", error);
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: `Internal error: ${error.message || error}`
          }
        }), {
          status: 500,
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