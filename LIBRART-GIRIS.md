<!-- @ajan: cursor · @etiket: plan, index, agents, librart-giris -->
# LibRart Pro — giriş (plan rehberi)

**Katman 3** — Kütüphane üç katman stratejisinde araştırma/yazma eklentisi.
Katman 1 (Kütüphane + köprü) ve Katman 2 (PDF Manager) sonrası kullanılır.

| Genel | Katman 3 hub |
|-------|--------------|
| [`../../docs/PLAN-GIRIS.md`](../../docs/PLAN-GIRIS.md) | [**KATMAN-3-PLAN.md**](KATMAN-3-PLAN.md) |
| [`../../docs/uc-katman-stratejisi.md`](../../docs/uc-katman-stratejisi.md) | Aktif faz, yasaklar, F6→Katman 2 |

**Buradan başla (LibRart planı):**

| Ne yapıyorsun? | Dosya | İçerik |
|----------------|-------|--------|
| **Eklentiyi yapılandırıyorum** — fazlar, tercihler, menü, test, release | [**LIBRART-YAPILANDIRMA.md**](LIBRART-YAPILANDIRMA.md) | LibRart'ın kendi yol haritası |
| **Referans eklentiden kod taşıyorum** — lisans, vendor, dosya eşlemesi | [**LIBRART-REFERANS-PORT.md**](LIBRART-REFERANS-PORT.md) | `referanslar/` → `src/` |
| Port tamamlandı, kayıt | [**LIBRART-VENDOR.md**](LIBRART-VENDOR.md) | Fiili vendor tablosu |
| Üç ajan kuralları | [**AGENTS.md**](AGENTS.md) | Okuma sırası, etiket |

## Hızlı cevaplar

- **Sıradaki iş ne?** → `LIBRART-YAPILANDIRMA.md` § Sonraki adım (şu an **F7**)
- **Bu depodan kod kopyalayabilir miyim?** → `LIBRART-REFERANS-PORT.md` § Lisans
- **Hangi upstream dosya nereye?** → `LIBRART-REFERANS-PORT.md` § Modül eşlemesi
- **91 klon envanteri** → `../README.md` (liste only; karar burada değil)

## İsim haritası (karışıklığı önlemek için)

| Eski / benzer isim | Ne | Güncel dosya |
|--------------------|-----|--------------|
| `PLAN.md` | giriş | **bu dosya** (`LIBRART-GIRIS.md`) |
| `YAPILANDIRMA-PLANI.md` | eklenti planı | `LIBRART-YAPILANDIRMA.md` |
| `REFERANS-ENTEGRASYON-PLANI.md` | port planı | `LIBRART-REFERANS-PORT.md` |
| `REFERANS-ANALIZ.md` / `REFERANS-ANALIZI.md` | eski tek SSOT | stub → burası; arşiv → `LIBRART-ARSIV.md` |
| `referanslar/ANALIZ.md` | ilk klon notları | stub → `LIBRART-REFERANS-PORT.md` |
| `VENDOR-SOURCES.md` | vendor tablosu | `LIBRART-VENDOR.md` |

## Bakım kuralı

| Değişiklik türü | Güncelle |
|-----------------|----------|
| Faz, pref, menü, UI, test, release | `LIBRART-YAPILANDIRMA.md` |
| Lisans, port kararı, modül eşlemesi | `LIBRART-REFERANS-PORT.md` + `LIBRART-VENDOR.md` |
| Anlamlı oturum | `Kutuphane/Changes.md` |

**Arşiv:** [`LIBRART-ARSIV.md`](LIBRART-ARSIV.md) — eski monolitik belge; güncelleme yok.

**Stub (içerik ekleme yasak):** eski dosya adları yalnız yönlendirme içerir.
