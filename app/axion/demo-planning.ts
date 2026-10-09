import type { Intervention } from "./model";

export const DEMO_PLANNING_END = "2027-12-31";

const slots = [
  { technician: "Nicolas Martin", time: "08:30" },
  { technician: "Sofia Benali", time: "10:30" },
  { technician: "Lucas Morel", time: "14:00" },
] as const;

/** Stable date-based identifiers let the seed run again without duplicating events. */
export function createDemoPlanning(
  startDate: string,
  templates: readonly Intervention[],
  endDate = DEMO_PLANNING_END,
): Intervention[] {
  if (!templates.length || startDate > endDate) return [];

  const result: Intervention[] = [];
  const date = new Date(startDate + "T12:00:00.000Z");
  while (date.toISOString().slice(0, 10) <= endDate) {
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      const scheduledDate = date.toISOString().slice(0, 10);
      const dateNumber = scheduledDate.replaceAll("-", "");
      // Absolute day index keeps clients and missions stable across seed runs.
      const dayIndex = Math.floor(date.getTime() / 86_400_000);
      for (const [index, slot] of slots.entries()) {
        const template = templates[(dayIndex + index) % templates.length];
        result.push({
          ...template,
          id: "41000000-0000-4000-8000-" + dateNumber + String(index + 1).padStart(4, "0"),
          reference: "INT-" + scheduledDate.slice(0, 4) + "-DEMO-" + dateNumber.slice(4) + "-" + (index + 1),
          technician: slot.technician,
          scheduledDate,
          scheduledTime: slot.time,
          priority: "normal",
          status: "scheduled",
        });
      }
    }
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return result;
}
