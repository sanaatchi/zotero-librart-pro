<!-- @ajan: cursor · @etiket: katman-3, librart, stabilizasyon, eksik-raporu -->

# Katman 3 — LibRart Pro planı (**aktif geliştirme**)

> **Oturum başı:** [`CURSOR-KATMAN-3-EKSIKLER-RAPORU.md`](CURSOR-KATMAN-3-EKSIKLER-RAPORU.md) oku → düzelt → görev.  
> Rule: `katman-eksik-raporu.mdc`

**Strateji:** [`../../docs/uc-katman-stratejisi.md`](../../docs/uc-katman-stratejisi.md)

| Alan    | Değer                                                        |
| ------- | ------------------------------------------------------------ |
| addonID | `librartpro@euclpts.com`                                     |
| Sürüm   | 1.0.57                                                       |
| Girdi   | Katman 2’den temiz Zotero kayıtları + PDF ekleri             |
| Amaç    | Makale yazarken: harita, etiket, atıf, okuma, bağlantı kurma |

---

## Plan belgeleri (bu katman)

| Belge                                                                      | İçerik                                |
| -------------------------------------------------------------------------- | ------------------------------------- |
| [`CURSOR-KATMAN-3-EKSIKLER-RAPORU.md`](CURSOR-KATMAN-3-EKSIKLER-RAPORU.md) | **Önce oku → düzelt → sonra özellik** |
| [`ZOTERO-KABUL-CHECKLIST.md`](ZOTERO-KABUL-CHECKLIST.md)                   | Manuel Zotero kabul (P1)              |
| [`LIBRART-GIRIS.md`](LIBRART-GIRIS.md)                                     | Giriş, isim haritası                  |
| [`LIBRART-YAPILANDIRMA.md`](LIBRART-YAPILANDIRMA.md)                       | **Faz F0–F9**, pref, menü, test       |
| [`LIBRART-REFERANS-PORT.md`](LIBRART-REFERANS-PORT.md)                     | Referans eklenti port, lisans         |
| [`LIBRART-VENDOR.md`](LIBRART-VENDOR.md)                                   | Tamamlanan vendor                     |
| [`BAGLANTI-HARITASI-PLAN.md`](BAGLANTI-HARITASI-PLAN.md)                   | Tarihsel v1 uygulama kaydı            |
| [`AGENTS.md`](AGENTS.md)                                                   | Üç ajan kuralları                     |

**Genel plan indeksi:** [`../../docs/PLAN-GIRIS.md`](../../docs/PLAN-GIRIS.md)

---

## Şu an: ne yapıyoruz?

**Oturum başı sırası:** eksik raporu → P1 düzelt → özellik.

**Katman 3 — LibRart Pro.** F0–**F9.2.3** özellik çekirdeği ✅ + stabilizasyon
(v1.0.55). Açık iş: makale yazım boşlukları — `CURSOR-KATMAN-3-EKSIKLER-RAPORU.md`.

```bash
cd zotero-eklentiler/kaynak
npm test && npm run lint:check && npm run build
```

---

## Faz planı (Katman 3 only — güncel)

| Faz    | LibRart özelliği              | Referans port            | Not                                     |
| ------ | ----------------------------- | ------------------------ | --------------------------------------- |
| **F0** | Test, CI, updater, provenance | scaffold referansları    | ✅                                      |
| **F1** | FeatureRegistry, adaptör      | plugin-toolkit           | ✅                                      |
| **F2** | Güvenli BibTeX/RIS import     | scholar-sidekick         | ✅                                      |
| **F3** | DOCX kullanılanlar            | zotero-tag-cited         | ✅                                      |
| **F4** | Okuma + timeline              | zotero-reading-flow      | ✅ (F4 + F4.1)                          |
| **F5** | OpenAlex / OpenCitations      | CitationMaps, openalex   | ✅ F5 OpenAlex + **F5.2** OpenCitations |
| ~~F6~~ | ~~PDF Gelen Kutusu~~          | —                        | **→ Katman 2** (PDF Manager)            |
| **F7** | Anki köprüsü                  | yanki-connect            | ✅                                      |
| **F8** | MarkDB + Better Notes         | markdb, better-notes     | ✅ F8.1 + F8.2.1–2.2                    |
| **F9** | Semantic                      | ZotSeek + **8756 köprü** | ✅ F9.1–**F9.2.3** (JSON indeks)        |

---

## Mevcut özellikler (✅)

| Özellik                                                       | Modül                                                                  |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Bağlantı Haritası (tag, manual, kısmi semantic/note/citation) | `connectionMap*`, `connectionGraph`                                    |
| Etiket analizi                                                | `tagDashboard`                                                         |
| Inciteful                                                     | `incitefulBridge`                                                      |
| PDF kaynakça çıkarma                                          | `referenceExtractor`                                                   |
| Crossref atıf                                                 | `connectionCitationLayer`, `doiResolver`                               |
| Anki köprüsü (opt-in)                                         | `ankiBridge`, `vendor/yanki-connect/`                                  |
| MarkDB vault → note kenarları (opt-in)                        | `markdbBridge`, `vendor/markdb/`                                       |
| Kutuphane semantic 8756 (opt-in)                              | `kutuphaneSemanticBridge`, `semanticBridge`                            |
| OpenCitations atıf kenarları + disk cache (opt-in)            | `openCitationsCitationLayer`                                           |
| Citegeist OpenAlex özet (opt-in, ince)                        | `citegeistBridge`, `citegeistMetrics`                                  |
| ZotSeek probe + JSON vektör indeks (opt-in)                   | `zotseekProbe`, `assetProbe`, `vectorStoreRuntime`, `vendoredSemantic` |
| Not wikilink ekleme + ilgili notlar (opt-in)                  | `noteWorkspace`, `vendor/zotero-better-notes/`                         |

---

## Katman 3 yasakları

- Pipeline, OCR, dosya rename, KP atama (Katman 1)
- Watch roots, otomatik PDF eşleştirme, metadata gömme (Katman 2)
- Tam kütüphane grafiği (99k) — koleksiyon/seçim kapsamı

---

## Köprü (Katman 3)

| Servis                      | Port | Rol                                    |
| --------------------------- | ---- | -------------------------------------- |
| `zotero_semantic_bridge.py` | 8756 | Semantic arama (Kutuphane `chunks.db`) |

Katman 1 köprü eklentisi **ayrı** — LibRart’a karışmaz.

---

## Değişiklik günlüğü

| Tarih      | Ajan   | Özet                                                |
| ---------- | ------ | --------------------------------------------------- |
| 2026-07-29 | cursor | F9.2.3 JSON vector index + findSimilar (v1.0.45)    |
| 2026-07-29 | cursor | F9.2.2 ZotSeek asset wire + fetch scripts (v1.0.44) |
| 2026-07-29 | cursor | F5.2b OC cache + Citegeist özet (v1.0.43)           |
| 2026-07-29 | cursor | F5.2 OpenCitations citation layer (v1.0.42)         |
| 2026-07-29 | cursor | F9.2.1 ZotSeek probe + status UX (v1.0.41)          |
| 2026-07-29 | cursor | F8.2.2 ilgili notlar (v1.0.40)                      |
| 2026-07-29 | cursor | F8.2.1 not wikilink ekleme (v1.0.39)                |
| 2026-07-29 | cursor | F9.1 Kutuphane semantic opt-in (v1.0.38)            |
| 2026-07-29 | cursor | F8.1 MarkDB vault note edges (v1.0.37)              |
| 2026-07-29 | cursor | F7 Anki köprüsü (v1.0.36)                           |
| 2026-07-29 | cursor | F3 DOCX cited                                       |
| 2026-07-29 | cursor | F2 güvenli import                                   |
| 2026-07-29 | cursor | F1 FeatureRegistry + ZoteroAdapter                  |
| 2026-07-29 | cursor | F0 tamamlandı (Vitest, CI, YAML şema)               |
| 2026-07-29 | cursor | Katman 3 hub; F6 Katman 2’ye taşındı                |
