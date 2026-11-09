// Minimal robots.txt check for the "*" group: is a path allowed? Pure.
export function robotsAllows(robotsTxt: string, path: string): boolean {
  const lines = robotsTxt.split(/\r?\n/).map((l) => l.replace(/#.*/, "").trim());
  let inStar = false; const rules: { allow: boolean; prefix: string }[] = [];
  for (const line of lines) {
    const [k, ...rest] = line.split(":"); const v = rest.join(":").trim(); const key = k?.toLowerCase();
    if (key === "user-agent") inStar = v === "*";
    else if (inStar && (key === "disallow" || key === "allow") && v) rules.push({ allow: key === "allow", prefix: v.replace(/\*$/, "") });
  }
  const hit = rules.filter((r) => path.startsWith(r.prefix)).sort((a, b) => b.prefix.length - a.prefix.length)[0];
  return hit ? hit.allow : true;
}
