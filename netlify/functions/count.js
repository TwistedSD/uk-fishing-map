import { getStore } from "@netlify/blobs";

export const handler = async (event, context) => {
  const store = getStore("visits");
  let visitCount;

  try {
    visitCount = await store.get("count", { type: "json" }) || { count: 0 };
    visitCount.count += 1;
    await store.set("count", JSON.stringify(visitCount));
  } catch (error) {
    console.error("Failed to update visit count:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to update visit count.' }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(visitCount),
  };
};