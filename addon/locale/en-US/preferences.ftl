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

tag-dashboard = Tag Analysis
tag-dashboard-open =
    .label = Open Tag Analysis panel

writing-features = Writing features
inciteful-enabled =
    .label = Enable Inciteful tools
reading-enabled =
    .label = Enable reading dashboard / status
import-enabled =
    .label = Enable safe BibTeX/RIS import
docx-cited-enabled =
    .label = Enable DOCX cited tagging
writing-features-hint = Disabled features are hidden from the LibRart Pro menu. Restart Zotero after changing menus if items look stale.

openalex = Citation layers (OpenAlex / Crossref / OpenCitations)
openalex-enabled =
    .label = OpenAlex citation edges
crossref-enabled =
    .label = Crossref citation edges
opencitations-enabled =
    .label = OpenCitations citation edges (off by default)
openalex-mailto =
    .value = OpenAlex mailto (polite pool)
openalex-mailto-hint = Optional; when set, OpenAlex polite pool is used.
openalex-cache-days =
    .value = Cache (days)

citegeist = Citegeist (OpenAlex summary — experimental)
citegeist-enabled =
    .label = Enable citation summary menu
citegeist-hint = OpenAlex citation/reference counts for selected items. Full Citegeist columns/pane not ported (no full GPL UI).

anki = Anki (AnkiConnect)
anki-enabled =
    .label = Enable Anki bridge
anki-deck =
    .value = Deck name
anki-model =
    .value = Note type (model)
anki-host =
    .value = AnkiConnect host
anki-port =
    .value = Port
anki-hint = Anki desktop must be running with the AnkiConnect add-on (default 127.0.0.1:8765).

markdb = Obsidian / MarkDB
markdb-enabled =
    .label = Enable MarkDB vault scan
markdb-vault =
    .value = Vault path
markdb-strategy =
    .value = Match strategy
markdb-strategy-citekey =
    .label = Citekey (YAML / @filename)
markdb-strategy-itemkey =
    .label = Zotero itemKey
markdb-tag =
    .value = Sync tag
markdb-hint = Notes should be @citekey.md; body [[@citekey]] or itemKey refs become Connection Map note edges. Scan syncs the tag above.

semantic = Semantic (Kutuphane / ZotSeek)
semantic-kutuphane-enabled =
    .label = Enable Kutuphane semantic bridge (8756)
semantic-kutuphane-url =
    .value = Bridge URL
semantic-zotseek-enabled =
    .label = ZotSeek fallback — external plugin (WASM not bundled; off by default)
semantic-hint = Start zotero_semantic_baslat.bat (8756) first. ZotSeek needs a separate plugin; LibRart does not ship WASM. Items need Citation Key: KPxxxxxx.

note-workspace = Note links (Better Notes compatible)
note-workspace-enabled =
    .label = Enable note-link insert
note-workspace-hint = Inserts zotero://note/… wikilinks into the selected note; Connection Map note layer reads them. Related notes can open in tabs. Full BN chrome later.

refchecker = RefChecker + Katman 1 AI
refchecker-enabled =
    .label = Enable RefChecker menu (external service)
refchecker-url =
    .value = RefChecker URL
k1-ai-url =
    .value = Katman 1 AI URL (arsiv_app)
refchecker-hint = Run RefChecker web UI on loopback :8000. Bibliography tips use arsiv_app :8077 — no LLM inside LibRart.

