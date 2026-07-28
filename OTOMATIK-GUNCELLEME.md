# Otomatik güncelleme

| Repo | Görünürlük | İçerik |
|---|---|---|
| `sanaatchi/zotero-actions-tags` | Private | Kaynak |
| `sanaatchi/zotero-actions-tags-releases` | **Public** | `.xpi` + `update.json` |

Addon ID resmiyle aynı kalır (`zoterotag@euclpts.com`) ama `update_url` **bizim** public release kanalına bakar — böylece mevcut kurulum üzerine yazınca sonraki sürümler otomatik gelir.

## Yayın

```bash
npm version patch --no-git-tag-version
npm run gh-release
```

Zotero → Add-ons → **Check for Updates**
