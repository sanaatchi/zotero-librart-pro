action = Eylemler

help = { $name } Sürüm { $version } { $time }

action-event-none = Yok
action-event-createItem = Öğe Oluştur
action-event-openFile = Sekme Aç
action-event-closeTab = Sekmeyi Kapat
action-event-createAnnotation = Dipnot Oluştur
action-event-createNote = Not Oluştur
action-event-appendAnnotation = Dipnot Eklendi
action-event-appendNote = Not Eklendi
action-event-programStartup = Program Başlangıcı
action-event-mainWindowLoad = Ana Pencere Açılışı
action-event-mainWindowUnload = Ana Pencere Kapanışı

action-operation-none = Yok
action-operation-add = Etiket Ekle
action-operation-remove = Etiket Kaldır
action-operation-toggle = Etiket Aç/Kapa
action-operation-script = Betik
action-operation-triggerAction = Başka Eylemi Tetikle

action-add =
    .tooltiptext = Yeni eylem ekle
action-remove =
    .tooltiptext = Seçili eylemi sil
action-edit =
    .tooltiptext = Seçili eylemi düzenle
action-duplicate =
    .tooltiptext = Seçili eylemi çoğalt
action-export =
    .tooltiptext = Seçili eylemleri dosyaya aktar
action-import =
    .tooltiptext = Dosyadan eylem içe aktar

menu = Menü

menu-sort =
    .value = Menü sıralaması
menu-sort-menuLabel =
    .label = Menü Etiketi
menu-sort-name =
    .label = Ad

show-popup =
    .label = Eylem sonrası bildirim göster

script-warning-ignore =
    .label = Betik kaydederken uyarı gösterme
action-delete-message-ignore =
    .label = Eylem silerken onay isteme

tag-dashboard = Etiket Analizi
tag-dashboard-open =
    .label = Etiket Analizi panelini aç

writing-features = Yazım özellikleri
inciteful-enabled =
    .label = Inciteful araçlarını aç
reading-enabled =
    .label = Okuma panosu / durumu aç (Extra alanına ReadingFlow yazar)
import-enabled =
    .label = Güvenli BibTeX/RIS içe aktarmayı aç
docx-cited-enabled =
    .label = DOCX'te kullanılanlar etiketlemeyi aç
writing-features-hint = Kapalı özellikler LibRart Pro menüsünde gizlenir ve metadata yazmaz. Menü eski görünürse Zotero'yu yeniden başlatın.

openalex = Atıf katmanları (OpenAlex / Crossref / OpenCitations)
openalex-enabled =
    .label = OpenAlex atıf kenarları
crossref-enabled =
    .label = Crossref atıf kenarları
opencitations-enabled =
    .label = OpenCitations atıf kenarları (varsayılan kapalı)
openalex-mailto =
    .value = OpenAlex mailto (polite pool)
openalex-mailto-hint = Boş bırakılabilir; doldurursanız OpenAlex polite pool kullanır.
openalex-cache-days =
    .value = Önbellek (gün)

citegeist = Citegeist (OpenAlex özet — deneysel)
citegeist-enabled =
    .label = Atıf özeti menüsünü etkinleştir
citegeist-hint = Seçili öğeler için OpenAlex atıf/kaynak sayısı. Tam Citegeist sütun/pane yok (GPL tam port yok).

anki = Anki (AnkiConnect)
anki-enabled =
    .label = Anki köprüsünü etkinleştir
anki-deck =
    .value = Destek (deck)
anki-model =
    .value = Not tipi (model)
anki-host =
    .value = AnkiConnect host
anki-port =
    .value = Port
anki-hint = Anki masaüstü açık ve AnkiConnect eklentisi yüklü olmalı (varsayılan 127.0.0.1:8765).

markdb = Obsidian / MarkDB
markdb-enabled =
    .label = MarkDB vault taramasını etkinleştir
markdb-vault =
    .value = Vault yolu
markdb-strategy =
    .value = Eşleştirme
markdb-strategy-citekey =
    .label = Citekey (YAML / @dosyaadı)
markdb-strategy-itemkey =
    .label = Zotero itemKey
markdb-tag =
    .value = Eşitleme etiketi
markdb-hint = Notlar @citekey.md olmalı; gövde [[@citekey]] veya itemKey referansları Bağlantı Haritası not kenarları üretir. Tarama yukarıdaki etiketi eşitler.

semantic = Anlamsal (Kutuphane / ZotSeek)
semantic-kutuphane-enabled =
    .label = Kutuphane semantic köprüsünü etkinleştir (8756)
semantic-kutuphane-url =
    .value = Köprü URL
semantic-zotseek-enabled =
    .label = ZotSeek yedek — harici eklenti (WASM paket değil; varsayılan kapalı)
semantic-hint = Önce zotero_semantic_baslat.bat (8756). ZotSeek için ayrı eklenti gerekir; LibRart WASM gömmez. Öğelerde Citation Key: KPxxxxxx.

note-workspace = Not bağlantıları (Better Notes uyumlu)
note-workspace-enabled =
    .label = Not bağlantısı eklemeyi etkinleştir
note-workspace-hint = Seçili nota zotero://note/… wikilink ekler; Bağlantı Haritası not katmanı okur. Tam BN workspace sonra.

refchecker = RefChecker + Katman 1 AI
refchecker-enabled =
    .label = RefChecker menüsünü aç (harici servis)
refchecker-url =
    .value = RefChecker URL
k1-ai-url =
    .value = Katman 1 AI URL (arsiv_app)
refchecker-hint = RefChecker web UI loopback :8000. Kaynakça ipuçları arsiv_app :8077 — LibRart içinde LLM yok.

