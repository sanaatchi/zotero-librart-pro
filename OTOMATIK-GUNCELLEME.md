<!-- @ajan: codex · @etiket: librart-pro, updater, bilinen-tutarsizlik -->
# Güncelleme (elle tetikleme)

> **Mevcut durum — yayınlamaya hazır değil:** Yapılandırma
> `sanaatchi/zotero-librart-pro-releases` deposunu hedefliyor; son doğrulamada
> bu public depo mevcut değildi. Ayrıca `zotero-plugin.config.ts` içinde
> `makeUpdateJson.hash: false` ve üretilmiş `build/update.json` içinde
> `update_hash` yok. Aşağıdaki hedef akış, depo oluşturulup SHA-512 hash
> üretimi ve gerçek Zotero güncellemesi uçtan uca doğrulanmadan çalışıyor
> kabul edilmez.

Kaynak **private**; Zotero güncellemesi için yalnızca `.xpi` + `update.json` **public** release reposunda tutulur.

| Repo | Görünürlük | İçerik |
|---|---|---|
| `sanaatchi/zotero-librart-pro` | Private | Kaynak |
| `sanaatchi/zotero-librart-pro-releases` | **Planlanan public repo — henüz mevcut/doğrulanmış değil** | `.xpi` + `update.json` (kaynak kod yok) |

## Elle güncelleme (Zotero içinden)

1. Önkoşul: public release deposu ve update hash üretimi hazır olmalı.
2. Yayın: `npm run gh-release` (aşağıya bakın).
3. Zotero → **Araçlar → Eklentiler** → ⚙ → **Güncellemeleri denetle**.

Otomatik arka plan kontrolünü kapatmak için (isteğe bağlı): `about:config` →  
`extensions.update.enabled` = **false**  
Böylece yalnızca sen ⚙ menüsünden denediğinde güncelleme aranır.

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

Bu sorunlar tarihsel olarak tespit edildi; mevcut LibRart Pro yapılandırmasında hash
yeniden kapalı olduğu için giderilmiş sayılmaz. Release deposu oluşturulup
`update_hash` içeren gerçek manifest Zotero üzerinden doğrulanana kadar yalnız build
çıktısına güvenilmemelidir.
