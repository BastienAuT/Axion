import { describe, expect, test } from "bun:test";
import {
  canTransitionStatus,
  createInterventionReference,
  readJsonRequest,
  validateCreateIntervention,
  validateStatusUpdate,
} from "../app/api/interventions/validation";

const validCreatePayload = {
  title: "Entretien chaudière",
  customerName: "Atelier Berthier",
  siteName: "Atelier principal",
  address: "18 rue du Bac, Lyon",
  technician: "Nicolas Martin",
  scheduledDate: "2026-09-15",
  scheduledTime: "09:30",
  durationMinutes: 60,
  priority: "high",
};

describe("validation des interventions", () => {
  test("normalise une création valide et applique les valeurs par défaut", () => {
    const result = validateCreateIntervention({
      ...validCreatePayload,
      title: "  Entretien chaudière  ",
      durationMinutes: undefined,
      priority: undefined,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        ...validCreatePayload,
        title: "Entretien chaudière",
        description: "",
        durationMinutes: 60,
        priority: "normal",
      },
    });
  });

  test("rejette dates impossibles, heures, durées, enums et champs inconnus", () => {
    const result = validateCreateIntervention({
      ...validCreatePayload,
      scheduledDate: "2026-02-30",
      scheduledTime: "25:90",
      durationMinutes: -4,
      priority: "critical",
      unexpected: true,
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.field).sort()).toEqual([
        "durationMinutes",
        "priority",
        "scheduledDate",
        "scheduledTime",
        "unexpected",
      ]);
    }
  });

  test("ne confond pas null avec une valeur absente", () => {
    const result = validateCreateIntervention({
      ...validCreatePayload,
      description: null,
      durationMinutes: null,
      priority: null,
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.field)).toEqual([
        "description",
        "durationMinutes",
        "priority",
      ]);
    }
  });

  test("rejette un identifiant ou un statut PATCH invalide", () => {
    const result = validateStatusUpdate({ id: "1", status: "done" });
    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.field)).toEqual(["id", "status"]);
    }
  });

  test("impose les transitions du cycle de vie", () => {
    expect(canTransitionStatus("scheduled", "in_progress")).toBeTrue();
    expect(canTransitionStatus("in_progress", "completed")).toBeFalse();
    expect(canTransitionStatus("completed", "in_progress")).toBeFalse();
    expect(canTransitionStatus("cancelled", "scheduled")).toBeFalse();
  });

  test("génère des références stables en forme et distinctes", () => {
    const date = new Date("2026-09-02T12:00:00.000Z");
    const first = createInterventionReference(date, "11111111-1111-4111-8111-111111111111");
    const second = createInterventionReference(date, "22222222-2222-4222-8222-222222222222");

    expect(first).toMatch(/^INT-2026-[0-9A-Z]+-[0-9A-F]{8}$/);
    expect(first).not.toBe(second);
  });
});

describe("lecture JSON", () => {
  test("retourne 400 pour du JSON mal formé", async () => {
    const request = new Request("http://localhost/api/interventions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    expect(await readJsonRequest(request)).toEqual({
      ok: false,
      status: 400,
      message: "JSON invalide",
    });
  });

  test("retourne 415 quand le type de contenu n'est pas JSON", async () => {
    const request = new Request("http://localhost/api/interventions", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify(validCreatePayload),
    });
    expect(await readJsonRequest(request)).toEqual({
      ok: false,
      status: 415,
      message: "Le contenu doit être du JSON",
    });
  });
});
