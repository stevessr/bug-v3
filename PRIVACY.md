# 表情管理扩展隐私政策

**更新日期：2026 年 9 月 13 日**

本隐私政策适用于 Chrome 扩展“表情管理扩展”（英文名：Emoji Extension，以下简称“本扩展”）。本扩展由 stevessr 维护，项目地址为 <https://github.com/stevessr/bug-v3>。

## 简要说明

- 本扩展不出售、出租用户数据，也不使用广告或第三方跟踪器。
- 不使用本扩展的可选功能时，表情和设置只保存在用户自己的浏览器中。
- 本扩展没有独立的用户账号体系；只有用户主动配置或触发的服务才会接收相应数据。

## 处理的信息

### 本地表情和设置

本扩展会在浏览器本地保存用户创建或导入的表情图片地址、名称、分组、标签、收藏状态、界面设置、同步配置和必要的缓存。这些数据默认不会发送给扩展维护者。

### 当前网页信息

为了在网页中显示表情选择器、把用户选中的表情插入编辑器，以及执行用户主动发起的 Agent 或论坛功能，本扩展可能在当前网页读取 URL、选区、编辑器状态以及实现该功能所需的页面元素。上述处理默认在本地完成；本扩展不会为了统计、广告或建立用户画像而保存或上传浏览记录、网页内容或按键记录。

如果用户主动使用需要登录的论坛功能，本扩展可能在用户已授予可选权限后读取该网站的会话 Cookie，并仅将其用于向用户指定的网站完成请求，不会发送给本扩展的维护者。

### 用户主动启用的第三方服务

以下功能均为可选功能，只有在用户配置或主动执行时才会传输相关数据：

- **云同步（WebDAV、S3 或其他用户配置的端点）：** 将用户选择同步的表情和设置发送到用户填写的服务器。服务器地址、账号和密码由用户自行选择和管理。
- **图片上传、导入和表情市场：** 将用户选择的图片、URL 或表情元数据发送到所选的上传或数据服务，以完成上传、导入或下载。相关服务按照其自身的隐私政策处理数据。
- **AI 命名和 Agent：** 仅在用户启用并配置 AI 服务或本地/远程 Agent 后，将用户选择的提示词、文本或图片发送到用户配置的服务。API 密钥由用户提供，并保存在浏览器本地；第三方服务的处理受其自身条款和隐私政策约束。
- **本地 Native Messaging / MCP：** 如果用户配置了此功能，数据只会发送到用户选择的本地程序或 MCP 服务。

## 数据存储、保留和删除

本扩展主要使用浏览器扩展存储和 IndexedDB 保存本地数据。用户可以在扩展设置中删除表情、配置和缓存，也可以通过浏览器的扩展数据管理功能或卸载本扩展删除本地数据。已经发送到用户自行配置的第三方服务的数据，需要按照该服务的删除机制处理；本扩展维护者无法替用户删除这些数据。

## 权限用途

本扩展请求的权限只用于其表情管理和用户主动的辅助功能：

- `storage`：保存本地表情和设置；
- `activeTab`、`scripting` 和网页主机权限：在用户使用的网页中显示选择器并插入表情；
- `downloads`：导入、导出和下载用户选择的文件；
- `sidePanel`、`tabs` 和 `notifications`：提供侧边栏、跨标签页功能和状态提示；
- `cookies`（可选）：在用户主动使用需要登录的站点功能时完成站点请求；
- `identity`、`nativeMessaging` 和其他辅助权限：仅用于用户主动启用的 Agent、MCP 或本地连接功能。

## 政策变更和联系我们

如果本扩展的功能或数据处理方式发生重大变化，我们会在本页面更新日期和内容。关于隐私问题，可通过项目仓库提交 Issue：<https://github.com/stevessr/bug-v3/issues>。

---

# Emoji Extension Privacy Policy

**Last updated: 2026-09-13**

This policy applies to the Chrome extension “Emoji Extension” (also shown as “表情管理扩展”). It is maintained by stevessr. The source repository is <https://github.com/stevessr/bug-v3>.

## Summary

- The extension does not sell or rent user data and does not include advertising or third-party tracking.
- When optional features are not used, emoji data and settings stay in the user’s browser.
- The extension has no separate user-account system. A service receives data only when the user configures or explicitly uses that service.

## Information processed

### Local emoji data and settings

The extension stores user-created or imported emoji URLs, names, groups, tags, favorites, interface settings, sync configuration, and necessary caches in browser storage. By default, this data is not sent to the extension maintainer.

### Information from the current page

To display the emoji picker, insert a selected emoji into an editor, and run user-initiated Agent or forum features, the extension may read the current page URL, selection, editor state, and page elements needed for that feature. This processing is local by default. The extension does not retain or upload browsing history, page content, or keystrokes for analytics, advertising, or profiling.

When a user explicitly uses a logged-in forum feature, the extension may read that site’s session cookies after the optional permission is granted. They are used only to make the requested request to the site and are not sent to the extension maintainer.

### Third-party services enabled by the user

These features are optional and transmit relevant data only after the user configures or invokes them:

- **Cloud sync (WebDAV, S3, or another endpoint configured by the user):** Sends the emoji and settings selected for synchronization to the server entered by the user. The user chooses and manages that server and its credentials.
- **Image upload, import, and emoji markets:** Sends user-selected images, URLs, or emoji metadata to the selected upload or data service to complete the requested operation. Those services handle data under their own privacy policies.
- **AI naming and Agent features:** After the user enables and configures an AI service or Agent, sends only the selected prompt, text, or image to the service configured by the user. User-provided API keys are stored in browser storage; the third party’s processing is governed by its own terms and privacy policy.
- **Native Messaging / MCP:** If configured by the user, data is sent only to the local program or MCP service selected by the user.

## Storage, retention, and deletion

The extension primarily uses browser extension storage and IndexedDB for local data. Users can delete emojis, settings, and caches in the extension, or remove local data through the browser’s extension-data controls or by uninstalling the extension. Data already sent to a user-configured third-party service must be deleted through that service; the extension maintainer cannot delete it on the user’s behalf.

## Permission purposes

The requested permissions support emoji management and user-initiated helper features:

- `storage`: store local emojis and settings;
- `activeTab`, `scripting`, and host permissions: show the picker and insert emojis on pages the user uses;
- `downloads`: import, export, and download files selected by the user;
- `sidePanel`, `tabs`, and `notifications`: provide the sidebar, cross-tab features, and status messages;
- optional `cookies`: complete requests to logged-in sites when the user invokes those features;
- `identity`, `nativeMessaging`, and other helper permissions: user-enabled Agent, MCP, or local-connection features only.

## Changes and contact

If the extension’s functionality or data practices materially change, this page will be updated with a new date and revised content. For privacy questions, please open an issue in the project repository: <https://github.com/stevessr/bug-v3/issues>.
