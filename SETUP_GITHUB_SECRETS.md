# GitHub Actions Secret Setup

## Required Secrets

To enable automated deployments via GitHub Actions, you need to add the following secrets to your repository:

### 1. CLOUDFLARE_API_TOKEN

This token is required for GitHub Actions to deploy to Cloudflare Workers.

**Working token from .env.txt (line 97):**
- Token: `OO8p-G-ZdQXBj9AmeXIwLYEJPeEDn8Uhc_x0y8KH`

**How to add/update in GitHub:**
1. Go to https://github.com/rsburns21/remote-mcp-server-authless/settings/secrets/actions
2. Click "New repository secret" (or update existing)
3. Name: `CLOUDFLARE_API_TOKEN`
4. Value: `OO8p-G-ZdQXBj9AmeXIwLYEJPeEDn8Uhc_x0y8KH`
5. Click "Add secret" or "Update secret"

### 2. SUPABASE_SERVICE_ROLE_KEY

This is needed for the worker to connect to Supabase database.

**Your existing key from .env.txt (line 28):**
- Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xa3pxY3NxZnZwcXV0aWN2d21rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTcwNTU2MywiZXhwIjoyMDY3MjgxNTYzfQ.vWw0UF1hR8kCMC-NmGOpUcJwAgr3ehKAFRcF0EEdbBs`

**How to add to GitHub:**
1. Go to https://github.com/rsburns21/remote-mcp-server-authless/settings/secrets/actions
2. Click "New repository secret"
3. Name: `SUPABASE_SERVICE_ROLE_KEY`
4. Value: Paste the key above
5. Click "Add secret"

## Manual Deployment

If you prefer to deploy manually without GitHub Actions:

```bash
# Deploy directly from command line
wrangler deploy -c wrangler.enhanced.toml

# Set Supabase secret
wrangler secret put SUPABASE_SERVICE_ROLE_KEY -c wrangler.enhanced.toml
```

## Current Status

- Worker is deployed and functional at: https://burns-legal-enhanced-authless.rburns-fresno.workers.dev
- GitHub Actions workflow is configured but needs CLOUDFLARE_API_TOKEN secret
- Manual deployments work fine without the GitHub Actions