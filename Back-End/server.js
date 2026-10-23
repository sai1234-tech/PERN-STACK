import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import { autoClockOutOverEightHours } from "./repositories/attendanceRepository.js";
import { broadcastBackendChange } from "./services/sseService.js";

const PORT = process.env.PORT || 5005;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);

    // Recurring background daemon: Enforce strict 8-hour shift clock-in limit
    setInterval(async () => {
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
            // Log quietly to prevent crash
            console.error("[Shift Governance Notice] Auto clock-out check error:", err.message);
        }
    }, 30000);
});