#!/usr/bin/env python3
"""
Convert zhihu_merged_report.md to a beautiful HTML page for GitHub Pages.
Matches the ZZBased site style with navigation, filtering, and responsive design.
"""

import re
import html
import os
import sys

# Path configuration
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MD_PATH = os.path.join(os.path.dirname(SCRIPT_DIR), '..', '3-learning', 'zhihu-articles', 'zhihu_merged_report.md')
MD_PATH = os.path.normpath(MD_PATH)
OUTPUT_PATH = os.path.join(SCRIPT_DIR, 'zhihu_reading_notes.html')


def parse_markdown(md_text):
    """Parse the markdown into structured data."""
    sections = []
    current_section = None
    current_article = None
    current_field = None

    lines = md_text.split('\n')
    i = 0

    while i < len(lines):
        line = lines[i]

        # Match section headers like "## ⭐⭐⭐⭐⭐ 五星推荐（必读）（9 篇）"
        section_match = re.match(r'^## (⭐+)\s+(.+)', line)
        if section_match:
            stars = len(section_match.group(1)) // len('⭐') if '⭐' in section_match.group(1) else section_match.group(1).count('⭐')
            # Count actual star characters
            stars = section_match.group(1).count('⭐')
            title = section_match.group(2).strip()
            current_section = {
                'stars': stars,
                'title': title,
                'full_header': section_match.group(0),
                'articles': []
            }
            sections.append(current_section)
            current_article = None
            i += 1
            continue

        # Match article headers like "### 002. 我与Agent的2025"
        article_match = re.match(r'^### (\d+)\.\s+(.+)', line)
        if article_match and current_section is not None:
            current_article = {
                'number': article_match.group(1),
                'title': article_match.group(2).strip(),
                'metadata': {},
                'core_opinions': [],
                'approved': [],
                'critiques': [],
                'extra_refs': [],
                'raw_content': []
            }
            current_section['articles'].append(current_article)
            current_field = None
            i += 1
            continue

        if current_article is not None:
            # Parse metadata table rows
            table_match = re.match(r'^\|\s*(.+?)\s*\|\s*(.+?)\s*\|$', line)
            if table_match:
                key = table_match.group(1).strip()
                value = table_match.group(2).strip()
                if key not in ('属性', '----', '---', '------'):
                    current_article['metadata'][key] = value
                i += 1
                continue

            # Field markers
            if line.startswith('**📌 核心观点：**') or line.startswith('**📌 核心观点:'):
                current_field = 'core_opinions'
                i += 1
                continue
            elif line.startswith('**✅ 认可的观点：**') or line.startswith('**✅ 认可的观点:'):
                current_field = 'approved'
                i += 1
                continue
            elif line.startswith('**⚠️ 需要批判的地方：**') or line.startswith('**⚠️ 需要批判的地方:'):
                current_field = 'critiques'
                i += 1
                continue

            # List items
            list_match = re.match(r'^- (.+)', line)
            if list_match and current_field:
                content = list_match.group(1).strip()
                if current_field == 'core_opinions':
                    current_article['core_opinions'].append(content)
                elif current_field == 'approved':
                    current_article['approved'].append(content)
                elif current_field == 'critiques':
                    current_article['critiques'].append(content)
                i += 1
                continue

            # Extra references
            if line.startswith('更多参考：') or line.startswith('更多参考:'):
                current_article['extra_refs'].append(line)
                i += 1
                continue

            # Separator resets
            if line.strip() == '---':
                current_field = None
                i += 1
                continue

        i += 1

    return sections


def format_inline_markdown(text):
    """Convert inline markdown formatting to HTML."""
    # Escape HTML first
    text = html.escape(text)
    # Bold: **text**
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    # Links: [text](url)
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2" target="_blank" rel="noopener">\1</a>', text)
    # Inline code: `text`
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
    return text


def get_category(article):
    """Determine article category based on title and content."""
    title = article['title'].lower()
    all_text = title + ' '.join(article['core_opinions']).lower()

    tech_keywords = ['llm', 'grpo', 'rl', 'agent', 'embedding', 'rank', 'model', 'token',
                     'transformer', 'sft', 'ppo', '推荐', '召回', '排序', '微调', '训练',
                     '模型', '算法', '架构', '多模态', 'flash', 'attention', 'cvr', '生成式',
                     'onetrans', 'deepseek', 'reward', 'ring', '论文', 'arxiv', 'das',
                     'oneloc', '向量', '检索', 'kmeans', '综述']
    life_keywords = ['享受', '喜欢', '人生', '死亡', '离死亡', '亲戚', '绩效', '结账']
    politics_keywords = ['关税', '特朗普', '台湾', '武统', '战争', '选举', '中美', '泽连斯基',
                         '美国', '衰落', '澳大利亚', '物价', '贸易', '顺差', 'nba', '体坛',
                         '签名', '勇士']

    for kw in tech_keywords:
        if kw in all_text:
            return 'tech'
    for kw in politics_keywords:
        if kw in all_text:
            return 'current-affairs'
    for kw in life_keywords:
        if kw in all_text:
            return 'life'

    return 'other'


CATEGORY_LABELS = {
    'tech': ('🔬', '技术', '#00b894'),
    'current-affairs': ('🌍', '时事', '#6c5ce7'),
    'life': ('💭', '生活', '#fdcb6e'),
    'other': ('📝', '其他', '#636e72'),
}


def generate_html(sections):
    """Generate the full HTML page."""
    # Collect stats
    total_articles = sum(len(s['articles']) for s in sections)
    tech_count = 0
    affairs_count = 0
    life_count = 0

    for s in sections:
        for a in s['articles']:
            cat = get_category(a)
            if cat == 'tech':
                tech_count += 1
            elif cat == 'current-affairs':
                affairs_count += 1
            elif cat == 'life':
                life_count += 1

    # Generate article cards HTML
    articles_html = []
    for section in sections:
        stars = section['stars']
        star_display = '⭐' * stars
        section_id = f"star-{stars}"

        articles_html.append(f'''
        <div class="section-divider" id="{section_id}">
            <div class="section-stars">{star_display}</div>
            <h2 class="section-title">{html.escape(section["title"])}</h2>
            <div class="section-count">{len(section["articles"])} 篇文章</div>
        </div>
        ''')

        for article in section['articles']:
            cat = get_category(article)
            cat_icon, cat_label, cat_color = CATEGORY_LABELS[cat]

            # Build link
            link = article['metadata'].get('链接', '')
            link_match = re.search(r'https?://[^\s\)]+', link)
            link_url = link_match.group(0) if link_match else '#'

            time_str = article['metadata'].get('时间', '')

            # Core opinions
            opinions_html = ''
            if article['core_opinions']:
                items = '\n'.join(f'<li>{format_inline_markdown(op)}</li>' for op in article['core_opinions'][:5])
                more = f'<li class="more-hint">...共 {len(article["core_opinions"])} 条</li>' if len(article['core_opinions']) > 5 else ''
                opinions_html = f'''
                <div class="card-section">
                    <div class="card-section-title">📌 核心观点</div>
                    <ul class="opinion-list">{items}{more}</ul>
                </div>'''

            # Approved
            approved_html = ''
            if article['approved']:
                items = '\n'.join(f'<li>{format_inline_markdown(op)}</li>' for op in article['approved'][:3])
                more = f'<li class="more-hint">...共 {len(article["approved"])} 条</li>' if len(article['approved']) > 3 else ''
                approved_html = f'''
                <div class="card-section">
                    <div class="card-section-title">✅ 认可</div>
                    <ul class="opinion-list approved">{items}{more}</ul>
                </div>'''

            # Critiques
            critiques_html = ''
            if article['critiques']:
                items = '\n'.join(f'<li>{format_inline_markdown(op)}</li>' for op in article['critiques'][:3])
                more = f'<li class="more-hint">...共 {len(article["critiques"])} 条</li>' if len(article['critiques']) > 3 else ''
                critiques_html = f'''
                <div class="card-section">
                    <div class="card-section-title">⚠️ 批判</div>
                    <ul class="opinion-list critique">{items}{more}</ul>
                </div>'''

            articles_html.append(f'''
        <div class="article-card" data-stars="{stars}" data-category="{cat}">
            <div class="card-header">
                <div class="card-number">#{article["number"]}</div>
                <div class="card-meta">
                    <span class="card-star">{star_display}</span>
                    <span class="card-category" style="background: {cat_color}20; color: {cat_color};">{cat_icon} {cat_label}</span>
                </div>
            </div>
            <h3 class="card-title">
                <a href="{html.escape(link_url)}" target="_blank" rel="noopener">{html.escape(article["title"])}</a>
            </h3>
            <div class="card-time">{html.escape(time_str)}</div>
            {opinions_html}
            {approved_html}
            {critiques_html}
        </div>
            ''')

    all_articles_html = '\n'.join(articles_html)

    # Build star navigation
    star_nav_items = []
    for s in sections:
        stars = s['stars']
        count = len(s['articles'])
        star_nav_items.append(
            f'<a href="#star-{stars}" class="star-nav-item" data-filter-stars="{stars}">'
            f'{"⭐" * stars} <span class="star-nav-count">{count}</span></a>'
        )
    star_nav_html = '\n'.join(star_nav_items)

    html_content = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>知乎阅读笔记 | ZZBased</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📚</text></svg>">
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}

        :root {{
            --primary: #667eea;
            --secondary: #764ba2;
            --article-color: #e17055;
            --article-gradient: linear-gradient(135deg, #e17055 0%, #fdcb6e 100%);
            --bg-light: #f8f9fa;
            --text-dark: #2d3436;
            --text-light: #636e72;
            --card-shadow: 0 10px 40px rgba(102, 126, 234, 0.15);
            --star5: #ff6b6b;
            --star4: #ffa502;
            --star3: #2ed573;
            --star2: #70a1ff;
            --star1: #a4b0be;
        }}

        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: var(--bg-light);
            color: var(--text-dark);
            line-height: 1.6;
        }}

        /* Navigation */
        nav {{
            background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
            padding: 15px 0;
            position: sticky;
            top: 0;
            z-index: 1000;
            box-shadow: 0 2px 20px rgba(0,0,0,0.1);
        }}

        .nav-container {{
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}

        .logo {{
            color: white;
            font-size: 1.5rem;
            font-weight: 700;
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 10px;
        }}

        .nav-links {{
            display: flex;
            gap: 8px;
            list-style: none;
        }}

        .nav-links a {{
            color: rgba(255,255,255,0.9);
            text-decoration: none;
            font-weight: 500;
            transition: all 0.3s;
            padding: 8px 16px;
            border-radius: 8px;
        }}

        .nav-links a:hover, .nav-links a.active {{
            color: white;
            background: rgba(255,255,255,0.15);
        }}

        .mobile-menu-btn {{
            display: none;
            background: none;
            border: none;
            color: white;
            font-size: 1.5rem;
            cursor: pointer;
        }}

        /* Breadcrumb */
        .breadcrumb {{
            background: white;
            padding: 15px 20px;
            border-bottom: 1px solid #eee;
        }}

        .breadcrumb-container {{
            max-width: 1200px;
            margin: 0 auto;
            font-size: 0.95rem;
        }}

        .breadcrumb a {{
            color: var(--primary);
            text-decoration: none;
        }}

        .breadcrumb a:hover {{ text-decoration: underline; }}

        .breadcrumb span {{
            color: var(--text-light);
            margin: 0 8px;
        }}

        /* Page Header */
        .page-header {{
            background: var(--article-gradient);
            padding: 50px 20px 60px;
            text-align: center;
            color: white;
        }}

        .page-header-icon {{ font-size: 3.5rem; margin-bottom: 15px; }}

        .page-header h1 {{
            font-size: 2.5rem;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }}

        .page-header .subtitle {{
            font-size: 1.1rem;
            opacity: 0.9;
            margin-bottom: 20px;
        }}

        .header-stats {{
            display: flex;
            justify-content: center;
            gap: 30px;
            flex-wrap: wrap;
        }}

        .stat-item {{
            background: rgba(255,255,255,0.2);
            padding: 8px 20px;
            border-radius: 20px;
            font-size: 0.95rem;
            backdrop-filter: blur(10px);
        }}

        .stat-item strong {{
            font-size: 1.2rem;
        }}

        /* Filter Bar */
        .filter-bar {{
            background: white;
            padding: 20px;
            border-bottom: 1px solid #eee;
            position: sticky;
            top: 56px;
            z-index: 999;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }}

        .filter-container {{
            max-width: 1000px;
            margin: 0 auto;
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            align-items: center;
        }}

        .search-box {{
            flex: 1;
            min-width: 200px;
            padding: 10px 16px;
            border: 2px solid #eee;
            border-radius: 10px;
            font-size: 0.95rem;
            outline: none;
            transition: border-color 0.3s;
        }}

        .search-box:focus {{
            border-color: var(--primary);
        }}

        .filter-btn {{
            padding: 8px 16px;
            border: 2px solid #eee;
            border-radius: 10px;
            background: white;
            font-size: 0.85rem;
            cursor: pointer;
            transition: all 0.3s;
            white-space: nowrap;
        }}

        .filter-btn:hover {{
            border-color: var(--primary);
            color: var(--primary);
        }}

        .filter-btn.active {{
            background: var(--primary);
            color: white;
            border-color: var(--primary);
        }}

        /* Star Navigation */
        .star-nav {{
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }}

        .star-nav-item {{
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 6px 12px;
            border-radius: 8px;
            text-decoration: none;
            font-size: 0.85rem;
            background: #f8f9fa;
            color: var(--text-dark);
            transition: all 0.3s;
            border: 1px solid transparent;
        }}

        .star-nav-item:hover {{
            background: #fff3e0;
            border-color: #ffa502;
        }}

        .star-nav-count {{
            background: rgba(0,0,0,0.08);
            padding: 1px 8px;
            border-radius: 10px;
            font-size: 0.8rem;
        }}

        /* Main Content */
        .main-content {{
            max-width: 1000px;
            margin: 0 auto;
            padding: 30px 20px;
        }}

        /* Section Divider */
        .section-divider {{
            text-align: center;
            padding: 40px 20px 20px;
        }}

        .section-stars {{
            font-size: 1.8rem;
            margin-bottom: 8px;
        }}

        .section-divider .section-title {{
            font-size: 1.4rem;
            color: var(--text-dark);
            margin-bottom: 5px;
        }}

        .section-count {{
            color: var(--text-light);
            font-size: 0.9rem;
        }}

        /* Article Card */
        .article-card {{
            background: white;
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 20px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.06);
            transition: transform 0.2s, box-shadow 0.2s;
            border-left: 4px solid transparent;
        }}

        .article-card:hover {{
            transform: translateY(-2px);
            box-shadow: 0 8px 30px rgba(0,0,0,0.1);
        }}

        .article-card[data-stars="5"] {{ border-left-color: var(--star5); }}
        .article-card[data-stars="4"] {{ border-left-color: var(--star4); }}
        .article-card[data-stars="3"] {{ border-left-color: var(--star3); }}
        .article-card[data-stars="2"] {{ border-left-color: var(--star2); }}
        .article-card[data-stars="1"] {{ border-left-color: var(--star1); }}

        .card-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }}

        .card-number {{
            font-size: 0.85rem;
            color: var(--text-light);
            font-weight: 600;
        }}

        .card-meta {{
            display: flex;
            gap: 8px;
            align-items: center;
        }}

        .card-star {{
            font-size: 0.8rem;
        }}

        .card-category {{
            font-size: 0.75rem;
            padding: 2px 10px;
            border-radius: 10px;
            font-weight: 500;
        }}

        .card-title {{
            font-size: 1.15rem;
            line-height: 1.5;
            margin-bottom: 6px;
        }}

        .card-title a {{
            color: var(--text-dark);
            text-decoration: none;
            transition: color 0.2s;
        }}

        .card-title a:hover {{
            color: var(--primary);
        }}

        .card-time {{
            font-size: 0.82rem;
            color: var(--text-light);
            margin-bottom: 15px;
        }}

        .card-section {{
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid #f0f0f0;
        }}

        .card-section-title {{
            font-size: 0.85rem;
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--text-dark);
        }}

        .opinion-list {{
            list-style: none;
            font-size: 0.88rem;
            color: #444;
        }}

        .opinion-list li {{
            padding: 4px 0 4px 18px;
            position: relative;
            line-height: 1.6;
        }}

        .opinion-list li::before {{
            content: '•';
            position: absolute;
            left: 4px;
            color: var(--primary);
            font-weight: bold;
        }}

        .opinion-list.approved li::before {{
            color: #00b894;
        }}

        .opinion-list.critique li::before {{
            color: #e17055;
        }}

        .opinion-list code {{
            background: #f1f2f6;
            padding: 1px 5px;
            border-radius: 3px;
            font-size: 0.83rem;
        }}

        .opinion-list a {{
            color: var(--primary);
            text-decoration: none;
        }}

        .opinion-list a:hover {{
            text-decoration: underline;
        }}

        .more-hint {{
            color: var(--text-light) !important;
            font-style: italic;
            font-size: 0.82rem !important;
        }}

        .more-hint::before {{
            display: none !important;
        }}

        /* No results */
        .no-results {{
            text-align: center;
            padding: 60px 20px;
            display: none;
        }}

        .no-results-icon {{
            font-size: 3rem;
            margin-bottom: 15px;
        }}

        .no-results h3 {{
            color: var(--text-light);
        }}

        /* Back to top */
        .back-to-top {{
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: var(--primary);
            color: white;
            border: none;
            font-size: 1.3rem;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            transition: all 0.3s;
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 998;
        }}

        .back-to-top:hover {{
            transform: translateY(-3px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
        }}

        .back-to-top.visible {{
            display: flex;
        }}

        /* Footer */
        footer {{
            background: #1a1a2e;
            color: rgba(255,255,255,0.8);
            padding: 30px 20px;
            text-align: center;
            margin-top: 60px;
        }}

        footer a {{
            color: var(--primary);
            text-decoration: none;
        }}

        /* Hidden by filter */
        .article-card.hidden,
        .section-divider.hidden {{
            display: none;
        }}

        /* Responsive */
        @media (max-width: 768px) {{
            .nav-links {{ display: none; }}
            .mobile-menu-btn {{ display: block; }}
            .nav-links.open {{
                display: flex;
                flex-direction: column;
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
                padding: 15px 20px;
                gap: 5px;
            }}
            .page-header h1 {{ font-size: 1.8rem; }}
            .header-stats {{ gap: 12px; }}
            .stat-item {{ font-size: 0.82rem; padding: 6px 14px; }}
            .filter-container {{ flex-direction: column; }}
            .search-box {{ min-width: auto; width: 100%; }}
            .star-nav {{ justify-content: center; }}
            .article-card {{ padding: 18px; }}
        }}

        @media print {{
            nav, .filter-bar, .back-to-top, .breadcrumb {{ display: none; }}
            .article-card {{ break-inside: avoid; box-shadow: none; border: 1px solid #ddd; }}
        }}
    </style>
</head>
<body>
    <nav>
        <div class="nav-container">
            <a href="../" class="logo">
                <span>🚀</span>
                <span>ZZBased</span>
            </a>
            <button class="mobile-menu-btn" onclick="document.querySelector('.nav-links').classList.toggle('open')">☰</button>
            <ul class="nav-links">
                <li><a href="../">首页</a></li>
                <li><a href="../arxiv/">Daily ArXiv</a></li>
                <li><a href="./" class="active">个人文章</a></li>
                <li><a href="../projects/">个人项目</a></li>
                <li><a href="https://github.com/zzbased2" target="_blank">GitHub</a></li>
            </ul>
        </div>
    </nav>

    <div class="breadcrumb">
        <div class="breadcrumb-container">
            <a href="../">🏠 首页</a>
            <span>/</span>
            <a href="./">✍️ 个人文章</a>
            <span>/</span>
            <span style="color: var(--text-dark);">📚 知乎阅读笔记</span>
        </div>
    </div>

    <header class="page-header">
        <div class="page-header-icon">📚</div>
        <h1>知乎阅读笔记</h1>
        <p class="subtitle">114 篇知乎文章的深度阅读、核心观点提取与批判性分析</p>
        <div class="header-stats">
            <div class="stat-item">📝 共 <strong>{total_articles}</strong> 篇</div>
            <div class="stat-item">🔬 技术 <strong>{tech_count}</strong></div>
            <div class="stat-item">🌍 时事 <strong>{affairs_count}</strong></div>
            <div class="stat-item">💭 生活 <strong>{total_articles - tech_count - affairs_count}</strong></div>
        </div>
    </header>

    <div class="filter-bar">
        <div class="filter-container">
            <input type="text" class="search-box" placeholder="🔍 搜索文章标题或关键词..." id="searchBox">
            <div class="star-nav">
                {star_nav_html}
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button class="filter-btn active" data-category="all">全部</button>
                <button class="filter-btn" data-category="tech">🔬 技术</button>
                <button class="filter-btn" data-category="current-affairs">🌍 时事</button>
                <button class="filter-btn" data-category="life">💭 生活</button>
            </div>
        </div>
    </div>

    <main class="main-content" id="articleList">
        {all_articles_html}
        <div class="no-results" id="noResults">
            <div class="no-results-icon">🔍</div>
            <h3>没有找到匹配的文章</h3>
            <p style="color: var(--text-light); margin-top: 8px;">试试其他关键词？</p>
        </div>
    </main>

    <button class="back-to-top" id="backToTop" onclick="window.scrollTo({{top:0,behavior:'smooth'}})">↑</button>

    <footer>
        <p>© 2026 ZZBased | <a href="../">返回首页</a> | <a href="./">返回文章列表</a> | 数据来源: <a href="https://www.zhihu.com/people/zerobased" target="_blank">知乎@zerobased</a></p>
    </footer>

    <script>
        // Search and filter
        const searchBox = document.getElementById('searchBox');
        const cards = document.querySelectorAll('.article-card');
        const dividers = document.querySelectorAll('.section-divider');
        const categoryBtns = document.querySelectorAll('.filter-btn[data-category]');
        const noResults = document.getElementById('noResults');
        let currentCategory = 'all';

        function filterArticles() {{
            const query = searchBox.value.toLowerCase().trim();
            let visibleCount = 0;

            cards.forEach(card => {{
                const title = card.querySelector('.card-title').textContent.toLowerCase();
                const content = card.textContent.toLowerCase();
                const cat = card.dataset.category;

                const matchesSearch = !query || title.includes(query) || content.includes(query);
                const matchesCategory = currentCategory === 'all' || cat === currentCategory;

                if (matchesSearch && matchesCategory) {{
                    card.classList.remove('hidden');
                    visibleCount++;
                }} else {{
                    card.classList.add('hidden');
                }}
            }});

            // Show/hide section dividers
            dividers.forEach(div => {{
                const starLevel = div.id.replace('star-', '');
                const sectionCards = document.querySelectorAll(`.article-card[data-stars="${{starLevel}}"]:not(.hidden)`);
                if (sectionCards.length === 0) {{
                    div.classList.add('hidden');
                }} else {{
                    div.classList.remove('hidden');
                }}
            }});

            noResults.style.display = visibleCount === 0 ? 'block' : 'none';
        }}

        searchBox.addEventListener('input', filterArticles);

        categoryBtns.forEach(btn => {{
            btn.addEventListener('click', () => {{
                categoryBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentCategory = btn.dataset.category;
                filterArticles();
            }});
        }});

        // Back to top
        const backBtn = document.getElementById('backToTop');
        window.addEventListener('scroll', () => {{
            if (window.scrollY > 500) {{
                backBtn.classList.add('visible');
            }} else {{
                backBtn.classList.remove('visible');
            }}
        }});
    </script>
</body>
</html>'''

    return html_content


def main():
    print(f"Reading markdown from: {MD_PATH}")
    if not os.path.exists(MD_PATH):
        print(f"Error: File not found: {MD_PATH}")
        sys.exit(1)

    with open(MD_PATH, 'r', encoding='utf-8') as f:
        md_text = f.read()

    print(f"Parsing markdown ({len(md_text)} bytes)...")
    sections = parse_markdown(md_text)

    total = sum(len(s['articles']) for s in sections)
    print(f"Found {len(sections)} sections, {total} articles total:")
    for s in sections:
        print(f"  {'⭐' * s['stars']} {s['title']} - {len(s['articles'])} articles")

    print(f"\nGenerating HTML...")
    html_content = generate_html(sections)

    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        f.write(html_content)

    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"HTML written to: {OUTPUT_PATH} ({size_kb:.1f} KB)")
    print("Done!")


if __name__ == '__main__':
    main()
