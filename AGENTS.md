<!-- @ajan: cursor · @etiket: librart-pro, coordination, agents, plan, eksik-raporu -->

# LibRart Pro — üç ajan koordinasyonu (Cursor · Claude · Codex)

Görev başı: **[`LIBRART-GIRIS.md`](LIBRART-GIRIS.md)** (plan rehberi ve isim haritası).

Ana Kütüphane: üst [`AGENTS.md`](../../AGENTS.md), [`Changes.md`](../../Changes.md).

## Okuma sırası (her yeni Katman 3 düzenlemesi)

1. **`CURSOR-KATMAN-3-EKSIKLER-RAPORU.md`** — açık P1/P2/P3 **önce oku**
2. Rapordaki açık maddeleri **düzelt** (önce P1)
3. **`LIBRART-GIRIS.md`** — hangi plan?
4. Göreve göre **`LIBRART-YAPILANDIRMA.md`** veya **`LIBRART-REFERANS-PORT.md`**
5. **`LIBRART-VENDOR.md`** — tamamlanan portlar
6. **`.cursor/rules/zotero-entegrasyon.mdc`** · **`katman-eksik-raporu.mdc`**

**Kural (üç katman ortak):** Eksikler raporu kapanmadan (veya bu oturumda ilgili P1’ler düzeltilmeden) yeni özellik/faz işine başlama.

Diğer katmanlar:  
`kutuphane-kopru/CURSOR-KATMAN-1-EKSIKLER-RAPORU.md` ·  
`zotero-pdf-manager/CURSOR-KATMAN-2-EKSIKLER-RAPORU.md`

## SSOT

| Ne                             | Dosya                                |
| ------------------------------ | ------------------------------------ |
| Eksik / kabul kapısı (önce)    | `CURSOR-KATMAN-3-EKSIKLER-RAPORU.md` |
| Manuel Zotero kabul            | `ZOTERO-KABUL-CHECKLIST.md`          |
| Faz, pref, menü, test, release | `LIBRART-YAPILANDIRMA.md`            |
| Lisans, port, modül eşlemesi   | `LIBRART-REFERANS-PORT.md`           |
| Vendor satırı                  | `LIBRART-VENDOR.md`                  |
| Oturum kaydı                   | `Kutuphane/Changes.md`               |

**Arşiv:** `LIBRART-ARSIV.md` · **Güvenlik blocklist:** [`../REFERANS-BLOCKLIST.md`](../REFERANS-BLOCKLIST.md)

**Stub:** eski adlar (`PLAN.md`, `REFERANS-ANALIZ.md`, …) — içerik ekleme yasak.

## Doğrulama

```bash
cd zotero-eklentiler/kaynak && npm test && npm run lint:check && npm run build
```

## Etiket

`@ajan`: `cursor` \| `claude` \| `codex` \| `kullanıcı`
