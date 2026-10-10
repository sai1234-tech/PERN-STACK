import { calculateTenure, formatTenure, getNextAnniversary } from "./src/utils/tenureUtils.js";

const today = new Date();
today.setHours(0,0,0,0);
console.log("Today:", today.toISOString());

const tests = [
    { name: "Joined today", join: today },
    { name: "Joined 1 year ago", join: new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()) },
    { name: "Joined 5 years, 3 months, 12 days ago", join: new Date(today.getFullYear() - 5, today.getMonth() - 3, today.getDate() - 12) },
    { name: "Leap year test (Feb 29, 2020)", join: new Date(2020, 1, 29) },
    { name: "Future date", join: new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()) },
];

tests.forEach(t => {
    const tenure = calculateTenure(t.join);
    const anniv = getNextAnniversary(t.join);
    console.log(`\nTest: ${t.name} (Join: ${t.join.toISOString().split('T')[0]})`);
    console.log(`Tenure Object:`, tenure);
    console.log(`Formatted:`, formatTenure(tenure));
    if (anniv) {
        console.log(`Next Anniversary: ${anniv.date.toISOString().split('T')[0]} (${anniv.daysRemaining} days remaining)`);
    } else {
        console.log(`Next Anniversary: None`);
    }
});
