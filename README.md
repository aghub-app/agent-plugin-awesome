# agent-plugin-awesome

把 [Cursor plugins](https://github.com/cursor/plugins) 扫成 [Agent Plugins](https://agent-plugins.org/) 1.0.0 可移植包。

转换由 bun 脚本完成，不要手工改各个插件。

## 用法

```sh
git submodule update --init
bun install
bun run convert
```

默认读取 `vendor/cursor-plugins`，写出到 `out/<plugin-name>/`，并在 `out/all.json` 生成插件元信息索引。

```sh
bun run convert -- --source vendor/cursor-plugins --out out
```

## 转换规则

| Cursor | Agent Plugins |
| --- | --- |
| `.cursor-plugin/plugin.json` | 根目录 `plugin.json`，`$schema` 指向 1.0.0 |
| `skills/` | 仍在 `skills/` |
| `mcp.json` 里的 `type: "http"` | `type: "streamable-http"` |
| 无 `type` 但有 `command` | `type: "stdio"` |
| `${CURSOR_PLUGIN_ROOT}` | `${PLUGIN_ROOT}` |
| 带 `${VAR}` 的 MCP headers / `auth` | 挪到 `extensions.com.cursor`（标准不展开 header 占位符，也不定义 portable auth） |
| `rules/` `agents/` `commands/` `hooks/` | `com.cursor/` |

`displayName`、`logo`、`category`、`tags`、`variables` 等 Cursor 市场字段也放进 `extensions.com.cursor`。

每个包还会写 `extensions["moe.akr.aghub"]`：

```json
{
  "category": "Developer tools",
  "source": {
    "repo": "https://github.com/cursor/plugins",
    "path": "ralph-loop"
  }
}
```

分类暂定四类：`Utilities`、`Developer tools`、`Productivity`、`Integrations`。Cursor 的 `developer-tools` 等 slug 会映射到这些标签。`source.path` 是相对 `cursor/plugins` 仓库根目录的路径。
