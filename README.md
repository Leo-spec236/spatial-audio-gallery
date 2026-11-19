# 空间音频项目展厅 · Spatial Audio Gallery

一个陈列交互式空间音频（3D 音频）实验的公开网页。戴上耳机，在浏览器里敲击木门、按动机械键盘，感受声音随方向与距离变化的空间感。

🔗 **在线体验**：https://leo-spec236.github.io/spatial-audio-gallery/

## 项目列表

| 项目 | 说明 |
| --- | --- |
| 空间音频木门 · 直接生成版 | DeepSeek 识别部件与交互，MMAudio 生成音效；敲击木质、玻璃和门框，拖动把手体验开关门 |
| 空间音频木门 · 自动检查版 | 复用相同声音配置，加入自动检查、裁剪与有限重试 |
| 空间音频键盘 · 人工配置版 | 敲击 87 键机械键盘，五类键帽音色；旋转或拉远视角，比较每次敲击的方向和距离 |
| 空间音频键盘 · LLM 配置版 | LLM 配置三类键声，MMAudio 独立生成，人工验收单次敲击 |

## 技术栈

- **前端**：原生 HTML / CSS / JavaScript + ES Modules（无框架、无 CDN 依赖，纯静态）
- **3D 渲染**：Three.js（本地 `vendor/`）
- **空间音频**：Web Audio API
- **声音生成**：MMAudio、DeepSeek

## 本地运行

这是纯静态站点，直接打开 `index.html` 即可。部分项目使用 ES Modules，建议用任意静态服务器启动：

```bash
# 例如用 Python
python -m http.server 8000
# 然后访问 http://localhost:8000
```

## 添加新演示

1. 把新项目文件夹放到 `projects/` 目录下
2. 在 `projects.js` 里加一条记录（`title` / `description` / `url` / `cover` / `alt`）
3. 提交并 push 到 `main` 分支，GitHub Pages 会自动重新构建上线

## 许可证

各项目内的第三方库（如 Three.js）遵循其自身许可证，详见各项目目录下的 `THIRD_PARTY_LICENSES`。
