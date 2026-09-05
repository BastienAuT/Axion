"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "./axion/icons";
import { authClient } from "@/lib/auth-client";
import {
  matchesSearch,
  roleLabel,
  seedInterventions,
  todayKey,
  type AxionIdentity,
  type Intervention,
  type Role,
  type View,
} from "./axion/model";
import { Avatar, Drawer, Modal, SignaturePad, StatusBadge } from "./axion/primitives";
import {
  BillingView,
  ClientPortal,
  ClientsView,
  InterventionList,
  ManagerDashboard,
  Planning,
  ReportsView,
  TechnicianDashboard,
} from "./axion/views";
import { useAxionData } from "./axion/use-axion-data";
import { useInterventionActions } from "./axion/use-intervention-actions";
import { useCommerceActions } from "./axion/use-commerce-actions";
import { useReportEditor } from "./axion/use-report-editor";
import { downloadStoredReport } from "./axion/report-pdf";
import type { Toast } from "./axion/ui-types";

type NavItem = { id: View; label: string; icon: IconName };
const managerNavigation: NavItem[] = [
  { id: "dashboard", label: "Vue d’ensemble", icon: "home" },
  { id: "planning", label: "Planning", icon: "calendar" },
  { id: "interventions", label: "Interventions", icon: "wrench" },
  { id: "clients", label: "Clients & sites", icon: "users" },
  { id: "reports", label: "Rapports", icon: "file" },
  { id: "billing", label: "Devis & factures", icon: "receipt" },
];

const technicianNavigation: NavItem[] = [
  { id: "dashboard", label: "Ma tournée", icon: "route" },
  { id: "interventions", label: "Mes interventions", icon: "wrench" },
  { id: "reports", label: "Mes rapports", icon: "file" },
];

const clientNavigation: NavItem[] = [
  { id: "dashboard", label: "Mon suivi", icon: "home" },
  { id: "interventions", label: "Mes interventions", icon: "wrench" },
  { id: "reports", label: "Mes rapports", icon: "file" },
];

function navigationFor(role: Role) {
  if (role === "technician") return technicianNavigation;
  if (role === "client") return clientNavigation;
  return managerNavigation;
}

function initialsFor(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("fr"))
    .join("");
}

export default function AxionApp({
  identity,
  demoEnabled,
}: {
  identity: AxionIdentity;
  demoEnabled: boolean;
}) {
  const role = identity.role;
  const [view, setView] = useState<View>("dashboard");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Intervention | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [saving, setSaving] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unread, setUnread] = useState(3);
  const [signingOut, setSigningOut] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const notify = useCallback(
    (message: string, tone: Toast["tone"] = "success") => setToast({ message, tone }),
    [],
  );

  const data = useAxionData(identity, demoEnabled, notify);
  const { items, reports, clients, billingDocuments, attachments, online, apiAvailable, loadingData } = data;
  const { createIntervention, updateStatus } = useInterventionActions({
    ...data, notify, setSaving, setCreateOpen, setSelected,
  });
  const { createClient, createBillingDocument, updateBillingStatus } = useCommerceActions({ ...data, notify });
  const {
    reportOpen, setReportOpen, reportSigned, reportDraft, setReportDraft, photos,
    handleSignatureChange, openReportFor, openReport, selectReportPhotos, saveReportDraft, finalizeReport,
  } = useReportEditor({ ...data, selected, setSelected, setSaving, notify, updateStatus });

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase("fr") === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "Escape") {
        setQuery("");
        setNotificationsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const navigation = navigationFor(role);
  const filtered = useMemo(
    () => items.filter((item) => matchesSearch(item, query)).slice(0, 6),
    [items, query],
  );
  const demoItemIds = new Set(seedInterventions.map((item) => item.id));
  const hasDemoData = demoEnabled && items.some((item) => demoItemIds.has(item.id));
  const technicianItems = role === "technician" ? items : [];
  const clientItems = role === "client" ? items : [];
  const profileName = identity.name;

  const navigate = (next: View) => {
    setView(next);
    setMobileNav(false);
    setQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      await authClient.signOut();
      window.location.assign("/login");
    } catch {
      setSigningOut(false);
      notify("La déconnexion a échoué. Réessayez.", "error");
    }
  };

  const openCreate = () => {
    setSelected(null);
    setNotificationsOpen(false);
    setCreateOpen(true);
  };

  const renderView = () => {
    if (role === "manager") {
      if (view === "planning") {
        return <Planning items={items} onSelect={setSelected} onCreate={openCreate} />;
      }
      if (view === "interventions") {
        return <InterventionList items={items} onSelect={setSelected} onCreate={openCreate} />;
      }
      if (view === "clients") {
        return (
          <ClientsView
            items={items}
            clients={clients}
            onSelectIntervention={setSelected}
            onCreateClient={createClient}
            mutationsEnabled={online === true}
          />
        );
      }
      if (view === "reports") {
        return <ReportsView items={items} reports={reports} attachments={attachments} onDownload={downloadStoredReport} />;
      }
      if (view === "billing") {
        return (
          <BillingView
            documents={billingDocuments}
            clients={clients}
            onCreateDocument={createBillingDocument}
            onUpdateStatus={updateBillingStatus}
            mutationsEnabled={online === true}
          />
        );
      }
      return <ManagerDashboard items={items} setView={navigate} onSelect={setSelected} />;
    }

    if (role === "technician") {
      if (view === "interventions") {
        return <InterventionList items={technicianItems} onSelect={setSelected} role="technician" />;
      }
      if (view === "reports") {
        return (
          <ReportsView
            items={technicianItems}
            reports={reports}
            attachments={attachments}
            onDownload={downloadStoredReport}
          />
        );
      }
      return (
        <TechnicianDashboard
          items={technicianItems}
          onSelect={setSelected}
          onReport={openReportFor}
          updateStatus={updateStatus}
          mutationsEnabled={online === true}
        />
      );
    }

    return (
      <ClientPortal
        items={clientItems}
        reports={reports}
        section={view === "reports" ? "reports" : view === "interventions" ? "interventions" : "dashboard"}
        onSelect={setSelected}
      />
    );
  };

  const notifications = items.slice(0, 3).map((item, index) => ({
    title: item.status === "completed"
      ? "Rapport finalisé"
      : item.status === "en_route"
        ? "Technicien en route"
        : item.status === "in_progress"
          ? "Intervention démarrée"
          : "Intervention planifiée",
    detail: `${item.technician.split(" ")[0]} · ${item.customerName}`,
    item,
    time: index === 0 ? "À l’instant" : index === 1 ? "Aujourd’hui" : "Récemment",
  }));

  return (
    <div className="app-shell">
      <aside className={mobileNav ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>axion<small>INTERVENTIONS</small></span>
          <button className="nav-close icon-button" onClick={() => setMobileNav(false)} aria-label="Fermer le menu"><Icon name="x" /></button>
        </div>

        <div className="workspace">
          <div className="workspace-badge">{initialsFor(identity.organizationName)}</div>
          <div><strong>{identity.organizationName}</strong><small>Équipe opérationnelle</small></div>
        </div>

        <nav aria-label="Navigation principale">
          <span className="nav-section-label">Espace de travail</span>
          {navigation.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "active" : ""}
              aria-current={view === item.id ? "page" : undefined}
              onClick={() => navigate(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.id === "interventions" && (
                <em>{role === "manager" ? items.length : role === "technician" ? technicianItems.length : clientItems.length}</em>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="sync-state">
            <span className={online === false ? "offline" : apiAvailable === true ? "online" : "pending"} />
            <div>
              <strong>
                {online === null
                  ? "Connexion…"
                  : !online
                    ? "Mode hors ligne"
                    : loadingData
                      ? "Synchronisation…"
                      : apiAvailable
                        ? hasDemoData
                          ? "API + démonstration"
                          : "Données synchronisées"
                        : "Mode démonstration"}
              </strong>
              <small>
                {!online
                  ? "Consultation uniquement"
                  : apiAvailable
                    ? hasDemoData
                      ? "Serveur disponible · exemples inclus"
                      : "Serveur disponible"
                    : "Données locales actives"}
              </small>
            </div>
          </div>
          <div className="profile">
            <Avatar name={profileName} available={online === true} />
            <div><strong>{profileName}</strong><small>{roleLabel[role]}</small></div>
            <button className="profile-signout" onClick={() => void signOut()} disabled={signingOut} aria-label="Se déconnecter">
              <Icon name="log-out" size={17} />
            </button>
          </div>
        </div>
      </aside>

      {mobileNav && <button className="backdrop" aria-label="Fermer le menu" onClick={() => setMobileNav(false)} />}

      <main>
        <header className="topbar">
          <button className="menu icon-button" onClick={() => setMobileNav(true)} aria-label="Ouvrir le menu"><Icon name="menu" /></button>

          <div className="search-wrap">
            <div className="search">
              <Icon name="search" size={19} />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher une intervention, un client…"
                aria-label="Recherche globale"
              />
              {query ? (
                <button className="search-clear" onClick={() => setQuery("")} aria-label="Effacer la recherche"><Icon name="x" size={16} /></button>
              ) : <kbd>⌘ K</kbd>}
            </div>
            {query.trim() && (
              <div className="search-results" id="global-search-results">
                <div className="search-results-head"><span>Résultats</span><small>{filtered.length} trouvé{filtered.length !== 1 ? "s" : ""}</small></div>
                {filtered.map((item) => (
                  <button key={item.id} onClick={() => { setSelected(item); setQuery(""); }}>
                    <span className="search-result-icon"><Icon name="wrench" size={16} /></span>
                    <span><strong>{item.title}</strong><small>{item.reference} · {item.customerName}</small></span>
                    <StatusBadge status={item.status} />
                  </button>
                ))}
                {!filtered.length && <p>Aucun résultat pour « {query} ».</p>}
              </div>
            )}
          </div>

          <div className="top-actions">
            <span className={online === false ? "sync-chip offline" : apiAvailable === false ? "sync-chip local" : "sync-chip"} role="status">
              <Icon name={online === false ? "wifi-off" : apiAvailable === false ? "sparkles" : "cloud"} size={16} />
              {online === null ? "Connexion" : !online ? "Hors ligne" : loadingData ? "Chargement" : apiAvailable ? hasDemoData ? "Démo + API" : "À jour" : "Démo locale"}
            </span>
            <span className="session-role" title={identity.email}>
              <Icon name="users" size={15} /> {roleLabel[role]}
            </span>
            <div className="notification-wrap">
              {notificationsOpen && <button className="popover-backdrop" aria-label="Fermer les notifications" onClick={() => setNotificationsOpen(false)} />}
              <button
                className="bell icon-button"
                aria-label={`${unread} notification${unread !== 1 ? "s" : ""} non lue${unread !== 1 ? "s" : ""}`}
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((value) => !value)}
              >
                <Icon name="bell" />{unread > 0 && <i>{unread}</i>}
              </button>
              {notificationsOpen && (
                <div className="notifications-popover" role="dialog" aria-label="Notifications">
                  <header><div><strong>Notifications</strong><small>{unread} non lues</small></div><button onClick={() => setUnread(0)}>Tout marquer comme lu</button></header>
                  {notifications.map((notification, index) => (
                    <button
                      key={`${notification.title}-${index}`}
                      onClick={() => {
                        if (notification.item) setSelected(notification.item);
                        setUnread((value) => Math.max(0, value - 1));
                        setNotificationsOpen(false);
                      }}
                    >
                      <i className="notification-dot" />
                      <span><strong>{notification.title}</strong><small>{notification.detail}</small></span>
                      <time>{notification.time}</time>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {role === "manager" && (
              <button className="primary-button top-create" onClick={openCreate} disabled={online !== true}>
                <Icon name="plus" /> <span>Nouvelle intervention</span>
              </button>
            )}
          </div>
        </header>

        {online === false && (
          <div className="offline-banner" role="status">
            <Icon name="wifi-off" size={17} />
            <span><strong>Vous êtes hors ligne.</strong> Les données déjà chargées restent consultables ; les modifications sont suspendues.</span>
          </div>
        )}

        <div className="content" aria-busy={loadingData}>{renderView()}</div>
      </main>

      <nav className="mobile-bottom-nav" aria-label="Navigation mobile">
        {navigation.slice(0, 3).map((item) => (
          <button key={item.id} className={view === item.id ? "active" : ""} aria-current={view === item.id ? "page" : undefined} onClick={() => navigate(item.id)}>
            <Icon name={item.icon} />
            <span>{item.label.replace("Vue d’ensemble", "Accueil").replace("Mes interventions", "Missions")}</span>
          </button>
        ))}
        <button onClick={() => setMobileNav(true)}><Icon name="menu" /><span>Menu</span></button>
      </nav>

      {role === "manager" && (
        <button className="mobile-quick-add" onClick={openCreate} disabled={online !== true} aria-label="Nouvelle intervention"><Icon name="plus" size={23} /></button>
      )}

      {createOpen && (
        <Modal title="Nouvelle intervention" subtitle="Planifiez, priorisez et affectez la mission." onClose={() => !saving && setCreateOpen(false)} wide>
          <form className="form-grid" onSubmit={createIntervention}>
            <label className="span-2">Objet de l’intervention<input name="title" required maxLength={160} placeholder="Ex. Entretien chaudière annuelle" data-autofocus /></label>
            <label>Client<select name="customerName">{clients.map((client) => <option key={client.id ?? client.name}>{client.name}</option>)}</select></label>
            <label>Site<input name="siteName" required maxLength={120} defaultValue="Atelier principal" /></label>
            <label className="span-2">Adresse<input name="address" required maxLength={300} defaultValue="18 rue du Bac, Lyon 2e" autoComplete="street-address" /></label>
            <label>Date<input name="scheduledDate" type="date" required defaultValue={todayKey} /></label>
            <label>Heure<input name="scheduledTime" type="time" required defaultValue="09:00" /></label>
            <label>Technicien<select name="technician"><option>Nicolas Martin</option><option>Sofia Benali</option><option>Lucas Morel</option></select></label>
            <label>Durée estimée<select name="durationMinutes" defaultValue="60"><option value="30">30 min</option><option value="45">45 min</option><option value="60">1 h</option><option value="90">1 h 30</option><option value="120">2 h</option></select></label>
            <label>Priorité<select name="priority"><option value="normal">Normale</option><option value="high">Haute</option><option value="urgent">Urgente</option><option value="low">Basse</option></select></label>
            <label className="span-2">Consignes<textarea name="description" rows={3} maxLength={5000} placeholder="Accès, matériel à prévoir, points de vigilance…" /></label>
            <div className="modal-actions span-2">
              <span className="form-hint"><Icon name="cloud" size={15} /> Enregistrement sécurisé</span>
              <button type="button" className="secondary-button" onClick={() => setCreateOpen(false)} disabled={saving}>Annuler</button>
              <button className="primary-button" disabled={saving}>{saving ? <><span className="spinner" /> Création…</> : <><Icon name="plus" /> Créer et affecter</>}</button>
            </div>
          </form>
        </Modal>
      )}

      {selected && !reportOpen && (
        <Drawer
          item={selected}
          role={role}
          onClose={() => setSelected(null)}
          updateStatus={updateStatus}
          statusDisabled={online !== true}
          report={reports.find((report) => report.interventionId === selected.id)}
          attachments={attachments.filter((attachment) => attachment.interventionId === selected.id)}
          onReport={openReport}
          onDownload={() =>
            downloadStoredReport(
              selected,
              reports.find((report) => report.interventionId === selected.id),
            )
          }
        />
      )}

      {reportOpen && selected && (
        <Modal title="Rapport d’intervention" subtitle={`${selected.reference} · ${selected.customerName}`} onClose={() => !saving && setReportOpen(false)} wide>
          <div className="report-form">
            <div className="report-context"><Icon name="wrench" /><span><strong>{selected.title}</strong><small>{selected.siteName} · {selected.technician}</small></span><StatusBadge status={selected.status} /></div>
            <label>Travaux réalisés<textarea value={reportDraft.summary} onChange={(event) => setReportDraft((current) => ({ ...current, summary: event.target.value }))} rows={5} maxLength={5000} required /></label>
            <label>Matériel utilisé<input value={reportDraft.materials} onChange={(event) => setReportDraft((current) => ({ ...current, materials: event.target.value }))} maxLength={2000} /></label>
            <label>Photos <small className="field-note">jointes au rapport et conservées comme preuve</small><span className="photo-zone"><input type="file" accept="image/jpeg,image/png" multiple disabled={selected.id.startsWith("demo-")} onChange={(event) => selectReportPhotos(event.target.files)} aria-label="Joindre des photos au rapport" /><span className="photo-icon"><Icon name="upload" /></span><strong>{selected.id.startsWith("demo-") ? "Disponible sur une intervention enregistrée" : "Ajouter des photos"}</strong><small>{photos.length ? `${photos.length} photo${photos.length > 1 ? "s" : ""} prête${photos.length > 1 ? "s" : ""} à être enregistrée${photos.length > 1 ? "s" : ""}` : "Jusqu’à 4 photos · JPG ou PNG · 2 Mo chacune"}</small></span></label>
            <label>Nom du signataire<input value={reportDraft.signatory} onChange={(event) => setReportDraft((current) => ({ ...current, signatory: event.target.value }))} maxLength={120} required /></label>
            <fieldset className="signature-field"><legend>Signature</legend><SignaturePad onChange={handleSignatureChange} /></fieldset>
            <div className="modal-actions">
              <span className="form-hint"><Icon name="cloud" size={15} /> Texte enregistré automatiquement en local</span>
              <button className="secondary-button" onClick={saveReportDraft} disabled={saving}>Fermer et garder le brouillon</button>
              <button className="primary-button" disabled={online !== true || saving || !reportSigned || !reportDraft.summary.trim() || !reportDraft.signatory.trim()} onClick={() => void finalizeReport()}>{saving ? <><span className="spinner" /> Finalisation…</> : <><Icon name="check" /> Finaliser et générer le PDF</>}</button>
            </div>
          </div>
        </Modal>
      )}

      {toast && (
        <div className={`toast toast-${toast.tone}`} role="status" aria-live="polite">
          <span>{toast.tone === "error" ? <Icon name="alert" /> : <Icon name="check" />}</span>
          <p>{toast.message}</p>
          <button onClick={() => setToast(null)} aria-label="Fermer la notification"><Icon name="x" size={15} /></button>
        </div>
      )}
    </div>
  );
}
