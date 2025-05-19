const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');

async function testAPIAuth() {
    // Login first to get token
    const loginResponse = await fetch('http://localhost:3000/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email: 'localhost.washboard010@passmail.net',
            password: 'admin123'
        })
    });
    
    const loginData = await loginResponse.json();
    console.log('Login response:', loginData);
    
    if (loginData.token) {
        // Decode the token to see its contents
        const decoded = jwt.decode(loginData.token);
        console.log('Token decoded:', decoded);
        
        // Test departments API
        const departmentsResponse = await fetch('http://localhost:3000/departments', {
            headers: {
                'Authorization': `Bearer ${loginData.token}`
            }
        });
        
        console.log('Departments response status:', departmentsResponse.status);
        
        if (departmentsResponse.ok) {
            const departments = await departmentsResponse.json();
            console.log('Departments:', departments);
        } else {
            const error = await departmentsResponse.text();
            console.log('Error:', error);
        }
    }
}

testAPIAuth().catch(console.error);