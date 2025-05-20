const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
  console.log('Testing different MySQL connection methods...');
  
  // Connection options to try
  const options = [
    { name: 'Default .env config', config: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
      }
    },
    { name: 'Root without password', config: {
        host: 'localhost',
        user: 'root'
      }
    },
    { name: 'Root with standard password', config: {
        host: 'localhost',
        user: 'root',
        password: 'password'
      }
    },
    { name: 'Root with empty password', config: {
        host: 'localhost',
        user: 'root',
        password: ''
      }
    },
    { name: 'Socket connection', config: {
        socketPath: '/var/run/mysqld/mysqld.sock',
        user: 'root'
      }
    },
    { name: 'Default MySQL account', config: {
        host: 'localhost',
        user: 'mysql'
      }
    }
  ];
  
  for (const option of options) {
    try {
      console.log(`\n----- Trying: ${option.name} -----`);
      console.log('Connection details:', JSON.stringify(option.config, null, 2));
      
      const connection = await mysql.createConnection(option.config);
      console.log('✅ Connection successful!');
      
      // List databases
      const [dbs] = await connection.query('SHOW DATABASES');
      console.log('Databases available:');
      dbs.forEach(db => console.log(` - ${db.Database}`));
      
      await connection.end();
    } catch (error) {
      console.log(`❌ Connection failed: ${error.message}`);
    }
  }
}

testConnection().catch(console.error);