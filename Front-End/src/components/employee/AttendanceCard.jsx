import { useEffect, useState } from "react";
import { formatDuration } from "../../utils/date";

function AttendanceCard({ attendance, onClockIn, onClockOut }) {
  const checkedIn = Boolean(attendance?.checkIn) && !attendance?.checkOut;
  const status = attendance?.liveStatus || attendance?.status;
  const isWorkdayOver = new Date().getHours() >= 17;
  const isEightHoursReached = Number(attendance?.workingHours || 0) >= 8.0;
  const displayStatus = attendance?.checkOut
    ? "Completed"
    : checkedIn
    ? "Checked in"
    : status === "Absent" || status === "absent" || (isWorkdayOver && !attendance?.checkIn)
    ? "Absent"
    : "Not checked in";
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!attendance?.checkIn) {
      setElapsedSeconds(Math.min(28800, Math.max(0, Math.round(Number(attendance?.workingHours || 0) * 3600))));
      return undefined;
    }

    const checkInTime = new Date(attendance.checkIn).getTime();
    const checkOutTime = attendance.checkOut ? new Date(attendance.checkOut).getTime() : Date.now();
    if (Number.isNaN(checkInTime)) {
      setElapsedSeconds(Math.min(28800, Math.max(0, Math.round(Number(attendance?.workingHours || 0) * 3600))));
      return undefined;
    }
    const updateElapsed = () => {
      const currentTime = attendance.checkOut ? checkOutTime : Date.now();
      const rawSeconds = Math.max(0, Math.floor((currentTime - checkInTime) / 1000));
      const storedSeconds = Math.max(0, Math.round(Number(attendance?.workingHours || 0) * 3600));
      const totalSeconds = Math.max(rawSeconds, storedSeconds);

      // Capped at strict 8 hours
      const capped = Math.min(28800, totalSeconds);
      setElapsedSeconds(capped);

      // If active shift reached 8 hours, trigger auto clock-out
      if (checkedIn && rawSeconds >= 28800 && onClockOut) {
        onClockOut();
      }
    };

    updateElapsed();
    if (attendance.checkOut) return undefined;

    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [attendance?.checkIn, attendance?.checkOut, checkedIn, onClockOut]);

  const isClockInBlocked = checkedIn || (attendance?.checkOut && isEightHoursReached);

  return (
    <section className="attendance-card panel">
      <div className="attendance-card-content">
        <span className="card-label">Today's attendance</span>
        <h2 className={`attendance-status-heading ${attendance?.checkOut ? "attendance-completed" : ""}`}>
          {displayStatus}
        </h2>
        <p className={attendance?.checkOut ? "attendance-complete-message" : ""}>
          {checkedIn
            ? "Your workday is in progress (8 hr max shift)."
            : attendance?.checkOut
            ? "Your workday is complete (8.0 hr shift limit)."
            : "Start your workday when you are ready."}
        </p>
        <div className="timer-display" aria-live="polite">
          <strong className="work-timer">{formatDuration(elapsedSeconds)}</strong>
          <span className="timer-caption">Working time (Max 8:00:00)</span>
        </div>
      </div>
      <div className="card-actions">
        <button
          type="button"
          className="primary-button"
          onClick={onClockIn}
          disabled={isClockInBlocked}
          title={isEightHoursReached ? "8-hour daily shift limit reached" : ""}
        >
          {attendance?.checkOut ? (isEightHoursReached ? "Shift Done (8h)" : "Resume shift") : "Clock in"}
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={onClockOut}
          disabled={!checkedIn}
        >
          Clock out
        </button>
      </div>
    </section>
  );
}

export default AttendanceCard;
