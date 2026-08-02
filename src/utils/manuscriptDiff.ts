// @ajan: cursor · @etiket: manuscript-diff, makale-yazim, pure
/** Cited-in-manuscript vs library/collection scope (clean-room). */

export type ManuscriptDiffInput = {
  /** Item IDs tagged as used in the DOCX (cited:…). */
  citedIds: Iterable<number>;
  /** Scope to compare against (collection / selection). */
  scopeIds: Iterable<number>;
};

export type ManuscriptDiffResult = {
  citedInScope: number[];
  unusedInScope: number[];
  citedOutsideScope: number[];
  citedCount: number;
  scopeCount: number;
};

export function computeManuscriptDiff(
  input: ManuscriptDiffInput,
): ManuscriptDiffResult {
  const cited = new Set<number>();
  for (const id of input.citedIds) {
    if (Number.isFinite(id) && id > 0) cited.add(id);
  }
  const scope = new Set<number>();
  for (const id of input.scopeIds) {
    if (Number.isFinite(id) && id > 0) scope.add(id);
  }

  const citedInScope: number[] = [];
  const unusedInScope: number[] = [];
  const citedOutsideScope: number[] = [];

  for (const id of cited) {
    if (scope.has(id)) citedInScope.push(id);
    else citedOutsideScope.push(id);
  }
  for (const id of scope) {
    if (!cited.has(id)) unusedInScope.push(id);
  }

  citedInScope.sort((a, b) => a - b);
  unusedInScope.sort((a, b) => a - b);
  citedOutsideScope.sort((a, b) => a - b);

  return {
    citedInScope,
    unusedInScope,
    citedOutsideScope,
    citedCount: cited.size,
    scopeCount: scope.size,
  };
}

export function formatManuscriptDiffSummary(args: {
  tag: string;
  result: ManuscriptDiffResult;
  labels: {
    title: string;
    cited: string;
    unused: string;
    outside: string;
  };
}): string {
  const { tag, result, labels } = args;
  return [
    `${labels.title}: ${tag}`,
    labels.cited
      .replace("{cited}", String(result.citedCount))
      .replace("{inScope}", String(result.citedInScope.length)),
    labels.unused.replace("{unused}", String(result.unusedInScope.length)),
    labels.outside.replace("{outside}", String(result.citedOutsideScope.length)),
  ].join("\n");
}
