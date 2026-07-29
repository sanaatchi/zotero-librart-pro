<!-- @ajan: cursor · @etiket: referans-entegrasyon, vendor, lisans, f8 -->

# LibRart Pro — referans eklenti entegrasyon planı

**Bu belge:** `../referanslar/` altındaki **üçüncü parti eklentilerden** LibRart'a kod taşıma —
lisans, yasaklar, hangi upstream dosyanın nereye gideceği, tamamlanan vendor'lar.

LibRart'ın kendi faz/menü/pref planı **değil** → [`LIBRART-YAPILANDIRMA.md`](LIBRART-YAPILANDIRMA.md).

Giriş: [`LIBRART-GIRIS.md`](LIBRART-GIRIS.md) · Fiili tablo: [`LIBRART-VENDOR.md`](LIBRART-VENDOR.md)

---

## 1. Kapsam

- **91 depo** klonlu (`../README.md` envanter listesi)
- Referans kökü: `zotero-eklentiler/referanslar/<klasör>/`
- Hedef: `kaynak/src/vendor/` veya `kaynak/src/modules/`, `src/utils/`
- **Yeni klon ekleme:** Atıf grafiği (~19) ve AI/RAG (~11) kategorileri doymuş — ekleme yok

---

## 2. Lisans — üç kural

1. **Lisanssız → kod portu YOK** (yalnız mimari inceleme veya temiz oda)
2. **AGPL/MIT → port serbest** (birleşik eser AGPL kalmalı; attribution zorunlu)
3. **Kullanıcı onayı telif izni değildir**

### Port yasak (13 depo — özet)

| Klasör                                 | Neden                                                               |
| -------------------------------------- | ------------------------------------------------------------------- |
| `scite-zotero-plugin`                  | Repo + 15 fork lisanssız — alternatif: `zotero-open-citations`, MCP |
| `citation_map`, `Local-Citation-Graph` | Lisans yok                                                          |
| `Zotero-Citation-Graph-main`           | Lisans yok                                                          |
| `zotero-citation-network`              | **Silindi — malware**                                               |
| `zotero-connected-papers`              | Kaynak kodu yok                                                     |
| + 7 diğer                              | tam liste: arşiv `LIBRART-ARSIV.md` §1a                             |

### Port serbest (sık kullanılan)

| Depo                                                           | Lisans | LibRart hedef faz |
| -------------------------------------------------------------- | ------ | ----------------- |
| zotero-style, zotero-reference, zotero-better-notes, inciteful | AGPL   | ✅ / F8           |
| ZotSeek                                                        | MIT    | F9                |
| zotero-markdb-connect                                          | MIT    | F8                |
| zotero-reading-flow                                            | MIT    | F4                |
| ZoteroCitationMaps                                             | MIT    | F5                |
| zotero-openalex                                                | GPL    | F5 (store/cache)  |
| zotero-citegeist                                               | GPL    | deneysel          |

---

## 3. Port kararı matrisi

| Depo                  | Port? | Yöntem                           |
| --------------------- | ----- | -------------------------------- |
| zotero-markdb-connect | ✅    | vendor → `markdbBridge`          |
| zotero-reading-flow   | ✅    | vendor → `readingTracker`        |
| ZoteroCitationMaps    | ✅    | vendor → `openAlexCitationLayer` |
| zotero-openalex       | ✅    | store/API only                   |
| Zotero-Citation-Graph | ❌    | temiz oda                        |
| citation_map          | ❌    | temiz oda                        |
| zotero-citegeist      | ✅    | bridge/menu (deneysel)           |
| zotero-better-notes   | ✅    | seçici vendor (F8)               |
| ZotSeek               | ✅    | vendor WASM (F9)                 |
| scite-zotero-plugin   | ❌    | MCP veya open-citations          |

---

## 4. LibRart modül → referans (özet)

| LibRart modülü                       | Durum | Birincil referans          |
| ------------------------------------ | ----- | -------------------------- |
| `connectionTagLayer`                 | ✅    | zotero-style               |
| `connectionCitationLayer` (Crossref) | ✅    | zotero-reference           |
| `connectionCitationLayer` (OpenAlex) | plan  | ZoteroCitationMaps         |
| `connectionNoteLayer`                | kısmi | markdb + better-notes (F8) |
| `connectionSemanticLayer`            | kısmi | ZotSeek + Kutuphane köprü  |
| `connectionTimeline`                 | plan  | zotero-reading-flow (F4)   |
| `incitefulBridge`                    | ✅    | inciteful                  |
| `referenceExtractor`                 | ✅    | zotero-reference/pdf       |

**Özellik çakışması — yeni port yapma:**

| Alan           | Karar                                          |
| -------------- | ---------------------------------------------- |
| Citation graph | ~19 depo yeter; F5 = lisanslı adaptörler only  |
| AI/RAG         | ~11 depo yeter; F9 semantic                    |
| Not/MD         | Tek şema — better-notes + markdb               |
| Dosya yönetimi | **Katman 2** (PDF Manager) — LibRart’ta F6 yok |

---

## 5. Tamamlanan portlar

| Upstream                | LibRart                                       | Kayıt          |
| ----------------------- | --------------------------------------------- | -------------- |
| inciteful-zotero-plugin | `src/vendor/inciteful/`, `incitefulBridge.ts` | LIBRART-VENDOR |
| zotero-reference        | `src/vendor/zotero-reference/`                | LIBRART-VENDOR |
| zotero-style            | `src/vendor/zotero-style/tagGraph.ts`         | LIBRART-VENDOR |
| ZotSeek                 | `src/vendor/zotseek/` (kısmi)                 | LIBRART-VENDOR |

---

## 6. Modül eşlemesi (port yaparken)

### zotero-style — `referanslar/zotero-style-6.0.8/src/modules/`

| Kaynak                     | LibRart                         | Durum  |
| -------------------------- | ------------------------------- | ------ |
| `tags.ts`                  | tag katmanı / `connectionGraph` | ✅     |
| `events.ts`, `progress.ts` | `connectionNotify.ts`           | kısmi  |
| `views.ts`                 | ItemTree sütun                  | planlı |

### zotero-reference — `referanslar/zotero-reference-1.7.2/src/modules/`

| Kaynak               | LibRart                      | Durum |
| -------------------- | ---------------------------- | ----- |
| `api.ts`, `utils.ts` | `doiResolver.ts`             | ✅    |
| `pdf.ts`             | `referenceExtractor.ts`      | ✅    |
| `tip.ts`, `views.ts` | PDF popup                    | ✅    |
| `connectedpapers.ts` | `connectionCitationLayer.ts` | kısmi |

### zotero-better-notes — F8

| Kaynak                    | LibRart                          |
| ------------------------- | -------------------------------- |
| `editor/*`, `workspace/*` | `connectionNoteLayer` genişletme |
| `template/*`, `export/*`  | F8 sonrası                       |

### ZotSeek — F9

| Kaynak                | LibRart                                             |
| --------------------- | --------------------------------------------------- |
| `embedding-worker.ts` | `src/vendor/zotseek/` (Kutuphane Ollama alternatif) |

### Faz bazlı yeni vendor (henüz yok)

| Faz | Referans                             | Hedef dosya                                     |
| --- | ------------------------------------ | ----------------------------------------------- |
| F4  | zotero-reading-flow                  | `readingTracker.ts`, `src/vendor/reading-flow/` |
| F5  | ZoteroCitationMaps + zotero-openalex | `openAlexCitationLayer.ts`, vendor              |
| F8  | zotero-markdb-connect                | `markdbBridge.ts`, `src/vendor/markdb/`         |

---

## 7. Attribution ve doğrulama

**Her vendor dosyası:**

```ts
// Adapted from zotero-style (AGPL-3.0) src/modules/tags.ts
```

**Port sonrası:**

1. `npm run build`
2. `LIBRART-VENDOR.md` satırı (upstream URL, commit SHA, SPDX)
3. Bağlantı Haritası katmanları çalışır
4. Yeni UI → Fluent + menü/pref

Kalite referans depoları (test/CI deseni, özellik değil): `zotero-arxiv-workflow`,
`zotero-zotadata`, `zotero-citation-tally`, `zotero-plugin-template-current`.

---

## 8. Güvenlik

- **`zotero-citation-network`** — malware `postinstall`; diskte olmamalı, geri klonlama yok
  ([`../REFERANS-BLOCKLIST.md`](../REFERANS-BLOCKLIST.md))
- Yeni klon sonrası: `python zotero-eklentiler/_scan_referans_guvenlik.py`
- `referanslar/` içinde **`npm install` öncesi** `package.json` `preinstall`/`postinstall` oku
- Uzak HTTP: timeout, allowlist, veri minimizasyonu
- YAML eylem import = kod sınırı → şema + kuru koşu

---

## 9. Faz bazlı port haritası (kopyalanabilir referanslar)

Lisans doğrulandı (`referanslar/` disk taraması, 2026-07-29). **Port yasak** olanlar tabloya
alınmadı. F0/F1 çoğunlukla **desen** (test/CI/scaffold); F2+ **özellik vendor**.

### Özet tablo

| Faz        | LibRart hedefi               | Birincil referans (lisans)                                                                                             | Klasör / önemli dosyalar                                                           | Durum                                           |
| ---------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------- |
| —          | Çekirdek harita, atıf, PDF   | zotero-style (AGPL), zotero-reference (AGPL), inciteful (AGPL)                                                         | `zotero-style-6.0.8/`, `zotero-reference-1.7.2/`, `inciteful-zotero-plugin-0.2.2/` | ✅ büyük ölçüde                                 |
| —          | Semantic (kısmi)             | ZotSeek (MIT)                                                                                                          | `ZotSeek-1.18.0/src/worker/`                                                       | ✅ kısmi                                        |
| **F0**     | Test, CI, scaffold           | zotero-arxiv-workflow (MIT), zotero-zotadata (MIT), zotero-citation-tally (AGPL), zotero-plugin-template-current (MIT) | `test/*.test.ts`, Vitest, `zotero-plugin test`                                     | desen only                                      |
| **F1**     | FeatureRegistry, adaptör     | zotero-actions-tags-upstream (AGPL), zotero-plugin-toolkit (MIT)                                                       | menü/notify/desen; tam port değil                                                  | desen only                                      |
| **F2**     | Güvenli `.bib`/`.ris` import | **scholar-sidekick-zotero** (MIT)                                                                                      | parse/apply desenleri → `safeImport*.ts`                                           | ✅                                              |
| **F2**     | BibTeX parse (ikincil)       | zotero-better-bibtex (MIT)                                                                                             | seçici; tam BBT vendor değil                                                       | ikincil                                         |
| **F3**     | DOCX'te kullanılanlar        | **zotero-tag-cited** (MIT)                                                                                             | `docxCitedParse.ts`, `docxCitedBridge.ts`                                          | ✅                                              |
| **F4**     | Okuma durumu, timeline       | **zotero-reading-flow** (MIT)                                                                                          | `flowData.ts`, `dataStore.ts`, `columnManager.ts`, `dashboard.ts`                  | plan                                            |
| **F4**     | Timeline UI (ikincil)        | Chartero (AGPL)                                                                                                        | okuma istatistiği deseni                                                           | ikincil                                         |
| **F5**     | OpenAlex atıf katmanı        | **ZoteroCitationMaps** (MIT)                                                                                           | `zotero-citation-map/addon/modules/dataSource.js`, `graphBuilder.js`               | plan                                            |
| **F5**     | OpenAlex cache/store         | **zotero-openalex** (GPL-3.0)                                                                                          | `src/modules/openalexStore.ts`, `openalex.ts`                                      | plan                                            |
| **F5**     | OpenCitations (opsiyonel)    | **zotero-open-citations** (AGPL)                                                                                       | `chrome/content/zoteroopencitations.js`                                            | plan                                            |
| ~~**F6**~~ | ~~PDF Gelen Kutusu~~         | **Katman 2** — `zotero-pdf-manager/AUTOMATION_PLAN.md`                                                                 | watch-folder portu PDF Manager’da                                                  | LibRart dışı                                    |
| **F7**     | Anki köprüsü                 | **yanki-connect** (MIT)                                                                                                | npm kütüphanesi — AnkiConnect tipli istemci                                        | plan                                            |
| **F8**     | Obsidian / MarkDB backlink   | **zotero-markdb-connect** (MIT)                                                                                        | `mdbcScan.ts`, `mdbcUX.ts`, `mdbcParam.ts`                                         | ✅ F8.1 (ince scan; UX sonra)                   |
| **F8**     | Not workspace                | **zotero-better-notes** (AGPL)                                                                                         | `src/utils/link.ts` → `vendor/…/link.ts`                                           | ✅ F8.2.1 (wikilink insert); workspace UI sonra |
| **F9**     | Yerel embedding              | **ZotSeek** (MIT)                                                                                                      | `embedding-worker.ts`, WASM pipeline                                               | F9.2 (stub)                                     |
| **F9**     | Kutuphane köprüsü            | **ragPaper** (MIT) / `zotero_semantic_bridge.py`                                                                       | `kutuphaneSemanticBridge.ts`                                                       | ✅ F9.1                                         |
| deneysel   | Snowball / metrik            | zotero-citegeist (GPL)                                                                                                 | `src/modules/cache/`, OpenAlex snowball                                            | sonra                                           |
| deneysel   | CLI analiz                   | citation-graph-openalex-cli (MIT)                                                                                      | Python; `Kutuphane/` köprü                                                         | sonra                                           |

### Port yasak — plana alınmaz (kod kopyalama yok)

| Klasör                                 | Alternatif                                            |
| -------------------------------------- | ----------------------------------------------------- |
| `scite-zotero-plugin`                  | `zotero-open-citations`, `zotero-citation-tally`, MCP |
| `Zotero-Citation-Graph-main`           | Zotero `item.relations` + temiz oda                   |
| `citation_map`, `Local-Citation-Graph` | `zotero-reference/pdf.ts` + temiz oda                 |
| `zotero-citation-network`              | silindi (malware)                                     |
| `zotero-connected-papers`              | kaynak yok                                            |

### F2–F9 dosya hedefleri (port sırasında)

| Faz    | Vendor hedefi (`src/vendor/`)               | Modül (`src/modules/` veya `src/utils/`)                                |
| ------ | ------------------------------------------- | ----------------------------------------------------------------------- |
| F2     | — (desen only)                              | `safeImportBridge.ts`, `safeImportParse.ts`, `safeImportApply.ts`       |
| F3     | — (desen port)                              | `docxCitedBridge.ts`, `docxCitedParse.ts`                               |
| F4     | `reading-flow/`                             | `readingTracker.ts` → `connectionTimeline.ts`, `connectionBlindSpot.ts` |
| F5     | `zotero-citation-maps/`, `zotero-openalex/` | `openAlexCitationLayer.ts`                                              |
| ~~F6~~ | —                                           | Katman 2 → `zotero-pdf-manager/`                                        |
| F7     | `yanki-connect/` (npm vendor)               | `ankiBridge.ts`                                                         |
| F8     | `markdb/`                                   | `markdbBridge.ts` + BN `editor/`, `workspace/`                          |
| F9     | `zotseek/` (tamamlama)                      | `connectionSemanticLayer.ts`                                            |

Yapılandırma fazı detayı: [`LIBRART-YAPILANDIRMA.md`](LIBRART-YAPILANDIRMA.md) §3.

---

## Değişiklik günlüğü

| Tarih      | Ajan   | Özet                                          |
| ---------- | ------ | --------------------------------------------- |
| 2026-07-29 | cursor | §9 faz bazlı port haritası (F0–F9 + yasaklar) |
| 2026-07-29 | cursor | `LIBRART-REFERANS-PORT.md` adı                |
