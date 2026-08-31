# E-commerce AI Studio

面向电商视觉生产流程的 AI 辅助工作台，用于商品分析、主图创作、详情页编排、批量任务和多渠道发布流程预览。

> 当前版本为实验性 Demo。商品分析与图片生成可调用 Gemini 或自定义兼容接口；多渠道发布页面仅模拟流程，不会把商品写入淘宝、京东、抖音、Amazon 等真实商家后台。

## 功能概览

- 上传商品图并维护商品基本信息
- 使用多模态模型分析商品、材质和核心卖点
- 按平台生成视觉提示词与营销文案
- 生成或合成电商主图及五图套装
- 编排商品详情页模块并导出物料
- 创建和管理批量生成任务
- 预览多渠道规格适配、合规检查与分发结果
- 配置 OpenAI Compatible 文本或图片生成接口
- 结构化电商提示词协议：主体、参考图一致性、构图、光线材质、平台约束、负面约束
- 生成后质量复检：分辨率、画幅、清晰度与白底覆盖率
- 受控失败恢复：空结果或明显低质量时最多自动重试一次

## 功能状态

| 模块 | 当前状态 | 说明 |
| --- | --- | --- |
| 商品与视觉分析 | 可用 | 配置 Gemini 或自定义模型时调用真实 AI；否则返回本地 fallback 结果 |
| 商品图片生成 | 可用 | 取决于模型、账号权限和接口兼容性；失败时使用程序化视觉兜底 |
| 详情页生成 | 可用 | 支持 AI 和预设内容生成 |
| 批量工作台 | 可用 | 逐项调用图片 Provider，失败时本地合成；任务元数据可跨刷新恢复，生成的大型 Data URL 不写入 localStorage |
| 多渠道发布 | 模拟 | 不调用真实电商开放平台 API，不会产生真实商品或订单 |
| 合规检查 | 规则预览 | 不能替代平台审核或法律审查 |

## 技术栈

- React 19、TypeScript、Vite
- Express
- Tailwind CSS 4
- Google Gen AI SDK
- Motion、Lucide React、JSZip
- Node.js 20+ 或 Bun

## 快速开始

### 1. 安装依赖

推荐使用 Node.js 20+ 和 npm：

```bash
npm install
```

仓库也包含 `bun.lock`，已安装 Bun 时可以运行：

```bash
bun install
```

### 2. 配置环境变量

复制模板：

```powershell
Copy-Item .env.example .env
```

macOS 或 Linux：

```bash
cp .env.example .env
```

编辑 `.env`：

```env
GEMINI_API_KEY=
APP_URL=http://localhost:3000
PORT=3000
```

`GEMINI_API_KEY` 可以留空，此时应用仍可启动，但 AI 接口会返回演示或 fallback 结果。不要将真实 `.env` 提交到 Git。

正常使用建议保持 `REQUIRE_MODEL=true`（默认值）。此模式下只有两种情况算“已绑定模型”：一是服务端配置了 `GEMINI_API_KEY`；二是在「模型配置」中选择自定义端点，并通过「测试连接」由服务端实际验证成功。

未绑定模型时，工作区锁定、导航按钮禁用、模型配置弹窗的保存按钮禁用，并且 `/api/ai-analyze-product`、`/api/generate-multimodal-platform-prompt`、`/api/generate-product-image`、`/api/generate-hero-suite-5`、`/api/generate-detail-page-modules` 全部返回 `503 MODEL_REQUIRED`，不会静默使用本地 fallback。

服务端只信任本进程内验证通过的端点，验证有效期 6 小时；重启服务或超时后需要重新测试连接。仅填写 URL 而未测试成功不会解锁生成。只有演示、自动化测试或离线体验时，才建议设置 `REQUIRE_MODEL=false`。

### 3. 启动开发环境

```bash
npm run dev
```

打开 `http://localhost:3000`。健康检查地址为 `http://localhost:3000/api/health`。

## 构建与运行

```bash
npm run build
npm start
```

常用命令：

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动 Express 与 Vite 开发服务 |
| `npm run lint` | 执行 TypeScript 类型检查 |
| `npm run build` | 构建前端并打包服务端 |
| `npm run check` | 依次执行类型检查与生产构建 |
| `npm run test:e2e` | 使用无头 Chromium 检查核心页面流程 |
| `npm run test:all` | 执行类型、构建、接口冒烟和端到端测试 |
| `npm start` | 运行 `dist/server.cjs` |
| `npm run clean` | 跨平台删除构建产物 |

## 模型配置

默认服务端读取 `GEMINI_API_KEY`。「模型与接口配置」还支持在界面中配置 OpenAI Compatible 的提示词分析模型和生图模型接口。

绑定是全局共享的：提示词分析模型一处配置，主图工坊的视觉解析、商品弹窗的「AI 一键提炼卖点」都会使用同一个模型与端点，不存在各自独立的模型设置。未绑定时相关按钮不可用，服务端也会返回 `503` + `MODEL_REQUIRED`，前端不会静默降级为模板内容。需要手工填写的卖点框架改由「填入手填框架」按钮显式触发。

使用自定义接口时请注意：

- 不同供应商的路径、模型名和响应格式可能不同。
- API Key 仅在当前页面会话中使用，不会保存到浏览器 `localStorage`。
- 生产环境默认拒绝访问本机和内网 Endpoint；本地开发连接 Ollama 等服务时可使用开发模式。
- 仍不建议在公共电脑输入生产 API Key。
- 浏览器只持久化端点地址与模型名；刷新后连接状态会重置为未验证，需要重新点击测试连接。
- 旧版本或被手工改坏的本地配置会在读取时自动归一化，避免打开模型配置弹窗时崩溃。

## API 概览

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/health` | 服务状态、AI 模式与发布模式 |
| `POST` | `/api/test-custom-endpoint` | 测试自定义模型接口 |
| `POST` | `/api/ai-analyze-product` | 多模态商品分析 |
| `POST` | `/api/generate-multimodal-platform-prompt` | 生成平台提示词 |
| `POST` | `/api/generate-detail-page-modules` | 生成详情页模块 |
| `POST` | `/api/generate-product-image` | 生成商品图 |
| `POST` | `/api/generate-hero-suite-5` | 生成五张主图方案 |
| `POST` | `/api/publish-channels` | 生成模拟渠道分发结果 |

## 项目结构

```text
.
├── src/
│   ├── components/
│   │   ├── HeroImageStudio/
│   │   ├── DetailPageStudio/
│   │   ├── BatchGenerator/
│   │   ├── PublishHub/
│   │   └── ErrorBoundary.tsx
│   ├── data/
│   ├── hooks/
│   │   └── useModelBinding.ts
│   ├── utils/
│   ├── App.tsx
│   └── types.ts
├── server.ts
├── server/
│   ├── ai/
│   │   ├── gemini.ts
│   │   ├── imageInput.ts
│   │   ├── imageProviders.ts
│   │   └── prompts.ts
│   ├── http.ts
│   ├── publishSimulation.ts
│   └── security.ts
├── package.json
├── vite.config.ts
├── tsconfig.json
└── .env.example
```

## 当前限制与上线前检查

- 发布、店铺授权、远程商品编号和合规分数均为演示数据。
- 自定义商品元数据与图片保存在浏览器本地（图片使用 IndexedDB），还未接入服务端账号与云端数据库。
- 批量任务元数据保存在浏览器本地，但刷新后需要重新生成未持久化的大型结果图片。
- 自定义 URL 会由服务端发起请求；生产环境已拦截常见内网地址，正式公网部署仍建议配置供应商域名白名单。
- 生产环境已默认拦截常见本机/内网地址；如确需访问受信任的内网服务，需显式设置 `ALLOW_PRIVATE_ENDPOINTS=true`，并自行承担风险。
- 需要补充登录鉴权、限流、审计日志、文件类型校验和任务队列。
- 模型可用性取决于供应商、区域、账号权限和当前 API 版本。
- `REQUIRE_MODEL=true` 时，服务启动后会强制要求可用模型；健康检查中的 `modelRequired` 与 `modelReady` 可用于部署探针。
- AI 输出及合规建议需要人工复核。
- 无模型或模型失败时，详情页安全模板不会虚构认证、性能、奖项或售后承诺；缺失内容会标记为待商家补充。
- API 响应包含 `X-Request-Id`，服务端记录结构化请求日志，便于定位失败请求。
- `/api/health` 会列出 Gemini、自定义兼容接口和本地合成的能力与配置状态。
- 图片生成 Provider 使用统一结果协议，返回实际 provider、模型、真实 AI 状态和 fallback 原因。
- OpenAI Compatible 的标准 `/images/generations` 路径按文生图处理；需要参考图编辑时，应接入供应商专用编辑接口或工作流适配器。

## 生图提示词方法

项目采用结构化的“Prompt as Code”思路，把电商生图请求拆成固定区块：商品身份、生成目标、参考图一致性、构图、光线与材质、平台约束、负面约束。这样同一套商品信息可以稳定地生成淘宝主图、Amazon 白底图、抖音竖图和详情页素材，并方便后续接入不同模型供应商。

该设计参考了 [`freestylefly/awesome-gpt-image-2`](https://github.com/freestylefly/awesome-gpt-image-2) 的模板化提示词与 Prompt-as-Code 思路，但没有复制其具体案例或提示词文本。

生成完成后，前端会重新检查最终成品，而不仅检查输入参考图。五图套装会记录每张图的质量评分、AI/本地合成来源和人工复核提示；Amazon 或白底槽位还会额外检查纯白背景覆盖率。

每张图片最多调用模型两次。第一次出现接口失败、空结果，或成品评分明显过低时，会带着更严格的构图和一致性约束重试一次；系统保留评分更高的版本，随后停止重试并按需回退到本地合成，避免无限调用和成本失控。

## 后续路线

1. 拆分服务端路由和模型适配层。
2. 增加持久化任务、队列与失败重试。
3. 将第三方密钥迁移至服务端加密存储。
4. 接入真实平台 OAuth 与开放 API，并保留明确的 Demo/Production 开关。
5. 增加单元测试、接口测试和端到端测试。

## License

项目根目录包含 Apache License 2.0 全文。公开分发前仍需确认示例图片、字体和第三方服务的授权范围。
