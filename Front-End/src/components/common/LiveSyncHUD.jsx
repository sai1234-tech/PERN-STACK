import { useState, useEffect } from "react";
import "./LiveSyncHUD.css";

function LiveSyncHUD() {
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let dismissTimer = null;

    const handleNotice = (e) => {
      const { category, details } = e.detail || {};
      
      let title = "Real-Time Sync";
      let desc = "Workspace synchronized with backend";

      if (category === "leaves") {
        if (details?.action === "approved" || details?.status === "Approved") {
          title = "🌴 Leave Request Approved";
          desc = details?.leaveType ? `${details.leaveType} was approved by HR` : "Your leave application was approved by HR";
        } else if (details?.action === "rejected" || details?.status === "Rejected") {
          title = "❌ Leave Request Declined";
          desc = details?.rejectionReason ? `Declined: ${details.rejectionReason}` : "Your leave request was declined by HR";
        } else {
          title = "🌴 Leave Records Updated";
          desc = "Leave balances and applications refreshed";
        }
      } else if (category === "attendance") {
        if (details?.action === "check-in") {
          title = "⏱️ Attendance Check-In";
          desc = "Clock-in synchronized across the platform";
        } else if (details?.action === "check-out") {
          title = "⏱️ Attendance Check-Out";
          desc = "Shift checkout recorded and synchronized";
        } else {
          title = "⏱️ Attendance Updated";
          desc = "Attendance records refreshed from server";
        }
      } else if (category === "documents") {
        if (details?.status === "verified" || details?.action === "verified") {
          title = "✅ Document Verified";
          desc = details?.documentName ? `${details.documentName} verified by HR` : "Your document was verified by HR";
        } else if (details?.status === "rejected" || details?.action === "rejected") {
          title = "⚠️ Document Action Required";
          desc = details?.documentName ? `${details.documentName} was rejected by HR` : "Document status updated by HR";
        } else {
          title = "📂 Document Vault Updated";
          desc = "Document verification status refreshed";
        }
      } else if (category === "timesheets") {
        if (details?.action === "approved" || details?.status === "approved") {
          title = "📋 Timesheet Approved";
          desc = details?.message || "Timesheet entry approved by management";
        } else if (details?.action === "rejected" || details?.status === "rejected") {
          title = "⚠️ Timesheet Needs Revision";
          desc = details?.message || "Timesheet entry requires review adjustment";
        } else {
          title = "📋 Timesheets Updated";
          desc = "Timesheet reviews and hours synchronized";
        }
      } else if (category === "payroll") {
        title = "💳 Payroll Updated";
        desc = "Compensation and payslip records updated";
      } else if (category === "tickets") {
        title = "🎧 HR Helpdesk Update";
        desc = "Support ticket status updated in real-time";
      }

      setNotice({
        id: Date.now(),
        title,
        desc,
      });

      if (dismissTimer) clearTimeout(dismissTimer);
      dismissTimer = setTimeout(() => {
        setNotice(null);
      }, 3500);
    };

    window.addEventListener("hrms:live_sync_notice", handleNotice);
    return () => {
      window.removeEventListener("hrms:live_sync_notice", handleNotice);
      if (dismissTimer) clearTimeout(dismissTimer);
    };
  }, []);

  if (!notice) return null;

  return (
    <div className="live-sync-hud-toast" role="status" aria-live="polite">
      <div className="live-sync-icon-pod">
        <span className="live-pulse-ring" />
        <span className="live-pulse-dot" />
      </div>
      <div className="live-sync-meta">
        <div className="live-sync-title">{notice.title}</div>
        <div className="live-sync-desc">{notice.desc}</div>
      </div>
      <button
        type="button"
        className="live-sync-close"
        onClick={() => setNotice(null)}
        title="Dismiss notice"
        aria-label="Dismiss real-time update notice"
      >
        ✕
      </button>
    </div>
  );
}

export default LiveSyncHUD;
