const Department = require('./models/department');
const db = require('./database');

async function testListDepartments() {
    try {
        console.log('Testing department listing...');
        
        // Direct database query
        const [rows] = await db.query('SELECT * FROM departments');
        console.log('Direct database query:', rows);
        
        // Model query
        const departments = await Department.findAll();
        console.log('Model query result:', departments);
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

testListDepartments();