/* global caches, clients */

const CACHE_PREFIX = "axion-shell-";
const CACHE_NAME = `${CACHE_PREFIX}v5`;
const APP_SHELL = [
  "/manifest.webmanifest",
  "/axion-icon.svg",
  "/axion-icon-180.png",
  "/axion-icon-192.png",
  "/axion-icon-512.png",
  "/axion-icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => clients.claim()),
  );
});

function isCacheable(response) {
  if (!response.ok || response.type !== "basic") {
    return false;
  }

  const cacheControl = response.headers.get("cache-control")?.toLowerCase() ?? "";
  return !cacheControl.includes("no-store") && !cacheControl.includes("private");
}

async function cacheResponse(request, response) {
  if (isCacheable(response)) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }

  return response;
}

async function navigationResponse(request) {
  try {
    // Authenticated HTML can contain role-specific data and must never survive a logout.
    return await fetch(request);
  } catch {
    return new Response(
      "<!doctype html><html lang=\"fr\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><title>Axion hors connexion</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f6fa;color:#1d2437;font:16px system-ui}.card{max-width:430px;margin:24px;padding:32px;border:1px solid #e4e7ef;border-radius:18px;background:#fff;box-shadow:0 16px 40px #161c3317}h1{margin:0 0 12px;font-size:24px}p{margin:0;color:#586276;line-height:1.6}</style><div class=\"card\"><h1>Vous êtes hors connexion</h1><p>Les données déjà ouvertes restent visibles. Reconnectez-vous pour recharger Axion ou modifier une intervention.</p></div></html>",
      {
        status: 503,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      },
    );
  }
}

async function staticAssetResponse(request) {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  return cacheResponse(request, await fetch(request));
}

async function networkFirstAssetResponse(request) {
  try {
    return await cacheResponse(request, await fetch(request));
  } catch {
    return (
      (await caches.match(request)) ??
      new Response("Ressource indisponible hors connexion.", { status: 503 })
    );
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  const isApiRequest =
    url.pathname === "/api" || url.pathname.startsWith("/api/");

  if (url.origin !== self.location.origin || isApiRequest) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(navigationResponse(request));
    return;
  }

  if (["script", "style"].includes(request.destination)) {
    event.respondWith(networkFirstAssetResponse(request));
    return;
  }

  if (["font", "image"].includes(request.destination)) {
    event.respondWith(staticAssetResponse(request));
  }
});
