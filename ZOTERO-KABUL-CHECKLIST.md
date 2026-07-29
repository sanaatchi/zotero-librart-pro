<!-- @ajan: cursor · @etiket: katman-3, kabul, checklist, zotero -->

# LibRart Pro — Zotero manuel kabul checklist

**Sürüm:** 1.0.46 · **Kaynak commit:** `c85b705` (güncelle: release sonrası)  
**Rule:** önce [`CURSOR-KATMAN-3-EKSIKLER-RAPORU.md`](CURSOR-KATMAN-3-EKSIKLER-RAPORU.md)

Her satırı doldur: `✅` / `❌` / `—` (uygulanmadı). Kanıt: kısa log veya ekran yolu.

| Alan          | Değer                              |
| ------------- | ---------------------------------- |
| Tarih         |                                    |
| Testçi        |                                    |
| OS            | Windows                            |
| Zotero sürümü | (7 / 8 / 9 / 10)                   |
| XPI kaynağı   | `gh-release` / yerel `build/*.xpi` |
| Notlar        |                                    |

## Senaryolar

| #   | Senaryo                          | Beklenen                                                        | Sonuç | Kanıt |
| --- | -------------------------------- | --------------------------------------------------------------- | ----- | ----- |
| 1   | Eklentiyi yükle / enable         | Menü, tercihler, hata yok                                       |       |       |
| 2   | İkinci ana pencere aç            | Global observer/sütun **tek**; her pencerede LibRart menüsü var |       |       |
| 3   | Bir pencereyi kapat              | Diğer pencere menü/otomasyon çalışmaya devam                    |       |       |
| 4   | Reader aç / kapat                | Tracker sızıntısı / timeout birikimi yok                        |       |       |
| 5   | Eklenti disable → enable         | Menü, observer, sütunlar temiz kapanıp açılır                   |       |       |
| 6   | Pref: `reading.enabled` kapat/aç | Belgelenen davranış (şimdilik: yeniden başlat gerekebilir)      |       |       |
| 7   | Locale TR                        | Ham Fluent ID yok                                               |       |       |
| 8   | Locale EN                        | Ham Fluent ID yok                                               |       |       |
| 9   | Araçlar → Güncellemeleri denetle | v1.0.46 + SHA-512 kabul (release sonrası)                       |       |       |
| 10  | Bağlantı Haritası aç             | Katmanlar yüklenir, konsol hatası yok                           |       |       |

## İmza

- [ ] P1 manuel matris tamam — rapor satırını `✅` yap
- [ ] Bilinen regresyonlar `CURSOR-KATMAN-3-EKSIKLER-RAPORU.md` P2’ye işlendi

```text
İmza: _______________  Tarih: _______________
```
