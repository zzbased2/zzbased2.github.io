#!/usr/bin/env python3
"""
Auto Front Matter Script for ZZBased GitHub Pages

Usage:
    Copy your .md file into the articles/ directory, then run:
        python3 add_frontmatter.py

    It will automatically add Jekyll front matter to any .md file
    that doesn't already have one.

What it does:
    - Scans articles/ for .md files without front matter (no "---" at line 1)
    - Extracts title from the first # heading (or uses filename)
    - Uses file modification date as the article date
    - Auto-generates description from the first paragraph
    - Sets layout: article (matches _config.yml defaults)
"""

import os
import re
import datetime

ARTICLES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "articles")


def has_front_matter(filepath):
    """Check if a file already has Jekyll front matter."""
    with open(filepath, "r", encoding="utf-8") as f:
        first_line = f.readline().strip()
    return first_line == "---"


def extract_title(content):
    """Extract title from the first # heading."""
    match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
    if match:
        return match.group(1).strip()
    return None


def extract_description(content, max_len=120):
    """Extract a short description from the first meaningful paragraph."""
    # Skip headings and blank lines, find first paragraph text
    lines = content.split("\n")
    para_lines = []
    for line in lines:
        stripped = line.strip()
        # Skip headings, blank lines, blockquotes, images, html tags
        if not stripped or stripped.startswith("#") or stripped.startswith(">") \
                or stripped.startswith("![") or stripped.startswith("<"):
            if para_lines:
                break
            continue
        para_lines.append(stripped)

    if para_lines:
        desc = " ".join(para_lines)
        if len(desc) > max_len:
            desc = desc[:max_len] + "..."
        return desc
    return ""


def generate_front_matter(filepath, content):
    """Generate Jekyll front matter for a markdown file."""
    # Title: from first heading or filename
    title = extract_title(content)
    if not title:
        basename = os.path.splitext(os.path.basename(filepath))[0]
        title = basename.replace("_", " ").replace("-", " ").title()

    # Date: from file modification time
    mtime = os.path.getmtime(filepath)
    date_str = datetime.datetime.fromtimestamp(mtime).strftime("%Y-%m-%d")

    # Description
    description = extract_description(content)

    # Build front matter
    fm_lines = [
        "---",
        f'title: "{title}"',
        f"date: {date_str}",
        "layout: article",
    ]
    if description:
        # Escape quotes in description
        description = description.replace('"', '\\"')
        fm_lines.append(f'description: "{description}"')
    fm_lines.append("---")

    return "\n".join(fm_lines) + "\n"


def process_file(filepath):
    """Add front matter to a file if it doesn't have one."""
    if has_front_matter(filepath):
        return False

    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    front_matter = generate_front_matter(filepath, content)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(front_matter + "\n" + content)

    return True


def main():
    if not os.path.isdir(ARTICLES_DIR):
        print(f"Error: articles directory not found: {ARTICLES_DIR}")
        return

    md_files = [f for f in os.listdir(ARTICLES_DIR)
                if f.endswith(".md") and not f.startswith("_")]

    if not md_files:
        print("No .md files found in articles/")
        return

    updated = 0
    skipped = 0

    for filename in sorted(md_files):
        filepath = os.path.join(ARTICLES_DIR, filename)
        if process_file(filepath):
            print(f"✅ Added front matter: {filename}")
            updated += 1
        else:
            print(f"⏭️  Already has front matter: {filename}")
            skipped += 1

    print(f"\nDone! Updated: {updated}, Skipped: {skipped}")


if __name__ == "__main__":
    main()
