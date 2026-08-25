import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const PORT = Number(process.env.PORT || 8080);
const MCP_TOKEN = process.env.MCP_API_TOKEN || "";

function createServer() {
  const server = new McpServer({
    name: "fly-mcp-gateway",
    version: "1.0.0",
  });

  server.tool(
    "ping",
    "Health check tool — returns ok and server time",
    {},
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            ok: true,
            service: "fly-mcp-gateway",
            time: new Date().toISOString(),
          }),
        },
      ],
    }),
  );

  server.tool(
    "echo",
    "Echo text back (smoke test for MCP clients)",
    { message: z.string().describe("Text to echo") },
    async ({ message }) => ({
      content: [{ type: "text", text: message }],
    }),
  );

  // Add more tools here (or proxy to other backends).
  return server;
}

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "fly-mcp-gateway",
    time: new Date().toISOString(),
  });
});

app.use("/mcp", (req, res, next) => {
  if (!MCP_TOKEN) return next();
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token !== MCP_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
});

/** @type {Map<string, StreamableHTTPServerTransport>} */
const transports = new Map();

app.post("/mcp", async (req, res) => {
  try {
    const sessionId = req.headers["mcp-session-id"];
    let transport = sessionId ? transports.get(String(sessionId)) : undefined;

    if (!transport) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports.set(id, transport);
        },
      });

      transport.onclose = () => {
        const id = transport.sessionId;
        if (id) transports.delete(id);
      };

      const server = createServer();
      await server.connect(transport);
    }

    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP POST error", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  const transport = sessionId ? transports.get(String(sessionId)) : undefined;
  if (!transport) {
    res.status(400).json({ error: "Missing or unknown mcp-session-id" });
    return;
  }
  await transport.handleRequest(req, res);
});

app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  const transport = sessionId ? transports.get(String(sessionId)) : undefined;
  if (transport) {
    await transport.close();
    transports.delete(String(sessionId));
  }
  res.status(204).end();
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`fly-mcp-gateway listening on :${PORT}`);
  console.log(`MCP endpoint: http://0.0.0.0:${PORT}/mcp`);
  console.log(`Auth: ${MCP_TOKEN ? "Bearer token required" : "open (set MCP_API_TOKEN)"}`);
});
