"use client";

import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { axionAccess, axionRoles } from "./auth-permissions";

export const authClient = createAuthClient({
  plugins: [
    organizationClient({
      ac: axionAccess,
      roles: axionRoles,
    }),
  ],
});
