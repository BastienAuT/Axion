import type { Metadata, Viewport } from "next";

import "./globals.css";

const FALLBACK_APP_URL = "http://localhost:3000";
const DESCRIPTION =
  "Planifiez, suivez et clôturez vos interventions terrain avec Axion.";

function getMetadataBase() {
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  const configuredUrl = process.env.APP_URL?.trim()
    ?? (vercelUrl ? `https://${vercelUrl}` : undefined);

  if (!configuredUrl) {
    return new URL(FALLBACK_APP_URL);
  }

  try {
    const url = new URL(configuredUrl);

    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password
    ) {
      return new URL(FALLBACK_APP_URL);
    }

    url.pathname = "/";
    url.search = "";
    url.hash = "";

    return url;
  } catch {
    return new URL(FALLBACK_APP_URL);
  }
}

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: {
    default: "Axion",
    template: "%s · Axion",
  },
  description: DESCRIPTION,
  applicationName: "Axion",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/axion-icon.svg", type: "image/svg+xml" }],
    shortcut: "/axion-icon.svg",
    apple: [{ url: "/axion-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Axion",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Axion",
    title: "Axion — Les interventions terrain, enfin maîtrisées.",
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Axion — Gestion des interventions",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#151c31",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
