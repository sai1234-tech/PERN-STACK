
export const validateName = (name) => {
  const value = name.trim();

  if (!value) {
    return "Name is required";
  }

  if (value.length < 3) {
    return "Name must be at least 3 characters";
  }

  if (value.length > 30) {
    return "Name cannot exceed 30 characters";
  }

  return "";
};

export const validateEmail = (email) => {
  const value = email.trim();

  if (!value) {
    return "Email is required";
  }

const emailRegex =
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

  if (!emailRegex.test(value)) {
    return "Enter a valid email address";
  }

  return "";
};

export const validatePassword = (password) => {
  if (!password) {
    return "Password is required";
  }

  if (password.length < 6) {
    return "Password must be at least 6 characters";
  }

  if (password.length > 20) {
    return "Password cannot exceed 20 characters";
  }

  return "";
};

export const validateConfirmPassword = (
  password,
  confirmPassword
) => {
  if (!confirmPassword) {
    return "Please confirm your password";
  }

  if (password !== confirmPassword) {
    return "Passwords do not match";
  }

  return "";
};

export const validatePhone = (phone) => {
  if (!phone) {
    return "";
  }

  const phoneRegex = /^[0-9]{10}$/;

  if (!phoneRegex.test(phone)) {
    return "Phone number must contain 10 digits";
  }

  return "";
};