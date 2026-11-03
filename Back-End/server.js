import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import pool from "./config/db.js";
import { autoClockOutOverEightHours } from "./repositories/attendanceRepository.js";
import { broadcastBackendChange } from "./services/sseService.js";

const PORT = process.env.PORT || 5005;

const server = app.listen(PORT, () => {
    console.log(`[Enterprise Core] Server running on port ${PORT} (PID: ${process.pid})`);

    // Recurring background daemon: Enforce strict 8-hour shift clock-in limit
    const autoClockOutInterval = setInterval(async () => {
        try {
            const autoClosed = await autoClockOutOverEightHours();
            if (autoClosed && autoClosed.length > 0) {
                console.log(`[Shift Governance] Auto clocked out ${autoClosed.length} active shift(s) reaching the 8-hour limit.`);
                autoClosed.forEach((rec) => {
                    broadcastBackendChange("attendance", {
                        action: "auto-clockout-8h",
                        employeeId: rec.employee_id
                    });
                });
            }
        } catch (err) {
            console.error("[Shift Governance Notice] Auto clock-out check error:", err.message);
        }
    }, 30000);

    // Graceful Shutdown Handler (Senior SRE standard: clean exit without dropped requests)
    const gracefulShutdown = async (signal) => {
        console.log(`\n[Process] Received ${signal}. Initiating graceful shutdown...`);
        clearInterval(autoClockOutInterval);

        server.close(async () => {
            console.log("[Process] HTTP connections closed.");
            try {
                await pool.end();
                console.log("[Process] PostgreSQL pool drained and disconnected.");
                process.exit(0);
            } catch (err) {
                console.error("[Process] Error draining database pool:", err.message);
                process.exit(1);
            }
        });

        // Fail-safe force exit after 8 seconds
        setTimeout(() => {
            console.error("[Process] Forcefully terminating after timeout.");
            process.exit(1);
        }, 8000).unref();
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
});
