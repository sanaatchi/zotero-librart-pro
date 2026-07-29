# LibRart Pro — Claude Code

Claude Code bu eklentide **Cursor/Codex ile aynı depoda** çalışır (`zotero-eklentiler/kaynak/`).

## Görev başı

**[`AGENTS.md`](AGENTS.md)** — üç ajan için ortak giriş (sıra, SSOT, stub listesi, etiket).

Özet okuma sırası:

1. **`AGENTS.md`** (bu klasör)
2. **`REFERANS-ANALIZ.md`** — SSOT; port brifi §23
3. **`VENDOR-SOURCES.md`** — fiili vendor tablosu
4. Kök **`CLAUDE.md`** + **`AGENTS.md`** + **`Changes.md`** (Kutuphane ana repo)

## Bakım

Yeni referans analizi veya entegrasyon kararı → **yalnız `REFERANS-ANALIZ.md` güncelle**
(§ Bakım kuralı + değişiklik günlüğü). Stub'lara veya paralel `.md`'ye içerik ekleme yasak.

## Kritik kurallar

- **Lisanssız depo → kod portu yok** (§1a; `scite-zotero-plugin` dahil)
- Yeni klon ekleme: atıf/RAG kategorileri doymuş (§8)
- `zotero-citation-network` silindi — malware; geri klonlama
- Her vendor dosyasında attribution + provenance satırı (§23.1)

## Etiket

`# @ajan: claude · @etiket: …` — LibRart kaynak repo'su ana Kutuphane git'ine dahil değil;
yine de dosya başı etiket kullan.
