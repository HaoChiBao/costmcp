import type { McpAuthContext } from "@/lib/mcp/auth";
import { ensurePermission, findTool, MCP_TOOLS } from "@/lib/mcp/tools";

const SERVER_INFO = { name: "costmcp", version: "0.2.0" };
const SUPPORTED_PROTOCOL = "2025-06-18";

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INTERNAL_ERROR = -32603;

/** Dispatch a single JSON-RPC message. Returns null for notifications. */
export async function dispatch(
  ctx: McpAuthContext,
  message: JsonRpcRequest,
): Promise<JsonRpcResponse | null> {
  const { id, method } = message;
  const isNotification = id === undefined || id === null;

  if (message.jsonrpc !== "2.0" || typeof method !== "string") {
    if (isNotification) return null;
    return errorResponse(id ?? null, INVALID_REQUEST, "Invalid JSON-RPC request");
  }

  try {
    switch (method) {
      case "initialize": {
        const requested = (message.params?.protocolVersion as string) ?? SUPPORTED_PROTOCOL;
        return result(id!, {
          protocolVersion: requested,
          capabilities: { tools: { listChanged: true } },
          serverInfo: SERVER_INFO,
        });
      }
      case "notifications/initialized":
      case "notifications/cancelled":
        return null;
      case "ping":
        return result(id!, {});
      case "tools/list":
        return result(id!, {
          tools: MCP_TOOLS.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        });
      case "tools/call":
        return await handleToolCall(ctx, id!, message.params ?? {});
      default:
        if (isNotification) return null;
        return errorResponse(id!, METHOD_NOT_FOUND, `Method not found: ${method}`);
    }
  } catch (err) {
    if (isNotification) return null;
    const msg = err instanceof Error ? err.message : "Internal error";
    return errorResponse(id ?? null, INTERNAL_ERROR, msg);
  }
}

async function handleToolCall(
  ctx: McpAuthContext,
  id: string | number,
  params: Record<string, unknown>,
): Promise<JsonRpcResponse> {
  const name = params.name as string | undefined;
  const args = (params.arguments as Record<string, unknown>) ?? {};
  if (!name) return errorResponse(id, INVALID_REQUEST, "Missing tool name");

  const tool = findTool(name);
  if (!tool) return errorResponse(id, METHOD_NOT_FOUND, `Unknown tool: ${name}`);

  try {
    ensurePermission(ctx, tool);
    const output = await tool.handler(ctx, args);
    return result(id, {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
    });
  } catch (err) {
    // Tool-level failures are reported as a successful RPC with isError set, per
    // the MCP spec, so the model can see and react to the error text.
    const msg = err instanceof Error ? err.message : "Tool execution failed";
    return result(id, {
      content: [{ type: "text", text: msg }],
      isError: true,
    });
  }
}

function result(id: string | number, value: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result: value };
}

function errorResponse(
  id: string | number | null,
  code: number,
  message: string,
): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

export const JSON_RPC_ERRORS = { PARSE_ERROR };
