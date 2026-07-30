<!-- @ajan: cursor · @etiket: katman-3, kabul, checklist, zotero, v1.0.48 -->

# LibRart Pro — Zotero manuel kabul checklist

**Sürüm:** 1.0.48 · **Kaynak:** `b9173b2` · [CI](https://github.com/sanaatchi/zotero-librart-pro/actions/runs/30496596733)  
**XPI:** https://github.com/sanaatchi/zotero-librart-pro-releases/releases/tag/v1.0.48

| Alan   | Değer                                |
| ------ | ------------------------------------ |
| Tarih  | 2026-07-30                           |
| Testçi | kullanıcı (sohbet)                   |
| Zotero | (sürümü sonra yaz)                   |
| Özet   | Manuel matris tamam (A2 Windows N/A) |

| #   | Senaryo                | Beklenen               | Sonuç | Kanıt                         |
| --- | ---------------------- | ---------------------- | ----- | ----------------------------- |
| 1   | Yükle / enable         | Menü, tercihler        | ✅    | menü+tercih OK                |
| 2   | İkinci pencere         | Observer tek; menü var | ⏭    | Windows’ta 2. ana pencere yok |
| 3   | Reader aç/kapat        | Sızıntı yok            | ✅    | aç/kapat OK                   |
| 4   | Pref toggle            | Belgelenen davranış    | ✅    | Citegeist özeti               |
| 5   | Locale TR/EN           | Ham Fluent ID yok      | ✅    | Türkçe OK                     |
| 6   | Locale it/zh           | Ham ID yok (parity)    | ✅    | localeParity 6/6              |
| 7   | Semantic URL non-local | Reddedilir / loopback  | ✅    | kutuphaneSemanticParse 4/4    |
| 8   | Item sil → vektör      | Store satırı kalkar    | ✅    | silme smoke OK                |
| 9   | Güncelleme             | v1.0.48                | ✅    | kurulu 1.0.48                 |
| 10  | Bağlantı Haritası      | Yüklenir               | ✅    | harita OK                     |

- [x] Manuel matris tamam → rapor checklist `✅`
