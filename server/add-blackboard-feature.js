// Skript zum Hinzufügen des Blackboard-Features zur Datenbank
const db = require('./database');
// const logger = require('./utils/logger');

async function addBlackboardFeature() {
  try {
    console.log('Connecting to database...');

    // Prüfen, ob das Feature bereits existiert
    const [existingFeature] = await db.query(
      'SELECT * FROM features WHERE code = ?',
      ['blackboard_system']
    );

    if (existingFeature.length > 0) {
      console.log('Blackboard feature already exists, updating...');

      // Update the existing feature
      await db.query(`
        UPDATE features 
        SET 
          name = 'Blackboard-System',
          description = 'Digitales schwarzes Brett für firmenweite, abteilungs- und teamspezifische Ankündigungen.',
          category = 'premium',
          base_price = 15.00,
          is_active = 1
        WHERE code = 'blackboard_system'
      `);

      console.log('Blackboard feature updated successfully!');
    } else {
      console.log('Adding new blackboard feature...');

      // Neues Feature hinzufügen
      await db.query(`
        INSERT INTO features (
          code, 
          name, 
          description, 
          category, 
          base_price,
          is_active
        ) VALUES (
          'blackboard_system',
          'Blackboard-System',
          'Digitales schwarzes Brett für firmenweite, abteilungs- und teamspezifische Ankündigungen.',
          'premium',
          15.00,
          1
        )
      `);

      console.log('Blackboard feature added successfully!');
    }

    // Alle Features anzeigen
    const [allFeatures] = await db.query('SELECT * FROM features');
    console.log('All features in database:');
    allFeatures.forEach((feature) => {
      console.log(`- ${feature.code}: ${feature.name} (${feature.category})`);
    });
  } catch (error) {
    console.error('Error adding blackboard feature:', error.message);
  } finally {
    await db.end();
  }
}

// Skript ausführen
addBlackboardFeature();
