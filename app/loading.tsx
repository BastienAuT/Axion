export default function Loading() {
  return (
    <div className="route-loading" aria-label="Chargement d’Axion" role="status">
      <div className="route-loading-brand">
        <span className="brand-mark" aria-hidden="true"><span /></span>
        <strong>axion</strong>
      </div>
      <div className="loading-shell">
        <span />
        <span />
        <div>
          <i /><i /><i /><i />
        </div>
        <span />
      </div>
      <p>Préparation de votre espace de travail…</p>
    </div>
  );
}
