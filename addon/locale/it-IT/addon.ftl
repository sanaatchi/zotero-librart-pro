prefs-title = LibRart Pro

prefs-action-name = Nome
prefs-action-event = Evento
prefs-action-operation = Operazione
prefs-action-data = Data
prefs-action-shortcut = Scorciatoia
prefs-action-enabled = Attivo
prefs-action-menu = Etichetta menu
prefs-action-showInMenuItem = In Item Menu
prefs-action-showInMenuCollection = In Collection Menu
prefs-action-showInMenuReader = In Reader Menu
prefs-action-showInMenuReaderAnnotation = In Annotation Menu

prefs-action-event-none = Nessuno
prefs-action-event-createItem = Crea Elemento
prefs-action-event-openFile = Apri file
prefs-action-event-closeTab = Chiudi scheda
prefs-action-event-createAnnotation = Crea annotazione
prefs-action-event-createNote = Crea Nota
prefs-action-event-appendAnnotation = Allega annotazione
prefs-action-event-appendNote = Allega nota
prefs-action-event-changeAnnotationColor = Cambia colore annotazione
prefs-action-event-programStartup = Avvio del programma
prefs-action-event-mainWindowLoad = Caricamento finestra principale
prefs-action-event-mainWindowUnload = Scaricamento finestra principale

prefs-action-operation-none = Nessuno
prefs-action-operation-add = Aggiungi Tag
prefs-action-operation-remove = Rimuovi Tag
prefs-action-operation-toggle = Aggiungi/rimuovi Tag
prefs-action-operation-script = Script
prefs-action-operation-triggerAction = Trigger Other Actions

prefs-action-edit-title = Modifica azione
prefs-action-edit-save = Salva
prefs-action-edit-cancel = Pulisci
prefs-action-edit-delete = Elimina
prefs-action-edit-shortcut-empty = Nessuna scorciatoia
prefs-action-edit-shortcut-placeholder = Premere per registrare la scorciatoia
prefs-action-edit-menu-placeholder = Lasciare vuoto per nascondere la voce nel menu
prefs-action-delete-confirm-message = Vuoi davvero eliminare { $count ->
    [one] { $count } azione selezionata?
    *[other] le { $count } azioni selezionate?
} Questa operazione non può essere annullata.

prefs-script-warning = ⚠️ Attenzione: questo script sarà eseguito con pieno accesso al tuo computer. Usa script provenienti solamente da fonti fidate. Vuoi procedere?

menupopup-label = Innesca azione
menupopup-placeholder = Nessuna azione

message-save-action-warning = This script is using `ZoteroPane.getSelectedItems`, which is NOT recommended for getting items in scripts and can lead to unexpected behavior. Please use the `item` or `items` variables passed to the script instead.

menu-tag-dashboard = Dashboard analisi tag

tag-dashboard-title = Analisi tag
tag-dashboard-subtitle = Origine: { $library } · { $items } pubblicazioni
tag-dashboard-loading = Analisi dei tag in corso…
tag-dashboard-updated = { $library } · aggiornato { $time }
tag-dashboard-error = Analisi non riuscita: { $message }
tag-dashboard-refresh = Aggiorna
tag-dashboard-stat-tags = Tag totali
tag-dashboard-stat-links = Collegamenti tag
tag-dashboard-stat-tagged = Elementi con tag
tag-dashboard-stat-avg = Media tag / elemento
tag-dashboard-stat-singleton = Tag singoli (1 uso)
tag-dashboard-stat-heavy = Tag frequenti (≥20)
tag-dashboard-stat-unused = Tag non usati
tag-dashboard-stat-untagged = Elementi senza tag
tag-dashboard-insight = Copertura e candidati di fusione pronti. Pressione principale: { $singletons } tag singoli e { $folds } gruppi duplicati per maiuscole/minuscole.
tag-dashboard-section-types = Tipi di tag
tag-dashboard-distribution = Distribuzione
tag-dashboard-types-help = Significato
tag-dashboard-cat-person = Persona / nome proprio
tag-dashboard-cat-concept = Concetto
tag-dashboard-cat-place = Luogo
tag-dashboard-cat-system = Sistema
tag-dashboard-help-person = Autori, artisti, nomi propri — spesso singoli. Conservare o ridurre con cautela.
tag-dashboard-help-concept = Spine tematiche; i tag più frequenti sono qui.
tag-dashboard-help-place = Filtri paese/città.
tag-dashboard-help-system = Tag di flusso (#pdf-review, citato…).
tag-dashboard-section-per-item = Tag per elemento
tag-dashboard-per-item-hint = X: numero di tag · Y: numero di elementi
tag-dashboard-section-top = Top 15 tag
tag-dashboard-col-tag = Tag
tag-dashboard-col-count = Elementi
tag-dashboard-section-merge = Candidati di fusione
tag-dashboard-fold-title = Maiusc / minusc
tag-dashboard-bilingual-title = EN → TR
tag-dashboard-fuzzy-title = Fuzzy
tag-dashboard-fuzzy-caution = attenzione
tag-dashboard-fuzzy-note = Mantieni separati coppie intenzionali come art ↔ art education.
tag-dashboard-none = Nessuno
tag-dashboard-recommendation = Suggerimento: unisci prima le coppie case-fold ad alta confidenza, poi pulisci i singoli rumorosi. Non collassare concetti padre/figlio intenzionali.

menu-anki-send = Invia ad Anki
anki-disabled = Ponte Anki disattivato. Abilitalo nelle preferenze di LibRart Pro (serve Anki desktop + AnkiConnect).
anki-error-no-item = Seleziona almeno un elemento da inviare ad Anki.
anki-error-unreachable = Impossibile raggiungere AnkiConnect: { $message }
anki-progress = Invio ad Anki ({ $count } elementi)…
anki-done = Anki: { $created } creati, { $updated } aggiornati, { $failed } errori

menu-markdb-scan = Scansiona vault (MarkDB)
markdb-disabled = MarkDB disattivato. Abilitalo nelle preferenze e imposta il percorso del vault.
markdb-error-no-path = Percorso vault Obsidian / MarkDB vuoto.
markdb-error-scan = Scansione vault non riuscita: { $message }
markdb-scan-done = MarkDB: { $total } note, { $matched } con chiave primaria

menu-semantic-status = Stato semantic
semantic-disabled = Semantic disattivato. Abilita Kutuphane 8756 e/o ZotSeek nelle preferenze.
semantic-error-no-url = URL semantic vuoto.
semantic-error-unreachable = Ponte semantic non raggiungibile.
semantic-status = Kutuphane: { $ready } · { $chunks } chunk · { $model } { $error }
semantic-kutuphane-line-off = Kutuphane: disattivato
zotseek-probe-disabled = ZotSeek: disattivato (preferenze)
zotseek-probe-external-ready = ZotSeek: plugin esterno pronto (search={ $search }, similar={ $similar })
zotseek-probe-external-cold = ZotSeek: plugin esterno caricato, modello non ancora pronto
zotseek-probe-missing = ZotSeek: plugin assente — installa ZotSeek o usa Kutuphane 8756 (WASM non incluso)
zotseek-probe-vendored-stub = ZotSeek: WASM incorporato assente (stub) — usa plugin esterno o 8756
zotseek-probe-vendored-ready = ZotSeek: pipeline incorporata pronta

menu-note-link-insert = Inserisci collegamento nota
menu-note-workspace = Note
menu-note-related = Note correlate
note-workspace-disabled = Collegamenti nota disattivati. Abilitali nelle preferenze.
note-workspace-error-no-source = Nessuna nota sorgente — seleziona una nota o un elemento con note.
note-workspace-error-no-target = Nessuna nota di destinazione.
note-workspace-error-same = Sorgente e destinazione non possono coincidere.
note-workspace-error-link = Impossibile creare il collegamento.
note-workspace-error-insert = Inserimento non riuscito: { $message }
note-workspace-done = Collegamento nota inserito.
note-related-title = Note correlate
note-related-prompt = Scegli una nota da aprire:
note-related-empty = Nessuna nota correlata.
note-related-kind-sibling = Sibling
note-related-kind-outbound = Link
note-related-opened = Nota aperta: { $title }
