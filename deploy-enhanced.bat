@echo off
set CLOUDFLARE_API_TOKEN=
wrangler deploy -c wrangler.enhanced.jsonc
echo Deployment complete!