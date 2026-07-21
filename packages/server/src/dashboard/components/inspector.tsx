import type { ManagedApplication, ManagerActivity } from "../../contracts.ts";
import {
  inspectorActions,
  managementActions,
  publicationActions,
  publicationMessages,
  type ApplicationAction,
} from "../actions.ts";
import { activityTime, applicationName, compactProject, duration, EMPTY, time } from "../format.ts";
import { ActionButton, PixelMark, Status } from "./ui.tsx";

function InspectorActions({
  application,
  busy,
  onAction,
}: {
  application: ManagedApplication;
  busy: boolean;
  onAction(action: ApplicationAction): void;
}): React.ReactElement {
  const button = (action: ApplicationAction) => (
    <ActionButton key={action} action={action} busy={busy} onClick={() => onAction(action)} />
  );
  return (
    <>
      <div className="inspector-actions">
        {inspectorActions(application.status).map(button)}
        {application.publication ? publicationActions.map(button) : null}
      </div>
      {application.status === "generating" ? null : (
        <section className="management">
          <h3>Application management</h3>
          <p>Removing keeps the generated app and SQLite data. Deleting permanently removes both.</p>
          <div>{managementActions.map(button)}</div>
        </section>
      )}
    </>
  );
}

export function Inspector({
  application,
  activity,
  busy,
  onAction,
  onClose,
}: {
  application: ManagedApplication | undefined;
  activity: ManagerActivity[];
  busy: boolean;
  onAction(application: ManagedApplication, action: ApplicationAction): void;
  onClose(): void;
}): React.ReactElement {
  if (!application) return <aside className="inspector" aria-label="Application details" hidden />;
  const publication = application.publication;
  const publicationMessage = publication
    ? publication.ready
      ? publicationMessages.ready
      : publication.unresolvedActions.length
        ? `Open these features before publishing: ${publication.unresolvedActions.join(", ")}.`
        : publicationMessages.incomplete
    : undefined;
  const notice = application.message ?? application.stage;
  const projectActivity = activity.filter((entry) => entry.projectId === application.id);
  return (
    <aside className="inspector" aria-label="Application details">
      <div className="inspector-header">
        <div className="inspector-title"><PixelMark /><h2><span>Inspect:</span> {applicationName(application)}</h2></div>
        <button className="icon-button" disabled={busy} onClick={onClose} type="button" aria-label="Close inspection">×</button>
      </div>
      {notice ? <p className={`message${application.stage ? " progress-message" : ""}`}>{notice}</p> : null}
      <section className="panel">
        <h3>Server status</h3>
        <dl className="details">
          <div><dt>Status</dt><dd><Status application={application} /></dd></div>
          <div><dt>Project path</dt><dd title={application.project}><code>{compactProject(application.project)}</code></dd></div>
          <div><dt>Address</dt><dd><code>{application.address || EMPTY}</code></dd></div>
          <div><dt>Port</dt><dd><code>{application.port || EMPTY}</code></dd></div>
          <div><dt>Uptime</dt><dd>{duration(application.uptimeMs)}</dd></div>
          <div><dt>Started</dt><dd>{time(application.startedAt)}</dd></div>
          {application.codexTaskUrl
            ? <div><dt>Codex task</dt><dd><a className="session-link" href={application.codexTaskUrl}>Open application task</a></dd></div>
            : null}
        </dl>
      </section>
      <section className="panel activity-panel">
        <h3>Activity log</h3>
        {projectActivity.length > 0
          ? <ul className="activity">{projectActivity.map((entry) => <li key={entry.id}><time>{activityTime(entry.occurredAt)}</time><span>{entry.message}</span></li>)}</ul>
          : <p className="activity-empty">No recent server activity.</p>}
      </section>
      {publicationMessage
        ? <section className="panel"><h3>ChatGPT Sites</h3><p className="message">{publicationMessage}</p></section>
        : null}
      <InspectorActions application={application} busy={busy} onAction={(action) => onAction(application, action)} />
    </aside>
  );
}
