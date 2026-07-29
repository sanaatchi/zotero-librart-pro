<!-- @ajan: cursor · @etiket: librart-pro, vendor, lisans, provenance, f7, f8, f9.2 -->

# Vendor kaynak kodları

LibRart Pro, referans eklenti ve araçların **orijinal kaynak kodunu** `src/vendor/` altında
barındırır veya `../referanslar/` üzerinden port eder. Dosya başında kaynak-atıf yorumu zorunlu.

## Çekirdek (mevcut)

| Kaynak                                                                              | Lisans   | Konum                                                                                 | Kullanım                                                                                                    |
| ----------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [zotero-reference](https://github.com/muisedestiny/zotero-reference)                | AGPL-3.0 | `src/vendor/zotero-reference/`                                                        | DOI/Crossref, PDF referans, okuyucu views                                                                   |
| [zotero-style](https://github.com/muisedestiny/zotero-style)                        | AGPL-3.0 | `src/vendor/zotero-style/tagGraph.ts`                                                 | Etiket eş-oluşum grafiği                                                                                    |
| OpenCitations Index API                                                             | CC0 data | `src/utils/openCitations*.ts`                                                         | F5.2 + disk cache (`librart-opencitations-cache.json`)                                                      |
| [ZotSeek](https://github.com/joseferben/zotseek)                                    | MIT      | `src/vendor/zotseek/`                                                                 | F9.2.2 assets + F9.2.3 JSON vektör indeks (`librart-zotseek-vectors.json`); tam SQLite store yok            |
| Kutuphane semantic bridge                                                           | — (repo) | `src/utils/kutuphaneSemanticBridge.ts` + `kutuphaneSemanticParse.ts`                  | F9.1 — `zotero_semantic_bridge.py` :8756                                                                    |
| [scholar-sidekick-zotero](https://github.com/inciteful-xyz/scholar-sidekick-zotero) | MIT      | `referanslar/scholar-sidekick-zotero/`                                                | F2 parse/apply desenleri                                                                                    |
| [zotero-tag-cited](https://github.com/onyxaegis/zotero-tag-cited)                   | MIT      | `referanslar/zotero-tag-cited/`                                                       | F3 DOCX → `cited:` etiket                                                                                   |
| [zotero-reading-flow](https://github.com/moon-young-choi/zotero-reading-flow)       | MIT      | `src/vendor/reading-flow/`                                                            | F4 okuma durumu, sütunlar, pano                                                                             |
| [yanki-connect](https://github.com/kitschpatrol/yanki-connect)                      | MIT      | `src/vendor/yanki-connect/` (ince istemci) · ref `referanslar/yanki-connect/`         | F7 AnkiConnect HTTP + Extra idempotans; **tam YankiConnect sınıfı vendor edilmedi** (Node/fetch/autoLaunch) |
| [zotero-markdb-connect](https://github.com/daeh/zotero-markdb-connect)              | MIT      | `src/vendor/markdb/` (ince scan) · ref `referanslar/zotero-markdb-connect/`           | F8.1 vault → note kenarları; tam mdbcUX/tag sync yok                                                        |
| [zotero-better-notes](https://github.com/windingwind/zotero-better-notes)           | AGPL-3.0 | `src/vendor/zotero-better-notes/{link,noteHtml,relatedNotes}.ts` · `noteWorkspace.ts` | F8.2.1 link + F8.2.2 ilgili notlar; tam workspace UI yok                                                    |

## Atıf grafiği — tam yığın (kullanıcı: hepsini istiyor)

| Kaynak                                                                              | Lisans                                                  | Referans klasörü                             | Vendor hedefi                                              | Rol                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Zotero-Citation-Graph](https://github.com/Thrillcrazyer/Zotero-Citation-Graph)     | **lisans yok**                                          | `referanslar/Zotero-Citation-Graph-main/`    | **vendor yasak**                                           | Yalnız davranış/mimari inceleme; temiz oda uygulama gerekir                                                                                                                                                  |
| [inciteful-zotero-plugin](https://github.com/inciteful-xyz/inciteful-zotero-plugin) | AGPL-3.0                                                | `referanslar/inciteful-zotero-plugin-0.2.2/` | `src/vendor/inciteful/` ✅                                 | Harici Graph Search / Connect Papers                                                                                                                                                                         |
| [ZoteroCitationMaps](https://github.com/schulzedaniel/ZoteroCitationMaps)           | **MIT**                                                 | `referanslar/ZoteroCitationMaps/`            | `src/vendor/zotero-citation-maps/openAlexDataSource.ts` ✅ | OpenAlex API + JSON cache (F5)                                                                                                                                                                               |
| [zotero-openalex](https://github.com/danieleongari/zotero-openalex)                 | GPL-3.0                                                 | `referanslar/zotero-openalex/`               | `src/vendor/zotero-openalex/` (seçici)                     | OpenAlex SQLite cache + graf penceresi parçaları                                                                                                                                                             |
| [citation_map](https://github.com/jaks6/citation_map)                               | **lisans yok**                                          | `referanslar/citation_map/`                  | **vendor/çeviri portu yasak**                              | Gereksinim çıkarımı; bağımsız temiz oda uygulama                                                                                                                                                             |
| [Local-Citation-Graph](https://github.com/SubhadityaMukherjee/Local-Citation-Graph) | **lisans yok**                                          | `referanslar/Local-Citation-Graph/`          | **vendor yasak**                                           | Yalnız export/görselleştirme fikri                                                                                                                                                                           |
| [zotero-citegeist](https://github.com/phdemotions/zotero-citegeist)                 | GPL-3.0                                                 | `referanslar/zotero-citegeist/`              | `citegeistBridge` + `citegeistMetrics` (temiz oda)         | OpenAlex atıf/kaynak özeti menü; **tam sütun/pane yok**                                                                                                                                                      |
| [citation-graph](https://github.com/OleksiyPenkov/citation-graph)                   | **MIT**                                                 | `referanslar/citation-graph-openalex-cli/`   | Kutuphane köprüsü (Python)                                 | CLI/MCP: neighborhood, missing, bridges                                                                                                                                                                      |
| [scite-zotero-plugin](https://github.com/scitedotai/scite-zotero-plugin)            | **lisans yok** (kendisi + 15 fork'un tamamı doğrulandı) | `referanslar/scite-zotero-plugin/`           | **vendor/port yasak**                                      | Atıf-tipi (supporting/contrasting/mentioning) — lisanslı muadil: `zotero-open-citations` (AGPL) veya `zotero-citation-tally` (AGPL); alternatif: `mcp__zotero__scite_*` MCP araçları (kod portu gerektirmez) |

Detaylı faz planı: **`LIBRART-YAPILANDIRMA.md`** · lisans/port: **`LIBRART-REFERANS-PORT.md`** · giriş: **`LIBRART-GIRIS.md`**.

## Lisans notları

- **MIT** → AGPL LibRart Pro'ya vendor edilebilir (attribution yeterli).
- **GPL/AGPL** → copyleft uyumlu; birleşik eser AGPL kalır.
- **Lisans dosyası yok** → kod kopyalama, port etme veya çeviri portu yasak.
  Kullanıcı onayı telif izninin yerine geçmez. Yalnız davranış gereksinimi çıkarılır;
  temiz oda yeniden uygulama yapılır veya lisanslı muadil seçilir.

Her yeni vendor aktarımında upstream URL, commit SHA, SPDX lisansı, yerel hedef ve
değişiklik özeti kaydedilir. Ayrıntılı güncel karar kaynağı:
[`REFERANS-ANALIZ.md`](REFERANS-ANALIZ.md).

## Derleme

Büyük vendor dosyalarında geçici `// @ts-nocheck`. Davranış orijinale uygun; tipler kademeli sıkılaştırılır.

```bash
npm run build
```

## Doğrulama (Zotero)

- Bağlantı Haritası: tag / elle / semantic / not / atıf alt-katmanları
- Menü: Inciteful Tools; (Faz 5) citegeist snowball
- PDF okuyucu: References (zotero-reference views)
