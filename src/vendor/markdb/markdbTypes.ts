// @ajan: cursor · @etiket: f8, markdb, vendor
// Types inspired by zotero-markdb-connect Entry (MIT, Sean Dae Houlihan).

export type MarkdbMatchStrategy = "citekeyyaml" | "zotitemkey";

export type MarkdbParsedNote = {
  name: string;
  path: string;
  /** Primary Better BibTeX / filename citekey (may be empty). */
  primaryCitekey: string;
  /** Primary Zotero item key when matched via zotitemkey strategy. */
  primaryItemKey: string;
  /** Other citekeys referenced in the note body. */
  refCitekeys: string[];
  /** Other Zotero item keys referenced in the note body. */
  refItemKeys: string[];
};

export type MarkdbEdgeCandidate = {
  sourceItemId: number;
  targetItemId: number;
  viaPath: string;
  confidence: number;
};
