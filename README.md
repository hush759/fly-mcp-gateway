# fly-mcp-gateway

Always-on **Streamable HTTP** MCP gateway for [Fly.io](https://fly.io).
Use this instead of a flaky Cloudflare Tunnel (`mcp.oceanways.online`).

- Endpoint: `https://<your-app>.fly.dev/mcp`
- Health: `https://<your-app>.fly.dev/health`
- Optional auth: `Authorization: Bearer <MCP_API_TOKEN>`

## Deploy (once)

```bash
# 1. Install flyctl — https://fly.io/docs/hands-on/install-flyctl/
fly auth login

# 2. Clone
git clone https://github.com/hush759/fly-mcp-gateway.git
cd fly-mcp-gateway

# 3. Launch (creates app + deploys)
fly launch --copy-config --yes

# 4. Set a secret token (recommended)
fly secrets set MCP_API_TOKEN="$(openssl rand -hex 24)"

# 5. Redeploy if needed
fly deploy
```

Pick a unique app name when prompted (e.g. `clipboardh-mcp` or `hush759-mcp`).

## Point Grok / Cursor at it

Replace the old oceanways URL with:

```json
{
  "mcpServers": {
    "fly-gateway": {
      "type": "streamable-http",
      "url": "https://YOUR-APP.fly.dev/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```

## Free plan notes

`fly.toml` sets:

- `auto_stop_machines = "off"`
- `min_machines_running = 1`

That keeps **one machine running** so MCP does not cold-start. Free allowance is limited — watch [Fly billing](https://fly.io/dashboard) so you do not exceed free credits.

## Add tools

Edit `server.js` and register more `server.tool(...)` handlers, then:

```bash
git add -A && git commit -m "feat: more tools" && git push
fly deploy
```

## Local test

```bash
npm install
MCP_API_TOKEN=dev node server.js
# curl http://localhost:8080/health
```
