import { useState, useRef, useEffect } from "react";
import "./WeekdayDatePicker.css";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatYMD(year, monthIndex, day) {
  const y = year;
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function WeekdayDatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Select working date",
  required = false,
  disabled = false,
  className = "",
  style = {},
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const initialDate = value ? new Date(value) : new Date();
  const validInitial = !isNaN(initialDate.getTime()) ? initialDate : new Date();

  const [viewYear, setViewYear] = useState(validInitial.getFullYear());
  const [viewMonth, setViewMonth] = useState(validInitial.getMonth());

  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePrevMonth = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  let startDayOfWeek = firstDayOfMonth.getDay();
  if (startDayOfWeek === 0) startDayOfWeek = 7;

  const totalDaysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const calendarCells = [];
  for (let i = 1; i < startDayOfWeek; i++) {
    calendarCells.push({ type: "empty", id: `pad-${i}` });
  }

  for (let day = 1; day <= totalDaysInMonth; day++) {
    const ymd = formatYMD(viewYear, viewMonth, day);
    const dateObj = new Date(viewYear, viewMonth, day);
    const dayOfWeek = dateObj.getDay();
    const isSatOrSun = dayOfWeek === 0 || dayOfWeek === 6;

    let isDisabled = isSatOrSun;
    if (min && ymd < min) isDisabled = true;
    if (max && ymd > max) isDisabled = true;

    const isSelected = value === ymd;
    const isToday = formatYMD(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) === ymd;

    calendarCells.push({
      type: "day",
      day,
      ymd,
      isSatOrSun,
      isDisabled,
      isSelected,
      isToday,
    });
  }

  const handleSelectDay = (cell) => {
    if (cell.isDisabled || disabled) return;
    onChange(cell.ymd);
    setIsOpen(false);
  };

  const getDisplayLabel = () => {
    if (!value) return "";
    const parts = value.split("-");
    if (parts.length !== 3) return value;
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className={`weekday-datepicker-container ${className}`} ref={containerRef} style={style}>
      <div className="datepicker-input-wrapper" onClick={() => !disabled && setIsOpen(!isOpen)}>
        <input
          type="text"
          className="weekday-datepicker-input"
          value={getDisplayLabel()}
          placeholder={placeholder}
          readOnly
          required={required}
          disabled={disabled}
        />
        <button
          type="button"
          className="datepicker-calendar-icon-btn"
          tabIndex={-1}
        >
          📅
        </button>
      </div>

      {isOpen && (
        <div className="weekday-calendar-popover">
          <div className="calendar-popover-header">
            <button type="button" className="cal-nav-btn" onClick={handlePrevMonth} title="Previous Month">
              ‹
            </button>
            <span className="cal-month-title">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button type="button" className="cal-nav-btn" onClick={handleNextMonth} title="Next Month">
              ›
            </button>
          </div>

          <div className="calendar-weekend-notice">
            <span>⛔ Saturday & Sunday Disabled (Non-Working Days)</span>
          </div>

          <div className="calendar-weekdays-grid">
            {WEEKDAYS.map((wd) => {
              const isWeekendHeader = wd === "Sat" || wd === "Sun";
              return (
                <div key={wd} className={`cal-weekday-head ${isWeekendHeader ? "weekend-head" : ""}`}>
                  <span>{wd}</span>
                  {isWeekendHeader && <span className="off-tag">OFF</span>}
                </div>
              );
            })}
          </div>

          <div className="calendar-days-grid">
            {calendarCells.map((cell) => {
              if (cell.type === "empty") {
                return <div key={cell.id} className="cal-day-cell empty" />;
              }

              return (
                <button
                  key={cell.ymd}
                  type="button"
                  className={`cal-day-cell ${cell.isSatOrSun ? "weekend-disabled" : ""} ${cell.isDisabled ? "disabled" : ""} ${cell.isSelected ? "selected" : ""} ${cell.isToday ? "today" : ""}`}
                  onClick={() => handleSelectDay(cell)}
                  disabled={cell.isDisabled}
                  title={cell.isSatOrSun ? "Weekend (Non-working day - Disabled)" : cell.ymd}
                >
                  <span className="day-number">{cell.day}</span>
                  {cell.isSatOrSun && <span className="weekend-x-badge">OFF</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
