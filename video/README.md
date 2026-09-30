# 讲解视频

一支约 6 分钟的 YouTube 讲解视频（中文、英文各一版），内容是沉默相变模型和游戏《道路以目》。

| 文件 | 内容 |
|---|---|
| `script.js` | 旁白脚本：每句一条字幕，按场景分组，中英对照。时长按常见 TTS 语速估算 |
| `scene.html` | 逐帧绘制的场景页（1920×1080）。公式用 KaTeX；历史片段用真实的游戏引擎和城市视图绘制 |
| `render.js` | 渲染脚本：逐帧截图后交给 ffmpeg 编码，再生成字幕、背景音、封面和 YouTube 简介 |

## 准备

`vendor/` 不入库，需要自己准备：

- `vendor/katex/`：KaTeX 的 `dist` 目录（`npm i katex` 后复制 `node_modules/katex/dist`）
- `vendor/fonts/fonts.css` 和字体文件：Noto Sans SC（400、700）、Noto Serif SC（900）的 woff2，以及对应的 `@font-face`（可从 Google Fonts 下载）
- 可选：`vendor/fonts/game/fonts.css`，游戏标题用的 Noto Serif SC（600、900）。有它时，录游戏画面会用本地字体代替 Google Fonts

另外需要：

- playwright（Chromium）
- ffmpeg（要带 libx264 和 libass；找不到时可用环境变量 `FFMPEG` 指定，也可以装 python 包 `imageio-ffmpeg`）
- 字幕字体：WenQuanYi Zen Hei（中文）、Liberation Sans（英文）

## 渲染

```sh
node i18n/build-en.js                                  # 英文版依赖 en/
node video/render.js zh                                # → video/out/zh/
node video/render.js en                                # → video/out/en/
node video/render.js zh --from 290 --to 330 --shots    # 只渲染一段，每秒存一张截图
node video/render.js zh --post                         # 只重做字幕、背景音、封面、简介
node video/render.js zh --fit 29                       # 成片和无字幕版各压一份 29 MB 以内的(两遍编码)
node video/render.js zh --probe 39,45                  # 只跑游戏片段，看这些种子的结局
```

输出（`video/out/<lang>/`）：

- `silence-explainer-<lang>.mp4`：烧录字幕，加轻背景音，可直接上传
- `silence-explainer-<lang>-clean.mp4`：无字幕、无声
- `silence-explainer-<lang>.srt`：字幕文件
- `thumbnail-<lang>.jpg`：封面
- `youtube-<lang>.txt`：标题、简介、章节时间戳

## 在剪映里配音

1. 导入 `-clean.mp4`。
2. 在「文本 → 本地字幕」里导入 `.srt`。
3. 全选字幕，点「文本朗读」，选一个音色。
4. 如果某句读得比字幕时长还长，把那一句的朗读稍微加速，或者把后面的片段往后挪一点。

每句字幕的时长已经按中文每秒约 4.2 字、英文每秒约 2.5 词留了余量。
