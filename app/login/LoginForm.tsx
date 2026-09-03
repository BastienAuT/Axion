"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

const demoAccounts = [
  { label: "Responsable", email: "claire@axion.local", initials: "CD" },
  { label: "Technicien", email: "nicolas@axion.local", initials: "NM" },
  { label: "Client", email: "thomas@atelier-berthier.local", initials: "TB" },
] as const;

const SESSION_RETRY_DELAYS = [0, 80, 160, 320, 640] as const;

function delay(duration: number) {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

async function refreshAxionWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      updateViaCache: "none",
    });
    await registration.update();
  } catch {
    // Authentication remains available when service workers are blocked.
  }
}

async function clearLegacyNavigationCache() {
  if (!("caches" in window)) return;
  try {
    const names = await window.caches.keys();
    await Promise.all(
      names
        .filter((name) => name.startsWith("axion-shell-"))
        .map((name) => window.caches.delete(name)),
    );
  } catch {
    // A restricted browser may deny Cache Storage without affecting the session.
  }
}

async function waitForAuthContext() {
  let lastStatus = 0;
  for (const retryDelay of SESSION_RETRY_DELAYS) {
    if (retryDelay) await delay(retryDelay);
    try {
      const response = await fetch("/api/auth/context", {
        cache: "no-store",
        credentials: "include",
        headers: { "Cache-Control": "no-cache" },
      });
      lastStatus = response.status;
      if (response.ok) return { ready: true as const, status: response.status };
      if (response.status === 403) break;
    } catch {
      // A short network hiccup is retried before surfacing an error.
    }
  }
  return { ready: false as const, status: lastStatus };
}

export default function LoginForm({
  demoEnabled,
  demoPassword,
}: {
  demoEnabled: boolean;
  demoPassword?: string;
}) {
  const defaultDemoPassword = demoPassword ?? "";
  const [email, setEmail] = useState(demoEnabled ? demoAccounts[0].email : "");
  const [password, setPassword] = useState(defaultDemoPassword);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void refreshAxionWorker();
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      const result = await authClient.signIn.email({
        email: email.trim().toLocaleLowerCase("fr"),
        password,
        callbackURL: "/",
        rememberMe: true,
      });

      if (result.error) {
        setPending(false);
        setError("Adresse e-mail ou mot de passe incorrect.");
        return;
      }

      const session = await waitForAuthContext();
      if (!session.ready) {
        setPending(false);
        setError(
          session.status === 403
            ? "Ce compte n’est rattaché à aucun espace Axion. Contactez votre responsable."
            : "La session n’a pas pu être confirmée. Vérifiez votre connexion et réessayez.",
        );
        return;
      }

      await clearLegacyNavigationCache();
      window.location.replace("/");
    } catch {
      setPending(false);
      setError("Connexion momentanément indisponible. Réessayez dans un instant.");
    }
  };

  const chooseDemoAccount = (account: (typeof demoAccounts)[number]) => {
    setEmail(account.email);
    setPassword(defaultDemoPassword);
    setError("");
  };

  return (
    <main className="login-shell">
      <section className="login-story" aria-label="Présentation d’Axion">
        <Link className="login-brand" href="/" prefetch={false} aria-label="Axion, accueil">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>Axion<small>INTERVENTIONS</small></span>
        </Link>
        <div className="login-story-copy">
          <span className="login-kicker">OPÉRATIONS TERRAIN</span>
          <h1>Chaque intervention.<br />Parfaitement maîtrisée.</h1>
          <p>
            Planning, suivi terrain, rapports signés et relation client réunis
            dans un espace clair et sécurisé.
          </p>
          <div className="login-trust-row" aria-label="Garanties de la plateforme">
            <span><i aria-hidden="true">✓</i> Données isolées</span>
            <span><i aria-hidden="true">✓</i> Accès par rôle</span>
            <span><i aria-hidden="true">✓</i> Traçabilité</span>
          </div>
        </div>
        <p className="login-version">AXION · ESPACE PROFESSIONNEL</p>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <header>
            <span className="login-secure-pill"><i aria-hidden="true" /> ESPACE SÉCURISÉ</span>
            <h2>Bon retour</h2>
            <p>Connectez-vous pour accéder à votre espace de travail.</p>
          </header>

          {demoEnabled && (
            <div className="demo-account-picker">
              <span>Essayer une vue</span>
              <div>
                {demoAccounts.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    className={email === account.email ? "active" : ""}
                    onClick={() => chooseDemoAccount(account)}
                  >
                    <i>{account.initials}</i>
                    <span>{account.label}<small>{account.email}</small></span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={submit}>
            <label htmlFor="login-email">Adresse e-mail</label>
            <div className="login-input">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h16v11H4zM4.5 7l7.5 6 7.5-6" /></svg>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="vous@entreprise.fr"
                required
                autoFocus
              />
            </div>

            <div className="login-label-row">
              <label htmlFor="login-password">Mot de passe</label>
              <span>12 caractères minimum</span>
            </div>
            <div className="login-input">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Votre mot de passe"
                minLength={12}
                required
              />
            </div>

            {error && <p className="login-error" role="alert">{error}</p>}

            <button className="login-submit" type="submit" disabled={pending}>
              {pending ? <span className="login-spinner" aria-hidden="true" /> : null}
              {pending ? "Connexion en cours…" : "Se connecter"}
              {!pending && <span aria-hidden="true">→</span>}
            </button>
          </form>

          {demoEnabled && (
            <p className="demo-password-note">
              Démo locale · mot de passe prérempli : <strong>{defaultDemoPassword}</strong>
            </p>
          )}
          <footer>Session protégée par Better Auth</footer>
        </div>
      </section>
    </main>
  );
}
