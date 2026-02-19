#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Question Bank Converter for 智力大闯关
=======================================
Convert JSON/Markdown question files to JS format and auto-update HTML references.

Usage:
  python3 convert_questions.py input.json                   # Auto-detect next bank number
  python3 convert_questions.py input.md                     # Parse Markdown format
  python3 convert_questions.py input.json --bank 6          # Specify bank number
  python3 convert_questions.py input.json --name "第6套 · 新题库"  # Specify display name
  python3 convert_questions.py input.json --group "数学思维"    # Specify group category
  python3 convert_questions.py --interactive                 # Interactive mode (guided input)

JSON Input Format:
{
  "name": "第6套 · 新题库",         // Optional: display name
  "icon": "🧩",                     // Optional: icon emoji
  "group": "数学思维",               // Optional: group category (数学思维/逻辑推理/脑筋急转弯)
  "desc": "趣味逻辑推理题",          // Optional: card description
  "questions": [
    {
      "category": "数学思维",
      "text": "题目内容...",
      "options": ["选项A", "选项B", "选项C"],
      "answer": 0,
      "explanation": "解析..."
    }
  ]
}
"""

import json
import os
import re
import sys
import glob


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
QUESTIONS_DIR = os.path.join(SCRIPT_DIR, "questions")
HTML_FILE = os.path.join(SCRIPT_DIR, "智力大闯关.html")

# Default icons and descriptions for auto-assignment
DEFAULT_ICONS = ["📚", "🎯", "🔢", "🏋️", "⚡", "🧩", "🎲", "💡", "🔬", "🎭",
                 "🌟", "🧪", "📐", "🎪", "🔮", "🏅", "📖", "🧮", "🎨", "🔑"]
DEFAULT_DESCS = ["经典逻辑与推理题", "巧思妙解趣味题", "数学思维训练题", "综合思维体操题",
                 "智慧挑战进阶题", "趣味逻辑推理题", "创意思维训练题", "灵感激发题",
                 "科学探索题", "综合能力挑战题"]


def parse_markdown_questions(md_path):
    """Parse a Markdown question file and return (name, questions).
    
    Expected format:
    - Title line: # ... 智力大闯关 · 第 X 套（...）
    - Questions separated by ## 第 N 题
    - Bold question text: **question text**
    - Options: - A. xxx / - B. xxx / - C. xxx
    - Answer inside <details>: **答案：X. ...**
    - Explanation after > 解析：
    """
    with open(md_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Extract bank name from title
    title_match = re.search(r"#\s+.*?(第\s*\d+\s*套[^\n]*)", content)
    name = title_match.group(1).strip() if title_match else None
    # Clean up name: "第 6 套（脑筋急转弯专场）" -> "第6套 · 脑筋急转弯专场"
    if name:
        name = re.sub(r"第\s*(\d+)\s*套", r"第\1套", name)
        name = re.sub(r"[（(]([^）)]+)[）)]", r" · \1", name)
        name = name.strip()

    # Split into question blocks by "## 第 N 题"
    question_blocks = re.split(r"##\s*第\s*\d+\s*题", content)
    question_blocks = [b.strip() for b in question_blocks[1:] if b.strip()]  # Skip header

    questions = []
    for block in question_blocks:
        q = {}

        # Extract question text (bold text in **...**)
        text_match = re.search(r"\*\*(.+?)\*\*", block)
        if text_match:
            q["text"] = text_match.group(1).strip()
        else:
            continue  # Skip if no question text found

        # Extract options: lines starting with "- A." / "- B." / "- C."
        option_pattern = r"-\s*([A-Z])\.\s*(.+)"
        options_raw = re.findall(option_pattern, block)
        q["options"] = [opt[1].strip() for opt in options_raw]

        # Extract answer from <details> section: **答案：X. ...**
        answer_match = re.search(r"\*\*答案[：:]\s*([A-Z])", block)
        if answer_match:
            answer_letter = answer_match.group(1)
            answer_map = {"A": 0, "B": 1, "C": 2, "D": 3}
            q["answer"] = answer_map.get(answer_letter, 0)
        else:
            q["answer"] = 0

        # Extract explanation from "> 解析：" line
        explanation_match = re.search(r">\s*解析[：:]\s*(.+?)(?:\n\n|</details>|$)", block, re.DOTALL)
        if explanation_match:
            explanation = explanation_match.group(1).strip()
            # Clean up markdown formatting
            explanation = re.sub(r"\*\*(.+?)\*\*", r"\1", explanation)  # Remove bold
            explanation = explanation.replace("\n>", "").replace("\n", "")  # Merge lines
            q["explanation"] = explanation
        else:
            q["explanation"] = ""

        # Default category: try to extract from title or use default
        q["category"] = "脑筋急转弯"

        questions.append(q)

    return name, questions


def get_existing_banks():
    """Scan the questions directory and return a sorted list of existing bank numbers."""
    banks = []
    pattern = os.path.join(QUESTIONS_DIR, "bank*.js")
    for f in glob.glob(pattern):
        basename = os.path.basename(f)
        m = re.match(r"bank(\d+)\.js", basename)
        if m:
            banks.append(int(m.group(1)))
    return sorted(banks)


def get_next_bank_number():
    """Get the next available bank number."""
    existing = get_existing_banks()
    return (existing[-1] + 1) if existing else 1


def validate_questions(questions):
    """Validate the structure of questions list."""
    errors = []
    for i, q in enumerate(questions):
        prefix = f"Question {i + 1}"
        if "text" not in q:
            errors.append(f"{prefix}: missing 'text' field")
        if "options" not in q:
            errors.append(f"{prefix}: missing 'options' field")
        elif not isinstance(q["options"], list) or len(q["options"]) < 2:
            errors.append(f"{prefix}: 'options' must be a list with at least 2 items")
        if "answer" not in q:
            errors.append(f"{prefix}: missing 'answer' field")
        elif not isinstance(q["answer"], int):
            errors.append(f"{prefix}: 'answer' must be an integer index (0-based)")
        elif "options" in q and isinstance(q["options"], list):
            if q["answer"] < 0 or q["answer"] >= len(q["options"]):
                errors.append(f"{prefix}: 'answer' index {q['answer']} out of range")
        if "category" not in q:
            q["category"] = "综合题"  # Auto-fill default category
        if "explanation" not in q:
            q["explanation"] = ""  # Auto-fill empty explanation
    return errors


def generate_js_content(bank_number, name, questions, group=None):
    """Generate the JS file content in the required IIFE format."""
    bank_data = {
        "name": name,
    }
    if group:
        bank_data["group"] = group
    bank_data["questions"] = questions
    json_str = json.dumps(bank_data, ensure_ascii=False, indent=4)

    # Indent the JSON body by 2 spaces (for inside the IIFE)
    lines = json_str.split("\n")
    indented = "\n".join(["  " + line for line in lines])

    js_content = f"""// Question Bank {bank_number}: {name}
(function() {{
  if (!window.questionBanks) window.questionBanks = {{}};
  window.questionBanks["{bank_number}"] ={indented};
}})();
"""
    return js_content


def update_html(bank_number):
    """Add the <script> tag for the new bank into the HTML file."""
    if not os.path.exists(HTML_FILE):
        print(f"⚠️  HTML file not found: {HTML_FILE}")
        print("   Please manually add: <script src=\"questions/bank{}.js\"></script>".format(bank_number))
        return False

    with open(HTML_FILE, "r", encoding="utf-8") as f:
        html = f.read()

    new_tag = f'<script src="questions/bank{bank_number}.js"></script>'

    # Check if already referenced
    if new_tag in html:
        print(f"ℹ️  HTML already has reference to bank{bank_number}.js, skipping.")
        return True

    # Find the last bank script tag and insert after it
    pattern = r'(<script src="questions/bank\d+\.js"></script>)'
    matches = list(re.finditer(pattern, html))

    if matches:
        last_match = matches[-1]
        insert_pos = last_match.end()
        html = html[:insert_pos] + "\n" + new_tag + html[insert_pos:]
    else:
        # Fallback: insert before the main <script> block
        main_script = html.find("<script>")
        if main_script != -1:
            html = html[:main_script] + new_tag + "\n" + html[main_script:]
        else:
            print("⚠️  Could not find insertion point in HTML.")
            print(f"   Please manually add: {new_tag}")
            return False

    with open(HTML_FILE, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"✅ Updated HTML: added {new_tag}")
    return True


def convert_file_to_js(input_path, bank_number=None, name=None, icon=None, desc=None, group=None):
    """Main conversion function. Supports both JSON and Markdown input."""
    print(f"\n📖 Reading: {input_path}")

    # Detect file format
    ext = os.path.splitext(input_path)[1].lower()

    if ext == ".md":
        # Parse Markdown
        md_name, questions = parse_markdown_questions(input_path)
        if not name and md_name:
            name = md_name
        print(f"📝 Parsed Markdown: found {len(questions)} questions")
    elif ext == ".json":
        # Parse JSON
        with open(input_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            questions = data
        elif isinstance(data, dict) and "questions" in data:
            questions = data["questions"]
            if not name and "name" in data:
                name = data["name"]
            if not icon and "icon" in data:
                icon = data["icon"]
            if not desc and "desc" in data:
                desc = data["desc"]
            if not group and "group" in data:
                group = data["group"]
        else:
            print("❌ Invalid JSON format. Expected a list of questions or an object with 'questions' key.")
            sys.exit(1)
    else:
        print(f"❌ Unsupported file format: {ext}. Use .json or .md")
        sys.exit(1)

    # Auto-detect bank number
    if bank_number is None:
        bank_number = get_next_bank_number()

    # Auto-generate name if not provided
    if not name:
        name = f"第{bank_number}套 · 自定义题库"

    # Validate
    errors = validate_questions(questions)
    if errors:
        print("❌ Validation errors found:")
        for e in errors:
            print(f"   - {e}")
        sys.exit(1)

    print(f"✅ Validated: {len(questions)} questions")
    print(f"📦 Bank number: {bank_number}")
    print(f"📝 Name: {name}")
    if group:
        print(f"📂 Group: {group}")

    # Generate JS file
    js_content = generate_js_content(bank_number, name, questions, group)
    os.makedirs(QUESTIONS_DIR, exist_ok=True)
    js_path = os.path.join(QUESTIONS_DIR, f"bank{bank_number}.js")

    if os.path.exists(js_path):
        resp = input(f"⚠️  {js_path} already exists. Overwrite? (y/N): ").strip().lower()
        if resp != "y":
            print("❌ Aborted.")
            sys.exit(0)

    with open(js_path, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"✅ Generated: {js_path}")

    # Update HTML
    update_html(bank_number)

    # Summary
    print(f"\n🎉 Done! Bank {bank_number} ({name}) with {len(questions)} questions is ready.")
    print(f"   JS file: questions/bank{bank_number}.js")
    print(f"   Open 智力大闯关.html to play!\n")


def interactive_mode():
    """Guided interactive mode for creating questions manually."""
    print("\n🎮 Interactive Question Creator")
    print("=" * 40)

    bank_number = get_next_bank_number()
    print(f"\nNext available bank number: {bank_number}")
    custom_num = input(f"Bank number [{bank_number}]: ").strip()
    if custom_num.isdigit():
        bank_number = int(custom_num)

    name = input(f"题库名称 [第{bank_number}套 · 自定义题库]: ").strip()
    if not name:
        name = f"第{bank_number}套 · 自定义题库"

    # Group selection
    print("\n请选择题库大类:")
    print("  1. 🔢 数学思维")
    print("  2. 🧩 逻辑推理")
    print("  3. 🤪 脑筋急转弯")
    group_map = {"1": "数学思维", "2": "逻辑推理", "3": "脑筋急转弯"}
    group_choice = input("选择大类 [1]: ").strip() or "1"
    group = group_map.get(group_choice, "数学思维")
    print(f"  ✅ 已选择: {group}")

    questions = []
    print("\nStart adding questions (type 'done' to finish):\n")

    while True:
        qnum = len(questions) + 1
        print(f"--- Question {qnum} ---")
        text = input("题目: ").strip()
        if text.lower() == "done":
            break
        if not text:
            print("  Skipped empty question.")
            continue

        category = input("分类 [综合题]: ").strip() or "综合题"

        options = []
        for label in ["A", "B", "C"]:
            opt = input(f"  选项 {label}: ").strip()
            if opt:
                options.append(opt)
        if len(options) < 2:
            print("  ⚠️ At least 2 options required. Skipping this question.")
            continue

        answer_str = input(f"  正确答案 (A/B/C): ").strip().upper()
        answer_map = {"A": 0, "B": 1, "C": 2}
        answer = answer_map.get(answer_str, 0)

        explanation = input("  解析: ").strip()

        questions.append({
            "category": category,
            "text": text,
            "options": options,
            "answer": answer,
            "explanation": explanation
        })
        print(f"  ✅ Added question {qnum}\n")

    if not questions:
        print("❌ No questions added. Aborted.")
        sys.exit(0)

    # Save as JSON first (as backup)
    json_backup = os.path.join(SCRIPT_DIR, f"bank{bank_number}_backup.json")
    with open(json_backup, "w", encoding="utf-8") as f:
        json.dump({"name": name, "questions": questions}, f, ensure_ascii=False, indent=2)
    print(f"💾 Backup saved: {json_backup}")

    # Generate JS
    js_content = generate_js_content(bank_number, name, questions, group)
    js_path = os.path.join(QUESTIONS_DIR, f"bank{bank_number}.js")
    os.makedirs(QUESTIONS_DIR, exist_ok=True)

    with open(js_path, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"✅ Generated: {js_path}")

    update_html(bank_number)
    print(f"\n🎉 Done! Bank {bank_number} with {len(questions)} questions is ready.\n")


def main():
    import argparse
    parser = argparse.ArgumentParser(
        description="Convert JSON question files to JS format for 智力大闯关",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 convert_questions.py questions.json
  python3 convert_questions.py questions.md                 # Parse Markdown format
  python3 convert_questions.py questions.json --bank 6 --name "第6套 · 新题库"
  python3 convert_questions.py --interactive
  python3 convert_questions.py --list
        """
    )
    parser.add_argument("input", nargs="?", help="Input file path (.json or .md)")
    parser.add_argument("--bank", type=int, help="Specify bank number (default: auto-detect)")
    parser.add_argument("--name", help="Display name for the question bank")
    parser.add_argument("--icon", help="Icon emoji for the bank card")
    parser.add_argument("--desc", help="Description for the bank card")
    parser.add_argument("--group", help="Group category (数学思维/逻辑推理/脑筋急转弯)")
    parser.add_argument("--interactive", "-i", action="store_true", help="Interactive mode")
    parser.add_argument("--list", "-l", action="store_true", help="List existing banks")

    args = parser.parse_args()

    if args.list:
        existing = get_existing_banks()
        if not existing:
            print("No question banks found.")
        else:
            print(f"\n📚 Existing question banks ({len(existing)} total):")
            for n in existing:
                js_path = os.path.join(QUESTIONS_DIR, f"bank{n}.js")
                # Read the name from the JS file
                with open(js_path, "r", encoding="utf-8") as f:
                    content = f.read()
                m = re.search(r'"name":\s*"([^"]+)"', content)
                bank_name = m.group(1) if m else "Unknown"
                print(f"   Bank {n}: {bank_name}  ({js_path})")
            print(f"\n   Next available number: {get_next_bank_number()}\n")
        return

    if args.interactive:
        interactive_mode()
        return

    if not args.input:
        parser.print_help()
        print("\n💡 Tip: Use --interactive for guided mode, or provide a JSON file.")
        return

    if not os.path.exists(args.input):
        print(f"❌ File not found: {args.input}")
        sys.exit(1)

    convert_file_to_js(args.input, args.bank, args.name, args.icon, args.desc, args.group)


if __name__ == "__main__":
    main()
