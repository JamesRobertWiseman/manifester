import { Command } from "commander";
import {
  dashboardStatus,
  openDashboard,
  restartDashboard,
  startDashboard,
  stopDashboard,
} from "./actions.ts";

export function createDashboardCommand(): Command {
  const dashboard = new Command("dash")
    .description("Manage the dashboard")
    .action(dashboardStatus);

  dashboard.command("start").description("Start the dashboard").action(startDashboard);
  dashboard.command("stop").description("Stop the dashboard and application servers").action(stopDashboard);
  dashboard.command("restart").description("Restart the dashboard").action(restartDashboard);
  dashboard.command("status").description("Show whether the dashboard is running").action(dashboardStatus);
  dashboard.command("open").description("Start and open the dashboard").action(openDashboard);
  return dashboard;
}
