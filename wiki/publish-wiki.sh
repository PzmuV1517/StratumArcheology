#!/bin/bash

# STRATUM Wiki Publisher
# This script publishes the wiki content to GitHub Wiki repository

set -e

WIKI_REPO="https://github.com/PzmuV1517/QuantumBitsFLL2025-2026.wiki.git"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TEMP_DIR=$(mktemp -d)

echo "🚀 STRATUM Wiki Publisher"
echo "=========================="
echo ""

# Check if we're in the wiki directory
if [[ ! -f "$SCRIPT_DIR/Home.md" ]]; then
    echo "❌ Error: This script must be run from the wiki directory"
    echo "   Current directory: $SCRIPT_DIR"
    exit 1
fi

echo "📦 Step 1: Cloning wiki repository..."
if ! git clone "$WIKI_REPO" "$TEMP_DIR" 2>/dev/null; then
    echo "❌ Error: Failed to clone wiki repository"
    echo "   Make sure the wiki is enabled on GitHub:"
    echo "   1. Go to repository Settings"
    echo "   2. Scroll to 'Features' section"
    echo "   3. Enable 'Wikis'"
    exit 1
fi

echo "✅ Wiki repository cloned"
echo ""

echo "📝 Step 2: Copying wiki files..."
# Copy all markdown files except README
for file in "$SCRIPT_DIR"/*.md; do
    filename=$(basename "$file")
    if [[ "$filename" != "README.md" ]]; then
        cp "$file" "$TEMP_DIR/"
        echo "   ✓ Copied $filename"
    fi
done

echo ""
echo "💾 Step 3: Committing changes..."
cd "$TEMP_DIR"

# Configure git if needed
if [[ -z "$(git config user.name)" ]]; then
    git config user.name "STRATUM Wiki Bot"
    git config user.email "wiki@stratum.local"
fi

git add .

# Check if there are changes
if git diff-index --quiet HEAD --; then
    echo "ℹ️  No changes detected - wiki is already up to date"
else
    git commit -m "Update STRATUM wiki documentation

- Complete wiki with 11 pages
- Includes Getting Started, Installation, Features, API Reference
- Development Guide, Troubleshooting, Roadmap, and FAQ
- Professional style with strategic emoji use
- Comprehensive documentation for all project aspects"
    
    echo ""
    echo "📤 Step 4: Pushing to GitHub..."
    if git push origin master; then
        echo ""
        echo "✅ SUCCESS! Wiki published to GitHub"
        echo ""
        echo "🌐 View your wiki at:"
        echo "   https://github.com/PzmuV1517/QuantumBitsFLL2025-2026/wiki"
    else
        echo "❌ Error: Failed to push to GitHub"
        echo "   You may need to authenticate or check permissions"
        exit 1
    fi
fi

# Cleanup
echo ""
echo "🧹 Cleaning up..."
rm -rf "$TEMP_DIR"

echo ""
echo "🎉 Done! Your wiki is now live on GitHub!"
echo ""
echo "📋 Published pages:"
ls -1 "$SCRIPT_DIR"/*.md | grep -v README.md | while read file; do
    echo "   ✓ $(basename "$file" .md)"
done

echo ""
echo "💡 Tips:"
echo "   - Edit files in the wiki/ directory"
echo "   - Run this script again to publish updates"
echo "   - Changes made directly on GitHub won't sync back automatically"
echo ""
