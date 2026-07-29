<!-- @ajan: cursor · @etiket: librart-pro, updater, docs-sync -->

# Güncelleme (elle tetikleme)

> **Durum (v1.0.46+):** `zotero-plugin.config.ts` → `makeUpdateJson.hash: true`.
> Build çıktısı: `build/update.json` (+ beta). Kök `update.json` /
> `update-beta.json` **build artığıdır** (gitignored) — yayın SSOT değildir.
>
> Public depo: `sanaatchi/zotero-librart-pro-releases`. GitHub’da son XPI
> sürümü ile `package.json` sürümü eşitlenmeden / Zotero içi güncelleme
> uçtan uca doğrulanmadan “release hazır” denmez.

Kaynak **private**; Zotero güncellemesi için yalnızca `.xpi` + `update.json` **public** release reposunda tutulur.

| Repo                                    | Görünürlük | İçerik                                          |
| --------------------------------------- | ---------- | ----------------------------------------------- |
| `sanaatchi/zotero-librart-pro`          | Private    | Kaynak                                          |
| `sanaatchi/zotero-librart-pro-releases` | Public     | `.xpi` + kalıcı `update` tag’inde `update.json` |

## Elle güncelleme (Zotero içinden)

1. `npm run build` → `build/update.json` + `build/*.xpi` üretildiğini doğrula (`update_hash` var).
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

Translate for Zotero ile aynı model: kalıcı bir `update` release’inde yalnızca `update.json` tutulur. Her yayında dosya **silinip yeniden yüklenir** (`--clobber` CDN’de eski dosyayı bırakabiliyor).

`update.json` içinde:

- `version` — `package.json` ile aynı
- `update_link` — `v{version}/zotero-librart-pro.xpi`
- `update_hash` — `sha512:…` (scaffold `hash: true`)

## Yayın komutu

```bash
cd zotero-eklentiler/kaynak
npm test && npm run lint:check && npm run build
npm run gh-release
```

Release kapısı ayrıca: [`CURSOR-KATMAN-3-EKSIKLER-RAPORU.md`](CURSOR-KATMAN-3-EKSIKLER-RAPORU.md) P1 açık madde yok + manuel Zotero checklist.
