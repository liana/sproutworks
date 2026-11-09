import { test } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { parseConnections, readArchive, ArchiveError } from "./parse.ts";

const CONNECTIONS = `Notes:
"When exporting your connection data, you may notice that some of the email addresses are missing."

First Name,Last Name,URL,Email Address,Company,Position,Connected On
Priya,Raman,https://www.linkedin.com/in/priya-raman-test,priya@example.com,Lumen Health,"VP, Product",02 Mar 2020
Sam,Whitley,https://www.linkedin.com/in/sam-whitley-test,,Lumen Health,Account Executive,15 Sep 2026
,,,,,,
`;

test("skips the notes preamble and keeps quoted commas in titles", () => {
  const rows = parseConnections(CONNECTIONS);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].title, "VP, Product");
  assert.equal(rows[0].connectedOn.toISOString().slice(0, 10), "2020-03-02");
});

test("never keeps email addresses", () => {
  const rows = parseConnections(CONNECTIONS);
  assert.ok(rows.every((r) => !("email" in r) && !JSON.stringify(r).includes("@example.com")));
});

test("rejects an archive missing required files, naming them", async () => {
  const zip = new JSZip();
  zip.file("Connections.csv", CONNECTIONS);
  const bytes = await zip.generateAsync({ type: "uint8array" });
  await assert.rejects(readArchive(bytes), (e: unknown) => e instanceof ArchiveError && /Profile\.csv, Positions\.csv/.test(e.message));
});

test("rejects a file that isn't a ZIP", async () => {
  await assert.rejects(readArchive(new TextEncoder().encode("hello")), ArchiveError);
});
