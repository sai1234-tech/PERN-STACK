import React, { useState } from 'react';

function InputField({
  label,
  name,
  type = "text",
  value,
  onChange,
  onBlur,
  onKeyDown,
  onKeyUp,
  error,
  placeholder,
  required = false,
  autoComplete,
  icon,
  action,
  isValid = false,
  helpText,
  minLength,
  maxLength,
  disabled = false,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);

  const isPasswordType = type === "password";
  const effectiveType = isPasswordType ? (showPassword ? "text" : "password") : type;

  const handleKeyActivity = (e) => {
    if (isPasswordType && typeof e.getModifierState === "function") {
      setCapsLockActive(e.getModifierState("CapsLock"));
    }
    if (e.type === "keydown" && onKeyDown) onKeyDown(e);
    if (e.type === "keyup" && onKeyUp) onKeyUp(e);
  };

  const computedMaxLength =
    maxLength !== undefined
      ? maxLength
      : name === "name"
      ? 30
      : name === "password" || name === "confirmPassword"
      ? 20
      : undefined;

  return (
    <div className={`form-group ${error ? "has-error" : ""} ${isValid ? "is-valid" : ""}`}>
      <div className="label-row">
        <label htmlFor={name}>
          {label}
          {required && <span className="required">*</span>}
        </label>
        {action && <div className="input-header-action">{action}</div>}
      </div>

      <div className={`input-wrapper ${icon ? "has-icon" : ""} ${isPasswordType ? "has-password-toggle" : ""}`}>
        {icon && <span className="input-icon" aria-hidden="true">{icon}</span>}

        <input
          id={name}
          name={name}
          type={effectiveType}
          value={value ?? ""}
          onChange={onChange}
          onBlur={(e) => {
            setCapsLockActive(false);
            if (onBlur) onBlur(e);
          }}
          onKeyDown={handleKeyActivity}
          onKeyUp={handleKeyActivity}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          minLength={minLength}
          maxLength={computedMaxLength}
          className={`form-input ${error ? "input-error" : ""} ${isValid ? "input-valid" : ""}`}
        />

        {isPasswordType && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((prev) => !prev)}
            className="password-toggle-btn"
            title={showPassword ? "Hide password" : "Show password"}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              // Eye-off icon
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
            ) : (
              // Eye icon
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            )}
          </button>
        )}

        {isValid && !isPasswordType && (
          <span className="valid-icon" title="Valid input">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </span>
        )}
      </div>

      {capsLockActive && isPasswordType && (
        <div className="caps-warning" role="alert">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
          <span>Caps Lock is ON</span>
        </div>
      )}

      {error ? (
        <small className="error-text">{error}</small>
      ) : helpText ? (
        <small className="help-text">{helpText}</small>
      ) : null}
    </div>
  );
}

export default InputField;
