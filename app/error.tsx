"use client";

import { Icon } from "./axion/icons";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="route-error">
      <span><Icon name="alert" size={26} /></span>
      <p>Un imprévu est survenu</p>
      <h1>Axion n’a pas pu afficher cet écran.</h1>
      <small>Vos données n’ont pas été modifiées. Vous pouvez relancer le chargement en toute sécurité.</small>
      <button className="primary-button" onClick={reset}>Réessayer</button>
    </main>
  );
}
