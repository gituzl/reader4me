# reader4me 部署教程(Cloudflare Pages)

> 📱 部署后,iPhone/iPad/PC 都能通过 URL 打开,没有 CORS 问题。
> 🔒 你的硅基流动 API Key 只填在 Cloudflare 后台环境变量里,不会进代码、不会进浏览器。
> ⚡ Cloudflare 全球节点(含新加坡),免费、不休眠、秒开。

---

## 第一步:代码已在 GitHub

代码已推送到 `https://github.com/gituzl/reader4me`(分支 `main`)。
以后改了代码 `git push`,Cloudflare 会自动重新部署。

> ✅ `.gitignore` 已排除 `node_modules/` 和 `.env`,不会误传依赖或密钥。

---

## 第二步:在 Cloudflare Pages 部署

### 2.1 登录并连接 GitHub

1. 打开 https://dash.cloudflare.com → 注册/登录(可用邮箱注册,免费)
2. 左侧进入 **Workers & Pages** → **Create** → 选 **Pages** 标签 → **Connect to Git**
3. 授权 Cloudflare 访问你的 GitHub,选择仓库 **`gituzl/reader4me`** → **Begin setup**

### 2.2 构建设置

| 项目 | 值 |
|------|-----|
| Project name | `reader4me`(随意) |
| Production branch | `main` |
| Framework preset | **None** |
| Build command | **留空** |
| Build output directory | **`public`** |

> 仓库里的 `wrangler.toml` 已指定 `pages_build_output_dir = "public"`,
> Cloudflare 通常会自动识别;若界面要求手填,就填 `public`。

### 2.3 设置环境变量(关键!)

展开 **Environment variables (advanced)**,添加:

| Variable name | Value |
|------|-------|
| `SILICONFLOW_API_KEY` | 你的硅基流动 Key(`sk-...`) |

> 这就是「不暴露 Key」的核心:Key 只存在这里,前端永远拿不到。
> (可选)若想换模型,再加一条 `SF_MODEL`,值如 `Qwen/Qwen2.5-72B-Instruct`。

### 2.4 部署

1. 点 **Save and Deploy**,等待 1–2 分钟
2. 成功后得到地址,如 `https://reader4me.pages.dev`

### 2.5 测试

1. PC 浏览器打开该地址 → 看到 reader4me 界面(**没有**填 Key 的设置面板,正常)
2. 点 **📋 粘贴** 或 **📁 上传** 载入一段英/法/俄文本
3. 点击任意单词 → 弹窗显示 IPA + 中文翻译
4. iPhone/iPad Safari 打开同一地址 → 同样正常

---

## 常见问题

### Q:点词报「服务端未配置 SILICONFLOW_API_KEY 环境变量」?
- 环境变量没设或拼写错了。去 **项目 → Settings → Environment variables** 检查后,
  在 **Deployments** 里点最新部署的 **Retry deployment**(改环境变量后需重新部署才生效)。

### Q:点词报别的错(如 502 / 缺少翻译字段)?
- 多为 Key 余额不足、Key 失效,或硅基流动临时抖动。先确认 Key 在硅基流动后台可用。

### Q:函数(`/api/lookup`)没生效 / 404?
- 确认仓库里有 `functions/api/lookup.js`,且 Build output directory = `public`。
  Cloudflare Pages 会自动把根目录的 `functions/` 编译为 API,无需额外配置。

### Q:`*.pages.dev` 打不开?
- 新加坡等地正常直连。极少数网络下可挂代理;或在 Cloudflare 绑定自定义域名(需自备域名)。

---

## 本地测试(可选)

本地仍用 Node + Express(`server.js`),与 Cloudflare 共用 `lib/siliconflow.js`:

```bash
cd reader4me
npm install

# Windows PowerShell:
$env:SILICONFLOW_API_KEY="sk-你的key"
# macOS / Linux:
# export SILICONFLOW_API_KEY="sk-你的key"

node server.js
# 打开 http://localhost:3000
```
