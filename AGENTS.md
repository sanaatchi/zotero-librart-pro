<!-- @ajan: cursor · @etiket: librart-pro, coordination, agents, plan -->
# LibRart Pro — üç ajan koordinasyonu (Cursor · Claude · Codex)

Görev başı: **[`LIBRART-GIRIS.md`](LIBRART-GIRIS.md)** (plan rehberi ve isim haritası).

Ana Kütüphane: üst [`AGENTS.md`](../../AGENTS.md), [`Changes.md`](../../Changes.md).

## Okuma sırası

1. **`LIBRART-GIRIS.md`** — hangi plan?
2. Göreve göre **`LIBRART-YAPILANDIRMA.md`** veya **`LIBRART-REFERANS-PORT.md`**
3. **`LIBRART-VENDOR.md`** — tamamlanan portlar
4. **`.cursor/rules/zotero-entegrasyon.mdc`** — Kütüphane sınırı (8756)

## SSOT (iki plan)

| Ne | Dosya |
|---|---|
| Faz, pref, menü, test, release | `LIBRART-YAPILANDIRMA.md` |
| Lisans, port, modül eşlemesi | `LIBRART-REFERANS-PORT.md` |
| Vendor satırı | `LIBRART-VENDOR.md` |
| Oturum kaydı | `Kutuphane/Changes.md` |

**Arşiv:** `LIBRART-ARSIV.md` · **Güvenlik blocklist:** [`../REFERANS-BLOCKLIST.md`](../REFERANS-BLOCKLIST.md)

**Stub:** eski adlar (`PLAN.md`, `REFERANS-ANALIZ.md`, …) — içerik ekleme yasak.

## Doğrulama

```bash
cd zotero-eklentiler/kaynak && npm run build
```

## Etiket

`@ajan`: `cursor` \| `claude` \| `codex` \| `kullanıcı`
