#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { MemoryClient } from 'mem0ai';
import { contexaStart } from './contexa-server.js';

let memoryClient: MemoryClient | null = null;

function getMemoryClient(): MemoryClient {
  if (!memoryClient) {
    const MEM0_API_KEY = process?.env?.MEM0_API_KEY || '';
    memoryClient = new MemoryClient({ apiKey: MEM0_API_KEY });
    return memoryClient;
  }

  return memoryClient;
}

// Tool definitions
const ADD_MEMORY_TOOL: Tool = {
  name: 'add-memory',
  description:
    'Add a new memory. This method is called everytime the user informs anything about themselves, their preferences, or anything that has any relevent information whcih can be useful in the future conversation. This can also be called when the user asks you to remember something.',
  inputSchema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The content to store in memory',
      },
      userId: {
        type: 'string',
        description: "User ID for memory storage. If not provided explicitly, use a generic user ID like, 'mem0-mcp-user'",
      },
    },
    required: ['content', 'userId'],
  },
};

const SEARCH_MEMORIES_TOOL: Tool = {
  name: 'search-memories',
  description: 'Search through stored memories. This method is called ANYTIME the user asks anything.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: "The search query. This is the query that the user has asked for. Example: 'What did I tell you about the weather last week?' or 'What did I tell you about my friend John?'",
      },
      userId: {
        type: 'string',
        description: "User ID for memory storage. If not provided explicitly, use a generic user ID like, 'mem0-mcp-user'",
      },
    },
    required: ['query', 'userId'],
  },
};

// Create server instance
const server = new Server(
  {
    name: 'mem0-mcp',
    version: '0.0.1',
  },
  {
    capabilities: {
      tools: {},
      logging: {},
    },
  }
);

// Helper function to add memories
async function addMemory(content: string, userId: string) {
  try {
    const messages: { role: "assistant" | "user"; content: string }[] = [
      { role: "assistant", content: "Memory storage system" },
      { role: "user", content }
    ];
    await getMemoryClient().add(messages, { user_id: userId });
    return true;
  } catch (error) {
    console.error('Error adding memory:', error);
    return false;
  }
}

// Helper function to search memories
async function searchMemories(query: string, userId: string) {
  try {
    const results = await getMemoryClient().search(query, { user_id: userId });
    return results;
  } catch (error) {
    console.error('Error searching memories:', error);
    return [];
  }
}

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [ADD_MEMORY_TOOL, SEARCH_MEMORIES_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    if (!args) {
      throw new Error('No arguments provided');
    }

    switch (name) {
      case 'add-memory': {
        const { content, userId } = args as { content: string, userId: string };
        await addMemory(content, userId);
        return {
          content: [
            {
              type: 'text',
              text: 'Memory added successfully',
            },
          ],
          isError: false,
        };
      }

      case 'search-memories': {
        const { query, userId } = args as { query: string, userId: string };
        const results = await searchMemories(query, userId);
        const formattedResults = results.map((result: any) =>
          `Memory: ${result.memory}\nRelevance: ${result.score}\n---`
        ).join('\n');

        return {
          content: [
            {
              type: 'text',
              text: formattedResults || 'No memories found',
            },
          ],
          isError: false,
        };
      }

      default:
        return {
          content: [
            { type: 'text', text: `Unknown tool: ${name}` },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

contexaStart(server)
