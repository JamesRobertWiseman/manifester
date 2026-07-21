import { useCallback, useEffect, useRef, useState } from "react";
import type { ManagedApplication, ManagerActivity } from "../contracts.ts";
import { actionMetadata, publicationMessages, type ApplicationAction } from "./actions.ts";
import { loadDashboard, mutateApplication, toErrorMessage } from "./api.ts";
import { applicationName } from "./format.ts";

export function useDashboard(): {
  applications: ManagedApplication[];
  activity: ManagerActivity[];
  busy: boolean;
  selectedId: string | null;
  toast: string | null;
  refresh(): void;
  select(id: string | null): void;
  runAction(application: ManagedApplication, action: ApplicationAction): void;
} {
  const [applications, setApplications] = useState<ManagedApplication[]>([]);
  const [activity, setActivity] = useState<ManagerActivity[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const selectionReady = useRef(false);
  const busyRef = useRef(false);
  const loadSequence = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3_200);
  }, []);

  const load = useCallback(async (silent: boolean) => {
    const sequence = ++loadSequence.current;
    try {
      const next = await loadDashboard();
      if (sequence !== loadSequence.current) return;
      setApplications(next.applications);
      setActivity(next.activity);
      setSelectedId((current) => {
        if (!selectionReady.current) {
          selectionReady.current = true;
          return next.applications[0]?.id ?? null;
        }
        return current && !next.applications.some(({ id }) => id === current)
          ? next.applications[0]?.id ?? null
          : current;
      });
    } catch (error) {
      if (sequence === loadSequence.current && !silent) showToast(toErrorMessage(error));
    }
  }, [showToast]);

  useEffect(() => {
    void load(false);
    const poll = setInterval(() => {
      if (!busyRef.current) void load(true);
    }, 3_000);
    return () => {
      loadSequence.current += 1;
      clearInterval(poll);
      clearTimeout(toastTimer.current);
    };
  }, [load]);

  const changeBusy = (value: boolean) => {
    busyRef.current = value;
    setBusy(value);
  };

  const runAction = (application: ManagedApplication, action: ApplicationAction) => {
    if (action === "open") {
      if (application.address) window.open(application.address, "_blank", "noopener");
      return;
    }
    if (action === "inspect") {
      setSelectedId(application.id);
      return;
    }
    if (action === "publish") {
      if (!application.publication?.ready) {
        showToast(application.publication?.unresolvedActions.length
          ? publicationMessages.unresolved
          : publicationMessages.incomplete);
        return;
      }
      showToast(publicationMessages.instruction);
      window.open(application.publication.taskUrl, "_blank", "noopener");
      return;
    }

    const name = applicationName(application);
    const metadata = actionMetadata[action];
    if ("confirmation" in metadata && !window.confirm(metadata.confirmation(name))) return;
    loadSequence.current += 1;
    changeBusy(true);
    void (async () => {
      try {
        await mutateApplication(application.id, action);
        if (action === "remove" || action === "delete") setSelectedId(null);
        await load(true);
        showToast(`${name} ${metadata.result}`);
      } catch (error) {
        showToast(toErrorMessage(error));
      } finally {
        changeBusy(false);
      }
    })();
  };

  return {
    applications,
    activity,
    busy,
    selectedId,
    toast,
    refresh: () => void load(false),
    select: setSelectedId,
    runAction,
  };
}
