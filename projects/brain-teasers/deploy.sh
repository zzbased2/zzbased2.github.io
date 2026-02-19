#!/bin/bash
# deploy.sh - Deploy brain-teasers project to GitHub Pages
#
# Usage: bash deploy.sh
#
# This script syncs the brain-teasers project files from the source directory
# to the GitHub Pages deployment directory.

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source directory (where this script lives)
SRC_DIR="$SCRIPT_DIR"

# Target directory (GitHub Pages deployment)
TARGET_DIR="$(dirname "$SCRIPT_DIR")/zzbased2.github.io/projects/brain-teasers"

echo "============================================"
echo "  Brain Teasers - Deploy to GitHub Pages"
echo "============================================"
echo ""
echo "Source:  $SRC_DIR"
echo "Target:  $TARGET_DIR"
echo ""

# Check if target directory exists
if [ ! -d "$TARGET_DIR" ]; then
    echo "Error: Target directory does not exist: $TARGET_DIR"
    echo "Please make sure zzbased2.github.io repo is cloned properly."
    exit 1
fi

# Create questions directory in target if it doesn't exist
mkdir -p "$TARGET_DIR/questions"

# Sync index.html
echo "[1/2] Syncing index.html ..."
cp "$SRC_DIR/index.html" "$TARGET_DIR/index.html"
echo "  ✅ index.html synced"

# Sync all question bank files
echo "[2/2] Syncing question banks ..."
SYNCED=0
UPDATED=0
for src_file in "$SRC_DIR/questions/"*.js; do
    filename=$(basename "$src_file")
    target_file="$TARGET_DIR/questions/$filename"
    
    if [ ! -f "$target_file" ]; then
        cp "$src_file" "$target_file"
        echo "  ✅ [NEW] $filename"
        SYNCED=$((SYNCED + 1))
    elif ! diff -q "$src_file" "$target_file" > /dev/null 2>&1; then
        cp "$src_file" "$target_file"
        echo "  ✅ [UPD] $filename"
        UPDATED=$((UPDATED + 1))
    fi
done

# Remove question files in target that don't exist in source
for target_file in "$TARGET_DIR/questions/"*.js; do
    filename=$(basename "$target_file")
    if [ ! -f "$SRC_DIR/questions/$filename" ]; then
        rm "$target_file"
        echo "  🗑️  [DEL] $filename"
    fi
done

echo ""
echo "============================================"
echo "  Deploy complete!"
echo "  New files:     $SYNCED"
echo "  Updated files: $UPDATED"
echo "============================================"
echo ""
echo "Next steps:"
echo "  cd $(dirname "$SCRIPT_DIR")/zzbased2.github.io"
echo "  git add -A && git commit -m 'Update brain-teasers' && git push"
