import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import { useAuth } from "../../context/AuthContext";
import { normalizeRole } from "../../utils/auth";
import { apiRequest } from "../../services/apiClient";
import { parseLocalDate, getLocalDateString, isToday } from "../../utils/date";
import "./EmployeeCalendar.css";
import { toast } from "react-toastify";

export default function EmployeeCalendar() {
  const { user, employee } = useAuth();
  const userRole = normalizeRole(user, employee);
  const isHrOrAdmin = ["hr", "admin"].includes(userRole);

  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "grid";
  const [viewMode, setViewMode] = useState(
    initialTab === "holidays" ? "holidays" : initialTab === "timeline" ? "timeline" : "grid"
  );

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    setSearchParams({ tab: mode }, { replace: true });
  };

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [holidays, setHolidays] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dynamic Google Calendar Integration State
  const [calendarSource, setCalendarSource] = useState("google"); // "google" | "company"
  const [holidayRegion, setHolidayRegion] = useState("india");
  const [holidayYear, setHolidayYear] = useState(() => new Date().getFullYear());
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);
  const [googleLiveCount, setGoogleLiveCount] = useState(0);

  // Holiday Tab Filters & Search
  const [holidaySearch, setHolidaySearch] = useState("");
  const [holidayCategoryFilter, setHolidayCategoryFilter] = useState("all"); // "all" | "gazetted" | "optional" | "long_weekends" | "upcoming" | "past"
  const [holidaySortOrder, setHolidaySortOrder] = useState("asc"); // "asc" | "desc"

  // HR / Admin Declare Corporate Holiday Form State
  const [showDeclareHolidayModal, setShowDeclareHolidayModal] = useState(false);
  const [holidayFormTitle, setHolidayFormTitle] = useState("");
  const [holidayFormDate, setHolidayFormDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [holidayFormType, setHolidayFormType] = useState("Public Holiday");
  const [holidayFormMandatory, setHolidayFormMandatory] = useState(true);
  const [holidayFormDescription, setHolidayFormDescription] = useState("");
  const [declaringHoliday, setDeclaringHoliday] = useState(false);

  // HR / Admin Edit Corporate Holiday State
  const [showEditHolidayModal, setShowEditHolidayModal] = useState(false);
  const [editingHolidayId, setEditingHolidayId] = useState(null);
  const [editHolidayTitle, setEditHolidayTitle] = useState("");
  const [editHolidayDate, setEditHolidayDate] = useState("");
  const [editHolidayType, setEditHolidayType] = useState("Public Holiday");
  const [editHolidayMandatory, setEditHolidayMandatory] = useState(true);
  const [editHolidayDescription, setEditHolidayDescription] = useState("");
  const [updatingHoliday, setUpdatingHoliday] = useState(false);

  // Open Edit Holiday Modal with prefilled values
  const openEditHolidayModal = (h) => {
    if (!h) return;
    setEditingHolidayId(h.id || h._id);
    setEditHolidayTitle(h.title || h.name || "");
    const dateFormatted = h.date ? parseLocalDate(h.date).toISOString().split("T")[0] : "";
    setEditHolidayDate(dateFormatted);
    setEditHolidayType(h.type || "Public Holiday");
    const isMandatory =
      h.mandatory ||
      String(h.type || "").toLowerCase().includes("gazetted") ||
      String(h.type || "").toLowerCase().includes("national") ||
      String(h.type || "").toLowerCase().includes("public");
    setEditHolidayMandatory(isMandatory);
    setEditHolidayDescription(h.description || "");
    setShowEditHolidayModal(true);
  };

  // Submit Updated Holiday (PUT /api/holidays/:id)
  const handleUpdateHoliday = async (e) => {
    e.preventDefault();
    if (!editHolidayTitle.trim() || !editHolidayDate) {
      toast.warning("Please provide a holiday title and date");
      return;
    }

    setUpdatingHoliday(true);
    try {
      const payload = {
        title: editHolidayTitle.trim(),
        date: editHolidayDate,
        type: editHolidayType,
        mandatory: editHolidayMandatory,
        description: editHolidayDescription.trim() || "Official corporate holiday",
      };

      const res = await apiRequest(`/holidays/${editingHolidayId}`, {
        method: "PUT",
        body: payload,
      });

      if (res.success || res.data) {
        toast.success(`🎉 Corporate Holiday "${payload.title}" updated successfully!`);
        setShowEditHolidayModal(false);
        // Optimistically update local holiday state immediately
        setHolidays((prev) =>
          prev.map((item) =>
            (item.id || item._id) === editingHolidayId
              ? { ...item, ...payload, title: payload.title, date: payload.date, type: payload.type, description: payload.description }
              : item
          )
        );
        await fetchCalendarData();
      } else {
        toast.error(res.message || "Failed to update holiday");
      }
    } catch (err) {
      console.error("Failed to update holiday:", err);
      toast.error(err.message || "Failed to update holiday");
    } finally {
      setUpdatingHoliday(false);
    }
  };

  // Employee Custom Events State (backend is source of truth)
  const [customEvents, setCustomEvents] = useState([]);

  // Modal / Form state for creating a new custom event with clock pickers
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDayDetailModal, setShowDayDetailModal] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [newEventCategory, setNewEventCategory] = useState("Meeting");


  // Track current time in minutes for red progress indicator line
  const [nowMins, setNowMins] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = new Date();
      setNowMins(now.getHours() * 60 + now.getMinutes());
    }, 30000);
    return () => window.clearInterval(interval);
  }, []);

  // Format 24-hour clock string ("10:00") to 12-hour format ("10:00 AM")
  const format12Hour = (time24) => {
    if (!time24) return "";
    const [hStr, mStr] = time24.split(":");
    let h = parseInt(hStr, 10);
    const m = mStr || "00";
    if (Number.isNaN(h)) return time24;
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    const formattedH = String(h).padStart(2, "0");
    return `${formattedH}:${m} ${ampm}`;
  };

  // Calculate duration between start and end times (e.g. "1 hr 30 mins")
  const calculateDuration = (startTime24, endTime24) => {
    if (!startTime24 || !endTime24) return "1 hr";
    const [h1, m1] = startTime24.split(":").map(Number);
    const [h2, m2] = endTime24.split(":").map(Number);

    let totalMins = (h2 * 60 + (m2 || 0)) - (h1 * 60 + (m1 || 0));
    if (totalMins <= 0) totalMins += 24 * 60; // Wrap around day if past midnight

    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;

    if (hours > 0 && mins > 0) return `${hours} hr ${mins} mins`;
    if (hours > 0) return `${hours} hr${hours > 1 ? "s" : ""}`;
    return `${mins} mins`;
  };

  // Dynamic Google Calendar Live Fetcher
  const fetchGoogleLiveHolidays = async (targetYear = holidayYear, targetRegion = holidayRegion, forceRefresh = false) => {
    setIsSyncingGoogle(true);
    try {
      const res = await apiRequest(`/holidays/google-live?year=${targetYear}&region=${targetRegion}&refresh=${forceRefresh ? "true" : "false"}`);
      if (res && res.success && Array.isArray(res.data)) {
        setHolidays(res.data);
        setGoogleLiveCount(res.total || res.data.length);
        if (forceRefresh) {
          toast.success(`🎉 Refreshed ${res.data.length} live holidays from Google Calendar (${targetRegion.toUpperCase()} · ${targetYear})`);
        }
      } else {
        throw new Error(res?.message || "Failed to load Google Calendar feed");
      }
    } catch (err) {
      console.warn("Could not fetch Google Calendar live holidays, falling back to database:", err);
      try {
        const fallbackRes = await apiRequest(`/holidays?year=${targetYear}`);
        const list = Array.isArray(fallbackRes) ? fallbackRes : (fallbackRes?.data || fallbackRes?.holidays || []);
        setHolidays(list);
      } catch (fErr) {
        toast.error("Failed to load holiday calendar");
      }
    } finally {
      setIsSyncingGoogle(false);
    }
  };

  // Synchronize Google Calendar holidays to Database (HR / Admin or user manual trigger)
  const handleSyncGoogleToDatabase = async () => {
    setIsSyncingGoogle(true);
    try {
      const res = await apiRequest("/holidays/sync-google", {
        method: "POST",
        body: { year: holidayYear, region: holidayRegion },
      });
      if (res.success) {
        toast.success(res.message || "Successfully synced Google Calendar to corporate database!");
        await fetchGoogleLiveHolidays(holidayYear, holidayRegion, true);
      } else {
        toast.error(res.message || "Failed to sync to database");
      }
    } catch (err) {
      toast.error(err.message || "Failed to sync to database");
    } finally {
      setIsSyncingGoogle(false);
    }
  };

  // Dynamic Year Change Handler
  const handleYearChange = (newYear) => {
    const yr = parseInt(newYear, 10);
    setHolidayYear(yr);
    setCurrentDate(new Date(yr, currentDate.getMonth(), 1));
    fetchGoogleLiveHolidays(yr, holidayRegion, false);
  };

  // Dynamic Region Change Handler
  const handleRegionChange = (newRegion) => {
    setHolidayRegion(newRegion);
    fetchGoogleLiveHolidays(holidayYear, newRegion, false);
  };

  // Generate 1-click personal Google Calendar add URL
  const makeGoogleCalendarUrl = (h) => {
    if (!h || !h.date) return "#";
    const dStr = String(h.date).replace(/-/g, "");
    const d = parseLocalDate(h.date);
    const nextD = new Date(d);
    nextD.setDate(nextD.getDate() + 1);
    const endYear = nextD.getFullYear();
    const endMonth = String(nextD.getMonth() + 1).padStart(2, "0");
    const endDay = String(nextD.getDate()).padStart(2, "0");
    const nextStr = `${endYear}${endMonth}${endDay}`;

    const title = encodeURIComponent(h.title || h.name || "Corporate Holiday");
    const details = encodeURIComponent(
      `${h.description || "Official Holiday"}\n\nClassification: ${h.type || "Gazetted"}\nVerified dynamic sync via Google Calendar Feed`
    );
    const location = encodeURIComponent("All Offices (Pan-India)");
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dStr}/${nextStr}&details=${details}&location=${location}`;
  };

  useEffect(() => {
    fetchCalendarData();
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 1200);
    return () => clearTimeout(safetyTimer);
  }, []);

  const fetchCalendarData = async () => {
    try {
      const currentYr = currentDate.getFullYear();
      const [holidayRes, leaveRes, eventRes] = await Promise.allSettled([
        apiRequest(`/holidays?year=${currentYr}`),
        apiRequest("/leaves/my"),
        apiRequest("/events/my"),
      ]);

      if (holidayRes.status === "fulfilled") {
        const val = holidayRes.value;
        const list = Array.isArray(val) ? val : (val?.data || val?.holidays || []);
        if (list.length > 0) {
          setHolidays(list);
          setGoogleLiveCount(list.length);
        } else {
          const googleRes = await apiRequest(`/holidays/google-live?year=${currentYr}&region=${holidayRegion}`);
          if (googleRes?.success && Array.isArray(googleRes.data)) {
            setHolidays(googleRes.data);
            setGoogleLiveCount(googleRes.total || googleRes.data.length);
          }
        }
      }

      if (leaveRes.status === "fulfilled") {
        const val = leaveRes.value;
        const list = Array.isArray(val) ? val : (val?.data || val?.leaves || []);
        setLeaves(list);
      }
      if (eventRes.status === "fulfilled") {
        const val = eventRes.value;
        const list = Array.isArray(val) ? val : (val?.data || val?.events || []);
        setCustomEvents(list);
      }
    } catch (error) {
      toast.error("Failed to sync calendar data");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomEvent = async (e) => {
    e.preventDefault();
    if (!newEventTitle.trim()) {
      toast.warning("Please enter an event title");
      return;
    }

    const formattedTimeRange = `${format12Hour(startTime)} - ${format12Hour(endTime)}`;
    const durationStr = calculateDuration(startTime, endTime);

    const payload = {
      date: formatDateKey(selectedDate),
      title: newEventTitle.trim(),
      time: formattedTimeRange,
      startTime: startTime,
      endTime: endTime,
      duration: durationStr,
      category: newEventCategory,
      type: "custom",
      tag: `Custom ${newEventCategory}`,
    };

    // Optimistic UI state update
    const tempId = `evt-${Date.now()}`;
    const optimisticItem = { id: tempId, _id: tempId, ...payload };
    setCustomEvents((prev) => [optimisticItem, ...prev]);

    setNewEventTitle("");
    setShowAddModal(false);

    try {
      const res = await apiRequest("/events", {
        method: "POST",
        body: payload,
      });

      if (res.success && res.data) {
        setCustomEvents((prev) =>
          prev.map((item) => (item.id === tempId || item._id === tempId ? res.data : item))
        );
        toast.success(`🔴 Created "${payload.title}" (${durationStr})`);
      }
    } catch (err) {
      console.error("Failed to persist event to backend:", err);
      toast.info(`Saved "${payload.title}"`);
    }
  };

  const handleDeleteCustomEvent = async (eventId) => {
    setCustomEvents((prev) => prev.filter((item) => item.id !== eventId && item._id !== eventId));
    toast.info("Event removed from calendar");

    try {
      if (eventId && !String(eventId).startsWith("evt-")) {
        await apiRequest(`/events/${eventId}`, { method: "DELETE" });
      }
    } catch (err) {
      console.error("Failed to delete event from backend:", err);
    }
  };

  const prevMonth = (e) => {
    e?.preventDefault();
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    setCurrentDate(newDate);
    if (newDate.getFullYear() !== holidayYear) {
      setHolidayYear(newDate.getFullYear());
      fetchGoogleLiveHolidays(newDate.getFullYear(), holidayRegion, false);
    }
  };

  const nextMonth = (e) => {
    e?.preventDefault();
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    setCurrentDate(newDate);
    if (newDate.getFullYear() !== holidayYear) {
      setHolidayYear(newDate.getFullYear());
      fetchGoogleLiveHolidays(newDate.getFullYear(), holidayRegion, false);
    }
  };

  const goToToday = (e) => {
    e?.preventDefault();
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
    if (now.getFullYear() !== holidayYear) {
      setHolidayYear(now.getFullYear());
      fetchGoogleLiveHolidays(now.getFullYear(), holidayRegion, false);
    }
  };

  const prevDay = (e) => {
    e?.preventDefault();
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
    setCurrentDate(prev);
  };

  const nextDay = (e) => {
    e?.preventDefault();
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next);
    setCurrentDate(next);
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // 1. Calendar grid generation (42 cells)
  const firstDayOfWeek = useMemo(
    () => new Date(year, month, 1).getDay(),
    [year, month]
  );

  const calendarGrid = useMemo(
    () =>
      Array.from({ length: 42 }, (_, index) => {
        const cellDate = new Date(year, month, 1 - firstDayOfWeek + index);
        return {
          index,
          dayNumber: cellDate.getDate(),
          date: cellDate,
          isCurrentMonth: cellDate.getMonth() === month,
        };
      }),
    [year, month, firstDayOfWeek]
  );

  // Canonical date key formatter from date utils
  const formatDateKey = getLocalDateString;

  // Holiday map lookup
  const holidayMap = useMemo(() => {
    const map = new Map();
    (holidays || []).forEach((h) => {
      if (!h || !h.date) return;
      const key = formatDateKey(h.date);
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(h);
    });
    return map;
  }, [holidays]);

  // Leave map lookup
  const leaveMap = useMemo(() => {
    const map = new Map();
    (leaves || []).forEach((l) => {
      if (!l || !l.startDate || !l.endDate) return;
      const st = String(l.status || "").toLowerCase();
      if (!st.includes("approved") && !st.includes("pending")) return;

      const sStr = String(l.startDate).slice(0, 10);
      const eStr = String(l.endDate).slice(0, 10);
      
      const sParts = sStr.split("-");
      const eParts = eStr.split("-");
      if (sParts.length !== 3 || eParts.length !== 3) return;

      let cur = new Date(parseInt(sParts[0], 10), parseInt(sParts[1], 10) - 1, parseInt(sParts[2], 10));
      const end = new Date(parseInt(eParts[0], 10), parseInt(eParts[1], 10) - 1, parseInt(eParts[2], 10));

      if (isNaN(cur.getTime()) || isNaN(end.getTime()) || end < cur) return;

      let maxDays = 60;
      while (cur <= end && maxDays > 0) {
        maxDays--;
        const key = formatDateKey(cur);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(l);
        cur.setDate(cur.getDate() + 1);
      }
    });
    return map;
  }, [leaves]);

  // Custom Events Map lookup
  const customEventsMap = useMemo(() => {
    const map = new Map();
    (customEvents || []).forEach((item) => {
      if (!item || !item.date) return;
      const key = formatDateKey(item.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return map;
  }, [customEvents]);

  // Celebratory holiday emoji identifier
  const getHolidayEmoji = (title = "") => {
    const t = String(title).toLowerCase();
    if (t.includes("diwali") || t.includes("deepavali")) return "🪔";
    if (t.includes("holi")) return "🎨";
    if (t.includes("christmas") || t.includes("xmas")) return "🎄";
    if (t.includes("new year")) return "✨";
    if (t.includes("republic") || t.includes("independence") || t.includes("national")) return "🇮🇳";
    if (t.includes("gandhi")) return "🕊️";
    if (t.includes("eid") || t.includes("ramadan") || t.includes("bakrid")) return "🌙";
    if (t.includes("pongal") || t.includes("sankranti") || t.includes("onam") || t.includes("baisakhi") || t.includes("harvest")) return "🌾";
    if (t.includes("dussehra") || t.includes("durga") || t.includes("navratri") || t.includes("puja") || t.includes("vijayadashami")) return "🌺";
    if (t.includes("ganesh") || t.includes("vinayaka")) return "🐘";
    if (t.includes("raksha") || t.includes("rakhi")) return "🧵";
    if (t.includes("good friday") || t.includes("easter")) return "✝️";
    if (t.includes("buddha") || t.includes("purnima")) return "🪷";
    if (t.includes("labor") || t.includes("may day")) return "⚒️";
    if (t.includes("janmashtami") || t.includes("krishna")) return "🪈";
    if (t.includes("shivaratri")) return "🔱";
    return "🏖️";
  };

  // Helper to detect long weekends & bridge leave opportunities
  const getLongWeekendInfo = (dateStr) => {
    if (!dateStr) return null;
    const d = parseLocalDate(dateStr);
    const day = d.getDay(); // 0 Sun, 1 Mon, 2 Tue, 3 Wed, 4 Thu, 5 Fri, 6 Sat
    if (day === 5) {
      return {
        type: "long_weekend",
        label: "🏖️ 3-Day Long Weekend (Fri–Sun)",
        isLongWeekend: true,
      };
    }
    if (day === 1) {
      return {
        type: "long_weekend",
        label: "🏖️ 3-Day Long Weekend (Sat–Mon)",
        isLongWeekend: true,
      };
    }
    if (day === 4) {
      return {
        type: "bridge_day",
        label: "💡 Bridge Opportunity (Take Fri off for 4-day weekend)",
        isBridge: true,
      };
    }
    if (day === 2) {
      return {
        type: "bridge_day",
        label: "💡 Bridge Opportunity (Take Mon off for 4-day weekend)",
        isBridge: true,
      };
    }
    if (day === 3) {
      return {
        type: "midweek",
        label: "⚡ Midweek Rest Day",
      };
    }
    if (day === 0 || day === 6) {
      return {
        type: "weekend",
        label: "📅 Weekend Observance",
      };
    }
    return null;
  };

  // Live Holiday Summary & Stats with Long Weekend calculation
  const holidayStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const total = holidays.length;
    let gazetted = 0;
    let optional = 0;
    let longWeekends = 0;
    const upcoming = [];

    holidays.forEach((h) => {
      const isMandatory =
        h.mandatory ||
        String(h.type || "").toLowerCase().includes("gazetted") ||
        String(h.type || "").toLowerCase().includes("national") ||
        String(h.type || "").toLowerCase().includes("public");
      if (isMandatory) gazetted++;
      else optional++;

      if (h.date) {
        const d = parseLocalDate(h.date);
        const dayOfWeek = d.getDay();
        if (dayOfWeek === 1 || dayOfWeek === 5) {
          longWeekends++;
        }
        const diffDays = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0) {
          upcoming.push({ ...h, diffDays, parsedDate: d });
        }
      }
    });

    upcoming.sort((a, b) => a.diffDays - b.diffDays);
    const nextHoliday = upcoming[0] || null;

    return { total, gazetted, optional, longWeekends, nextHoliday };
  }, [holidays]);

  // Upcoming holidays list
  const upcomingHolidays = useMemo(() => {
    const todayKey = formatDateKey(new Date());
    return (holidays || [])
      .filter((h) => h && h.date && formatDateKey(h.date) >= todayKey)
      .sort((a, b) => formatDateKey(a.date).localeCompare(formatDateKey(b.date)))
      .slice(0, 6);
  }, [holidays]);

  // Filtered and Searched holidays for Holiday List View
  const filteredHolidays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (holidays || [])
      .filter((h) => {
        if (!h) return false;
        const q = holidaySearch.trim().toLowerCase();
        if (q) {
          const matchTitle = (h.title || h.name || "").toLowerCase().includes(q);
          const matchDesc = (h.description || "").toLowerCase().includes(q);
          const matchType = (h.type || "").toLowerCase().includes(q);
          if (!matchTitle && !matchDesc && !matchType) return false;
        }

        if (!h.date) return true;
        const d = parseLocalDate(h.date);
        const diffDays = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
        const isMandatory =
          h.mandatory ||
          String(h.type || "").toLowerCase().includes("gazetted") ||
          String(h.type || "").toLowerCase().includes("national") ||
          String(h.type || "").toLowerCase().includes("public");

        const lwInfo = getLongWeekendInfo(h.date);

        if (holidayCategoryFilter === "gazetted") return isMandatory;
        if (holidayCategoryFilter === "optional") return !isMandatory;
        if (holidayCategoryFilter === "long_weekends") return lwInfo?.isLongWeekend || lwInfo?.isBridge;
        if (holidayCategoryFilter === "upcoming") return diffDays >= 0;
        if (holidayCategoryFilter === "past") return diffDays < 0;
        return true;
      })
      .sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return holidaySortOrder === "asc" ? da - db : db - da;
      });
  }, [holidays, holidaySearch, holidayCategoryFilter, holidaySortOrder]);

  // Calendar Sync & Export Handlers (.ics for Google/Outlook and .csv)
  const handleExportIcs = () => {
    if (!holidays || holidays.length === 0) {
      toast.warning("No corporate holidays available to export");
      return;
    }

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//PERN HRMS//Enterprise Holiday Calendar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Quadratics Corporate Holidays 2026",
      "X-WR-TIMEZONE:Asia/Kolkata",
    ];

    holidays.forEach((h) => {
      if (!h.date) return;
      const d = parseLocalDate(h.date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const dateStart = `${year}${month}${day}`;

      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      const endYear = nextDay.getFullYear();
      const endMonth = String(nextDay.getMonth() + 1).padStart(2, "0");
      const endDay = String(nextDay.getDate()).padStart(2, "0");
      const dateEnd = `${endYear}${endMonth}${endDay}`;

      const title = (h.title || h.name || "Corporate Holiday").replace(/,/g, "\\,");
      const desc = (h.description || "Official Company Holiday").replace(/,/g, "\\,");
      const uid = `holiday-${h.id || h._id || dateStart}@quadratics.com`;

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${dateStart}T000000Z`);
      lines.push(`DTSTART;VALUE=DATE:${dateStart}`);
      lines.push(`DTEND;VALUE=DATE:${dateEnd}`);
      lines.push(`SUMMARY:${title}`);
      lines.push(`DESCRIPTION:${desc} (${h.type || "Corporate Holiday"})`);
      lines.push("LOCATION:Quadratics Global Delivery & Pan-India Offices");
      lines.push("STATUS:CONFIRMED");
      lines.push("TRANSP:TRANSPARENT");
      lines.push("END:VEVENT");
    });

    lines.push("END:VCALENDAR");

    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "Quadratics_Corporate_Holiday_Calendar_2026.ics");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("📅 Holiday Calendar (.ics) downloaded! Ready to import into Google Calendar or Outlook.");
  };

  const handleExportHolidayCSV = () => {
    if (!holidays || holidays.length === 0) {
      toast.warning("No corporate holidays available to export");
      return;
    }

    const headers = [
      "Date",
      "Day of Week",
      "Holiday Title",
      "Category",
      "Mandatory Paid Off",
      "Long Weekend / Bridge Opportunity",
      "Office Closure Status",
      "Description",
    ];

    const rows = holidays.map((h) => {
      const d = parseLocalDate(h.date);
      const dateStr = d.toISOString().split("T")[0];
      const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
      const lw = getLongWeekendInfo(h.date);
      const isMandatory =
        h.mandatory ||
        String(h.type || "").toLowerCase().includes("gazetted") ||
        String(h.type || "").toLowerCase().includes("national") ||
        String(h.type || "").toLowerCase().includes("public");

      const closureStatus = isMandatory ? "Physical Offices Closed" : "Office Open (Floating Holiday)";

      return [
        `"${dateStr}"`,
        `"${dayName}"`,
        `"${(h.title || h.name || "").replace(/"/g, '""')}"`,
        `"${h.type || "Gazetted"}"`,
        `"${isMandatory ? "Yes" : "Optional / Restricted"}"`,
        `"${lw?.label || "Standard"}"`,
        `"${closureStatus}"`,
        `"${(h.description || "").replace(/"/g, '""')}"`,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "Quadratics_Holiday_Calendar_2026.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("📊 Holiday Calendar CSV downloaded!");
  };

  // Declare Corporate Holiday Handler (HR / Admin)
  const handleDeclareHoliday = async (e) => {
    e.preventDefault();
    if (!holidayFormTitle.trim() || !holidayFormDate) {
      toast.warning("Please enter a holiday title and date");
      return;
    }

    setDeclaringHoliday(true);
    try {
      const payload = {
        title: holidayFormTitle.trim(),
        date: holidayFormDate,
        type: holidayFormType,
        mandatory: holidayFormMandatory,
        description: holidayFormDescription.trim() || "Official company holiday",
      };

      const res = await apiRequest("/holidays", {
        method: "POST",
        body: payload,
      });

      if (res.success || res.data) {
        toast.success(`🎉 Corporate Holiday "${payload.title}" declared successfully!`);
        setShowDeclareHolidayModal(false);
        setHolidayFormTitle("");
        setHolidayFormDescription("");
        await fetchCalendarData();
      } else {
        toast.error(res.message || "Failed to declare holiday");
      }
    } catch (err) {
      console.error("Failed to declare holiday:", err);
      toast.error(err.message || "Failed to declare holiday");
    } finally {
      setDeclaringHoliday(false);
    }
  };

  // Delete Holiday Handler (HR / Admin)
  const handleDeleteHoliday = async (holidayId, title) => {
    if (!window.confirm(`Are you sure you want to remove the corporate holiday "${title}"?`)) {
      return;
    }

    try {
      const res = await apiRequest(`/holidays/${holidayId}`, {
        method: "DELETE",
      });
      if (res.success) {
        toast.info(`Holiday "${title}" removed.`);
        setHolidays((prev) => prev.filter((h) => (h.id || h._id) !== holidayId));
      }
    } catch (err) {
      console.error("Failed to delete holiday:", err);
      toast.error(err.message || "Failed to delete holiday");
    }
  };


  const getHolidaysForDate = (dateObj) => holidayMap.get(formatDateKey(dateObj)) || [];
  const getLeavesForDate = (dateObj) => leaveMap.get(formatDateKey(dateObj)) || [];
  const getCustomEventsForDate = (dateObj) => customEventsMap.get(formatDateKey(dateObj)) || [];

  const isTodayDate = isToday;

  const isSelectedDate = (dateObj) => formatDateKey(dateObj) === formatDateKey(selectedDate);

  // Full-day timeline slots (6:00 AM to 11:00 PM) — realistic day planner
  const SHIFT_START_HOUR = 6; // 6 AM
  const SHIFT_END_HOUR = 23; // 11 PM
  const PX_PER_HOUR = 60;

  const hours12 = useMemo(() => {
    const slots = [];
    for (let h = SHIFT_START_HOUR; h <= SHIFT_END_HOUR; h++) {
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      const label = `${String(h12).padStart(2, "0")}:00 ${ampm}`;
      slots.push({ hour: h, label, topPx: (h - SHIFT_START_HOUR) * PX_PER_HOUR });
    }
    return slots;
  }, []);

  // Full-day time dropdown options (6:00 AM to 11:00 PM in 30-min intervals)
  const timeOptions12 = useMemo(() => {
    const options = [];
    for (let h = SHIFT_START_HOUR; h <= SHIFT_END_HOUR; h++) {
      for (let m of [0, 30]) {
        if (h === SHIFT_END_HOUR && m === 30) break;
        const h24 = String(h).padStart(2, "0");
        const m24 = String(m).padStart(2, "0");
        const time24 = `${h24}:${m24}`;

        const ampm = h >= 12 ? "PM" : "AM";
        const h12 = h % 12 || 12;
        const h12Str = String(h12).padStart(2, "0");
        const label = `${h12Str}:${m24} ${ampm}`;
        options.push({ value: time24, label });
      }
    }
    return options;
  }, []);

  // Exact minute positioning calculator relative to 6:00 AM shift window (1 min = 1px)
  const calculateEventPosition = (event) => {
    let startMins = 9 * 60; // default 09:00 AM
    let endMins = 10 * 60; // default 10:00 AM

    if (event.startTime) {
      const [sh, sm] = event.startTime.split(":").map(Number);
      if (!Number.isNaN(sh)) startMins = sh * 60 + (sm || 0);
    }
    if (event.endTime) {
      const [eh, em] = event.endTime.split(":").map(Number);
      if (!Number.isNaN(eh)) endMins = eh * 60 + (em || 0);
    }

    const shiftStartMins = SHIFT_START_HOUR * 60; // 6:00 AM = 360 mins
    const top = Math.max(0, startMins - shiftStartMins);
    const durationMins = Math.max(30, endMins - startMins);
    const height = durationMins;

    return { top, height, startMins, endMins, shiftStartMins };
  };

  // Daily timeline schedule hours (06:00 to 23:00)
  const timelineHours = useMemo(() => {
    const hrs = [];
    for (let h = SHIFT_START_HOUR; h <= SHIFT_END_HOUR; h++) {
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      hrs.push(`${String(h12).padStart(2, "0")}:00 ${ampm}`);
    }
    return hrs;
  }, []);

  // Click-on-slot handler: pre-fill start time from clicked slot
  const handleSlotClick = (hour) => {
    const nextHour = Math.min(hour + 1, SHIFT_END_HOUR);
    setStartTime(`${String(hour).padStart(2, "0")}:00`);
    setEndTime(`${String(nextHour).padStart(2, "0")}:00`);
    setNewEventTitle("");
    setNewEventCategory("Meeting");
    // Scroll the quick-add bar into view
    setTimeout(() => {
      const bar = document.querySelector(".modal-quick-event-bar .modal-event-input");
      if (bar) bar.focus();
    }, 100);
  };

  // Timeline events for selected date (Realistic enterprise schedule)
  const selectedDateEvents = useMemo(() => {
    const key = formatDateKey(selectedDate);
    const dayHolidays = holidayMap.get(key) || [];
    const dayLeaves = leaveMap.get(key) || [];
    const dayCustom = customEventsMap.get(key) || [];
    const isSun = selectedDate.getDay() === 0;
    const isSat = selectedDate.getDay() === 6;

    const items = [];

    // 1. Corporate Holiday (Office closure / Paid Statutory Rest)
    if (dayHolidays.length > 0) {
      dayHolidays.forEach((h) => {
        const isMandatory =
          h.mandatory ||
          String(h.type || "").toLowerCase().includes("gazetted") ||
          String(h.type || "").toLowerCase().includes("national") ||
          String(h.type || "").toLowerCase().includes("public");

        items.push({
          time: "All Day · Paid Off",
          startTime: "09:00",
          endTime: "18:00",
          title: `🎉 ${h.title || h.name} (Corporate Holiday)`,
          category: "Holiday",
          type: "holiday",
          duration: "Full Day Paid Off",
          tag: isMandatory ? "Mandatory Paid Off" : "Floating / Optional",
          isHoliday: true,
        });
      });
    }

    // 2. Approved Employee Leave (PTO)
    if (dayLeaves.length > 0) {
      dayLeaves.forEach((l) => {
        items.push({
          time: "All Day · PTO",
          startTime: "09:00",
          endTime: "18:00",
          title: `🌴 ${l.leaveType?.name || "Leave"} (${l.status})`,
          category: "Leave",
          type: "leave",
          duration: "Full Day PTO",
          tag: l.status || "Approved Leave",
          isLeave: true,
        });
      });
    }

    // 3. Weekend Non-Working Day (Saturday or Sunday)
    if (isSat || isSun) {
      items.push({
        time: "All Day · Rest Day",
        startTime: "09:00",
        endTime: "18:00",
        title: isSun ? "☕ Sunday Weekly Off" : "☕ Saturday Weekend Rest Day",
        category: "Off",
        type: "weekend",
        duration: "Weekly Rest Day",
        tag: "Weekly Off · No Roster",
        isWeekend: true,
      });
    }

    // 4. Standard Enterprise Shift & Lunch Break on Regular Business Days (Mon–Fri)
    if (!isSat && !isSun && dayHolidays.length === 0 && dayLeaves.length === 0) {
      // General Work Shift: 09:30 AM to 06:30 PM (9 hours = 8h work + 1h lunch)
      items.push({
        id: "shift-general",
        time: "09:30 AM - 06:30 PM",
        startTime: "09:30",
        endTime: "18:30",
        title: "💼 Standard General Shift (09:30 AM – 06:30 PM)",
        category: "Shift",
        type: "shift",
        duration: "9 hrs (8h Work + 1h Break)",
        tag: "Active Roster · General Shift",
        isShiftRoster: true,
      });

      // Lunch & Refreshment Window: 01:00 PM to 02:00 PM
      items.push({
        id: "break-lunch",
        time: "01:00 PM - 02:00 PM",
        startTime: "13:00",
        endTime: "14:00",
        title: "🍽️ Lunch & Refreshment Break",
        category: "Break",
        type: "break",
        duration: "1 hr",
        tag: "Company Break Window",
        isBreak: true,
      });
    }

    // 5. Custom Employee Events (RED theme: Meetings, Tasks, Syncs)
    dayCustom.forEach((c) => {
      items.push({
        id: c.id || c._id,
        isCustom: true,
        time: c.time,
        title: `📌 ${c.title}`,
        category: c.category || "Meeting",
        type: "custom", // RED color theme!
        duration: c.duration || "1 hr",
        tag: c.tag || `Custom ${c.category || "Event"}`,
        startTime: c.startTime,
        endTime: c.endTime,
      });
    });

    // Sort chronologically by start time
    items.sort((a, b) => {
      const getMins = (item) => {
        if (item.startTime) {
          const [h, m] = item.startTime.split(":").map(Number);
          if (!Number.isNaN(h)) return h * 60 + (m || 0);
        }
        if (item.isShiftRoster) return 9 * 60 + 30;
        return 9 * 60;
      };
      return getMins(a) - getMins(b);
    });

    return items;
  }, [selectedDate, holidayMap, leaveMap, customEventsMap]);

  // Layout events for Day Planner canvas without overlap (Shift roster drawn as background corridor)
  const dayPlannerEvents = useMemo(() => {
    // Exclude full-day shift roster from event blocks because it is drawn as a dedicated background corridor
    const actualEvents = selectedDateEvents.filter((e) => !e.isShiftRoster);

    // Calculate position for each event
    const positioned = actualEvents.map((evt) => ({
      ...evt,
      pos: calculateEventPosition(evt),
    })).sort((a, b) => a.pos.startMins - b.pos.startMins);

    // Compute overlapping column tracks so simultaneous events sit side-by-side without collision
    const columns = [];
    const withCols = positioned.map((evt) => {
      let col = 0;
      while (columns[col] && columns[col] > evt.pos.startMins) {
        col++;
      }
      columns[col] = evt.pos.endMins;
      return { ...evt, col };
    });

    const totalCols = Math.max(1, columns.length);
    return withCols.map((evt) => ({ ...evt, totalCols }));
  }, [selectedDateEvents]);

  return (
    <>
      <EmployeeHeader />
      <main className="employee-calendar-hub">
        {/* Hero Command Banner */}
        <section className="calendar-hero-banner">
          <div className="calendar-hero-left">
            <div className="hero-kicker-pill">
              <span className="pulsing-live-dot" />
              <span>Quadratic Corporate Roadmap · {year}</span>
            </div>
            <h1>Corporate Holiday & Work Roadmap</h1>
            <p>Official company holidays, team leave schedules, and shift planning roadmap.</p>

            {/* Quick Hero Stats Cluster */}
            <div className="calendar-hero-stats-row">
              <div className="hero-stat-card">
                <span className="stat-num">{holidayStats.total}</span>
                <span className="stat-label">🌴 Total Holidays</span>
              </div>
              <div className="hero-stat-card">
                <span className="stat-num">{holidayStats.gazetted}</span>
                <span className="stat-label">🏛️ Gazetted / Mandatory</span>
              </div>
              <div className="hero-stat-card">
                <span className="stat-num">{holidayStats.optional}</span>
                <span className="stat-label">⭐ Optional / Restricted</span>
              </div>
              {holidayStats.nextHoliday && (
                <div className={`hero-stat-card next-celebration ${holidayStats.nextHoliday.diffDays === 0 ? "imminent-today" : holidayStats.nextHoliday.diffDays === 1 ? "imminent-tomorrow" : ""}`}>
                  <div className="next-holiday-kicker">
                    <span className="next-emoji">{getHolidayEmoji(holidayStats.nextHoliday.title)}</span>
                    <span className="next-countdown">
                      {holidayStats.nextHoliday.diffDays === 0
                        ? "Today 🎉"
                        : holidayStats.nextHoliday.diffDays === 1
                        ? "Tomorrow ⚡"
                        : `In ${holidayStats.nextHoliday.diffDays} days`}
                    </span>
                  </div>
                  <strong className="next-title">{holidayStats.nextHoliday.title}</strong>
                </div>
              )}
            </div>
          </div>

          <div className="calendar-hero-right">
            {isHrOrAdmin && (
              <button
                type="button"
                className="declare-holiday-hero-btn"
                onClick={() => setShowDeclareHolidayModal(true)}
                title="Declare New Corporate Holiday"
              >
                <span>➕</span> Declare Holiday
              </button>
            )}

            <div className="calendar-mode-tabs">
              <button
                type="button"
                className={`mode-tab-btn ${viewMode === "grid" ? "active" : ""}`}
                onClick={() => handleViewModeChange("grid")}
              >
                📅 Month Grid
              </button>
              <button
                type="button"
                className={`mode-tab-btn ${viewMode === "holidays" ? "active" : ""}`}
                onClick={() => handleViewModeChange("holidays")}
              >
                🏖️ Holiday List
              </button>
              <button
                type="button"
                className={`mode-tab-btn ${viewMode === "timeline" ? "active" : ""}`}
                onClick={() => handleViewModeChange("timeline")}
              >
                ⏱️ Shift Timeline
              </button>
            </div>
          </div>
        </section>

        {/* Imminent Holiday Live Alert Banner (Highlighted when holiday comes: Today or Tomorrow) */}
        {holidayStats.nextHoliday && holidayStats.nextHoliday.diffDays <= 1 && (
          <div className={`calendar-imminent-alert-banner ${holidayStats.nextHoliday.diffDays === 0 ? "today" : "tomorrow"}`}>
            <div className="alert-banner-left">
              <span className="alert-emoji">{holidayStats.nextHoliday.diffDays === 0 ? "🎉" : "⚡"}</span>
              <div className="alert-text">
                <div className="alert-title-row">
                  <strong>
                    {holidayStats.nextHoliday.diffDays === 0
                      ? `Corporate Holiday Today: ${holidayStats.nextHoliday.title}`
                      : `Corporate Holiday Tomorrow: ${holidayStats.nextHoliday.title}`}
                  </strong>
                  <span className="alert-type-badge">{holidayStats.nextHoliday.type || "Public Holiday"}</span>
                  <span className="alert-date-chip">
                    {holidayStats.nextHoliday.parsedDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
                <p>
                  {holidayStats.nextHoliday.diffDays === 0
                    ? "Official company gazetted holiday is active today. Regular office operations and daily shifts are paused."
                    : `Official corporate gazetted holiday scheduled for tomorrow (${holidayStats.nextHoliday.parsedDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}). Offices will remain closed.`}
                </p>
              </div>
            </div>
            <div className="alert-banner-right">
              <span className="alert-countdown-pill">
                {holidayStats.nextHoliday.diffDays === 0 ? "🎉 TODAY'S HOLIDAY" : "⚡ TOMORROW'S HOLIDAY"}
              </span>
            </div>
          </div>
        )}


        {loading ? (
          <div className="calendar-loading">Loading Calendar & Timeline Data...</div>
        ) : (
          <div className={`calendar-workspace ${viewMode}-mode`}>
            {/* Left Panel: Grid View OR Timeline View */}
            <div className="calendar-grid-panel">
              {viewMode === "grid" && (
                <div className="calendar-controls">
                  <div className="calendar-month-title-wrap">
                    <h2>
                      {monthNames[month]} <span className="year-highlight">{year}</span>
                    </h2>
                  </div>
                  <div className="calendar-nav-btns">
                    <button type="button" onClick={prevMonth} className="nav-btn" title="Previous Month">
                      ◀ Prev
                    </button>
                    <button type="button" onClick={goToToday} className="nav-btn today-btn" title="Go to Today">
                      Today
                    </button>
                    <button type="button" onClick={nextMonth} className="nav-btn" title="Next Month">
                      Next ▶
                    </button>
                  </div>
                </div>
              )}

              {viewMode === "grid" ? (
                /* Month Grid View */
                <div className="calendar-grid-container" role="grid">
                  <div className="calendar-weekdays" role="row">
                    {dayNames.map((day) => (
                      <div key={day} className="weekday-header" role="columnheader">
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="calendar-days">
                    {calendarGrid.map((cell) => {
                      const dailyHolidays = getHolidaysForDate(cell.date);
                      const dailyLeaves = getLeavesForDate(cell.date);
                      const isToday = isTodayDate(cell.date);
                      const isSelected = isSelectedDate(cell.date);

                      // Calculate if cell has a holiday that is Today or Tomorrow
                      const cellD = new Date(cell.date);
                      cellD.setHours(0, 0, 0, 0);
                      const todayD = new Date();
                      todayD.setHours(0, 0, 0, 0);
                      const cellDiff = Math.round((cellD.getTime() - todayD.getTime()) / (1000 * 60 * 60 * 24));
                      const hasHoliday = dailyHolidays.length > 0;
                      const isHolidayToday = hasHoliday && cellDiff === 0 && cell.isCurrentMonth;
                      const isHolidayTomorrow = hasHoliday && cellDiff === 1 && cell.isCurrentMonth;
                      const isHolidayImminent = isHolidayToday || isHolidayTomorrow;
                      const isWeekend = cell.date.getDay() === 0 || cell.date.getDay() === 6;

                      const customEvts = getCustomEventsForDate(cell.date);
                      const totalBadges = customEvts.length + dailyHolidays.length + dailyLeaves.length;
                      const maxVisibleBadges = 2;
                      let renderedCount = 0;

                      return (
                        <div
                          key={`cell-${cell.index}`}
                          onClick={() => {
                            setSelectedDate(cell.date);
                            setShowDayDetailModal(true);
                          }}
                          className={`calendar-day ${!cell.isCurrentMonth ? "other-month" : ""} ${isWeekend ? "is-weekend" : ""} ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""} ${hasHoliday ? "has-holiday" : ""} ${isHolidayToday ? "holiday-today-cell holiday-imminent-day" : ""} ${isHolidayTomorrow ? "holiday-tomorrow-cell holiday-imminent-day" : ""}`}
                        >
                          <div className="day-header">
                            <div className="day-number-cluster">
                              <span className="day-number">{cell.dayNumber}</span>
                              {isHolidayToday && (
                                <span className="imminent-cell-badge today" title="Holiday is Today!">🎉 TODAY</span>
                              )}
                              {isHolidayTomorrow && (
                                <span className="imminent-cell-badge tomorrow" title="Holiday is Tomorrow!">⚡ TOMORROW</span>
                              )}
                            </div>
                            {hasHoliday && cell.isCurrentMonth && (
                              <span className={`holiday-indicator-dot ${isHolidayImminent ? "pulsing-holiday-dot" : ""}`} title="Holiday Scheduled" />
                            )}
                          </div>

                          <div className="day-events">
                            {customEvts.slice(0, maxVisibleBadges).map((customEvt) => {
                              renderedCount++;
                              return (
                                <div
                                  key={customEvt.id}
                                  className="holiday-badge custom-event"
                                  title={`${customEvt.title} (${customEvt.time})`}
                                >
                                  <span className="event-dot" />
                                  <span className="event-title">{customEvt.title}</span>
                                </div>
                              );
                            })}

                            {dailyHolidays.slice(0, Math.max(0, maxVisibleBadges - renderedCount)).map((holiday, idx) => {
                              renderedCount++;
                              const isImminentBadge = isHolidayToday || isHolidayTomorrow;
                              return (
                                <div
                                  key={`h-${idx}`}
                                  className={`holiday-badge ${holiday.type?.toLowerCase().replace(/\s+/g, "-") || "public"} ${isImminentBadge ? (isHolidayToday ? "imminent-today-badge" : "imminent-tomorrow-badge") : ""}`}
                                  title={`${holiday.title} (${holiday.type || "Public Holiday"})${isHolidayToday ? " - Celebrated Today!" : isHolidayTomorrow ? " - Scheduled for Tomorrow!" : ""}`}
                                >
                                  <span className="holiday-grid-emoji">{getHolidayEmoji(holiday.title)}</span>
                                  <span className="event-title">{holiday.title}</span>
                                  {isHolidayToday && <span className="mini-imminent-tag">🎉</span>}
                                  {isHolidayTomorrow && <span className="mini-imminent-tag">⚡</span>}
                                </div>
                              );
                            })}

                            {dailyLeaves.slice(0, Math.max(0, maxVisibleBadges - renderedCount)).map((leave, idx) => {
                              renderedCount++;
                              return (
                                <div
                                  key={`l-${idx}`}
                                  className={`holiday-badge personal-leave ${leave.status?.toLowerCase() || "approved"}`}
                                  title={`${leave.leaveType?.name || "Leave"} - ${leave.status}`}
                                >
                                  <span className="event-dot" />
                                  <span className="event-title">
                                    {leave.leaveType?.name || "PTO"} ({leave.status})
                                  </span>
                                </div>
                              );
                            })}

                            {totalBadges > maxVisibleBadges && (
                              <div className="holiday-badge more-events-badge" title="Click to view all events in Day Planner">
                                +{totalBadges - maxVisibleBadges} more
                              </div>
                            )}

                            {isWeekend && cell.isCurrentMonth && totalBadges === 0 && (
                              <div className="holiday-badge weekend-cell-badge" title="Corporate Weekly Off">
                                <span className="weekend-emoji">☕</span>
                                <span className="event-title">Weekly Off</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : viewMode === "timeline" ? (
                /* Interactive Shift Timeline View */
                <div className="timeline-view-container">
                  <div className="timeline-view-header">
                    <div className="timeline-header-left">
                      <h3>⏱️ Daily Schedule Timeline</h3>
                      <span className="timeline-selected-date-str">
                        {selectedDate.toLocaleDateString("en-IN", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="timeline-header-actions">
                      <div className="timeline-day-nav">
                        <button type="button" onClick={prevDay} className="nav-btn" title="Previous Day">
                          ◀ Prev
                        </button>
                        <button type="button" onClick={goToToday} className="nav-btn today-btn" title="Go to Today">
                          Today
                        </button>
                        <button type="button" onClick={nextDay} className="nav-btn" title="Next Day">
                          Next ▶
                        </button>
                      </div>
                      <button
                        type="button"
                        className="open-planner-btn"
                        onClick={() => setShowDayDetailModal(true)}
                      >
                        🔍 Full Day Planner
                      </button>
                    </div>
                  </div>

                  {/* Shift Status & Roster Context Bar */}
                  <div className="timeline-roster-status-bar">
                    {(() => {
                      const isTodaySel = isTodayDate(selectedDate);
                      const key = formatDateKey(selectedDate);
                      const dayHolidays = holidayMap.get(key) || [];
                      const dayLeaves = leaveMap.get(key) || [];
                      const isSun = selectedDate.getDay() === 0;
                      const isSat = selectedDate.getDay() === 6;

                      if (dayHolidays.length > 0) {
                        return (
                          <div className="roster-status-banner holiday">
                            <span className="status-icon">🎉</span>
                            <div className="status-info">
                              <strong>Corporate Holiday · Office Closed</strong>
                              <span>{dayHolidays.map((h) => h.title || h.name).join(", ")} · Paid Statutory Observance</span>
                            </div>
                            <span className="status-pill holiday">Paid Off</span>
                          </div>
                        );
                      }
                      if (dayLeaves.length > 0) {
                        return (
                          <div className="roster-status-banner leave">
                            <span className="status-icon">🌴</span>
                            <div className="status-info">
                              <strong>Approved Leave / PTO</strong>
                              <span>{dayLeaves.map((l) => `${l.leaveType?.name || "Leave"} (${l.status})`).join(", ")}</span>
                            </div>
                            <span className="status-pill leave">Approved PTO</span>
                          </div>
                        );
                      }
                      if (isSat || isSun) {
                        return (
                          <div className="roster-status-banner weekend">
                            <span className="status-icon">☕</span>
                            <div className="status-info">
                              <strong>{isSun ? "Sunday Weekly Off" : "Saturday Weekend Rest Day"}</strong>
                              <span>Corporate Weekly Off · No Business Shift Scheduled</span>
                            </div>
                            <span className="status-pill weekend">Weekly Off</span>
                          </div>
                        );
                      }

                      // Business Working Day
                      let liveShiftStatus = "Standard Shift: 09:30 AM – 06:30 PM";
                      let livePillClass = "active";
                      let livePillText = "Active Roster";
                      if (isTodaySel) {
                        if (nowMins < 9 * 60 + 30) {
                          liveShiftStatus = "Shift Starts at 09:30 AM · General Enterprise Roster";
                          livePillClass = "upcoming";
                          livePillText = "Upcoming Shift";
                        } else if (nowMins >= 9 * 60 + 30 && nowMins < 13 * 60) {
                          liveShiftStatus = "🟢 In Progress: Morning Core Hours (09:30 AM – 01:00 PM)";
                          livePillClass = "in-progress";
                          livePillText = "Working Hours";
                        } else if (nowMins >= 13 * 60 && nowMins < 14 * 60) {
                          liveShiftStatus = "🍽️ Lunch & Break Window (01:00 PM – 02:00 PM)";
                          livePillClass = "break";
                          livePillText = "Lunch Break";
                        } else if (nowMins >= 14 * 60 && nowMins < 18 * 60 + 30) {
                          liveShiftStatus = "🟢 In Progress: Afternoon Delivery Hours (02:00 PM – 06:30 PM)";
                          livePillClass = "in-progress";
                          livePillText = "Working Hours";
                        } else {
                          liveShiftStatus = "🌙 Shift Completed for Today (09:30 AM – 06:30 PM) · Off Duty";
                          livePillClass = "completed";
                          livePillText = "Shift Completed";
                        }
                      }

                      return (
                        <div className="roster-status-banner work">
                          <span className="status-icon">💼</span>
                          <div className="status-info">
                            <strong>Enterprise Shift Roster · General Shift (9 hrs)</strong>
                            <span>{liveShiftStatus}</span>
                          </div>
                          <span className={`status-pill ${livePillClass}`}>{livePillText}</span>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="timeline-axis-bar">
                    {timelineHours.map((hourStr, idx) => (
                      <div
                        key={idx}
                        className="timeline-hour-slot clickable-slot"
                        onClick={() => {
                          handleSlotClick(idx + SHIFT_START_HOUR);
                          setShowDayDetailModal(true);
                        }}
                        title={`Click to schedule an event at ${hourStr}`}
                      >
                        <span className="hour-label">{hourStr}</span>
                        <div className="hour-tick" />
                      </div>
                    ))}
                  </div>

                  <div className="timeline-events-flow">
                    {selectedDateEvents.length > 0 ? (
                      selectedDateEvents.map((evt, idx) => (
                        <div key={idx} className={`timeline-event-card ${evt.type}`}>
                          <div className="event-time-badge">{evt.time}</div>
                          <div className="event-main-content">
                            <div>
                              <h4>{evt.title}</h4>
                              {evt.duration && (
                                <span className="event-duration-pill">
                                  ⏱️ Duration: <strong>{evt.duration}</strong>
                                </span>
                              )}
                            </div>
                            <div className="event-tag-wrap">
                              <span className="event-category-tag">{evt.tag}</span>
                              {evt.isCustom && (
                                <button
                                  type="button"
                                  className="delete-evt-btn"
                                  onClick={() => handleDeleteCustomEvent(evt.id)}
                                  title="Delete Event"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="no-events-prompt">
                        📅 No custom events scheduled for this date. Click <strong>"➕ Add Event"</strong> or <strong>"🔍 Full Day Planner"</strong> to create one.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Corporate Holiday List View */
                <div className="holiday-list-view-container">
                  <div className="holiday-list-header">
                    <div>
                      <div className="holiday-list-kicker">
                        <span>🗓️ Company Observances · {year}</span>
                      </div>
                      <h3>Official Corporate Holidays</h3>
                      <p className="holiday-list-subtitle">Annual company declared holidays, gazetted observances, long weekends, and floating leaves.</p>
                    </div>

                    <div className="holiday-list-header-actions">
                      <div className="calendar-nav-btns">
                        <button type="button" onClick={prevMonth} className="nav-btn" title="Previous Month">
                          ◀ Prev
                        </button>
                        <button type="button" onClick={goToToday} className="nav-btn today-btn" title="Go to Today">
                          Today
                        </button>
                        <button type="button" onClick={nextMonth} className="nav-btn" title="Next Month">
                          Next ▶
                        </button>
                      </div>

                      <div className="holiday-export-btn-group">
                        <button
                          type="button"
                          className="holiday-sync-btn"
                          onClick={handleExportIcs}
                          title="Download .ics calendar file for Google Calendar, Outlook, and Apple Calendar"
                        >
                          <span>📅</span> Sync (.ics)
                        </button>
                        <button
                          type="button"
                          className="holiday-csv-btn"
                          onClick={handleExportHolidayCSV}
                          title="Export Holiday List to CSV spreadsheet"
                        >
                          <span>📊</span> Export CSV
                        </button>
                      </div>

                      {isHrOrAdmin && (
                        <button
                          type="button"
                          className="declare-holiday-accent-btn"
                          onClick={() => setShowDeclareHolidayModal(true)}
                          title="Declare New Corporate Holiday"
                        >
                          <span>➕</span> Declare Holiday
                        </button>
                      )}
                      <div className="holiday-list-stats">
                        <span className="holiday-count-badge">
                          Total: <strong>{holidays.length} Holidays</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Google Calendar Live Sync Control Bar */}
                  <div className="google-calendar-dynamic-bar">
                    <div className="gcal-live-badge-group">
                      <div className="gcal-status-indicator">
                        <span className={`gcal-pulse-dot ${isSyncingGoogle ? "syncing" : ""}`} />
                        <div className="gcal-status-text">
                          <span className="gcal-status-title">Google Calendar Live Feed</span>
                          <span className="gcal-status-sub">
                            {isSyncingGoogle ? "Connecting to Google Calendar..." : `Official Public Holidays · ${holidayRegion.toUpperCase()} (${holidays.length} Observances)`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="gcal-controls-row">
                      {/* Region Selector */}
                      <div className="gcal-select-wrap">
                        <label className="gcal-control-label">🌐 Region:</label>
                        <select
                          value={holidayRegion}
                          onChange={(e) => handleRegionChange(e.target.value)}
                          className="gcal-dropdown"
                          disabled={isSyncingGoogle}
                        >
                          <option value="india">🇮🇳 India (Official Google Cal)</option>
                          <option value="usa">🇺🇸 United States</option>
                          <option value="uk">🇬🇧 United Kingdom</option>
                          <option value="singapore">🇸🇬 Singapore</option>
                          <option value="australia">🇦🇺 Australia</option>
                        </select>
                      </div>

                      {/* Year Selector */}
                      <div className="gcal-select-wrap">
                        <label className="gcal-control-label">📅 Year:</label>
                        <select
                          value={holidayYear}
                          onChange={(e) => handleYearChange(e.target.value)}
                          className="gcal-dropdown year-select"
                          disabled={isSyncingGoogle}
                        >
                          {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((yr) => (
                            <option key={yr} value={yr}>
                              {yr}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Live Refresh Trigger */}
                      <button
                        type="button"
                        className="gcal-refresh-btn"
                        onClick={() => fetchGoogleLiveHolidays(holidayYear, holidayRegion, true)}
                        disabled={isSyncingGoogle}
                        title="Fetch fresh real-time holidays from Google Calendar"
                      >
                        <span className={`refresh-icon ${isSyncingGoogle ? "spin" : ""}`}>🔄</span>
                        <span>{isSyncingGoogle ? "Syncing..." : "Sync Google Cal"}</span>
                      </button>

                      {/* HR / Admin Sync to Database */}
                      {isHrOrAdmin && (
                        <button
                          type="button"
                          className="gcal-save-db-btn"
                          onClick={handleSyncGoogleToDatabase}
                          disabled={isSyncingGoogle}
                          title="Persist live Google Calendar holidays to corporate PostgreSQL database"
                        >
                          <span>💾</span> Save to DB
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Floating / Optional Holiday Policy & Allowance Banner */}
                  <div className="floating-holiday-policy-banner">
                    <div className="policy-banner-content">
                      <span className="policy-banner-icon">⭐</span>
                      <div className="policy-banner-text">
                        <div className="policy-title-row">
                          <h4>Corporate Floating / Optional Holiday Policy ({holidayYear})</h4>
                          <span className="policy-allowance-badge">Allowance: 2 Floating Days / Year</span>
                        </div>
                        <p>
                          All permanent employees are entitled to <strong>2 Optional / Floating Holidays</strong> per year in addition to statutory Gazetted Holidays. Apply under <em>Restricted Leaves</em> at least 3 business days in advance.
                        </p>
                      </div>
                    </div>
                    <a href="/employee/leaves" className="policy-action-link" title="Apply for Optional Holiday Leave">
                      Apply Floating Leave →
                    </a>
                  </div>

                  {/* Search and Category Filter Toolbar */}
                  <div className="holiday-filter-toolbar">
                    <div className="holiday-search-wrap">
                      <span className="holiday-search-icon">🔍</span>
                      <input
                        type="text"
                        placeholder="Search holidays by name, month, long weekend, or festival..."
                        value={holidaySearch}
                        onChange={(e) => setHolidaySearch(e.target.value)}
                        className="holiday-search-input"
                      />
                      {holidaySearch && (
                        <button
                          type="button"
                          className="holiday-clear-search-btn"
                          onClick={() => setHolidaySearch("")}
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="holiday-filter-pills">
                      <button
                        type="button"
                        className={`holiday-filter-pill ${holidayCategoryFilter === "all" ? "active" : ""}`}
                        onClick={() => setHolidayCategoryFilter("all")}
                      >
                        All ({holidays.length})
                      </button>
                      <button
                        type="button"
                        className={`holiday-filter-pill ${holidayCategoryFilter === "gazetted" ? "active" : ""}`}
                        onClick={() => setHolidayCategoryFilter("gazetted")}
                      >
                        🏛️ Gazetted ({holidayStats.gazetted})
                      </button>
                      <button
                        type="button"
                        className={`holiday-filter-pill ${holidayCategoryFilter === "optional" ? "active" : ""}`}
                        onClick={() => setHolidayCategoryFilter("optional")}
                      >
                        ⭐ Optional ({holidayStats.optional})
                      </button>
                      <button
                        type="button"
                        className={`holiday-filter-pill ${holidayCategoryFilter === "long_weekends" ? "active" : ""}`}
                        onClick={() => setHolidayCategoryFilter("long_weekends")}
                      >
                        🏖️ Long Weekends ({holidayStats.longWeekends})
                      </button>
                      <button
                        type="button"
                        className={`holiday-filter-pill ${holidayCategoryFilter === "upcoming" ? "active" : ""}`}
                        onClick={() => setHolidayCategoryFilter("upcoming")}
                      >
                        ⏳ Upcoming Only
                      </button>
                      <button
                        type="button"
                        className={`holiday-filter-pill ${holidayCategoryFilter === "past" ? "active" : ""}`}
                        onClick={() => setHolidayCategoryFilter("past")}
                      >
                        ✓ Observed
                      </button>

                      <button
                        type="button"
                        className="holiday-sort-btn"
                        onClick={() => setHolidaySortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                        title={`Sorted ${holidaySortOrder === "asc" ? "Earliest First" : "Latest First"}`}
                      >
                        {holidaySortOrder === "asc" ? "📅 Oldest First ↑" : "📅 Latest First ↓"}
                      </button>
                    </div>
                  </div>

                  <div className="holiday-cards-scroll-container">
                    <div className="holiday-cards-grid">
                      {filteredHolidays.length > 0 ? (
                        filteredHolidays.map((h, idx) => {
                          const d = parseLocalDate(h.date);
                          const monthShort = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
                          const dayNum = d.getDate();
                          const dayOfWeek = d.toLocaleDateString("en-US", { weekday: "short" });
                          const formattedDateStr = d.toLocaleDateString("en-IN", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          });

                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const diffDays = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
                          const isPast = diffDays < 0;
                          const isToday = diffDays === 0;
                          const isTomorrow = diffDays === 1;
                          const isImminent = isToday || isTomorrow;
                          const countdownStr =
                            diffDays === 0
                              ? "Today 🎉"
                              : diffDays === 1
                              ? "Tomorrow ⚡"
                              : diffDays > 1
                              ? `In ${diffDays} days`
                              : "✓ Observed";

                          const emoji = getHolidayEmoji(h.title || h.name);
                          const isMandatory =
                            h.mandatory ||
                            String(h.type || "").toLowerCase().includes("gazetted") ||
                            String(h.type || "").toLowerCase().includes("national") ||
                            String(h.type || "").toLowerCase().includes("public");

                          const lwInfo = getLongWeekendInfo(h.date);

                          return (
                            <div
                              key={h.id || h._id || idx}
                              className={`holiday-list-card ${isMandatory ? "mandatory-card" : "optional-card"} ${isPast ? "past-holiday" : ""} ${isToday ? "today-holiday-card holiday-imminent-card" : ""} ${isTomorrow ? "tomorrow-holiday-card holiday-imminent-card" : ""}`}
                            >
                              {isImminent && (
                                <div className={`imminent-ribbon ${isToday ? "today" : "tomorrow"}`}>
                                  <span className="ribbon-icon">{isToday ? "🎉" : "⚡"}</span>
                                  <span className="ribbon-text">
                                    {isToday ? "TODAY'S CORPORATE HOLIDAY" : "TOMORROW'S CORPORATE HOLIDAY"}
                                  </span>
                                  <span className="ribbon-badge">Office Closed</span>
                                </div>
                              )}

                              <div className="holiday-card-main-content">
                                <div className="holiday-card-date-badge">
                                  <span className="h-month">{monthShort}</span>
                                  <span className="h-day-num">{dayNum}</span>
                                  <span className="h-day">{dayOfWeek}</span>
                                </div>

                                <div className="holiday-card-info">
                                  <div className="holiday-card-title-row">
                                    <div className="holiday-festive-pod">
                                      <span className="holiday-card-emoji">{emoji}</span>
                                      <h4>{h.title || h.name}</h4>
                                      <span className="gcal-source-tag" title="Verified via Google Calendar Feed">
                                        🗓️ Google Cal
                                      </span>
                                    </div>
                                    <span className="h-date">{formattedDateStr}</span>
                                  </div>

                                  <p>{h.description || "Official company holiday"}</p>

                                  <div className="holiday-card-footer">
                                    <div className="holiday-card-tags">
                                      <span className={`holiday-type-pill ${(h.type || "gazetted").toLowerCase().replace(/\s+/g, "-")}`}>
                                        {h.type || "Gazetted"}
                                      </span>
                                      {isMandatory ? (
                                        <span className="mandatory-pill">✓ Mandatory Paid Off</span>
                                      ) : (
                                        <span className="optional-pill">⭐ Optional Holiday</span>
                                      )}
                                      {lwInfo && (
                                        <span className={`holiday-lw-pill ${lwInfo.type}`}>
                                          {lwInfo.label}
                                        </span>
                                      )}
                                      <span className={`holiday-office-pill ${isMandatory ? "closed" : "open"}`}>
                                        {isMandatory ? "🏢 Offices Closed (Pan-India)" : "🏢 Office Open · Floating"}
                                      </span>
                                      <span className={`holiday-status-chip ${isPast ? "past" : isToday ? "today-glow" : isTomorrow ? "tomorrow-glow" : "upcoming"}`}>
                                        {isToday ? "🎉 Active Today" : isTomorrow ? "⚡ Tomorrow" : countdownStr}
                                      </span>
                                    </div>

                                    <div className="holiday-card-actions-row">
                                      <a
                                        href={makeGoogleCalendarUrl(h)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="add-to-gcal-link-btn"
                                        title="Add this holiday event to your personal Google Calendar"
                                      >
                                        <span>📅</span> Add to Google Calendar
                                      </a>

                                      {isHrOrAdmin && (
                                        <div className="holiday-admin-btn-group">
                                          <button
                                            type="button"
                                            className="holiday-edit-btn"
                                            onClick={() => openEditHolidayModal(h)}
                                            title="Edit corporate holiday (HR / Admin)"
                                          >
                                            ✏️ Edit
                                          </button>
                                          <button
                                            type="button"
                                            className="holiday-delete-btn"
                                            onClick={() => handleDeleteHoliday(h.id || h._id, h.title || h.name)}
                                            title="Delete corporate holiday"
                                          >
                                            🗑️
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="no-events-prompt">
                          🏖️ No holidays match the current search or filter criteria.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>


            {/* Right Side Panel: Inspector & Upcoming Holidays (Adapts cleanly to current view mode) */}
            {viewMode !== "holidays" && (
              <div className="calendar-sidebar">
                {/* Selected Day Timeline Inspector (Shown in Month Grid mode) */}
                {viewMode === "grid" && (
                  <div className="sidebar-card timeline-inspector-card">
                <div className="inspector-card-header">
                  <div>
                    <h3>🗓️ Day Inspector Timeline</h3>
                    <span className="inspector-date">
                      {selectedDate.toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      className="add-event-toggle-btn"
                      onClick={() => setShowAddModal(!showAddModal)}
                      title="Create Event on Selected Date"
                    >
                      {showAddModal ? "✕ Cancel" : "➕ Add Event"}
                    </button>
                    <button
                      type="button"
                      className="add-event-toggle-btn planner-modal-btn"
                      onClick={() => setShowDayDetailModal(true)}
                      title="Open 12-Hour Shift Day Planner Modal"
                    >
                      🔍 Full View
                    </button>
                  </div>
                </div>

                {showAddModal && (
                  <form className="add-event-form" onSubmit={handleAddCustomEvent}>
                    <h4>Add Event on {formatDateKey(selectedDate)}</h4>
                    <input
                      type="text"
                      placeholder="Event Title (e.g. Client Pitch)"
                      value={newEventTitle}
                      onChange={(e) => setNewEventTitle(e.target.value)}
                      className="event-input-field"
                      required
                    />

                    {/* 12-Hour Time Pickers for Start and End Time */}
                    <div className="clock-picker-row">
                      <div className="clock-field-group">
                        <label className="clock-field-label">🕒 Start Time</label>
                        <select
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="event-input-field clock-input"
                          required
                        >
                          {timeOptions12.map((opt) => (
                            <option key={`start-${opt.value}`} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="clock-field-group">
                        <label className="clock-field-label">🕒 End Time</label>
                        <select
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="event-input-field clock-input"
                          required
                        >
                          {timeOptions12.map((opt) => (
                            <option key={`end-${opt.value}`} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-row-2">
                      <div className="duration-preview-chip">
                        ⏱️ Duration: <strong>{calculateDuration(startTime, endTime)}</strong>
                      </div>
                      <select
                        value={newEventCategory}
                        onChange={(e) => setNewEventCategory(e.target.value)}
                        className="event-select-field"
                      >
                        <option value="Meeting">Meeting 🤝</option>
                        <option value="Task">Task 🎯</option>
                        <option value="Deadline">Deadline ⏳</option>
                        <option value="Reminder">Reminder 🔔</option>
                      </select>
                    </div>

                    <button type="submit" className="save-event-btn red-accent-btn">
                      🔴 Save Red Timeline Event
                    </button>
                  </form>
                )}

                <div className="inspector-events-list">
                  {selectedDateEvents.length > 0 ? (
                    selectedDateEvents.map((item, idx) => (
                      <div key={idx} className={`inspector-item ${item.isCustom ? "custom-red-item" : ""}`}>
                        <div className="inspector-time-row">
                          <span className="inspector-time">{item.time}</span>
                          {item.duration && (
                            <span className="inspector-duration-chip">⏱️ {item.duration}</span>
                          )}
                        </div>
                        <div className="inspector-details">
                          <strong className="inspector-title">{item.title}</strong>
                          <div className="inspector-actions">
                            <span className="inspector-tag">{item.tag}</span>
                            {item.isCustom && (
                              <button
                                type="button"
                                className="delete-evt-btn-sm"
                                onClick={() => handleDeleteCustomEvent(item.id)}
                                title="Delete Event"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="no-events-prompt">
                      📅 No events scheduled for this date. Click <strong>"➕ Add Event"</strong> above to create one.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* In Shift Timeline View: Show Roster Metrics & Quick Action (eliminates duplicate timeline) */}
            {viewMode === "timeline" && (
              <div className="sidebar-card shift-roster-summary-card">
                <div className="inspector-card-header">
                  <div>
                    <h3>💼 Roster Overview</h3>
                    <span className="inspector-date">
                      {selectedDate.toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="add-event-toggle-btn"
                    onClick={() => setShowAddModal(!showAddModal)}
                    title="Create Event on Selected Date"
                  >
                    {showAddModal ? "✕ Cancel" : "➕ Add Event"}
                  </button>
                </div>

                {showAddModal && (
                  <form className="add-event-form" onSubmit={handleAddCustomEvent}>
                    <h4>Add Event on {formatDateKey(selectedDate)}</h4>
                    <input
                      type="text"
                      placeholder="Event Title (e.g. Client Pitch)"
                      value={newEventTitle}
                      onChange={(e) => setNewEventTitle(e.target.value)}
                      className="event-input-field"
                      required
                    />

                    <div className="clock-picker-row">
                      <div className="clock-field-group">
                        <label className="clock-field-label">🕒 Start Time</label>
                        <select
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="event-input-field clock-input"
                          required
                        >
                          {timeOptions12.map((opt) => (
                            <option key={`start-${opt.value}`} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="clock-field-group">
                        <label className="clock-field-label">🕒 End Time</label>
                        <select
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="event-input-field clock-input"
                          required
                        >
                          {timeOptions12.map((opt) => (
                            <option key={`end-${opt.value}`} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-row-2">
                      <div className="duration-preview-chip">
                        ⏱️ Duration: <strong>{calculateDuration(startTime, endTime)}</strong>
                      </div>
                      <select
                        value={newEventCategory}
                        onChange={(e) => setNewEventCategory(e.target.value)}
                        className="event-select-field"
                      >
                        <option value="Meeting">Meeting 🤝</option>
                        <option value="Task">Task 🎯</option>
                        <option value="Deadline">Deadline ⏳</option>
                        <option value="Reminder">Reminder 🔔</option>
                      </select>
                    </div>

                    <button type="submit" className="save-event-btn red-accent-btn">
                      🔴 Save Red Timeline Event
                    </button>
                  </form>
                )}

                <div className="roster-metrics-list">
                  <div className="roster-metric-item">
                    <span className="metric-icon">🏢</span>
                    <div className="metric-detail">
                      <strong>Standard Business Shift</strong>
                      <span>09:30 AM – 06:30 PM (9 hrs)</span>
                    </div>
                  </div>
                  <div className="roster-metric-item">
                    <span className="metric-icon">🍽️</span>
                    <div className="metric-detail">
                      <strong>Lunch & Refreshment</strong>
                      <span>01:00 PM – 02:00 PM (1 hr Break)</span>
                    </div>
                  </div>
                  <div className="roster-metric-item">
                    <span className="metric-icon">📌</span>
                    <div className="metric-detail">
                      <strong>Custom Meetings / Tasks</strong>
                      <span>{getCustomEventsForDate(selectedDate).length} Scheduled for this day</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

              {/* Upcoming Holidays Card */}
              <div className="sidebar-card">
                <div className="sidebar-card-title-row">
                  <h3>Upcoming Holidays</h3>
                  <button
                    type="button"
                    className="sidebar-view-all-link"
                    onClick={() => handleViewModeChange("holidays")}
                  >
                    View All →
                  </button>
                </div>
                <div className="upcoming-list">
                  {upcomingHolidays.length > 0 ? (
                    upcomingHolidays.map((holiday) => {
                      const d = parseLocalDate(holiday.date);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const diffDays = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
                      const emoji = getHolidayEmoji(holiday.title);
                      const isToday = diffDays === 0;
                      const isTomorrow = diffDays === 1;

                      return (
                        <div key={holiday._id || holiday.id || holiday.title} className={`upcoming-item ${isToday ? "today-upcoming imminent-sidebar-item" : isTomorrow ? "tomorrow-upcoming imminent-sidebar-item" : ""}`}>
                          <div className="upcoming-date">
                            <span className="month">{monthNames[d.getMonth()].substring(0, 3)}</span>
                            <span className="day">{d.getDate()}</span>
                          </div>
                          <div className="upcoming-details">
                            <div className="upcoming-title-line">
                              <span className="upcoming-emoji">{emoji}</span>
                              <h4>{holiday.title}</h4>
                            </div>
                            <span className="type">{holiday.type || "Public Holiday"}</span>
                            <span className={`countdown ${isToday ? "today-glow" : isTomorrow ? "tomorrow-glow" : ""}`}>
                              {diffDays === 0 ? "Today 🎉" : diffDays === 1 ? "Tomorrow ⚡" : `In ${diffDays} days`}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="no-holidays">No upcoming holidays scheduled.</p>
                  )}
                </div>
              </div>


              {/* Calendar Legend Card (Only shown in Month Grid mode) */}
              {viewMode === "grid" && (
                <div className="legend-card">
                  <h3>Calendar Legend</h3>
                  <div className="legend-list">
                    <div className="legend-item">
                      <span className="legend-color public-holiday" />
                      <span>Public Holiday (Mandatory Off)</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color optional-holiday" />
                      <span>Optional / Restricted Holiday</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color imminent-legend" />
                      <span>Imminent Holiday (Today / Tomorrow 🎉⚡)</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color personal-leave" />
                      <span>My Approved Leaves (PTO)</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color personal-leave-pending" />
                      <span>My Pending Leaves</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

        {/* =====================================================
            DAY PLANNER POPUP MODAL (12-HOUR MORNING TO EVENING TIMELINE)
        ===================================================== */}
        {showDayDetailModal && (
          <div className="day-planner-modal-backdrop" onClick={() => setShowDayDetailModal(false)}>
            <div className="day-planner-modal-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="day-planner-modal-header">
                <div className="planner-modal-title">
                  <h2>
                    🗓️ Day Planner —{" "}
                    {selectedDate.toLocaleDateString("en-IN", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </h2>
                  <span className="planner-subtitle">Full Day Timeline — 6:00 AM to 11:00 PM · Click any time slot to create an event</span>
                </div>
                <button
                  type="button"
                  className="close-modal-btn"
                  onClick={() => setShowDayDetailModal(false)}
                >
                  ✕ Close
                </button>
              </div>

              {/* Inline Quick Event Add Bar inside Modal */}
              <form className="modal-quick-event-bar" onSubmit={handleAddCustomEvent}>
                <input
                  type="text"
                  placeholder="Event Title (e.g., Executive Client Sync)"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  className="modal-event-input"
                  required
                />
                <div className="modal-time-inputs">
                  <label className="modal-time-label">
                    🕒 Start:
                    <select
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="modal-clock-input"
                      required
                    >
                      {timeOptions12.map((opt) => (
                        <option key={`mstart-${opt.value}`} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="modal-time-label">
                    🕒 End:
                    <select
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="modal-clock-input"
                      required
                    >
                      {timeOptions12.map((opt) => (
                        <option key={`mend-${opt.value}`} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <select
                  value={newEventCategory}
                  onChange={(e) => setNewEventCategory(e.target.value)}
                  className="modal-select-field"
                >
                  <option value="Meeting">Meeting 🤝</option>
                  <option value="Task">Task 🎯</option>
                  <option value="Deadline">Deadline ⏳</option>
                  <option value="Reminder">Reminder 🔔</option>
                </select>
                <button type="submit" className="modal-save-btn red-accent-btn">
                  🔴 Add Red Event
                </button>
              </form>

              {/* Scrollable Full-Day Timeline Planner Canvas (6:00 AM to 11:00 PM) */}
              <div className="day-planner-scroll-canvas">
                <div className="planner-time-axis">
                  {hours12.map((hObj) => (
                    <div
                      key={hObj.hour}
                      className="planner-time-slot"
                      style={{ top: `${hObj.topPx}px` }}
                      onClick={() => handleSlotClick(hObj.hour)}
                      title={`Click to create event at ${hObj.label}`}
                    >
                      <span className="slot-time-label">{hObj.label}</span>
                      <div className="slot-grid-line" />
                      {/* Half-hour sub-line for realism */}
                      <div className="slot-half-line" style={{ top: "30px" }} />
                    </div>
                  ))}

                  {/* Red Current Time Needle (Relative to 6:00 AM = 360 mins) */}
                  {isTodayDate(selectedDate) && nowMins >= (SHIFT_START_HOUR * 60) && nowMins <= (SHIFT_END_HOUR * 60) && (
                    <div className="planner-current-time-line" style={{ top: `${nowMins - SHIFT_START_HOUR * 60}px` }}>
                      <div className="current-time-head">
                        <div className="current-time-dot" />
                        <span className="current-time-tag">
                          {(() => { const h = Math.floor(nowMins / 60); const m = nowMins % 60; const ap = h >= 12 ? "PM" : "AM"; return `${String(h % 12 || 12).padStart(2,"0")}:${String(m).padStart(2,"0")} ${ap}`; })()}
                        </span>
                      </div>
                      <div className="current-time-rule" />
                    </div>
                  )}

                  {/* Enterprise Shift Roster Working-Hours Background Corridor */}
                  {selectedDate.getDay() !== 0 && selectedDate.getDay() !== 6 && (holidayMap.get(formatDateKey(selectedDate)) || []).length === 0 && (leaveMap.get(formatDateKey(selectedDate)) || []).length === 0 && (
                    <div
                      className="planner-shift-corridor"
                      style={{
                        top: `${(9.5 - SHIFT_START_HOUR) * 60}px`,
                        height: `${9 * 60}px`,
                      }}
                    >
                      <div className="shift-corridor-label-track">
                        <span className="shift-corridor-badge">💼 General Shift · 09:30 AM – 06:30 PM</span>
                        <span className="shift-corridor-status">Active Working Hours</span>
                      </div>
                    </div>
                  )}

                  {/* Positioned Non-Overlapping Event Blocks */}
                  {dayPlannerEvents.map((evt, idx) => {
                    const isPast = isTodayDate(selectedDate) && nowMins > evt.pos.startMins;
                    const isCompleted = isTodayDate(selectedDate) && nowMins >= evt.pos.endMins;
                    const progressPercent = isTodayDate(selectedDate)
                      ? Math.min(100, Math.max(0, ((nowMins - evt.pos.startMins) / (evt.pos.endMins - evt.pos.startMins)) * 100))
                      : 0;

                    // Non-overlapping horizontal column positioning
                    const totalCols = evt.totalCols || 1;
                    const colIndex = evt.col || 0;
                    const colWidthPct = 100 / totalCols;
                    const leftStyle = totalCols > 1 ? `calc(95px + ${colIndex * colWidthPct}% * 0.88)` : "95px";
                    const widthStyle = totalCols > 1 ? `calc(${colWidthPct}% * 0.88)` : "calc(100% - 115px)";

                    return (
                      <div
                        key={idx}
                        className={`planner-event-block ${evt.type} ${isCompleted ? "completed-event" : ""}`}
                        style={{
                          top: `${evt.pos.top}px`,
                          height: `${Math.max(48, evt.pos.height)}px`,
                          left: leftStyle,
                          width: widthStyle,
                          right: "auto",
                        }}
                      >
                        {/* Progress fill overlay if active today */}
                        {isTodayDate(selectedDate) && progressPercent > 0 && (
                          <div
                            className="event-progress-shade"
                            style={{ height: `${progressPercent}%` }}
                          />
                        )}

                        <div className="planner-block-content">
                          <div className="planner-block-header">
                            <span className="planner-block-time">{evt.time}</span>
                            {evt.duration && <span className="planner-block-duration">⏱️ {evt.duration}</span>}
                          </div>
                          <h4 className="planner-block-title">{evt.title}</h4>
                          <div className="planner-block-footer">
                            <span className="planner-block-tag">{evt.tag}</span>
                            {evt.isCustom && (
                              <button
                                type="button"
                                className="delete-block-btn"
                                onClick={() => handleDeleteCustomEvent(evt.id)}
                                title="Delete Event"
                              >
                                🗑️ Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================
            HR / ADMIN DECLARE CORPORATE HOLIDAY MODAL
        ===================================================== */}

        {showDeclareHolidayModal && (
          <div className="day-planner-modal-backdrop" onClick={() => setShowDeclareHolidayModal(false)}>
            <div className="declare-holiday-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="declare-modal-header">
                <div className="declare-modal-title">
                  <span className="declare-icon-pill">🏖️</span>
                  <div>
                    <h2>Declare Corporate Holiday</h2>
                    <p>Add an official observance, gazetted holiday, or mandatory paid company off.</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="close-modal-btn"
                  onClick={() => setShowDeclareHolidayModal(false)}
                >
                  ✕
                </button>
              </div>

              <form className="declare-holiday-form" onSubmit={handleDeclareHoliday}>
                <div className="form-group-field">
                  <label>Holiday Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Diwali / Deepavali, Eid al-Fitr, Good Friday, Christmas Day"
                    value={holidayFormTitle}
                    onChange={(e) => setHolidayFormTitle(e.target.value)}
                    required
                    className="declare-input"
                  />
                </div>

                <div className="form-row-2">
                  <div className="form-group-field">
                    <label>Observance Date *</label>
                    <input
                      type="date"
                      value={holidayFormDate}
                      onChange={(e) => setHolidayFormDate(e.target.value)}
                      required
                      className="declare-input"
                    />
                  </div>
                  <div className="form-group-field">
                    <label>Holiday Classification</label>
                    <select
                      value={holidayFormType}
                      onChange={(e) => setHolidayFormType(e.target.value)}
                      className="declare-select"
                    >
                      <option value="Public Holiday">🏛️ Public Holiday</option>
                      <option value="National Holiday">🇮🇳 National Holiday</option>
                      <option value="Gazetted Holiday">📜 Gazetted Holiday</option>
                      <option value="Optional Holiday">⭐ Optional / Restricted Holiday</option>
                      <option value="Company Off">🏢 Company Off</option>
                    </select>
                  </div>
                </div>

                <div className="form-group-field">
                  <label>Description / Cultural Background</label>
                  <textarea
                    rows={3}
                    placeholder="Brief description of the corporate observance, celebration details, and office closure schedule..."
                    value={holidayFormDescription}
                    onChange={(e) => setHolidayFormDescription(e.target.value)}
                    className="declare-textarea"
                  />
                </div>

                <label className="declare-checkbox-label">
                  <input
                    type="checkbox"
                    checked={holidayFormMandatory}
                    onChange={(e) => setHolidayFormMandatory(e.target.checked)}
                  />
                  <div>
                    <strong>Mandatory Paid Company Off</strong>
                    <span>All corporate offices closed; full paid leave applied for all employees</span>
                  </div>
                </label>

                <div className="declare-modal-actions">
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => setShowDeclareHolidayModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="save-holiday-submit-btn"
                    disabled={declaringHoliday}
                  >
                    {declaringHoliday ? "Declaring..." : "🎉 Declare Holiday"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =====================================================
            HR / ADMIN EDIT CORPORATE HOLIDAY MODAL
        ===================================================== */}

        {showEditHolidayModal && (
          <div className="day-planner-modal-backdrop" onClick={() => setShowEditHolidayModal(false)}>
            <div className="declare-holiday-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="declare-modal-header edit-modal-header">
                <div className="declare-modal-title">
                  <span className="declare-icon-pill edit-icon-pill">✏️</span>
                  <div>
                    <h2>Edit Corporate Holiday</h2>
                    <p>Update title, observance date, or classification. Changes instantly reflect for all employees.</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="close-modal-btn"
                  onClick={() => setShowEditHolidayModal(false)}
                >
                  ✕
                </button>
              </div>

              <form className="declare-holiday-form" onSubmit={handleUpdateHoliday}>
                <div className="form-group-field">
                  <label>Holiday Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Diwali / Deepavali, Eid al-Fitr, Good Friday"
                    value={editHolidayTitle}
                    onChange={(e) => setEditHolidayTitle(e.target.value)}
                    required
                    className="declare-input"
                  />
                </div>

                <div className="form-row-2">
                  <div className="form-group-field">
                    <label>Observance Date *</label>
                    <input
                      type="date"
                      value={editHolidayDate}
                      onChange={(e) => setEditHolidayDate(e.target.value)}
                      required
                      className="declare-input"
                    />
                  </div>
                  <div className="form-group-field">
                    <label>Holiday Classification</label>
                    <select
                      value={editHolidayType}
                      onChange={(e) => setEditHolidayType(e.target.value)}
                      className="declare-select"
                    >
                      <option value="Public Holiday">🏛️ Public Holiday</option>
                      <option value="National Holiday">🇮🇳 National Holiday</option>
                      <option value="Gazetted Holiday">📜 Gazetted Holiday</option>
                      <option value="Optional Holiday">⭐ Optional / Restricted Holiday</option>
                      <option value="Company Off">🏢 Company Off</option>
                    </select>
                  </div>
                </div>

                <div className="form-group-field">
                  <label>Description / Cultural Background</label>
                  <textarea
                    rows={3}
                    placeholder="Brief description of the corporate observance, celebration details, and office closure schedule..."
                    value={editHolidayDescription}
                    onChange={(e) => setEditHolidayDescription(e.target.value)}
                    className="declare-textarea"
                  />
                </div>

                <label className="declare-checkbox-label">
                  <input
                    type="checkbox"
                    checked={editHolidayMandatory}
                    onChange={(e) => setEditHolidayMandatory(e.target.checked)}
                  />
                  <div>
                    <strong>Mandatory Paid Company Off</strong>
                    <span>All corporate offices closed; full paid leave applied for all employees</span>
                  </div>
                </label>

                <div className="declare-modal-actions">
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => setShowEditHolidayModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="save-holiday-submit-btn update-holiday-btn"
                    disabled={updatingHoliday}
                  >
                    {updatingHoliday ? "Saving..." : "✓ Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>

  );
}
