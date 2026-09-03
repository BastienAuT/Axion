import Link from "next/link";
import { Icon } from "./axion/icons";

export default function NotFound() {
  return (
    <main className="route-error">
      <span><Icon name="route" size={26} /></span>
      <p>Erreur 404</p>
      <h1>Cette page n’existe pas.</h1>
      <small>Le lien a peut-être changé ou l’écran demandé n’est plus disponible.</small>
      <Link className="primary-button" href="/">Revenir à Axion</Link>
    </main>
  );
}
