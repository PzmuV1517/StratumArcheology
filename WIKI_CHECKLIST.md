# Wiki Publishing Checklist ✅

Use this checklist to publish the STRATUM wiki to GitHub.

---

## 📋 Pre-Publishing Steps

### 1. Review Content
- [ ] Read through Home.md to ensure it's welcoming
- [ ] Check that _Sidebar.md has all pages listed
- [ ] Verify Getting-Started.md instructions are current
- [ ] Confirm API-Reference.md matches current API
- [ ] Review Roadmap for accuracy

### 2. Check Repository Settings
- [ ] Go to repository Settings on GitHub
- [ ] Scroll to "Features" section
- [ ] Ensure "Wikis" checkbox is **enabled**
- [ ] If not enabled, click to enable it

### 3. Test Locally (Optional)
- [ ] Preview markdown files in VS Code or similar
- [ ] Check for broken links
- [ ] Verify code blocks format correctly
- [ ] Ensure tables render properly

---

## 🚀 Publishing the Wiki

### Method 1: Automated Script (Recommended)

```bash
# From repository root
./wiki/publish-wiki.sh
```

**What it does:**
- Clones the wiki repository
- Copies all markdown files
- Commits and pushes to GitHub
- Cleans up temporary files

**Expected output:**
```
🚀 STRATUM Wiki Publisher
==========================

📦 Step 1: Cloning wiki repository...
✅ Wiki repository cloned

📝 Step 2: Copying wiki files...
   ✓ Copied Home.md
   ✓ Copied _Sidebar.md
   ... (all files)

💾 Step 3: Committing changes...

📤 Step 4: Pushing to GitHub...

✅ SUCCESS! Wiki published to GitHub

🌐 View your wiki at:
   https://github.com/PzmuV1517/QuantumBitsFLL2025-2026/wiki
```

**If you get an error:**
- Check that Wiki is enabled in repository settings
- Verify you have push access to the repository
- Try Method 2 or 3 below

---

### Method 2: Manual Copy

1. Go to https://github.com/PzmuV1517/QuantumBitsFLL2025-2026/wiki
2. Click "Create the first page" or "New Page"
3. For **Home** page:
   - Leave title as "Home"
   - Copy contents of `wiki/Home.md`
   - Paste and click "Save Page"
4. Repeat for each file:
   - Click "New Page"
   - Use filename without .md as title (e.g., "Getting Started" for Getting-Started.md)
   - Copy and paste contents
   - Save
5. For sidebar:
   - Click "Add custom sidebar"
   - Copy contents of `wiki/_Sidebar.md`
   - Save

**Pages to create:**
- Home (already created above)
- Getting Started
- Installation & Setup
- Architecture Overview
- Features Documentation
- API Reference
- Development Guide
- Troubleshooting
- Roadmap & Future Plans
- FAQ

---

### Method 3: Git Clone

```bash
# Clone the wiki repository
git clone https://github.com/PzmuV1517/QuantumBitsFLL2025-2026.wiki.git

# Copy wiki files (exclude README.md and publish-wiki.sh)
cp wiki/Home.md QuantumBitsFLL2025-2026.wiki/
cp wiki/_Sidebar.md QuantumBitsFLL2025-2026.wiki/
cp wiki/Getting-Started.md QuantumBitsFLL2025-2026.wiki/
cp wiki/Installation-\&-Setup.md QuantumBitsFLL2025-2026.wiki/
cp wiki/Architecture-Overview.md QuantumBitsFLL2025-2026.wiki/
cp wiki/Features-Documentation.md QuantumBitsFLL2025-2026.wiki/
cp wiki/API-Reference.md QuantumBitsFLL2025-2026.wiki/
cp wiki/Development-Guide.md QuantumBitsFLL2025-2026.wiki/
cp wiki/Troubleshooting.md QuantumBitsFLL2025-2026.wiki/
cp wiki/Roadmap-\&-Future-Plans.md QuantumBitsFLL2025-2026.wiki/
cp wiki/FAQ.md QuantumBitsFLL2025-2026.wiki/

# Commit and push
cd QuantumBitsFLL2025-2026.wiki
git add .
git commit -m "Add comprehensive STRATUM wiki documentation"
git push origin master

# Cleanup
cd ..
rm -rf QuantumBitsFLL2025-2026.wiki
```

---

## ✅ Post-Publishing Verification

### 1. Check Wiki is Live
- [ ] Visit https://github.com/PzmuV1517/QuantumBitsFLL2025-2026/wiki
- [ ] Verify Home page displays correctly
- [ ] Check that sidebar appears on all pages

### 2. Test Navigation
- [ ] Click links in sidebar
- [ ] Verify all pages load
- [ ] Check cross-reference links between pages
- [ ] Test "Back to Home" links

### 3. Verify Content
- [ ] Images display (if any)
- [ ] Code blocks are syntax highlighted
- [ ] Tables format correctly
- [ ] Emoji render properly
- [ ] Lists are properly formatted

### 4. Test Search
- [ ] Use wiki search feature
- [ ] Search for "installation"
- [ ] Search for "API"
- [ ] Verify results are relevant

---

## 📢 Announce the Wiki

### Internal Team
- [ ] Share wiki link in team chat: https://github.com/PzmuV1517/QuantumBitsFLL2025-2026/wiki
- [ ] Encourage team to review and provide feedback
- [ ] Ask each team member to test the Getting Started guide

### README Update
- [ ] Add wiki link to main README.md:
  ```markdown
  ## 📚 Documentation
  
  Complete documentation available in our [Wiki](https://github.com/PzmuV1517/QuantumBitsFLL2025-2026/wiki):
  - [Getting Started](https://github.com/PzmuV1517/QuantumBitsFLL2025-2026/wiki/Getting-Started)
  - [Features](https://github.com/PzmuV1517/QuantumBitsFLL2025-2026/wiki/Features-Documentation)
  - [API Reference](https://github.com/PzmuV1517/QuantumBitsFLL2025-2026/wiki/API-Reference)
  ```

### Community
- [ ] Announce in GitHub Discussions
- [ ] Share on social media (if applicable)
- [ ] Include in next project update

---

## 🔧 Troubleshooting

### Wiki Not Enabled
**Problem:** Can't access wiki tab  
**Solution:** Go to Settings → Features → Enable "Wikis"

### Permission Denied
**Problem:** Can't push to wiki  
**Solution:** Check you have write access to repository

### Files Not Showing
**Problem:** Pushed files but don't see them  
**Solution:** 
- Check you pushed to correct repository
- Verify files were actually committed (git log)
- Try refreshing the page

### Links Broken
**Problem:** Internal links don't work  
**Solution:** 
- GitHub wiki links should not include .md extension
- Use format: `[Link Text](Page-Name)`
- Spaces become dashes: `Installation & Setup` → `Installation-&-Setup`

### Sidebar Not Appearing
**Problem:** Sidebar doesn't show  
**Solution:**
- File must be named exactly `_Sidebar.md`
- Ensure it's in root of wiki
- Try editing directly on GitHub wiki

---

## 📝 Maintenance Schedule

### Weekly
- [ ] Check for broken links
- [ ] Review and address wiki feedback

### Monthly
- [ ] Update Getting Started if setup process changed
- [ ] Review Troubleshooting for new common issues
- [ ] Update FAQ with new questions

### Quarterly
- [ ] Review entire wiki for outdated information
- [ ] Update Roadmap
- [ ] Add new features to Features Documentation
- [ ] Update API Reference if endpoints changed

### When Releasing New Version
- [ ] Update version numbers
- [ ] Document new features
- [ ] Update screenshots (if any)
- [ ] Add to changelog in Roadmap

---

## 🎯 Success Criteria

Wiki is successful when:
- [ ] Users can set up STRATUM without additional help
- [ ] Developers understand how to contribute
- [ ] API is clear and well-documented
- [ ] Common questions are answered in FAQ
- [ ] Team uses wiki as primary documentation
- [ ] Positive feedback from users
- [ ] Reduced support requests

---

## 📊 Analytics (Optional)

If you enable GitHub Insights:
- Track page views
- Monitor most popular pages
- Identify gaps in documentation

---

## ✅ Final Checklist

Before considering wiki complete:
- [ ] All 11 pages published
- [ ] Sidebar navigation working
- [ ] No broken links
- [ ] All pages reviewed for accuracy
- [ ] Team has reviewed wiki
- [ ] Wiki link added to README
- [ ] Announced to community

---

## 🎉 Completion

Once all items are checked:
- ✅ Wiki is live and ready to use!
- ✅ Users can access comprehensive documentation
- ✅ Project has professional documentation
- ✅ Ready for FLL presentation

---

**Wiki URL:** https://github.com/PzmuV1517/QuantumBitsFLL2025-2026/wiki

**Support:** If you have issues, check `wiki/README.md` or create an issue.

---

*Last updated: November 16, 2024*
