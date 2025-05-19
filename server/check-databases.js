const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDatabases() {
    let connection;
    
    try {
        // First connect without database
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD
        });
        
        console.log('Connected to MySQL server');
        
        // List all databases
        const [databases] = await connection.query('SHOW DATABASES');
        console.log('\n=== Available Databases ===');
        databases.forEach(db => {
            console.log(`- ${db.Database}`);
        });
        
        // Check if assixx database exists
        const hasAssixx = databases.some(db => db.Database === 'assixx');
        console.log('\nDatabase "assixx" exists:', hasAssixx);
        
        // Check departments table in lohnabrechnung
        console.log('\n=== Checking departments table in lohnabrechnung ===');
        await connection.query('USE lohnabrechnung');
        const [tables1] = await connection.query('SHOW TABLES');
        const hasDeptsInLohn = tables1.some(t => Object.values(t)[0] === 'departments');
        console.log('Departments table in lohnabrechnung:', hasDeptsInLohn);
        
        if (hasAssixx) {
            // Check departments table in assixx
            console.log('\n=== Checking departments table in assixx ===');
            await connection.query('USE assixx');
            const [tables2] = await connection.query('SHOW TABLES');
            const hasDeptsInAssixx = tables2.some(t => Object.values(t)[0] === 'departments');
            console.log('Departments table in assixx:', hasDeptsInAssixx);
            
            if (hasDeptsInAssixx) {
                const [depts] = await connection.query('SELECT * FROM departments');
                console.log('Departments in assixx:', depts.length);
                depts.forEach(dept => {
                    console.log(`  - ${dept.name}`);
                });
            }
        }
        
        console.log('\n=== RECOMMENDATION ===');
        if (hasAssixx) {
            console.log('You should change DB_NAME in .env from "lohnabrechnung" to "assixx"');
        } else {
            console.log('The application is using the correct database (lohnabrechnung)');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

checkDatabases().catch(console.error);