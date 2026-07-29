<!-- @ajan: codex · @etiket: librart-pro, vendor, lisans, provenance -->
# Vendor kaynak kodları

LibRart Pro, referans eklenti ve araçların **orijinal kaynak kodunu** `src/vendor/` altında
barındırır veya `../referanslar/` üzerinden port eder. Dosya başında kaynak-atıf yorumu zorunlu.

## Çekirdek (mevcut)

| Kaynak | Lisans | Konum | Kullanım |
|--------|--------|-------|----------|
| [zotero-reference](https://github.com/muisedestiny/zotero-reference) | AGPL-3.0 | `src/vendor/zotero-reference/` | DOI/Crossref, PDF referans, okuyucu views |
| [zotero-style](https://github.com/muisedestiny/zotero-style) | AGPL-3.0 | `src/vendor/zotero-style/tagGraph.ts` | Etiket eş-oluşum grafiği |
| [ZotSeek](https://github.com/joseferben/zotseek) | MIT | `src/vendor/zotseek/` | Yerel embedding (WASM aşaması) |
| [zotero-better-notes](https://github.com/windingwind/zotero-better-notes) | AGPL-3.0 | `src/modules/noteWorkspace.ts` | Not workspace (devam ediyor) |

## Atıf grafiği — tam yığın (kullanıcı: hepsini istiyor)

| Kaynak | Lisans | Referans klasörü | Vendor hedefi | Rol |
|--------|--------|------------------|---------------|-----|
| [Zotero-Citation-Graph](https://github.com/Thrillcrazyer/Zotero-Citation-Graph) | **lisans yok** | `referanslar/Zotero-Citation-Graph-main/` | **vendor yasak** | Yalnız davranış/mimari inceleme; temiz oda uygulama gerekir |
| [inciteful-zotero-plugin](https://github.com/inciteful-xyz/inciteful-zotero-plugin) | AGPL-3.0 | `referanslar/inciteful-zotero-plugin-0.2.2/` | `src/vendor/inciteful/` ✅ | Harici Graph Search / Connect Papers |
| [ZoteroCitationMaps](https://github.com/schulzedaniel/ZoteroCitationMaps) | **MIT** | `referanslar/ZoteroCitationMaps/` | `src/vendor/zotero-citation-maps/` | OpenAlex graf, öneri, chain, timeline |
| [zotero-openalex](https://github.com/danieleongari/zotero-openalex) | GPL-3.0 | `referanslar/zotero-openalex/` | `src/vendor/zotero-openalex/` (seçici) | OpenAlex SQLite cache + graf penceresi parçaları |
| [citation_map](https://github.com/jaks6/citation_map) | **lisans yok** | `referanslar/citation_map/` | **vendor/çeviri portu yasak** | Gereksinim çıkarımı; bağımsız temiz oda uygulama |
| [Local-Citation-Graph](https://github.com/SubhadityaMukherjee/Local-Citation-Graph) | **lisans yok** | `referanslar/Local-Citation-Graph/` | **vendor yasak** | Yalnız export/görselleştirme fikri |
| [zotero-citegeist](https://github.com/phdemotions/zotero-citegeist) | GPL-3.0 | `referanslar/zotero-citegeist/` | `src/modules/citegeistBridge.ts` | OpenAlex snowball + atıf metrikleri |
| [citation-graph](https://github.com/OleksiyPenkov/citation-graph) | **MIT** | `referanslar/citation-graph-openalex-cli/` | Kutuphane köprüsü (Python) | CLI/MCP: neighborhood, missing, bridges |

Detaylı faz planı: **`REFERANS-ANALIZ.md`** §5 ve §10–§11.

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
