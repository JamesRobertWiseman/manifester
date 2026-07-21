import open from "open";
import {
  MANAGER_ADDRESS,
  liveCodexOwners,
  managerHealth,
  startManagerProcess,
  stopManagerProcess,
} from "@manifester/server";

export async function startDashboard(): Promise<void> {
  const health = await startManagerProcess((await liveCodexOwners()).length > 0);
  console.log(`Manifester Dashboard running at ${health.address}`);
}

export async function stopDashboard(): Promise<void> {
  console.log(await stopManagerProcess()
    ? "Manifester Dashboard stopped"
    : "Manifester Dashboard is already stopped");
}

export async function restartDashboard(): Promise<void> {
  await stopManagerProcess();
  await startDashboard();
}

export async function dashboardStatus(): Promise<void> {
  const health = await managerHealth();
  console.log(health
    ? `Manifester Dashboard is running at ${health.address} (${health.ownership})`
    : "Manifester Dashboard is stopped");
}

export async function openDashboard(): Promise<void> {
  await startDashboard();
  await open(MANAGER_ADDRESS);
}
