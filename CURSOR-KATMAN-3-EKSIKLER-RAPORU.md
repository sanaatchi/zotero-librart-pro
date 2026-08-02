<!-- @ajan: cursor · @etiket: katman-3, eksik-raporu, g1-g4-closed, v1.0.58 -->

# Cursor — Katman 3 Eksikler Raporu

**Tarih:** 2026-08-02 · **Sürüm:** LibRart Pro **v1.0.59**  
**Doğrulama:** `npm test` → **129/129** pass

## Özet hüküm

| Soru | Cevap |
|------|-------|
| Açık **P1**? | **Yok** — G1 temizlendi (ölü `:8767` kaldırıldı) |
| Çekirdek F0–F9.2.3? | Sağlam |
| Offline graf? | **8756** + `_build_zotero_connection_graph.py` |
| Kabul UI smoke? | Bölüm B ⬜ (kullanıcı) |

---

## Kapalı (bu oturum G1–G4)

| ID | Madde | Durum |
|----|-------|-------|
| **G1** | Ölü citation-bridge `:8767` | ✅ v1.0.58 — modül/prefs/menü/ftl kaldırıldı |
| **G2** | Kabul checklist | ✅ ajan Bölüm A; `ZOTERO-KABUL-CHECKLIST.md` → 1.0.58 |
| **G3** | Doc sync | ✅ YAPILANDIRMA 129 test · REFERANS-PORT kuratör 7 · VENDOR 8767 notu |
| **G4** | Companion XPI | ✅ README + REFERANS-PORT companion tablosu |
| **G11** | KP format K1 parity | ✅ v1.0.59 — pad + MAX 99999 |

### Önceki (1.0.56–57)

Menü IA, yazım prefs, MarkDB, manuscript diff, RefChecker, BN tabs — ✅

---

## Kalan (P3 / isteğe bağlı)

| ID | Madde | Not |
|----|-------|-----|
| G5 | BN full chrome | bilinçli |
| G6 | Citegeist derinlik | ince bridge |
| G7 | Qualified refs / Cita | araştırma |
| G9 | Systematic Reviewer | port yok |
| — | Kabul Bölüm B UI | kullanıcı imzası |

### Yapılmaz

OCR/KP gömme · üç XPI birleştirme · AI/RAG LibRart içi · scite · `:8767` sessiz restore

---

## Sonraki

1. Kullanıcı: `ZOTERO-KABUL-CHECKLIST.md` Bölüm B smoke  
2. İsteğe bağlı P3 (G5–G7)  
3. XPI yayın v1.0.58
