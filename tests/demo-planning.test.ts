import { describe, expect, test } from "bun:test";
import { createDemoPlanning, DEMO_PLANNING_END } from "../app/axion/demo-planning";
import { seedClients, seedInterventions } from "../app/axion/demo-data";
import { isIntervention } from "../app/axion/model";

const templates = seedInterventions.slice(0, 5);

describe("planning de démonstration", () => {
  test("couvre chaque semaine jusqu'au 31 décembre 2027 avec les trois techniciens", () => {
    const items = createDemoPlanning("2026-10-10", templates);
    expect(items[0].scheduledDate).toBe("2026-10-12");
    expect(items.at(-1)?.scheduledDate).toBe(DEMO_PLANNING_END);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    expect(new Set(items.map((item) => item.reference)).size).toBe(items.length);
    const clients = new Set(seedClients.map((client) => client.name));
    const days = new Map<string, Set<string>>();
    for (const item of items) {
      expect(isIntervention(item)).toBe(true);
      expect(item.status).toBe("scheduled");
      expect(clients.has(item.customerName)).toBe(true);
      expect([0, 6]).not.toContain(new Date(item.scheduledDate + "T12:00:00Z").getUTCDay());
      const technicians = days.get(item.scheduledDate) ?? new Set<string>();
      technicians.add(item.technician);
      days.set(item.scheduledDate, technicians);
    }
    for (const technicians of days.values()) expect(technicians.size).toBe(3);
    expect(new Set(items.filter((item) => item.scheduledDate.startsWith("2027-")).map((item) => item.scheduledDate.slice(0, 7))).size).toBe(12);
    expect(items.some((item) => item.customerName === "Atelier Berthier" && item.technician === "Nicolas Martin")).toBe(true);
  });

  test("garde les mêmes identifiants et missions après un nouvel amorçage", () => {
    const first = createDemoPlanning("2026-10-10", templates);
    const later = createDemoPlanning("2027-01-01", templates);
    expect(first.filter((item) => item.scheduledDate >= "2027-01-01")).toEqual(later);
    expect(createDemoPlanning("2026-10-10", templates)).toEqual(first);
    const initialIds = new Set(templates.map((item) => item.id));
    expect(first.some((item) => initialIds.has(item.id))).toBe(false);
  });

  test("respecte les bornes inclusives, les week-ends et la fin du planning", () => {
    expect(createDemoPlanning("2027-12-31", templates)).toHaveLength(3);
    expect(createDemoPlanning("2028-01-01", templates)).toEqual([]);
    expect(createDemoPlanning("2027-12-25", templates, "2027-12-26")).toEqual([]);
    expect(createDemoPlanning("2027-01-01", [])).toEqual([]);
  });
});
