import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import Loader from "../../components/common/Loader";
import ErrorMessage from "../../components/common/ErrorMessage";
import { useEmployee } from "../../hooks/useEmployee";
import { useAuth } from "../../context/AuthContext";
import { uploadProfilePicture, updateProfileSkills, updateMyProfile, getAllEmployees, updateEmployeeById } from "../../services/employeeService";
import { formatDate } from "../../utils/date";
import { formatPhotoUrl as profilePhotoUrl } from "../../utils/photo";
import { calculateTenure, formatTenure } from "../../utils/tenureUtils";
import TenureDetails from "../../components/employee/TenureDetails";
import "../../styles/employee/profile.css";

const resolveManagerName = (emp, employeeList = []) => {
  if (!emp) return "Not assigned";
  const ref = emp.reportsTo || emp.managerId || emp.reportingManager || emp.employment?.reportsTo || emp.employment?.reportingManager;
  if (!ref) return "Not assigned";

  if (typeof ref === "object" && ref !== null) {
    const name = ref.name || `${ref.firstName || ""} ${ref.lastName || ""}`.trim();
    const code = ref.employeeCode || ref.code || ref.employeeId;
    if (name && code) return `${name} (${code})`;
    if (name) return name;
    if (code) return code;
  }

  if (typeof ref === "string") {
    const trimmed = ref.trim();
    if (!trimmed) return "Not assigned";
    if (/\(EMP\d+\)/i.test(trimmed)) return trimmed;

    const found = employeeList.find(e =>
      (e._id && String(e._id) === trimmed) ||
      (e.id && String(e.id) === trimmed) ||
      (e.employeeCode && String(e.employeeCode).toUpperCase() === trimmed.toUpperCase()) ||
      (e.email && String(e.email).toLowerCase() === trimmed.toLowerCase())
    );

    if (found) {
      const name = found.name || `${found.firstName || ""} ${found.lastName || ""}`.trim();
      const code = found.employeeCode || found.employeeId || "";
      return code ? `${name} (${code})` : name;
    }

    return trimmed;
  }

  return "Not assigned";
};

const resolveWorkLocation = (profile, savedLocation) => {
  const candidates = [
    profile?.workLocation,
    profile?.work_location,
    profile?.employment?.workLocation,
    profile?.employment?.work_location,
    profile?.employment?.location,
    profile?.officeLocation,
    profile?.office_location,
    profile?.branch,
    profile?.location,
    savedLocation,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
    if (candidate && typeof candidate === "object") {
      const parts = [
        candidate.name,
        candidate.label,
        candidate.office,
        candidate.city,
        candidate.branch,
      ].filter((part) => typeof part === "string" && part.trim());
      if (parts.length) return [...new Set(parts)].join(", ");
    }
  }

  return "Not provided";
};

function EmployeeProfile() {
  const [searchParams] = useSearchParams();
  const queryId = searchParams.get("id") || searchParams.get("code") || searchParams.get("employeeId");
  const { employee, loading, error, reload } = useEmployee(queryId);
  const { user, updateProfilePhoto } = useAuth();

  const [allEmployees, setAllEmployees] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [localPreview, setLocalPreview] = useState(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [showSkillsModal, setShowSkillsModal] = useState(false);
  const [savingSkills, setSavingSkills] = useState(false);
  const [skillsTab, setSkillsTab] = useState("skills");
  const [newSkillInput, setNewSkillInput] = useState("");
  const [newCertForm, setNewCertForm] = useState({ icon: "📜", title: "", issuer: "", validity: "" });
  const [newAwardForm, setNewAwardForm] = useState({ icon: "🏆", title: "", organization: "", theme: "gold" });

  const [activeTab, setActiveTab] = useState("all");
  const [showAccountMask, setShowAccountMask] = useState(false);

  useEffect(() => {
    getAllEmployees()
      .then((res) => {
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        setAllEmployees(list);
      })
      .catch(() => {});
  }, []);

  const isExplicitQuery = !!queryId;

  const profile =
    employee?.employee ||
    employee?.data ||
    (employee && (employee.firstName || employee.email || employee.employeeCode) ? employee : null) ||
    user?.employee ||
    user ||
    null;

  const storageKey = `hrms_profile_edits_${profile?.employeeCode || profile?._id || "default"}`;

  const [personalData, setPersonalData] = useState({
    personalEmail: "Not provided",
    phone: "Not provided",
    altPhone: "Not provided",
    address: "Not provided",
    bloodGroup: "Not provided",
    dateOfBirth: "Not provided",
    emergencyContactName: "Not provided",
    emergencyRelationship: "Not provided",
    emergencyPhone: "Not provided",
    emergencyAltPhone: "Not provided",
    medicalNotes: "Not provided",
  });
  const [editForm, setEditForm] = useState(personalData);

  const [skillsData, setSkillsData] = useState({
    skills: [],
    certifications: [],
    awards: [],
  });

  const [skillsEditForm, setSkillsEditForm] = useState(skillsData);

  const fullName =
    (profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}`.trim() : "") ||
    profile?.name ||
    (!isExplicitQuery && user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "") ||
    (!isExplicitQuery ? user?.name : "") ||
    "Not provided";

  const initials =
    fullName === "Not provided"
      ? "--"
      : fullName
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0].toUpperCase())
          .join("") || "EM";

  const employeeCode =
    profile?.employeeCode ||
    profile?.employeeId ||
    (!isExplicitQuery ? user?.employeeId : "") ||
    "Not assigned";

  const department =
    profile?.employment?.department ||
    profile?.department ||
    "Not provided";

  const designation =
    profile?.employment?.designation ||
    profile?.designation ||
    profile?.jobTitle ||
    "Not provided";

  const corporateEmail =
    profile?.email ||
    "Not provided";

  const dateOfJoining =
    profile?.employment?.joiningDate ||
    profile?.joiningDate ||
    profile?.dateOfJoining ||
    profile?.createdAt ||
    null;

  const dateOfExit = profile?.employment?.dateOfExit || profile?.dateOfExit || null;
  const currentStatus = profile?.employment?.status || profile?.status || "Active";
  const employmentType = profile?.employment?.employmentType || profile?.employmentType || "Full Time";
  const reportingManager = resolveManagerName(profile, allEmployees);
  const hrPartner = profile?.assignedHr
    ? `${profile.assignedHr.name || ""}${profile.assignedHr.employeeCode ? ` (${profile.assignedHr.employeeCode})` : ""}`.trim() || "Not assigned"
    : profile?.employment?.hrPartnerName || "Not assigned";
  const workLocation = resolveWorkLocation(profile, personalData.workLocation);

  const statutoryData = {
    bankName: profile?.banking?.bankName || profile?.bankName || profile?.salaryBank || "Not provided",
    accountNumber: profile?.banking?.accountNumber || profile?.accountNumber || "Not provided",
    ifsc: profile?.banking?.ifsc || profile?.ifsc || "Not provided",
    pan: profile?.pan || profile?.statutory?.pan || "Not provided",
    uan: profile?.uan || profile?.statutory?.uan || "Not provided",
  };

  const portalAccessEnabled = profile?.user || profile?.grantLogin || profile?.portalAccess || (!isExplicitQuery && user) ? "Enabled" : "Not granted";
  const systemRole = profile?.user?.role || profile?.loginRole || profile?.systemRole || (!isExplicitQuery ? user?.role : "") || "Employee";

  useEffect(() => {
    if (profile && (profile.email || profile.firstName || profile.phone || profile.phoneNumber || profile._id || profile.employeeCode)) {
      let savedEdits = {};
      try {
        if (profile.employeeCode || profile._id) {
          const saved = localStorage.getItem(storageKey);
          if (saved) savedEdits = JSON.parse(saved);
        }
      } catch {}

      const rawPhone = profile.phone || profile.phoneNumber || profile.mobile || profile.phoneNo || profile.personal?.phone || profile.personal?.phoneNumber || "";
      const validSavedPhone = savedEdits.phone && savedEdits.phone !== "Not provided" ? savedEdits.phone : "";
      const validSavedEmail = savedEdits.personalEmail && savedEdits.personalEmail !== "Not provided" ? savedEdits.personalEmail : "";
      const validSavedAddress = savedEdits.address && savedEdits.address !== "Not provided" ? savedEdits.address : "";

      const updatedPersonal = {
        personalEmail: profile.personal?.personalEmail || profile.personalEmail || validSavedEmail || "Not provided",
        phone: rawPhone || validSavedPhone || "Not provided",
        altPhone: profile.personal?.altPhone || (savedEdits.altPhone !== "Not provided" ? savedEdits.altPhone : "") || "Not provided",
        address: profile.address?.addressLine
          ? `${profile.address.addressLine}${profile.address.city ? `, ${profile.address.city}` : ""}`
          : (typeof profile.address === "string" && profile.address.trim() ? profile.address : validSavedAddress || "Not provided"),
        bloodGroup: profile.personal?.bloodGroup || (savedEdits.bloodGroup !== "Not provided" ? savedEdits.bloodGroup : "") || "Not provided",
        dateOfBirth: profile.personal?.dateOfBirth ? formatDate(profile.personal.dateOfBirth) : (savedEdits.dateOfBirth !== "Not provided" ? savedEdits.dateOfBirth : "") || "Not provided",
        workLocation: resolveWorkLocation(
          profile,
          savedEdits.workLocation !== "Not provided" ? savedEdits.workLocation : ""
        ),
        emergencyContactName: profile.emergencyContact?.name || (savedEdits.emergencyContactName !== "Not provided" ? savedEdits.emergencyContactName : "") || "Not provided",
        emergencyRelationship: profile.emergencyContact?.relationship || (savedEdits.emergencyRelationship !== "Not provided" ? savedEdits.emergencyRelationship : "") || "Not provided",
        emergencyPhone: profile.emergencyContact?.phone || (savedEdits.emergencyPhone !== "Not provided" ? savedEdits.emergencyPhone : "") || "Not provided",
        emergencyAltPhone: profile.emergencyContact?.altPhone || (savedEdits.emergencyAltPhone !== "Not provided" ? savedEdits.emergencyAltPhone : "") || "Not provided",
        medicalNotes: profile.emergencyContact?.medicalNotes || (savedEdits.medicalNotes !== "Not provided" ? savedEdits.medicalNotes : "") || "Not provided",
      };

      setPersonalData(updatedPersonal);
      if (!showEditModal) {
        setEditForm(updatedPersonal);
      }

      const updatedSkills = {
        skills: Array.isArray(profile.skills) ? profile.skills : savedEdits.skills || [],
        certifications: Array.isArray(profile.certifications) ? profile.certifications : savedEdits.certifications || [],
        awards: Array.isArray(profile.awards) ? profile.awards : savedEdits.awards || [],
      };

      setSkillsData(updatedSkills);
      if (!showSkillsModal) {
        setSkillsEditForm(updatedSkills);
      }
    }
  }, [employee, user, profile.employeeCode, profile._id, showEditModal, showSkillsModal]);

  const handleAddSkill = () => {
    if (!newSkillInput.trim()) return;
    if (skillsEditForm.skills.includes(newSkillInput.trim())) return;
    setSkillsEditForm({
      ...skillsEditForm,
      skills: [...skillsEditForm.skills, newSkillInput.trim()],
    });
    setNewSkillInput("");
  };

  const handleRemoveSkill = (index) => {
    setSkillsEditForm({
      ...skillsEditForm,
      skills: skillsEditForm.skills.filter((_, i) => i !== index),
    });
  };

  const handleAddCert = () => {
    if (!newCertForm.title.trim()) return;
    const newCert = {
      id: "cert-" + Date.now(),
      icon: newCertForm.icon.trim() || "📜",
      title: newCertForm.title.trim(),
      issuer: newCertForm.issuer.trim() || "Credential Provider",
      validity: newCertForm.validity.trim() || "Active Credential",
    };
    setSkillsEditForm({
      ...skillsEditForm,
      certifications: [...skillsEditForm.certifications, newCert],
    });
    setNewCertForm({ icon: "📜", title: "", issuer: "", validity: "" });
  };

  const handleRemoveCert = (index) => {
    setSkillsEditForm({
      ...skillsEditForm,
      certifications: skillsEditForm.certifications.filter((_, i) => i !== index),
    });
  };

  const handleAddAward = () => {
    if (!newAwardForm.title.trim()) return;
    const newAward = {
      id: "award-" + Date.now(),
      icon: newAwardForm.icon.trim() || "🏆",
      title: newAwardForm.title.trim(),
      organization: newAwardForm.organization.trim() || "Corporate Recognition",
      theme: newAwardForm.theme || "gold",
    };
    setSkillsEditForm({
      ...skillsEditForm,
      awards: [...skillsEditForm.awards, newAward],
    });
    setNewAwardForm({ icon: "🏆", title: "", organization: "", theme: "gold" });
  };

  const handleRemoveAward = (index) => {
    setSkillsEditForm({
      ...skillsEditForm,
      awards: skillsEditForm.awards.filter((_, i) => i !== index),
    });
  };

  const handleSaveSkillsModal = async () => {
    setUploadError("");
    setSavingSkills(true);
    try {
      if (isExplicitQuery) {
        const empTarget = profile.employeeCode || profile._id || profile.id;
        if (!empTarget) {
          throw new Error("Unable to identify the selected employee profile.");
        }
        await updateEmployeeById(empTarget, skillsEditForm);
      } else {
        await updateProfileSkills(skillsEditForm);
      }
      if (reload) await reload();
      setSkillsData(skillsEditForm);
      try {
        localStorage.setItem(storageKey, JSON.stringify({ ...personalData, ...skillsEditForm }));
      } catch {}
      setUploadSuccess("Skills & Recognition updated successfully!");
      setShowSkillsModal(false);
      setTimeout(() => setUploadSuccess(""), 4000);
    } catch (err) {
      setUploadError(err?.message || "Unable to save skills and recognition. Please try again.");
    } finally {
      setSavingSkills(false);
    }
  };

  const formatForDateInput = (dStr) => {
    if (!dStr || dStr === "Not provided") return "";
    try {
      const d = new Date(dStr);
      if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
      }
    } catch {}
    return dStr.match(/\d{4}-\d{2}-\d{2}/) ? dStr : "";
  };

  const handleOpenEdit = () => {
    const rawDob = profile.personal?.dateOfBirth || personalData.dateOfBirth;
    setEditForm({
      personalEmail: personalData.personalEmail !== "Not provided" ? personalData.personalEmail : "",
      phone: personalData.phone !== "Not provided" ? personalData.phone : "",
      altPhone: personalData.altPhone !== "Not provided" ? personalData.altPhone : "",
      address: personalData.address !== "Not provided" ? personalData.address : "",
      bloodGroup: personalData.bloodGroup !== "Not provided" ? personalData.bloodGroup : "O+ Positive",
      dateOfBirth: formatForDateInput(rawDob),
      workLocation: workLocation !== "Not provided" ? workLocation : "",
      emergencyContactName: personalData.emergencyContactName !== "Not provided" ? personalData.emergencyContactName : "",
      emergencyRelationship: personalData.emergencyRelationship !== "Not provided" ? personalData.emergencyRelationship : "Spouse (Next of Kin)",
      emergencyPhone: personalData.emergencyPhone !== "Not provided" ? personalData.emergencyPhone : "",
      emergencyAltPhone: personalData.emergencyAltPhone !== "Not provided" ? personalData.emergencyAltPhone : "",
      medicalNotes: personalData.medicalNotes !== "Not provided" ? personalData.medicalNotes : "",
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setUploadError("");
    setSavingProfile(true);
    const formattedDobDisplay = editForm.dateOfBirth ? formatDate(editForm.dateOfBirth) : "Not provided";
    const updatedPersonalState = {
      personalEmail: editForm.personalEmail.trim() || "Not provided",
      phone: editForm.phone.trim() || "Not provided",
      altPhone: editForm.altPhone.trim() || "Not provided",
      address: editForm.address.trim() || "Not provided",
      bloodGroup: editForm.bloodGroup || "Not provided",
      dateOfBirth: formattedDobDisplay,
      workLocation: editForm.workLocation.trim() || "Not provided",
      emergencyContactName: editForm.emergencyContactName.trim() || "Not provided",
      emergencyRelationship: editForm.emergencyRelationship || "Not provided",
      emergencyPhone: editForm.emergencyPhone.trim() || "Not provided",
      emergencyAltPhone: editForm.emergencyAltPhone.trim() || "Not provided",
      medicalNotes: editForm.medicalNotes.trim() || "Not provided",
    };
    const payload = {
      phone: editForm.phone.trim(),
      workLocation: editForm.workLocation.trim(),
      personal: {
        personalEmail: editForm.personalEmail.trim(),
        altPhone: editForm.altPhone.trim(),
        bloodGroup: editForm.bloodGroup.trim(),
        dateOfBirth: editForm.dateOfBirth ? editForm.dateOfBirth : null,
      },
      employment: {
        workLocation: editForm.workLocation.trim(),
      },
      address: {
        addressLine: editForm.address.trim(),
        city: "",
      },
      emergencyContact: {
        name: editForm.emergencyContactName.trim(),
        relationship: editForm.emergencyRelationship.trim(),
        phone: editForm.emergencyPhone.trim(),
        altPhone: editForm.emergencyAltPhone.trim(),
        medicalNotes: editForm.medicalNotes.trim(),
      },
    };

    try {
      if (isExplicitQuery) {
        const empTarget = profile.employeeCode || profile._id || profile.id;
        if (!empTarget) {
          throw new Error("Unable to identify the selected employee profile.");
        }
        await updateEmployeeById(empTarget, payload);
      } else {
        await updateMyProfile(payload);
      }
      if (reload) await reload();
      setPersonalData(updatedPersonalState);
      try {
        localStorage.setItem(storageKey, JSON.stringify({ ...updatedPersonalState, ...skillsData }));
      } catch {}
      setUploadSuccess("Personal profile and emergency directives updated successfully!");
      setShowEditModal(false);
      setTimeout(() => setUploadSuccess(""), 4000);
    } catch (err) {
      setUploadError(err?.message || "Unable to save profile changes. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  };

  const activePhotoUrl =
    localPreview ||
    profilePhotoUrl(profile?.profilePhoto) ||
    profilePhotoUrl(user?.profilePhoto) ||
    "";

  const handleProfilePictureChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file (PNG, JPG, WEBP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Profile picture must be smaller than 5 MB.");
      return;
    }

    let preview = "";
    try {
      setUploading(true);
      setUploadError("");
      setUploadSuccess("");

      preview = URL.createObjectURL(file);
      setLocalPreview(preview);

      const uploadResult = await uploadProfilePicture(file);
      const serverPhoto = uploadResult?.profilePhoto || uploadResult?.employee?.profilePhoto || uploadResult?.data?.profilePhoto;

      if (!serverPhoto || serverPhoto.startsWith("blob:")) {
        throw new Error("The server did not return a saved profile picture.");
      }
      setLocalPreview("");
      if (updateProfilePhoto) {
        updateProfilePhoto(serverPhoto);
      }
      if (reload) await reload();
      setUploadSuccess("Profile picture updated successfully!");
    } catch (err) {
      setLocalPreview("");
      setUploadError(err.message || "Failed to update profile photo.");
    } finally {
      if (preview) URL.revokeObjectURL(preview);
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleExportDossier = () => {
    const dossierData = {
      organization: "Quadratic Systems Inc.",
      exportTimestamp: new Date().toISOString(),
      employeeId: employeeCode,
      fullName: fullName,
      designation: designation,
      department: department,
      employmentType: employmentType,
      workLocation: workLocation,
      dateOfJoining: dateOfJoining ? formatDate(dateOfJoining) : "Not provided",
      reportingManager: reportingManager,
      contact: {
        corporateEmail: corporateEmail,
        personalEmail: personalData.personalEmail,
        phone: personalData.phone,
        altPhone: personalData.altPhone,
        residentialAddress: personalData.address,
        bloodGroup: personalData.bloodGroup,
      },
      emergency: {
        primaryContact: personalData.emergencyContactName,
        relationship: personalData.emergencyRelationship,
        primaryPhone: personalData.emergencyPhone,
        altPhone: personalData.emergencyAltPhone,
        medicalNotes: personalData.medicalNotes,
      },
      statutory: {
        primaryBank: statutoryData.bankName,
        accountNumber: statutoryData.accountNumber,
        ifsc: statutoryData.ifsc,
        pan: statutoryData.pan,
        uan: statutoryData.uan,
      },
      certifications: skillsData.certifications.map((c) => c.title || c),
      skills: skillsData.skills,
    };

    const blob = new Blob([JSON.stringify(dossierData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fullName.replace(/\s+/g, "_")}_Employment_Dossier.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setUploadSuccess("Employment dossier exported successfully as JSON!");
    setTimeout(() => setUploadSuccess(""), 4000);
  };

  return (
    <>
      <EmployeeHeader />

      <main className="employee-profile-hub">
        {loading ? (
          <Loader label="Loading profile dossier..." />
        ) : error || !profile || (!profile.firstName && !profile.email && !profile.employeeCode) ? (
          <div className="employee-not-found-card" style={{ padding: "3rem", textAlign: "center", background: "#ffffff", borderRadius: "16px", border: "1px solid #e2e8f0", margin: "2rem auto", maxWidth: "600px" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>👤❌</div>
            <h2 style={{ fontSize: "1.5rem", color: "#1e293b", marginBottom: "0.5rem" }}>Employee Record Not Found</h2>
            <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>
              {error || `The requested employee record (${queryId || sessionStorage.getItem("hrms_selected_employee_id") || "selected"}) could not be loaded.`}
            </p>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <Link to="/hr/employees" className="att-btn primary" style={{ textDecoration: "none" }}>
                Back to Directory
              </Link>
              <button type="button" onClick={() => reload && reload()} className="att-btn secondary">
                Retry Sync
              </button>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  background: "#fffbeb",
                  border: "1px solid #fef3c7",
                  borderRadius: "10px",
                  color: "#b45309",
                  fontWeight: 600,
                  fontSize: "0.82rem",
                  marginBottom: "1rem",
                }}
              >
                ⚠️ Live sync notice: {error} (Displaying cached session dossier)
              </div>
            )}

            {/* =====================================================
                HERO COMMAND BANNER
            ===================================================== */}
            <section className="prof-hero-banner" aria-label="Profile Hero Banner">
              <div className="prof-hero-left">
                <div className="prof-avatar-wrapper">
                  <div
                    className="prof-avatar-pod"
                    onClick={() => activePhotoUrl && setShowPhotoModal(true)}
                    title={activePhotoUrl ? "Click to view full uncropped photo" : "Profile avatar"}
                  >
                    {activePhotoUrl ? (
                      <>
                        <img
                          src={activePhotoUrl}
                          alt={fullName}
                          className="prof-avatar-img"
                        />
                        <div className="prof-avatar-hover-overlay">
                          <span>👁️ View</span>
                        </div>
                      </>
                    ) : (
                      <span>{initials}</span>
                    )}
                  </div>

                  <label className="prof-photo-badge" title="Upload new profile photo">
                    📷
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleProfilePictureChange}
                      disabled={uploading}
                      hidden
                    />
                  </label>
                </div>

                <div className="prof-identity-info">
                  <div className="hero-kicker-pill">
                    <span className="pulsing-live-dot" />
                    <span>Quadratic Identity & Employment Dossier</span>
                  </div>
                  <h1>{fullName}</h1>
                  <p>
                    {designation} • {department} • {workLocation && workLocation !== "Not provided" ? workLocation : (profile?.branch || "Hyderabad HQ")}
                  </p>

                  <div className="emp-meta-pills">
                    <span className="meta-pill-tag">🆔 {employeeCode}</span>
                    <span className="meta-pill-tag">💼 {employmentType}</span>
                    <span className="meta-pill-tag">🏢 Floor 5, Pod 14</span>
                    <span className="meta-pill-tag">✓ Confirmed Permanent</span>
                  </div>
                </div>
              </div>

              <div className="prof-hero-actions">
                <div className="date-capsule-badge">
                  <span>🛡️ Status: Active Employee</span>
                </div>

                <div className="prof-action-buttons-row">
                  <button
                    type="button"
                    className="att-btn primary"
                    onClick={handleOpenEdit}
                    title="Edit personal and emergency contact details"
                  >
                    ✏️ Edit Profile
                  </button>

                  <Link
                    to="/organization"
                    className="att-btn secondary"
                    title="Explore organization hierarchy & reporting chain"
                  >
                    🌳 Org Chart
                  </Link>

                  <button
                    type="button"
                    className="att-btn secondary"
                    onClick={handleExportDossier}
                    title="Export verified profile records to file"
                  >
                    📥 Export Dossier
                  </button>

                  {activePhotoUrl && (
                    <button
                      type="button"
                      className="att-btn secondary"
                      onClick={() => setShowPhotoModal(true)}
                      title="View full resolution uncropped photo"
                    >
                      👁️ Full Photo
                    </button>
                  )}

                  <label
                    className="att-btn secondary"
                    style={{ cursor: "pointer" }}
                    title="Upload or change profile photo"
                  >
                    {uploading ? "Updating..." : "📷 Photo"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleProfilePictureChange}
                      disabled={uploading}
                      hidden
                    />
                  </label>
                </div>
              </div>
            </section>

            {/* =====================================================
                FEEDBACK ALERTS
            ===================================================== */}
            {uploadError && (
              <div
                style={{
                  padding: "0.85rem 1rem",
                  background: "#fff1f2",
                  border: "1px solid #fecdd3",
                  borderRadius: "10px",
                  color: "#e11d48",
                  fontWeight: 600,
                  fontSize: "0.86rem",
                  marginBottom: "1.5rem",
                }}
              >
                ⚠️ {uploadError}
              </div>
            )}

            {uploadSuccess && (
              <div
                style={{
                  padding: "0.85rem 1rem",
                  background: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  borderRadius: "10px",
                  color: "#059669",
                  fontWeight: 600,
                  fontSize: "0.86rem",
                  marginBottom: "1.5rem",
                }}
              >
                ✓ {uploadSuccess}
              </div>
            )}

            {/* =====================================================
                4 KPI METRICS
            ===================================================== */}
            {/* =====================================================
                SEGMENTED TAB BAR
            ===================================================== */}
            <nav className="prof-tab-pills" aria-label="Profile Section Tabs">
              <button
                type="button"
                className={`prof-tab-btn ${activeTab === "all" ? "active" : ""}`}
                onClick={() => setActiveTab("all")}
              >
                All Sections
              </button>
              <button
                type="button"
                className={`prof-tab-btn ${activeTab === "personal" ? "active" : ""}`}
                onClick={() => setActiveTab("personal")}
              >
                👤 Personal & Contact
              </button>
              <button
                type="button"
                className={`prof-tab-btn ${activeTab === "employment" ? "active" : ""}`}
                onClick={() => setActiveTab("employment")}
              >
                🏢 Employment & Org
              </button>
              <button
                type="button"
                className={`prof-tab-btn ${activeTab === "service" ? "active" : ""}`}
                onClick={() => setActiveTab("service")}
              >
                ⏳ Service & Tenure
              </button>
              <button
                type="button"
                className={`prof-tab-btn ${activeTab === "banking" ? "active" : ""}`}
                onClick={() => setActiveTab("banking")}
              >
                💳 Statutory & Banking
              </button>
              <button
                type="button"
                className={`prof-tab-btn ${activeTab === "emergency" ? "active" : ""}`}
                onClick={() => setActiveTab("emergency")}
              >
                🚨 Emergency & Medical
              </button>
              <button
                type="button"
                className={`prof-tab-btn ${activeTab === "skills" ? "active" : ""}`}
                onClick={() => setActiveTab("skills")}
              >
                💡 Skills & Badges
              </button>
            </nav>

            {/* =====================================================
                STRUCTURED DOSSIER SECTIONS
            ===================================================== */}
            <div className={`dossier-sections-grid ${activeTab !== 'all' ? 'single-tab-view' : ''}`}>
              {/* Section 1: Personal & Contact Details */}
              {(activeTab === "all" || activeTab === "personal") && (
                <article className="dossier-section-card">
                  <div className="dossier-head">
                    <h3>👤 Personal & Contact Details</h3>
                    <div className="dossier-head-actions">
                      <span className="meta-pill-tag verified-badge">
                        ✓ Verified
                      </span>
                      <button
                        type="button"
                        className="edit-section-link-btn"
                        onClick={handleOpenEdit}
                        title="Edit personal details"
                      >
                        ✏️ Edit
                      </button>
                    </div>
                  </div>

                  <div className="dossier-fields-grid">
                    <div className="dossier-field">
                      <span>Full Legal Name</span>
                      <strong>{fullName}</strong>
                    </div>

                    <div className="dossier-field">
                      <span>Corporate Email</span>
                      <strong>{corporateEmail}</strong>
                    </div>

                    <div className="dossier-field">
                      <span>Personal Email</span>
                      <strong>{personalData.personalEmail}</strong>
                    </div>

                    <div className="dossier-field">
                      <span>Mobile Phone</span>
                      <strong>{personalData.phone}</strong>
                    </div>

                    <div className="dossier-field">
                      <span>Alternate Contact</span>
                      <strong>{personalData.altPhone}</strong>
                    </div>

                    <div className="dossier-field">
                      <span>Date of Birth</span>
                      <strong>{personalData.dateOfBirth}</strong>
                    </div>

                    <div className="dossier-field">
                      <span>Blood Group</span>
                      <strong className="blood-group-tag">{personalData.bloodGroup}</strong>
                    </div>

                    <div className="dossier-field">
                      <span>Work Base Location</span>
                      <strong>{workLocation}</strong>
                    </div>

                    <div className="dossier-field full-width">
                      <span>Residential Address</span>
                      <strong>{personalData.address}</strong>
                    </div>
                  </div>
                </article>
              )}

              {/* Section 2: Employment & Organization */}
              {(activeTab === "all" || activeTab === "employment") && (
                <article className="dossier-section-card">
                  <div className="dossier-head">
                    <h3>🏢 Employment & Organization</h3>
                    <span className="meta-pill-tag confidential-badge">
                      🔒 Official Record
                    </span>
                  </div>

                  <div className="dossier-fields-grid">
                    <div className="dossier-field">
                      <span>Employee ID</span>
                      <strong>{employeeCode}</strong>
                    </div>

                    <div className="dossier-field">
                      <span>Job Title</span>
                      <strong>{designation}</strong>
                    </div>

                    <div className="dossier-field">
                      <span>Department</span>
                      <strong>{department}</strong>
                    </div>

                    <div className="dossier-field">
                      <span>Reporting Manager</span>
                      <strong>{reportingManager}</strong>
                    </div>

                    <div className="dossier-field">
                      <span>HR Partner</span>
                      <strong>{hrPartner}</strong>
                    </div>

                    <div className="dossier-field">
                      <span>Employment Type</span>
                      <strong>{employmentType}</strong>
                    </div>

                    <div className="dossier-field">
                      <span>Work Location</span>
                      <strong>{workLocation}</strong>
                    </div>

                    <div className="dossier-field">
                      <span>Official Shift Window</span>
                      <strong>09:30 AM – 06:30 PM (IST)</strong>
                    </div>

                    <div className="dossier-field">
                      <span>Employment / Account Status</span>
                      <strong>{currentStatus}</strong>
                    </div>

                    <div className="dossier-field">
                      <span>Portal Access</span>
                      <strong>{portalAccessEnabled} ({systemRole})</strong>
                    </div>
                  </div>
                </article>
              )}

              {/* Section 2.5: Service & Tenure */}
              {(activeTab === "all" || activeTab === "service") && (
                <TenureDetails 
                  joiningDate={dateOfJoining} 
                  exitDate={dateOfExit} 
                  status={currentStatus} 
                />
              )}

              {/* Section 3: Banking & Statutory Details */}
              {(activeTab === "all" || activeTab === "banking") && (
                <article className="dossier-section-card">
                  <div className="dossier-head">
                    <h3>💳 Banking & Statutory Identifiers</h3>
                    <div className="dossier-head-actions">
                      <span className="meta-pill-tag encrypted-badge">
                        🔒 Encrypted
                      </span>
                      {statutoryData.accountNumber !== "Not provided" && (
                        <button
                          type="button"
                          className="mask-toggle-btn"
                          onClick={() => setShowAccountMask(!showAccountMask)}
                          title="Toggle account number visibility"
                        >
                          {showAccountMask ? "🔒 Hide Account" : "👁️ Reveal Account"}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="dossier-fields-grid">
                    <div className="dossier-field">
                      <span>Primary Salary Bank</span>
                      <strong>{statutoryData.bankName}</strong>
                    </div>

                    <div className="dossier-field">
                      <span>Salary Account Number</span>
                      <strong style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}>
                        {statutoryData.accountNumber === "Not provided"
                          ? "Not provided"
                          : showAccountMask
                          ? statutoryData.accountNumber
                          : `•••• •••• •••• ${statutoryData.accountNumber.slice(-4)}`}
                      </strong>
                    </div>

                    <div className="dossier-field">
                      <span>IFSC Branch Code</span>
                      <strong>{statutoryData.ifsc}</strong>
                    </div>

                    <div className="dossier-field">
                      <span>Income Tax PAN</span>
                      <strong>{statutoryData.pan}</strong>
                    </div>

                    <div className="dossier-field">
                      <span>Provident Fund (UAN)</span>
                      <strong>{statutoryData.uan}</strong>
                    </div>
                  </div>
                </article>
              )}

              {/* Section 4: Emergency Contacts & Next of Kin */}
              {(activeTab === "all" || activeTab === "emergency") && (
                <article className="dossier-section-card">
                  <div className="dossier-head">
                    <h3>🚨 Emergency Contact & Medical Directives</h3>
                    <div className="dossier-head-actions">
                      <span className="meta-pill-tag priority-badge">
                        Priority 1 Alert
                      </span>
                      <button
                        type="button"
                        className="edit-section-link-btn"
                        onClick={handleOpenEdit}
                        title="Update emergency contact"
                      >
                        ✏️ Edit
                      </button>
                    </div>
                  </div>

                  <div className="dossier-fields-grid">
                    <div className="dossier-field">
                      <span>Primary Contact Person</span>
                      <strong>{personalData.emergencyContactName}</strong>
                    </div>

                    <div className="dossier-field">
                      <span>Relationship to Employee</span>
                      <strong>{personalData.emergencyRelationship}</strong>
                    </div>

                    <div className="dossier-field">
                      <span>Primary Emergency Phone</span>
                      <strong style={{ color: personalData.emergencyPhone !== "Not provided" ? "#059669" : "inherit" }}>{personalData.emergencyPhone}</strong>
                    </div>

                    <div className="dossier-field">
                      <span>Alternate Emergency Phone</span>
                      <strong>{personalData.emergencyAltPhone}</strong>
                    </div>

                    <div className="dossier-field full-width">
                      <span>Medical Directives & Health Insurance</span>
                      <strong>{personalData.medicalNotes}</strong>
                    </div>
                  </div>
                </article>
              )}

              {/* Section 5: Skills, Stack, Certifications & Recognition */}
              {(activeTab === "all" || activeTab === "skills") && (
                <article className="dossier-section-card full-width">
                  <div className="dossier-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                    <h3>💡 Skills, Certifications & Corporate Recognition</h3>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <button
                        type="button"
                        className="prof-edit-dossier-btn"
                        onClick={() => {
                          setSkillsEditForm(skillsData);
                          setShowSkillsModal(true);
                        }}
                        title="Edit Skills, Certifications & Awards"
                        style={{
                          background: "#ecfdf5",
                          color: "#047857",
                          border: "1px solid #a7f3d0",
                          padding: "0.4rem 0.85rem",
                          borderRadius: "8px",
                          fontWeight: 700,
                          fontSize: "0.82rem",
                          cursor: "pointer",
                        }}
                      >
                        ✏️ Edit Skills & Recognition
                      </button>
                    </div>
                  </div>

                  <div className="prof-skills-cert-container">
                    {/* Core Skills */}
                    <div className="prof-subsection">
                      <h4 className="prof-subhead">Core Technical & Domain Competencies ({skillsData.skills.length})</h4>
                      {skillsData.skills.length > 0 ? (
                        <div className="skill-pills-cloud">
                          {skillsData.skills.map((skill, i) => (
                            <span key={i} className="skill-tag-pill">
                              {skill}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: "#6b7280", fontSize: "0.88rem", fontStyle: "italic", margin: "0.5rem 0" }}>Not provided</p>
                      )}
                    </div>

                    {/* Certifications Grid */}
                    <div className="prof-subsection">
                      <h4 className="prof-subhead">Verified Industry Certifications ({skillsData.certifications.length})</h4>
                      {skillsData.certifications.length > 0 ? (
                        <div className="cert-cards-grid">
                          {skillsData.certifications.map((cert) => (
                            <div key={cert.id || cert.title} className="cert-card-item">
                              <div className="cert-icon-box">{cert.icon || "📜"}</div>
                              <div className="cert-details">
                                <strong>{cert.title}</strong>
                                <span>{cert.issuer}</span>
                                <span className="cert-validity">{cert.validity}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: "#6b7280", fontSize: "0.88rem", fontStyle: "italic", margin: "0.5rem 0" }}>Not provided</p>
                      )}
                    </div>

                    {/* Honors & Recognition */}
                    <div className="prof-subsection">
                      <h4 className="prof-subhead">Corporate Honors & Recognition ({skillsData.awards.length})</h4>
                      {skillsData.awards.length > 0 ? (
                        <div className="honor-badges-row">
                          {skillsData.awards.map((award) => (
                            <div key={award.id || award.title} className={`honor-badge-card ${award.theme || "gold"}`}>
                              <span className="honor-badge-icon">{award.icon || "🏆"}</span>
                              <div className="honor-badge-text">
                                <strong>{award.title}</strong>
                                <span>{award.organization}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: "#6b7280", fontSize: "0.88rem", fontStyle: "italic", margin: "0.5rem 0" }}>Not provided</p>
                      )}
                    </div>
                  </div>
                </article>
              )}
            </div>
          </>
        )}
      </main>

      {/* =====================================================
          EDIT PROFILE MODAL
      ===================================================== */}
      {showEditModal && (
        <div
          className="edit-profile-modal-backdrop"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="edit-profile-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Edit Profile Details"
          >
            <div className="edit-modal-head">
              <div className="edit-modal-title">
                <h3>✏️ Edit 👤 Personal & Contact Details</h3>
                <p>Self-service updates for personal contact details and emergency response directives</p>
              </div>
              <button
                type="button"
                className="photo-modal-close"
                onClick={() => setShowEditModal(false)}
                title="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="edit-profile-modal-body">
              {/* Statutory lock banner */}
              <div className="statutory-lock-banner">
                <span className="lock-icon">🔒</span>
                <div className="lock-text">
                  <strong>Statutory Records are Protected:</strong> Legal Name, Employee Code, PAN, Bank Account, Department, and Date of Joining are verified by Quadratic HR & Payroll. To request changes to statutory fields, please open an HR Operations Ticket.
                </div>
              </div>

              <div className="edit-form-grid">
                <div className="form-section-separator full-width" style={{ borderTop: "none", paddingTop: 0 }}>
                  <span>👤 Personal & Contact Details</span>
                </div>

                <div className="form-group-item">
                  <label>Full Legal Name</label>
                  <div className="read-only-field-wrap">
                    <input
                      type="text"
                      disabled
                      value={fullName}
                      className="form-input-disabled"
                    />
                    <span className="field-tag-badge">Official Record</span>
                  </div>
                </div>

                <div className="form-group-item">
                  <label>Corporate Work Email</label>
                  <div className="read-only-field-wrap">
                    <input
                      type="email"
                      disabled
                      value={corporateEmail}
                      className="form-input-disabled"
                    />
                    <span className="field-tag-badge">Corporate Verified</span>
                  </div>
                </div>

                <div className="form-group-item">
                  <label>Personal Email Address</label>
                  <input
                    type="email"
                    value={editForm.personalEmail}
                    onChange={(e) => setEditForm({ ...editForm, personalEmail: e.target.value })}
                  />
                </div>

                <div className="form-group-item">
                  <label>Mobile Phone</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  />
                </div>

                <div className="form-group-item">
                  <label>Alternate Phone Number</label>
                  <input
                    type="tel"
                    value={editForm.altPhone}
                    onChange={(e) => setEditForm({ ...editForm, altPhone: e.target.value })}
                  />
                </div>

                <div className="form-group-item">
                  <label>Blood Group</label>
                  <select
                    value={editForm.bloodGroup}
                    onChange={(e) => setEditForm({ ...editForm, bloodGroup: e.target.value })}
                  >
                    <option value="O+ Positive">O+ Positive</option>
                    <option value="O- Negative">O- Negative</option>
                    <option value="A+ Positive">A+ Positive</option>
                    <option value="A- Negative">A- Negative</option>
                    <option value="B+ Positive">B+ Positive</option>
                    <option value="B- Negative">B- Negative</option>
                    <option value="AB+ Positive">AB+ Positive</option>
                    <option value="AB- Negative">AB- Negative</option>
                  </select>
                </div>

                <div className="form-group-item">
                  <label>Date of Birth</label>
                  <input
                    type="date"
                    value={editForm.dateOfBirth}
                    onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                  />
                </div>

                <div className="form-group-item">
                  <label>Work Base Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Hyderabad HQ / Remote / Bangalore"
                    value={editForm.workLocation}
                    onChange={(e) => setEditForm({ ...editForm, workLocation: e.target.value })}
                  />
                </div>

                <div className="form-group-item full-width">
                  <label>Residential Address (Hyderabad / Native)</label>
                  <textarea
                    rows={2}
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  />
                </div>

                <div className="form-section-separator full-width">
                  <span>🚨 Emergency Contact & Health Directives</span>
                </div>

                <div className="form-group-item">
                  <label>Primary Emergency Contact Person</label>
                  <input
                    type="text"
                    value={editForm.emergencyContactName}
                    onChange={(e) => setEditForm({ ...editForm, emergencyContactName: e.target.value })}
                  />
                </div>

                <div className="form-group-item">
                  <label>Relationship to Employee</label>
                  <select
                    value={editForm.emergencyRelationship}
                    onChange={(e) => setEditForm({ ...editForm, emergencyRelationship: e.target.value })}
                  >
                    <option value="Spouse (Next of Kin)">Spouse (Next of Kin)</option>
                    <option value="Parent / Father">Parent / Father</option>
                    <option value="Parent / Mother">Parent / Mother</option>
                    <option value="Sibling / Brother">Sibling / Brother</option>
                    <option value="Sibling / Sister">Sibling / Sister</option>
                    <option value="Legal Guardian">Legal Guardian</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-group-item">
                  <label>Emergency Contact Phone</label>
                  <input
                    type="tel"
                    value={editForm.emergencyPhone}
                    onChange={(e) => setEditForm({ ...editForm, emergencyPhone: e.target.value })}
                  />
                </div>

                <div className="form-group-item">
                  <label>Alternate Emergency Phone</label>
                  <input
                    type="tel"
                    value={editForm.emergencyAltPhone}
                    onChange={(e) => setEditForm({ ...editForm, emergencyAltPhone: e.target.value })}
                  />
                </div>

                <div className="form-group-item full-width">
                  <label>Medical Directives & Insurance Notes</label>
                  <textarea
                    rows={2}
                    value={editForm.medicalNotes}
                    onChange={(e) => setEditForm({ ...editForm, medicalNotes: e.target.value })}
                    placeholder="Allergies, chronic conditions, emergency hospital preferences..."
                  />
                </div>
              </div>

              <div className="edit-modal-footer">
                <button
                  type="button"
                  className="att-btn secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="att-btn primary"
                  disabled={savingProfile}
                >
                  {savingProfile ? "Saving..." : "Save Profile Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          EDIT SKILLS, CERTIFICATIONS & AWARDS MODAL
      ===================================================== */}
      {showSkillsModal && (
        <div
          className="edit-profile-modal-backdrop"
          onClick={() => setShowSkillsModal(false)}
        >
          <div
            className="edit-profile-modal-card"
            style={{ maxWidth: "750px" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Edit Skills, Certifications & Recognition"
          >
            <div className="edit-modal-head">
              <div className="edit-modal-title">
                <h3>💡 Edit Skills, Certifications & Honors</h3>
                <p>Manage core technical competencies, verified credentials, and corporate awards</p>
              </div>
              <button
                type="button"
                className="photo-modal-close"
                onClick={() => setShowSkillsModal(false)}
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="edit-modal-body" style={{ padding: "1.25rem 1.5rem", maxHeight: "65vh", overflowY: "auto" }}>
              {/* Tab Selector Buttons */}
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setSkillsTab("skills")}
                  style={{
                    padding: "0.45rem 0.9rem",
                    borderRadius: "8px",
                    border: "none",
                    fontWeight: 700,
                    fontSize: "0.84rem",
                    cursor: "pointer",
                    background: skillsTab === "skills" ? "#0f766e" : "#f1f5f9",
                    color: skillsTab === "skills" ? "#ffffff" : "#475569",
                  }}
                >
                  🛠️ Skills ({skillsEditForm.skills.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSkillsTab("certs")}
                  style={{
                    padding: "0.45rem 0.9rem",
                    borderRadius: "8px",
                    border: "none",
                    fontWeight: 700,
                    fontSize: "0.84rem",
                    cursor: "pointer",
                    background: skillsTab === "certs" ? "#0f766e" : "#f1f5f9",
                    color: skillsTab === "certs" ? "#ffffff" : "#475569",
                  }}
                >
                  📜 Certifications ({skillsEditForm.certifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSkillsTab("awards")}
                  style={{
                    padding: "0.45rem 0.9rem",
                    borderRadius: "8px",
                    border: "none",
                    fontWeight: 700,
                    fontSize: "0.84rem",
                    cursor: "pointer",
                    background: skillsTab === "awards" ? "#0f766e" : "#f1f5f9",
                    color: skillsTab === "awards" ? "#ffffff" : "#475569",
                  }}
                >
                  🏆 Corporate Awards ({skillsEditForm.awards.length})
                </button>
              </div>

              {/* TAB 1: SKILLS */}
              {skillsTab === "skills" && (
                <div>
                  <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.88rem", color: "#334155" }}>Add Technical / Domain Skill</h4>
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
                    <input
                      type="text"
                      className="edit-input-field"
                      placeholder="e.g. Next.js, Kubernetes, System Design..."
                      value={newSkillInput}
                      onChange={(e) => setNewSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddSkill();
                        }
                      }}
                      style={{ flex: 1, padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                    />
                    <button
                      type="button"
                      onClick={handleAddSkill}
                      style={{
                        background: "#0f766e",
                        color: "#fff",
                        border: "none",
                        padding: "0.5rem 1rem",
                        borderRadius: "8px",
                        fontWeight: 700,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      + Add Skill
                    </button>
                  </div>

                  <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", color: "#64748b" }}>Current Skill Tags</h4>
                  <div className="skill-pills-cloud" style={{ gap: "0.5rem" }}>
                    {skillsEditForm.skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="skill-tag-pill"
                        style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(idx)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#ef4444",
                            cursor: "pointer",
                            fontWeight: "bold",
                            fontSize: "0.85rem",
                            padding: 0,
                            lineHeight: 1,
                          }}
                          title="Remove skill"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 2: CERTIFICATIONS */}
              {skillsTab === "certs" && (
                <div>
                  <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.88rem", color: "#334155" }}>Add Industry Certification</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <input
                      type="text"
                      placeholder="Icon ☁️"
                      value={newCertForm.icon}
                      onChange={(e) => setNewCertForm({ ...newCertForm, icon: e.target.value })}
                      style={{ padding: "0.5rem", borderRadius: "8px", border: "1px solid #cbd5e1", textAlign: "center" }}
                    />
                    <input
                      type="text"
                      placeholder="Certification Title *"
                      value={newCertForm.title}
                      onChange={(e) => setNewCertForm({ ...newCertForm, title: e.target.value })}
                      style={{ padding: "0.5rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                    />
                    <input
                      type="text"
                      placeholder="Issuer & Credential ID"
                      value={newCertForm.issuer}
                      onChange={(e) => setNewCertForm({ ...newCertForm, issuer: e.target.value })}
                      style={{ padding: "0.5rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
                    <input
                      type="text"
                      placeholder="Validity (e.g. Valid through: Oct 2027)"
                      value={newCertForm.validity}
                      onChange={(e) => setNewCertForm({ ...newCertForm, validity: e.target.value })}
                      style={{ flex: 1, padding: "0.5rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                    />
                    <button
                      type="button"
                      onClick={handleAddCert}
                      style={{
                        background: "#0f766e",
                        color: "#fff",
                        border: "none",
                        padding: "0.5rem 1rem",
                        borderRadius: "8px",
                        fontWeight: 700,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      + Add Certification
                    </button>
                  </div>

                  <h4 style={{ margin: "1rem 0 0.5rem", fontSize: "0.85rem", color: "#64748b" }}>Existing Certifications</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {skillsEditForm.certifications.map((cert, idx) => (
                      <div
                        key={cert.id || idx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "0.65rem 0.85rem",
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                        }}
                      >
                        <div>
                          <strong>{cert.icon} {cert.title}</strong>
                          <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{cert.issuer} • {cert.validity}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCert(idx)}
                          style={{
                            background: "#fee2e2",
                            color: "#ef4444",
                            border: "none",
                            padding: "0.3rem 0.6rem",
                            borderRadius: "6px",
                            fontSize: "0.78rem",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: CORPORATE HONORS & AWARDS */}
              {skillsTab === "awards" && (
                <div>
                  <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.88rem", color: "#334155" }}>Add Corporate Honor / Recognition</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 1fr 90px", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <input
                      type="text"
                      placeholder="Icon 🏆"
                      value={newAwardForm.icon}
                      onChange={(e) => setNewAwardForm({ ...newAwardForm, icon: e.target.value })}
                      style={{ padding: "0.5rem", borderRadius: "8px", border: "1px solid #cbd5e1", textAlign: "center" }}
                    />
                    <input
                      type="text"
                      placeholder="Award Title *"
                      value={newAwardForm.title}
                      onChange={(e) => setNewAwardForm({ ...newAwardForm, title: e.target.value })}
                      style={{ padding: "0.5rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                    />
                    <input
                      type="text"
                      placeholder="Organization / Council"
                      value={newAwardForm.organization}
                      onChange={(e) => setNewAwardForm({ ...newAwardForm, organization: e.target.value })}
                      style={{ padding: "0.5rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                    />
                    <select
                      value={newAwardForm.theme}
                      onChange={(e) => setNewAwardForm({ ...newAwardForm, theme: e.target.value })}
                      style={{ padding: "0.5rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                    >
                      <option value="gold">Gold 🏆</option>
                      <option value="teal">Teal 🌟</option>
                      <option value="indigo">Indigo 🛡️</option>
                      <option value="rose">Rose 🎗️</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddAward}
                    style={{
                      background: "#0f766e",
                      color: "#fff",
                      border: "none",
                      padding: "0.5rem 1rem",
                      borderRadius: "8px",
                      fontWeight: 700,
                      cursor: "pointer",
                      width: "100%",
                      marginBottom: "1.25rem",
                    }}
                  >
                    + Add Corporate Honor / Award
                  </button>

                  <h4 style={{ margin: "1rem 0 0.5rem", fontSize: "0.85rem", color: "#64748b" }}>Existing Corporate Recognition</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {skillsEditForm.awards.map((award, idx) => (
                      <div
                        key={award.id || idx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "0.65rem 0.85rem",
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                        }}
                      >
                        <div>
                          <strong>{award.icon} {award.title}</strong>
                          <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{award.organization}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAward(idx)}
                          style={{
                            background: "#fee2e2",
                            color: "#ef4444",
                            border: "none",
                            padding: "0.3rem 0.6rem",
                            borderRadius: "6px",
                            fontSize: "0.78rem",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="edit-modal-footer">
              <button
                type="button"
                className="att-btn secondary"
                onClick={() => setShowSkillsModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="att-btn primary"
                onClick={handleSaveSkillsModal}
                disabled={savingSkills}
              >
                {savingSkills ? "Saving..." : "Save Credentials & Recognition"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          FULL PHOTO LIGHTBOX MODAL
      ===================================================== */}
      {showPhotoModal && activePhotoUrl && (
        <div
          className="photo-modal-backdrop"
          onClick={() => setShowPhotoModal(false)}
        >
          <div
            className="photo-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Profile Photo Preview"
          >
            <div className="photo-modal-head">
              <div className="photo-modal-title">
                <h3>{fullName}</h3>
                <p>Official Profile Photograph • {employeeCode}</p>
              </div>
              <button
                type="button"
                className="photo-modal-close"
                onClick={() => setShowPhotoModal(false)}
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="photo-modal-image-wrap">
              <img
                src={activePhotoUrl}
                alt={fullName}
                className="photo-modal-full-img"
              />
            </div>

            <div className="photo-modal-actions">
              <span className="photo-modal-hint">
                ✓ Full uncropped original view
              </span>

              <div className="photo-modal-btn-cluster">
                <a
                  href={activePhotoUrl}
                  target="_blank"
                  rel="noreferrer"
                  download={`${fullName.replace(/\s+/g, "_")}_ProfilePhoto.jpg`}
                  className="att-btn secondary"
                  style={{ textDecoration: "none" }}
                >
                  📥 Download Photo
                </a>

                <label className="att-btn primary" style={{ cursor: "pointer" }}>
                  {uploading ? "Updating..." : "📷 Replace Photo"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      handleProfilePictureChange(e);
                      setShowPhotoModal(false);
                    }}
                    disabled={uploading}
                    hidden
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default EmployeeProfile;