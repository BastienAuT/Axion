import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Axion Interventions",
    short_name: "Axion",
    description:
      "Planifiez, suivez et clôturez vos interventions terrain avec Axion.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f6fa",
    theme_color: "#151c31",
    lang: "fr",
    icons: [
      {
        src: "/axion-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/axion-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/axion-icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/axion-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
