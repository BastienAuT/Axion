import type { Metadata } from "next";
import AxionApp from "./AxionApp";

export const metadata: Metadata = { title: "Axion — Gestion des interventions", description: "Planifiez, suivez et clôturez vos interventions terrain." };
export default function Home() { return <AxionApp />; }
