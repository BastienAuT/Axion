import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/organization/access";

const statement = {
  ...defaultStatements,
  intervention: ["read", "create", "update", "finalize"],
  customer: ["read", "create", "update"],
  report: ["read", "create"],
  billing: ["read", "create", "update"],
} as const;

export const axionAccess = createAccessControl(statement);

export const managerRole = axionAccess.newRole({
  organization: ["update"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  team: [],
  ac: ["read"],
  intervention: ["read", "create", "update", "finalize"],
  customer: ["read", "create", "update"],
  report: ["read", "create"],
  billing: ["read", "create", "update"],
});

export const technicianRole = axionAccess.newRole({
  organization: [],
  member: [],
  invitation: [],
  team: [],
  ac: [],
  intervention: ["read", "update", "finalize"],
  customer: ["read"],
  report: ["read", "create"],
  billing: [],
});

export const clientRole = axionAccess.newRole({
  organization: [],
  member: [],
  invitation: [],
  team: [],
  ac: [],
  intervention: ["read"],
  customer: [],
  report: ["read"],
  billing: [],
});

export const axionRoles = {
  manager: managerRole,
  technician: technicianRole,
  client: clientRole,
};

export type AxionRole = keyof typeof axionRoles;

export function isAxionRole(value: string): value is AxionRole {
  return value === "manager" || value === "technician" || value === "client";
}
