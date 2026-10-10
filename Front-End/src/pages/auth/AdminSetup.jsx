import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../../components/auth/AuthLayout";
import InputField from "../../components/auth/InputField";
import { setupFirstAdmin } from "../../services/authService";
import "./Auth.css";

function AdminSetup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [setupState, setSetupState] = useState("");

  const setField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setSaving(true);
      await setupFirstAdmin({ name: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password });
      setSetupState("created");
    } catch (requestError) {
      if (requestError.message.includes("already complete")) {
        setSetupState("already-complete");
        return;
      }
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthLayout
      title="Create first admin"
      subtitle="Set up the administrator account for this HRMS workspace"
      footerText="Already have an account?"
      footerLink="/login"
      footerLinkText="Sign in"
    >
      {setupState ? (
        <div className="setup-complete">
          <strong>{setupState === "created" ? "Admin account created." : "Admin setup is already complete."}</strong>
          <p>{setupState === "created" ? "Your administrator account is ready." : "An administrator account already exists for this workspace."} Sign in to open the admin dashboard.</p>
          <button type="button" className="auth-button" onClick={() => navigate("/login")}>Sign in to admin dashboard</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          {error && <div className="server-error" role="alert">{error}</div>}
          <InputField label="Full name" name="name" value={form.name} onChange={setField} placeholder="System Administrator" required autoComplete="name" />
          <InputField label="Admin email" name="email" type="email" value={form.email} onChange={setField} placeholder="admin@company.com" required autoComplete="email" />
          <InputField label="Password" name="password" type="password" value={form.password} onChange={setField} placeholder="At least 6 characters" required minLength={6} autoComplete="new-password" />
          <InputField label="Confirm password" name="confirmPassword" type="password" value={form.confirmPassword} onChange={setField} placeholder="Repeat your password" required minLength={6} autoComplete="new-password" />
          <p className="setup-warning">This screen is available only until the first admin account is created.</p>
          <button type="submit" className="auth-button" disabled={saving}>{saving ? "Creating admin..." : "Create admin account"}</button>
        </form>
      )}
      <p className="admin-setup-link"><Link to="/login">Back to sign in</Link></p>
    </AuthLayout>
  );
}

export default AdminSetup;
