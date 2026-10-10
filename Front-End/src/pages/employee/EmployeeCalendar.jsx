import React, { useState, useEffect, useMemo } from "react";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import { apiRequest } from "../../services/apiClient";
import "./EmployeeCalendar.css";
import { toast } from "react-toastify";

export default function EmployeeCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "timeline" | "roadmap"
  const [holidays, setHolidays] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

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

  // No localStorage sync needed — backend API is the source of truth

  useEffect(() => {
    fetchCalendarData();
  }, []);

  const fetchCalendarData = async () => {
    try {
      const [holidayRes, leaveRes, eventRes] = await Promise.allSettled([
        apiRequest("/holidays"),
        apiRequest("/leaves/my"),
        apiRequest("/events/my"),
      ]);

      if (holidayRes.status === "fulfilled") {
        const val = holidayRes.value;
        const list = Array.isArray(val) ? val : (val?.data || val?.holidays || []);
        setHolidays(list);
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
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = (e) => {
    e?.preventDefault();
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = (e) => {
    e?.preventDefault();
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
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

  // Helper date key formatter
  function formatDateKey(dateObj) {
    if (!dateObj) return "";
    if (typeof dateObj === "string") {
      const clean = dateObj.trim().slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
    }
    const d = new Date(dateObj);
    if (isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

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

  // Upcoming holidays list
  const upcomingHolidays = useMemo(() => {
    const todayKey = formatDateKey(new Date());
    return (holidays || [])
      .filter((h) => h && h.date && formatDateKey(h.date) >= todayKey)
      .sort((a, b) => formatDateKey(a.date).localeCompare(formatDateKey(b.date)))
      .slice(0, 6);
  }, [holidays]);

  const getHolidaysForDate = (dateObj) => holidayMap.get(formatDateKey(dateObj)) || [];
  const getLeavesForDate = (dateObj) => leaveMap.get(formatDateKey(dateObj)) || [];
  const getCustomEventsForDate = (dateObj) => customEventsMap.get(formatDateKey(dateObj)) || [];

  const isTodayDate = (dateObj) => {
    const today = new Date();
    return (
      dateObj.getDate() === today.getDate() &&
      dateObj.getMonth() === today.getMonth() &&
      dateObj.getFullYear() === today.getFullYear()
    );
  };

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

  // Timeline events for selected date
  const selectedDateEvents = useMemo(() => {
    const key = formatDateKey(selectedDate);
    const dayHolidays = holidayMap.get(key) || [];
    const dayLeaves = leaveMap.get(key) || [];
    const dayCustom = customEventsMap.get(key) || [];
    const isSun = selectedDate.getDay() === 0;
    const isSat = selectedDate.getDay() === 6;

    const items = [];

    // Custom employee events first (RED theme) — pass startTime/endTime for accurate positioning
    dayCustom.forEach((c) => {
      items.push({
        id: c.id || c._id,
        isCustom: true,
        time: c.time,
        title: `📌 ${c.title}`,
        category: c.category,
        type: "custom", // RED color theme!
        duration: c.duration || "1 hr",
        tag: c.tag || "Custom Event",
        startTime: c.startTime,
        endTime: c.endTime,
      });
    });

    if (dayHolidays.length > 0) {
      dayHolidays.forEach((h) => {
        items.push({
          time: "Full Day",
          title: `🎉 ${h.title}`,
          category: "Holiday",
          type: "holiday",
          tag: h.type || "Public Holiday",
        });
      });
    }

    if (dayLeaves.length > 0) {
      dayLeaves.forEach((l) => {
        items.push({
          time: "Full Day",
          title: `🌴 ${l.leaveType?.name || "Leave"} (${l.status})`,
          category: "Leave",
          type: "leave",
          tag: l.status,
        });
      });
    }

    if (isSat || isSun) {
      items.push({
        time: "All Day",
        title: "☕ Weekend Non-Working Day",
        category: "Off",
        type: "weekend",
        tag: "Weekly Off",
      });
    }

    return items;
  }, [selectedDate, holidayMap, leaveMap, customEventsMap]);

  return (
    <>
      <EmployeeHeader />
      <main className="employee-calendar-hub">
        {/* Hero Command Banner */}
        <section className="calendar-hero-banner">
          <div className="calendar-hero-left">
            <div className="hero-kicker-pill">
              <span className="pulsing-live-dot" />
              <span>Quadratic Corporate Roadmap</span>
            </div>
            <h1>Annual Holiday & Timeline Calendar</h1>
            <p>View company holidays, leave schedules, and hourly shift timeline roadmaps.</p>
          </div>

          <div className="calendar-mode-tabs">
            <button
              type="button"
              className={`mode-tab-btn ${viewMode === "grid" ? "active" : ""}`}
              onClick={() => setViewMode("grid")}
            >
              📅 Month Grid
            </button>
            <button
              type="button"
              className={`mode-tab-btn ${viewMode === "timeline" ? "active" : ""}`}
              onClick={() => setViewMode("timeline")}
            >
              ⏱️ Shift Timeline
            </button>
            <button
              type="button"
              className={`mode-tab-btn ${viewMode === "holidays" ? "active" : ""}`}
              onClick={() => setViewMode("holidays")}
            >
              🏖️ Holiday List
            </button>
          </div>
        </section>

        {loading ? (
          <div className="calendar-loading">Loading Calendar & Timeline Data...</div>
        ) : (
          <div className="calendar-workspace">
            {/* Left Panel: Grid View OR Timeline View */}
            <div className="calendar-grid-panel">
              <div className="calendar-controls">
                <div className="calendar-month-title-wrap">
                  <h2>
                    {monthNames[month]} <span className="year-highlight">{year}</span>
                  </h2>
                </div>
                <div className="calendar-nav-btns">
                  <button type="button" onClick={prevMonth} className="nav-btn" title="Previous Month">
                    &larr; Prev
                  </button>
                  <button type="button" onClick={goToToday} className="nav-btn today-btn" title="Go to Today">
                    Today
                  </button>
                  <button type="button" onClick={nextMonth} className="nav-btn" title="Next Month">
                    Next &rarr;
                  </button>
                </div>
              </div>

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

                      return (
                        <div
                          key={`cell-${cell.index}`}
                          onClick={() => {
                            setSelectedDate(cell.date);
                            setShowDayDetailModal(true);
                          }}
                          className={`calendar-day ${!cell.isCurrentMonth ? "other-month" : ""} ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""} ${dailyHolidays.length > 0 ? "has-holiday" : ""}`}
                        >
                          <div className="day-header">
                            <span className="day-number">{cell.dayNumber}</span>
                            {dailyHolidays.length > 0 && cell.isCurrentMonth && (
                              <span className="holiday-indicator-dot" title="Holiday Scheduled" />
                            )}
                          </div>

                          <div className="day-events">
                            {getCustomEventsForDate(cell.date).map((customEvt) => (
                              <div
                                key={customEvt.id}
                                className="holiday-badge custom-event"
                                title={`${customEvt.title} (${customEvt.time})`}
                              >
                                <span className="event-dot" />
                                <span className="event-title">{customEvt.title}</span>
                              </div>
                            ))}

                            {dailyHolidays.map((holiday, idx) => (
                              <div
                                key={`h-${idx}`}
                                className={`holiday-badge ${holiday.type?.toLowerCase().replace(/\s+/g, "-") || "public"}`}
                                title={`${holiday.title} (${holiday.type})`}
                              >
                                <span className="event-dot" />
                                <span className="event-title">{holiday.title}</span>
                              </div>
                            ))}

                            {dailyLeaves.map((leave, idx) => (
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
                            ))}
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
                    <h3>
                      ⏱️ Daily Schedule Timeline for{" "}
                      {selectedDate.toLocaleDateString("en-IN", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </h3>
                    <button
                      type="button"
                      className="open-planner-btn"
                      onClick={() => setShowDayDetailModal(true)}
                    >
                      🔍 Full Day Planner
                    </button>
                  </div>

                  <div className="timeline-axis-bar">
                    {timelineHours.map((hourStr, idx) => (
                      <div key={idx} className="timeline-hour-slot">
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
                  <div className="timeline-view-header">
                    <h3>🏖️ Official Corporate Holidays ({year})</h3>
                    <span className="event-duration-pill">
                      Total: <strong>{holidays.length} Gazetted & Restricted Holidays</strong>
                    </span>
                  </div>

                  <div className="holiday-cards-grid">
                    {holidays.length > 0 ? (
                      holidays.map((h, idx) => {
                        const dateStr = h.date ? String(h.date).slice(0, 10) : "";
                        let formattedDateStr = dateStr;
                        let dayOfWeek = "";
                        if (dateStr) {
                          const parts = dateStr.split("-");
                          if (parts.length === 3) {
                            const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                            dayOfWeek = d.toLocaleDateString("en-US", { weekday: "long" });
                            formattedDateStr = d.toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            });
                          }
                        }

                        return (
                          <div key={h.id || h._id || idx} className="holiday-list-card">
                            <div className="holiday-card-date-badge">
                              <span className="h-day">{dayOfWeek || "Holiday"}</span>
                              <span className="h-date">{formattedDateStr}</span>
                            </div>
                            <div className="holiday-card-info">
                              <h4>{h.title || h.name}</h4>
                              <p>{h.description || "Official company holiday"}</p>
                              <div className="holiday-card-tags">
                                <span className={`holiday-type-pill ${h.type?.toLowerCase() || "gazetted"}`}>
                                  {h.type || "Gazetted"}
                                </span>
                                {h.mandatory ? (
                                  <span className="mandatory-pill">Mandatory Paid Off</span>
                                ) : (
                                  <span className="optional-pill">Optional Holiday</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="no-events-prompt">
                        🏖️ No holidays found in database.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Side Panel: Inspector & Upcoming Holidays */}
            <div className="calendar-sidebar">
              {/* Selected Day Timeline Inspector */}
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

              {/* Upcoming Holidays Card */}
              <div className="sidebar-card">
                <h3>Upcoming Holidays</h3>
                <div className="upcoming-list">
                  {upcomingHolidays.length > 0 ? (
                    upcomingHolidays.map((holiday) => {
                      const d = new Date(holiday.date);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const diffDays = Math.ceil((d - today) / (1000 * 60 * 60 * 24));

                      return (
                        <div key={holiday._id} className="upcoming-item">
                          <div className="upcoming-date">
                            <span className="month">{monthNames[d.getMonth()].substring(0, 3)}</span>
                            <span className="day">{d.getDate()}</span>
                          </div>
                          <div className="upcoming-details">
                            <h4>{holiday.title}</h4>
                            <span className="type">{holiday.type}</span>
                            <span className="countdown">
                              {diffDays === 0 ? "Today" : diffDays === 1 ? "Tomorrow" : `In ${diffDays} days`}
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

              {/* Calendar Legend Card */}
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
                    <span className="legend-color personal-leave" />
                    <span>My Approved Leaves (PTO)</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color personal-leave-pending" />
                    <span>My Pending Leaves</span>
                  </div>
                </div>
              </div>
            </div>
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

                  {/* Positioned Event Blocks */}
                  {selectedDateEvents.map((evt, idx) => {
                    const pos = calculateEventPosition(evt);
                    const isPast = isTodayDate(selectedDate) && nowMins > pos.startMins;
                    const isCompleted = isTodayDate(selectedDate) && nowMins >= pos.endMins;
                    const progressPercent = isTodayDate(selectedDate)
                      ? Math.min(100, Math.max(0, ((nowMins - pos.startMins) / (pos.endMins - pos.startMins)) * 100))
                      : 0;

                    return (
                      <div
                        key={idx}
                        className={`planner-event-block ${evt.type} ${isCompleted ? "completed-event" : ""}`}
                        style={{
                          top: `${pos.top}px`,
                          height: `${Math.max(48, pos.height)}px`,
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
      </main>
    </>
  );
}
