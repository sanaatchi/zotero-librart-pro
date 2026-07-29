// Adapted from inciteful-zotero-plugin (AGPL-3.0-or-later) src/modules/inciteful.ts

import { getString } from "../../utils/locale";

interface QueryParam {
  param: string;
  value: string;
}

class QueryParams {
  params: Array<QueryParam> = [];

  append(param: string, value: string) {
    this.params.push({ param, value });
  }

  toString(): string {
    return this.params
      .map((p) => `${p.param}=${encodeURIComponent(p.value)}`)
      .join("&");
  }
}

function alertDialog(message: string) {
  ztoolkit.getGlobal("alert")(message);
}

export function openIncitefulSearch(ids: Array<string>) {
  if (ids.length === 0) {
    alertDialog(getString("inciteful-error-no-item"));
    return;
  }

  const params = new QueryParams();
  ids.forEach((id) => params.append("ids[]", id));
  launchURL("https://inciteful.xyz/p", params);
}

export function openIncitefulConnector(from: string, to: string | null) {
  const params = new QueryParams();
  params.append("from", from);
  if (to != null) params.append("to", to);
  params.append("extendedGraph", "true");
  launchURL("https://inciteful.xyz/c", params);
}

function launchURL(url: string, params: QueryParams) {
  addTrackingParams(params);
  if (params.params.length > 0) {
    url = `${url}?${params.toString()}`;
  }
  Zotero.launchURL(url);
}

function addTrackingParams(params: QueryParams) {
  params.append("utm_source", "zotero");
  params.append("utm_medium", "addon");
  params.append("utm_campaign", "librart-pro");
  params.append("utm_content", "inciteful-bridge");
}

export function getIDsFromItems(items: Array<Zotero.Item>): Array<string> {
  const topLevelItems = ensureTopLevelItems(items);
  const ids: string[] = [];

  for (const item of topLevelItems) {
    const doi = item.getField("DOI");
    if (doi != null && doi !== "") {
      ids.push(doi.toString());
      continue;
    }
    const url = item.getField("url");
    if (url != null && url !== "") ids.push(url.toString());
  }

  ztoolkit.log("Inciteful IDs:", ids);
  return ids;
}

function ensureTopLevelItems(items: Array<Zotero.Item>): Array<Zotero.Item> {
  const topLevelItems: Zotero.Item[] = [];
  for (const item of items) {
    if (item.isTopLevelItem()) {
      topLevelItems.push(item);
    } else {
      const parent = item.topLevelItem;
      if (parent != null) topLevelItems.push(parent);
    }
  }
  return topLevelItems;
}
