// Imports the invented LinkedIn archive into a running dev server: npm run seed:fixtures
import { readFile, readdir } from "node:fs/promises";
import JSZip from "jszip";

const dir = new URL("../test/fixtures/linkedin/", import.meta.url);
const zip = new JSZip();
for (const name of await readdir(dir)) zip.file(name, await readFile(new URL(name, dir), "utf8"));
const bytes = await zip.generateAsync({ type: "arraybuffer" });
const form = new FormData();
form.append("archive", new File([bytes], "Fixture_LinkedInDataExport.zip", { type: "application/zip" }));
const base = process.env.SPROUT_URL ?? "http://127.0.0.1:3000";
const res = await fetch(`${base}/api/import`, { method: "POST", body: form });
console.log(res.status, await res.text());
