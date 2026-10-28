import pool from '../config/db.js';

async function seed() {
  const rateCards = [
    {
      client_id: 4,
      project_id: 5,
      client_name: 'ABC Technologies Pvt Ltd',
      project_name: 'HMRS Application Development',
      sow_number: 'SOW-2026-HRMS-004',
      role_title: 'Software Engineer',
      hourly_billing_rate: 65.00,
      monthly_billing_rate: 10400.00,
      currency: 'USD',
      effective_date: '2026-10-01'
    },
    {
      client_id: 4,
      project_id: 5,
      client_name: 'ABC Technologies Pvt Ltd',
      project_name: 'HMRS Application Development',
      sow_number: 'SOW-2026-HRMS-004',
      role_title: 'Team Manager / Technical Lead',
      hourly_billing_rate: 95.00,
      monthly_billing_rate: 15200.00,
      currency: 'USD',
      effective_date: '2026-10-01'
    },
    {
      client_id: 1,
      project_id: 4,
      client_name: 'Microsoft Enterprise Services',
      project_name: 'Azure Cloud Modernization SOW-1',
      sow_number: 'SOW-2026-AZURE-01',
      role_title: 'Lead Cloud Architect',
      hourly_billing_rate: 135.00,
      monthly_billing_rate: 21600.00,
      currency: 'USD',
      effective_date: '2026-10-15'
    },
    {
      client_id: 1,
      project_id: 4,
      client_name: 'Microsoft Enterprise Services',
      project_name: 'Azure Cloud Modernization SOW-1',
      sow_number: 'SOW-2026-AZURE-01',
      role_title: 'Senior DevOps & Infrastructure Engineer',
      hourly_billing_rate: 105.00,
      monthly_billing_rate: 16800.00,
      currency: 'USD',
      effective_date: '2026-10-15'
    }
  ];

  for (const rc of rateCards) {
    const res = await pool.query(
      `INSERT INTO client_rate_cards (
        client_id, project_id, client_name, project_name, sow_number,
        role_title, hourly_billing_rate, monthly_billing_rate, currency, effective_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, role_title, hourly_billing_rate, monthly_billing_rate, currency;`,
      [
        rc.client_id, rc.project_id, rc.client_name, rc.project_name, rc.sow_number,
        rc.role_title, rc.hourly_billing_rate, rc.monthly_billing_rate, rc.currency, rc.effective_date
      ]
    );
    console.log('Inserted rate card:', res.rows[0]);
  }

  await pool.end();
  console.log('Commercial rate-cards created successfully.');
}

seed().catch(err => {
  console.error('Error seeding rate cards:', err);
  process.exit(1);
});
