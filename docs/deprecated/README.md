# STRATUM Wiki Documentation

This directory contains the complete GitHub Wiki for the STRATUM project.

## 📚 Wiki Pages

All wiki pages are written in Markdown and ready to be used with GitHub Wiki:

1. **Home.md** - Main landing page for the wiki
2. **_Sidebar.md** - Navigation sidebar (appears on all pages)
3. **Getting-Started.md** - Quick setup guide
4. **Installation-&-Setup.md** - Comprehensive installation instructions
5. **Architecture-Overview.md** - Technical architecture and design
6. **Features-Documentation.md** - Complete feature catalog
7. **API-Reference.md** - REST API documentation
8. **Development-Guide.md** - Contributing and development workflow
9. **Troubleshooting.md** - Common issues and solutions
10. **Roadmap-&-Future-Plans.md** - Future development plans
11. **FAQ.md** - Frequently asked questions

## 🚀 How to Publish to GitHub Wiki

### Option 1: Direct Copy (Manual)

1. Go to your repository on GitHub
2. Click on the "Wiki" tab
3. For each file in this directory:
   - Click "New Page" or edit existing page
   - Copy the filename (without .md extension) as the page title
   - Copy the file contents
   - Paste and save
4. The `_Sidebar.md` will automatically create the sidebar

### Option 2: Clone Wiki Repository

GitHub wikis are actually Git repositories! You can clone and push directly:

```bash
# Clone the wiki repository
git clone https://github.com/PzmuV1517/QuantumBitsFLL2025-2026.wiki.git

# Copy all wiki files
cp wiki/*.md QuantumBitsFLL2025-2026.wiki/

# Commit and push
cd QuantumBitsFLL2025-2026.wiki
git add .
git commit -m "Add comprehensive STRATUM wiki documentation"
git push origin master
```

### Option 3: Using a Script

Create a script to automate the process:

```bash
#!/bin/bash
# publish-wiki.sh

WIKI_REPO="https://github.com/PzmuV1517/QuantumBitsFLL2025-2026.wiki.git"
TEMP_DIR=$(mktemp -d)

# Clone wiki
git clone "$WIKI_REPO" "$TEMP_DIR"

# Copy files
cp wiki/*.md "$TEMP_DIR/"

# Push changes
cd "$TEMP_DIR"
git add .
git commit -m "Update wiki documentation"
git push origin master

# Cleanup
rm -rf "$TEMP_DIR"

echo "Wiki updated successfully!"
```

## 📝 Editing the Wiki

### Locally

1. Edit the `.md` files in this directory
2. Preview changes (use any Markdown previewer)
3. Commit changes to main repository
4. Publish to GitHub Wiki using one of the methods above

### On GitHub

1. Navigate to Wiki tab
2. Click "Edit" on any page
3. Make changes
4. Save

**Note:** Changes made directly on GitHub Wiki won't sync back to this directory automatically.

## 🔗 Wiki Links

Links between wiki pages use this format:
```markdown
[Link Text](Page-Name)
```

For example:
```markdown
[Getting Started](Getting-Started)
[API Reference](API-Reference)
```

GitHub automatically converts these to work in the wiki.

## 🎨 Style Guide

The wiki follows these conventions:

- **Emojis**: Used strategically for visual interest, not excessively
- **Headers**: Clear hierarchy (H1 → H2 → H3)
- **Code blocks**: Syntax highlighted with language specifiers
- **Lists**: Bulleted and numbered for easy scanning
- **Tables**: For structured information
- **Callouts**: Using blockquotes for important notes
- **Tone**: Professional but approachable

## 📊 Wiki Statistics

- **Total Pages**: 11
- **Total Characters**: ~145,000
- **Estimated Reading Time**: 2-3 hours for complete wiki
- **Lines of Code Examples**: 500+
- **Cross-references**: 50+

## 🔄 Maintenance

### Regular Updates

- Update Getting Started if installation process changes
- Update Features Documentation when new features are added
- Update API Reference when endpoints change
- Update Roadmap quarterly
- Review Troubleshooting based on common issues
- Update FAQ based on user questions

### Version Tracking

Consider adding version numbers to wiki pages:
```markdown
*Last updated: January 2024 | Version 1.0*
```

## 🤝 Contributing to Wiki

To improve the wiki:

1. Edit files in this directory
2. Create a pull request
3. After merge, publish to GitHub Wiki
4. Or suggest improvements in Issues/Discussions

## 📱 Wiki Features

GitHub Wiki supports:
- ✅ Markdown formatting
- ✅ Code syntax highlighting
- ✅ Tables and lists
- ✅ Images (upload or link)
- ✅ Internal linking
- ✅ Sidebar navigation
- ✅ Search functionality
- ✅ Revision history
- ✅ Page hierarchy
- ✅ Clone/fork capability

## 🎯 Best Practices

1. **Keep pages focused** - Each page covers one topic well
2. **Cross-reference** - Link to related pages
3. **Update regularly** - Keep information current
4. **Test links** - Verify all internal links work
5. **Be consistent** - Follow naming and style conventions
6. **Include examples** - Code snippets and screenshots
7. **Mobile-friendly** - Test readability on small screens

## 🆘 Troubleshooting

### Links Not Working

Ensure page names match exactly (case-sensitive):
```markdown
✅ [Getting Started](Getting-Started)
❌ [Getting Started](getting-started)
```

### Sidebar Not Showing

The `_Sidebar.md` file must be named exactly `_Sidebar.md` (with underscore and capital S).

### Images Not Loading

If using local images, upload them to the wiki repository or use hosted URLs.

## 📚 Additional Resources

- [GitHub Wiki Documentation](https://docs.github.com/en/communities/documenting-your-project-with-wikis)
- [Markdown Guide](https://www.markdownguide.org/)
- [GitHub Flavored Markdown](https://github.github.com/gfm/)

---

**Built with ❤️ by Team QuantumBits for STRATUM**
