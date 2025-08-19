import mcpModule from "./burns-legal-mcp-202508182039.js";

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

export default {
  async fetch(req, env, ctx) {
    const { pathname } = new URL(req.url);
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204 });
    }
    if (pathname === "/healthz") {
      const required = ["SUPABASE_URL"];
      const missing = required.filter((k) => !env[k]);
      return json({ ok: missing.length === 0, missing });
    }
    if (mcpModule && mcpModule.fetch) {
      return mcpModule.fetch(req, env, ctx);
    }
    if (mcpModule && mcpModule.default && mcpModule.default.fetch) {
      return mcpModule.default.fetch(req, env, ctx);
    }
    return json({ error: "Not Found" }, 404);
  },
};


