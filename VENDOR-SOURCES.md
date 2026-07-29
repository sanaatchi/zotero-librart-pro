# Vendor kaynak kodları

Bu eklenti, aşağıdaki açık kaynak Zotero eklentilerinin **orijinal kaynak kodunu**
doğrudan `src/vendor/` altında barındırır ve uyarlar. Her dosyanın başında
kaynak-atıf yorumu bulunur.

| Kaynak | Lisans | Konum | Kullanım |
|--------|--------|-------|----------|
| [zotero-reference](https://github.com/muisedestiny/zotero-reference) | AGPL-3.0 | `src/vendor/zotero-reference/` | DOI çözümleme (`doiResolver.ts`), PDF referans çıkarma, okuyucu kenar çubuğu |
| [zotero-style](https://github.com/muisedestiny/zotero-style) | AGPL-3.0 | `src/vendor/zotero-style/tagGraph.ts` | Etiket eş-oluşum grafiği (Bağlantı Haritası tag katmanı) |
| [ZotSeek](https://github.com/joseferben/zotseek) | MIT | `src/vendor/zotseek/` | Yerel embedding (aşama 2 — WASM/model varlıkları eklendiğinde) |
| [zotero-better-notes](https://github.com/windingwind/zotero-better-notes) | AGPL-3.0 | `src/modules/noteWorkspace.ts` | Not workspace (aşama 2 — tam port devam ediyor) |

**Kullanılmayan / kopyalanmayan:**

- **Zotero-Citation-Graph** — LICENSE yok; yalnızca algoritma fikri (`connectionCitationLayer` Crossref DOI eşlemesi).
- **inciteful-zotero-plugin** — kullanıcı talebiyle tamamen dışlandı.

## Derleme notu

Büyük vendor dosyaları geçiş döneminde `// @ts-nocheck` ile işaretlenmiştir; davranış
orijinal kaynakla uyumludur, tipler kademeli sıkılaştırılacaktır.

## Doğrulama

```bash
npm run build
```

Zotero'da: Bağlantı Haritası → tag / atıf / anlamsal katmanlar; PDF okuyucuda
**References** sekmesi (zotero-reference views).
