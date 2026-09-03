import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requirePageAuth } from "@/lib/auth-context";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Connectez-vous à votre espace sécurisé Axion.",
};

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const identity = await requirePageAuth(await headers());
  if (identity) redirect("/");

  const demoEnabled = isDemoModeEnabled();
  return (
    <LoginForm
      demoEnabled={demoEnabled}
      demoPassword={demoEnabled
        ? process.env.DEMO_AUTH_PASSWORD ?? "Axion-Demo-2026!"
        : undefined}
    />
  );
}
