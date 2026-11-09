// Greeting and sky by the user's local hour.
export type DayPart = "morning" | "afternoon" | "evening";

export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  return "evening";
}

export function greetingFor(hour: number): string {
  return { morning: "Good morning.", afternoon: "Good afternoon.", evening: "Good evening." }[dayPart(hour)];
}
