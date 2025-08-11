# Burns Legal Enhanced MCP - Deployment Guide

## Current Production URL
https://burns-legal-enhanced-authless.rburns-fresno.workers.dev

## Stable Version
**v1.0-stable** - Full implementation with all 16 tools

## Tools Available

The Burns Legal Enhanced MCP provides these 16 tools:

1. **search** - Universal search (vector + keyword fallback)
2. **search_legal_context** - Search legal documents with context
3. **get_claims** - Retrieve all claims
4. **get_claim_details** - Get specific claim details
5. **get_exhibits** - List all exhibits
6. **get_exhibit_details** - Get specific exhibit information
7. **get_facts_by_claim** - Get facts for a specific claim
8. **get_entities** - List all entities
9. **get_individuals** - List all individuals
10. **analyze_claim_risk** - Analyze risk for claims
11. **search_exhibits_by_date** - Search exhibits by date range
12. **get_exhibit_relationships** - Get exhibit relationships
13. **get_timeline_events** - Get timeline of events
14. **calculate_damages** - Calculate damages
15. **get_legal_precedents** - Get legal precedents
16. **generate_case_summary** - Generate case summary

## Deployment Methods

### Method 1: GitHub Actions (Recommended)
```bash
# Automatic deployment on push to main
git push origin main

# Manual deployment via GitHub UI
# Go to Actions > Deploy Burns Legal Enhanced MCP > Run workflow
```

### Method 2: Local Deployment
```bash
cd remote-mcp-server-authless
npm install
npm run build
wrangler deploy -c wrangler.enhanced.toml
wrangler secret put SUPABASE_SERVICE_ROLE_KEY -c wrangler.enhanced.toml
```

### Method 3: Quick Deploy Script
```bash
cd remote-mcp-server-authless
./deploy-enhanced.bat
```

## Environment Variables

Required secrets (set in GitHub Secrets or via wrangler):
- `CLOUDFLARE_API_TOKEN` - Your Cloudflare API token
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

Configuration in `wrangler.enhanced.toml`:
- `SUPABASE_URL` - https://nqkzqcsqfvpquticvwmk.supabase.co

## Version Management

### Tagging Strategy
```bash
# Production releases
git tag -a v1.1-stable -m "Description of changes"
git push origin v1.1-stable

# Development versions
git tag -a v1.1-dev -m "Development version"
git push origin v1.1-dev

# Deployment timestamps (automated)
# Format: deploy-YYYYMMDD-HHMMSS
```

### Viewing Deployment History
```bash
# List all deployments
git tag -l "deploy-*" --sort=-version:refname

# View specific deployment
git show deploy-20250811-120000

# Check current production version
curl https://burns-legal-enhanced-authless.rburns-fresno.workers.dev/version
```

## Testing

### Health Check
```bash
curl https://burns-legal-enhanced-authless.rburns-fresno.workers.dev/health
```

### Test Search Tool
```bash
curl -X POST https://burns-legal-enhanced-authless.rburns-fresno.workers.dev/sse \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "search",
      "arguments": {
        "query": "fraud",
        "options": {"limit": 5}
      }
    },
    "id": 1
  }'
```

### Connect from Claude Desktop
```json
{
  "mcpServers": {
    "burns-legal": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://burns-legal-enhanced-authless.rburns-fresno.workers.dev/sse"
      ]
    }
  }
}
```

## Monitoring

### Cloudflare Dashboard
https://dash.cloudflare.com/ > Workers & Pages > burns-legal-enhanced-authless

### Real-time Logs
```bash
wrangler tail burns-legal-enhanced-authless
```

### Metrics
- Request count
- Error rate
- Response time
- Tool usage statistics

## Rollback Procedure

### Quick Rollback to v1.0-stable
```bash
cd remote-mcp-server-authless
git checkout v1.0-stable
npm run build
wrangler deploy -c wrangler.enhanced.toml
```

### Rollback via GitHub
```bash
# Find previous deployment
git tag -l "deploy-*" --sort=-version:refname | head -5

# Checkout and deploy
git checkout deploy-20250810-153000
git push origin main --force-with-lease
```

## Troubleshooting

### Common Issues

1. **Tools not appearing in Claude Desktop**
   - Check MCP server URL in config
   - Verify worker is deployed: `curl https://burns-legal-enhanced-authless.rburns-fresno.workers.dev/health`
   - Check Claude Desktop logs

2. **Supabase connection errors**
   - Verify SUPABASE_SERVICE_ROLE_KEY is set
   - Check Supabase URL in wrangler.enhanced.toml
   - Test Supabase directly

3. **Deployment failures**
   - Check GitHub Actions logs
   - Verify CLOUDFLARE_API_TOKEN in GitHub Secrets
   - Run `npm run build` locally to check for TypeScript errors

## Support

- GitHub Issues: https://github.com/rsburns21/remote-mcp-server-authless/issues
- Worker Logs: `wrangler tail burns-legal-enhanced-authless`
- Cloudflare Support: https://dash.cloudflare.com/support