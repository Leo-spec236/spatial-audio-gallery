export const projects = [
  {
    title: '空间音频键盘',
    description: '敲击 87 键机械键盘，听五类键帽的音色。戴上耳机，旋转或拉远视角，比较每次敲击的方向和距离。',
    url: './projects/keyboard/',
    cover: './media/keyboard.png',
    alt: '可交互的三维机械键盘'
  }
];

// LLM_V2_ENTRY
projects.push({"title": "空间音频键盘 · LLM 配置版", "description": "LLM 配置：三类键声，MMAudio 独立生成，人工验收单次敲击；同一空间渲染后端。对照原人工版五类多样本。", "url": "./projects/keyboard-llm-v2/", "cover": "./media/keyboard.png", "alt": "LLM 配置的空间音频键盘"});
for (const p of projects) { if (p.url === "./projects/keyboard/") p.title = "空间音频键盘 · 人工配置版"; }
