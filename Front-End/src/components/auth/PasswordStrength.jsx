function PasswordStrength({ password = '' }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]
  const score = checks.filter(Boolean).length
  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong']

  return (
    <div className="password-strength" aria-live="polite">
      <progress value={score} max={checks.length} aria-label="Password strength" />
      <span>{labels[score]}</span>
    </div>
  )
}

export default PasswordStrength
