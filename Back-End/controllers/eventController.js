import { findEmployeeByUserId, findEmployeeByEmail } from "../repositories/employeeRepository.js";
import {
    createEventRecord,
    findEventsByEmployee,
    deleteEventRecord,
} from "../repositories/eventRepository.js";

const resolveEmployee = async (req) => {
    const userId = req.user?.userId || req.user?.id || req.user?._id;
    if (!userId) return null;

    let employee = await findEmployeeByUserId(userId);
    if (!employee && req.user?.email) {
        employee = await findEmployeeByEmail(String(req.user.email).trim().toLowerCase());
    }
    return employee;
};

// GET /api/v1/events/my — Fetch all custom calendar events for logged-in employee
export const getMyEvents = async (req, res) => {
    try {
        const employee = await resolveEmployee(req);
        if (!employee) {
            return res.status(404).json({ success: false, message: "Employee profile not found" });
        }

        const events = await findEventsByEmployee(employee.id);

        const data = events.map((evt) => ({
            id: evt.id,
            _id: evt.id,
            date: evt.date,
            title: evt.title,
            time: evt.time,
            startTime: evt.startTime,
            endTime: evt.endTime,
            duration: evt.duration,
            category: evt.category,
            tag: evt.tag || `Custom ${evt.category}`,
            type: evt.type || "custom",
        }));

        return res.status(200).json({ success: true, count: data.length, data });
    } catch (error) {
        console.error("GET MY EVENTS ERROR:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/v1/events — Create a new calendar event
export const createEvent = async (req, res) => {
    try {
        const employee = await resolveEmployee(req);
        if (!employee) {
            return res.status(404).json({ success: false, message: "Employee profile not found" });
        }

        const { date, title, time, startTime, endTime, duration, category, tag, type } = req.body || {};
        if (!title || !date) {
            return res.status(400).json({ success: false, message: "Title and date are required" });
        }

        const newEvent = await createEventRecord({
            employeeId: employee.id,
            date,
            title: String(title).trim(),
            time: time || "",
            startTime: startTime || "10:00",
            endTime: endTime || "11:30",
            duration: duration || "1 hr 30 mins",
            category: category || "Meeting",
            tag: tag || `Custom ${category || "Meeting"}`,
            type: type || "custom",
        });

        return res.status(201).json({
            success: true,
            message: "Calendar event created successfully",
            data: {
                id: newEvent.id,
                _id: newEvent.id,
                date: newEvent.date,
                title: newEvent.title,
                time: newEvent.time,
                startTime: newEvent.startTime,
                endTime: newEvent.endTime,
                duration: newEvent.duration,
                category: newEvent.category,
                tag: newEvent.tag,
                type: newEvent.type,
            },
        });
    } catch (error) {
        console.error("CREATE EVENT ERROR:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// DELETE /api/v1/events/:id — Delete a calendar event
export const deleteEvent = async (req, res) => {
    try {
        const employee = await resolveEmployee(req);
        if (!employee) {
            return res.status(404).json({ success: false, message: "Employee profile not found" });
        }

        const eventId = Number(req.params.id);
        if (!eventId || Number.isNaN(eventId)) {
            return res.status(400).json({ success: false, message: "Invalid event ID" });
        }

        const deleted = await deleteEventRecord(eventId, employee.id);

        if (!deleted) {
            return res.status(404).json({ success: false, message: "Event not found or unauthorized" });
        }

        return res.status(200).json({ success: true, message: "Event deleted successfully" });
    } catch (error) {
        console.error("DELETE EVENT ERROR:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
