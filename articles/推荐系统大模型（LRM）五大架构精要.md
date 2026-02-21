---
title: "推荐系统大模型（LRM）五大架构精要"
date: 2026-02-21
layout: article
description: "---"
---


# 推荐系统大模型（LRM）五大架构精要

> 推荐系统正从"特征交叉工程"向"统一大模型 Scaling"的范式跃迁。本文对五种主流架构——Standard Transformer、RankMixer、TokenMixer-Large、OneTrans、HyFormer——进行深度对比，聚焦它们"为什么这么设计"以及"在推荐场景中具体好在哪里"。

---

## 一、标准 Transformer：起点与痛点

Transformer 是 LLM 的基石，也是推荐系统尝试引入深度序列建模的起点（BST、SASRec 等）。其核心是 **多头 Softmax 注意力**——通过 $$Q \cdot K^T$$ 动态计算 Token 间的相关性权重，再对 $$V$$ 加权求和，所有 Token 共享同一套 FFN。

**但把它直接搬到推荐系统，会撞上两堵墙：**

### 1. 计算复杂度的平方墙

注意力矩阵的维度是 $$T \times T$$（$$T$$ 为序列长度），单层计算量为 $$O(T^2 D + TD^2)$$。当用户行为序列长达 10k 时，$$T^2$$ 项让显存和延迟都不可接受。

### 2. 异构特征的语义墙

NLP 中所有 Token 共享同一个语义空间（都是词），但推荐系统中一个序列里混着商品 ID、类别、价格、用户年龄等高度异构的特征。在这种"鸡同鸭讲"的空间里算内积相似度，Softmax 找不到真正相关的信息，就被迫把多余权重倒给第一个 Token 充当"垃圾桶"——这就是 **注意力下沉（Attention Sink）**。

> **更直观的理解**：想象你在一个嘈杂的鸡尾酒会上，Softmax 要求你必须把 100% 的注意力分配给在场的人。如果你觉得没人值得聊，你也不能发呆，只能盯着门口的保安看——这就是注意力下沉。解决方法是给你一副降噪耳机（Sigmoid 门控），让你可以选择"谁都不听"，总注意力可以低于 100%。

**业界对这两堵墙的三条破局路线：**

1. **加门控（Gated Attention）**：在 SDPA 输出后加 Sigmoid 门控，生成依赖于 Query 的稀疏分数。当 Query 认为上下文无关时，直接将注意力输出"抹零"，绕开 Softmax "总和必须为 1"的刚性约束，彻底消除注意力下沉。
2. **改为目标交叉注意力（STCA / LONGER）**：放弃序列内的自注意力 $$O(L^2)$$，只让 Target Token 作为 Query 去查长历史序列的 Cross-Attention，复杂度直降为 $$O(L)$$。
3. **彻底替换为轻量混合器（RankMixer / TokenMixer）**：丢掉注意力矩阵计算，用物理空间重组 + 隔离 FFN 实现特征交互。

后三种架构（RankMixer、TokenMixer-Large、OneTrans、HyFormer）正是沿着这些路线的工业级实现。

---

## 二、RankMixer：用"物理搬运"替代"动态打分"

### 核心思想

RankMixer 的哲学极其激进：**既然异构特征之间算内积本身就不靠谱，那就不算了**。它用两步操作替代整个自注意力：

1. **Token Mixing（无参数物理路由）**：把每个 Token 的特征向量切成 $$H$$ 段，然后把所有 Token 的"第 $$h$$ 段"强行拼在一起，形成一个新的混合向量。这就像把一副扑克牌按花色切开，然后把所有红心叠一起、所有黑桃叠一起——不同牌（Token）的信息被物理地"挤"进了同一个向量。
2. **Per-token FFN（专属隔离 FFN）**：然后让每个混合向量通过自己专属的 FFN 去学习被混在一起的异构特征之间的高阶交叉。这里的"专属"是关键——NLP 中所有词共享同一套 FFN 没问题，因为词都是同一种东西；但推荐中"年龄"和"商品 ID"是完全不同的语义空间，共享参数会让高频特征淹没长尾特征。

### 约束与代价

为了能做残差连接（$$S + X$$），RankMixer 强制要求切分头数 $$H = T$$（Token 数），确保混合后矩阵维度不变。

### 效果

- **参数量**：$$O(T \cdot D^2)$$，比 Transformer 的 $$O(D^2)$$ 扩大了 $$T$$ 倍——但这恰恰是优势，模型容量大幅提升。
- **计算量**：$$O(T \cdot D^2)$$，彻底消灭了 $$T^2$$ 项。
- **MFU 飞跃**：从 Transformer 在推荐系统中可怜的 ~4.5% 跃升至 ~45%，硬件利用率提升 10 倍。

> **更深入的理解**：RankMixer 的本质是把"谁和谁交互"这个决策从模型的动态学习中剥离出来，变成了一个固定的、确定性的数据路由规则。这看似"笨"，实则巧妙——它把所有的学习能力都集中到了 Per-token FFN 上，而 FFN 是对 GPU 最友好的纯矩阵乘法操作。**用确定性路由换极致算力利用率**，这是一笔在工业场景下极其划算的交易。

---

## 三、TokenMixer-Large：修复裂缝，暴力 Scaling 到 15B

### RankMixer 的致命缺陷

RankMixer 在工业实践中只能堆到 2 层左右就会崩溃。根本原因是**语义错位的残差连接**：混合后的 $$S$$（每个向量是所有 Token 第 $$h$$ 块碎片的拼合体）和原始的 $$X$$（每个向量是第 $$t$$ 个 Token 的完整特征）直接相加。维度相同，但语义完全不对应——就像把"全班同学的左手"和"每个同学的完整身体"相加，物理上做得到，但信息已经错乱了。

### TokenMixer-Large 的三大修复

**1. Mixing & Reverting 对称闭环**

这是最关键的创新。混合交互算完后，执行完全对称的逆向操作——把混合 Token 再切开、按原始归属重新拼回去，**还原为原始 $$T$$ 个 Token 的语义空间**，然后才做残差连接。这建立了无损的信号通路，让模型可以安全地堆叠数十层。

**2. Pre-RMSNorm + Small Init**

- **Pre-RMSNorm**：在特征进入计算模块之前归一化（而非之后），确保每层输入稳定。RMSNorm 去掉了 LayerNorm 中的减均值步骤，吞吐量提升 8.4%。
- **SwiGLU 的 FC_down 极小初始化（0.01）**：让训练初期 $$F(x) \approx 0$$，残差连接 $$F(x) + x \approx x$$，深层网络在初期表现为浅层网络，梯度传播畅通无阻。

**3. Sparse-Pertoken MoE**

在每个专属 FFN 内部引入 MoE（Mixture of Experts），将参数切分为多个专家，每次只激活 Top-k 个（稀疏率 $$S$$，如 1/4）。效果：**参数容量暴增到 15B，但推理 FLOPs 只有全量的 $$S$$ 倍**。

### 效果

- **参数量**：$$O(T \cdot E \cdot D^2)$$，$$E$$ 为专家数，容量极大。
- **计算量**：$$O(S \cdot T \cdot D^2)$$，稀疏率 $$S$$ 进一步压低实际开销。
- **线上验证**：7B/4B 参数全量部署，电商 GMV 提升 2.98%。

> **更深入的理解**：TokenMixer-Large 代表了"工程暴力美学"的极致——不追求架构的精巧，而是通过修补残差、稳定梯度、引入稀疏化，把一个简单的物理混合操作暴力扩展到百亿参数级别。它证明了在推荐系统中，**当底层操作足够高效时，参数规模本身就是最强的特征交叉**。

---

## 四、OneTrans：用一个 LLM 统治推荐系统

### 核心思想

OneTrans 的野心是**把推荐系统完全表达为一个标准的因果 Transformer 计算图**，从而无缝继承 LLM 领域已极度成熟的优化技术（FlashAttention、KV Caching、混合精度、Tensor 并行等）。

传统流水线是"LONGER 压缩序列 → RankMixer 特征交叉"，两个阶段各自为政。OneTrans 认为这种隔离阻碍了序列特征和非序列特征（画像、上下文）之间的早期双向信息流。

### 三大设计

**1. 统一分词（Unified Tokenizer）**

将历史行为序列用 `[SEP]` 拼接为 S-tokens（序列 Token），将非序列特征映射为 NS-tokens（非序列 Token），合并成一条长序列输入。

**2. 混合参数化（Mixed Parameterization）**

这是 OneTrans 最精妙的设计：S-tokens（都是商品，同质性强）共享一套 Q/K/V 和 FFN 参数；NS-tokens（年龄、城市、时间，各不相同）则每个 Token 分配独有的参数。**本质上是在标准 Transformer 框架内嵌入了 Per-token FFN 的思想**。

**3. 金字塔堆叠（Pyramid Stack）**

利用因果掩码"信息向后汇聚"的物理特性：早期 S-tokens 的信息已经被后面的 Token 吸收了，所以逐层裁剪前面的 Token，只保留尾部发出 Query。这将计算量从 $$O(L^2)$$ 降到 $$O(L \cdot L')$$（$$L'$$ 为保留长度）。

### 效果

- **参数量**：$$O((L_{NS} + 1) \cdot D^2)$$，随非序列特征数增长。
- **计算量**：$$O(L \cdot L' \cdot D + L' \cdot D^2)$$，配合 KV Cache 推理效率极高。

> **更深入的理解**：OneTrans 的核心洞察是——**推荐系统的基建不应该自己造，应该站在 LLM 的肩膀上**。当整个行业都在为 LLM 优化 FlashAttention 和 KV Cache 时，你只需要把推荐问题"翻译"成 LLM 的语言（因果自回归序列），就能免费享受这些工程红利。混合参数化是这个"翻译"过程中最关键的一步——它让标准 Transformer 能处理异构特征，而不需要修改任何底层算子。

---

## 五、HyFormer：让 Attention 和 Mixer 各司其职

### 核心思想

HyFormer 对 OneTrans 的"暴力统一"提出了尖锐批判：

1. **强行拼接抹杀差异**：点击序列和购买序列的用户意图完全不同，拼在一起会丢失这种差异。
2. **Self-Attention 做特征交互是浪费**：Attention 擅长从长序列中"捞"信息，但对高度异构的特征交叉既慢又不如 Mixer 好。

HyFormer 的答案是**术业有专攻**：把问题拆成两步，每层交替进行。

### 两步交替架构

**1. Query Decoding（序列解码）**

用非序列特征生成少量全局 Token（$$N$$ 个，$$N$$ 很小）作为 Query，去和长序列做 Cross-Attention。不同序列（点击/购买）拥有独立的 K/V 通道。由于 Query 数量 $$N$$ 固定且极小，计算量仅为 $$O(N \cdot L_S \cdot D)$$，完美避开 $$O(L_S^2)$$。

**2. Query Boosting（特征增强）**

将解码后的 Query Tokens 与非序列 Tokens 拼接，抛弃 Attention，改用 RankMixer 的物理切分混合 + Per-token FFN 进行高效特征交叉。增强后的 Query 流入下一层继续解码。

### 效果

- **参数量**：$$O(T \cdot D^2)$$（Cross-Attn 共享参数 + Per-token FFN 独立参数）。
- **计算量**：$$O(N \cdot L_S \cdot D + T \cdot D^2)$$，对万级长序列极友好。

> **更深入的理解**：HyFormer 的精妙之处在于它认清了一个事实——**Attention 和 Mixer 不是竞争关系，而是互补关系**。Attention 的强项是从变长序列中动态筛选信息（"大海捞针"），Mixer 的强项是在固定特征集上做高效的高阶交叉（"精雕细琢"）。HyFormer 让它们在每一层交替登场，实现了 1+1 > 2 的效果。

---

## 六、总览对比

| 维度 | Standard Transformer | RankMixer | TokenMixer-Large | OneTrans | HyFormer |
|---|---|---|---|---|---|
| **Token 交互** | 动态打分 $$QK^T$$ | 无参数物理路由 | 物理路由 + 对称还原闭环 | 因果自注意力 + 混合参数化 | Cross-Attn 解码 + Mixer 增强 |
| **FFN** | 全局共享 | Per-token 隔离 | Sparse-Pertoken MoE | S-token 共享 / NS-token 隔离 | Cross-Attn 共享 / Boosting 隔离 |
| **参数量** | $$O(D^2)$$ | $$O(TD^2)$$ | $$O(T \cdot E \cdot D^2)$$ | $$O((L_{NS}+1) D^2)$$ | $$O(TD^2)$$ |
| **计算量** | $$O(T^2D + TD^2)$$ | $$O(TD^2)$$ | $$O(S \cdot TD^2)$$ | $$O(L L' D + L' D^2)$$ | $$O(NL_SD + TD^2)$$ |
| **长序列友好度** | ❌ 平方爆炸 | ✅ 线性 | ✅ 线性 + 稀疏 | ⚠️ 依赖金字塔截断 | ✅ $$N$$ 极小，原生高效 |
| **异构特征处理** | ❌ 共享参数 + 内积困难 | ✅ 隔离 FFN | ✅ 隔离 MoE | ✅ 混合参数化 | ✅ 分阶段隔离 |
| **定位** | 基线 | GPU 效率破局者 | 暴力 Scaling 极限 | LLM 生态复用 | 架构精细融合 |

---

## 七、效果与落地路径

### 谁的效果最好？

- **同等算力下的架构效果最优：HyFormer**。离线 AUC 击败了"LONGER + RankMixer"经典两阶段和 OneTrans 统一架构，证明"术业有专攻"是当前特征表征的效果上限。
- **系统极限扩展能力最优：TokenMixer-Large**。成功扩展至 15B 参数，线上部署 7B/4B，电商 GMV +2.98%。当参数规模本身成为壁垒时，它是唯一被验证过的路线。

### 推荐的工业落地路径

```
Step 1: 算力破局（RankMixer）
├── 替换 DCN/MLP 特征交叉模块
├── MFU: 5% → 45%，参数量免费扩至 ~1B
└── 立竿见影的 baseline 提升

Step 2: 序列拉长（LONGER / STCA）
├── Target-to-History Cross-Attention 替代自注意力
├── 配合请求级批处理 + KV Cache
└── 序列长度: 1k → 10k

Step 3: 触碰天花板（分岔口）
├── 路径 A「暴力扩展」→ TokenMixer-Large
│   ├── 引入 Sparse-Pertoken MoE
│   ├── 不增推理 FLOPs，参数量 → 7B~15B
│   └── 适合：基建强、对延迟极敏感
│
└── 路径 B「架构融合」→ HyFormer
    ├── 全局 Token 打通序列与非序列壁垒
    ├── Attention 解码 + Mixer 增强交替迭代
    └── 适合：遇到信息瓶颈、追求同算力下效果最大化
```

> **最终思考**：这五种架构的演进轨迹揭示了推荐系统大模型的一个深层规律——**不是所有问题都适合用同一把锤子解决**。Transformer 的 Attention 是一把万能但昂贵的锤子；RankMixer/TokenMixer 证明了有些钉子用扳手（物理路由 + 隔离 FFN）更快更好；OneTrans 说"别造新工具了，把问题适配到现有最好的工具上"；HyFormer 则说"最好的方案是每个问题用最合适的工具，然后让工具之间协作"。工业落地不存在银弹，关键是理解每种架构的 trade-off，在自己的场景中找到最优的效率-效果平衡点。
