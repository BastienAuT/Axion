import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AxionApp from "./AxionApp";
import { requirePageAuth } from "@/lib/auth-context";
import { isDemoModeEnabled } from "@/lib/demo-mode";

export const metadata: Metadata = {
  title: { absolute: "Gestion des interventions · Axion" },
  description:
    "Planifiez, suivez et clôturez vos interventions terrain avec Axion.",
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const identity = await requirePageAuth(await headers());
  if (!identity) redirect("/login");

  return <AxionApp identity={identity} demoEnabled={isDemoModeEnabled()} />;
}
