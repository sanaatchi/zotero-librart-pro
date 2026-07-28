# Otomatik güncelleme

| Repo | Görünürlük | İçerik |
|---|---|---|
| `sanaatchi/eylemler-ve-etiketler` | Private | Kaynak |
| `sanaatchi/eylemler-ve-etiketler-releases` | **Public** | `.xpi` + `update.json` |

`update_url` public release kanalına bakar.

## Yayın

```bash
npm version patch --no-git-tag-version
npm run gh-release
```

Zotero → Add-ons → **Check for Updates**
