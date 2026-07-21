import type { KeyboardEvent } from "react";
import type { ManagedApplication } from "../../contracts.ts";
import { rowActions, type ApplicationAction } from "../actions.ts";
import { applicationName, duration, EMPTY, projectName } from "../format.ts";
import { ActionButton, CubeIcon, Status } from "./ui.tsx";

function RowActions({
  application,
  busy,
  onAction,
}: {
  application: ManagedApplication;
  busy: boolean;
  onAction(application: ManagedApplication, action: ApplicationAction): void;
}): React.ReactElement {
  const button = (action: ApplicationAction) => (
    <ActionButton
      key={action}
      action={action}
      busy={busy}
      onClick={(event) => {
        event.stopPropagation();
        onAction(application, action);
      }}
    />
  );
  return <>{rowActions(application.status).map(button)}</>;
}

function ApplicationRow({
  application,
  busy,
  selected,
  onAction,
  onSelect,
}: {
  application: ManagedApplication;
  busy: boolean;
  selected: boolean;
  onAction(application: ManagedApplication, action: ApplicationAction): void;
  onSelect(id: string): void;
}): React.ReactElement {
  const select = () => onSelect(application.id);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    select();
  };
  return (
    <article
      className={`application-row${selected ? " selected" : ""}`}
      onClick={select}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      <div className="application-name"><CubeIcon /><span className="truncate">{applicationName(application)}</span></div>
      <div className="project truncate" title={application.project}>{projectName(application.project)}</div>
      <div><Status application={application} /></div>
      <div className="address truncate">{application.address?.replace(/^https?:\/\//, "") || EMPTY}</div>
      <div className="uptime">{duration(application.uptimeMs)}</div>
      <div className="row-actions"><RowActions application={application} busy={busy} onAction={onAction} /></div>
    </article>
  );
}

export function ApplicationList({
  applications,
  busy,
  selectedId,
  onAction,
  onSelect,
}: {
  applications: ManagedApplication[];
  busy: boolean;
  selectedId: string | null;
  onAction(application: ManagedApplication, action: ApplicationAction): void;
  onSelect(id: string): void;
}): React.ReactElement {
  return (
    <div className="application-list" aria-label="Managed applications">
      <div className="list-heading" aria-hidden="true">
        <span>Application</span><span>Project</span><span>Status</span><span>Address</span><span>Uptime</span><span>Actions</span>
      </div>
      <div aria-live="polite">
        {applications.length === 0
          ? <div className="empty"><h2>No applications yet</h2><p>Create an application in Codex and it will appear here automatically.</p></div>
          : applications.map((application) => (
            <ApplicationRow
              key={application.id}
              application={application}
              busy={busy}
              selected={application.id === selectedId}
              onAction={onAction}
              onSelect={onSelect}
            />
          ))}
      </div>
    </div>
  );
}
