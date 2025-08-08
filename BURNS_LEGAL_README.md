# Burns Legal MCP Servers

Enhanced MCP servers for Burns Legal case management system, deployed on Cloudflare Workers.

## 🚀 Deployed Workers

### 1. Enhanced Worker (NEW - 16 tools)
- **URL**: https://burns-legal-enhanced-authless.rburns-fresno.workers.dev
- **Status**: https://burns-legal-enhanced-authless.rburns-fresno.workers.dev/health
- **Discovery**: https://burns-legal-enhanced-authless.rburns-fresno.workers.dev/.well-known/mcp.json
- **Tools**: 16 comprehensive legal tools

### 2. Remote Worker (8 tools)
- **URL**: https://burns-legal-remote-authless.rburns-fresno.workers.dev
- **Tools**: Unified search and analysis

### 3. FastMCP Worker (6 tools)
- **URL**: https://burns-legal-fastmcp-authless.rburns-fresno.workers.dev
- **Tools**: Core legal document search

### 4. ChatGPT Worker (2 tools)
- **URL**: https://burns-legal-chatgpt-authless.rburns-fresno.workers.dev
- **Tools**: Simple search and fetch

## 🛠️ Available Tools

### Enhanced Worker Tools (16)
1. `search` - Vector-first search with keyword fallback
2. `fetch` - Universal resource fetcher
3. `vector_search_embeddings` - Direct pgvector semantic search
4. `keyword_search` - Pattern-based search on exhibits
5. `fetch_exhibit` - Get specific exhibit by ID
6. `list_exhibits` - List all exhibits with filtering
7. `fetch_claim` - Get specific claim
8. `list_claims` - List all claims with filtering
9. `get_facts_by_claim` - Facts linked to claims
10. `get_facts_by_exhibit` - Facts from exhibits
11. `analyze_claim_risk` - Risk assessment
12. `get_exhibit_relationships` - Connection mapping
13. `get_entities` - Companies/organizations
14. `get_individuals` - People involved
15. `get_case_statistics` - Overall case metrics

## 📦 Local Development

### Prerequisites
- Node.js 20+
- Cloudflare account
- Wrangler CLI

### Setup
```bash
# Clone the repository
git clone https://github.com/Billyho21/remote-mcp-server-authless.git
cd remote-mcp-server-authless

# Install dependencies
npm install

# Build workers
npm run build:enhanced

# Deploy enhanced worker
npm run deploy:enhanced
```

### Environment Variables
Create a `.dev.vars` file:
```
SUPABASE_URL=https://nqkzqcsqfvpquticvwmk.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_key_here
```

## 🔧 Configuration Files

- `wrangler.enhanced.jsonc` - Enhanced worker (16 tools)
- `wrangler.remote.jsonc` - Remote worker (8 tools)
- `wrangler.fastmcp.jsonc` - FastMCP worker (6 tools)
- `wrangler.chatgpt.jsonc` - ChatGPT worker (2 tools)

## 📝 Scripts

```json
{
  "build": "wrangler deploy --dry-run --outdir dist",
  "build:enhanced": "wrangler deploy --dry-run --outdir dist-enhanced -c wrangler.enhanced.jsonc",
  "deploy": "wrangler deploy",
  "deploy:enhanced": "wrangler deploy -c wrangler.enhanced.jsonc"
}
```

## 🔗 Claude Desktop Configuration

Add to Claude Desktop settings (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "burns-legal-enhanced": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://burns-legal-enhanced-authless.rburns-fresno.workers.dev/sse"
      ]
    }
  }
}
```

## 🔗 ChatGPT Configuration

Use as a custom action with OpenAPI schema available at:
https://burns-legal-chatgpt-authless.rburns-fresno.workers.dev/.well-known/mcp.json

## 📊 Database

Connected to Supabase PostgreSQL with:
- Vector embeddings (384-dimensional)
- Full-text search
- Legal case data for Floorable and Mannington cases

## 🚀 GitHub Actions

Automated deployment workflows in `.github/workflows/`:
- `deploy-enhanced.yml` - Deploy enhanced worker
- `deploy-all.yml` - Deploy all workers

## 📄 License

Private repository for Burns Legal

## 🤝 Support

For issues or questions, contact the Burns Legal development team.