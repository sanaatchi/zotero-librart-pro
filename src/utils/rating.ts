import { config } from "../../package.json";

export { getRating, setRating, ratingStars, registerRatingColumn };

const RATING_LINE = /^Rate:\s*(\d)$/im;
const MAX_RATING = 5;

function getRating(item: Zotero.Item): number {
  const extra = (item.getField("extra") as string) || "";
  const m = extra.match(RATING_LINE);
  const n = m ? Number(m[1]) : 0;
  return Number.isFinite(n) ? Math.max(0, Math.min(MAX_RATING, n)) : 0;
}

/** 0 clears the rating line entirely. */
async function setRating(item: Zotero.Item, rating: number): Promise<void> {
  const n = Math.max(0, Math.min(MAX_RATING, Math.round(rating)));
  const extra = (item.getField("extra") as string) || "";
  let next: string;
  if (n === 0) {
    next = extra
      .replace(RATING_LINE, "")
      .replace(/\n{2,}/g, "\n")
      .trim();
  } else if (RATING_LINE.test(extra)) {
    next = extra.replace(RATING_LINE, `Rate: ${n}`);
  } else {
    next = extra ? `${extra}\nRate: ${n}` : `Rate: ${n}`;
  }
  item.setField("extra", next);
  await item.saveTx({ skipSelect: true, skipNotifier: true });
}

function ratingStars(n: number): string {
  if (!n) return "—";
  return "★".repeat(n) + "☆".repeat(MAX_RATING - n);
}

/**
 * Read-only display column via Zotero's public ItemTreeManager API
 * (Extra-field storage, same pattern as citationKey.ts). Rating is set
 * via the item context menu (see menu.ts) rather than in-cell click
 * hit-testing — avoids depending on ItemTree's private DOM structure.
 */
function registerRatingColumn() {
  try {
    Zotero.ItemTreeManager.registerColumn({
      dataKey: "rating",
      label: "Puan",
      pluginID: config.addonID,
      dataProvider: (item: Zotero.Item) => ratingStars(getRating(item)),
      flex: 0,
      width: "70",
      showInColumnPicker: true,
    });
  } catch (e) {
    ztoolkit.log("Rating column registration failed", e);
  }
}
