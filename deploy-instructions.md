# reader4me 部署教程(Vercel)

> 📱 部署后,iPhone/iPad/PC 都能通过 URL 打开,没有 CORS 问题。
> 🔒 你的硅基流动 API Key 只填在 Vercel 后台环境变量里,不会进代码、不会进浏览器。

---

## 第一步:把代码上传到你的 GitHub

### 1.1 创建 GitHub 仓库

1. 打开 https://github.com/new
2. Repository name 填:`reader4me`
3. Public / Private 都可以(Key 不在代码里,Public 也安全)
4. **不要**勾选 "Add a README file"
5. 点 **Create repository**

### 1.2 推送代码

在项目目录打开命令行,依次执行:

```bash
cd E:\3FileStoraged\8Claude_Code_CLI\test\reader4me

git init
git add .
git commit -m "reader4me v3: API key stays server-side"
git branch -M main
git remote add origin https://github.com/你的用户名/reader4me.git
git push -u origin main
```

> ✅ `.gitignore` 已排除 `node_modules/` 和 `.env`,不会误传依赖或密钥。
> ⚠️ 推送时会让你登录 GitHub(用户名 + Personal Access Token)。

---

## 第二步:在 Vercel 部署

### 2.1 注册并导入

1. 打开 https://vercel.com → **Sign Up** → 选 **Continue with GitHub**,授权访问
2. 进入后台点 **Add New… → Project**
3. 在仓库列表找到 `reader4me`,点 **Import**

### 2.2 设置环境变量(关键!)

在导入配置页(或之后 Project → **Settings → Environment Variables**)添加:

| Name | Value |
|------|-------|
| `SILICONFLOW_API_KEY` | 你的硅基流动 Key(`sk-...`) |

- Environment 选全部(Production / Preview / Development)
- 点 **Save**

> 这就是「不暴露 Key」的核心:Key 只存在这里,谁都看不到。

### 2.3 部署

1. 其余设置保持默认(Vercel 会自动识别 `api/` 为函数、`public/` 为静态页)
2. 点 **Deploy**,等待 1–2 分钟
3. 部署成功后得到一个地址,如 `https://reader4me-xxxx.vercel.app`

### 2.4 测试

1. PC 浏览器打开该地址 → 看到 reader4me 界面(注意:**没有**填 Key 的设置面板了,这是正常的)
2. 点 **📋 粘贴** 或 **📁 上传** 载入一段英/法/俄文本
3. 点击任意单词 → 弹窗显示 IPA + 中文翻译
4. iPhone/iPad Safari 打开同一地址 → 同样正常

> 🎉 搞定。以后改了代码 `git push`,Vercel 会自动重新部署。

---

## 常见问题

### Q:点词报「服务端未配置 SILICONFLOW_API_KEY 环境变量」?
- 说明环境变量没设或拼写错了。去 Settings → Environment Variables 检查后,**重新 Deploy** 一次(改环境变量后需要重部署才生效)。

### Q:`*.vercel.app` 打不开?
- 多为网络问题(域名被污染)。挂代理即可访问;或在 Vercel 绑定自定义域名(需自备域名)。

### Q:Vercel 免费版会休眠吗?
- 不会。serverless 函数冷启动仅毫秒级,基本「秒开」,没有 Render 那种 30–50 秒唤醒等待。

### Q:函数区域是哪里?
- `vercel.json` 里设了 `hkg1`(香港),靠近硅基流动 API,查词更快。若免费版限制区域,会自动回退默认区域,功能不受影响。

---

## 本地测试(可选)

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
