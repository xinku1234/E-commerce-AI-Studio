# E-commerce AI Studio

电商 AI 视觉工坊与多渠道商品内容生成工具。

本项目用于辅助电商卖家生成商品主图、详情页内容、平台适配提示词和批量视觉素材，并提供多渠道发布流程演示。

> 当前项目仍处于实验性 / Demo 阶段。
> AI 生成功能依赖 Gemini API 或用户配置的第三方模型接口。
> 多平台发布目前为流程模拟，不会真正发布商品到淘宝、京东、抖音或 Amazon。

## 功能特性

- 商品图片上传与商品信息管理
- AI 商品视觉分析
- 根据平台生成商品营销提示词
- AI 商品主图生成
- 多角度商品参考图处理
- 商品详情页模块生成
- 批量图片生成任务管理
- 淘宝、京东、抖音、1688、Amazon 等平台规格适配
- 自定义 OpenAI Compatible API
- 自定义图片生成接口
- 商品发布流程与合规检查结果模拟
- 本地浏览器保存模型配置

## 技术栈

- React 19
- TypeScript
- Vite
- Express
- Tailwind CSS
- Google Gemini API
- `@google/genai`
- Lucide React
- Motion
- JSZip
- Node.js / Bun

## 环境要求

建议使用：

- Node.js 20+
- npm 10+ 或 Bun 1.x
- Gemini API Key（使用真实 AI 功能时需要）

## 安装

### 使用 npm

```bash
npm install
