@echo off
set CLOUDFLARE_API_TOKEN=
wrangler deploy -c wrangler.enhanced.toml
wrangler secret put SUPABASE_SERVICE_ROLE_KEY -c wrangler.enhanced.toml
echo Deployment complete!