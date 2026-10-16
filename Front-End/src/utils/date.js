export function getLocalDateString(value) {
  if (!value) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      const year = isoMatch[1];
      const month = String(isoMatch[2]).padStart(2, '0');
      const day = String(isoMatch[3]).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmyMatch) {
      const day = String(dmyMatch[1]).padStart(2, '0');
      const month = String(dmyMatch[2]).padStart(2, '0');
      const year = dmyMatch[3];
      return `${year}-${month}-${day}`;
    }
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDate(value) {
  if (!value) return "Not provided";
  
  if (typeof value === "string") {
    const trimmed = value.trim();
    // Match YYYY-MM-DD or YYYY-MM-DDT...
    const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10) - 1;
      const day = parseInt(isoMatch[3], 10);
      const d = new Date(year, month, day);
      return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
    }
    // Match DD-MM-YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      const year = parseInt(dmyMatch[3], 10);
      const d = new Date(year, month, day);
      return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
    }
  }

  const d = new Date(value);
  if (isNaN(d.getTime())) return "Not provided";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

export function formatTime(value, fallback = "Not provided") {
  if (!value) return fallback;

  if (typeof value === "string") {
    const trimmed = value.trim();

    // 1. Already formatted AM/PM (e.g. '09:30 AM', '9:30 am', '6:15 PM')
    const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)$/i);
    if (ampmMatch) {
      let hours = parseInt(ampmMatch[1], 10);
      const minutes = ampmMatch[2];
      const meridiem = ampmMatch[3].toUpperCase();
      return `${String(hours).padStart(2, "0")}:${minutes} ${meridiem}`;
    }

    // 2. Plain time string like '09:30:00', '09:30', '18:15:00', '18:15'
    const timeOnlyMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (timeOnlyMatch) {
      let hours = parseInt(timeOnlyMatch[1], 10);
      const minutes = timeOnlyMatch[2];
      const meridiem = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;
      return `${String(hours).padStart(2, "0")}:${minutes} ${meridiem}`;
    }

    // 3. String like '2026-10-16 09:30:00' or '2026-10-16 09:30' (space separated)
    const sqlDateTimeMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (sqlDateTimeMatch) {
      let hours = parseInt(sqlDateTimeMatch[1], 10);
      const minutes = sqlDateTimeMatch[2];
      const meridiem = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;
      return `${String(hours).padStart(2, "0")}:${minutes} ${meridiem}`;
    }

    // 4. ISO string without timezone offset (e.g. '2026-10-16T09:30:00')
    const localIsoMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}T(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (localIsoMatch) {
      let hours = parseInt(localIsoMatch[1], 10);
      const minutes = localIsoMatch[2];
      const meridiem = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;
      return `${String(hours).padStart(2, "0")}:${minutes} ${meridiem}`;
    }
  }

  const d = new Date(value);
  if (isNaN(d.getTime())) return fallback;

  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const meridiem = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${String(hours).padStart(2, "0")}:${minutes} ${meridiem}`;
  }
}

export function parseLocalDate(value) {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  const dateStr = getLocalDateString(value);
  if (dateStr) {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return new Date(y, m, d);
      }
    }
  }
  const fallback = new Date(value);
  return isNaN(fallback.getTime()) ? new Date() : fallback;
}

export function isToday(value) {
  if (!value) return false;
  const targetStr = getLocalDateString(value);
  const todayStr = getLocalDateString(new Date());
  return Boolean(targetStr && targetStr === todayStr);
}

export function formatDuration(totalSeconds) {
  const num = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(num / 3600);
  const minutes = Math.floor((num % 3600) / 60);
  const seconds = num % 60;

  return [hours, minutes, seconds]
    .map((unit) => String(unit).padStart(2, "0"))
    .join(":");
}

