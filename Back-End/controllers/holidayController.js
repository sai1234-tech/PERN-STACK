import {
    findAllHolidays,
    countHolidays,
    createHolidayRecord,
    seedDefaultHolidays,
} from "../repositories/holidayRepository.js";

// Get all holidays
export const getAllHolidays = async (req, res) => {
    try {
        const holidays = await findAllHolidays();
        res.status(200).json({ success: true, data: holidays });
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
