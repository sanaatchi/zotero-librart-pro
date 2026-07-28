prefs-title = Actions & Tags

prefs-action-name = Name
prefs-action-event = Event
prefs-action-operation = Operation
prefs-action-data = Data
prefs-action-shortcut = Shortcut
prefs-action-enabled = Enabled
prefs-action-menu = Menu Label
prefs-action-showInMenuItem = In Item Menu
prefs-action-showInMenuCollection = In Collection Menu
prefs-action-showInMenuTools = In Tools Menu
prefs-action-showInMenuReader = In Reader Menu
prefs-action-showInMenuReaderAnnotation = In Annotation Menu

prefs-action-event-none = None
prefs-action-event-createItem = Create Item
prefs-action-event-openFile = Open File
prefs-action-event-closeTab = Close Tab
prefs-action-event-createAnnotation = Create Annotation
prefs-action-event-createNote = Create Note
prefs-action-event-appendAnnotation = Append Annotation
prefs-action-event-appendNote = Append Note
prefs-action-event-changeAnnotationColor = Change Annotation Color
prefs-action-event-programStartup = Program Startup
prefs-action-event-mainWindowLoad = Main Window Load
prefs-action-event-mainWindowUnload = Main Window Unload

prefs-action-operation-none = None
prefs-action-operation-add = Add Tags
prefs-action-operation-remove = Remove Tags
prefs-action-operation-toggle = Toggle Tags
prefs-action-operation-script = Script
prefs-action-operation-triggerAction = Trigger Other Actions

prefs-action-edit-title = Edit Action
prefs-action-edit-save = Save
prefs-action-edit-cancel = Cancel
prefs-action-edit-delete = Delete
prefs-action-edit-shortcut-empty = No Shortcut
prefs-action-edit-shortcut-placeholder = Press to record shortcut
prefs-action-edit-menu-placeholder = Leave empty to hide in menu
prefs-action-delete-confirm-message = Are you sure you want to delete the selected { $count ->
    [one] { $count } action?
    *[other] { $count } actions?
} This cannot be undone.

prefs-script-warning = ⚠️ Warning: This script will be executed with full access to your computer. Only use scripts from trusted sources. Are you sure you want to continue?

menupopup-label = Trigger Action
menupopup-placeholder = No actions

message-save-action-warning = This script is using `ZoteroPane.getSelectedItems`, which is NOT recommended for getting items in scripts and can lead to unexpected behavior. Please use the `item` or `items` variables passed to the script instead.

menu-tag-dashboard = Tag Analysis Dashboard

tag-dashboard-title = Tag Analysis
tag-dashboard-subtitle = Source: { $library } · { $items } publications
tag-dashboard-loading = Analyzing library tags…
tag-dashboard-updated = { $library } · updated { $time }
tag-dashboard-error = Analysis failed: { $message }
tag-dashboard-refresh = Refresh
tag-dashboard-stat-tags = Total tags
tag-dashboard-stat-links = Tag links
tag-dashboard-stat-tagged = Tagged items
tag-dashboard-stat-avg = Avg tags / item
tag-dashboard-stat-singleton = Singleton tags (1 use)
tag-dashboard-stat-heavy = Heavy tags (≥20)
tag-dashboard-stat-unused = Unused tags
tag-dashboard-stat-untagged = Untagged items
tag-dashboard-insight = Library coverage and merge candidates are ready. Main pressure: { $singletons } singleton tags and { $folds } case-fold duplicate groups.
tag-dashboard-section-types = Tag types
tag-dashboard-distribution = Distribution
tag-dashboard-types-help = What this means
tag-dashboard-cat-person = Person / proper name
tag-dashboard-cat-concept = Concept
tag-dashboard-cat-place = Place
tag-dashboard-cat-system = System
tag-dashboard-help-person = Authors, artists, proper names — often singletons. Keep or prune sparingly.
tag-dashboard-help-concept = Subject spine; most frequent tags live here.
tag-dashboard-help-place = Country/city filters.
tag-dashboard-help-system = Workflow tags (#pdf-review, cited…).
tag-dashboard-section-per-item = Tags per item
tag-dashboard-per-item-hint = X: tag count · Y: number of items
tag-dashboard-section-top = Top 15 tags
tag-dashboard-col-tag = Tag
tag-dashboard-col-count = Items
tag-dashboard-section-merge = Merge candidates
tag-dashboard-fold-title = Case / fold duplicates (high confidence)
tag-dashboard-bilingual-title = EN / TR equivalents
tag-dashboard-fuzzy-title = Fuzzy (careful — parent/child concepts)
tag-dashboard-fuzzy-note = Keep pairs like art ↔ art education separate on purpose.
tag-dashboard-none = None found
tag-dashboard-recommendation = Suggestion: merge high-confidence case-fold pairs first, then clean noisy singletons. Do not collapse intentional parent/child concepts.
