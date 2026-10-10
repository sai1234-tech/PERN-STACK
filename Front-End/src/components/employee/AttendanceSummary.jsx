function AttendanceSummary({ attendance = [] }) {
  const countStatus = (statuses) => attendance.filter((record) => statuses.includes(String(record.status || "").toLowerCase())).length;
  const present = attendance.filter((record) =>
    ["present", "late", "completed", "half-day", "halfday"].includes(
      String(record.status || "").toLowerCase(),
    ) || Boolean(record.checkIn),
  ).length;
  const late = countStatus(["late"]);
  const absent = countStatus(["absent"]);

  return <section className="summary-grid"><div className="panel"><span>Records</span><strong>{attendance.length}</strong></div><div className="panel summary-present"><span>Present</span><strong>{present}</strong></div><div className="panel summary-late"><span>Late</span><strong>{late}</strong></div><div className="panel summary-absent"><span>Absent</span><strong>{absent}</strong></div></section>;
}

export default AttendanceSummary;
