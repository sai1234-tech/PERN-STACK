/**
 * Real-time Server-Sent Events (SSE) Synchronization Service
 * Enables immediate zero-latency push from backend to all connected clients
 * without requiring manual page refresh.
 */

const clients = new Set();

/**
 * Handle incoming SSE stream connection from frontend clients
 */
export function sseStreamHandler(req, res) {
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "X-Accel-Buffering": "no"
    });

    const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const clientRecord = { id: clientId, res, userId: req.user?.id || req.user?.userId || null };

    // Initial handshake
    const initialPayload = JSON.stringify({
        type: "connected",
        message: "Live HRMS synchronization stream established",
        timestamp: Date.now()
    });
    res.write(`data: ${initialPayload}\n\n`);

    clients.add(clientRecord);

    // Keep-alive heartbeat every 20 seconds to prevent proxy/browser timeout
    const heartbeatTimer = setInterval(() => {
        try {
            if (!res.writableEnded) {
                res.write(`: heartbeat ${Date.now()}\n\n`);
            } else {
                clearInterval(heartbeatTimer);
                clients.delete(clientRecord);
            }
        } catch {
            clearInterval(heartbeatTimer);
            clients.delete(clientRecord);
        }
    }, 20000);

    req.on("close", () => {
        clearInterval(heartbeatTimer);
        clients.delete(clientRecord);
    });
}

/**
 * Broadcast an event to all connected clients immediately
 */
export function broadcastBackendChange(category = "general", details = {}) {
    const payload = JSON.stringify({
        category,
        details,
        timestamp: Date.now()
    });

    for (const client of Array.from(clients)) {
        try {
            if (!client.res.writableEnded) {
                client.res.write(`data: ${payload}\n\n`);
            } else {
                clients.delete(client);
            }
        } catch {
            clients.delete(client);
        }
    }
}

/**
 * Express middleware to automatically broadcast any successful mutation
 * (POST, PUT, PATCH, DELETE) when the controller responds with 2xx status.
 */
export function sseBroadcastMiddleware(req, res, next) {
    const method = req.method.toUpperCase();
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        const originalEnd = res.end;
        res.end = function (...args) {
            const statusCode = res.statusCode;
            if (statusCode >= 200 && statusCode < 300) {
                // Determine resource category from request URL
                const pathParts = req.originalUrl
                    .replace(/^\/api(\/v1)?\//, "")
                    .split("?")[0]
                    .split("/");
                const category = pathParts[0] || "general";
                const action = pathParts[pathParts.length - 1] || method.toLowerCase();

                broadcastBackendChange(category, {
                    method,
                    path: req.originalUrl,
                    action,
                    timestamp: Date.now()
                });
            }
            return originalEnd.apply(this, args);
        };
    }
    next();
}
