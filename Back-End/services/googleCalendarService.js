import pool from "../config/db.js";

// Official Google Calendar Public Holiday Calendars
export const GOOGLE_CALENDAR_MAP = {
  india: {
    id: "en.indian#holiday@group.v.calendar.google.com",
    name: "India (Google Calendar)",
    flag: "🇮🇳",
    countryCode: "IN",
  },
  usa: {
    id: "en.usa#holiday@group.v.calendar.google.com",
    name: "United States (Google Calendar)",
    flag: "🇺🇸",
    countryCode: "US",
  },
  uk: {
    id: "en.uk#holiday@group.v.calendar.google.com",
    name: "United Kingdom (Google Calendar)",
    flag: "🇬🇧",
    countryCode: "GB",
  },
  singapore: {
    id: "en.singapore#holiday@group.v.calendar.google.com",
    name: "Singapore (Google Calendar)",
    flag: "🇸🇬",
    countryCode: "SG",
  },
  australia: {
    id: "en.australian#holiday@group.v.calendar.google.com",
    name: "Australia (Google Calendar)",
    flag: "🇦🇺",
    countryCode: "AU",
  },
};

// In-memory cache for fast lookups (TTL: 1 hour)
const memoryCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Parse an iCal (.ics) string from Google Calendar into structured holiday items
 */
export const parseGoogleIcs = (icsText, yearFilter = null) => {
  const vevents = icsText.split("BEGIN:VEVENT");
  const holidays = [];

  for (let i = 1; i < vevents.length; i++) {
    const block = vevents[i];
    const dtMatch = block.match(/DTSTART(?:;[^:]+)?:(\d{8})/);
    const summaryMatch = block.match(/SUMMARY:(.*)/);
    const descMatch = block.match(/DESCRIPTION:(.*)/);

    if (dtMatch && summaryMatch) {
      const rawDate = dtMatch[1];
      const year = rawDate.slice(0, 4);
      if (yearFilter && year !== String(yearFilter)) {
        continue;
      }

      const date = `${year}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
      let title = summaryMatch[1].replace(/\\,/g, ",").replace(/\\;/g, ";").trim();
      // Remove any trailing carriage returns
      title = title.replace(/\r$/, "");

      const rawDesc = descMatch
        ? descMatch[1].replace(/\\,/g, ",").replace(/\\n/g, " ").replace(/\r$/, "").trim()
        : "";

      const isPublic = rawDesc.toLowerCase().includes("public holiday");
      const type = isPublic ? "Gazetted Holiday" : "Optional Holiday";

      let cleanDesc = isPublic
        ? "Official Gazetted Public Holiday observed nationwide as per Google Calendar."
        : "Optional / Restricted Observance as per Google Calendar.";

      // Check day of week for Long Weekend detection
      const [y, m, d] = date.split("-").map(Number);
      const dayOfWeek = new Date(y, m - 1, d).getDay(); // 0 Sun, 1 Mon, 5 Fri
      let longWeekendLabel = null;
      let isLongWeekend = false;

      if (dayOfWeek === 5) {
        longWeekendLabel = "🏖️ 3-Day Long Weekend (Fri–Sun)";
        isLongWeekend = true;
      } else if (dayOfWeek === 1) {
        longWeekendLabel = "🏖️ 3-Day Long Weekend (Sat–Mon)";
        isLongWeekend = true;
      } else if (dayOfWeek === 4) {
        longWeekendLabel = "💡 Bridge Day Opportunity (Take Fri off)";
        isLongWeekend = true;
      } else if (dayOfWeek === 2) {
        longWeekendLabel = "💡 Bridge Day Opportunity (Take Mon off)";
        isLongWeekend = true;
      }

      holidays.push({
        title,
        date,
        type,
        mandatory: isPublic,
        description: cleanDesc,
        source: "Google Calendar",
        isLongWeekend,
        longWeekendLabel,
        rawGoogleDescription: rawDesc,
      });
    }
  }

  // Deduplicate and sort chronologically
  const uniqueMap = new Map();
  holidays.forEach((h) => {
    const key = `${h.date}_${h.title}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, h);
    }
  });

  return Array.from(uniqueMap.values()).sort((a, b) => a.date.localeCompare(b.date));
};

/**
 * Fetch dynamic holidays live from Google Calendar
 */
export const fetchGoogleCalendarHolidays = async ({
  year = new Date().getFullYear(),
  region = "india",
  forceRefresh = false,
} = {}) => {
  const regConfig = GOOGLE_CALENDAR_MAP[region.toLowerCase()] || GOOGLE_CALENDAR_MAP.india;
  const cacheKey = `${regConfig.id}_${year}`;

  if (!forceRefresh && memoryCache.has(cacheKey)) {
    const cached = memoryCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  const icsUrl = `https://calendar.google.com/calendar/ical/${encodeURIComponent(
    regConfig.id
  )}/public/basic.ics`;

  try {
    const response = await fetch(icsUrl, {
      headers: {
        "User-Agent": "PERN-HRMS-Holiday-Sync/2.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Google Calendar iCal HTTP error: ${response.status}`);
    }

    const icsText = await response.text();
    const parsed = parseGoogleIcs(icsText, year);

    // Save to memory cache
    memoryCache.set(cacheKey, {
      timestamp: Date.now(),
      data: parsed,
    });

    return parsed;
  } catch (err) {
    console.warn(`[GoogleCalendarService] Failed to fetch Google Calendar iCal (${icsUrl}): ${err.message}. Trying Nager.Date fallback...`);

    // Fallback to Nager.Date public holiday API if Google Calendar iCal cannot be reached
    try {
      const nagerUrl = `https://date.nager.at/api/v3/PublicHolidays/${year}/${regConfig.countryCode}`;
      const nagerRes = await fetch(nagerUrl);
      if (nagerRes.ok) {
        const nagerList = await nagerRes.json();
        const fallbackList = nagerList.map((item) => {
          const [y, m, d] = item.date.split("-").map(Number);
          const dayOfWeek = new Date(y, m - 1, d).getDay();
          let longWeekendLabel = null;
          let isLongWeekend = false;
          if (dayOfWeek === 5) {
            longWeekendLabel = "🏖️ 3-Day Long Weekend (Fri–Sun)";
            isLongWeekend = true;
          } else if (dayOfWeek === 1) {
            longWeekendLabel = "🏖️ 3-Day Long Weekend (Sat–Mon)";
            isLongWeekend = true;
          }

          return {
            title: item.localName || item.name,
            date: item.date,
            type: item.types && item.types.includes("Optional") ? "Optional Holiday" : "Gazetted Holiday",
            mandatory: !item.types || !item.types.includes("Optional"),
            description: `${item.name} (${regConfig.name} - Official Public Holiday)`,
            source: "Public Holiday API (Google Mirror)",
            isLongWeekend,
            longWeekendLabel,
          };
        });

        memoryCache.set(cacheKey, { timestamp: Date.now(), data: fallbackList });
        return fallbackList;
      }
    } catch (fallbackErr) {
      console.error("[GoogleCalendarService] Fallback also failed:", fallbackErr.message);
    }

    // Return whatever is in cache if available
    if (memoryCache.has(cacheKey)) {
      return memoryCache.get(cacheKey).data;
    }

    throw err;
  }
};

/**
 * Synchronize live Google Calendar holidays for a year into PostgreSQL database
 */
export const syncGoogleCalendarToDatabase = async ({
  year = new Date().getFullYear(),
  region = "india",
  addedBy = null,
} = {}) => {
  const googleHolidays = await fetchGoogleCalendarHolidays({ year, region, forceRefresh: true });

  if (!googleHolidays || googleHolidays.length === 0) {
    return { syncedCount: 0, total: 0, message: "No holidays returned by Google Calendar" };
  }

  let insertedCount = 0;
  let updatedCount = 0;

  for (const h of googleHolidays) {
    // Check if a record already exists with same date and similar title
    const checkQuery = `
      SELECT id FROM holidays 
      WHERE date = $1 AND LOWER(title) = LOWER($2)
      LIMIT 1;
    `;
    const checkRes = await pool.query(checkQuery, [h.date, h.title]);

    if (checkRes.rows.length > 0) {
      // Update existing record
      const updateQuery = `
        UPDATE holidays
        SET type = $1, description = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3;
      `;
      await pool.query(updateQuery, [h.type, h.description, checkRes.rows[0].id]);
      updatedCount++;
    } else {
      // Insert new holiday record
      const insertQuery = `
        INSERT INTO holidays (title, date, type, description, added_by)
        VALUES ($1, $2, $3, $4, $5);
      `;
      await pool.query(insertQuery, [h.title, h.date, h.type, h.description, addedBy]);
      insertedCount++;
    }
  }

  return {
    year,
    region,
    totalGoogleHolidays: googleHolidays.length,
    insertedCount,
    updatedCount,
    message: `Synchronized ${googleHolidays.length} Google Calendar holidays for ${year} (${insertedCount} added, ${updatedCount} updated).`,
  };
};
