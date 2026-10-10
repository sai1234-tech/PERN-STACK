import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import AuthLayout from "../../components/auth/AuthLayout";
import InputField from "../../components/auth/InputField";
import {
  validateName,
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  validatePhone,
} from "../../utils/validation";
import { useAuth } from "../../context/AuthContext";

const DEPARTMENTS = [
  "Engineering",
  "Human Resources",
  "Finance & Accounts",
  "Marketing & Sales",
  "Operations",
  "Product Design",
];

const EMPLOYMENT_TYPES = ["Full Time", "Part Time", "Contract", "Intern"];

function Signup() {
  const navigate = useNavigate();
  const { signup } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    employeeCode: "",
    joiningDate: new Date().toISOString().split("T")[0],
    department: "Engineering",
    designation: "",
    employmentType: "Full Time",
    salary: "",
  });

  const [termsAgreed, setTermsAgreed] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Trigger tactile shake on errors
  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: "",
    }));

    setServerError("");
  };

  // Auto-generate employee code
  const handleAutoGenerateCode = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setForm((prev) => ({
      ...prev,
      employeeCode: `EMP-${randomNum}`,
    }));
  };

  // Set joining date to today
  const handleSetToday = () => {
    setForm((prev) => ({
      ...prev,
      joiningDate: new Date().toISOString().split("T")[0],
    }));
    setErrors((prev) => ({ ...prev, joiningDate: "" }));
  };

  // Calculate password strength score (0 to 4)
  const calculatePasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: "Empty", color: "#cbd5e1" };
    let score = 0;
    if (pwd.length >= 6) score++;
    if (/\d/.test(pwd)) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd) || pwd.length >= 10) score++;

    if (score === 1) return { score: 1, label: "Weak", color: "#ef4444" };
    if (score === 2) return { score: 2, label: "Fair", color: "#f59e0b" };
    if (score === 3) return { score: 3, label: "Good", color: "#3b82f6" };
    return { score: 4, label: "Strong", color: "#10b981" };
  };

  const pwdStrength = calculatePasswordStrength(form.password);

  // Step 1 Validation
  const validateStep1 = () => {
    const stepErrors = {};
    const nameErr = validateName(form.name);
    const emailErr = validateEmail(form.email);
    const phoneErr = validatePhone(form.phone);

    if (nameErr) stepErrors.name = nameErr;
    if (emailErr) stepErrors.email = emailErr;
    if (phoneErr) stepErrors.phone = phoneErr;

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  // Step 2 Validation
  const validateStep2 = () => {
    const stepErrors = {};
    if (!form.joiningDate) stepErrors.joiningDate = "Joining date is required";
    if (!form.department.trim()) stepErrors.department = "Department is required";

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  // Step 3 Validation
  const validateStep3 = () => {
    const stepErrors = {};
    const pwdErr = validatePassword(form.password);
    const confirmErr = validateConfirmPassword(form.password, form.confirmPassword);

    if (pwdErr) stepErrors.password = pwdErr;
    if (confirmErr) stepErrors.confirmPassword = confirmErr;
    if (!termsAgreed) stepErrors.terms = "You must accept the terms to proceed";

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (validateStep1()) {
        setCurrentStep(2);
      } else {
        triggerShake();
      }
    } else if (currentStep === 2) {
      if (validateStep2()) {
        setCurrentStep(3);
      } else {
        triggerShake();
      }
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");
    setSuccess("");

    if (!validateStep1()) {
      setCurrentStep(1);
      triggerShake();
      return;
    }

    if (!validateStep2()) {
      setCurrentStep(2);
      triggerShake();
      return;
    }

    if (!validateStep3()) {
      triggerShake();
      return;
    }

    try {
      setLoading(true);

      const payload = {
        name: form.name.trim(),
        firstName: form.name.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: "employee",
        employeeCode: form.employeeCode.trim().toUpperCase(),
        phone: form.phone.trim(),
        joiningDate: form.joiningDate,
        department: form.department.trim(),
        designation: form.designation.trim() || "Staff Member",
        employmentType: form.employmentType,
        salary: form.salary ? Number(form.salary) : 0,
      };

      await signup(payload);

      setSuccess("Account successfully created! Opening your employee dashboard...");
      setTimeout(() => {
        navigate("/employee/dashboard", { replace: true });
      }, 700);
    } catch (error) {
      setServerError(error.message || "Signup failed");
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create employee account"
      subtitle="Register your workplace profile in 3 simple steps"
      footerText="Already have an account?"
      footerLink="/login"
      footerLinkText="Sign in"
    >
      {/* Interactive Step Stepper */}
      <div className="signup-stepper-wrap">
        <div className="stepper-progress-track">
          <div
            className="stepper-progress-fill"
            style={{ width: currentStep === 1 ? "33%" : currentStep === 2 ? "66%" : "100%" }}
          ></div>
        </div>

        <div className="stepper-steps">
          <button
            type="button"
            className={`step-badge ${currentStep === 1 ? "active" : currentStep > 1 ? "completed" : ""}`}
            onClick={() => setCurrentStep(1)}
          >
            <div className="step-num">{currentStep > 1 ? "✓" : "1"}</div>
            <span className="step-title">Personal</span>
          </button>

          <button
            type="button"
            className={`step-badge ${currentStep === 2 ? "active" : currentStep > 2 ? "completed" : ""}`}
            onClick={() => {
              if (validateStep1()) setCurrentStep(2);
              else triggerShake();
            }}
          >
            <div className="step-num">{currentStep > 2 ? "✓" : "2"}</div>
            <span className="step-title">Employment</span>
          </button>

          <button
            type="button"
            className={`step-badge ${currentStep === 3 ? "active" : ""}`}
            onClick={() => {
              if (validateStep1() && validateStep2()) setCurrentStep(3);
              else triggerShake();
            }}
          >
            <div className="step-num">3</div>
            <span className="step-title">Security</span>
          </button>
        </div>
      </div>

      {serverError && (
        <div className={`server-error ${shake ? "shake-animate" : ""}`} role="alert">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{serverError}</span>
        </div>
      )}

      {success && (
        <div className="success-message" role="status">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className={shake ? "shake-animate" : ""}>
        {/* ============================================================
            STEP 1: PERSONAL PROFILE
        ============================================================ */}
        {currentStep === 1 && (
          <div className="step-content-pane slide-in-fade">
            <div className="step-intro-banner">
              <span className="step-counter-tag">Step 1 of 3</span>
              <h3>Personal Information</h3>
              <p>Tell us your name and primary workplace contact details.</p>
            </div>

            <div className="form-grid">
              <InputField
                label="First name"
                name="name"
                value={form.name}
                onChange={handleChange}
                error={errors.name}
                placeholder="e.g. Rahul"
                required
                autoComplete="given-name"
                icon={
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                }
              />

              <InputField
                label="Last name"
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                error={errors.lastName}
                placeholder="e.g. Sharma"
                autoComplete="family-name"
                icon={
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                  </svg>
                }
              />
            </div>

            <InputField
              label="Work email address"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              error={errors.email}
              placeholder="rahul.sharma@company.com"
              required
              autoComplete="email"
              isValid={form.email && !errors.email && form.email.includes("@")}
              icon={
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
              }
            />

            <InputField
              label="Phone number"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              error={errors.phone}
              placeholder="10-digit mobile number"
              autoComplete="tel"
              icon={
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
              }
            />

            <div className="step-actions-footer">
              <div></div>
              <button
                type="button"
                className="step-next-btn"
                onClick={handleNextStep}
              >
                <span>Continue to Employment</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================
            STEP 2: EMPLOYMENT DETAILS
        ============================================================ */}
        {currentStep === 2 && (
          <div className="step-content-pane slide-in-fade">
            <div className="step-intro-banner">
              <span className="step-counter-tag">Step 2 of 3</span>
              <h3>Employment Details</h3>
              <p>Configure your workplace role, department, and joining date.</p>
            </div>

            <div className="form-grid">
              {/* Joining Date with 'Today' quick button */}
              <div className="form-group">
                <div className="label-row">
                  <label htmlFor="joiningDate">
                    Joining date <span className="required">*</span>
                  </label>
                  <button
                    type="button"
                    className="action-chip-btn"
                    onClick={handleSetToday}
                    title="Set to today's date"
                  >
                    📅 Today
                  </button>
                </div>
                <div className="input-wrapper has-icon">
                  <span className="input-icon">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                  </span>
                  <input
                    id="joiningDate"
                    name="joiningDate"
                    type="date"
                    value={form.joiningDate}
                    onChange={handleChange}
                    className={`form-input ${errors.joiningDate ? "input-error" : ""}`}
                  />
                </div>
                {errors.joiningDate && <small className="error-text">{errors.joiningDate}</small>}
              </div>

              {/* Employee Code with Auto-Generate */}
              <InputField
                label="Employee code"
                name="employeeCode"
                value={form.employeeCode}
                onChange={handleChange}
                placeholder="e.g. EMP-1042"
                action={
                  <button
                    type="button"
                    className="action-chip-btn"
                    onClick={handleAutoGenerateCode}
                    title="Generate random code"
                  >
                    ⚡ Auto-Generate
                  </button>
                }
                icon={
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                  </svg>
                }
              />
            </div>

            {/* Department with Quick Suggestion Chips */}
            <div className="form-group">
              <label htmlFor="department">
                Department <span className="required">*</span>
              </label>
              <div className="quick-chips-row">
                {DEPARTMENTS.slice(0, 4).map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    className={`quick-dept-chip ${form.department === dept ? "selected" : ""}`}
                    onClick={() => {
                      setForm((prev) => ({ ...prev, department: dept }));
                      setErrors((prev) => ({ ...prev, department: "" }));
                    }}
                  >
                    {dept}
                  </button>
                ))}
              </div>
              <div className="input-wrapper has-icon">
                <span className="input-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </svg>
                </span>
                <input
                  id="department"
                  name="department"
                  value={form.department}
                  onChange={handleChange}
                  placeholder="e.g. Engineering"
                  className={`form-input ${errors.department ? "input-error" : ""}`}
                />
              </div>
              {errors.department && <small className="error-text">{errors.department}</small>}
            </div>

            <div className="form-grid">
              <InputField
                label="Designation / Role"
                name="designation"
                value={form.designation}
                onChange={handleChange}
                placeholder="e.g. Software Engineer"
                icon={
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                  </svg>
                }
              />

              {/* Employment Type Pills */}
              <div className="form-group">
                <label>Employment type</label>
                <div className="employment-pills-group">
                  {EMPLOYMENT_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`emp-type-pill ${form.employmentType === type ? "active" : ""}`}
                      onClick={() => setForm((prev) => ({ ...prev, employmentType: type }))}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <InputField
              label="Annual Salary (₹ or $)"
              name="salary"
              type="number"
              value={form.salary}
              onChange={handleChange}
              placeholder="e.g. 650000"
              icon={
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23"></line>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
              }
            />

            <div className="step-actions-footer">
              <button
                type="button"
                className="step-back-btn"
                onClick={handlePrevStep}
              >
                ← Back
              </button>
              <button
                type="button"
                className="step-next-btn"
                onClick={handleNextStep}
              >
                <span>Continue to Security</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================
            STEP 3: SECURITY & REVIEW
        ============================================================ */}
        {currentStep === 3 && (
          <div className="step-content-pane slide-in-fade">
            <div className="step-intro-banner">
              <span className="step-counter-tag">Step 3 of 3</span>
              <h3>Account Security & Review</h3>
              <p>Set a secure password and confirm your workplace registration.</p>
            </div>

            <div className="form-grid">
              <InputField
                label="Password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                error={errors.password}
                placeholder="6–20 characters"
                required
                autoComplete="new-password"
                icon={
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                }
              />

              <InputField
                label="Confirm password"
                name="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={handleChange}
                error={errors.confirmPassword}
                placeholder="Repeat password"
                required
                autoComplete="new-password"
                icon={
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  </svg>
                }
              />
            </div>

            {/* Live Password Strength Meter & Interactive Checklist */}
            <div className="pwd-strength-container">
              <div className="pwd-strength-header">
                <span>Password Strength:</span>
                <strong style={{ color: pwdStrength.color }}>{pwdStrength.label}</strong>
              </div>

              <div className="pwd-strength-bars">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className="strength-bar-cell"
                    style={{
                      backgroundColor:
                        pwdStrength.score >= level ? pwdStrength.color : "#e2e8f0",
                    }}
                  ></div>
                ))}
              </div>

              <div className="pwd-checklist-grid">
                <div className={`pwd-check-item ${form.password.length >= 6 ? "is-met" : ""}`}>
                  <span className="check-bullet">{form.password.length >= 6 ? "✓" : "•"}</span>
                  <span>At least 6 characters</span>
                </div>
                <div className={`pwd-check-item ${/\d/.test(form.password) ? "is-met" : ""}`}>
                  <span className="check-bullet">{/\d/.test(form.password) ? "✓" : "•"}</span>
                  <span>Contains a number</span>
                </div>
                <div
                  className={`pwd-check-item ${
                    /[a-z]/.test(form.password) && /[A-Z]/.test(form.password) ? "is-met" : ""
                  }`}
                >
                  <span className="check-bullet">
                    {/[a-z]/.test(form.password) && /[A-Z]/.test(form.password) ? "✓" : "•"}
                  </span>
                  <span>Upper & lowercase</span>
                </div>
                <div
                  className={`pwd-check-item ${
                    form.confirmPassword && form.password === form.confirmPassword ? "is-met" : ""
                  }`}
                >
                  <span className="check-bullet">
                    {form.confirmPassword && form.password === form.confirmPassword ? "✓" : "•"}
                  </span>
                  <span>Passwords match</span>
                </div>
              </div>
            </div>

            {/* Quick Registration Summary Card */}
            <div className="registration-summary-card">
              <div className="summary-row">
                <div className="summary-item">
                  <span className="summary-k">Employee</span>
                  <span className="summary-v">
                    {form.name ? `${form.name} ${form.lastName}`.trim() : "Pending"}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-k">Work Email</span>
                  <span className="summary-v">{form.email || "Not specified"}</span>
                </div>
              </div>
              <div className="summary-row">
                <div className="summary-item">
                  <span className="summary-k">Department</span>
                  <span className="summary-v">{form.department}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-k">Type</span>
                  <span className="summary-v">{form.employmentType}</span>
                </div>
              </div>
            </div>

            {/* Terms and conditions */}
            <div className="terms-interactive-box">
              <label className="custom-checkbox-container">
                <input
                  type="checkbox"
                  id="terms"
                  checked={termsAgreed}
                  onChange={(e) => {
                    setTermsAgreed(e.target.checked);
                    if (e.target.checked) setErrors((prev) => ({ ...prev, terms: "" }));
                  }}
                  required
                />
                <span className="checkmark-box"></span>
                <span className="checkbox-label-text">
                  I agree to the HRMS{" "}
                  <button
                    type="button"
                    className="terms-link-trigger"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowTermsModal(true);
                    }}
                  >
                    Terms of Service & Privacy Policy
                  </button>
                  .
                </span>
              </label>
              {errors.terms && <small className="error-text">{errors.terms}</small>}
            </div>

            <div className="step-actions-footer">
              <button
                type="button"
                className="step-back-btn"
                onClick={handlePrevStep}
              >
                ← Back
              </button>
              <button
                type="submit"
                className={`auth-button interactive-submit ${loading ? "is-loading" : ""}`}
                disabled={loading}
              >
                {loading ? (
                  <span className="btn-loading-content">
                    <span className="btn-spinner"></span>
                    <span>Creating account...</span>
                  </span>
                ) : (
                  <span className="btn-text-content">
                    <span>Complete Registration</span>
                    <svg className="btn-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
      </form>

      {/* Interactive Terms & Privacy Modal */}
      {showTermsModal && (
        <div className="auth-modal-backdrop" onClick={() => setShowTermsModal(false)}>
          <div
            className="auth-modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="terms-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-icon-badge">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              </div>
              <div className="modal-title-wrap">
                <h3 id="terms-modal-title">Terms & Privacy Policy</h3>
                <p>Enterprise HRMS Employee Guidelines</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowTermsModal(false)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="modal-body terms-scroll-body">
              <h4>1. Workplace Account & Security</h4>
              <p>
                Your HRMS account is tied to your employment identity. Please ensure your login credentials remain confidential and are never shared across team members.
              </p>

              <h4>2. Attendance, Leaves & Timesheet Accuracy</h4>
              <p>
                By registering, you acknowledge that check-ins, check-outs, leave applications, and logged timesheets constitute accurate representations of your working hours.
              </p>

              <h4>3. Data Protection & Privacy</h4>
              <p>
                Your personal and payroll data is encrypted and securely stored in compliance with organizational ISO 27001 data governance practices.
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="modal-primary-btn"
                onClick={() => {
                  setTermsAgreed(true);
                  setErrors((prev) => ({ ...prev, terms: "" }));
                  setShowTermsModal(false);
                }}
              >
                Accept Terms & Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}

export default Signup;
