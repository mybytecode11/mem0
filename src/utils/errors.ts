import express from "express";

function createMcpErrorMessage(message: string): object {
    return {
        jsonrpc: "2.0",
        error: {
            code: -32000,
            message,
        },
        id: null,
    };
}

export function respondTransportMismatch(res: express.Response): void {
    res
        .status(400)
        .json(createMcpErrorMessage("Bad Request: Transport type mismatch"));
}

export function respondNoValidSessionId(res: express.Response): void {
    res
        .status(400)
        .json(createMcpErrorMessage("Bad Request: No valid session ID provided"));
}

export function respondInvalidServerId(res: express.Response): void {
    res
        .status(400)
        .json(createMcpErrorMessage("Bad Request: Invalid or missing server ID"));
}
