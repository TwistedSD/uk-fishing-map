import { getStore } from "@netlify/blobs";

export const handler = async (event, context) => {
    try {
        const store = getStore("visits");
        let visitCount = await store.get("count", { type: "json" }) || { count: 0 };
        visitCount.count += 1;
        await store.set("count", JSON.stringify(visitCount));

        return {
            statusCode: 200,
            body: JSON.stringify(visitCount),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to update visit count.' }),
        };
    }
};