const Department = require('./models/department');
const db = require('./database');
const logger = require('./utils/logger');

async function testCreateDepartment() {
    try {
        console.log('Testing department creation...');
        
        const testData = {
            name: 'Test Abteilung',
            description: 'Eine Test-Abteilung',
            manager_id: null,
            parent_id: null,
            status: 'active',
            visibility: 'public'
        };
        
        console.log('Creating department with data:', testData);
        const departmentId = await Department.create(testData);
        
        console.log('Department created with ID:', departmentId);
        
        // Verify it was created
        const department = await Department.findById(departmentId);
        console.log('Retrieved department:', department);
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

testCreateDepartment();