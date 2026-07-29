<!-- @ajan: cursor · @etiket: katman-3, eksik-raporu, p2-partial -->

# Cursor için Katman 3 eksik analizi

**Tarih:** 2026-07-30 · **Sürüm:** v1.0.47 (+ P2 kod; patch release ayrı)  
**Durum:** P1 ✅. P2 kısmen kapandı. Checklist manuel. Pref live-reconcile açık.

| Madde                         | Durum | Not                                              |
| ----------------------------- | ----- | ------------------------------------------------ |
| Startup / provenance CI       | ✅    |                                                  |
| Locale it-IT/zh-CN parity     | ✅    | en-US ID sync + `localeParity.test.ts`           |
| HTTP Semantic/Anki allowlist  | ✅    | loopback-only (fail-closed)                      |
| Vektör delete on trash/delete | ✅    | `removeItemEmbedding` + notify                   |
| Vendored `eval()`             | 🟡    | Belgelendi; vendor lint-ignore; postMessage TODO |
| Pref live reconcile           | ❌ P2 | Restart hâlâ gerekebilir                         |
| Zotero checklist              | 🟡    | Şablon v1.0.47                                   |
