import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./mcp.js";
import { validWorkspace } from "../graph/store.js";
const workspace = process.env.MCP_WORKSPACE || "";
if (!validWorkspace(workspace))
  throw new Error("Set MCP_WORKSPACE to an existing authorized workspace ID.");
await createMcpServer(workspace).connect(new StdioServerTransport());
