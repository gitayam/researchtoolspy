// Debug script to test the exact login flow
console.log('Starting login flow debug test...');

const testHash = "1234567890123456";
const apiUrl = 'http://localhost:8000/api/v1';

async function debugLoginFlow() {
    console.log('\n=== STEP 1: Test Direct API Call ===');
    try {
        const response = await fetch(`${apiUrl}/hash-auth/authenticate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ account_hash: testHash })
        });
        
        const data = await response.json();
        console.log('✅ Direct API call successful');
        console.log('Response:', {
            status: response.status,
            hasAccessToken: !!data.access_token,
            role: data.role,
            accountHash: data.account_hash
        });
        
        // Store the token for next test
        const tokens = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            token_type: data.token_type,
            expires_in: data.expires_in
        };
        
        console.log('\n=== STEP 2: Test /auth/me with token ===');
        const userResponse = await fetch(`${apiUrl}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${data.access_token}`
            }
        });
        
        if (userResponse.ok) {
            const userData = await userResponse.json();
            console.log('✅ /auth/me successful');
            console.log('User data:', userData);
        } else {
            console.error('❌ /auth/me failed:', userResponse.status);
        }
        
        console.log('\n=== STEP 3: Simulate localStorage storage ===');
        localStorage.setItem('omnicore_tokens', JSON.stringify(tokens));
        console.log('✅ Tokens stored in localStorage');
        
        // Verify storage
        const storedTokens = localStorage.getItem('omnicore_tokens');
        console.log('Stored tokens:', storedTokens ? JSON.parse(storedTokens) : null);
        
    } catch (error) {
        console.error('❌ API test failed:', error);
    }
}

debugLoginFlow();