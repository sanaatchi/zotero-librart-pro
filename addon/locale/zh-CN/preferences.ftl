action = Actions

help = { $name } Build { $version } { $time }

action-event-none = 无
action-event-createItem = 新建条目
action-event-openFile = 打开标签页
action-event-closeTab = 关闭标签页
action-event-createAnnotation = 新建注释
action-event-createNote = 新建笔记
action-event-appendAnnotation = 被添加注释
action-event-appendNote = 被添加笔记
action-event-programStartup = 程序启动
action-event-mainWindowLoad = 主窗口加载
action-event-mainWindowUnload = 主窗口关闭

action-operation-none = 无
action-operation-add = 添加标签
action-operation-remove = 移除标签
action-operation-toggle = 切换标签
action-operation-script = 自定义脚本
action-operation-triggerAction = 触发其他动作

action-add =
    .tooltiptext = 创建新动作
action-remove =
    .tooltiptext = 移除选中的动作
action-edit =
    .tooltiptext = 编辑选中的动作
action-duplicate =
    .tooltiptext = 复制选中的动作
action-export =
    .tooltiptext = 导出选中的动作到文件
action-import =
    .tooltiptext = 从文件批量导入动作

menu = 菜单

menu-sort =
    .value = 菜单排序根据
menu-sort-menuLabel =
    .label = 菜单项
menu-sort-name =
    .label = 名称

show-popup =
    .label = 在运行动作后显示状态弹窗

script-warning-ignore =
    .label = 在保存自定义脚本时不显示警告
action-delete-message-ignore =
    .label = 在删除动作时不显示确认提示

tag-dashboard = 标签分析
tag-dashboard-open =
    .label = 打开标签分析面板

anki = Anki (AnkiConnect)
anki-enabled =
    .label = 启用 Anki 桥接
anki-deck =
    .value = 牌组 (deck)
anki-model =
    .value = 笔记类型 (model)
anki-host =
    .value = AnkiConnect 主机
anki-port =
    .value = 端口
anki-hint = 需运行 Anki 桌面版并安装 AnkiConnect 插件（默认 127.0.0.1:8765）。

markdb = Obsidian / MarkDB
markdb-enabled =
    .label = 启用 MarkDB 仓库扫描
markdb-vault =
    .value = Vault 路径
markdb-strategy =
    .value = 匹配策略
markdb-strategy-citekey =
    .label = Citekey（YAML / @文件名）
markdb-strategy-itemkey =
    .label = Zotero itemKey
markdb-tag =
    .value = Sync tag
markdb-hint = 笔记应为 @citekey.md；正文 [[@citekey]] 或 itemKey 会生成连接地图笔记边。扫描会同步上方标签。

semantic = Semantic（Kutuphane / ZotSeek）
semantic-kutuphane-enabled =
    .label = 启用 Kutuphane semantic 桥接（8756）
semantic-kutuphane-url =
    .value = 桥接 URL
semantic-zotseek-enabled =
    .label = ZotSeek 回退 — 外部插件（未打包 WASM；默认关闭）
semantic-hint = 请先运行 zotero_semantic_baslat.bat（8756）。ZotSeek 需单独插件；LibRart 不附带 WASM。条目需 Citation Key: KPxxxxxx。

note-workspace = 笔记链接（兼容 Better Notes）
note-workspace-enabled =
    .label = 启用插入笔记链接
note-workspace-hint = 向所选笔记插入 zotero://note/… 维基链接；连接地图笔记层可读。完整 BN 工作区稍后。

# --- synced from en-US (writing + citation) ---
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

refchecker = RefChecker + Katman 1 AI
refchecker-enabled =
    .label = Enable RefChecker menu (external service)
refchecker-url =
    .value = RefChecker URL
k1-ai-url =
    .value = Katman 1 AI URL (arsiv_app)
refchecker-hint = Run RefChecker web UI on loopback :8000. Bibliography tips use arsiv_app :8077 — no LLM inside LibRart.

