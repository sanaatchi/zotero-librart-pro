// @ajan: cursor · @etiket: f4, reading-flow, tracker
// Adapted from zotero-reading-flow readerTracker.ts (MIT)

import type { ReadingFlowStore } from "../vendor/reading-flow/readingFlowStore";

export { ReadingTracker };

class ReadingTracker {
  private dataStore: ReadingFlowStore;
  private notifierId: string | null = null;
  private saveTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private active = false;
  private generation = 0;
  private static readonly MAX_REASONABLE_PAGE_COUNT = 100000;
  private readonly observer = {
    notify: (action: string, type: string, ids: number[] | string[]) => {
      this.notify(action, type, ids);
    },
  };

  constructor(dataStore: ReadingFlowStore) {
    this.dataStore = dataStore;
  }

  register() {
    this.generation += 1;
    this.active = true;
    this.notifierId = Zotero.Notifier.registerObserver(
      this.observer,
      ["file"],
      "LibRartReadingTracker",
    );
  }

  unregister() {
    this.active = false;
    this.generation += 1;
    if (this.notifierId) {
      Zotero.Notifier.unregisterObserver(this.notifierId);
      this.notifierId = null;
    }
    for (const timeout of this.saveTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.saveTimeouts.clear();
  }

  notify(action: string, type: string, ids: number[] | string[] | number) {
    if (!this.active || this.isZoteroShuttingDown()) return;
    if (type !== "file" || action !== "pageChange") return;
    const attachmentIds = (Array.isArray(ids) ? ids : [ids]).map((id) =>
      Number(id),
    );
    for (const attachmentId of attachmentIds) {
      void this.handlePageChange(attachmentId);
    }
  }

  private async handlePageChange(attachmentId: number) {
    const readers = Zotero.Reader._readers as Array<{
      itemID?: number;
      _type?: string;
      _state?: {
        pageIndex?: number;
        scrollYPercent?: number;
        numPages?: number;
      };
      _internalReader?: {
        _state?: { pageIndex?: number; numPages?: number };
        _primaryView?: {
          _state?: { numPages?: number };
          _iframeWindow?: Window;
        };
        _iframeWindow?: Window;
      };
      _iframeWindow?: Window;
      PDFViewerApplication?: {
        pdfDocument?: { numPages?: number };
        pdfViewer?: { pagesCount?: number; _pages?: unknown[] };
        pagesCount?: number;
        _pagesCount?: number;
        _numPages?: number;
      };
      _numPages?: number;
      _primaryView?: { _state?: { numPages?: number } };
    }>;

    const reader = readers?.find(
      (r) => this.toPositiveInt(r?.itemID) === attachmentId,
    );

    const item = Zotero.Items.get(attachmentId);
    if (!item) return;
    const parentId = item.parentID;
    if (!parentId) return;

    let progress = 0;
    let pdfNumPages = 0;
    if (reader?._type === "pdf" || item.isPDFAttachment?.()) {
      const pageIndex = this.getCurrentPageIndex(reader, item) ?? 0;
      pdfNumPages = this.getPDFPageCount(reader, item);
      if (pdfNumPages > 0) {
        progress = Math.min(pageIndex + 1, pdfNumPages) / pdfNumPages;
      }
    } else if (reader?._type === "epub" || reader?._type === "snapshot") {
      const savedPosition = item.getAttachmentLastPageIndex?.();
      progress =
        typeof savedPosition === "number"
          ? savedPosition
          : reader?._state?.scrollYPercent || 0;
    }

    progress = this.normalizeProgress(progress);
    if (progress === 0) return;

    const isPdfWithPages =
      (reader?._type === "pdf" || item.isPDFAttachment?.()) && pdfNumPages > 0;
    const lastPage = isPdfWithPages
      ? this.getLastPage(reader, item, pdfNumPages)
      : null;
    const pageCount = isPdfWithPages ? pdfNumPages : null;
    this.debounceSave(
      parentId,
      String(attachmentId),
      progress,
      lastPage,
      pageCount,
    );
  }

  private debounceSave(
    parentId: number,
    attachmentId: string,
    progress: number,
    lastPage: number | null,
    pageCount: number | null,
  ) {
    const key = `${parentId}:${attachmentId}`;
    const existingTimeout = this.saveTimeouts.get(key);
    if (existingTimeout) clearTimeout(existingTimeout);
    const generation = this.generation;
    const scheduledAt = Date.now();
    const timeout = setTimeout(async () => {
      this.saveTimeouts.delete(key);
      if (this.shouldSkipSave(generation)) return;
      try {
        const parentItem = await Zotero.Items.getAsync(parentId);
        if (this.shouldSkipSave(generation)) return;
        if (parentItem) {
          if (this.wasParentResetAfter(parentId, scheduledAt)) return;
          await this.dataStore.recordProgress(parentItem, {
            attachmentId,
            progress,
            pageCount,
            lastPage,
            at: Date.now(),
          });
          if (this.shouldSkipSave(generation)) return;
          Zotero.ItemTreeManager.refreshColumns?.();
          Zotero.Notifier.trigger("refresh", "item", [parentId]);
        }
      } catch (e) {
        ztoolkit.log("ReadingTracker save failed", e);
      }
    }, 5000);
    this.saveTimeouts.set(key, timeout);
  }

  private isZoteroShuttingDown(): boolean {
    const startup = (
      globalThis as { Services?: { startup?: { shuttingDown?: boolean } } }
    ).Services?.startup;
    return Boolean(startup?.shuttingDown);
  }

  private shouldSkipSave(generation: number): boolean {
    return (
      !this.active ||
      generation !== this.generation ||
      this.isZoteroShuttingDown()
    );
  }

  private wasParentResetAfter(parentId: number, timestamp: number): boolean {
    const resetAt = this.dataStore.getResetTimestamp(parentId);
    return typeof resetAt === "number" && resetAt > timestamp;
  }

  private normalizeProgress(progress: number): number {
    if (!Number.isFinite(progress)) return 0;
    if (progress <= 0) return 0;
    return progress > 1 ? Math.round(progress) : Math.min(1, progress);
  }

  private getLastPage(
    reader: unknown,
    item: Zotero.Item,
    maxPage?: number,
  ): number | null {
    const pageIndex = this.getCurrentPageIndex(reader, item);
    if (typeof pageIndex !== "number" || !Number.isFinite(pageIndex))
      return null;
    const page = pageIndex + 1;
    if (!maxPage || maxPage <= 0) return page;
    return Math.min(page, maxPage);
  }

  private getCurrentPageIndex(
    reader: unknown,
    item: Zotero.Item,
  ): number | null {
    const r = reader as {
      _state?: { pageIndex?: number };
      _internalReader?: { _state?: { pageIndex?: number } };
    } | null;
    const livePageIndex =
      r?._state?.pageIndex ?? r?._internalReader?._state?.pageIndex;
    if (
      typeof livePageIndex === "number" &&
      Number.isFinite(livePageIndex) &&
      livePageIndex >= 0
    ) {
      return livePageIndex;
    }

    const savedPageIndex = item.getAttachmentLastPageIndex?.();
    if (
      typeof savedPageIndex === "number" &&
      Number.isFinite(savedPageIndex) &&
      savedPageIndex >= 0
    ) {
      return savedPageIndex;
    }

    return null;
  }

  private getPDFPageCount(reader: unknown, item: Zotero.Item): number {
    const r = reader as {
      _internalReader?: {
        _primaryView?: {
          _iframeWindow?: Window & { PDFViewerApplication?: PdfApp };
        };
        _iframeWindow?: Window & { PDFViewerApplication?: PdfApp };
      };
      _iframeWindow?: Window & { PDFViewerApplication?: PdfApp };
      PDFViewerApplication?: PdfApp;
      _numPages?: number;
      _state?: { numPages?: number };
      _primaryView?: { _state?: { numPages?: number } };
    } | null;

    type PdfApp = {
      pdfDocument?: { numPages?: number };
      pdfViewer?: { pagesCount?: number; _pages?: unknown[] };
      pagesCount?: number;
      _pagesCount?: number;
      _numPages?: number;
    };

    const primaryWindow =
      r?._internalReader?._primaryView?._iframeWindow?.wrappedJSObject ??
      r?._internalReader?._primaryView?._iframeWindow ??
      r?._iframeWindow?.wrappedJSObject ??
      r?._iframeWindow;
    const readerWindow =
      r?._internalReader?._iframeWindow?.wrappedJSObject ??
      r?._internalReader?._iframeWindow ??
      r?._iframeWindow?.wrappedJSObject ??
      r?._iframeWindow;
    const app =
      primaryWindow?.PDFViewerApplication ??
      readerWindow?.PDFViewerApplication ??
      r?.PDFViewerApplication;

    const itemPageCount = this.toPositiveInt(
      item.getField?.("numPages") ??
        item.getField?.("pages") ??
        item.getField?.("numPagesRaw") ??
        item.getField?.("pageCount"),
    );
    const normalizedItemPageCount =
      itemPageCount > 0 &&
      itemPageCount <= ReadingTracker.MAX_REASONABLE_PAGE_COUNT
        ? itemPageCount
        : undefined;
    const normalizedReaderPageCount = this.toPositiveInt(
      app?.pdfDocument?.numPages ??
        app?.pdfViewer?.pagesCount ??
        app?.pdfViewer?._pages?.length ??
        app?.pagesCount ??
        app?._pagesCount ??
        app?._numPages ??
        r?._numPages ??
        (r?._internalReader as { _state?: { numPages?: number } } | undefined)
          ?._state?.numPages ??
        r?._primaryView?._state?.numPages,
    );

    if (!normalizedReaderPageCount) {
      return normalizedItemPageCount ?? 0;
    }

    if (normalizedReaderPageCount > ReadingTracker.MAX_REASONABLE_PAGE_COUNT) {
      return 0;
    }

    if (
      normalizedItemPageCount &&
      normalizedItemPageCount !== normalizedReaderPageCount &&
      Math.abs(normalizedReaderPageCount - normalizedItemPageCount) > 1
    ) {
      return normalizedItemPageCount;
    }

    return normalizedItemPageCount ?? normalizedReaderPageCount;
  }

  private toPositiveInt(value: unknown): number {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return Math.round(value);
    }

    if (typeof value !== "string") return 0;

    const match = value.match(/\d+/);
    if (!match) return 0;

    const parsed = Number(match[0]);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
  }
}
