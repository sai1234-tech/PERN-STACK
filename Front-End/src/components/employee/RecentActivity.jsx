import { formatTime } from "../../utils/date";

function formatActivityDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit" }).format(new Date(value));
}

function RecentActivity({ attendance = [], leaves = [] }) {
  const attendanceItems = attendance.map((record) => ({
    id: `attendance-${record.id || record._id || record.date}`,
    date: record.date || record.createdAt,
    clockIn: record.checkIn || record.clockIn,
    clockOut: record.checkOut || record.clockOut,
    status: record.status || "Present",
  }));
  const leaveItems = leaves.map((leave) => ({
    id: `leave-${leave.id || leave._id || leave.startDate}`,
    date: leave.startDate || leave.date,
    status: "Leave",
  }));
  const activities = [...attendanceItems, ...leaveItems]
    .sort((left, right) => new Date(right.date) - new Date(left.date))
    .slice(0, 5);

  return <section className="panel"><div className="section-heading"><h2>Recent activity</h2></div><div className="activity-scroll"><div className="activity-header"><span>Date</span><span>Clock in</span><span>Clock out</span><span>Status</span></div>{activities.length ? activities.map((activity) => <div className="activity-row" key={activity.id}><time>{formatActivityDate(activity.date)}</time><span>{formatTime(activity.clockIn)}</span><span>{formatTime(activity.clockOut)}</span><strong className={`activity-status ${String(activity.status).toLowerCase()}`}>{activity.status}</strong></div>) : <p className="activity-empty">No recent activity.</p>}</div></section>;
}

export default RecentActivity;
