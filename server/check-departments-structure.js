const db = require('./database');

async function checkDepartmentsStructure() {
    try {
        // Check table structure
        const [columns] = await db.query('DESCRIBE departments');
        console.log('Departments table structure:');
        console.log(columns);
        
        // Check if status and visibility columns exist
        const hasStatus = columns.some(col => col.Field === 'status');
        const hasVisibility = columns.some(col => col.Field === 'visibility');
        
        console.log('\nStatus column exists:', hasStatus);
        console.log('Visibility column exists:', hasVisibility);
        
        if (!hasStatus || !hasVisibility) {
            console.log('\nMissing columns! Run the update script:');
            console.log('node /home/scs/projects/Assixx/server/scripts/update-departments-db.js');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkDepartmentsStructure();