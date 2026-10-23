import { findEmployeeByUserId, findEmployeeByEmail, updateEmployeeRecord, countEmployees } from "../repositories/employeeRepository.js";
import {
    upsertDailyPulseRecord,
    findDailyPulseByEmployeeAndDate,
    findDailyPulsesByDate,
    aggregateDepartmentPulseByDate,
    findRecentPulsesAdmin,
} from "../repositories/pulseRepository.js";

const getTodayDateString = () => {
    return new Date().toISOString().split("T")[0];
};

const getEmployeeByUser = async (userId, email) => {
    let employee = await findEmployeeByUserId(userId);

    if (!employee && email) {
        employee = await findEmployeeByEmail(email.trim().toLowerCase());
        if (employee && !employee.user_id) {
            await updateEmployeeRecord(employee.id, { user_id: userId });
        }
    }

    return employee;
};

// =====================================================
// SUBMIT / UPDATE TODAY'S PULSE
// =====================================================
export const submitPulse = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.id || req.user._id;
        const email = req.user.email;

        const employee = await getEmployeeByUser(userId, email);
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee profile not found",
            });
        }

        const { score, feedback } = req.body || {};
        const numScore = Number(score);

        if (!numScore || numScore < 1 || numScore > 5) {
            return res.status(400).json({
                success: false,
                message: "Score must be a number between 1 and 5",
            });
        }

        const todayStr = getTodayDateString();
        const deptName = employee.employment?.department || employee.department || "General";

        const pulse = await upsertDailyPulseRecord({
            employeeId: employee.id,
            userId,
            department: deptName,
            date: todayStr,
            score: numScore,
            feedback: feedback || "",
        });

        return res.status(200).json({
            success: true,
            data: pulse,
            message: "Daily Pulse score recorded successfully",
        });
    } catch (error) {
        console.error("submitPulse error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to record daily pulse",
        });
    }
};

// =====================================================
// GET TODAY'S PULSE FOR LOGGED IN EMPLOYEE
// =====================================================
export const getTodayPulse = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.id || req.user._id;
        const email = req.user.email;

        const employee = await getEmployeeByUser(userId, email);
        if (!employee) {
            return res.status(200).json({
                success: true,
                data: null,
            });
        }

        const todayStr = getTodayDateString();
        const pulse = await findDailyPulseByEmployeeAndDate(employee.id, todayStr);

        return res.status(200).json({
            success: true,
            data: pulse || null,
        });
    } catch (error) {
        console.error("getTodayPulse error:", error);
        return res.status(500).json({
            success: false,
            message: "Server Error",
        });
    }
};

// =====================================================
// GET HR ENGAGEMENT ANALYTICS
// =====================================================
export const getPulseAnalytics = async (req, res) => {
    try {
        const todayStr = getTodayDateString();
        const totalEmployees = await countEmployees();

        // 1. Today's Responses
        const todayPulses = await findDailyPulsesByDate(todayStr);
        const todaysResponses = todayPulses.length;

        const averagePulseScore = todaysResponses > 0
            ? Number((todayPulses.reduce((sum, p) => sum + p.score, 0) / todaysResponses).toFixed(1))
            : 0;

        const responseRate = totalEmployees > 0
            ? Math.min(100, Math.round((todaysResponses / totalEmployees) * 100))
            : 0;

        // 2. Weekly Trend (Last 7 days)
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const weeklyTrend = [];

        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dStr = d.toISOString().split("T")[0];
            const dayName = days[d.getDay()];

            const dayPulses = await findDailyPulsesByDate(dStr);
            const dayCount = dayPulses.length;
            const dayAvg = dayCount > 0
                ? Number((dayPulses.reduce((sum, p) => sum + p.score, 0) / dayCount).toFixed(1))
                : 0;

            weeklyTrend.push({
                date: dStr,
                dayName,
                avgScore: dayAvg,
                responseCount: dayCount,
            });
        }

        // 3. Department Comparison
        const deptAgg = await aggregateDepartmentPulseByDate(todayStr);

        const departmentComparison = deptAgg.map((item) => ({
            department: item.department || "General",
            avgScore: Number(Number(item.avg_score || 0).toFixed(1)),
            count: Number(item.count || 0),
        }));

        // 4. Employee Response List
        const rawResponses = await findRecentPulsesAdmin(30);

        const recentResponses = rawResponses.map((p) => {
            const firstName = p.first_name || p.user_name?.split(" ")[0] || "Employee";
            const lastName = p.last_name || p.user_name?.split(" ").slice(1).join(" ") || "";
            const fullName = `${firstName} ${lastName}`.trim();

            return {
                id: p.id,
                employeeName: fullName,
                firstName,
                lastName,
                employeeCode: p.employee_code || "EMP003",
                profilePhoto: p.profile_photo || "",
                department: p.department || p.emp_department || "General",
                designation: p.designation || "Team Member",
                score: Number(p.score),
                feedback: p.feedback || "Workload score logged.",
                date: p.date,
                createdAt: p.created_at,
            };
        });

        return res.status(200).json({
            success: true,
            data: {
                todaysResponses,
                totalEmployees,
                averagePulseScore,
                responseRate,
                weeklyTrend,
                departmentComparison,
                recentResponses,
            },
        });
    } catch (error) {
        console.error("getPulseAnalytics error:", error);
        return res.status(500).json({
            success: false,
            message: "Server Error",
        });
    }
};
