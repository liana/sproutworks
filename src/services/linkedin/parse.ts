// Parses LinkedIn's official data export. Pure: no database, no network.
import Papa from "papaparse";
import JSZip from "jszip";

export type Connection = {
  firstName: string;
  lastName: string;
  profileUrl: string;
  company: string | null;
  title: string | null;
  connectedOn: Date;
};

export type Position = { company: string; title: string; description: string | null; startedOn: string | null; finishedOn: string | null };
export type Education = { school: string; degree: string | null; startedOn: string | null; finishedOn: string | null };
export type ParsedProfile = {
  firstName: string;
  lastName: string;
  headline: string | null;
  summary: string | null;
  website: string | null;
  positions: Position[];
  skills: string[];
  education: Education[];
};

export type ParsedArchive = { connections: Connection[]; profile: ParsedProfile };

export class ArchiveError extends Error {}

const REQUIRED = ["Connections.csv", "Profile.csv", "Positions.csv"] as const;

type Row = Record<string, string>;

// LinkedIn puts a few "Notes:" lines above the real header in Connections.csv.
function rowsFrom(csv: string, headerStartsWith: string): Row[] {
  const lines = csv.replace(/^﻿/, "").split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(headerStartsWith));
  if (start === -1) throw new ArchiveError(`Couldn't find the "${headerStartsWith}" header row.`);
  const parsed = Papa.parse<Row>(lines.slice(start).join("\n"), { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });
  return parsed.data;
}

const blank = (v: string | undefined): string | null => (v && v.trim() ? v.trim() : null);

// "08 Nov 2026" → Date (UTC midnight). Invalid dates fall back to the epoch so a bad row can't crash an import.
export function parseConnectedOn(value: string): Date {
  const d = new Date(`${value.trim()} UTC`);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

export function parseConnections(csv: string): Connection[] {
  return rowsFrom(csv, "First Name")
    .filter((r) => blank(r["URL"]))
    .map((r) => ({
      firstName: r["First Name"]?.trim() ?? "",
      lastName: r["Last Name"]?.trim() ?? "",
      profileUrl: r["URL"].trim(),
      company: blank(r["Company"]),
      title: blank(r["Position"]),
      connectedOn: parseConnectedOn(r["Connected On"] ?? ""),
      // "Email Address" is deliberately never read.
    }));
}

export function parseProfile(files: { profile: string; positions: string; skills?: string; education?: string }): ParsedProfile {
  const p = rowsFrom(files.profile, "First Name")[0] ?? {};
  const website = blank(p["Websites"])?.replace(/^\[?[A-Z]+:/, "").replace(/\]$/, "").split(",")[0]?.trim() ?? null;
  return {
    firstName: p["First Name"]?.trim() ?? "",
    lastName: p["Last Name"]?.trim() ?? "",
    headline: blank(p["Headline"]),
    summary: blank(p["Summary"]),
    website,
    positions: rowsFrom(files.positions, "Company Name").map((r) => ({
      company: r["Company Name"]?.trim() ?? "",
      title: r["Title"]?.trim() ?? "",
      description: blank(r["Description"]),
      startedOn: blank(r["Started On"]),
      finishedOn: blank(r["Finished On"]),
    })),
    skills: files.skills ? rowsFrom(files.skills, "Name").map((r) => r["Name"]?.trim()).filter((s): s is string => !!s) : [],
    education: files.education
      ? rowsFrom(files.education, "School Name").map((r) => ({
          school: r["School Name"]?.trim() ?? "",
          degree: blank(r["Degree Name"]),
          startedOn: blank(r["Start Date"]),
          finishedOn: blank(r["End Date"]),
        }))
      : [],
  };
}

// Reads the ZIP and checks every required file is there before anything is parsed.
export async function readArchive(zipBytes: ArrayBuffer | Uint8Array): Promise<ParsedArchive> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBytes);
  } catch {
    throw new ArchiveError("That file isn't a ZIP. Upload the archive LinkedIn emailed you.");
  }
  const byName = new Map<string, JSZip.JSZipObject>();
  zip.forEach((path, file) => { if (!file.dir) byName.set(path.split("/").pop()!, file); });
  const missing = REQUIRED.filter((n) => !byName.has(n));
  if (missing.length) throw new ArchiveError(`This archive is missing ${missing.join(", ")}. Request the larger data archive from LinkedIn.`);
  const text = (n: string) => byName.get(n)?.async("string") ?? Promise.resolve(undefined);
  const [connections, profile, positions, skills, education] = await Promise.all(
    ["Connections.csv", "Profile.csv", "Positions.csv", "Skills.csv", "Education.csv"].map(text),
  );
  return {
    connections: parseConnections(connections!),
    profile: parseProfile({ profile: profile!, positions: positions!, skills, education }),
  };
}
