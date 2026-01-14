# 📦 STRATUM – Pull Request

> ⚠️ **IMPORTANT**
> This Pull Request template is **mandatory**.
>  
> Only users listed in **CODEOWNERS** are allowed to bypass or modify this template.
> All other contributors must complete all relevant sections.

---

## 🔗 Related Issue / Task
Link the issue, TODO, or discussion this PR addresses.
- Closes: #
- Related: #

---

## 🧠 Summary
Provide a **clear, concise explanation** of what this PR does.

- What problem does it solve?
- Why was this change necessary?
- Is this a bug fix, feature, refactor, or infra change?

---

## 🧩 Type of Change
Check all that apply:
- [ ] 🐛 Bug fix
- [ ] ✨ New feature
- [ ] ♻️ Refactor / cleanup
- [ ] 🧪 Tests
- [ ] 🧱 Backend (FastAPI / DB / Storage)
- [ ] 📱 Mobile (iOS / Android)
- [ ] 🌐 Web
- [ ] 📦 Infrastructure / Config
- [ ] 📝 Documentation

---

## 📱 Platform Impact
Which platforms are affected?

- [ ] iOS
- [ ] Android
- [ ] Web
- [ ] Backend only
- [ ] Shared (mobile + web)

---

## 🔧 Technical Details
Explain **how** this was implemented.

- Key files changed:
  - `path/to/file.ts`
  - `path/to/file.py`
- New services / hooks / routes added?
- Any architectural decisions worth noting?

---

## 📴 Offline / Sync Considerations  
**(REQUIRED if applicable)**

If this PR affects offline behavior, syncing, or local storage, fill this out:

- [ ] Works fully offline (mobile)
- [ ] Queues changes locally (SQLite / AsyncStorage)
- [ ] Syncs automatically on reconnect
- [ ] Handles app restart while offline
- [ ] Handles conflicts with remote updates

**Conflict resolution strategy:**
- [ ] Remote wins
- [ ] Local wins
- [ ] User chooses (merge prompt)
- [ ] Not applicable

---

## 📂 Files & Storage Impact
- [ ] Affects offline file saving
- [ ] Affects file preview / download
- [ ] Affects file permissions / privacy
- [ ] Affects user personal file system (`/users/{username}`)

Explain any changes to file paths, containers, or permissions.

---

## 🔐 Auth / Security Impact
- [ ] JWT handling changed
- [ ] New protected routes
- [ ] Permission logic updated
- [ ] User data affected

Explain briefly if authentication, roles, or access rules were touched.

---

## 🧪 Testing
Describe how this was tested.

- [ ] iOS Simulator
- [ ] Android Emulator
- [ ] Physical Device
- [ ] Web
- [ ] Backend tests

**Test steps:**
1. …
2. …
3. …

---

## 📸 Screenshots / Videos (UI changes)
Attach screenshots or screen recordings if this affects UI/UX.

---

## ⚠️ Known Issues / Follow-ups
List anything **not fully solved** in this PR.

- Known bugs
- Edge cases
- TODOs for future PRs

---

## ✅ Checklist
Before requesting review, confirm:

- [ ] Code builds and runs locally
- [ ] No breaking changes without discussion
- [ ] Offline logic considered (mobile)
- [ ] No sensitive data committed
- [ ] Code follows project conventions
- [ ] Relevant `TODO.md` items updated (if applicable)

---

## 📝 Additional Notes
Anything else reviewers should know?
Architecture concerns, trade-offs, or future improvements.

---

---

## ⛔ DO NOT EDIT BELOW THIS LINE
**(Reserved for CODEOWNERS / Reviewers only)**

---

## 👀 Reviewer Checklist (CODEOWNERS)
- [ ] Architecture approved
- [ ] Offline & sync logic verified
- [ ] Security / permissions verified
- [ ] UI/UX acceptable on all affected platforms
- [ ] No unintended regressions
- [ ] Ready to merge

---

## 🧠 Reviewer Notes
_(CODEOWNERS only)_

- Concerns:
- Required changes:
- Approval rationale:

---

## 🚦 Merge Decision
_(CODEOWNERS only)_

- [ ] Approved
- [ ] Approved with comments
- [ ] Changes requested
- [ ] Rejected
