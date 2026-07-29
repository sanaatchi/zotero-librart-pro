# LibRart Pro (`zotero-librart-pro`)

Zotero eklentisi — etiketler, eylemler, Bağlantı Haritası, referans araçları.

| Alan | Değer |
|------|--------|
| Görünen ad | **LibRart Pro** |
| `addonID` | `librartpro@euclpts.com` |
| `addonRef` | `librartpro` |
| Kaynak repo | `sanaatchi/zotero-librart-pro` |
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

Vendor kaynak kodları: `VENDOR-SOURCES.md`
