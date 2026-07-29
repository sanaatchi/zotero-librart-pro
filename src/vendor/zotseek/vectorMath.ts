// @ajan: cursor · @etiket: f9.2.3, zotseek, vector-math
// Pure cosine similarity + top-K — no Zotero globals.

export type VectorHit = {
  itemId: number;
  similarity: number;
};

export { cosineSimilarity, topKSimilar };

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na <= 0 || nb <= 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function topKSimilar(
  query: number[],
  catalog: Array<{ itemId: number; embedding: number[] }>,
  options: {
    topK?: number;
    minSimilarity?: number;
    excludeItemIds?: number[];
  } = {},
): VectorHit[] {
  const topK = options.topK ?? 5;
  const minSimilarity = options.minSimilarity ?? 0.45;
  const exclude = new Set(options.excludeItemIds ?? []);
  const hits: VectorHit[] = [];

  for (const row of catalog) {
    if (exclude.has(row.itemId)) continue;
    const similarity = cosineSimilarity(query, row.embedding);
    if (similarity < minSimilarity) continue;
    hits.push({ itemId: row.itemId, similarity });
  }

  hits.sort((a, b) => b.similarity - a.similarity);
  return hits.slice(0, topK);
}
