<!-- @ajan: cursor · @etiket: readme, companion-xpi, v1.0.58 -->
# LibRart Pro (`zotero-librart-pro`)

Zotero eklentisi — etiketler, eylemler, Bağlantı Haritası, referans araçları.

| Alan         | Değer                                   |
| ------------ | --------------------------------------- |
| Görünen ad   | **LibRart Pro**                         |
| `addonID`    | `librartpro@euclpts.com`                |
| `addonRef`   | `librartpro`                            |
| Kaynak repo  | `sanaatchi/zotero-librart-pro`          |
| Release repo | `sanaatchi/zotero-librart-pro-releases` |

## Geliştirme

```bash
npm install
npm run build
```

Çıktı: `build/zotero-librart-pro.xpi`

## Yayın

```bash
npm run gh-release
```

Zotero güncelleme manifesti:  
`https://github.com/sanaatchi/zotero-librart-pro-releases/releases/download/update/update.json`

## Not

`addonID` değiştiği için bu, **Eylemler ve Etiketler** (`zoterotag@euclpts.com`) ile aynı eklenti değildir — yeni kurulum gerekir; eski tercihler otomatik taşınmaz.

Vendor: [`LIBRART-VENDOR.md`](LIBRART-VENDOR.md)

**Referans port:** [`LIBRART-REFERANS-PORT.md`](LIBRART-REFERANS-PORT.md)

## Companion XPI (ayrı kurulum)

LibRart **üç katman XPI’sinden biri** (Katman 3). Birleştirilmez.

| Rol | Eklenti |
|-----|---------|
| Katman 1 | Kütüphane Köprü |
| Katman 2 | Zotero PDF Manager (+ isteğe bağlı Zoplicate) |
| Katman 3 | **LibRart Pro** (bu repo) |
| BibTeX / citekey | Better BibTeX |
| PDF çeviri | Translate for Zotero |
| Word | Zotero Word eklentisi / citation yardımcısı |

**Offline Bağlantı Haritası (Kutuphane):** `python _build_zotero_connection_graph.py` →
semantic bridge **:8756** `/connection-graph`. Eski OpenAlex CLI **:8767** kaldırıldı.

Plan: [`LIBRART-GIRIS.md`](LIBRART-GIRIS.md) · Eksikler: [`CURSOR-KATMAN-3-EKSIKLER-RAPORU.md`](CURSOR-KATMAN-3-EKSIKLER-RAPORU.md)
