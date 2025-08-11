@echo off
echo Deploying Burns Legal MCP Worker to Cloudflare...

cd "C:\Users\ryanb\Rburns.fresno Dropbox\Burns_Legal\remote-mcp-server-authless"

echo Installing dependencies...
npm install

echo Building TypeScript...
npx tsc

echo Deploying to Cloudflare Workers...
npx wrangler deploy

echo Deployment complete!
echo Worker URL: https://burns-legal-mcp-authless.rburns-fresno.workers.dev

pause