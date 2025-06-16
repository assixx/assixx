const mysql = require('mysql2/promise');
const readline = require('readline');
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function connectToMySQL(user, password) {
  try {
    console.log(`Attempting to connect to MySQL with user: ${user}`);

    const connection = await mysql.createConnection({
      host: 'localhost',
      user,
      password,
    });

    console.log('✅ Connection successful!');

    // List databases
    const [dbs] = await connection.query('SHOW DATABASES');
    console.log('Databases available:');
    dbs.forEach((db) => console.log(` - ${db.Database}`));

    // Optionally connect to a specific database if it exists
    const assixxExists = dbs.some((db) => db.Database === 'main');
    if (assixxExists) {
      console.log('\nConnecting to assixx database...');
      await connection.query('USE assixx');

      // Show tables
      const [tables] = await connection.query('SHOW TABLES');
      console.log('Tables in assixx database:');
      if (tables.length === 0) {
        console.log(' - No tables found');
      } else {
        tables.forEach((table) => {
          const tableName = Object.values(table)[0];
          console.log(` - ${tableName}`);
        });
      }
    } else {
      console.log(
        '\nThe assixx database does not exist. Would you like to create it?'
      );
      console.log(
        'To create it, run these commands in the MySQL command line:'
      );
      console.log('  CREATE DATABASE assixx;');
      console.log('  USE assixx;');
    }

    await connection.end();
    return true;
  } catch (error) {
    console.error(`❌ Connection failed: ${error.message}`);
    return false;
  }
}

function updateEnvFile(user, password) {
  try {
    const fs = require('fs');
    const envPath = './.env';
    let envContent = fs.readFileSync(envPath, 'utf8');

    // Update the DB_USER and DB_PASSWORD values
    envContent = envContent.replace(/DB_USER=.*$/m, `DB_USER=${user}`);
    envContent = envContent.replace(
      /DB_PASSWORD=.*$/m,
      `DB_PASSWORD=${password}`
    );

    // Update USE_MOCK_DB to false
    envContent = envContent.replace(/USE_MOCK_DB=.*$/m, 'USE_MOCK_DB=false');

    fs.writeFileSync(envPath, envContent);
    console.log(
      '✅ .env file updated successfully with your MySQL credentials.'
    );
  } catch (error) {
    console.error('❌ Failed to update .env file:', error.message);
  }
}

function promptUser() {
  rl.question('Enter MySQL username (default: root): ', (user) => {
    user = user || 'root';

    rl.question('Enter MySQL password: ', async (password) => {
      const success = await connectToMySQL(user, password);

      if (success) {
        rl.question(
          'Do you want to update your .env file with these credentials? (y/n): ',
          (answer) => {
            if (answer.toLowerCase() === 'y') {
              updateEnvFile(user, password);
            }
            rl.close();
          }
        );
      } else {
        rl.question('Do you want to try again? (y/n): ', (answer) => {
          if (answer.toLowerCase() === 'y') {
            promptUser();
          } else {
            rl.close();
          }
        });
      }
    });
  });
}

console.log('MySQL Connection Test');
console.log('====================');
console.log(
  'This script will help you test your MySQL connection and update your .env file.'
);
promptUser();
