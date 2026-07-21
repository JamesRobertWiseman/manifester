import type { MouseEventHandler } from "react";
import type { ManagedApplication } from "../../contracts.ts";
import { actionMetadata, type ApplicationAction } from "../actions.ts";
import { displayStatus, statusClass } from "../format.ts";

export function ActionButton({
  action,
  busy,
  onClick,
}: {
  action: ApplicationAction;
  busy: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
}): React.ReactElement {
  const metadata = actionMetadata[action];
  return (
    <button
      className={`button small ${"danger" in metadata && metadata.danger ? "danger" : "secondary"}`}
      disabled={busy}
      onClick={onClick}
      type="button"
    >
      {metadata.label}
    </button>
  );
}

export function Status({ application }: { application: ManagedApplication }): React.ReactElement {
  return <span className={`status ${statusClass(application)}`}>{displayStatus(application)}</span>;
}

export function PixelMark(): React.ReactElement {
  return <span className="pixel-mark" aria-hidden="true"><i /><i /><i /><i /><i /></span>;
}

export function CubeIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m12 2.8 8.3 4.6v9.2L12 21.2l-8.3-4.6V7.4L12 2.8Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="m3.9 7.5 8.1 4.6 8.1-4.6M12 12.1v9" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
