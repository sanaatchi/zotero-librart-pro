// @ts-nocheck
// @ajan: cursor · @etiket: f9.2.2, zotseek, logger
// Adapted from ZotSeek (MIT) src/utils/logger.ts — LibRart prefix + BasicTool import.

import { BasicTool } from "zotero-plugin-toolkit";

declare const Zotero: any;

export type LogLevel = "debug" | "info" | "warn" | "error";

export class Logger {
  private prefix: string;
  private debugEnabled: boolean;
  private ztoolkit: BasicTool;

  constructor(prefix: string) {
    this.prefix =
      prefix === "ZotSeek" || prefix === "LibRart"
        ? "[LibRart:ZotSeek]"
        : `[LibRart:ZotSeek:${prefix}]`;
    this.debugEnabled = true;
    this.ztoolkit = new BasicTool();
    this.ztoolkit.basicOptions.log.prefix = this.prefix;
    this.ztoolkit.basicOptions.log.disableConsole = false;
  }

  private log(level: string, ...args: any[]): void {
    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg),
      )
      .join(" ");
    this.ztoolkit.log(`[${level.toUpperCase()}] ${message}`);
    if (level === "error" && typeof Zotero !== "undefined" && Zotero.logError) {
      Zotero.logError(new Error(`${this.prefix} ${message}`));
    }
  }

  debug(...args: any[]): void {
    if (!this.debugEnabled) return;
    this.log("debug", ...args);
  }

  info(...args: any[]): void {
    this.log("info", ...args);
  }

  warn(...args: any[]): void {
    this.log("warn", ...args);
  }

  error(...args: any[]): void {
    this.log("error", ...args);
  }

  logObject(label: string, obj: any): void {
    this.ztoolkit.log(`${label}:`, obj);
  }

  getGlobal(name: string): any {
    return this.ztoolkit.getGlobal(name);
  }

  setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
  }
}
