import {
    findAllHolidays,
    countHolidays,
    createHolidayRecord,
    updateHolidayRecord,
    findHolidayById,
    seedDefaultHolidays,
    deleteHolidayRecord,
} from "../repositories/holidayRepository.js";
import {
    fetchGoogleCalendarHolidays,
    syncGoogleCalendarToDatabase,
    GOOGLE_CALENDAR_MAP,
} from "../services/googleCalendarService.js";

// Get all holidays (supports dynamic Google Calendar query: ?source=google&year=2026&region=india)
export const getAllHolidays = async (req, res) => {
    try {
        const { source, year, region = "india", mode } = req.query || {};

        // If client requests live dynamic Google Calendar holidays directly
        if (source === "google" || mode === "live") {
            const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();
            const liveHolidays = await fetchGoogleCalendarHolidays({
                year: targetYear,
                region,
            });
            return res.status(200).json({
                success: true,
                source: "Google Calendar (Live Feed)",
                region,
                year: targetYear,
                total: liveHolidays.length,
                data: liveHolidays,
            });
        }

        let holidays = await findAllHolidays();

        // If database is empty, dynamically populate from Google Calendar
        if (holidays.length === 0) {
            try {
                const currentYear = new Date().getFullYear();
                const googleHolidays = await fetchGoogleCalendarHolidays({
                    year: currentYear,
                    region: "india",
                });
                if (googleHolidays && googleHolidays.length > 0) {
                    await seedDefaultHolidays(googleHolidays);
                    holidays = await findAllHolidays();
                }
            } catch (gErr) {
                console.warn("Could not dynamically seed from Google Calendar:", gErr.message);
            }
        }

        // If year filter is applied on database records
        if (year) {
            const yStr = String(year);
            holidays = holidays.filter((h) => h.date && String(h.date).startsWith(yStr));
        }

        res.status(200).json({
            success: true,
            total: holidays.length,
            source: "PERN HRMS Enterprise Calendar",
            data: holidays,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Live Dynamic Google Calendar Endpoint (any year, any region)
export const getGoogleCalendarHolidays = async (req, res) => {
    try {
        const { year = new Date().getFullYear(), region = "india", refresh = "false" } = req.query || {};
        const forceRefresh = refresh === "true" || refresh === "1";
        const targetYear = parseInt(year, 10);

        const holidays = await fetchGoogleCalendarHolidays({
            year: targetYear,
            region,
            forceRefresh,
        });

        res.status(200).json({
            success: true,
            source: "Google Calendar",
            year: targetYear,
            region,
            availableRegions: Object.keys(GOOGLE_CALENDAR_MAP).map((k) => ({
                id: k,
                ...GOOGLE_CALENDAR_MAP[k],
            })),
            total: holidays.length,
            data: holidays,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Sync Google Calendar holidays to Database (Admin / HR)
export const syncGoogleHolidays = async (req, res) => {
    try {
        const { year = new Date().getFullYear(), region = "india" } = req.body || {};
        const targetYear = parseInt(year, 10);
        const addedBy = req.user?.userId || req.user?.id || null;

        const result = await syncGoogleCalendarToDatabase({
            year: targetYear,
            region,
            addedBy,
        });

        res.status(200).json({
            success: true,
            message: result.message,
            data: result,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Create a new holiday (Admin/HR only)
export const createHoliday = async (req, res) => {
    try {
        const { title, date, type, description } = req.body || {};

        if (!title || !date) {
            return res.status(400).json({ success: false, message: "Title and date are required" });
        }

        const newHoliday = await createHolidayRecord({
            title,
            date,
            type,
            description,
            addedBy: req.user.userId || req.user.id,
        });

        res.status(201).json({ success: true, data: newHoliday });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Seed default holidays if none exist (for demo purposes)
export const seedHolidays = async (req, res) => {
    try {
        const count = await countHolidays();
        if (count > 0) {
            return res.status(200).json({ success: true, message: "Holidays already seeded" });
        }

        const year = new Date().getFullYear();
        const defaultHolidays = [
            { title: "New Year's Day", date: `${year}-01-01`, type: "Public Holiday" },
            { title: "Republic Day", date: `${year}-01-26`, type: "Public Holiday" },
            { title: "Holi", date: `${year}-03-25`, type: "Optional Holiday" },
            { title: "Labor Day", date: `${year}-05-01`, type: "Company Off" },
            { title: "Independence Day", date: `${year}-08-15`, type: "Public Holiday" },
            { title: "Diwali", date: `${year}-10-31`, type: "Public Holiday" },
            { title: "Christmas Day", date: `${year}-12-25`, type: "Public Holiday" },
        ];

        await seedDefaultHolidays(defaultHolidays);
        res.status(201).json({ success: true, message: "Default holidays seeded successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update an existing corporate holiday (Admin/HR only)
export const updateHoliday = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, date, type, description } = req.body || {};

        const existing = await findHolidayById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: "Holiday not found" });
        }

        const updated = await updateHolidayRecord(id, {
            title,
            date,
            type,
            description,
        });

        res.status(200).json({
            success: true,
            message: `Holiday "${updated.title}" updated successfully`,
            data: updated,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete a holiday (Admin/HR only)
export const deleteHoliday = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await deleteHolidayRecord(id);
        if (!deleted) {
            return res.status(404).json({ success: false, message: "Holiday not found" });
        }
        res.status(200).json({ success: true, message: "Holiday removed successfully", data: deleted });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

