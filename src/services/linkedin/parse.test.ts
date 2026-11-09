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

test("either LinkedIn installment imports on its own", async () => {
  const first = new JSZip();
  first.file("Profile.csv", "First Name,Last Name,Headline\nFixture,User,Product leader\n");
  first.file("Positions.csv", "Company Name,Title,Description,Location,Started On,Finished On\nKestrel,Engineer,,,2014,\n");
  const a = await readArchive(await first.generateAsync({ type: "uint8array" }));
  assert.equal(a.connections, null);
  assert.equal(a.profile?.positions[0].company, "Kestrel");
  const second = new JSZip();
  second.file("Connections.csv", CONNECTIONS);
  const b = await readArchive(await second.generateAsync({ type: "uint8array" }));
  assert.equal(b.connections?.length, 2);
  assert.equal(b.profile, null);
});

test("rejects a ZIP with neither part", async () => {
  const zip = new JSZip();
  zip.file("Invitations.csv", "x");
  await assert.rejects(readArchive(await zip.generateAsync({ type: "uint8array" })), ArchiveError);
});

test("rejects a file that isn't a ZIP", async () => {
  await assert.rejects(readArchive(new TextEncoder().encode("hello")), ArchiveError);
});
