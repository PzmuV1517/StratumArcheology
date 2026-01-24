# FAQ - Frequently Asked Questions ❓

Quick answers to common questions about STRATUM.

---

## 🎯 General Questions

### What is STRATUM?

STRATUM is a comprehensive digital platform designed for archaeologists to plan expeditions, document findings, collaborate with teams, and export data efficiently. It replaces traditional paper-based note-taking with a modern, cloud-backed system.

**Think of it as:** Notion + Dropbox + QR codes, specifically built for archaeology.

---

### Is STRATUM free to use?

**Currently:** Yes! STRATUM is completely free and open-source during development and Phase 1.

**Future:** We may introduce:
- Free tier for individuals and small teams
- Paid tiers for institutions with advanced features
- Self-hosted option (always free)

---

### Who created STRATUM?

STRATUM is developed by **Team QuantumBits** for the FIRST LEGO League 2025-2026 UNEARTHED season as an Innovation Project. We're high school students passionate about technology and archaeology!

---

### What does "STRATUM" mean?

**Stratum** (plural: strata) is Latin for "layer." In archaeology and geology, it refers to layers of sediment or material that have accumulated over time. Each stratum represents a distinct period in history - perfect for an archaeological documentation tool!

---

## 🚀 Getting Started

### How do I install STRATUM?

Follow our [Getting Started Guide](Getting-Started) or [Installation & Setup](Installation-&-Setup) for detailed instructions. The quick version:

1. Install prerequisites (Python, Node.js, PostgreSQL, Docker)
2. Set up Firebase project
3. Clone repository and configure environment
4. Start backend and frontend
5. Create your first project!

Takes about 15-20 minutes for first-time setup.

---

### What platforms does STRATUM support?

STRATUM runs on:
- 📱 **iOS** (iPhone and iPad)
- 🤖 **Android** (phones and tablets)
- 🖥️ **Web** (any modern browser)

All from the same codebase thanks to React Native and Expo!

---

### Do I need coding knowledge to use STRATUM?

**No!** End users don't need any coding knowledge. STRATUM is designed to be user-friendly for archaeologists.

**But...** Setting up your own instance currently requires some technical knowledge (or help from someone technical). We're working on making this easier!

---

### Can I use STRATUM offline?

**Currently:** No, STRATUM requires internet connection for most features.

**Coming Soon:** Offline mode is planned for Phase 4, which will include:
- Local data storage
- Background sync
- Offline editing
- Conflict resolution

---

## 🔐 Account & Security

### How do I create an account?

1. Open STRATUM app
2. Tap "Sign Up" or "Register"
3. Enter your email and password
4. Verify email (if enabled)
5. Start using STRATUM!

No credit card or personal information required.

---

### What happens to my data?

Your data is:
- 🔒 **Encrypted in transit** (HTTPS)
- 💾 **Stored securely** (PostgreSQL + MinIO)
- ☁️ **Backed up** (if you configure backups)
- 🔑 **Private by default** (only accessible to you and team members you invite)

We do **NOT**:
- ❌ Sell your data
- ❌ Share with third parties
- ❌ Use for advertising
- ❌ Mine for training AI (without permission)

---

### Can I delete my account?

**Currently:** Contact your instance administrator.

**Planned:** Self-service account deletion with:
- Export all your data first
- Remove personal information
- Transfer project ownership or delete projects

---

### How secure is STRATUM?

Security features:
- 🔥 **Firebase Authentication** (Google-scale security)
- 🔐 **JWT tokens** for API access
- 🔒 **Role-based permissions**
- 🛡️ **SQL injection prevention**
- 🌐 **CORS restrictions**
- 📦 **Presigned URLs** (time-limited file access)

We follow security best practices and regularly update dependencies.

---

## 👥 Collaboration

### How many people can work on a project?

**Technically:** Unlimited!

**Practically:** We recommend keeping teams under 50 people per project for optimal performance. For larger expeditions, consider splitting into multiple projects.

---

### What are the different user roles?

| Role | Can View | Can Edit | Can Upload | Can Manage Team |
|------|----------|----------|------------|-----------------|
| **Owner** | ✅ Everything | ✅ Everything | ✅ Yes | ✅ Full control |
| **Leader** | ✅ Everything | ✅ Everything | ✅ Yes | ✅ Except owner |
| **Researcher** | ✅ Everything | ✅ Own content | ✅ Yes | ❌ No |
| **Guest** | ✅ Everything | ❌ No | ❌ No | ❌ No |

---

### Can I change someone's role?

**Yes!** Project owners and leaders can change roles:
1. Go to project
2. Open Team tab
3. Find member
4. Select new role

**Note:** You cannot change the project owner (transfer ownership coming soon).

---

### How do I remove someone from a project?

1. Go to project
2. Open Team tab
3. Find member
4. Tap "Remove" or swipe to delete
5. Confirm

Only owners and leaders can remove members. The project owner cannot be removed.

---

## 📝 Notes & Documentation

### What format are notes stored in?

Notes are stored as:
- **Plain text** in the database
- **Markdown** supported for formatting
- **Photos** stored separately in MinIO

This ensures:
- Fast search
- Future-proof format
- Easy export
- Long-term preservation

---

### Can I format my notes?

**Yes!** STRATUM supports **Markdown** formatting:

```markdown
# Heading
## Subheading

**Bold text**
*Italic text*

- Bullet list
- Item 2

1. Numbered list
2. Item 2

[Link text](https://url.com)
![Image](image.jpg)

```code block```

Math: $E = mc^2$
```

---

### How many photos can I attach to a note?

**No limit!** Attach as many photos as you need.

**However:**
- Each file has size limits (usually 10-100MB depending on configuration)
- Consider project storage quotas
- Lots of photos may slow down loading

**Best practice:** Use the Files system for bulk photo storage, and attach only key images to notes.

---

### Can I edit notes after creating them?

**Yes!** Notes can be edited by:
- The note author
- Project leaders
- Project owner

**Version history** (planned) will track all changes.

---

## 📂 Files & Storage

### What file types are supported?

STRATUM supports **20+ file formats**:

**Images:** JPG, PNG, GIF, WebP, HEIC  
**Documents:** PDF, TXT, MD  
**Data:** CSV, XLS, XLSX, JSON  
**3D:** PLY, LAS, LAZ, OBJ, GLB, GLTF  
**Video:** MP4, WebM, MOV, OGG  
**GIS:** SHP (shapefiles)

More formats coming in future phases!

---

### How much storage do I get?

**Default:** Depends on your MinIO configuration (unlimited in local development).

**Planned tiers:**
- Free: 10GB per project
- Pro: 100GB per project
- Enterprise: Unlimited

**Current:** Configure your own limits in MinIO.

---

### Can I download all my files?

**Yes!** You can:
- Download individual files
- Download folders (coming soon)
- Export entire project (API or bulk download)

Files are stored in standard formats for easy use elsewhere.

---

### Are my files backed up?

**Depends on your setup:**

**Local development:** Not backed up (use git or manual backups)

**Self-hosted:** You're responsible for backups
- Use MinIO backup tools
- PostgreSQL backups (pg_dump)
- Regular snapshots

**Planned cloud service:** Automatic backups included

---

## 🏺 Artifacts

### What are QR codes used for?

QR codes link physical artifacts to their digital documentation:

1. Create artifact in STRATUM
2. Generate QR code
3. Print and attach to artifact bag/box
4. Anyone can scan to see:
   - Photos of the artifact
   - Documentation notes
   - Context information
   - Related files

**Use cases:**
- Storage organization
- Museum displays
- Public outreach
- Teaching
- Research collaboration

---

### Can I generate QR codes in bulk?

**Current:** One at a time

**Planned:** Batch QR generation
- Generate for multiple artifacts
- Print sheets of QR codes
- Custom templates
- CSV import

---

## 🔧 Technical Questions

### What technology is STRATUM built with?

**Backend:**
- Python 3.9+ with FastAPI
- PostgreSQL (database)
- MinIO (file storage)
- Firebase (authentication)

**Frontend:**
- React Native with Expo
- TypeScript
- Expo Router (navigation)

See [Architecture Overview](Architecture-Overview) for details.

---

### Can I self-host STRATUM?

**Yes!** STRATUM is open-source and can be self-hosted:

**Requirements:**
- Linux/macOS/Windows server
- Python 3.9+
- PostgreSQL 14+
- MinIO or S3-compatible storage
- Firebase project (for auth)

**Benefits:**
- Full control over data
- Unlimited storage (your hardware)
- Customize as needed
- No recurring costs

**Drawbacks:**
- You manage updates
- You handle backups
- You ensure security
- Requires technical knowledge

---

### Does STRATUM have an API?

**Yes!** STRATUM has a comprehensive REST API.

**Documentation:**
- [API Reference](API-Reference) in this wiki
- Interactive Swagger UI at `/docs`
- All features accessible via API

**Use cases:**
- Custom integrations
- Automation scripts
- Data analysis tools
- Third-party apps

---

### Can I contribute to STRATUM?

**Absolutely!** We welcome contributions:

**Ways to contribute:**
- 💻 Code (features, bug fixes)
- 🐛 Bug reports
- 📝 Documentation
- 🎨 UI/UX design
- 💡 Feature ideas
- 🧪 Testing
- 🌍 Translations

See [Development Guide](Development-Guide) to get started!

---

### What license is STRATUM under?

Check the `LICENSE` file in the repository. We aim for an open-source license that allows:
- ✅ Free use
- ✅ Modification
- ✅ Distribution
- ✅ Commercial use (with attribution)

---

## 🌍 Field Use

### Can I use STRATUM in remote locations?

**Currently:** Requires internet connection for most features.

**Tips for remote use:**
1. **Document offline:** Take notes on paper/phone, upload when back to WiFi
2. **Sync at base camp:** Upload at end of day when you have connection
3. **Use mobile hotspot:** If you have cellular signal
4. **Local server:** Set up STRATUM on local network at base camp

**Coming:** True offline mode in Phase 4!

---

### Will STRATUM work on my older phone?

**Minimum requirements:**
- iOS 13+ (iPhone 6S and newer)
- Android 5.0+ (Lollipop)
- 2GB RAM
- 500MB free storage

**Recommended:**
- iOS 15+ / Android 10+
- 4GB+ RAM
- Modern processor

Older devices may work but could be slower.

---

### Can I use STRATUM without a smartphone?

**Yes!** STRATUM works in any modern web browser:
- Chrome
- Firefox
- Safari
- Edge

Access from laptop or tablet without installing an app.

---

## 📊 Data & Export

### Can I export my data?

**Yes!** Multiple export options:

**Current:**
- Individual file downloads
- API access to all data
- Database dumps (SQL)

**Planned:**
- PDF reports
- CSV data export
- Word documents
- Complete project archives

---

### What format is exported data?

Data exports use **standard, open formats**:
- **Notes:** JSON or Markdown
- **Metadata:** JSON or CSV
- **Photos:** Original formats (JPG, PNG, etc.)
- **Database:** SQL dumps

No proprietary formats! Your data remains accessible forever.

---

### Can I import data from other systems?

**Currently:** Limited

**Planned:**
- CSV import for bulk data
- Photo bulk upload
- API for custom imports
- Migration tools from other platforms

---

## 💰 Pricing & Availability

### When will STRATUM be available?

**Now!** Phase 1 is complete and available as open-source software.

**To use:**
1. Self-host (free, requires technical setup)
2. Wait for hosted service (coming soon)

---

### Will there be a hosted version?

**Yes!** We're planning a hosted service so you don't need to manage servers.

**Target:** Late 2024 / Early 2025

**Benefits:**
- No setup required
- Automatic updates
- Professional backups
- Technical support

---

### How much will it cost?

**Planned pricing** (not final):

- **Free tier:** Personal use, small teams
- **Pro tier:** ~$10/month per user for advanced features
- **Enterprise:** Custom pricing for institutions

**Always free:**
- Self-hosted version
- Core features
- API access

---

## 🆘 Help & Support

### I found a bug! What should I do?

1. Check [Troubleshooting Guide](Troubleshooting)
2. Search [existing issues](https://github.com/PzmuV1517/QuantumBitsFLL2025-2026/issues)
3. If new bug, [create an issue](https://github.com/PzmuV1517/QuantumBitsFLL2025-2026/issues/new) with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots
   - Error messages
   - Your setup details

---

### How do I request a feature?

**We love feature requests!**

1. Check [Roadmap](Roadmap-&-Future-Plans) - might already be planned
2. Search [discussions](https://github.com/PzmuV1517/QuantumBitsFLL2025-2026/discussions)
3. [Start a discussion](https://github.com/PzmuV1517/QuantumBitsFLL2025-2026/discussions/new) or [open an issue](https://github.com/PzmuV1517/QuantumBitsFLL2025-2026/issues/new)

Include:
- Use case (what are you trying to do?)
- Why it's important
- Suggested implementation (optional)

---

### Where can I get help?

**Documentation:**
- 📖 [This wiki](Home) - Comprehensive guides
- 🚀 [Getting Started](Getting-Started) - Setup help
- 🔧 [Troubleshooting](Troubleshooting) - Common issues

**Community:**
- 💬 [GitHub Discussions](https://github.com/PzmuV1517/QuantumBitsFLL2025-2026/discussions) - Q&A
- 🐛 [GitHub Issues](https://github.com/PzmuV1517/QuantumBitsFLL2025-2026/issues) - Bugs

**Direct:**
- 📧 Email team (check repository for contact)

---

### Is there a user manual?

**Yes!** This entire wiki serves as the user manual:

- [Getting Started](Getting-Started) - Basics
- [Features Documentation](Features-Documentation) - What you can do
- [Installation & Setup](Installation-&-Setup) - Detailed setup

**Coming soon:**
- Video tutorials
- Interactive demos
- Quick reference cards

---

## 🎓 Educational Use

### Can I use STRATUM for teaching?

**Absolutely!** STRATUM is great for:
- Archaeological field schools
- University courses
- Museum education programs
- High school STEM projects
- Hands-on learning

**Benefits:**
- Students learn modern tools
- Practice professional workflows
- Collaborate on projects
- Build portfolios

---

### Are there educational discounts?

**Currently:** It's free!

**Future:** Educational institutions will likely get special pricing or free access to hosted service.

---

## 🌟 FLL & Innovation Project

### Is this really made by high school students?

**Yes!** Team QuantumBits are high school students participating in FIRST LEGO League (FLL) 2025-2026 UNEARTHED season.

STRATUM is our Innovation Project - a real solution to a real problem faced by archaeologists.

---

### Can I use STRATUM for my FLL project?

**Of course!** STRATUM is open-source. You can:
- Use it as inspiration
- Learn from the code
- Build something similar
- Focus on a different aspect of archaeology

**But remember:** FLL values your own original work and problem-solving!

---

### How do you present this at competitions?

**Key points we highlight:**
1. **The problem:** Archaeologists need better documentation tools
2. **Our solution:** STRATUM - modern, digital, collaborative
3. **It works:** Live demo of features
4. **It's real:** Used by actual archaeologists (or will be!)
5. **It's scalable:** Cloud-based, cross-platform, future-proof

---

## 🔮 Future

### What's next for STRATUM?

Check our detailed [Roadmap](Roadmap-&-Future-Plans)!

**Highlights:**
- **Phase 2:** GPS mapping, task management
- **Phase 3:** AI features, LiDAR, voice notes
- **Phase 4:** Offline mode, real-time collaboration

---

### Will STRATUM always be free?

**The code:** Yes, always open-source.

**Hosted service:** Will have free and paid tiers.

**Self-hosting:** Always free (you just pay for your servers).

Our mission is to help archaeology, not maximize profit!

---

### How can I stay updated?

- ⭐ [Star on GitHub](https://github.com/PzmuV1517/QuantumBitsFLL2025-2026)
- 👀 Watch repository for releases
- 💬 Join [Discussions](https://github.com/PzmuV1517/QuantumBitsFLL2025-2026/discussions)
- 📢 Follow our social media (links in repository)

---

## ❓ Didn't Find Your Answer?

**Still have questions?**

1. 📖 Search this wiki
2. 💬 Check [GitHub Discussions](https://github.com/PzmuV1517/QuantumBitsFLL2025-2026/discussions)
3. 🐛 Browse [closed issues](https://github.com/PzmuV1517/QuantumBitsFLL2025-2026/issues?q=is%3Aissue+is%3Aclosed)
4. ✉️ [Ask a new question](https://github.com/PzmuV1517/QuantumBitsFLL2025-2026/discussions/new)

We're here to help! 🤝

---

<div align="center">

**Found this helpful? Consider contributing to make STRATUM even better!**

[← Roadmap](Roadmap-&-Future-Plans) | [Home](Home)

</div>
