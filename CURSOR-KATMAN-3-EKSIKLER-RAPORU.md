<!-- @ajan: cursor · @etiket: katman-3, eksik-raporu, reading-off, v1.0.61 -->

# Cursor — Katman 3 Eksikler Raporu

**Tarih:** 2026-08-02 · **Sürüm:** LibRart Pro **v1.0.61**  
**Doğrulama:** `npm test` → güncel suite

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
| **G12** | KP `kpToken.ts` DRY mirror | ✅ v1.0.60 — K1/K2 ile aynı regex+MAX |

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

---

## Claude — derinlemesine bug taraması (2026-08-06)

**Kapsam:** `connectionMapRenderer.ts` (2029 satır), `markdbBridge.ts`, önceki `engineering:code-review` geçişinden `ankiNotePayload.ts` / `docxCitedBridge.ts` bulguları. Doğrulama: `npx tsc --noEmit` temiz, `npx vitest run` 33 dosya / 134 test yeşil.

| ID | Dosya | Bug | Durum |
|----|-------|-----|-------|
| **B1** | `src/modules/markdbBridge.ts` `syncMarkdbTagsFromVault` | Etiket-arama `new Zotero.Search()` `libraryID` almıyordu (repodaki tek istisna — `docxCitedBridge.ts`/`manuscriptDiffBridge.ts`/`tagActions.ts`/`libraryMatch.ts` hepsi `{ libraryID }` ile scoped). `withNotes` set'i tek kütüphaneye scoped (`buildIdMapsFromLibraryAsync(libraryID)`) ama `taggedIds` TÜM kütüphaneleri kapsıyordu → silme döngüsü (satır 276-283), taranan vault'la hiç ilgisi olmayan BAŞKA kütüphanelerdeki (örn. grup kütüphaneleri) öğelerden `mdbc` etiketini siliyordu. | ✅ **Düzeltildi** — `syncMarkdbTagsFromVault(notes, maps, libraryID)` imzasına `libraryID` eklendi, `search = new Zotero.Search({ libraryID })`; tek çağıran (`runManualVaultScan`) güncellendi. tsc + vitest temiz. |
| **B2** | `src/vendor/yanki-connect/ankiNotePayload.ts` `decideNoteId()` | Saklanan `linkedNoteId`, Anki tarafında hâlâ var mı diye doğrulanmadan güveniliyor — not Anki'de silinirse sync kalıcı olarak başarısız oluyor. | ⬜ Önceki `code-review` geçişinde bulundu, **"Needs Discussion"** ile bırakıldı — henüz düzeltilmedi. |
| **B3** | `src/modules/docxCitedBridge.ts` `refreshTag()` | `citedByLibrary` map'i sadece mevcut parse'ta atıf bulunan kütüphanelerden + zorla eklenen `userLibraryID`'den besleniyor — bir grup kütüphanesindeki TÜM atıflar sonradan kaldırılırsa o kütüphanedeki eski `cited:` etiketleri hiç temizlenmiyor. | ⬜ Önceki `code-review` geçişinde bulundu, henüz düzeltilmedi. |
| — | `connectionMapRenderer.ts` (tam 2029 satır) | `innerHTML=`/`JSON.parse` kontrolü, 28 `addEventListener` (mountSvg her redraw'da `canvas.textContent = ""` ile eski node+listener'ları temizliyor — leak yok), context-menu `closeOnce` deseni, pointer drag/pan/zoom `pointerId`-guard + `endPointer()` temizliği. | ✅ Bug bulunamadı — temiz. |

**Öncelik:** B2 ve B3 küçük, izole düzeltmeler (P2); istenirse ayrı bir görevde tamamlanabilir.
