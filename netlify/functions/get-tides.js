import fetch from 'node-fetch';

export const handler = async function(event, context) {
    const { stationId, days } = event.queryStringParameters;
    const API_KEY = process.env.ADMIRALTY_API_KEY;
    const API_URL = `https://admiraltyapi.azure-api.net/uktidalapi/api/V1/Stations/${stationId}/TidalEvents?duration=${days}`;

    try {
        const response = await fetch(API_URL, {
            headers: {
                'Ocp-Apim-Subscription-Key': API_KEY
            }
        });

        if (!response.ok) {
            return {
                statusCode: response.status,
                body: `Failed to fetch tidal events: ${response.statusText}`
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
            body: JSON.stringify({ error: 'An error occurred while fetching tidal events.' })
        };
    }
};