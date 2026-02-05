# 终极打通：从本地自建源到 GitHub 全自动运行

既然本地已经跑通，我们只需让 GitHub Actions 能看到您本地的 `localhost:4000`。由于 Cloudflare 在国内网络可能受限，我们换用更稳定的 **cpolar**。

### 第一步：开启内网穿透
1. **下载 cpolar**: 到 [cpolar.com](https://www.cpolar.com/) 下载并安装 Windows 版。
2. **启动映射**: 
   在 PowerShell 中运行（前提是您的 WeWe RSS 正在运行）：
   ```powershell
   cpolar http 4000
   ```
3. **获取公网 URL**:
   终端会显示一个形如 `https://xxxxxx.cpolar.io` 的在线地址。
   - **重要**: 复制这个地址。

### 第二步：配置云端代码
1. 修改您本地的 **[config.json](file:///c:/Users/Administrator/Desktop/code/3/config.json)**：
   - 将 `rss_url` 中的 `http://localhost:4000` 替换为您刚才拿到的 `https://xxxxxx.cpolar.io`。
   - 示例：`"rss_url": "https://xxxxxx.cpolar.io/feeds/MP_WXS_3867811310"`
2. **Push 到 GitHub**:
   ```bash
   git add .
   git commit -m "chore: connect local bridge to cloud"
   git push
   ```

### 第三步：验证 GitHub Actions
1. 进入 GitHub 仓库 -> **Actions**。
2. 手动启动 **Auto Sync WeChat Articles**。
3. 如果日志显示 `RSS 响应状态码: 200`，恭喜您，**全链路自动化正式接通！**

---

### ⚠️ 注意事项
- **免费版 cpolar**: 每次重新启动时域名会变。如果您希望长期全自动运行而不用改配置，可以在 cpolar 官网申请一个固定子域名（需小额付费），或者考虑把 WeWe RSS 部署在云服务器上。
- **电脑需在线**: GitHub Actions 运行期间，您的电脑和 WeWe RSS 需要保持在线状态。

如果您觉得穿透太麻烦，其实您目前的“手动本地点一下，自动 Push 到 GitHub”也是一种很不赖的半自动化方案。
