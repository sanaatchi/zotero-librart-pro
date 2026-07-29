<!-- @ajan: cursor · @etiket: katman-3, eksik-raporu, startup-isolation -->

# Cursor için Katman 3 eksik analizi

> **Çalışma kuralı:** Her yeni Katman 3 düzenlemesinde  
> **1)** bu raporu oku → **2)** açık maddeleri düzelt → **3)** ancak sonra özellik işi.  
> Rule: `.cursor/rules/katman-eksik-raporu.mdc` (üç katman ortak) · `kaynak/AGENTS.md`

## 2026-07-30 — Cursor düzeltmesi (startup izolasyonu)

| Madde | Durum | Not |
| ----- | ----- | --- |
| Startup action hata izolasyonu | ✅ | `programStartup` `.catch` + her zaman `onMainWindowLoad` |
| Typecheck | ✅ | `tsc --noEmit` |
| Gerçek Zotero checklist | 🟡 | Manuel |
| P2 pref/vektör/HTTP/eval/locale | ❌ | Önceki Codex listesi açık |

---

## Arşiv — Codex 2026-07-30 derin analiz

> **Çalışma kuralı:** Her yeni Katman 3 düzenlemesinde  
> **1)** bu raporu oku → **2)** açık maddeleri düzelt → **3)** ancak sonra özellik işi.  
> Rule: `.cursor/rules/katman-eksik-raporu.mdc` (üç katman ortak) · `kaynak/AGENTS.md`

## Üç-katman kapanış denetimi — 2026-07-30

**Karar:** `request changes` — F0–F9.2.3 ve public v1.0.46 mevcut, fakat
Katman 3 operasyonel/sertleştirme kapanışı tamam değil.

**Bağımsız doğrulama:** çalışma ağacı temiz, HEAD `f55a40b`. **94/94 test**,
TypeScript, ESLint, Prettier ve v1.0.46 XPI build ✅. Canlı CI HEAD
[`30476540188`](https://github.com/sanaatchi/zotero-librart-pro/actions/runs/30476540188)
başarılı. İndirilen public XPI **645.032 bayt**; SHA-512
`f4c1c9c4cc816dcd85dd3789395ca80c5b1fbfb8458a23b039b632f67ec6407e4f1e852fb3e1d78d406c59ab490d6d07fe14f1726f518d353d81af6b53753965`
ve public `update.json` eşleşiyor.

| Madde                         | Durum | Sonuç                                                         |
| ----------------------------- | ----- | ------------------------------------------------------------- |
| F0–F9.2.3 / test / build      | ✅    | 94 test ve statik kapılar yeşil                               |
| Public XPI / update SHA-512   | ✅    | v1.0.46 artefact bütünlüğü doğrulandı                          |
| Startup action hata izolasyonu| ❌ P1 | Action reject olursa main-window init çalışmayabilir           |
| Gerçek Zotero kabulü          | 🟡 P1 | Checklist sonuç/kanıt hücreleri boş                            |
| Canlı pref reconcile          | ❌ P2 | Feature aç/kapat restart gerektiriyor                          |
| Vektör delete/prune/recovery  | ❌ P2 | Runtime item-delete/invalidation zinciri yok                   |
| HTTP hedef politikası         | ❌ P2 | Semantic/Anki URL’leri loopback/redirect allowlist’siz         |
| Vendored `eval()`             | ❌ P2 | Çalıştırılabilir string vendor lint alanı dışında              |
| Locale eşitliği               | ❌ P2 | Build it-IT/zh-CN için 14 eksik ID uyarısı verdi               |
| Gerçek 10k / feature compose  | 🟡 P2 | Saf helper smoke var; Zotero runtime/bellek ölçümü yok         |

### P1 — startup action reddi pencere özelliklerini hâlâ engelliyor

`src/hooks.ts`, `dispatchActionByEvent(programStartup)` sonucuna `.then(() =>
onMainWindowLoad(window))` bağlıyor; zincir await edilmiyor ve rejection handler
yok. Bir kullanıcı startup action’ı hata verirse ana pencere fazı hiç initialize
edilmez ve unhandled rejection oluşur. Önceki rapordaki bu P1 maddesi kodda
duruyor.

**Cursor görevi:** action dispatch ve pencere init’ini ayır; init’i garantili
`finally`/bağımsız awaited blokta çalıştır, action hatasını logla. Reject eden
action ile gerçek registry/main-window testini ekle.

### P1 — manuel Zotero matrisi ve kaynak commit kaydı açık

`ZOTERO-KABUL-CHECKLIST.md` tamamen boş. İki pencere, reader teardown,
disable/enable, update ve bağlantı haritası gerçek Zotero’da kanıtlanmadı.
Checklist `Kaynak commit: 8301819` diyor; public release workflow’u ise kod
commit’i `c85b705` üzerinde çalıştı. Dokümantasyon commitini release kaynağı
gibi göstermek provenance’ı belirsizleştiriyor.

**Cursor görevi:** checklist’i gerçek sonuç/log/ekran kanıtıyla doldur; release
source commitini `c85b705...` olarak ayır, docs/HEAD commitini ayrı yaz. Gelecek
release’e Katman 2’deki gibi `provenance.json` ekle.

### Açık P2 güvenlik ve yaşam döngüsü borcu

- Pref penceresi yalnız UI bind ediyor; feature registry için off→on→off
  reconcile/observer yok.
- `removeJsonVectorRow()` helper’ı runtime item-delete notifier’ına bağlı değil;
  model/schema değişiminde stale vektörler kalıyor, corrupt store recovery
  sözleşmesi yok.
- Semantic ve Anki hedefleri kullanıcı pref’inden HTTP’ye gidiyor; loopback
  allowlist, userinfo/fragment reddi ve redirect hedef doğrulaması yok.
- `src/vendor/zotero-reference/views.ts` dinamik `eval()` çalıştırıyor ve
  `src/vendor/zotero-reference/**` tamamen ESLint ignore alanında.
- Build, it-IT/zh-CN için `local-book-db*`, OpenAlex, Crossref,
  OpenCitations ve Citegeist dahil 14 eksik Fluent ID uyarısı verdi.

### Katman 3 zorunlu kapanış sırası

1. Startup action hata izolasyonu.
2. Gerçek Zotero checklist + doğru source provenance.
3. Pref reconcile ve vektör delete/prune/recovery.
4. HTTP loopback/redirect politikası ve vendored `eval` kaldırma.
5. Locale eşitliği + gerçek Zotero 10k/feature-composition kabulü.

---

## Derin yeniden analiz — 2026-07-29

**İncelenen taban:** `c85b705` + kullanıcı/Cursor `AGENTS.md` değişikliği,
LibRart Pro `1.0.46`.

**Bağımsız doğrulama:** 23 test dosyası, **94/94 test** ✅ · Prettier ✅ ·
ESLint ✅ · TypeScript ✅. XPI build bu turda `npm` çalıştırıcısı ortamda
bulunmadığı için yeniden koşturulamadı; son doğrulanmış build `c85b705`
kaydında yeşil.

### Güncel öncelik matrisi (2026-07-29 P1 release sonrası)

| Öncelik | Açık                                           | Sonuç                                   |
| ------- | ---------------------------------------------- | --------------------------------------- |
| P1      | Public `v1.0.46` + update kanalı               | ✅ yayında                              |
| P1      | Manuel Zotero kabul checklist doldurma         | 🟡 şablon hazır                         |
| P2      | Canlı feature-pref reconcile yok               | Ayar değişikliği restart ister          |
| P2      | Vektör silme/prune yaşam döngüsüne bağlı değil | İndeks sınırsız bayatlar/büyür          |
| P2      | Vendored `eval()` ve geniş lint ignore alanı   | Çalıştırılabilir içerik denetimsiz      |
| P2      | Yapılandırılabilir HTTP hedefleri kısıtsız     | SSRF/yanlış host riski                  |
| P2      | Locale eşitliği yok                            | it-IT/zh-CN işlev metinleri eksik       |
| P2      | CI/repo metadata upstream kalıntılı            | Yanlış sahiplik ve zayıf release kapısı |
| P3      | Gerçek 10k ölçek smoke                         | helper smoke var; gerçek yok            |

> Ayrıntılı durum tablosu: [§ Güncel durum — P1 release](#güncel-durum--2026-07-29-p1-release)

### P1 — Public `1.0.46` release — KAPANDI ✅

**2026-07-29:** `npm run gh-release` →
[releases/v1.0.46](https://github.com/sanaatchi/zotero-librart-pro-releases/releases/tag/v1.0.46);
canlı update kanalı `1.0.46`. Manuel Zotero içi update kabulü için
[`ZOTERO-KABUL-CHECKLIST.md`](ZOTERO-KABUL-CHECKLIST.md) senaryo #9.

### P1 — Release otomasyonu geri alınamaz ve iki ayrı modele bölünmüş

`.github/workflows/release.yml`, `npm install -f` + yalnız build +
`npm run release` çalıştırıyor; test/lint yok ve `GitHub_TOKEN`/`GITHUB_TOKEN`
adları tutarsız. Yerel `scripts/publish.mjs` ise mevcut public release’i ve
`update` tag’ini silip yeniden yaratıyor, kaynak tag’ini `git tag -f` ve
`git push -f` ile değiştiriyor. Bekleme kodu PowerShell’e bağlı; release notu
yalnız çift tırnak kaçırılarak shell komutuna ekleniyor. Shell metakarakterleri
komut enjeksiyonu veya yanlış yayın üretebilir.

**Cursor görevi**

- Tek yayın hattı seç; temiz çalışma ağacı + exact commit + test/lint/build
  kapısı kullan.
- Release/tag silme ve force-push yerine immutable version tag/asset kullan.
- `execFile`/arg array ile shell birleştirmesini kaldır; platform-bağımsız
  bekleme kullan.
- Public indirme sonrası XPI hash/addonID/version kontrolünü zorunlu yap.
- Workflow action’larını commit SHA’ya sabitle ve `npm ci` kullan.

### P1 — Program-startup action reddi pencere özelliklerini başlatmayabilir

`src/hooks.ts:62-69`, `dispatchActionByEvent(...).then(...)` zincirini
`await` etmiyor ve `.catch` eklemiyor. Kullanıcı action’larından biri reject
ederse unhandled rejection oluşur ve zincirdeki `onMainWindowLoad(window)`
çalışmaz. Startup tamamlanmış görünürken main-window özellikleri eksik kalabilir.

**Cursor görevi:** pencere init’ini kullanıcı script başarısından ayır;
dispatch hatasını yakala/logla, `finally` veya bağımsız awaited init kullan.
Reject eden program-startup action entegrasyon testi ekle.

### P2 — Feature flag’ler canlı reconcile edilmiyor

`FeatureRegistry.isEnabled()` yalnız faz init edilirken pref okuyor.
`onPrefsEvent` yalnız preference penceresini yüklüyor; pref observer veya
`reconcileFeature(id)` yok. Özellik kapatıldığında observer/kolon/kaynak
shutdown edilmez, açıldığında restart olmadan init edilmez.

**Kabul:** her feature için off→on→off testinde init/shutdown birer kez; iki
pencerede window-scope teardown doğru; shutdown sonrası pref observer kalmaz.

### P2 — Vektör delete/prune ve bozuk-dosya kurtarması eksik

Atomik temp→move ve RMW kuyruğu mevcut. Ancak
`jsonVectorStore.removeJsonVectorRow()` runtime mutation API’sine bağlı değil;
Zotero öğesi silindiğinde veya model/content sözleşmesi değiştiğinde eski satır
kalıyor. Store yükleme hatasının kurtarma/karantina ve şema migrasyonu kabulü
de görünür değil.

**Cursor görevi:** serialized `remove/prune/rebuild`; item-delete notifier;
model/schema/version invalidation; bozuk store’u `.corrupt-*` olarak koruyan
kurtarma ve disk-dolu/move-failure testleri.

### P2 — Dış servis URL’leri yerel sınırı aşabiliyor

Semantic URL kullanıcı tercihi olarak doğrudan `Zotero.HTTP.request` hedefi
oluyor. Anki host’u da şema/host/port sınırı olmadan endpoint’e ekleniyor.
Opt-in olmak riski azaltır fakat yanlış ayar veya içe aktarılan pref, eklentiyi
özel ağ/metadata servislerine istek atan bir SSRF aracına çevirebilir.

**Cursor görevi:** varsayılan olarak yalnız loopback (`127.0.0.1`,
`localhost`, `[::1]`) ve beklenen portlar; uzak host için açık risk onayı;
yalnız `http/https`, kullanıcı bilgisi/fragment reddi; redirect sonrası hedef
doğrulaması ve URL test matrisi.

### P2 — Locale ve repository kimliği hâlâ upstream kalıntılı

Locale anahtar sayıları: en-US/tr-TR `286 + 66`; it-IT `121 + 56`; zh-CN
`122 + 56`. `.github/FUNDING.yml`, issue/discussion şablonları ve stale
workflow’u hâlâ upstream `windingwind`/Actions & Tags ürününü tanıtıyor.
Kullanıcıları yanlış finansman, tartışma ve destek kanalına yönlendirir.

**Cursor görevi:** locale eşitlik testini CI’a ekle; fallback kullanılan
anahtarları belgeli istisna yap. Upstream repository metadata’sını LibRart
kimliğiyle değiştir veya gereksiz dosyaları ayrı açık onayla kaldır.

### P2 — Vendored çalıştırılabilir kod denetimi zayıf

`src/vendor/zotero-reference/**` tümüyle ESLint dışında ve
`views.ts:528` dinamik `eval()` içeriyor. Güvenli import doğrulaması bu başka
çalıştırma yolunu kapsamıyor.

**Cursor görevi:** `eval` yolunu AST/izinli operation dispatcher ile değiştir;
vendor için ayrı dar lint/semgrep kapısı ve çalıştırılabilir payload negatif
testleri ekle.

### Cursor için güncel uygulama sırası

1. ~~Public `1.0.46` yayın + update kanalı~~ ✅
2. Manuel Zotero kabul checklist doldur (`ZOTERO-KABUL-CHECKLIST.md`)
3. Pref reconcile ve vektör remove/prune/kurtarma (P2)
4. Loopback URL politikası ve vendored `eval` kaldırma (P2)
5. Locale/repository metadata temizliği (P2)
6. Gerçekçi 10k + feature-composition testleri (P2/P3)

## Güncel durum — 2026-07-29 (P1 release)

**Baseline:** `c85b705` + public **v1.0.46** · **Doğrulama:** 94 test · lint ✅ · update kanalı 1.0.46

| Madde                                 | Durum | Not                                                                                                                     |
| ------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------- |
| Reading flow observer sızıntısı       | ✅    | `startup` + idempotans                                                                                                  |
| Vektör farklı-item RMW                | ✅    | `vectorStoreMutate` + test                                                                                              |
| Aynı-item stale embedding             | ✅    | generation token                                                                                                        |
| Kök `update.json` tracked             | ✅    | untrack + gitignore                                                                                                     |
| Prettier / lint kapısı                | ✅    |                                                                                                                         |
| Public release v1.0.46                | ✅    | [releases/v1.0.46](https://github.com/sanaatchi/zotero-librart-pro-releases/releases/tag/v1.0.46) · update kanalı canlı |
| Manuel Zotero kabul matrisi           | 🟡    | Şablon: [`ZOTERO-KABUL-CHECKLIST.md`](ZOTERO-KABUL-CHECKLIST.md) — doldurulması gerekir                                 |
| Pref reconcile                        | ❌ P2 |                                                                                                                         |
| Vektör delete/prune                   | ❌ P2 |                                                                                                                         |
| Vendored `eval`                       | ❌ P2 |                                                                                                                         |
| 10k gerçek ölçek                      | ❌ P2 | helper smoke var                                                                                                        |
| Feature-composition (observer sayımı) | 🟡    | registry testi var                                                                                                      |
| it-IT / zh-CN locale                  | 🟡    | build uyarısı                                                                                                           |

**Sıradaki:** Zotero’da checklist doldur (özellikle #2 ikinci pencere + #9 update). Sonra P2.

---

## Önceki yeniden analiz (arşiv notu)

Aşağıdaki bölüm Codex/Claude’un `6ac1c46` + WIP incelemesidir; üst matris günceldir.

<details>
<summary>Eski detay (genişlet)</summary>

**İncelenen durum:** `6ac1c46` + Cursor’un commit edilmemiş stabilizasyon
değişiklikleri

**Paket:** LibRart Pro `1.0.46`
**Karar:** İki kritik kod açığı düzeltilmiş durumda; fakat mevcut çalışma henüz temiz
baseline değil. Release kanalı, gerçek Zotero kabulü ve aşağıdaki açık maddeler
tamamlanmadan “yayına hazır” denmemeli.

### Durum matrisi

| Önceki madde                                  | Güncel durum       | Kanıt                                                              |
| --------------------------------------------- | ------------------ | ------------------------------------------------------------------ |
| Reading flow çoklu pencere observer sızıntısı | ✅ Kodda kapatıldı | `reading.flow` startup fazına taşındı; idempotans koruması eklendi |
| Vektör farklı-item RMW yarışı                 | ✅ Kodda kapatıldı | `vectorStoreMutate.ts`; paralel iki satır testi                    |
| Update manifest/release çelişkisi             | 🟡 Kısmi           | Belgeler düzeldi; tracked kök manifestler ve public v1.0.32 açık   |
| 10k ölçek iddiası                             | ❌ Açık            | Test hâlâ sentetik 8 boyutlu bellek testi                          |
| Canlı feature flag yaşam döngüsü              | ❌ Açık            | Pref observer/reconcile yok                                        |
| Vektör delete/modify/prune                    | ❌ Açık            | `removeJsonVectorRow()` runtime’a bağlı değil                      |
| Vendored `eval()`                             | ❌ Açık            | `views.ts:528`                                                     |
| Feature composition testi                     | 🟡 Kısmi           | Registry testi genişledi; gerçek observer/sütun sayımı yok         |
| Gerçek Zotero kabul matrisi                   | ❌ Açık            | Manuel kayıt yok                                                   |

### Bağımsız kalite doğrulaması

Cursor’un mevcut commit edilmemiş değişiklikleri üzerinde:

| Kapı          | Sonuç                                                             |
| ------------- | ----------------------------------------------------------------- |
| Vitest        | ✅ 23 dosya, **93/93 test**                                       |
| ESLint        | ✅                                                                |
| TypeScript    | ✅                                                                |
| XPI build     | ✅                                                                |
| Prettier      | ❌ 5 dosya                                                        |
| Çalışma ağacı | ⚠️ 10 değiştirilmiş + 2 yeni dosya                                |
| Yerel dal     | ⚠️ `origin/main` önünde 1 commit + commit edilmemiş değişiklikler |

Prettier’ın işaretlediği dosyalar:

- `CURSOR-KATMAN-3-EKSIKLER-RAPORU.md`
- `KATMAN-3-PLAN.md`
- `LIBRART-GIRIS.md`
- `OTOMATIK-GUNCELLEME.md`
- `test/featureRegistry.test.ts`

### Kapatılan 1 — reading flow süreç/pencere kapsamı

Cursor’un düzeltmesi doğru yönde:

- `src/core/features.ts`: `reading.flow`, `mainWindow` yerine `startup`.
- `src/modules/readingFlowBridge.ts`: `initialized` koruması.
- İkinci init yeni tracker/observer ve sütun oluşturmuyor.
- Shutdown global tracker, sütun ve store’u tek kez kapatıyor.
- Startup feature’ın tekrar başlamadığını doğrulayan test eklendi.

**Kapanış kanıtı için kalan:** Feature-composition testinde
`Zotero.Notifier.registerObserver` ve `ItemTreeManager.registerColumn` çağrı sayılarını
ölç; ardından gerçek Zotero ikinci pencere testini yap.

### Kapatılan 2 — farklı öğelerin paralel vektör RMW yarışı

Yeni `src/vendor/zotseek/vectorStoreMutate.ts`, `current store → upsert → persist →
memory publish` bölümünün tamamını tek kuyrukta çalıştırıyor.
`test/vectorStoreRmw.test.ts`, iki farklı item paralel commit edildiğinde iki satırın
da kaldığını doğruluyor.

### P1 — mevcut düzeltme paketi henüz kalite kapısından geçmiyor

Test, ESLint, TypeScript ve build yeşil; fakat Prettier beş dosyada başarısız. CI
`lint:check` aşamasında kalır.

**Cursor görevi**

1. Beş dosyayı Prettier ile düzelt.
2. `npm test && npm run lint:check && npm run build`.
3. `git diff --check`.
4. Dosya etiketleri ve `Changes.md` kaydını tamamla.
5. Temiz commit/push sonrası bu rapordaki baseline SHA’yı güncelle.

### P1 — release kanalı hâlâ v1.0.32

2026-07-29 canlı GitHub API doğrulaması:

```text
v1.0.32 → update.json + zotero-librart-pro.xpi
update  → yalnız update.json
```

Yerel paket `1.0.46`; çekirdek public kanala henüz yayınlanmış değil.

`.gitignore` içine `/update.json` ve `/update-beta.json` eklemek de Git’in zaten
izlediği iki eski v1.0.32 dosyasını kendiliğinden bırakmaz: `git ls-files` ikisini
hâlâ gösteriyor.

**Cursor görevi**

- Kök manifestler build artığıysa Git indeksinden kontrollü biçimde çıkar; kullanıcı
  çalışma kopyasını silme.
- Public `v1.0.46` XPI ve kalıcı `update` manifestini yayınla.
- `releases/latest` “update” release’ine çözülüyorsa indirme dokümanını sabit sürüm
  veya uygun endpoint’e yönlendir.
- Zotero içinden önceki sürüm → v1.0.46 güncellemesini doğrula.

### P1 — gerçek Zotero kabul testi yok

Zorunlu manuel matris:

| Senaryo                | Beklenen                                                    |
| ---------------------- | ----------------------------------------------------------- |
| İkinci ana pencere     | Global observer/sütun tek; pencere menüsü iki pencerede var |
| Bir pencereyi kapatma  | Diğer pencere çalışmaya devam eder                          |
| Reader aç/kapat        | Tracker/timeout sızıntısı yok                               |
| Eklenti disable/enable | Menü, observer ve sütunlar temiz kapanıp tekrar açılır      |
| Pref aç/kapa           | Belgelenen davranışla uyumlu                                |
| TR/EN locale           | Eksik anahtar veya ham Fluent ID yok                        |
| Update denetimi        | v1.0.46 XPI + SHA-512 kabul edilir                          |

Sonuçları tarih, Zotero sürümü, Windows sürümü ve log/ekran kanıtıyla kaydet.

### P2 — aynı item stale embedding yarışı

Yeni mutator “kuyruğa en son giren kazanır” politikasını test ediyor; embedding ise
kuyruk dışında hesaplanıyor. Eski içerik için yavaş embedding, yeni içerik için hızlı
embedding’den sonra tamamlanırsa eski hash en son commit edilip yeni sonucu ezebilir.

**Cursor görevi**

- Commit anında güncel content hash’i tekrar doğrula veya item başına generation kullan.
- “Yeni içerik önce tamamlandı, eski embedding sonra geldi” testi ekle.

### P2 — feature flag yaşam döngüsü

Registry pref’i yalnız init sırasında değerlendiriyor. Örneğin `reading.enabled`
sonradan kapatılırsa tracker ve sütunlar yaşamaya devam ediyor.

**Cursor görevi:** UI’da “yeniden başlatma gerekir” sözleşmesi göster veya pref
observer ile `enable/disable/reconcile` uygula. Reading kapatma/açma testi ekle.

### P2 — vektör delete/modify/prune

`removeJsonVectorRow()` runtime’a bağlı değil. Silinen/trash öğeler store’da kalıyor;
başlık/özet değişikliği otomatik stale olmuyor; açılışta orphan prune yok.

**Cursor görevi:** Item notifier ile delete/trash/modify politikası ve batch prune ekle.

### P2 — vendored `eval()`

`src/vendor/zotero-reference/views.ts:528`, PDF destination değerini string
interpolation ile iframe `eval()` çağrısına veriyor.

**Cursor görevi:** Doğrudan
`PDFViewerApplication.pdfViewer.linkService.goToDestination(destination)` çağrısına
geç; yerel vendor patch/provenance kaydı ve edge-case testi ekle.

### P2 — 10k smoke gerçek ürün ölçeği değil

Test yalnız 8 boyutlu sentetik vektörleri bellekte ölçüyor. Gerçek modeller 384/768
boyutlu; disk I/O, Zotero `Items.getAll()`, UI event loop, iptal ve ilerleme yok.

**Cursor görevi**

- Test adını “10k vector-helper smoke” olarak daralt.
- 384/768 boyut ve gerçekçi JSON/disk testi ekle.
- Tam-kütüphane yollarına kapsam limiti, yield/progress ve performans bütçesi koy.

### P2 — it-IT ve zh-CN locale kapsamı eksik

EN anahtarlarıyla karşılaştırma:

| Locale | `addon.ftl` eksik | `preferences.ftl` eksik |
| ------ | ----------------: | ----------------------: |
| tr-TR  |                 0 |                       0 |
| it-IT  |               165 |                      10 |
| zh-CN  |               164 |                      10 |

Ya ürün kapsamını EN/TR ile sınırla ve kısmi locale’leri paketleme ya da anahtarları
tamamlayıp CI’a locale parity testi ekle.

### P3 — feature-composition testi

Registry testi genişledi ama gerçek `registerLibRartFeatures()` bileşimini çalıştırıp
observer/sütun/menü sayılarını ölçmüyor.

İki pencere senaryosunda global observer/sütun = 1, pencere menüsü = pencere başına 1,
shutdown sonrası kaynak = 0 beklentilerini doğrula.

### P3 — tip borcu

Vendor dışındaki `@ts-ignore TODO` noktaları:

- `src/modules/menu.ts`
- `src/modules/preferenceWindow.ts`
- `src/utils/items.ts`

Zotero 7–10 farklarını gizlememesi için dar type guard/adapter ile kapatılması önerilir.

### Güncel Cursor uygulama sırası

1. Prettier + temiz kalite zinciri + commit/push.
2. Aynı-item stale embedding yarışını kapat.
3. Public v1.0.46 release ve Zotero update doğrulaması.
4. Gerçek Zotero çoklu pencere/shutdown kabul testi.
5. Feature flag yaşam döngüsü.
6. Vektör delete/modify/prune.
7. Vendored `eval` kaldırma.
8. Gerçekçi ölçek testi ve `Items.getAll()` bütçeleri.
9. Locale kapsam kararı/parity testi.
10. Feature-composition testi ve tip borcu.

### Güncel tamamlanma kapısı

```text
npm test
npm run lint:check
npm run build
git diff --check
temiz ve origin ile senkron Git baseline
aynı-item stale embedding regresyon testi
iki pencere feature-composition testi
gerçek Zotero manuel kabul checklist'i
public v1.0.46 XPI + update URL + SHA-512 uçtan uca doğrulaması
```

---

## Önceki analiz — `2840f74`

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

</details>

## Tamamlanma kapısı

```text
npm test && npm run lint:check && npm run build   ✅ (94 test)
paralel vektör mutation + stale-generation testi  ✅
kök update.json untrack                            ✅
public v1.0.46 gh-release + update kanalı          ✅
manuel Zotero kabul checklist şablonu              ✅ (doldurma açık)
P2: pref reconcile, prune, eval, ölçek             ❌
```
