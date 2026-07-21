import bannerUrl from "../../../../assets/manifester-banner.png";
import type { ManagedApplication } from "../contracts.ts";
import { ApplicationList } from "./components/application-list.tsx";
import { Inspector } from "./components/inspector.tsx";
import { PixelMark } from "./components/ui.tsx";
import { useDashboard } from "./use-dashboard.ts";

export function Dashboard(): React.ReactElement {
  const state = useDashboard();
  const count = (status: ManagedApplication["status"]) =>
    state.applications.filter((application) => application.status === status).length;
  const running = count("running");
  const generating = count("generating");
  const attention = count("failed") + count("blocked");
  const selected = state.applications.find((application) => application.id === state.selectedId);
  return (
    <>
      <header className="topbar">
        <a className="brand" href="/" aria-label="Manifester Manager">
          <span className="brand-crop"><img src={bannerUrl} alt="Manifester" /></span>
        </a>
        <span className="manager-status"><span className="status-dot" />Manager online</span>
      </header>
      <main className="shell">
        <section className="workspace" aria-labelledby="page-title">
          <div className="title-row">
            <div className="title-lockup">
              <PixelMark />
              <div><h1 id="page-title">Applications</h1><p>Manage your local Manifester applications</p></div>
            </div>
            <button className="button secondary" disabled={state.busy} onClick={state.refresh} type="button"><span aria-hidden="true">↻</span>Refresh</button>
          </div>
          <dl className="summary" aria-label="Application summary">
            <div><dt>applications</dt><dd>{state.applications.length}</dd></div>
            <div><dt>running</dt><dd>{running}</dd></div>
            <div><dt>in progress</dt><dd>{generating}</dd></div>
            <div><dt>needs attention</dt><dd>{attention}</dd></div>
          </dl>
          <ApplicationList
            applications={state.applications}
            busy={state.busy}
            selectedId={state.selectedId}
            onAction={state.runAction}
            onSelect={state.select}
          />
        </section>
        <Inspector
          application={selected}
          activity={state.activity}
          busy={state.busy}
          onAction={state.runAction}
          onClose={() => state.select(null)}
        />
      </main>
      <div className="toast" role="status" aria-live="polite" hidden={!state.toast}>{state.toast}</div>
    </>
  );
}
