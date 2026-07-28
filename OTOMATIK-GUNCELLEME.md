# Otomatik güncelleme

Kaynak private, dağıtım public — PDF Manager ile aynı model.

| Repo | Görünürlük | İçerik |
|---|---|---|
| `sanaatchi/zotero-actions-tags` | Private | Kaynak kod |
| `sanaatchi/zotero-actions-tags-releases` | **Public** | `.xpi` + `update.json` |

Addon ID: `zoterotag@ibrahimyildiz.art`  
(Resmi `zoterotag@euclpts.com` ile çakışmaz; resmi güncelleme fork’u ezmez.)

## İlk kurulum (bir kez)

```bash
npm run gh-release
```

Çıkan `build/actions-and-tags-for-zotero.xpi` dosyasını Zotero’da  
**Tools → Add-ons → Install Add-on From File** ile kur.

Eski resmi Actions & Tags yüklüyse kaldırabilirsin (farklı ID).

## Her iyileştirmede

```bash
npm version patch --no-git-tag-version   # 2.6.0 → 2.6.1
npm run gh-release
git add -A && git commit -m "..." && git push
```

Zotero **Add-ons → Check for Updates** ile yeni sürümü alır.
