/**
 * Calculates the exact tenure difference between a start date and an end date (or today).
 *
 * @param {string|Date} joiningDateStr - The employee's Date of Joining.
 * @param {string|Date} [exitDateStr] - The employee's Date of Exit (optional).
 * @returns {Object} An object containing years, months, days, and an isNew flag.
 */
export function calculateTenure(joiningDateStr, exitDateStr) {
  if (!joiningDateStr) return { years: 0, months: 0, days: 0, isNew: true };

  const start = new Date(joiningDateStr);
  // Default to today if no exit date is provided
  const end = exitDateStr ? new Date(exitDateStr) : new Date();

  // Reset time to 00:00:00 for accurate day calculations
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  // If start is in the future or equal to today
  if (start >= end) {
    return { years: 0, months: 0, days: 0, isNew: true };
  }

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months--;
    // Get number of days in the previous month of the end date
    const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
    days += prevMonth.getDate();
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  return { years, months, days, isNew: years === 0 && months === 0 && days === 0 };
}

/**
 * Formats a tenure object into a human-readable string (e.g., "5 Years, 3 Months, 12 Days").
 *
 * @param {Object} tenureObj - Result from calculateTenure
 * @returns {string} Human readable tenure string
 */
export function formatTenure({ years, months, days }) {
  if (years === 0 && months === 0 && days === 0) return "Joined Today";

  const parts = [];
  if (years > 0) parts.push(`${years} Year${years !== 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} Month${months !== 1 ? 's' : ''}`);
  if (days > 0) parts.push(`${days} Day${days !== 1 ? 's' : ''}`);

  return parts.length > 0 ? parts.join(", ") : "0 Days";
}

/**
 * Returns the tenure represented as a decimal of years (e.g., "5.28 Years").
 *
 * @param {Object} tenureObj - Result from calculateTenure
 * @returns {string} Tenure in decimal years
 */
export function getTenureDecimals({ years, months, days }) {
  const totalMonths = (years * 12) + months + (days / 30.436875); // Avg days in a month
  const decimalYears = (totalMonths / 12).toFixed(2);
  return `${decimalYears} Years`;
}

/**
 * Calculates the next work anniversary date and the days remaining.
 *
 * @param {string|Date} joiningDateStr - The employee's Date of Joining.
 * @param {string|Date} [exitDateStr] - The employee's Date of Exit (optional).
 * @returns {Object|null} { date: Date, daysRemaining: number } or null if exited/invalid.
 */
export function getNextAnniversary(joiningDateStr, exitDateStr) {
  if (!joiningDateStr || exitDateStr) return null; // No anniversary for exited employees

  const start = new Date(joiningDateStr);
  const today = new Date();
  
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);

  // If joining date is in the future, the next anniversary is the joining date itself
  if (start > today) {
    const diffTime = Math.abs(start - today);
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return { date: start, daysRemaining, isFirstDay: true };
  }

  // Calculate this year's anniversary
  const thisYearAnniv = new Date(today.getFullYear(), start.getMonth(), start.getDate());
  thisYearAnniv.setHours(0, 0, 0, 0);

  let nextAnniv = thisYearAnniv;
  
  if (thisYearAnniv < today) {
    // If the anniversary already passed this year, it will be next year
    nextAnniv = new Date(today.getFullYear() + 1, start.getMonth(), start.getDate());
    nextAnniv.setHours(0, 0, 0, 0);
  }

  const diffTime = Math.abs(nextAnniv - today);
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return { date: nextAnniv, daysRemaining, isFirstDay: false };
}

/**
 * Returns a milestone badge title based on completed years of service.
 *
 * @param {number} years - Completed years of service.
 * @returns {string} Milestone title
 */
export function getServiceMilestone(years) {
  if (years >= 15) return "15+ Years Service";
  if (years >= 10) return "10 Years Service";
  if (years >= 5) return "5 Years Service";
  if (years >= 3) return "3 Years Service";
  if (years >= 1) return "1 Year Service";
  return "New Employee";
}
