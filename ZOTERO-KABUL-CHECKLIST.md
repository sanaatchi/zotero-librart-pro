<!-- @ajan: cursor · @etiket: katman-3, kabul, checklist, zotero, v1.0.58 -->

# LibRart Pro — Zotero manuel kabul checklist

**Sürüm:** 1.0.58 (`package.json`)  
**Önceki imza:** 1.0.48 (2026-07-30)  
**XPI kanalı:** https://github.com/sanaatchi/zotero-librart-pro-releases/releases  
*(1.0.58 XPI yoksa yerel `npm run build`.)*

| Alan | Değer |
|------|--------|
| Tarih (otomatik) | 2026-08-02 |
| Otomatik kanıt | `npm test` → **129 pass** |
| Testçi (manuel) | _(kullanıcı)_ |
| Zotero sürümü | _(kullanıcı)_ |

## A — Otomatik / sözleşme (ajan)

| # | Senaryo | Beklenen | Sonuç | Kanıt |
|---|---------|----------|-------|-------|
| A1 | Test paketi | fail=0 | ✅ | 129 pass (2026-08-02) |
| A2 | Ölü :8767 köprü kaldırıldı | `citationBridge` yok | ✅ | dosya silindi; prefs/menü temiz |
| A3 | Offline graf yolu | 8756 + build script | ✅ | `kutuphaneConnectionGraph` testleri |
| A4 | Loopback HTTP | yalnız 127.0.0.1/localhost | ✅ | `loopbackHttp.test.ts` |

- [x] Bölüm A ✅

## B — Zotero UI smoke (kullanıcı)

| # | Senaryo | Beklenen | Sonuç | Kanıt |
|---|---------|----------|-------|-------|
| B1 | Eklenti yükle 1.0.58 | Menü + tercihler | ⬜ | |
| B2 | Bağlantı Haritası | Seçili/koleksiyon kapsamı | ⬜ | |
| B3 | Semantic opt-in | 8756 / ZotSeek prefs | ⬜ | |
| B4 | Citation-graph bridge UI | **Yok** (kaldırıldı) | ⬜ | |
| B5 | MarkDB / manuscript diff (opt-in) | Pref açıkken menü | ⬜ | |
| B6 | Offline graf operasyon | `_build_zotero_connection_graph.py` + `:8756/connection-graph` | ⬜ | |

- [ ] Bölüm B tamam

## C — Politika

| Konu | Gerçek |
|------|--------|
| AI / RAG | LibRart’ta yok → 8077 / 8756 |
| OpenAlex CLI :8767 | **Kaldırıldı** (v1.0.58) |
| Companion XPI | BBT, PDF Translate, Word citation — ayrı kurulum |
| Systematic Reviewer | port yok |
