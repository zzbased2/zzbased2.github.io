import re
import sys

def fix_inline_math(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.split('\n')
    result_lines = []
    in_code_block = False

    for line in lines:
        # Track code blocks (```)
        if line.strip().startswith('```'):
            in_code_block = not in_code_block
            result_lines.append(line)
            continue

        if in_code_block:
            result_lines.append(line)
            continue

        # Skip lines that are pure block math (standalone $$ lines)
        stripped = line.strip()
        if stripped == '$$':
            result_lines.append(line)
            continue

        # Process inline math: replace $...$ with $$...$$
        # Strategy: protect existing $$...$$ first, then replace $...$, then restore
        # Step 1: Protect existing $$ pairs
        placeholder = '\x00DOUBLE\x00'
        protected = line.replace('$$', placeholder)

        # Step 2: Replace single $...$ with $$...$$
        # Match $ followed by non-empty content (no $ or newline) followed by $
        protected = re.sub(r'\$([^\$\n]+?)\$', r'$$\1$$', protected)

        # Step 3: Restore protected $$
        protected = protected.replace(placeholder, '$$')

        result_lines.append(protected)

    new_content = '\n'.join(result_lines)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f'Fixed: {filepath}')

if __name__ == '__main__':
    if len(sys.argv) > 1:
        for fp in sys.argv[1:]:
            fix_inline_math(fp)
    else:
        print('Usage: python3 fix_inline_math.py <file1.md> [file2.md ...]')
