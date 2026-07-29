action = Azioni

help = { $name } Build { $version } { $time }

action-event-none = Nessuno
action-event-createItem = Crea Elemento
action-event-openFile = Apri scheda
action-event-closeTab = Chiudi scheda
action-event-createAnnotation = Crea annotazione
action-event-createNote = Crea nota
action-event-appendAnnotation = Annotazione allegata
action-event-appendNote = Nota allegata
action-event-programStartup = Avvio del programma
action-event-mainWindowLoad = Caricamento finestra principale
action-event-mainWindowUnload = Scaricamento finestra principale

action-operation-none = Nessuno
action-operation-add = Aggiungi Tag
action-operation-remove = Rimuovi Tag
action-operation-toggle = Aggiungi/rimuovi Tag
action-operation-script = Script
action-operation-triggerAction = Innesca altra azione

action-add =
    .tooltiptext = Add a new action
action-remove =
    .tooltiptext = Delete selected action
action-edit =
    .tooltiptext = Edit selected action
action-duplicate =
    .tooltiptext = Duplicate selected action
action-export =
    .tooltiptext = Export selected actions to file
action-import =
    .tooltiptext = Import actions from file

menu = Menu

menu-sort =
    .value = Criterio di ordinamento menu
menu-sort-menuLabel =
    .label = Etichetta menu
menu-sort-name =
    .label = Nome

show-popup =
    .label = Show popup after running action

script-warning-ignore =
    .label = Non mostrare avvisi durante il salvataggio di azioni di script
action-delete-message-ignore =
    .label = Non mostrare conferma durante l'eliminazione di azioni

tag-dashboard = Analisi tag
tag-dashboard-open =
    .label = Apri dashboard analisi tag

anki = Anki (AnkiConnect)
anki-enabled =
    .label = Abilita ponte Anki
anki-deck =
    .value = Mazzo (deck)
anki-model =
    .value = Tipo di nota (model)
anki-host =
    .value = Host AnkiConnect
anki-port =
    .value = Porta
anki-hint = Anki desktop deve essere in esecuzione con il plugin AnkiConnect (predefinito 127.0.0.1:8765).

markdb = Obsidian / MarkDB
markdb-enabled =
    .label = Abilita scansione vault MarkDB
markdb-vault =
    .value = Percorso vault
markdb-strategy =
    .value = Strategia
markdb-strategy-citekey =
    .label = Citekey (YAML / @filename)
markdb-strategy-itemkey =
    .label = Zotero itemKey
markdb-hint = Note @citekey.md; i riferimenti [[@citekey]] / itemKey diventano archi note nella mappa.

semantic = Semantic (Kutuphane / ZotSeek)
semantic-kutuphane-enabled =
    .label = Abilita ponte semantic Kutuphane (8756)
semantic-kutuphane-url =
    .value = URL ponte
semantic-zotseek-enabled =
    .label = Fallback ZotSeek — plugin esterno (WASM non incluso; off di default)
semantic-hint = Avvia zotero_semantic_baslat.bat (8756). ZotSeek richiede plugin separato; LibRart non include WASM. Citation Key: KPxxxxxx.

note-workspace = Collegamenti nota (compatibile Better Notes)
note-workspace-enabled =
    .label = Abilita inserimento collegamenti nota
note-workspace-hint = Inserisce wikilink zotero://note/… nella nota selezionata. Workspace BN completo in seguito.
