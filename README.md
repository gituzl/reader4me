# reader4me

一个像 LingQ 一样的多语种阅读器,支持 **PC、iPhone、iPad** 使用。

- 📚 支持 **英语、法语、俄语**
- 👆 点击任意单词 → 弹出 IPA 音标 + 简体中文翻译(翻译结合上下文)
- ⚡ 响应快速,点击下一个单词弹窗就地更新
- 🔒 **API Key 只存在服务端环境变量**,前端永远拿不到,公开仓库也不会泄露
- 🌐 **前后端同源**,iPhone/iPad 直接 URL 访问,无 CORS 问题

---

## 架构

```
前端(静态 HTML/CSS/JS) ──fetch /api/lookup──▶ 后端代理 ──▶ SiliconFlow API
   不接触 API Key                          从环境变量读 Key
```

- 生产环境:`functions/api/lookup.js` 作为 Cloudflare Pages Function 运行。
- 本地开发:`server.js`(Express)提供同样的 `/api/lookup` 路由。
- 两者共用 `lib/siliconflow.js` 里的查词逻辑,Key 始终来自服务端环境变量 `SILICONFLOW_API_KEY`。

---

## 部署到 Cloudflare Pages(推荐)

详细图文步骤见 **[deploy-instructions.md](deploy-instructions.md)**,概要:

1. 把代码推到你自己的 GitHub 仓库。
2. 在 [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages → Create → Pages → Connect to Git,导入这个仓库。
3. 构建设置:Build output directory 填 `public`(`wrangler.toml` 已配好,通常自动识别)。
4. 在 **Environment variables** 添加:
   - Name: `SILICONFLOW_API_KEY`
   - Value: 你的硅基流动 Key(以 `sk-` 开头)
5. Deploy,得到一个 `https://你的项目.pages.dev` 地址,所有设备打开即可使用。

> Key 只填在 Cloudflare 后台,不写进任何代码、不进仓库、不到浏览器。

### 申请 SiliconFlow API Key

1. 注册 https://cloud.siliconflow.cn/register
2. 在 https://cloud.siliconflow.cn/account/ak 创建 Key(以 `sk-` 开头)
3. 新用户有免费额度,个人使用绰绰有余

---

## 本地运行

```bash
cd reader4me
npm install

# 设置环境变量(密钥,不要写进文件)
# Windows PowerShell:
$env:SILICONFLOW_API_KEY="sk-你的key"
# macOS / Linux:
# export SILICONFLOW_API_KEY="sk-你的key"

node server.js
# 打开 http://localhost:3000
```

---

## 使用

- 点工具栏 **📁 上传**,选择 `.txt` 文件;或点 **📋 粘贴** 载入文本
- **点击任意单词**,弹窗显示 IPA + 中文翻译
- 顶部可切换语言、字号(A—A 滑杆)、明暗主题

---

## 常见问题

### Q:点击单词一直「查询中...」或报错?
- 确认 Cloudflare(或本地)已正确设置 `SILICONFLOW_API_KEY`
- 检查硅基流动额度是否用完

### Q:能离线使用吗?
不能。每次查词都需要联网。

### Q:支持 PDF / EPUB / Word 吗?
不支持,目前只支持 `.txt` 纯文本和直接粘贴文本。

---

## 隐私说明

- ✅ API Key 只保存在服务端环境变量,前端从不接触,公开仓库不泄露
- ✅ 后端仅做 API 代理转发,不存储任何数据
- ✅ 全部源码可见可审计

---

## 文件清单

```
reader4me/
├── functions/
│   └── api/
│       └── lookup.js         # Cloudflare Pages Function 代理(生产)
├── lib/
│   └── siliconflow.js        # 共享查词逻辑(前后端复用)
├── public/
│   ├── index.html            # 前端 HTML
│   ├── style.css             # 前端样式
│   └── app.js                # 前端 JS(不含任何 Key)
├── server.js                 # 本地 Express 服务器(同样提供 /api/lookup)
├── wrangler.toml             # Cloudflare Pages 配置(输出目录 public)
├── package.json
├── README.md
└── deploy-instructions.md
```

---

## License

MIT
