// src/burns-legal-enhanced.ts
export interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  MCP_OBJECT: DurableObjectNamespace;
}

const MCP_VERSION = "2025-06-18";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, MCP-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400"
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const sessionId = request.headers.get("Mcp-Session-Id") || request.headers.get("mcp-session-id") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { ...CORS, "MCP-Protocol-Version": MCP_VERSION } });
    }

    // Discovery
    if (url.pathname === "/.well-known/mcp.json") {
      return json({
        mcpVersion: MCP_VERSION,
        name: "burns-legal-enhanced",
        description: "Enhanced Burns Legal MCP Server with comprehensive tools",
        vendor: "Burns Legal",
        authorization: { type: "none" },
        capabilities: {
          tools: { listChanged: true },
          prompts: { listChanged: false },
          resources: { listChanged: false }
        }
      }, 200, sessionId);
    }

    // SSE via Durable Object
    const wantsSSE = (request.headers.get("Accept") || "").includes("text/event-stream");
    if ((url.pathname === "/sse" || url.pathname === "/mcp" || url.pathname === "/") && wantsSSE) {
      const id = sessionId || crypto.randomUUID();
      const stub = env.MCP_OBJECT.get(env.MCP_OBJECT.idFromName(id));
      return stub.fetch(new Request(new URL("/sse", url).toString(), request));
    }

    // HTTP JSON-RPC on / or /mcp
    if (url.pathname === "/" || url.pathname === "/mcp") {
      if (request.method === "GET") {
        return json({
          status: "ready",
          protocol: MCP_VERSION,
          tools: TOOLS.length,
          configured: !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)
        }, 200, sessionId);
      }

      if (request.method === "POST") {
        try {
          const body = await request.json();
          return await handleRpc(body, env, sessionId);
        } catch (e: any) {
          return rpcError(null, -32700, `Parse error: ${e.message}`, sessionId);
        }
      }

      return json({ error: "Method Not Allowed" }, 405, sessionId);
    }

    return json({ error: "Not Found", path: url.pathname }, 404, sessionId);
  }
};

// Durable Object for stable SSE
export class BurnsLegalEnhancedMCP {
  constructor(private state: DurableObjectState, private env: Env) {}

  async fetch(request: Request): Promise<Response> {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const enc = new TextEncoder();

    const hello = {
      jsonrpc: "2.0",
      method: "mcp/hello",
      params: {
        protocol: MCP_VERSION,
        authorization: { type: "none" },
        capabilities: {
          tools: { listChanged: true },
          prompts: { listChanged: false },
          resources: { listChanged: false }
        },
        serverInfo: { name: "burns-legal-enhanced", version: "1.0.0" }
      }
    };

    await writer.write(enc.encode(`data: ${JSON.stringify(hello)}\n\n`));

    // Keep-alive pings
    const interval = setInterval(() => {
      writer.write(enc.encode(`: ping\n\n`)).catch(() => clearInterval(interval));
    }, 25000);

    const response = new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "MCP-Protocol-Version": MCP_VERSION,
        ...CORS
      }
    });

    this.state.waitUntil(new Promise(() => {}));
    return response;
  }
}

// ---------------- MCP core ----------------

async function handleRpc(body: any, env: Env, sessionId?: string): Promise<Response> {
  const { id, method, params } = body || {};

  if (id === undefined || id === null) {
    return new Response(null, { status: 200, headers: { ...CORS, "MCP-Protocol-Version": MCP_VERSION, ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}) } });
  }

  switch (method) {
    case "initialize":
      return rpcOk(id, {
        protocolVersion: MCP_VERSION,
        capabilities: {
          tools: { listChanged: true },
          prompts: { listChanged: false },
          resources: { listChanged: false }
        },
        authorization: { type: "none" },
        serverInfo: { name: "burns-legal-enhanced", version: "1.0.0" }
      }, sessionId);

    case "initialized":
      return rpcOk(id, {}, sessionId);

    case "prompts/list":
      return rpcOk(id, { prompts: [] }, sessionId);

    case "resources/list":
      return rpcOk(id, { resources: [] }, sessionId);

    case "tools/list":
      return rpcOk(id, { tools: TOOLS }, sessionId);

    case "tools/call": {
      const { name, arguments: args = {} } = params || {};
      const impl = TOOL_IMPL[name as keyof typeof TOOL_IMPL] as any;
      if (!impl) return rpcError(id, -32602, `Unknown tool: ${name}`, sessionId);
      try {
        const result = await impl(args, env);
        return rpcOk(id, {
          content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }]
        }, sessionId);
      } catch (e: any) {
        return rpcError(id, -32603, e.message || "Tool error", sessionId);
      }
    }

    default:
      return rpcError(id, -32601, `Unknown method: ${method}`, sessionId);
  }
}

// ---------------- Tools ----------------

const TOOLS = [
  // ChatGPT required
  {
    name: "search",
    description: "Vector-first search with keyword fallback across all legal documents",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural language search query" },
        options: { 
          type: "object", 
          properties: { 
            limit: { type: "number", default: 20, minimum: 1, maximum: 100 },
            offset: { type: "number", default: 0 }
          } 
        }
      },
      required: ["query"]
    }
  },
  { 
    name: "fetch", 
    description: "Fetch any resource by ID (exhibit, claim, document, fact)", 
    inputSchema: { 
      type: "object", 
      properties: { 
        id: { type: "string", description: "Resource ID (Ex###, claim_*, fact_*, or numeric)" } 
      }, 
      required: ["id"] 
    } 
  },

  // Vector and search tools
  { 
    name: "vector_search_embeddings", 
    description: "Direct pgvector semantic search using embeddings", 
    inputSchema: { 
      type: "object", 
      properties: { 
        query: { type: "string", description: "Search query text" }, 
        limit: { type: "integer", default: 20, minimum: 1, maximum: 100 }, 
        threshold: { type: "number", default: 0.7, minimum: 0, maximum: 1, description: "Similarity threshold" } 
      }, 
      required: ["query"] 
    } 
  },
  { 
    name: "keyword_search", 
    description: "Keyword-based search on exhibits using ilike patterns", 
    inputSchema: { 
      type: "object", 
      properties: { 
        query: { type: "string", description: "Keyword search query" }, 
        limit: { type: "integer", default: 20, minimum: 1, maximum: 100 } 
      }, 
      required: ["query"] 
    } 
  },
  
  // Exhibit-specific tools
  { 
    name: "fetch_exhibit", 
    description: "Fetch a specific exhibit by ID or exhibit_id", 
    inputSchema: { 
      type: "object", 
      properties: { 
        id: { type: "string", description: "Exhibit ID (e.g., Ex001, FL_exhibit_001)" } 
      }, 
      required: ["id"] 
    } 
  },
  {
    name: "list_exhibits",
    description: "List all exhibits with optional filtering",
    inputSchema: {
      type: "object",
      properties: {
        case_type: { type: "string", enum: ["Floorable", "Mannington"], description: "Filter by case type" },
        limit: { type: "integer", default: 50, minimum: 1, maximum: 200 },
        offset: { type: "integer", default: 0 }
      }
    }
  },
  
  // Claim-specific tools
  { 
    name: "fetch_claim", 
    description: "Fetch a specific claim by claim_id", 
    inputSchema: { 
      type: "object", 
      properties: { 
        claim_id: { type: "string", description: "Claim ID (e.g., claim_001, 123)" } 
      }, 
      required: ["claim_id"] 
    } 
  },
  {
    name: "list_claims",
    description: "List all claims with optional filtering",
    inputSchema: {
      type: "object",
      properties: {
        claim_type: { type: "string", description: "Filter by claim type" },
        status: { type: "string", description: "Filter by status" },
        limit: { type: "integer", default: 50, minimum: 1, maximum: 200 }
      }
    }
  },
  
  // Facts and analysis
  { 
    name: "get_facts_by_claim", 
    description: "Get all facts linked to a specific claim", 
    inputSchema: { 
      type: "object", 
      properties: { 
        claim_id: { type: "string", description: "Claim ID" }, 
        fact_type: { type: "string", description: "Optional fact type filter" }, 
        includeMetadata: { type: "boolean", default: false, description: "Include full metadata" } 
      }, 
      required: ["claim_id"] 
    } 
  },
  {
    name: "get_facts_by_exhibit",
    description: "Get all facts extracted from a specific exhibit",
    inputSchema: {
      type: "object",
      properties: {
        exhibit_id: { type: "string", description: "Exhibit ID" },
        fact_type: { type: "string", description: "Optional fact type filter" }
      },
      required: ["exhibit_id"]
    }
  },
  
  // Analysis tools
  { 
    name: "analyze_claim_risk", 
    description: "Analyze risk factors for a specific claim", 
    inputSchema: { 
      type: "object", 
      properties: { 
        claim_id: { type: "string", description: "Claim ID to analyze" } 
      }, 
      required: ["claim_id"] 
    } 
  },
  {
    name: "get_exhibit_relationships",
    description: "Find related exhibits and their connections",
    inputSchema: {
      type: "object",
      properties: {
        exhibit_id: { type: "string", description: "Starting exhibit ID" },
        depth: { type: "integer", default: 1, minimum: 1, maximum: 3, description: "Relationship depth" }
      },
      required: ["exhibit_id"]
    }
  },
  
  // Entity and individual tools
  {
    name: "get_entities",
    description: "Get all entities (companies, organizations) in the case",
    inputSchema: {
      type: "object",
      properties: {
        entity_type: { type: "string", description: "Filter by entity type" },
        role: { type: "string", description: "Filter by role in case" }
      }
    }
  },
  {
    name: "get_individuals",
    description: "Get all individuals involved in the case",
    inputSchema: {
      type: "object",
      properties: {
        role: { type: "string", description: "Filter by role (e.g., plaintiff, defendant, witness)" },
        entity_id: { type: "string", description: "Filter by associated entity" }
      }
    }
  },
  
  // Statistics and summaries
  {
    name: "get_case_statistics",
    description: "Get overall case statistics and summary",
    inputSchema: {
      type: "object",
      properties: {
        case_name: { type: "string", description: "Optional case filter (Floorable or Mannington)" }
      }
    }
  }
];

const TOOL_IMPL = {
  async search({ query, options }: { query: string; options?: { limit?: number; offset?: number } }, env: Env) {
    if (!query?.trim()) return { results: [], resultCount: 0, method: "none", error: "query is required" };
    const limit = Math.max(1, Math.min(100, options?.limit ?? 20));
    const v = await safeVector(env, query, limit);
    if (v.ok && v.data.resultCount > 0) return { ...v.data, method: "vector" };
    const k = await safeKeyword(env, query, limit);
    if (k.ok) return { ...k.data, method: "keyword" };
    return { results: [], resultCount: 0, method: v.ok ? "vector" : "keyword", error: v.error || k.error };
  },

  async fetch({ id }: { id: string }, env: Env) {
    if (!id) return { id, error: "id is required" };
    
    // Try exhibit first
    if (/^(Ex|FL_|MN_)/i.test(id)) { 
      const ex = await fetchExhibit(env, id); 
      if (ex) return { id, type: "exhibit", content: ex.content || ex.description || "No content available", metadata: ex }; 
    }
    
    // Try claim
    if (/^claim_/i.test(id) || /^\d+$/.test(id)) { 
      const cl = await fetchClaim(env, id); 
      if (cl) return { id, type: "claim", content: JSON.stringify(cl, null, 2), metadata: cl }; 
    }
    
    // Try fact
    if (/^fact_/i.test(id)) {
      const fact = await fetchFact(env, id);
      if (fact) return { id, type: "fact", content: fact.fact_text || JSON.stringify(fact), metadata: fact };
    }
    
    // Try document
    const doc = await fetchDoc(env, id); 
    if (doc) return { id, type: "document", content: doc.content || JSON.stringify(doc, null, 2), metadata: doc };
    
    return { id, error: "Resource not found" };
  },

  async vector_search_embeddings({ query, limit = 20, threshold = 0.7 }: any, env: Env) { 
    const r = await safeVector(env, query, limit, threshold); 
    if (!r.ok) throw new Error(r.error || "vector failed"); 
    return r.data; 
  },
  
  async keyword_search({ query, limit = 20 }: any, env: Env) { 
    const r = await safeKeyword(env, query, limit); 
    if (!r.ok) throw new Error(r.error || "keyword failed"); 
    return r.data; 
  },
  
  async fetch_exhibit({ id }: any, env: Env) { 
    const ex = await fetchExhibit(env, id); 
    if (!ex) throw new Error(`Exhibit ${id} not found`); 
    return { 
      id: ex.id || ex.exhibit_id, 
      type: "exhibit", 
      title: ex.title, 
      content: ex.content || ex.description || "No content available", 
      metadata: ex 
    }; 
  },
  
  async list_exhibits({ case_type, limit = 50, offset = 0 }: any, env: Env) {
    requireDb(env);
    const params = new URLSearchParams({ 
      select: "id,exhibit_id,title,description,case_type,created_at",
      limit: String(limit),
      offset: String(offset),
      order: "exhibit_id"
    });
    if (case_type) params.append("case_type", `eq.${case_type}`);
    
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/exhibits?${params.toString()}`, { headers: auth(env) });
    if (!res.ok) throw new Error(`Failed to list exhibits: ${res.status}`);
    return await res.json();
  },
  
  async fetch_claim({ claim_id }: any, env: Env) { 
    const cl = await fetchClaim(env, claim_id); 
    if (!cl) throw new Error(`Claim ${claim_id} not found`); 
    return { claim: cl }; 
  },
  
  async list_claims({ claim_type, status, limit = 50 }: any, env: Env) {
    requireDb(env);
    const params = new URLSearchParams({ 
      select: "id,claim_id,claim_type,claim_title,status,damages_estimate,created_at",
      limit: String(limit),
      order: "claim_id"
    });
    if (claim_type) params.append("claim_type", `eq.${claim_type}`);
    if (status) params.append("status", `eq.${status}`);
    
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/claims?${params.toString()}`, { headers: auth(env) });
    if (!res.ok) throw new Error(`Failed to list claims: ${res.status}`);
    return await res.json();
  },
  
  async get_facts_by_claim({ claim_id, fact_type, includeMetadata = false }: any, env: Env) {
    requireDb(env);
    const params = new URLSearchParams({ 
      claim_id: `eq.${claim_id}`, 
      select: includeMetadata ? "*" : "id,fact_text,fact_type,source_exhibit_id,created_at" 
    });
    if (fact_type) params.append("fact_type", `eq.${fact_type}`);
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/facts?${params.toString()}`, { headers: auth(env) });
    if (!res.ok) throw new Error(`Failed to fetch facts: ${res.status}`);
    return await res.json();
  },
  
  async get_facts_by_exhibit({ exhibit_id, fact_type }: any, env: Env) {
    requireDb(env);
    const params = new URLSearchParams({ 
      source_exhibit_id: `eq.${exhibit_id}`,
      select: "id,fact_text,fact_type,claim_id,created_at"
    });
    if (fact_type) params.append("fact_type", `eq.${fact_type}`);
    
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/facts?${params.toString()}`, { headers: auth(env) });
    if (!res.ok) throw new Error(`Failed to fetch facts: ${res.status}`);
    return await res.json();
  },
  
  async analyze_claim_risk({ claim_id }: any, env: Env) {
    const cl = await fetchClaim(env, claim_id);
    if (!cl) return { claim_id, overall_risk: "unknown", risk_scores: { financial: 0.5, legal: 0.5 }, error: "Database not configured or claim not found" };
    
    const hasEvidence = Array.isArray(cl.exhibit_ids) && cl.exhibit_ids.length > 0;
    const hasDamages = typeof cl.damages_estimate === "number" && cl.damages_estimate > 0;
    const financial = hasDamages ? Math.min(cl.damages_estimate / 1_000_000, 1) : 0.5;
    const legal = hasEvidence ? 0.4 : 0.8;
    const overall = (financial + legal) / 2;
    
    return { 
      claim_id, 
      overall_risk: overall < 0.3 ? "low" : overall < 0.6 ? "moderate" : "high", 
      risk_scores: { financial, legal }, 
      factors: { 
        has_evidence: hasEvidence, 
        damages_estimate: cl.damages_estimate || 0, 
        claim_type: cl.claim_type,
        exhibit_count: cl.exhibit_ids?.length || 0
      } 
    };
  },
  
  async get_exhibit_relationships({ exhibit_id, depth = 1 }: any, env: Env) {
    requireDb(env);
    // Get facts that reference this exhibit
    const factsRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/facts?source_exhibit_id=eq.${exhibit_id}&select=claim_id`,
      { headers: auth(env) }
    );
    if (!factsRes.ok) throw new Error(`Failed to fetch relationships: ${factsRes.status}`);
    
    const facts = await factsRes.json();
    const claimIds = [...new Set(facts.map((f: any) => f.claim_id))];
    
    // Get other exhibits related to these claims
    if (claimIds.length > 0) {
      const claimsRes = await fetch(
        `${env.SUPABASE_URL}/rest/v1/claims?id=in.(${claimIds.join(',')})&select=id,claim_id,exhibit_ids`,
        { headers: auth(env) }
      );
      if (!claimsRes.ok) throw new Error(`Failed to fetch claims: ${claimsRes.status}`);
      
      const claims = await claimsRes.json();
      const relatedExhibits = [...new Set(claims.flatMap((c: any) => c.exhibit_ids || []))];
      
      return {
        exhibit_id,
        related_claims: claimIds,
        related_exhibits: relatedExhibits.filter(id => id !== exhibit_id),
        depth
      };
    }
    
    return {
      exhibit_id,
      related_claims: [],
      related_exhibits: [],
      depth
    };
  },
  
  async get_entities({ entity_type, role }: any, env: Env) {
    requireDb(env);
    const params = new URLSearchParams({ 
      select: "id,entity_name,entity_type,role,description,created_at"
    });
    if (entity_type) params.append("entity_type", `eq.${entity_type}`);
    if (role) params.append("role", `eq.${role}`);
    
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/entities?${params.toString()}`, { headers: auth(env) });
    if (!res.ok) throw new Error(`Failed to fetch entities: ${res.status}`);
    return await res.json();
  },
  
  async get_individuals({ role, entity_id }: any, env: Env) {
    requireDb(env);
    const params = new URLSearchParams({ 
      select: "id,individual_name,role,entity_id,description,created_at"
    });
    if (role) params.append("role", `eq.${role}`);
    if (entity_id) params.append("entity_id", `eq.${entity_id}`);
    
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/individuals?${params.toString()}`, { headers: auth(env) });
    if (!res.ok) throw new Error(`Failed to fetch individuals: ${res.status}`);
    return await res.json();
  },
  
  async get_case_statistics({ case_name }: any, env: Env) {
    requireDb(env);
    
    // Get exhibit count
    const exhibitParams = new URLSearchParams({ select: "count", head: "true" });
    if (case_name) exhibitParams.append("case_type", `eq.${case_name}`);
    const exhibitRes = await fetch(`${env.SUPABASE_URL}/rest/v1/exhibits?${exhibitParams.toString()}`, { headers: auth(env) });
    
    // Get claim count
    const claimRes = await fetch(`${env.SUPABASE_URL}/rest/v1/claims?select=count&head=true`, { headers: auth(env) });
    
    // Get fact count
    const factRes = await fetch(`${env.SUPABASE_URL}/rest/v1/facts?select=count&head=true`, { headers: auth(env) });
    
    const exhibitCount = exhibitRes.headers.get("content-range")?.split("/")[1] || "0";
    const claimCount = claimRes.headers.get("content-range")?.split("/")[1] || "0";
    const factCount = factRes.headers.get("content-range")?.split("/")[1] || "0";
    
    return {
      case_name: case_name || "All Cases",
      statistics: {
        total_exhibits: parseInt(exhibitCount),
        total_claims: parseInt(claimCount),
        total_facts: parseInt(factCount),
        database_configured: true
      }
    };
  }
};

// ---------------- DB helpers ----------------
function requireDb(env: Env) { 
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Database not configured"); 
}

function auth(env: Env) { 
  return { 
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 
    apikey: env.SUPABASE_SERVICE_ROLE_KEY!, 
    Prefer: "return=representation" 
  }; 
}

async function safeVector(env: Env, query: string, limit: number, threshold = 0.7) {
  if (!query?.trim()) return { ok: false, error: "query is required" };
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return { ok: true, data: { results: [], resultCount: 0 } };
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/vector_search`, { 
      method: "POST", 
      headers: { ...auth(env), "Content-Type": "application/json" }, 
      body: JSON.stringify({ query_text: query, match_count: limit, threshold }) 
    });
    if (!res.ok) return { ok: false, error: `Vector search failed: ${res.status}` };
    const rows = await res.json();
    const results = (Array.isArray(rows) ? rows : []).map((r: any) => ({ 
      id: r.exhibit_id || r.id || r.source_id, 
      type: r.type || r.source_table || "document", 
      title: r.title || r.name || r.description || "Result", 
      snippet: (r.content || r.description || "").slice(0, 200), 
      similarity: r.similarity || r.score || 0 
    }));
    return { ok: true, data: { results, resultCount: results.length } };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

async function safeKeyword(env: Env, query: string, limit: number) {
  if (!query?.trim()) return { ok: false, error: "query is required" };
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return { ok: true, data: { results: [], resultCount: 0 } };
  try {
    const q = encodeURIComponent(query);
    const params = new URLSearchParams({ 
      or: `(title.ilike.*${q}*,description.ilike.*${q}*,content.ilike.*${q}*)`, 
      limit: String(limit) 
    });
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/exhibits?${params.toString()}`, { headers: auth(env) });
    if (!res.ok) return { ok: false, error: `Keyword search failed: ${res.status}` };
    const docs = await res.json();
    const results = docs.map((d: any) => ({ 
      id: d.id || d.exhibit_id, 
      type: "exhibit", 
      title: d.title || "Untitled", 
      snippet: (d.description || d.content || "").slice(0, 200) 
    }));
    return { ok: true, data: { results, resultCount: results.length } };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

async function fetchExhibit(env: Env, id: string) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const params = new URLSearchParams({ 
    or: `(id.eq.${encodeURIComponent(id)},exhibit_id.eq.${encodeURIComponent(id)})`, 
    limit: "1" 
  });
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/exhibits?${params.toString()}`, { headers: auth(env) });
  if (!res.ok) return null;
  const data = await res.json();
  return data[0] || null;
}

async function fetchClaim(env: Env, id: string) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const params = new URLSearchParams({ 
    or: `(id.eq.${encodeURIComponent(id)},claim_id.eq.${encodeURIComponent(id)})`, 
    limit: "1" 
  });
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/claims?${params.toString()}`, { headers: auth(env) });
  if (!res.ok) return null;
  const data = await res.json();
  return data[0] || null;
}

async function fetchFact(env: Env, id: string) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const cleanId = id.replace(/^fact_/, '');
  const params = new URLSearchParams({ 
    or: `(id.eq.${encodeURIComponent(cleanId)},id.eq.${encodeURIComponent(id)})`, 
    limit: "1" 
  });
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/facts?${params.toString()}`, { headers: auth(env) });
  if (!res.ok) return null;
  const data = await res.json();
  return data[0] || null;
}

async function fetchDoc(env: Env, id: string) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/vector_embeddings?id=eq.${encodeURIComponent(id)}`, { headers: auth(env) });
  if (!res.ok) return null;
  const data = await res.json();
  return data[0] || null;
}

// ---------------- JSON helpers ----------------
function json(obj: unknown, status = 200, sessionId?: string) {
  return new Response(JSON.stringify(obj, null, 2), { 
    status, 
    headers: { 
      "Content-Type": "application/json", 
      "MCP-Protocol-Version": MCP_VERSION, 
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}), 
      ...CORS 
    } 
  });
}

function rpcOk(id: any, result: unknown, sessionId?: string) { 
  return json({ jsonrpc: "2.0", id, result }, 200, sessionId); 
}

function rpcError(id: any, code: number, message: string, sessionId?: string) { 
  return json({ jsonrpc: "2.0", id, error: { code, message } }, 200, sessionId); 
}