// Burns Legal Enhanced MCP Server - Fixed with proper session handling
// Compatible with ChatGPT Connectors and Claude

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // CORS headers with session exposure
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id, Accept',
      'Access-Control-Expose-Headers': 'Mcp-Session-Id',  // CRITICAL for browser access
      'Access-Control-Max-Age': '86400'
    };
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { 
        status: 204,
        headers: corsHeaders 
      });
    }
    
    // Health check
    if (url.pathname === '/healthz') {
      return new Response(JSON.stringify({ ok: true, timestamp: Date.now() }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    // MCP endpoint
    if (url.pathname === '/mcp' || url.pathname === '/') {
      try {
        // Parse request
        const body = await request.json();
        const { method, params, id } = body;
        
        // Handle initialize - CREATE SESSION
        if (method === 'initialize') {
          const sessionId = crypto.randomUUID();
          
          // Initialize response per MCP spec
          const response = {
            jsonrpc: '2.0',
            id: id,
            result: {
              protocolVersion: params.protocolVersion || '2025-03-26',
              capabilities: {
                tools: { listChanged: true },
                logging: {},
                prompts: {}
              },
              serverInfo: {
                name: 'burns-legal-enhanced',
                version: '1.0.0'
              },
              sessionId: sessionId  // Include in result
            }
          };
          
          return new Response(JSON.stringify(response), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,  // CRITICAL: Set as header
              ...corsHeaders
            }
          });
        }
        
        // Check session for other methods
        const sessionId = request.headers.get('Mcp-Session-Id');
        if (!sessionId) {
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            id: id,
            error: {
              code: -32600,
              message: 'Missing Mcp-Session-Id header. Call initialize first.'
            }
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
        
        // Handle tools/list
        if (method === 'tools/list') {
          const tools = [
            // REQUIRED for ChatGPT Connectors
            {
              name: 'search',
              description: 'Search for legal documents and information',
              inputSchema: {
                type: 'object',
                properties: {
                  q: { 
                    type: 'string',
                    description: 'Search query'
                  }
                },
                required: ['q']
              }
            },
            {
              name: 'fetch',
              description: 'Fetch detailed content by ID',
              inputSchema: {
                type: 'object',
                properties: {
                  id: { 
                    type: 'string',
                    description: 'Document or item ID'
                  }
                },
                required: ['id']
              }
            },
            // Additional Burns Legal tools
            {
              name: 'search_legal_context',
              description: 'Search legal documents with vector similarity',
              inputSchema: {
                type: 'object',
                properties: {
                  query: { type: 'string' },
                  limit: { type: 'number', default: 10 }
                },
                required: ['query']
              }
            },
            {
              name: 'get_claims',
              description: 'Get legal claims with filters',
              inputSchema: {
                type: 'object',
                properties: {
                  status: { 
                    type: 'string',
                    enum: ['active', 'pending', 'closed', 'settled']
                  },
                  jurisdiction: { type: 'string' },
                  limit: { type: 'number', default: 50 }
                }
              }
            },
            {
              name: 'get_claim_details',
              description: 'Get detailed information about a claim',
              inputSchema: {
                type: 'object',
                properties: {
                  claim_id: { type: 'string' }
                },
                required: ['claim_id']
              }
            },
            {
              name: 'get_facts_by_claim',
              description: 'Get all facts associated with a claim',
              inputSchema: {
                type: 'object',
                properties: {
                  claim_id: { type: 'string' }
                },
                required: ['claim_id']
              }
            },
            {
              name: 'get_exhibits',
              description: 'Get exhibits/evidence with filters',
              inputSchema: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  limit: { type: 'number', default: 50 }
                }
              }
            },
            {
              name: 'analyze_claim_risk',
              description: 'Analyze risk factors for a claim',
              inputSchema: {
                type: 'object',
                properties: {
                  claim_id: { type: 'string' }
                },
                required: ['claim_id']
              }
            }
          ];
          
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            id: id,
            result: { tools }
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
              ...corsHeaders
            }
          });
        }
        
        // Handle tools/call
        if (method === 'tools/call') {
          const { name, arguments: args } = params;
          
          let result;
          
          // Implement tool handlers
          switch (name) {
            case 'search':
              result = await handleSearch(args.q, env);
              break;
              
            case 'fetch':
              result = await handleFetch(args.id, env);
              break;
              
            case 'search_legal_context':
              result = await handleLegalSearch(args.query, args.limit, env);
              break;
              
            case 'get_claims':
              result = await handleGetClaims(args, env);
              break;
              
            case 'get_claim_details':
              result = await handleGetClaimDetails(args.claim_id, env);
              break;
              
            case 'get_facts_by_claim':
              result = await handleGetFactsByClaim(args.claim_id, env);
              break;
              
            case 'get_exhibits':
              result = await handleGetExhibits(args, env);
              break;
              
            case 'analyze_claim_risk':
              result = await handleAnalyzeRisk(args.claim_id, env);
              break;
              
            default:
              return new Response(JSON.stringify({
                jsonrpc: '2.0',
                id: id,
                error: {
                  code: -32601,
                  message: `Unknown tool: ${name}`
                }
              }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
              });
          }
          
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            id: id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            }
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
              ...corsHeaders
            }
          });
        }
        
        // Unknown method
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`
          }
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
        
      } catch (error) {
        console.error('Error processing request:', error);
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: body?.id || null,
          error: {
            code: -32603,
            message: `Internal error: ${error.message}`
          }
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }
    
    return new Response('Not found', { 
      status: 404,
      headers: corsHeaders 
    });
  }
};

// Tool implementations
async function handleSearch(query, env) {
  // Stub implementation - replace with Supabase search
  return {
    results: [
      {
        id: 'doc-001',
        title: `Result for: ${query}`,
        text: `Sample content matching "${query}" from Burns Legal database`,
        url: 'https://burns-legal.com/doc-001',
        score: 0.95
      },
      {
        id: 'doc-002',
        title: `Additional match for: ${query}`,
        text: `Another relevant document for "${query}"`,
        url: 'https://burns-legal.com/doc-002',
        score: 0.87
      }
    ],
    total: 2
  };
}

async function handleFetch(id, env) {
  // Stub implementation - replace with Supabase fetch
  return {
    id: id,
    title: `Document ${id}`,
    text: `Full content of document ${id} from Burns Legal database. This would contain the complete text, metadata, and any associated information.`,
    url: `https://burns-legal.com/${id}`,
    metadata: {
      created: '2025-01-15',
      modified: '2025-08-18',
      type: 'legal-document',
      case: 'Floorable vs Mannington'
    }
  };
}

async function handleLegalSearch(query, limit, env) {
  // Implement vector search against Supabase
  return {
    results: [
      {
        id: 'claim-001',
        content: `Legal context for "${query}"`,
        relevance: 0.92
      }
    ]
  };
}

async function handleGetClaims(params, env) {
  // Stub - implement Supabase query
  return {
    claims: [
      {
        id: 'claim-001',
        title: 'Trade Secret Misappropriation',
        status: params.status || 'active',
        jurisdiction: params.jurisdiction || 'California'
      }
    ]
  };
}

async function handleGetClaimDetails(claimId, env) {
  // Stub - implement Supabase query
  return {
    id: claimId,
    title: 'Trade Secret Misappropriation',
    description: 'Detailed claim information',
    facts: [],
    exhibits: []
  };
}

async function handleGetFactsByClaim(claimId, env) {
  // Stub - implement Supabase query
  return {
    facts: [
      {
        id: 'fact-001',
        claim_id: claimId,
        description: 'Key fact about the claim'
      }
    ]
  };
}

async function handleGetExhibits(params, env) {
  // Stub - implement Supabase query
  return {
    exhibits: [
      {
        id: 'exhibit-001',
        type: params.type || 'document',
        title: 'Key Evidence Document'
      }
    ]
  };
}

async function handleAnalyzeRisk(claimId, env) {
  // Stub - implement risk analysis
  return {
    claim_id: claimId,
    risk_score: 0.75,
    factors: [
      'Strong evidence base',
      'Precedent cases favorable'
    ]
  };
}

// Durable Object classes for backward compatibility
export class MyMCP {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    // Simple passthrough or session management
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export class BurnsLegalEnhancedComplete {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    // Simple passthrough or session management
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export class BurnsLegalEnhancedMCP {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    // Simple passthrough or session management
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}