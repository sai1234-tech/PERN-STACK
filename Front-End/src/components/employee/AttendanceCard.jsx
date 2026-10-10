import { useEffect, useState } from "react";

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((unit) => String(unit).padStart(2, "0"))
    .join(":");
}

function AttendanceCard({ attendance, onClockIn, onClockOut }) {
  const checkedIn = Boolean(attendance?.checkIn) && !attendance?.checkOut;
  const status = attendance?.liveStatus || attendance?.status;
  const isWorkdayOver = new Date().getHours() >= 17;
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
      setElapsedSeconds(Math.max(0, Math.round(Number(attendance?.workingHours || 0) * 3600)));
      return undefined;
    }

    const checkInTime = new Date(attendance.checkIn).getTime();
    const checkOutTime = attendance.checkOut ? new Date(attendance.checkOut).getTime() : Date.now();
    if (Number.isNaN(checkInTime)) {
      setElapsedSeconds(Math.max(0, Math.round(Number(attendance?.workingHours || 0) * 3600)));
      return undefined;
    }
    const updateElapsed = () => {
      const currentTime = attendance.checkOut ? checkOutTime : Date.now();
      const timestampSeconds = Math.max(0, Math.floor((currentTime - checkInTime) / 1000));
      const storedSeconds = Math.max(0, Math.round(Number(attendance?.workingHours || 0) * 3600));
      setElapsedSeconds(Math.max(timestampSeconds, storedSeconds));
    };

    updateElapsed();
    if (attendance.checkOut) return undefined;

    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [attendance?.checkIn, attendance?.checkOut]);

  return <section className="attendance-card panel"><div className="attendance-card-content"><span className="card-label">Today's attendance</span><h2 className={`attendance-status-heading ${attendance?.checkOut ? "attendance-completed" : ""}`}>{displayStatus}</h2><p className={attendance?.checkOut ? "attendance-complete-message" : ""}>{checkedIn ? "Your workday is in progress." : attendance?.checkOut ? "Your workday is complete." : "Start your workday when you are ready."}</p><div className="timer-display" aria-live="polite"><strong className="work-timer">{formatDuration(elapsedSeconds)}</strong><span className="timer-caption">Working time</span></div></div><div className="card-actions"><button type="button" className="primary-button" onClick={onClockIn} disabled={Boolean(attendance?.checkIn)}>Clock in</button><button type="button" className="secondary-button" onClick={onClockOut} disabled={!checkedIn}>Clock out</button></div></section>;
}

export default AttendanceCard;
