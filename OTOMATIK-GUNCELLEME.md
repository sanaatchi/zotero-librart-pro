# Otomatik güncelleme

Elle XPI yeniden kurmaya gerek yok. Zotero, eklenti içindeki `update_url` üzerinden yeni sürümü bulur.

| Repo | Görünürlük | İçerik |
|---|---|---|
| `sanaatchi/zotero-librart-pro` | Private | Kaynak |
| `sanaatchi/zotero-librart-pro-releases` | **Public** | `.xpi` + `update.json` |

## Kanal

Kurulu eklentinin `update_url` değeri:

```
https://github.com/sanaatchi/zotero-librart-pro-releases/releases/download/update/update.json
```

Bu, Translate for Zotero ile aynı model: kalıcı bir `update` release’inde yalnızca `update.json` tutulur. Her yayında dosya **silinip yeniden yüklenir** (`--clobber` CDN’de eski dosyayı bırakabiliyor).

`update.json` içinde:

- `version` — yeni eklenti sürümü  
- `update_link` — sürümün `.xpi` adresi (`v1.0.x/...`)  
- `update_hash` — `sha512:...` (Zotero 9 için gerekli)  
- `strict_min/max_version` — `7.0` … `10.9.9`

## Yayın

```bash
npm version patch --no-git-tag-version
npm run gh-release
```

`gh-release` bitmeden kanalın yeni sürümü servis ettiğini doğrular. Sonra:

**Zotero → Araçlar → Eklentiler → ⚙ → Güncellemeleri denetle**

## Neden eskiden bozuluyordu?

1. `raw.githubusercontent.com` / `latest/download` CDN’si dakikalarca **eski** `update.json` veriyordu.  
2. Hızlı ardışık release’lerde Zotero hâlâ eski sürümü görüyordu → “güncelleme yok”.  
3. `update_hash` yoktu; çalışan eklentilerde (PDF Translate) hash var.

Bunlar giderildi. **1.0.20+** kuruluysa bundan sonra sadece release + Check for Updates yeterli.
