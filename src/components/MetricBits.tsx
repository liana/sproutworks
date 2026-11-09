// Display pieces for Metrics: an explanation tooltip (hover or keyboard focus) and an 8-week sparkline.
export function Tip({ label, text, id }: { label: string; text: string; id: string }) {
  return (
    <span className="tip">
      <button type="button" aria-label={`What is ${label}?`} aria-describedby={id}>i</button>
      <span role="tooltip" id={id}>{text}</span>
    </span>
  );
}

export function Sparkline({ values, target, unit }: { values: (number | null)[]; target?: number; unit: string }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  if (pts.length < 2) return <div className="tgt" style={{ marginTop: ".5rem" }}>Trend appears after two weeks of data</div>;
  const w = 220, h = 44;
  const all = [...pts.map((p) => p.v), ...(target !== undefined ? [target] : [])];
  const lo = Math.min(...all), hi = Math.max(...all) || 1, span = hi - lo || 1;
  const x = (i: number) => (i / (values.length - 1)) * w;
  const y = (v: number) => h - ((v - lo) / span) * h;
  const last = pts.at(-1)!;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`8-week trend, latest ${last.v} ${unit}`}>
      {target !== undefined && <line x1="0" x2={w} y1={y(target)} y2={y(target)} stroke="#9AA59C" strokeWidth="1" strokeDasharray="4 4" />}
      <polyline points={pts.map((p) => `${x(p.i)},${y(p.v)}`).join(" ")} fill="none" stroke="#3C6E47" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p) => <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r="7" fill="transparent"><title>{`${8 - p.i} week${8 - p.i === 1 ? "" : "s"} ago: ${p.v} ${unit}`}</title></circle>)}
      <circle cx={x(last.i)} cy={y(last.v)} r="4" fill="#3C6E47" stroke="#FAFBF8" strokeWidth="2" />
    </svg>
  );
}
