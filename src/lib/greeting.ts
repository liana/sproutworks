// Greeting by the user's local hour.
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning.";
  if (hour >= 12 && hour < 17) return "Good afternoon.";
  return "Good evening.";
}
