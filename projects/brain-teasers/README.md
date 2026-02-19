# 🧠 智力大闯关

一款面向小学生的 **纯前端智力闯关小游戏**，无需服务器，双击 HTML 文件即可运行。玩家通过回答智力题来攀爬台阶，答错则水面上升、鳄鱼逼近，紧张刺激又寓教于乐！

---

## 🎮 游戏玩法

1. **选择题库** — 打开游戏后，从 7 套题库中选择一套（每套 10 题）
2. **选择起始位置** — 选择初始台阶（1~5 级，默认推荐第 2 级，越低难度越大）
3. **答题闯关** — 每题三选一：
   - ✅ **答对**：玩家上升一级台阶 + 获得一朵小红花 🌺 + 胜利音效 🎵
   - ❌ **答错**：水面上升一级，鳄鱼逼近 + 悲伤音效 😢
4. **结局判定**：
   - 🏆 **通关成功** — 答完所有题目且未被水淹没
   - 🐊 **被鳄鱼吃掉** — 水面淹没到玩家所在台阶

## ✨ 游戏特色

- 🎯 **7 套题库**，共 70 道精选智力题（数学思维、逻辑推理、脑筋急转弯等）
- 🏗️ **13 级台阶**（编号 0-12），鳄鱼在第 0 级守候
- 🐊 **3 只鳄鱼** 在水中游动，视觉效果更醒目
- 🎵 **音效系统** — 答对/答错各有独特音效（Web Audio API 合成，无需外部音频文件）
- 🌺 **红花奖励** — 每答对一题获得一朵小红花
- 📱 **纯前端实现** — 单个 HTML 文件 + JS 题库文件，无需安装任何依赖
- 🖱️ **双击即玩** — 直接用浏览器打开，无需 HTTP 服务器

---

## 📁 项目结构

```
6-brain-teasers/
├── 智力大闯关.html              # 🎮 游戏主文件（双击打开即可玩）
├── convert_questions.py         # 🔧 题库转换工具（Markdown/JSON → JS）
├── questions/                   # 📦 题库数据（外部 JS 文件）
│   ├── bank1.js                 #   第1套 · 经典推理（10题）
│   ├── bank2.js                 #   第2套 · 巧思妙解（10题）
│   ├── bank3.js                 #   第3套 · 数学乐园（10题）
│   ├── bank4.js                 #   第4套 · 思维体操（10题）
│   ├── bank5.js                 #   第5套 · 智慧挑战（10题）
│   ├── bank6.js                 #   第6套 · 脑筋急转弯专场（10题）
│   └── bank7.js                 #   第7套 · 脑筋急转弯专场（10题）
├── test-paper/                  # 📝 原始题目文件（Markdown 格式）
│   ├── 智力大闯关_第1套.md
│   ├── 智力大闯关_第2套.md
│   ├── 智力大闯关_第3套.md
│   ├── 智力大闯关_第4套.md
│   ├── 智力大闯关_第5套.md
│   ├── 智力大闯关_第6套.md
│   └── 智力大闯关_第7套.md
└── README.md                    # 📖 本文件
```

---

## 🏗️ 技术架构

### 前端架构

```
智力大闯关.html
├── CSS (内嵌)
│   ├── 游戏容器布局（左侧场景 + 右侧答题面板）
│   ├── 题库选择界面（紫色渐变卡片网格）
│   ├── 起始位置选择界面（绿色渐变卡片）
│   ├── 台阶、角色、水面、鳄鱼动画
│   └── 结果界面（通关/失败）
├── HTML 结构
│   ├── 选择界面（题库 → 位置）
│   ├── 游戏场景（台阶 + 角色 + 水面 + 鳄鱼）
│   └── 答题面板（题目 + 选项 + 反馈 + 下一题）
└── JavaScript
    ├── 外部题库加载 (questions/bankX.js → window.questionBanks)
    ├── Web Audio API 音效（胜利/悲伤音效合成）
    ├── 游戏状态管理（题目、台阶、水位、红花）
    └── DOM 操作与动画控制
```

### 题库加载机制

采用 **方案 B：外部 JS 文件** 加载题库数据：

```javascript
// 每个 bankX.js 使用 IIFE 注册到全局变量
(function() {
  if (!window.questionBanks) window.questionBanks = {};
  window.questionBanks["1"] = { name: "第1套 · 经典推理", questions: [...] };
})();
```

```html
<!-- HTML 中通过 script src 引入 -->
<script src="questions/bank1.js"></script>
<script src="questions/bank2.js"></script>
...
```

```javascript
// 主逻辑中直接引用
var allBanks = window.questionBanks;
```

**优点**：可直接双击打开（无 CORS 限制）、题库独立维护、新增题库只需加文件 + 加引用。

---

## ➕ 新增题库

### 方式一：从 Markdown 文件转换（推荐）

```bash
# 自动检测下一个编号、解析 Markdown、生成 JS、更新 HTML
python3 convert_questions.py 智力大闯关_第8套.md

# 指定编号和名称
python3 convert_questions.py 智力大闯关_第8套.md --bank 8 --name "第8套 · 新题库"
```

### 方式二：从 JSON 文件转换

准备 JSON 文件：

```json
{
  "name": "第8套 · 新题库",
  "questions": [
    {
      "category": "数学思维",
      "text": "题目内容...",
      "options": ["选项A", "选项B", "选项C"],
      "answer": 0,
      "explanation": "解析内容"
    }
  ]
}
```

```bash
python3 convert_questions.py questions.json
```

### 方式三：交互式手动输入

```bash
python3 convert_questions.py --interactive
```

### 查看已有题库

```bash
python3 convert_questions.py --list
```

---

## 🔧 convert_questions.py 转换工具

一个多功能的题库转换工具，支持：

| 功能 | 命令 |
|------|------|
| 从 JSON 转换 | `python3 convert_questions.py input.json` |
| 从 Markdown 转换 | `python3 convert_questions.py input.md` |
| 指定编号 | `--bank 8` |
| 指定名称 | `--name "第8套 · 新题库"` |
| 交互式输入 | `--interactive` |
| 列出所有题库 | `--list` |

转换时会自动：
- ✅ 校验题目格式（缺少字段会报错）
- ✅ 检测下一个可用编号
- ✅ 生成 `questions/bankX.js` 文件
- ✅ 更新 HTML 中的 `<script>` 引用

### 支持的 Markdown 格式

```markdown
## 第 1 题

**题目内容...**

- A. 选项一
- B. 选项二
- C. 选项三

<details>
<summary>点击查看答案</summary>

**答案：A. 选项一**

> 解析：解析内容...

</details>
```

---

## 🎨 界面预览

游戏包含以下界面：

1. **题库选择** — 紫色渐变背景，卡片式选择 7 套题库
2. **起始位置** — 绿色渐变背景，选择第 1~5 级台阶
3. **游戏主界面** — 左侧场景（台阶 + 角色 + 水面 + 鳄鱼），右侧答题面板
4. **结果界面** — 通关（绿色）或失败（红色），显示红花数量和评级

---

## 📋 开发历程

1. 创建基础游戏框架（单套题库嵌入 HTML）
2. 新增 5 套题库 + 题库选择界面
3. 题库抽离为外部 `.js` 文件（方案 B：IIFE + script src）
4. 开发 `convert_questions.py` 转换工具（JSON 格式）
5. 增强转换工具支持 Markdown 格式
6. 从 GitHub 拉取第 6、7 套题库并自动转换
7. 新增起始台阶位置选择功能
8. 台阶编号改为 0-12（鳄鱼在第 0 级）
9. 添加 Web Audio API 音效系统（胜利/悲伤音效）
10. 优化鳄鱼显示（3 只鳄鱼，更醒目）
11. 修复台阶编号与人物位置不匹配的问题
12. 规则优化：每答对一题就获得一朵小红花
