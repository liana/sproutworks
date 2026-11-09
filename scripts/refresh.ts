// Starts the morning check on a running dev server: npm run refresh
const base = process.env.SPROUT_URL ?? "http://127.0.0.1:3000";
const res = await fetch(`${base}/api/refresh`, { method: "POST" });
console.log(res.status, await res.text());
export {};
