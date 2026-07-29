# LibRart Pro — Claude Code

Claude Code bu eklentide **Cursor/Codex ile aynı depoda** çalışır (`zotero-eklentiler/kaynak/`).

## Görev başı (sırayla)

1. **`REFERANS-ANALIZ.md`** — tek kaynak (SSOT); yeni analiz/karar yalnız burada
2. `VENDOR-SOURCES.md` — fiili vendor tablosu
3. `CURSOR-GOREV-ORIJINAL-KOD-ENTEGRASYONU.md` — port brifi
4. Kök `CLAUDE.md` + `AGENTS.md` + `Changes.md` (Kutuphane ana repo)

## Bakım

Yeni referans analizi veya entegrasyon kararı → **yalnız `REFERANS-ANALIZ.md` güncelle**
(§ Bakım kuralı + değişiklik günlüğü). Paralel `.md` oluşturma veya stub genişletme yasak.

## Kritik kurallar

- **Lisanssız depo → kod portu yok** (§1a; `scite-zotero-plugin` dahil)
- Yeni klon ekleme: atıf/RAG kategorileri doymuş (§8)
- `zotero-citation-network` silindi — malware; geri klonlama
- Her vendor dosyasında attribution + provenance satırı

## Etiket

`# @ajan: claude · @etiket: …` — LibRart kaynak repo'su ana Kutuphane git'ine dahil değil;
yine de dosya başı etiket kullan.
