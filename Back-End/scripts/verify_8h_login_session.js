import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import generateJwt from '../utils/generateJwt.js';
dotenv.config();

async function verify8HourLoginSession() {
    console.log("================================================================================");
    console.log("             VERIFYING STRICT 8-HOUR LOGIN SESSION DURATION                     ");
    console.log("================================================================================");

    const secret = process.env.JWT_SECRET || 'pern_hrms_secret_jwt_key_2026!@#';

    // 1. Check generated JWT expiry
    const token = generateJwt(15, 'admin');
    const decoded = jwt.decode(token);

    console.log("1. Inspecting generated JWT token payload:");
    console.log(`   - Issued At (iat):  ${new Date(decoded.iat * 1000).toISOString()}`);
    console.log(`   - Expires At (exp): ${new Date(decoded.exp * 1000).toISOString()}`);
    
    const durationSeconds = decoded.exp - decoded.iat;
    const durationHours = durationSeconds / 3600;
    console.log(`   - Calculated Duration: ${durationSeconds} seconds (${durationHours} hours)`);

    if (durationSeconds === 28800 && durationHours === 8) {
        console.log("   ✓ JWT token duration is EXACTLY 8 hours (28,800 seconds).");
    } else {
        throw new Error(`Token duration was ${durationHours} hours instead of 8 hours!`);
    }

    // 2. Test actual /api/auth/login endpoint
    console.log("\n2. Testing live /api/auth/login endpoint response:");
    try {
        const loginRes = await fetch("http://localhost:5005/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "admin@hrms.com",
                password: "Password@123"
            })
        });

        const data = await loginRes.json();
        console.log(`   - Login Status: HTTP ${loginRes.status}`);
        console.log(`   - Declared expiresIn: ${data.expiresIn}`);
        console.log(`   - Declared maxSessionDurationMs: ${data.maxSessionDurationMs} ms (${data.maxSessionDurationMs / 3600000} hours)`);

        const loginTokenDecoded = jwt.decode(data.token);
        const loginDuration = (loginTokenDecoded.exp - loginTokenDecoded.iat) / 3600;
        console.log(`   - Token verified exp - iat: ${loginDuration} hours`);

        if (loginRes.ok && data.expiresIn === "8h" && data.maxSessionDurationMs === 28800000 && loginDuration === 8) {
            console.log("   ✓ Live login response strictly enforces 8-hour session duration.");
        } else {
            throw new Error("Live login endpoint did not enforce 8-hour duration correctly.");
        }
    } catch (apiErr) {
        console.error("Login endpoint check error:", apiErr.message);
        throw apiErr;
    }

    // 3. Test token expired beyond 8 hours
    console.log("\n3. Testing rejected expired token (> 8 hours):");
    const expiredToken = jwt.sign(
        { userId: 15, role: 'admin' },
        secret,
        { expiresIn: '-1s' } // already expired
    );

    const verifyRes = await fetch("http://localhost:5005/api/v1/employees/me", {
        headers: { "Authorization": `Bearer ${expiredToken}` }
    });

    console.log(`   - Expired token request HTTP Status: ${verifyRes.status} (Expected 401)`);
    if (verifyRes.status === 401) {
        console.log("   ✓ Server correctly rejects expired session with HTTP 401.");
    } else {
        throw new Error(`Expected 401 but got ${verifyRes.status}`);
    }

    console.log("\n================================================================================");
    console.log("RESULT: STRICT 8-HOUR MAXIMUM LOGIN DURATION IS FULLY ENFORCED ACROSS THE STACK!");
    console.log("================================================================================\n");
    process.exit(0);
}

verify8HourLoginSession().catch(err => {
    console.error("Verification failed:", err);
    process.exit(1);
});
