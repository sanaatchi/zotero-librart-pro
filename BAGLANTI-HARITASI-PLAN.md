# Bağlantı Haritası (Connection Map) — v1 Uygulama Planı

> Bu dosya, onaylanmış v1 planının ortak referansıdır. Cursor / Claude Code / GPT Codex gibi bu depo üzerinde eş zamanlı çalışan araçlar aynı plana bakmalıdır.
>
> **Çakışma uyarısı:** İmplementasyon başlamadan veya bu dosyayı değiştirmeden önce `git status` / `git log` ile başka bir oturumun aynı dosyaları düzenleyip düzenlemediğini kontrol edin.

**Kapsam kökü:** `zotero-actions-tags-2.5.2/` (plugin kaynak ağacı)

**Doğrulanmış kaynaklar:** `src/hooks.ts`, `src/modules/menu.ts`, `src/modules/tagDashboard.ts`, `src/modules/notify.ts`, `src/utils/tagAnalysis.ts`, `src/utils/tagActions.ts`, `src/utils/window.ts`, `src/utils/hint.ts`, `src/utils/items.ts`, `src/utils/prefs.ts`, `src/addon.ts`, `addon/content/tag-dashboard.xhtml`, `addon/locale/tr-TR/addon.ftl`, `package.json`

**Referans (kopyalanmayacak):** `zotero-style-6.0.8/src/modules/graphView.ts`, `zotero-reference-1.7.2/src/modules/connectedpapers.ts`

---

## Context

Kullanıcı disiplinlerarası/multidisipliner/transdisipliner makaleler yazıyor ve Zotero kütüphanesindeki kaynaklar arasında bu köprüleri **görselleştirmek ve aktif olarak kurmak** için interaktif bir araç istiyor. Önceki oturumlarda etiket temizliği (663→616 etiket) yapıldı ve mevcut "Etiket Analizi" (Tag Dashboard) özelliği inşa edildi — bu özellik hem mimari şablon hem de veri katmanı (`tagAnalysis.ts`, `tagActions.ts`) olarak yeniden kullanılacak.

Kullanıcının kütüphanesinde `relatedItem` alanı boş — yani atıf/ilişki katmanı otomatik çıkarım değil, **kullanıcının bilinçli kurduğu** bir katman olacak. Kullanıcı ayrıca ZotSeek (yerel anlamsal arama), Better Notes (not/vurgu bağlantıları) gibi zaten kullandığı araçların bu haritayı **pasif olarak** (normal okuma/not-alma esnasında) beslemesini istiyor.

Bu plan sadece **v1**'i kapsıyor; veri modeli v1.1/v2'nin mimariyi bozmadan eklenebilmesi için esnek tasarlandı.

**v1 sonrası (kapsam dışı, ama mimari yer bırakıyor):**

1. Otomatik disiplin profili sınıflandırması
2. Köprü-puanına göre düğüm boyutlandırma
3. Taslak paragraf → ZotSeek kaynak önerisi
4. Kör-nokta (izole disiplin kümesi) tespiti
5. Bağlantı geçmişi/zaman çizelgesi
6. SVG/PNG dışa aktarım

---

## 0. Naming and scope conventions

| Anahtar | Değer |
|--------|--------|
| `config.addonRef` | `zoterotag` |
| `config.addonInstance` | `ActionsTags` |
| `config.prefsPrefix` | `extensions.actionsTags` |

- Yeni DOM/window ID'leri: `zoterotag-connection-map-*` (dashboard'daki `zoterotag-dashboard-*` ile aynı kalıp)
- v1 katmanları: **A** tag, **B** manual, **C** semantic (ZotSeek), **D** note/highlight — D(iii) feature flag arkasında, varsayılan kapalı, ship'i bloklamaz

---

## Dört katman

- **A. Etiket** (otomatik) — ortak etiket paylaşan kaynaklar arası kenar; farklı disiplinden (üst-düzey koleksiyon) kaynaklar arasındaki kenarlar görsel olarak vurgulanır ("disiplinlerarası köprü").
- **B. Elle-bağlantı** — kullanıcı grafikte iki düğüme tıklayıp kalıcı bağlantı kurar (`relatedItem`, çift yönlü). Farklı disiplinden kaynaklar bağlanınca, aralarında zaten yakın bir etiket yoksa, ortak bir "köprü etiketi" önerilir.
- **C. Anlamsal öneri** — ZotSeek `findSimilar()` ile düşük-güven önerilen kenarlar (kesikli çizgi); onaylanınca B ile aynı mekanizmayla kalıcılaşır. ZotSeek yoksa/hazır değilse katman UI'dan tamamen gizlenir.
- **D. Not/vurgu-içi atıf**
  - (i) native Zotero citation span'leri
  - (ii) Better Notes wikilink'leri → yüksek güven, otomatik `relatedItem` (Notifier, not kaydı)
  - (iii) highlight → ZotSeek semantik arama → düşük güven öneri; **`connectionMapEnableHighlightLayer` pref, varsayılan kapalı** (stub olabilir)

---

## 1. Veri modeli — `src/utils/connectionGraph.ts` (yeni)

```ts
export type LayerKind = "tag" | "manual" | "semantic" | "note";
export type ConnectionState = "confirmed" | "suggested";

export type GraphNode = {
  itemID: number;
  key: string;
  libraryID: number;
  title: string;
  creatorSummary: string; // "Author et al." — label için önceden hesaplanır
  itemType: string;
  year?: number;
  // v1 disiplin: üst-düzey koleksiyon üyeliği
  disciplineIDs: number[];
  disciplineLabels: string[];
  // v1'de undefined; v1.1 yer tutucusu (tip migrasyonu gerekmesin)
  disciplineProfile?: DisciplineProfile;
  tagCount: number;
};

export type DisciplineProfile = {
  primary: string;
  scores: Record<string, number>;
  source: "collection" | "tags" | "embedding";
};

export type GraphEdge = {
  id: string; // stabil sentetik id — bkz. §1.4
  source: number; // itemID
  target: number; // itemID
  layer: LayerKind;
  state: ConnectionState;
  confidence: number; // 0..1; confirmed → 1
  viaTags?: string[]; // sadece layer "tag"
  viaNoteID?: number; // sadece layer "note"
  viaNoteSource?: "citation-span" | "better-notes-wikilink" | "highlight-semantic";
  crossDiscipline: boolean; // ortak disciplineID yoksa true
  createdAt?: string; // ISO; relatedItem'da native yok — best-effort
};

export type ConnectionGraph = {
  libraryID: number;
  nodes: Map<number, GraphNode>;
  edges: GraphEdge[];
  generatedAt: string;
};
```

### Tasarım notları

- zotero-style'ın `{nodes: {links: {...}}}` adjacency map'i **kopyalanmaz**. `edges: GraphEdge[]` şart — layer/state/confidence/crossDiscipline/provenance boolean'a sığmaz.
- `Map<itemID, GraphNode>` O(1) lookup için kalır.
- `crossDiscipline` **graf oluşturma anında** hesaplanır (renderer dumb consumer).
- Node her zaman top-level regular item; attachment/note parent'a çözülür.

### 1.3 Disiplin heuristic (v1)

- `item.getCollections()` → yalnızca `parentID == null` olanlar → `disciplineIDs` / `disciplineLabels`
- Hiç üst-düzey koleksiyon yoksa sentinel `-1` / `"Unsorted"`
- `crossDiscipline`: kesişim boş **ve** her ikisi de yalnızca unsorted değil (unsorted↔unsorted highlight yok — bilinçli karar)
- Renderer `getNodeDisciplineKey(node)` accessor kullanır; v1.1 sadece bu fonksiyonun gövdesini değiştirir

### 1.4 Edge ID scheme

```
id = [layer, min(source,target), max(source,target), viaTags?.join("+") ?? viaNoteID ?? ""].join("::")
```

Deterministik, sıra-bağımsız; DOM/SVG diff ve seçim state için stabil anahtar.

### 1.5 Persistence split

| Layer | State | Persist | Cache |
|-------|-------|---------|-------|
| A Tag | görsel confirmed-looking, gerçek relation değil | Yok — her açılışta yeniden türetilir | `addon.data.connectionMap.lastGraph` (bellek) |
| B Manual | confirmed | `addRelatedItem` + `saveTx({skipSelect:true, skipNotifier:true})` her iki item'da (connectedpapers deseni); okuma: `item.relatedItems` | Yok (SSOT = relatedItem) |
| C Semantic | suggested → accept → confirmed | Öneriler persist edilmez; accept = B ile aynı | Session `semanticCache?: Map<itemID, SearchResult[]>` |
| D(i)/(ii) | HIGH → auto-promote relatedItem | Notifier "note saved" → `recordConfirmedConnection` | Promote sonrası gerekmez |
| D(iii) | LOW suggested | Accept'e kadar yok | Session, C gibi |

**Yeni SQLite / JSON dosyası YOK.** Gerekçe: projede private data file precedent yok; AGPL/toolkit Zotero.Item içinde kalmayı tercih eder; relatedItem sync + "İlgili" UI ücretsiz gelir.

### 1.6 Confirmed edge metadata kaybı

`relatedItem` payload taşımaz → confirmed olduktan sonra layer/viaTags/createdAt best-effort/undefined; UI düz "confirmed" + default `layer: "manual"` gösterebilir.

**v1 kararı:** log yazma. Tüm B/C/D onayları tek `recordConfirmedConnection()` hunisinden geçer → v1.1 timeline log'u tek satır ekleme olur. Pref'te büyüyen array kötü fit; ayrı tasarım (item-note JSON vs tiny store) sonra.

---

## 2. Dosya planı

### Yeni `src/utils/`

| Dosya | Ayna | Sorumluluk |
|-------|------|------------|
| `connectionGraph.ts` | `tagAnalysis.ts` | Tipler, `buildConnectionGraph`, `getNodeDisciplineKey`. ZotSeek çağırmaz. `foldTag`/`categorize`/`similarity` import. |
| `connectionTagLayer.ts` | graphView `getGraphByItemArrLink` yaklaşımı | `computeTagLayerEdges` — foldTag ile, %90 persentil hub vs pairwise; hub node yoksa yoğun etiketlerde clique skip (hairball). |
| `connectionSemanticLayer.ts` | — | `isZotSeekReady()`, `computeSemanticSuggestions`. Yoksa `{available:false, edges:[]}`. Union approx: B∈findSimilar(A) ∨ A∈findSimilar(B). |
| `connectionNoteLayer.ts` | — | (i) citation span parse (ii) BN wikilink HTML parse — iç modül yok (iii) `computeHighlightSemanticEdges()` stub + pref |
| `connectionActions.ts` | `tagActions.ts` | `confirmManualConnection`, `acceptSuggestedConnection`, `removeConnection`, `offerBridgeTag`; hepsi `recordConfirmedConnection` |
| `connectionNotify.ts` | `notify.ts` pattern, scoped | `register`/`unregister` window lifecycle; debounce ~800ms; D auto-promote |

**Gerekli küçük değişiklik:** `tagAnalysis.ts` — `similarity` export listesine ekle (henüz yoksa).

### Yeni `src/modules/`

| Dosya | Ayna | Sorumluluk |
|-------|------|------------|
| `connectionMap.ts` | `tagDashboard.ts` | Window lifecycle, `connection-map.xhtml`, `width=1280,height=920`, addon-scope init, note observer register/unregister |
| `connectionMapRenderer.ts` | (bilinçli sapma) | SVG + hand-rolled force-sim; pan/zoom; click→selectItem; connect gesture; layer filter |

### Entegrasyon değişiklikleri

- **`hooks.ts`:** `initConnectionMapMenu()` in `onMainWindowLoad`; `onOpenConnectionMap` / `onConnectionMapLoad`
- **`menu.ts`:** `initConnectionMapMenu()` — Tools menü, `menu-connection-map`
- **`addon.ts`:** `connectionMap: { window?: Window; semanticCache?: Map<...>; lastGraph?: ConnectionGraph }`

### Yeni shell

`addon/content/connection-map.xhtml` — tag-dashboard CSS custom property + dark mode; inline only.

- `#zoterotag-connection-map-shell`
- `#zoterotag-connection-map-toolbar` — layer toggles, filter, connect mode
- `#zoterotag-connection-map-canvas` — boş; renderer doldurur
- `#zoterotag-connection-map-status`

### Locale

**Hem** `addon/locale/tr-TR/addon.ftl` **hem** `addon/locale/en-US/addon.ftl` — aynı Türkçe metin (proje convention). Build sonrası `typings/i10n.d.ts` FluentMessageId'leri güncellenir / regenerate edilir.

```
menu-connection-map = Bağlantı Haritası
connection-map-title = Bağlantı Haritası
connection-map-subtitle = { $library } · { $items } yayın · { $edges } bağlantı
connection-map-loading = Bağlantılar hesaplanıyor…
connection-map-error = Harita oluşturulamadı: { $message }
connection-map-refresh = Yenile
connection-map-layer-tag = Ortak etiket
connection-map-layer-manual = Elle bağlantı
connection-map-layer-semantic = Anlamsal öneri
connection-map-layer-note = Not/alıntı
connection-map-zotseek-missing = ZotSeek eklentisi bulunamadı — anlamsal öneriler devre dışı
connection-map-confirm-connect = { $a } ile { $b } arasında kalıcı bir bağlantı oluşturulsun mu?
connection-map-offer-bridge-tag = Bu iki kaynak farklı disiplinlerden. Ortak bir "köprü" etiketi ("{ $tag }") eklensin mi?
connection-map-accept-suggestion = Öneriyi kabul et
connection-map-dismiss-suggestion = Yoksay
connection-map-cross-discipline-hint = Turuncu kenarlar disiplinler arası bağlantıları gösterir
connection-map-node-tooltip-tags = Etiketler: { $tags }
connection-map-status-updated = { $library } · güncellendi { $time } · { $confirmed } kalıcı, { $suggested } öneri
connection-map-connect-mode = Bağla modu
connection-map-filter-placeholder = Filtrele…
```

(İlk taslak; renderer UI copy'si netleşince anahtar seti büyüyebilir.)

---

## 3. Rendering approach

**Öneri:** hand-rolled SVG + küçük custom force-simulation, **bundled dependency yok** (d3-force yok).

**Neden değil:**

- zotero-style Obsidian canvas engine — kullanıcının yasakladığı; proprietary/coupled, vendoring başka AGPL chunk
- d3-force — teknik olarak mümkün ama projede "no external UI framework / everything inline" precedent; ilk istisna + audit burden; O(n²) ~150–200 satır kişisel kütüphane ölçeğinde yeterli
- canvas vs SVG — SVG hit-test/CSS/dark-mode/tooltip kolay; onlarca bin node yok

**Sketch:**

- SVG + `<g>` pan/zoom (~40 satır wheel/pointer)
- rAF: repulsion + spring + centering + damping; kinetic energy eşiğinde soğut
- `edgeStyle(edge)`: solid=confirmed, dashed=suggested, crossDiscipline ayrı stroke — v1.1 bridge-score/blind-spot buraya biner
- Node: circle + label; radius tagCount/degree proxy; click → `ZoteroPane.selectItem`; connect = "bağla modu" + iki tık veya shift-drag → `confirmManualConnection`
- Layer toggle = filter already-computed graph; recompute yalnızca Refresh / Notifier

---

## 4. Integration points

### 4.1 Menu

`initTagDashboardMenu` kalıbı birebir: `ztoolkit.Menu.register("menuTools", …)` → `addon.hooks.onOpenConnectionMap()`. `buildItemMenu` değişmez.

### 4.2 ZotSeek

```ts
if (!Zotero.ZotSeek?.api) { /* unavailable */ }
// + api.isReady() sync
```

- Hazır değilse Semantic checkbox **gizle/disable**; `connection-map-zotseek-missing` muted note
- Her refresh'te yeniden kontrol (index bitmiş / eklenti sonradan açılmış olabilir)

### 4.3 Better Notes (açık soru — planı bloklamaz)

Public API yoksa Better Notes iç modüllerine bağlanma. **Tercih:** not HTML'de `href="zotero://note/..."` regex/DOM parse (D(i) ile aynı ruh). Spike D(ii) başında.

### 4.4 Notifier lifecycle (sızıntı yok)

`modules/notify.ts` process-lifetime — Connection Map için **yeniden kullanma**.

- `registerConnectionMapNoteObserver(win)` → `registerObserver(..., "connectionMapNoteWatch")`
- `unregister` on window `unload`
- Filter: item modify/add + `isNote()`, debounce ~800ms
- Yorumda yaz: global observer'a "basitleştirme" yapılmasın

### 4.5 Window init quirk

Chrome HTML window Zotero global görmez — `waitForWindowLoad` sonra `initConnectionMapWindow(win)` **addon scope**. Hook `onConnectionMapLoad` dashboard simetrisi için export (shell inline script yoksa bile).

---

## 5. `recordConfirmedConnection` funnel

```ts
itemA.addRelatedItem(itemB);
itemB.addRelatedItem(itemA);
await itemA.saveTx({ skipSelect: true, skipNotifier: true });
await itemB.saveTx({ skipSelect: true, skipNotifier: true });
```

`offerBridgeTag`: yeni etiket önermeden önce `similarity()` ile mevcut etiketlere yakınlık; eşik aşıyorsa önerme. Yazma: `item.addTag` / mevcut tagActions kalıpları.

---

## 6. Doğrulama planı

Otomatik test yok (`package.json` `test` stub).

1. Her faz sonrası: `npm run build` (`tsc --noEmit && zotero-plugin build`)
2. `npm run start` — scratch Zotero 7: üst-düzey koleksiyonlar, TR diacritic tag çiftleri, not-içi citation, (varsa) ZotSeek indexed, (varsa) BN wikilink
3. **A:** foldTag kenarı; cross-discipline highlight; aynı koleksiyon highlight yok
4. **B:** bağla modu → İlgili sekmesi çift yönlü; refresh sonrası confirmed; yakın etiket varsa köprü önerisi çıkmaz
5. **C:** dashed öneri → accept → İlgili; ZotSeek yok → toggle gizli, konsol hatasız
6. **D:** citation kaydet → debounce içinde auto edge; BN wikilink aynı
7. **Lifecycle:** aç/kapat ×N — notifier sızmaz, kayıt çoğalmaz
8. **Regresyon:** Etiket Analizi merge/delete

---

## Kritik dosyalar

```
src/modules/tagDashboard.ts
src/utils/tagAnalysis.ts
src/utils/tagActions.ts
src/modules/menu.ts
src/hooks.ts
src/addon.ts
src/modules/notify.ts
addon/content/tag-dashboard.xhtml
../zotero-style-6.0.8/src/modules/graphView.ts          # referans
../zotero-reference-1.7.2/src/modules/connectedpapers.ts # referans
```

---

## Uygulama fazları

Adım adım ilerleme. Her fazın kabul testi geçmeden sonrakine geçilmez.

| Faz | Kapsam | Kabul |
|-----|--------|--------|
| **1** | İskelet + Katman A (etiket, disiplin vurgusu, pencere/UI) | A checklist |
| **2** | Katman B — bağla modu, `recordConfirmedConnection`, köprü etiket | İlgili sekmesi + bridge |
| **3** | Katman C — ZotSeek soft-dep, suggested, accept | ZotSeek var/yok |
| **4** | Katman D — citation/BN wikilink, Notifier lifecycle, D(iii) stub | auto-promote + no leak |

### Faz 1 checklist (iskelet + A)

- [x] Plan faz bölümü
- [x] A+shell: C/D soft-fail (açılışı bloklamaz) — `loadOptionalLayers` try/catch
- [x] Tag layer dense-skip güvenli eşik — `MIN_DENSE_SKIP = 8`
- [x] Renderer: kenarlı düğüm odaklı (izoleler yalnızca filtrede)
- [x] `npm run build` — 2026-07-29 Faz 1 geçti (yeniden doğrulandı)
- [ ] Manuel A doğrulama (kullanıcı: `npm run start` → Araçlar → Bağlantı Haritası)
- [x] Etiket Analizi regresyon — Faz 1’de `tagDashboard`/`tagAnalysis` davranışına dokunulmadı

**Manuel A doğrulama:**

1. Araçlar → Bağlantı Haritası açılır, status doluyor
2. Ortak (TR diacritic / case) etiketi paylaşan kaynaklar arasında kenar var
3. Farklı üst-düzey koleksiyon → turuncu kenar; aynı koleksiyon → turuncu değil
4. Düğüm tıklanınca Zotero seçimi
5. “Ortak etiket” checkbox kapatılınca kenarlar kaybolur; Yenile çalışır

> **Faz 1 agent çıkışı:** plan fazları, A soft-fail, dense-skip, kenar odaklı render ve build tamam. UI checklist yukarıda — `npm run start` ile doğrulayıp kutuyu işaretleyin. Sonraki dilim: **Faz 2 (Katman B)**.
### Faz 2–4 checklist

#### Faz 2 checklist (Katman B — elle bağlantı)

- [x] Bağla modu UI: toggle, ilk/ikinci düğüm seçimi, sürükle≠bağla
- [x] `recordConfirmedConnection` idempotent (zaten related ise no-op)
- [x] Onay dialogu → relatedItem yazımı (İlgili sekmesi kullanıcı doğrular)
- [x] Yenile sonrası kenar `manual`/`confirmed` (relatedItems rebuild)
- [x] Cross-discipline → köprü etiket teklifi; `foldTag`+similarity bastırma
- [x] Aynı disiplin / near-dupe → köprü teklifi çıkmaz
- [x] `npm run build` — 2026-07-29 Faz 2 geçti
- [ ] Manuel B doğrulama (`npm run start`)

**Manuel B doğrulama:**

1. Bağla modu aç → iki farklı-disiplin düğüm → onay → Zotero İlgili sekmesinde karşılıklı
2. Yenile → elle kenar solid/confirmed
3. Yakın etiketli çiftte köprü önerisi çıkmaz
4. Zaten bağlı çifte tekrar bağlayınca hata/çift yazım yok

> **Faz 2 agent çıkışı:** bağla UX, idempotent relatedItem, foldTag bridge suppression tamam. UI checklist yukarıda. Sonraki dilim: **Faz 3 (ZotSeek / Katman C)**.

#### Faz 3 checklist (Katman C — anlamsal öneri)

- [x] `isZotSeekReady` gate; yoksa semantic toggle gizli + missing note
- [x] `findSimilar` soft-fail; itemKey→itemId çözümleme
- [x] Suggested kenarlar dashed; mevcut relatedItem çiftleri elenir
- [x] Session dismiss set; accept → `recordConfirmedConnection` + yenile
- [x] Refresh’te readiness yeniden kontrol; semantic cache clear (dismiss pencere oturumu)
- [x] `npm run build` — 2026-07-29 Faz 3 geçti
- [ ] Manuel C doğrulama (`npm run start`)

**Manuel C doğrulama:**

1. ZotSeek hazırken kesikli öneri kenarları görünür; tıklayınca kabul/yoksay
2. Kabul → İlgili sekmesi + yenilede confirmed
3. ZotSeek yok/kapalı → anlamsal kutucuk gizli, konsolda hata yok

> **Faz 3 agent çıkışı:** soft-dep, accept/dismiss, related-pair filter, itemKey resolve tamam. Sonraki dilim: **Faz 4 (Not katmanı / D)**.

#### Faz 4 checklist (Katman D — not / Notifier)

- [x] Citation-span parse (attribute order-agnostic) + zotero://select item link
- [x] Better Notes wikilink HTML parse (`zotero://note/…`) — iç API yok
- [x] HIGH-confidence auto-promote via `recordConfirmedConnection`
- [x] Window-scoped Notifier (debounce, unregister on unload, no leak)
- [x] Incremental note scan on modify/add
- [x] D(iii) stub + `connectionMapEnableHighlightLayer` pref (default false)
- [x] `npm run build` — 2026-07-29 Faz 4 geçti
- [ ] Manuel D doğrulama (`npm run start`)

**Manuel D doğrulama:**

1. Not’a Alıntı Ekle → kaydet → açık haritada debounce sonrası kalıcı kenar
2. BN wikilink (varsa) → parent’lar arası relatedItem
3. Pencereyi kapat → not kaydı Connection Map kodunu tetiklemez; aç/kapat ×N kayıt çoğalmaz

> **Faz 4 / v1 agent çıkışı:** A–D kodu + build hazır. Kalan: kullanıcı manuel test checklist’leri; istenirse commit/release.

---

## Uygulama durumu (dosya checklist)

Araçlar bu listeyi güncelleyerek el sıkışır:

- [x] Plan dosyası (`BAGLANTI-HARITASI-PLAN.md`)
- [x] `similarity()` export (`src/utils/tagAnalysis.ts`)
- [x] `src/utils/connectionGraph.ts`
- [x] `src/utils/connectionTagLayer.ts`
- [x] `src/utils/connectionActions.ts`
- [x] `src/utils/connectionSemanticLayer.ts`
- [x] `src/utils/connectionNoteLayer.ts`
- [x] `src/utils/connectionNotify.ts`
- [x] `src/modules/connectionMap.ts`
- [x] `src/modules/connectionMapRenderer.ts`
- [x] `addon/content/connection-map.xhtml`
- [x] Locale anahtarları (`tr-TR` + `en-US` addon.ftl)
- [x] `hooks.ts` / `menu.ts` / `addon.ts` bağlantıları
- [x] `typings/i10n.d.ts` FluentMessageId güncellemesi
- [x] Build doğrulama (`npm run build`) — Faz 1–4 agent geçti
- [ ] Manuel test A/B/C/D (gerçek Zotero profili)
- [x] Faz 2–4 agent kodu

### Araçlar arası çalışma notları

1. **Tek plan kaynağı:** Bu dosya. Çelişen yerel plan notları varsa burası kazanır.
2. **Paralel iş bölümü önerisi:** utils veri katmanı ↔ renderer/xhtml ↔ locale/hooks — aynı dosyaya iki araç yazmasın.
3. **Commit:** Kullanıcı istemeden commit/push yok.
4. **Referans plugin kodu:** Approach/API only; Obsidian graph engine / connectedpapers dosyasını kopyalama.
