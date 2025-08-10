// src/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  StreamableHTTPServerTransport,
} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import cors from 'cors';
import { randomUUID } from 'crypto';
import express, { Application, Request, Response } from 'express';

import dotenv from 'dotenv';

import {
  ConsoleAdapter,
  ContexaTraceAdapter,
  MultiAdapter,
  TraceMiddleware,
} from 'mcp-trace';

dotenv.config();

const SERVER_NAME = 'Contexa';
const SERVER_VERSION = '0.1.0';
const PORT = 8080;

/**
 * Utility to build standard MCP error response
 */
const createMcpError = (message: string) => ({
  jsonrpc: '2.0',
  error: {
    code: -32000,
    message,
  },
  id: null,
});

const respondError = (res: Response, message: string) => {
  res.status(400).json(createMcpError(message));
};

/**
 * Initialize Contexa Trace middleware
 */
const initializeTracing = (app: Application) => {
  const consoleAdapter = new ConsoleAdapter();
  const contexaAdapter = new ContexaTraceAdapter();
  const multiAdapter = new MultiAdapter(contexaAdapter, consoleAdapter);

  const middleware = new TraceMiddleware({ adapter: multiAdapter });
  app.use(middleware.express());
};

/**
 * Start Contexa MCP server
 */
export async function contexaStart(server: Server) {
  const app = express();
  const transports: Record<string, StreamableHTTPServerTransport> = {};

  app.use(cors());
  app.use(express.json());
  initializeTracing(app);

  app.get(['/health', '/'], (_req, res) => {
    res.json({ status: 'OK', server: SERVER_NAME, version: SERVER_VERSION });
  });

  app.post('/mcp', async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports[id] = transport;
        },
      });

      transport.onclose = () => {
        if (transport.sessionId) delete transports[transport.sessionId];
      };

      await server.connect(transport);
    } else if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else {
      return respondError(res, 'Bad Request: No valid session ID provided');
    }

    await transport.handleRequest(req, res, req.body);
  });

  const handleSessionRequest = async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (!sessionId || !transports[sessionId]) {
      return respondError(res, 'Bad Request: No valid session ID provided');
    }

    await transports[sessionId].handleRequest(req, res, req.body);
  };

  app.get('/mcp', handleSessionRequest);
  app.delete('/mcp', handleSessionRequest);

  app.listen(PORT, () => {
    console.log(`\u2728 MCP Web Server running at http://localhost:${PORT}`);
    console.log(`\u25B6\uFE0F Endpoint:        http://localhost:${PORT}/mcp`);
    console.log(`\uD83D\uDC9A Health Check:    http://localhost:${PORT}/health`);
  });
}
