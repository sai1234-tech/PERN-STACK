import { formatDate } from "../../utils/date";

function RecentLeaves({ leaves = [] }) {
  return <section className="panel"><div className="section-heading"><h2>Recent leave requests</h2></div>{leaves.slice(0, 5).map((leave, index) => <p className="activity-row" key={leave.id || index}><span>{leave.type || "Leave"} · {leave.status || "Pending"}</span><time>{formatDate(leave.startDate)}</time></p>)}</section>;
}

export default RecentLeaves;
