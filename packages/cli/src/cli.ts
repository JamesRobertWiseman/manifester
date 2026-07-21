#!/usr/bin/env node
import { Command } from "commander";
import packageMetadata from "../package.json" with { type: "json" };
import { createDashboardCommand } from "./dashboard/command.ts";

const program: Command = new Command()
  .name("mnf")
  .description("Manage Manifester")
  .version(packageMetadata.version, "-v, --version")
  .action(() => program.help())
  .addCommand(createDashboardCommand());

await program.parseAsync();
