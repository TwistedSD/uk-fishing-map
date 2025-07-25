// This is a serverless function that will run on Netlify.
// It securely fetches the list of tide stations from the ADMIRALTY API.

const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    const API_KEY = process.env.ADMIRALTY_API_KEY;
    const API_URL = 'https://admiraltyapi.azure-api.net/uktidalapi/api/V1/Stations';

    try {
        const response = await fetch(API_URL, {
            headers: {
                'Ocp-Apim-Subscription-Key': API_KEY
            }
        });

        if (!response.ok) {
            return {
                statusCode: response.status,
                body: `Failed to fetch stations: ${response.statusText}`
            };
        }

        const data = await response.json();

        return {
            statusCode: 200,
            body: JSON.stringify(data)
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'An error occurred while fetching tide stations.' })
        };
    }
};
