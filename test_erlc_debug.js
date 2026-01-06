// Using native fetch

const API_KEY = 'ARuRfmzZGTqbqUCjMERA-dzEeGLbRfisfjKtiCOXLHATXDedYZsQQEethQMZp';
const BASE_URL = 'https://api.policeroleplay.community/v1';

async function testConnection() {
    console.log('Testing ERLC API Connection...');
    try {
        const response = await fetch(`${BASE_URL}/server`, {
            headers: { 'Server-Key': API_KEY }
        });

        console.log(`Status Code: ${response.status}`);

        if (!response.ok) {
            console.error(`Error Text: ${await response.text()}`);
            return;
        }

        const data = await response.json();
        console.log('Success! Data received:');
        console.log(JSON.stringify(data, null, 2));

        // Test Players Endpoint
        console.log('\nTesting /server/players...');
        const pResponse = await fetch(`${BASE_URL}/server/players`, {
            headers: { 'Server-Key': API_KEY }
        });
        if (pResponse.ok) {
            const pData = await pResponse.json();
            if (pData.length > 0) {
                console.log('First Player Keys:', Object.keys(pData[0]));
                console.log('First Player Entry:', pData[0]);
            }
        } else {
            console.log('Players Endpoint Failed:', pResponse.status);
        }

    } catch (error) {
        console.error('Fetch Error:', error);
    }
}

testConnection();
