<!-- @ajan: codex · @etiket: librart-pro, tarihsel-brief, lisans-uyarisi -->
# Cursor Görevi: Referans Pluginlerin Orijinal Kodlarını Doğrudan Entegre Et

> **TARİHSEL / UYGULANMAYACAK BRİF:** Bu görev metninin lisanslı AGPL/MIT
> kaynaklara ilişkin bölümleri geçmiş bağlamdır. Lisanssız
> `Zotero-Citation-Graph`, `citation_map` ve benzeri kaynakları port etmeyi
> söyleyen maddeler geçersizdir. Kullanıcı onayı telif izni değildir. Güncel
> kararlar için [`REFERANS-ANALIZ.md`](REFERANS-ANALIZ.md) ve
> `VENDOR-SOURCES.md` kullanılır.

## Arka plan

Şu ana kadar Bağlantı Haritası ve destek modülleri, 6 referans plugin'in
(zotero-style, zotero-reference, Zotero-Citation-Graph, inciteful-zotero-plugin,
ZotSeek, zotero-better-notes) **fikirlerinden ilham alınarak sıfırdan yeniden
yazıldı** (Claude tarafından, lisans konusunda gereksiz temkinli davranarak).
Kullanıcı bunun gereksiz olduğunu belirtti: referans pluginlerin 4 tanesi bizim
projemizle (AGPL-3.0-or-later) **doğrudan kod paylaşımına uygun lisanslara**
sahip. Görev: mümkün olan yerlerde sıfırdan yazılmış mantığı, bu pluginlerin
**gerçek kaynak kodunu doğrudan port ederek/uyarlayarak** değiştirmek.

Kullanıcının talebi (birebir): *"evet yeniden yapılandır orjinal kodlamaları
kulan"* (evet, yeniden yapılandır, orijinal kodlamaları kullan).

## Proje kimliği (referans için)

- Repo (kaynak): `sanaatchi/zotero-librart-pro` — bu makinede
  `C:\Users\ibrah\Projeler\Kutuphane\zotero-eklentiler\kaynak`
  (kendi bağımsız git geçmişi var; Kütüphane projesinin repo'suna dahil
  değil — Kütüphane'nin `.gitignore`'unda `zotero-eklentiler/` olarak
  hariç tutuldu, sadece fiziksel olarak aynı üst klasörde duruyor.)
- Repo (release): `sanaatchi/zotero-librart-pro-releases`
- Görünen ad: **LibRart Pro** · `addonID`: `librartpro@euclpts.com`, `addonRef`: `librartpro`
- Lisans: **AGPL-3.0-or-later** (`package.json` satır 29) — bu, aşağıdaki dört
  pluginin kodunu doğrudan kullanmamıza izin veriyor (AGPL→AGPL ve MIT→AGPL
  ikisi de serbest; tek şart: birleşik eser AGPL kalmalı, ki zaten öyle).
- Referans pluginler: `C:\Users\ibrah\Projeler\Kutuphane\zotero-eklentiler\referanslar\`
  altında — `zotero-style-6.0.8/`, `zotero-reference-1.7.2/`,
  `zotero-better-notes-3.2.6/`, `ZotSeek-1.18.0/`, `Zotero-Citation-Graph-main/`,
  `inciteful-zotero-plugin-0.2.2/` (yani `kaynak/`'ın bir üst dizinindeki
  `referanslar/` klasörü — `../referanslar/<plugin-adı>`).

## Lisans durumu (doğrulandı, LICENSE dosyaları okunarak)

| Plugin | Lisans | Durum |
|---|---|---|
| zotero-style | AGPL-3.0 | ✅ Doğrudan kod kullanılabilir |
| zotero-reference | AGPL-3.0 | ✅ Doğrudan kod kullanılabilir |
| zotero-better-notes | AGPL-3.0 | ✅ Doğrudan kod kullanılabilir |
| ZotSeek | MIT | ✅ Doğrudan kod kullanılabilir |
| Zotero-Citation-Graph | repoda LICENSE yok | ❌ Kod/vendor/port yasak; yalnız davranış incelemesi ve temiz oda uygulama |
| inciteful-zotero-plugin | AGPL-3.0-or-later | ✅ **Kullanılacak** — menü + `openIncitefulSearch` / `openIncitefulConnector` port edilecek (harici `inciteful.xyz` API; kullanıcı bilinçli tercih) |

**Kural:** Kod kopyalarken/uyarlarken dosya başına orijinal telif/lisans
notunu koru (AGPL/MIT gereği). Yeni dosyalarda üstte kısa bir yorum satırıyla
kaynağı belirt, örn: `// Adapted from zotero-style (AGPL-3.0) src/modules/tags.ts`

## Yapılması gerekenler (modül modül)

### 1. zotero-style (AGPL-3.0) — `zotero-style-6.0.8/src/modules/`

Bizim tarafımızda karşılığı olan, sıfırdan yazılmış modüller:

- **`tags.ts`** → bizim `src/utils/connectionGraph.ts` ve tag-tabanlı
  bağlantı katmanının mantığı burada baz alınmalı. zotero-style'ın
  Nested Tags / tag graph yaklaşımı doğrudan uyarlanabilir.
- **Rating/puanlama** → biz `Extra` alanına yazan kendi rating sistemimizi
  kurduk; zotero-style'da benzer bir "column" tabanlı görsel gösterim varsa
  (bkz. `views.ts`), `ItemTreeManager.registerColumn` kullanımını referans al.
- **`events.ts`, `progress.ts`** → okuma ilerlemesi / etkinlik izleme deseni
  varsa ve bizim `connectionNotify.ts` ile örtüşüyorsa, event-listener
  kurulum/temizleme (register/unregister) desenini birebir bu dosyadan al —
  bizim `registerConnectionMapNoteObserver`/`unregisterConnectionMapNoteObserver`
  fonksiyonlarını bu orijinal desenle karşılaştır, gerekirse değiştir.
- **`easyscholar.ts`** → dış API entegrasyon deseni (rate limiting, hata
  yönetimi, cache) varsa, bizim `doiResolver.ts`'teki Crossref/S2/arXiv
  çağrılarına aynı desen uygulanabilir mi kontrol et.

### 2. zotero-reference (AGPL-3.0) — `zotero-reference-1.7.2/src/modules/`

- **`pdf.ts`** → PDF'ten referans/kaynakça çıkarma. Bizde bu **hiç yok** —
  yeni bir özellik olarak doğrudan bu dosyadan port edilebilir
  (`src/modules/` altına yeni bir dosya, örn. `referenceExtractor.ts`).
- **`utils.ts`** → referans parse/normalize yardımcıları — bizim
  `doiResolver.ts`'te DOI/başlık normalize eden yerlerle karşılaştır,
  varsa daha sağlam olan bu koddan alınmalı.
- **`api.ts`** → dış servis (Crossref vb.) sorgu mantığı — bizim
  `doiResolver.ts`'i **bu dosyayla birebir karşılaştır**; biz bunu sıfırdan
  yazdık, muhtemelen üst üste geliyor. Cursor, `api.ts`'in gerçek istek
  formatlarını/endpoint'lerini/hata toleransını port ederek
  `doiResolver.ts`'i güçlendirmeli ya da doğrudan değiştirmeli.
- **`tip.ts`, `views.ts`** → PDF okuyucu içinde beliren "floating reference
  popup" UI'ı — bizde şu an böyle bir in-reader popup yok; Bağlantı
  Haritası'nın PDF-içi entegrasyonu için bu iki dosya doğrudan port
  edilebilir.
- **`connectedpapers.ts`** → çift yönlü ilişki (bidirectional relation)
  kurma deseni — bizim `connectionCitationLayer.ts`'teki atıf-önerisi
  mantığıyla karşılaştır, bu orijinal implementasyon referans alınarak
  güçlendirilebilir.

### 3. zotero-better-notes (AGPL-3.0) — `zotero-better-notes-3.2.6/src/`

Bu, önceki yol haritasında v3-v5'e ertelenmiş, **henüz hiç inşa edilmemiş**
bir alan. Cursor doğrudan bu kaynaktan başlayabilir (sıfırdan yazma değil,
port etme):

- **`editor/*`** → not editörü genişletmeleri
- **`template/*`** → not şablonları (bizim projede template sistemi yok —
  doğrudan buradan başlanabilir)
- **`export/*`** → dışa aktarma akışı
- **`sync/*`** → senkronizasyon deseni
- **`workspace/*`** → not workspace/outline paneli

Öncelik kullanıcıya sorulmadan Cursor'ın takdirinde; ama not-tabanlı
Bağlantı Haritası entegrasyonu (`src/utils/connectionNoteLayer.ts`) zaten
var olduğundan, önce **not editörü + outline** kısmının port edilmesi en
çok senerji yaratır.

### 4. ZotSeek (MIT) — `ZotSeek-1.18.0/src/worker/embedding-worker.ts`

Şu an ZotSeek'i **ayrı bir plugin olarak bağımlılık** haline getirdik
(`connectionSemanticLayer.ts` içinde `isZotSeekReady()` ile kontrol
ediyoruz) ve paralelde kendi Kutuphane köprümüzü kurduk
(`src/utils/kutuphaneSemanticBridge.ts`). MIT lisansı sayesinde artık:

- ZotSeek'in **embedding-worker.ts** ve ilişkili vector-store kodunu
  doğrudan bizim plugine **vendor edip** (kopyalayıp), kullanıcının ayrı
  bir ZotSeek pluginine ihtiyaç duymadan yerel embedding üretebilmesi
  sağlanabilir. Bu, "yüklü olması gereken plugin sayısını azaltma" isteğiyle
  de örtüşüyor (kullanıcı daha önce "pluginleri yeniden isimlendirmek /
  karışıklık olmasın" demişti — bunun bir çözümü de bağımlılık sayısını
  azaltmak).
  - **Dikkat:** ZotSeek'in WASM tabanlı `nomic-embed-text-v1.5` modeli
    CPU-only ve İngilizce ağırlıklı. Kutuphane köprüsü (Ollama +
    `qwen3-embedding:8b`, Türkçe dahil çok dilli) zaten daha güçlü bir
    alternatif olarak entegre edildi ve öncelikli deneniyor
    (`connectionSemanticLayer.ts`). ZotSeek vendoring'i tamamen isteğe
    bağlı bir "bağımsız çalışma" iyileştirmesi — mevcut Kutuphane entegrasyonunu
    bozmadan, sadece ZotSeek'e olan **dış plugin bağımlılığını** ortadan
    kaldırmak için yapılabilir.

### 5. Zotero-Citation-Graph — `Zotero-Citation-Graph-main/Zotero-Citation-Graph-main/src/`

**Güncel karar (2026-07-29):** Upstream lisansı bulunmadığından orijinal kod
port edilmeyecek. Aşağıdaki eski görev maddeleri uygulanmaz; yalnız davranış
gereksinimi çıkarılabilir.

Kaynak: `plugin-core.js` (~1400 satır), `graph/graph.js`, `graph/graph.xhtml`,
`graph/graph.css`, `cache-entry.js`, cytoscape bağımlılığı.

- **Cache / kenar üretimi:** Zotero `cites`/`references`/`isCitedBy` relations;
  `Extra` ve child note'lardan DOI; ek metni + normalize başlık eşlemesi.
- **UI:** Ayrı cytoscape graf penceresi (`Tools → Open Citation Graph`, öğe menüsü
  "Show Graph"). LibRart Pro'da Bağlantı Haritası ile çakışmayı önlemek için
  ya aynı pencerede yeni katman olarak ya da menüden ayrı giriş olarak bağla.
- **Bizim kod:** `connectionCitationLayer.ts` şu an yalnızca zotero-reference
  Crossref DOI eşlemesi yapıyor — Citation-Graph'in çevrimdışı relation/DOI
  motoru vendor edildikten sonra bu katmanı güçlendirmeli veya değiştirmeli.
- **Lisans sınırı:** Attribution tek başına izin oluşturmaz. Upstream açık lisans
  yayımlamadıkça kod kopyalanmaz; lisanslı muadil veya temiz oda uygulama seçilir.

### 6. inciteful-zotero-plugin (AGPL-3.0) — `inciteful-zotero-plugin-0.2.2/src/`

**Durum:** Faz 1 tamamlandı — `src/vendor/inciteful/incitefulCore.ts` + `incitefulBridge.ts`.

### 7–12. Diğer atıf kaynakları

Tam liste, faz sırası ve vendor yolları: **`CITATION-GRAPH-ENTEGRASYON.md`**

Özet: ZoteroCitationMaps (MIT/OpenAlex), zotero-openalex (GPL), citation_map (PDF),
Local-Citation-Graph (referans), zotero-citegeist (snowball), OleksiyPenkov CLI (Kutuphane köprüsü).

## Yan görev (isteğe bağlı, aynı oturumda ele alınabilir)

`scripts/publish.mjs` içinde bilinen bir hata var: GitHub release akışı,
"update" tag'li release'i her seferinde **silip yeniden oluşturuyor**, bu da
onu oluşturulma tarihine göre "en yeni" release yapıyor ve GitHub'ın
`/releases/latest` yönlendirmesini bozuyor (xpi'siz "update" release'ine
düşüyor, 404 veriyor). Düzeltme yönü: "latest" resolution'ın versiyonlu
release'e (örn. `v1.0.30`) işaret etmesini sağlamak — ya "update" release'ini
silip-yeniden-oluşturmak yerine güncellemek, ya da GitHub Releases'te
"latest" işaretini doğru release'e taşımak.

## Doğrulama (her modül sonrası)

1. `npm run build` — TypeScript hatasız derlenmeli.
2. Değiştirilen her dosyanın üstünde kaynak-attribution yorumu olmalı
   (AGPL/MIT gereği).
3. Fonksiyonel davranış: Bağlantı Haritası'nı aç, ilgili katmanın
   (tag/not/anlamsal/atıf) hâlâ çalıştığını doğrula — port işlemi mevcut
   `computeSemanticSuggestions`/`buildConnectionGraph` gibi entegrasyon
   noktalarının imzasını bozmamalı.
4. Yeni özellik eklendiyse (PDF referans çıkarma, not şablonları vb.),
   `addon/` altında gerekli Fluent (.ftl) string'lerini ve
   `ztoolkit.Menu.register`/`PreferencePanes.register` bağlantılarını ekle.
5. Sürüm yükselt (`package.json` + `npm run gh-release` — kullanıcı
   "yayınla" dediğinde).

## Not

Bu belge sadece **plan/brief** niteliğindedir — Claude tarafından kod
değişikliği yapılmamıştır, kullanıcının açık talimatıyla ("cursor yapsın")
tüm implementasyon Cursor'a bırakılmıştır.
