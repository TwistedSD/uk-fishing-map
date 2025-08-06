// This function uses Netlify Blobs to get and increment a visit counter.
import { getStore } from "@netlify/blobs";

export const handler = async () => {
  // Get the blob store named 'visit_counts'
  const store = getStore("visit_counts");

  try {
    // Get the current count for the key 'site_visits'
    let count = await store.get("site_visits", { type: "json" });

    // If it's the first visit, the count will be null. Start at 1.
    // Otherwise, increment the existing count.
    const newCount = (count === null) ? 1 : count + 1;

    // Save the new count back to the store
    await store.setJSON("site_visits", newCount);

    // Return the new count so the frontend can display it
    return {
      statusCode: 200,
      body: JSON.stringify({ count: newCount }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not process visit count." }),
    };
  }
};