import { formatDate } from "../../utils/date";
import { formatPhotoUrl } from "../../utils/photo";

function EmployeeProfile({ employee, compact = false }) {
  const designation = employee?.employment?.designation || employee?.designation || employee?.jobTitle || employee?.role || "Not specified";
  const name = employee?.name || `${employee?.firstName || ""} ${employee?.lastName || ""}`.trim() || "Employee";
  const profilePhotoUrl = formatPhotoUrl(employee?.profilePhoto);

  const department = employee?.employment?.department || employee?.department || "Not provided";
  const joiningDate = employee?.employment?.joiningDate || employee?.joiningDate;
  const employmentType = employee?.employment?.employmentType || employee?.employmentType || "Not provided";
  const status = employee?.employment?.status || employee?.status || "Active";
  const email = employee?.email || "Not provided";
  const phone = employee?.phone || "Not provided";

  return (
    <section className={`${compact ? "employee-profile" : "profile-detail-card"} panel`}>
      <div className="profile-identity">
        {profilePhotoUrl ? (
          <img
            className="profile-avatar profile-avatar-image"
            src={profilePhotoUrl}
            alt={`${name} profile`}
            onError={(e) => {
              e.currentTarget.style.display = "none";
              const fallback = e.currentTarget.nextElementSibling;
              if (fallback) fallback.style.display = "flex";
            }}
          />
        ) : null}
        <div className="profile-avatar" style={{ display: profilePhotoUrl ? "none" : "flex" }} aria-hidden="true">
          {name.charAt(0).toUpperCase()}
        </div>
        <div><h2>{name}</h2><p>{designation}</p><span className="profile-status">{status}</span></div>
      </div>
      {!compact && <div className="profile-detail-grid">
        <div><span>Email</span><strong>{email}</strong></div>
        <div><span>Phone</span><strong>{phone}</strong></div>
        <div><span>Department</span><strong>{department}</strong></div>
        <div><span>Employment type</span><strong>{employmentType}</strong></div>
        <div><span>Employee code</span><strong>{employee?.employeeCode || employee?.employeeId || "Not assigned"}</strong></div>
        <div><span>Joining date</span><strong>{formatDate(joiningDate)}</strong></div>
      </div>}
    </section>
  );
}

export default EmployeeProfile;
