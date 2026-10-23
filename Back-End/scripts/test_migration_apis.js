import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

async function testMigrationEndpoints() {
    const token = jwt.sign(
        { userId: 20, email: 'anilk@quadratics.com', role: 'admin' },
        process.env.JWT_SECRET || 'default_jwt_secret',
        { expiresIn: '1h' }
    );

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    console.log("Testing Data Migration API Endpoints on http://localhost:5005...");

    try {
        // 1. GET /api/v1/data-migration/sources
        const srcRes = await fetch("http://localhost:5005/api/v1/data-migration/sources", { headers });
        const srcData = await srcRes.json();
        console.log(`1. GET /sources: HTTP ${srcRes.status} | Total: ${srcData.totalSources}`);

        // 2. GET /api/v1/data-migration/field-mappings
        const mapRes = await fetch("http://localhost:5005/api/v1/data-migration/field-mappings", { headers });
        const mapData = await mapRes.json();
        console.log(`2. GET /field-mappings: HTTP ${mapRes.status} | Total: ${mapData.totalMappings}`);

        // 3. GET /api/v1/data-migration/sample-preview
        const prevRes = await fetch("http://localhost:5005/api/v1/data-migration/sample-preview", { headers });
        const prevData = await prevRes.json();
        console.log(`3. GET /sample-preview: HTTP ${prevRes.status} | Raw: ${prevData.counts?.rawEmployees}, Dups: ${prevData.duplicatesDetected?.length}, Errors: ${prevData.validationErrors?.length}`);

        // 4. GET /api/v1/data-migration/jobs
        const jobsRes = await fetch("http://localhost:5005/api/v1/data-migration/jobs", { headers });
        const jobsData = await jobsRes.json();
        console.log(`4. GET /jobs: HTTP ${jobsRes.status} | Jobs Count: ${jobsData.jobs?.length}`);

        if (srcRes.ok && mapRes.ok && prevRes.ok && jobsRes.ok) {
            console.log("✓ ALL DATA MIGRATION API ENDPOINTS RESPONDING HEALTHILY!");
            process.exit(0);
        } else {
            console.error("API endpoint returned non-200 status");
            process.exit(1);
        }
    } catch (err) {
        console.error("API test failed:", err);
        process.exit(1);
    }
}

testMigrationEndpoints();
