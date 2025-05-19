const db = require('./database');

async function checkFullDatabase() {
    try {
        // 1. Check departments table structure
        console.log('=== DEPARTMENTS TABLE STRUCTURE ===');
        const [columns] = await db.query('DESCRIBE departments');
        columns.forEach(col => {
            console.log(`${col.Field}: ${col.Type} (${col.Null}) ${col.Key} ${col.Default || ''}`);
        });
        
        // 2. Check actual data in departments
        console.log('\n=== DEPARTMENTS DATA ===');
        const [departments] = await db.query('SELECT * FROM departments');
        console.log('Departments count:', departments.length);
        departments.forEach(dept => {
            console.log(`ID: ${dept.id}, Name: ${dept.name}, Status: ${dept.status}, Visibility: ${dept.visibility}`);
        });
        
        // 3. Check users table structure relevant to departments
        console.log('\n=== USERS TABLE (department_id column) ===');
        const [userColumns] = await db.query('DESCRIBE users');
        const deptColumn = userColumns.find(col => col.Field === 'department_id');
        console.log('department_id column:', deptColumn);
        
        // 4. Check teams table structure
        console.log('\n=== TEAMS TABLE STRUCTURE ===');
        try {
            const [teamColumns] = await db.query('DESCRIBE teams');
            const teamDeptColumn = teamColumns.find(col => col.Field === 'department_id');
            console.log('department_id column in teams:', teamDeptColumn);
        } catch (e) {
            console.log('Teams table might not exist:', e.message);
        }
        
        // 5. Check foreign key constraints
        console.log('\n=== FOREIGN KEY CONSTRAINTS ===');
        const [constraints] = await db.query(`
            SELECT 
                CONSTRAINT_NAME, 
                TABLE_NAME, 
                COLUMN_NAME, 
                REFERENCED_TABLE_NAME, 
                REFERENCED_COLUMN_NAME
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE()
            AND REFERENCED_TABLE_NAME = 'departments'
        `);
        console.log('Constraints referencing departments:');
        constraints.forEach(c => {
            console.log(`${c.TABLE_NAME}.${c.COLUMN_NAME} -> ${c.REFERENCED_TABLE_NAME}.${c.REFERENCED_COLUMN_NAME}`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkFullDatabase();