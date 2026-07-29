<!-- @ajan: codex · @etiket: librart-pro, coordination, agents, ssot -->
# LibRart Pro — üç ajan koordinasyonu (Cursor · Claude · Codex)

Bu dosyayı **LibRart Pro** (`zotero-eklentiler/kaynak/`) üzerinde çalışan her ajan görev
başında okur. Ana Kütüphane repo'su ile paylaşılan kurallar için üst dizindeki
[`AGENTS.md`](../../AGENTS.md) ve [`Changes.md`](../../Changes.md) de okunur.

## Görev başı (sırayla)

1. **`REFERANS-ANALIZ.md`** — tek kaynak (SSOT): lisans §1, güncel fazlar §10,
   tarihsel eski plan §10A–§11, port brifi §23
2. **`VENDOR-SOURCES.md`** — fiili vendor tablosu (port tamamlandıkça güncelle)
3. Üst **`Changes.md`** — en üst 5 giriş; aynı dosyada karşı ajan ne yaptı?
4. Üst **`.cursor/rules/zotero-entegrasyon.mdc`** — Kütüphane ↔ LibRart sınırları, köprü (8756)

## SSOT kuralı

| Ne | Nereye |
|---|---|
| Yeni lisans / faz / mimari karar | `REFERANS-ANALIZ.md` + değişiklik günlüğü |
| Modül portu (hangi upstream → hangi dosya) | `REFERANS-ANALIZ.md` **§23** |
| Vendor satırı eklendi | `VENDOR-SOURCES.md` + §0 durum tablosu |
| Anlamlı oturum (ana repo görünürlüğü) | `Kutuphane/Changes.md` |

**Stub'lara içerik ekleme yasak** — yalnız yönlendirme: `ENTEGRASYON-PLANI.md`,
`CURSOR-GOREV-ORIJINAL-KOD-ENTEGRASYONU.md`, `CITATION-GRAPH-ENTEGRASYON.md`,
`KALITE-REFERANSLARI.md`, `REFERANS-BEKLEYEN-OZELLIK.md`, `../REFERANS-ANALIZI.md`,
`../referanslar/ANALIZ.md`.

## Kritik kurallar

- **13 lisanssız depo → kod portu yok** (`REFERANS-ANALIZ.md` §1a); `scite-zotero-plugin` dahil
- Kullanıcı onayı telif izni değildir
- `zotero-citation-network` silindi (malware) — geri klonlama
- Her vendor dosyasında attribution + provenance satırı (§23.1)
- LibRart kaynağı ana Kutuphane git'ine dahil değil; yine de dosya başı `@ajan` zorunlu

## Etiket

| Dosya türü | Format |
|---|---|
| `.ts` / `.js` | `// @ajan: cursor · @etiket: librart, vendor` |
| `.md` | `<!-- @ajan: … -->` (ilk satır) |

`@ajan`: `cursor` \| `claude` \| `codex` \| `kullanıcı`

## Doğrulama (port / faz sonrası)

```bash
cd zotero-eklentiler/kaynak
npm run build
```

Ayrıntı: `REFERANS-ANALIZ.md` §15 ve §22.

## İlgili girişler

| Araç | Ek okuma |
|---|---|
| Claude Code | `CLAUDE.md` (bu klasör) · kök `CLAUDE.md` |
| Cursor | `.cursor/rules/zotero-entegrasyon.mdc` · `kutuphane-gorev` skill |
| Codex | kök `AGENTS.md` · `CLAUDE.md` rule tablosu |
