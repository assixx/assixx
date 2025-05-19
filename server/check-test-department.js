const db = require('./database');

async function checkTestDepartment() {
    try {
        console.log('=== SEARCHING FOR TEST DEPARTMENT ===');
        
        // 1. List all departments
        const [allDepts] = await db.query('SELECT * FROM departments ORDER BY id DESC');
        console.log('\nAll departments in database:');
        allDepts.forEach(dept => {
            console.log(`ID: ${dept.id}, Name: "${dept.name}", Created: ${dept.created_at}`);
        });
        
        // 2. Search specifically for "test" department
        const [testDepts] = await db.query("SELECT * FROM departments WHERE LOWER(name) LIKE '%test%'");
        console.log('\nDepartments with "test" in name:');
        if (testDepts.length === 0) {
            console.log('No departments found with "test" in the name');
        } else {
            testDepts.forEach(dept => {
                console.log(`ID: ${dept.id}, Name: "${dept.name}"`);
            });
        }
        
        // 3. Check recent department creations
        const [recentDepts] = await db.query(`
            SELECT * FROM departments 
            WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)
            ORDER BY created_at DESC
        `);
        console.log('\nDepartments created in last 24 hours:');
        recentDepts.forEach(dept => {
            console.log(`ID: ${dept.id}, Name: "${dept.name}", Created: ${dept.created_at}`);
        });
        
        // 4. Check for any transaction issues
        console.log('\n=== DATABASE CONNECTION INFO ===');
        const [dbInfo] = await db.query('SELECT DATABASE() as db, USER() as user');
        console.log('Database:', dbInfo[0].db);
        console.log('User:', dbInfo[0].user);
        
        // 5. Check if autocommit is on
        const [autocommit] = await db.query('SELECT @@autocommit as autocommit');
        console.log('Autocommit:', autocommit[0].autocommit === 1 ? 'ON' : 'OFF');
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkTestDepartment();