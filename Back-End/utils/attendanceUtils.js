// Helper date utilities for attendance calculations

export const startOfDay = (dateInput = new Date()) => {
    const d = new Date(dateInput);
    d.setHours(0, 0, 0, 0);
    return d;
};

export const getFormattedDate = (dateInput = new Date()) => {
    const d = new Date(dateInput);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

export const calculateWorkingHours = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return 0;
    const start = new Date(checkIn).getTime();
    const end = new Date(checkOut).getTime();
    if (end <= start) return 0;

    const diffInMs = end - start;
    const diffInHours = diffInMs / (1000 * 60 * 60);
    return Number(diffInHours.toFixed(2));
};

export const calculateLateMinutes = (checkInTime, workStartHour = 9, workStartMinute = 30) => {
    if (!checkInTime) return 0;
    const checkIn = new Date(checkInTime);
    const expected = new Date(checkIn);
    expected.setHours(workStartHour, workStartMinute, 0, 0);

    if (checkIn > expected) {
        const diffInMs = checkIn.getTime() - expected.getTime();
        return Math.floor(diffInMs / (1000 * 60));
    }
    return 0;
};

export const calculateOvertime = (workingHours, standardHours = 8) => {
    if (!workingHours || workingHours <= standardHours) return 0;
    return Number((workingHours - standardHours).toFixed(2));
};

export const isWorkdayEnded = (dateInput = new Date()) => {
    const now = new Date(dateInput);
    return now.getHours() >= 19; // 7 PM
};

export const getLiveAttendanceStatus = (attendance, now = new Date()) => {
    if (attendance) {
        if (attendance.check_out) return "Checked Out";
        return "Checked In";
    }
    const hour = new Date(now).getHours();
    if (hour >= 19) return "Absent";
    return "Not Checked In";
};
