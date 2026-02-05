# 非 Docker 部署 WeWe RSS 指南 (Windows 版)

如果您不想使用 Docker，可以按照以下步骤直接在 Windows 上运行 WeWe RSS（需要安装 Node.js）。

### 1. 准备环境
- **安装 Node.js**: 请从 [nodejs.org](https://nodejs.org/) 下载并安装 LTS 版本。
- **安装 pnpm**: 在命令行运行 `npm install -g pnpm`。

### 2. 获取代码与编译
1. 打开命令行（PowerShell），进入您想要存放项目的目录。
2. 克隆项目：
   ```bash
   git clone https://github.com/cooderl/wewe-rss.git
   cd wewe-rss
   ```
3. 安装依赖：
   ```bash
   pnpm install
   ```
4. 编译前端：
   ```bash
   pnpm build
   ```

### 3. 配置与启动
1. 创建环境配置文件 `.env`：
   ```bash
   cp .env.example .env
   ```
2. 编辑 `.env` 文件，设置 `AUTH_TOKEN` (例如 `123456`) 和 `DATABASE_TYPE=sqlite`。
3. 启动服务：
   ```bash
   pnpm start
   ```
4. 启动后，访问 `http://localhost:4000` 即可看到界面。

### 4. 自动化运行
一旦您的本地服务运行起来，您就可以获得一个形如 `http://<您的IP>:4000/atom/xxx` 的本地 RSS 地址。

> [!TIP]
> **连通 GitHub Actions**:
> 由于您的本地服务在内网，云端的 GitHub Actions 无法直接访问。您可以使用 **cpolar** 或 **Cloudflare Tunnel** 快速将 4000 端口映射到公网。映射后，将公网 URL 填入 `config.json` 即可。
