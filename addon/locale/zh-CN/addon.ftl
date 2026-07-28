prefs-title = Actions & Tags

prefs-action-name = 名称
prefs-action-event = 事件
prefs-action-operation = 操作
prefs-action-data = 数据
prefs-action-shortcut = 快捷键
prefs-action-enabled = 启用
prefs-action-menu = 菜单项
prefs-action-showInMenuItem = 条目菜单中
prefs-action-showInMenuCollection = 分类菜单中
prefs-action-showInMenuTools = 工具菜单中
prefs-action-showInMenuReader = 阅读器菜单中
prefs-action-showInMenuReaderAnnotation = 注释菜单中

prefs-action-event-none = 无
prefs-action-event-createItem = 新建条目
prefs-action-event-openFile = 打开文献
prefs-action-event-closeTab = 关闭标签页
prefs-action-event-createAnnotation = 新建注释
prefs-action-event-createNote = 新建笔记
prefs-action-event-appendAnnotation = 被添加注释
prefs-action-event-appendNote = 被添加笔记
prefs-action-event-changeAnnotationColor = 更改注释颜色
prefs-action-event-programStartup = 程序启动
prefs-action-event-mainWindowLoad = 主窗口加载
prefs-action-event-mainWindowUnload = 主窗口关闭

prefs-action-operation-none = 无
prefs-action-operation-add = 添加标签
prefs-action-operation-remove = 移除标签
prefs-action-operation-toggle = 切换标签
prefs-action-operation-script = 自定义脚本
prefs-action-operation-triggerAction = 触发另一个动作

prefs-action-edit-title = 编辑动作
prefs-action-edit-save = 保存
prefs-action-edit-cancel = 取消
prefs-action-edit-delete = 删除
prefs-action-edit-shortcut-empty = 无快捷键
prefs-action-edit-shortcut-placeholder = 按下键盘以记录快捷键
prefs-action-edit-menu-placeholder = 若为空则不显示菜单项
prefs-action-delete-confirm-message = 确认删除已选择的 { $count } 个动作吗？此操作不可撤销。

prefs-script-warning = ⚠️ 警告: 该脚本将在对您计算机具有完全权限的情况下执行。请仅使用您信任的脚本。是否确认继续？

menupopup-label = 触发动作
menupopup-placeholder = 无可用动作

message-save-action-warning = 此脚本使用了 `ZoteroPane.getSelectedItems`，不建议在脚本中使用该方法获取条目，可能导致意外行为。请使用传递给脚本的 `item` 或 `items` 变量。

menu-tag-dashboard = 标签分析面板

tag-dashboard-title = 标签分析
tag-dashboard-subtitle = 来源：{ $library } · { $items } 条文献
tag-dashboard-loading = 正在分析文库标签…
tag-dashboard-updated = { $library } · 更新于 { $time }
tag-dashboard-error = 分析失败：{ $message }
tag-dashboard-refresh = 刷新
tag-dashboard-stat-tags = 标签总数
tag-dashboard-stat-links = 标签关联
tag-dashboard-stat-tagged = 已标记条目
tag-dashboard-stat-avg = 平均标签 / 条目
tag-dashboard-stat-singleton = 单次标签（1 次）
tag-dashboard-stat-heavy = 高频标签（≥20）
tag-dashboard-stat-unused = 未使用标签
tag-dashboard-stat-untagged = 未标记条目
tag-dashboard-insight = 覆盖率与合并候选已就绪。主要压力：{ $singletons } 个单次标签，{ $folds } 组大小写重复。
tag-dashboard-section-types = 标签类型
tag-dashboard-distribution = 分布
tag-dashboard-types-help = 含义说明
tag-dashboard-cat-person = 人名 / 专有名
tag-dashboard-cat-concept = 概念
tag-dashboard-cat-place = 地点
tag-dashboard-cat-system = 系统
tag-dashboard-help-person = 作者、艺术家、专有名——多为单次。可保留或谨慎清理。
tag-dashboard-help-concept = 主题主干；高频标签多在此。
tag-dashboard-help-place = 国家/城市筛选。
tag-dashboard-help-system = 工作流标签（#pdf-review、已引用…）。
tag-dashboard-section-per-item = 每条目标签数
tag-dashboard-per-item-hint = X：标签数 · Y：条目数
tag-dashboard-section-top = 前 15 标签
tag-dashboard-col-tag = 标签
tag-dashboard-col-count = 条目
tag-dashboard-section-merge = 合并候选
tag-dashboard-fold-title = 大小写
tag-dashboard-bilingual-title = EN → TR
tag-dashboard-fuzzy-title = Fuzzy
tag-dashboard-fuzzy-caution = 注意
tag-dashboard-fuzzy-note = 请有意保留 art ↔ art education 这类上下位对。
tag-dashboard-none = 无
tag-dashboard-recommendation = 建议：先合并高置信大小写对，再清理噪声单次标签。不要折叠有意的上下位概念。
