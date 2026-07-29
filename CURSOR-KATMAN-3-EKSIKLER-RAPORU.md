<!-- @ajan: codex · @etiket: katman-3, code-review, cursor, eksik-analizi -->

# Cursor için Katman 3 eksik analizi

**İncelenen baseline:** `2840f74` — LibRart Pro `1.0.46`  
**Bağımsız doğrulama:** 90/90 test, Prettier, ESLint, TypeScript ve XPI build geçti.  
**Karar:** Özellik kapsamı tamam; aşağıdaki doğruluk ve release açıkları kapanmadan
“Zotero kabulü tamamlandı” veya “yayına hazır” denmemeli.

## P1 — yayın/çalışma öncesi düzelt

### 1. `reading.flow` pencere başına başlatılarak global observer sızdırıyor

**Kanıt**

- `src/core/features.ts:98-109`: `reading.flow`, `mainWindow` fazında.
- `src/modules/readingFlowBridge.ts:58-67`: her init yeni `ReadingTracker` oluşturup
  Zotero notifier observer kaydediyor ve global `tracker` değişkenini eziyor.
- `src/modules/readingFlowBridge.ts:70-75`: shutdown yalnız son tracker'ı unregister ediyor.
- `src/modules/readingFlowColumns.ts`: sütun anahtarları da süreç-geneli global dizi.

İkinci Zotero penceresi açıldığında ikinci tracker kaydedilir; ilk tracker referansı
kaybolur. Son shutdown ilk observer'ı kaldıramaz. Sütunlar da ikinci kez kaydedilmeye
çalışılır.

**İstenen düzeltme**

- `reading.flow` süreç-geneli kısmını `startup` fazına taşı.
- Pencereye özel sütun görünürlüğü gerekiyorsa onu ayrı bir `mainWindow` feature yap.
- `initReadingFlow()` için açık idempotans koruması ekle.
- İki pencere init → tek observer; iki pencere unload → observer yaşamaya devam eder;
  plugin shutdown → observer sıfır senaryolarını test et.

### 2. Vektör kuyruğu read-modify-write yarışını kapatmıyor

**Kanıt**

- `src/vendor/zotseek/vectorStoreRuntime.ts:117`: store kuyruk dışında okunuyor.
- `:127`: embedding beklenirken başka çağrı aynı eski store'u okuyabilir.
- `:128-137`: upsert kuyruk dışında hesaplanıyor; yalnız `saveStore()` içindeki fiziksel
  yazım sıraya alınıyor.

İki paralel indeksleme aynı eski snapshot'tan A ve B store'ları üretirse kuyruk bunları
sırayla yazar ama son yazım ilk eklenen satırı silebilir.

**İstenen düzeltme**

- Embedding hesaplamasını kuyruktan önce yap; fakat `load current → upsert → tmp write →
move → memoryStore publish` bölümünün tamamını aynı mutation kuyruğu içine al.
- İki paralel farklı item indeksleme sonucunda iki satırın da kaldığını test et.
- Aynı item için paralel çağrıda son içerik/hash politikasını açıkça belirle.

### 3. Release durumu ve izlenen update manifestleri çelişkili

**Kanıt**

- `package.json` ve build manifesti `1.0.46`.
- Git tarafından izlenen kök `update.json` ve `update-beta.json` hâlâ `1.0.32`.
- `OTOMATIK-GUNCELLEME.md:5-10`, yapılandırmanın `hash:false` olduğunu söylüyor; gerçek
  `zotero-plugin.config.ts` artık `hash:true`.
- `LIBRART-YAPILANDIRMA.md:192`, hâlâ `"update" tag — F0'da düzelt` diyor; yayın scripti
  bu akışı çoktan uyguluyor.

**İstenen düzeltme**

- Kök manifestlerin rolünü kesinleştir: yayın girdisiyse 1.0.46 ile üret; build artığıysa
  Git'ten çıkar ve `.gitignore` ekle.
- `OTOMATIK-GUNCELLEME.md` belgesini gerçek v1.0.46 akışıyla eşitle.
- Public release deposu, update URL, SHA-512 ve Zotero içi güncelleme gerçek ortamda
  doğrulanmadan release kapısını yeşil işaretleme.

## P2 — çekirdek sağlamlığı

### 4. “10k smoke” gerçek ürün ölçeğini temsil etmiyor

`test/scaleSmoke10k.test.ts` yalnız 8 boyutlu sentetik vektörleri bellekte upsert/list
ediyor ve cosine top-K çalıştırıyor. Şunları ölçmüyor:

- gerçek model boyutu ve JSON dosya büyüklüğü,
- `IOUtils` disk yazımı,
- Zotero `Items.getAll()` maliyeti,
- ana thread/UI gecikmesi,
- ilerleme ve iptal,
- 99.999 öğe sınırı.

**İstenen düzeltme**

- Testin adını/iddiasını “10k vector helper smoke” olarak daralt veya gerçek entegrasyon
  smoke'u ekle.
- En az gerçekçi embedding boyutuyla bellek/dosya boyutu ölç.
- `Items.getAll()` kullanan harita/not/okuma yollarına kapsam ve süre bütçesi ekle.

### 5. Feature flag değişiklikleri canlı yaşam döngüsüne bağlanmamış

Registry pref değerini yalnız init sırasında okuyor. Örneğin `reading.enabled` sonradan
kapatılırsa mevcut tracker ve sütunlar kapanmıyor; tekrar açıldığında kontrollü init
yok. Belgede “Pref aç/kapa” manuel kabul ölçütü olarak yazılı olsa da kodda pref
observer/reconcile katmanı bulunmuyor.

**İstenen düzeltme**

- Ya ayarların “yeniden başlatma gerekir” olduğunu UI'da açıkla,
- ya da pref observer ile `enable/disable/reconcile` yaşam döngüsü uygula.
- En az reading, inciteful, note workspace ve semantic feature flag'lerini kapsa.

### 6. Silinen/değişen Zotero öğeleri vektör indeksinden temizlenmiyor

`removeJsonVectorRow()` mevcut fakat runtime/notifier yoluna bağlı değil. Silinen öğeler
JSON store'da kalır; başlık/özet değişiklikleri de yalnız yeniden elle indekslenirse
güncellenir.

**İstenen düzeltme**

- Zotero item notifier üzerinden delete/trash/modify olaylarını işle.
- Silmede satırı kaldır; metadata değişiminde stale olarak işaretle veya yeniden indeksle.
- Store açılışında bulunmayan item satırları için kontrollü prune ekle.

### 7. Vendored reference reader içinde dinamik `eval` kaldı

`src/vendor/zotero-reference/views.ts:528-529`, PDF destination değerini string içine
yerleştirip iframe `eval()` çağırıyor. Bu hem CSP/uyumluluk hem de beklenmeyen destination
metni açısından gereksiz risk.

**İstenen düzeltme**

- `eval` yerine doğrudan
  `PDFViewerApplication.pdfViewer.linkService.goToDestination(destination)` çağrısı yap.
- Destination değerini string birleştirmeden geçir.
- Vendor istisnası lint dışında olsa bile güvenlik açısından yerel patch/provenance kaydı
  ekle.

## P3 — bakım ve kabul

### 8. Çoklu pencere testi registry seviyesinde; gerçek feature bileşimi test edilmiyor

Registry birim testleri geçiyor, fakat `registerLibRartFeatures()` ile iki pencere
açıldığında kaç observer/sütun/menü oluştuğunu doğrulayan entegrasyon testi yok. Birinci
bulgunun gözden kaçmasının nedeni bu.

**İstenen test**

1. Tüm feature tanımlarını kaydet.
2. `w1` ve `w2` için `mainWindow` init çalıştır.
3. Global observer ve sütunların tek; pencere menülerinin pencere başına bir olduğunu ölç.
4. `w1` unload sonrası `w2` çalışmaya devam etsin.
5. Shutdown sonrası observer, timeout, sütun ve pencere kaydı kalmasın.

### 9. Gerçek Zotero kabul matrisi hâlâ kaydedilmemiş

Yerel otomatik kapılar yeşil; ancak aşağıdaki sonuçlar `Changes.md` veya ayrı kabul
raporunda yok:

- Zotero 7/8/9/10 sürüm matrisi,
- ikinci pencere,
- pref aç/kapa,
- reader aç/kapat,
- eklenti disable/enable,
- güncelleme kanalı,
- locale ekran kontrolü.

Manuel test için tarih, Zotero sürümü, işletim sistemi, sonuç ve ekran/log kanıtı içeren
bir checklist kaydı oluştur.

## Cursor için önerilen uygulama sırası

1. `reading.flow` global/pencere yaşam döngüsü.
2. Vektör mutation yarış testi ve düzeltmesi.
3. Update manifesti + updater belgeleri + gerçek release doğrulaması.
4. Feature flag canlı reconcile kararı.
5. Vektör delete/modify notifier.
6. `eval` kaldırma.
7. Gerçekçi ölçek ve feature-composition testleri.
8. Zotero manuel kabul raporu.

## Claude doğrulama notu (2026-07-29)

Codex'in bu raporunu yazdığı sırada ben de bağımsız olarak katman-3 eksiklerini
arıyordum — çakışmayı görünce kendi bulgularımı buraya ekliyorum, rapor yeniden
yazılmadı.

**Spot-check ile doğrulandı:**
- Madde 1 (`reading.flow` sızıntısı) — `readingFlowBridge.ts:58-67` okundu, iddia
  doğru: `tracker` modül-seviyesi değişken, `initReadingFlow()` var olan referansı
  kontrolsüz eziyor.
- Madde 7 (`eval`) — `zotero-reference/views.ts` içinde `_window.secondViewIframeWindow
  .eval(...)` satırı doğrulandı, string interpolation ile `href` geçiyor.

**Madde 3'e (release/update manifest çelişkisi) ek kanıt — canlı GitHub durumu:**

```
gh api repos/sanaatchi/zotero-librart-pro-releases/releases
→ v1.0.32 (created 12:37:58, 2 asset)
→ update   (created 12:38:11, 1 asset: yalnız update.json)

gh api .../releases/latest → tag_name: "update", assets: [update.json]
```

Yani `package.json` **1.0.46**'da ama GitHub'daki gerçek release geçmişi hâlâ
yalnızca **v1.0.32**'de duruyor — v1.0.33'ten beri (bu oturumdaki F0-F9 çekirdek
işinin tamamı) **hiç yayınlanmamış**. `/releases/latest` şu an `.xpi` içermeyen
"update" release'ine çözülüyor — Codex'in "update tag" bug'ı teorik değil,
GitHub'da şu anda gerçekleşmiş durumda. Release script'i düzeltilip bir sonraki
`gh-release` çalıştırılana kadar bu böyle kalacak.

**Ek, küçük bulgular (Codex'in listesinde yok):**
- `src/adapters/` içinde yalnız `zoteroAdapter.ts` var — orijinal mimari notunda
  (`LIBRART-YAPILANDIRMA.md` §2, eski dosyalarda `HttpPort`/`PreferencePort`) planlanan
  ek portlar hiç yapılmadı. Şu an işlevi engellemiyor, ileride test edilebilirlik için.
- `it-IT`/`zh-CN` locale eksiklikleri bu oturumun başından beri değişmedi (build
  uyarısı olarak duruyor, engelleyici değil).
- 3 adet `// @ts-ignore TODO: update types` (menu.ts, preferenceWindow.ts, items.ts) —
  düşük öncelik, zotero-plugin-toolkit tip tanımları netleşince kapanır.

## Tamamlanma kapısı

```text
npm test
npm run lint:check
npm run build
iki pencere feature-composition testi
paralel vektör mutation testi
gerçek Zotero manuel kabul checklist'i
update URL + update_hash uçtan uca doğrulaması
```
