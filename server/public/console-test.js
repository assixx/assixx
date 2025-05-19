// Kopieren Sie diesen Code und führen Sie ihn in der Browser-Konsole aus

// Test 1: Check Token
console.log('=== Token Check ===');
const token = localStorage.getItem('token');
console.log('Token exists:', !!token);
console.log('Token:', token);

// Test 2: Direct API Call
console.log('\n=== Direct API Call ===');
fetch('/departments', {
    headers: { 'Authorization': `Bearer ${token}` }
})
.then(response => {
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    return response.json();
})
.then(data => {
    console.log('Departments:', data);
    console.log('Count:', data.length);
    data.forEach(dept => {
        console.log(`- ${dept.name} (ID: ${dept.id})`);
    });
})
.catch(error => {
    console.error('Error:', error);
});

// Test 3: Check DOM
console.log('\n=== DOM Check ===');
const elements = {
    'department-list': document.getElementById('department-list'),
    'department-count': document.getElementById('department-count'),
    'departments-table-body': document.getElementById('departments-table-body')
};

Object.entries(elements).forEach(([id, elem]) => {
    console.log(`${id}:`, elem ? 'Found' : 'Not found');
    if (elem) {
        console.log(`  Content: "${elem.innerHTML.substring(0, 50)}..."`);
    }
});

// Test 4: Create and load department
console.log('\n=== Test Create & Load ===');
async function testCreateAndLoad() {
    try {
        // Create
        const createResponse = await fetch('/departments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name: `Console Test ${Date.now()}`,
                description: 'Created from console',
                status: 'active',
                visibility: 'public'
            })
        });
        
        console.log('Create response:', createResponse.status);
        const createResult = await createResponse.json();
        console.log('Create result:', createResult);
        
        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Load
        const loadResponse = await fetch('/departments', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const departments = await loadResponse.json();
        console.log('After create - departments:', departments.length);
        const newest = departments[departments.length - 1];
        console.log('Newest department:', newest);
        
    } catch (error) {
        console.error('Test error:', error);
    }
}

// Uncomment to run
// testCreateAndLoad();