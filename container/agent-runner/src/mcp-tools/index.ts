/**
 * MCP tools barrel — imports each tool module for its side-effect
 * `registerTools([...])` call, then starts the MCP server.
 *
 * Adding a new tool module: create the file, call `registerTools([...])`
 * at module scope, and append the import here. No central list.
 */
import './core.js';
import './scheduling.js';
import './interactive.js';
import './agents.js';
import './self-mod.js';
import { startMcpServer } from './server.js';
import { loadConfig } from '../config.js';
import { registerProjectTools } from './projects.js';

function log(msg: string): void {
  console.error(`[mcp-tools] ${msg}`);
}

const config = loadConfig();
if (config.features?.includes('projects')) {
  registerProjectTools();
}

startMcpServer().catch((err) => {
  log(`MCP server error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
