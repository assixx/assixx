const db = require('../../database');

async function checkSurvey() {
  try {
    // Find survey feature
    const [surveys] = await db.query(
      "SELECT * FROM features WHERE code LIKE '%survey%' OR name LIKE '%Umfrage%'"
    );
    console.log('Survey features found:', surveys.length);
    surveys.forEach((s) => {
      console.log(`- ID ${s.id}: ${s.code} - ${s.name} (${s.category})`);
    });

    // Check tenant 3 survey access
    if (surveys.length > 0) {
      const surveyId = surveys[0].id;
      const [tenantSurvey] = await db.query(
        `
        SELECT tf.*, f.code, f.name 
        FROM tenant_features tf
        JOIN features f ON tf.feature_id = f.id
        WHERE f.id = ? AND tf.tenant_id = 3
      `,
        [surveyId]
      );

      console.log('\nTenant 3 survey status:');
      if (tenantSurvey.length > 0) {
        console.log('- Status:', tenantSurvey[0].status);
        console.log('- Valid until:', tenantSurvey[0].valid_until);
      } else {
        console.log('- NOT ACTIVE');
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit();
}

checkSurvey();
