import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Context file names that can be read/written
 */
const CONTEXT_FILES = [
  "activeContext.md",
  "systemPatterns.md",
  "techContext.md",
  "productContext.md",
  "progress.md",
] as const;

type ContextFile = (typeof CONTEXT_FILES)[number];

/**
 * Validate and normalize context file name
 */
function isValidContextFile(file: string): file is ContextFile {
  return CONTEXT_FILES.includes(file as ContextFile);
}

/**
 * Get absolute path to context directory
 */
function getContextDir(): string {
  const cwd = process.cwd();
  return join(cwd, ".context");
}

/**
 * Get absolute path to a context file
 */
function getContextFilePath(file: ContextFile): string {
  return join(getContextDir(), file);
}

/**
 * Check if a file exists in the context directory
 */
function contextFileExists(file: ContextFile): boolean {
  return existsSync(getContextFilePath(file));
}

/**
 * Get list of all available context files in the workspace
 */
function getAvailableContextFiles(): string[] {
  const contextDir = getContextDir();
  if (!existsSync(contextDir)) {
    return [];
  }
  return readdirSync(contextDir)
    .filter((f) => f.endsWith(".md"))
    .sort();
}

/**
 * Get list of all Tocket-managed files in the workspace
 */
function getTocketManagedFiles(): string[] {
  const cwd = process.cwd();
  const files: string[] = [];

  // Add .context files
  const contextDir = getContextDir();
  if (existsSync(contextDir)) {
    const contextFiles = readdirSync(contextDir);
    contextFiles.forEach((f) => {
      files.push(`.context/${f}`);
    });
  }

  // Add TOCKET.md
  if (existsSync(join(cwd, "TOCKET.md"))) {
    files.push("TOCKET.md");
  }

  // Add agent config files
  const agentFiles = ["CLAUDE.md", "GEMINI.md", "ARCHITECT.md"];
  agentFiles.forEach((f) => {
    if (existsSync(join(cwd, f))) {
      files.push(f);
    }
  });

  return files.sort();
}

/**
 * Compute workspace status
 */
function getWorkspaceStatus(): {
  projectName: string;
  currentFocus: string;
  hasWorkspace: boolean;
  stalenessHours: number | null;
  contextFiles: string[];
} {
  const cwd = process.cwd();
  const contextDir = getContextDir();
  const hasWorkspace = existsSync(contextDir);

  let currentFocus = "";
  let stalenessHours: number | null = null;

  if (hasWorkspace && contextFileExists("activeContext.md")) {
    try {
      const content = readFileSync(
        getContextFilePath("activeContext.md"),
        "utf-8",
      );

      // Extract current focus from "## Current Focus" section
      const focusMatch = content.match(/## Current Focus\s*\n+(.+)/);
      if (focusMatch?.[1]) {
        const line = focusMatch[1].trim();
        if (!line.startsWith("_") && !line.includes("No active tasks")) {
          currentFocus = line.length > 100 ? line.substring(0, 97) + "..." : line;
        }
      }

      // Compute staleness in hours
      const stats = statSync(getContextFilePath("activeContext.md"));
      stalenessHours = Math.floor((Date.now() - stats.mtimeMs) / (1000 * 60 * 60));
    } catch (e) {
      // Ignore errors reading activeContext
    }
  }

  // Try to extract project name from package.json
  let projectName = "unknown";
  try {
    const pkgPath = join(cwd, "package.json");
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      projectName = pkg.name || "unknown";
    }
  } catch (e) {
    // Ignore errors
  }

  return {
    projectName,
    currentFocus,
    hasWorkspace,
    stalenessHours,
    contextFiles: getAvailableContextFiles(),
  };
}

/**
 * Start the MCP server
 */
export async function startServer(): Promise<void> {
  const server = new Server({
    name: "tocket-context-server",
    version: "1.0.0",
  });

  /**
   * List available tools
   */
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: Tool[] = [
      {
        name: "tocket_read_context",
        description:
          "Read the contents of a .context/ file (activeContext, systemPatterns, techContext, productContext, or progress)",
        inputSchema: {
          type: "object",
          properties: {
            file: {
              type: "string",
              enum: CONTEXT_FILES,
              description: "The context file to read",
            },
          },
          required: ["file"],
        },
      },
      {
        name: "tocket_update_context",
        description: "Update the contents of a .context/ file",
        inputSchema: {
          type: "object",
          properties: {
            file: {
              type: "string",
              enum: CONTEXT_FILES,
              description: "The context file to update",
            },
            content: {
              type: "string",
              description: "The new content to write to the file",
            },
          },
          required: ["file", "content"],
        },
      },
      {
        name: "tocket_get_status",
        description:
          "Get a summary of the current Tocket workspace (project name, focus, staleness, file list)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "tocket_read_protocol",
        description:
          "Read the full Tocket protocol specification (TOCKET.md)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "tocket_list_files",
        description:
          "List all Tocket-managed files (.context files, TOCKET.md, agent config files)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ];

    return { tools };
  });

  /**
   * Handle tool calls
   */
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const typedArgs = (args ?? {}) as Record<string, unknown>;

    try {
      switch (name) {
        case "tocket_read_context": {
          const file = typedArgs.file as string;
          if (!isValidContextFile(file)) {
            return {
              content: [
                {
                  type: "text",
                  text: `Invalid context file: ${file}. Valid files are: ${CONTEXT_FILES.join(", ")}`,
                },
              ],
              isError: true,
            };
          }

          if (!contextFileExists(file)) {
            return {
              content: [
                {
                  type: "text",
                  text: `Context file not found: ${file}`,
                },
              ],
              isError: true,
            };
          }

          const content = readFileSync(getContextFilePath(file), "utf-8");
          return {
            content: [
              {
                type: "text",
                text: content,
              },
            ],
          };
        }

        case "tocket_update_context": {
          const file = typedArgs.file as string;
          const content = typedArgs.content as string;

          if (!isValidContextFile(file)) {
            return {
              content: [
                {
                  type: "text",
                  text: `Invalid context file: ${file}. Valid files are: ${CONTEXT_FILES.join(", ")}`,
                },
              ],
              isError: true,
            };
          }

          if (!content || typeof content !== "string") {
            return {
              content: [
                {
                  type: "text",
                  text: "Content must be a non-empty string",
                },
              ],
              isError: true,
            };
          }

          const filePath = getContextFilePath(file);
          writeFileSync(filePath, content, "utf-8");

          return {
            content: [
              {
                type: "text",
                text: `Successfully updated ${file} (${content.length} bytes)`,
              },
            ],
          };
        }

        case "tocket_get_status": {
          const status = getWorkspaceStatus();
          const statusText = `Project: ${status.projectName}
Has Workspace: ${status.hasWorkspace}
Current Focus: ${status.currentFocus || "(none)"}
Staleness: ${status.stalenessHours !== null ? `${status.stalenessHours} hours ago` : "N/A"}
Context Files: ${status.contextFiles.length > 0 ? status.contextFiles.join(", ") : "none"}`;

          return {
            content: [
              {
                type: "text",
                text: statusText,
              },
            ],
          };
        }

        case "tocket_read_protocol": {
          const cwd = process.cwd();
          const protocolPath = join(cwd, "TOCKET.md");

          if (!existsSync(protocolPath)) {
            return {
              content: [
                {
                  type: "text",
                  text: "TOCKET.md protocol file not found in the current directory",
                },
              ],
              isError: true,
            };
          }

          const content = readFileSync(protocolPath, "utf-8");
          return {
            content: [
              {
                type: "text",
                text: content,
              },
            ],
          };
        }

        case "tocket_list_files": {
          const files = getTocketManagedFiles();
          return {
            content: [
              {
                type: "text",
                text: files.length > 0 ? files.join("\n") : "(no Tocket files found)",
              },
            ],
          };
        }

        default:
          return {
            content: [
              {
                type: "text",
                text: `Unknown tool: ${name}`,
              },
            ],
            isError: true,
          };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Start the server on stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
