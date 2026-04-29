"""
STRATUM AI Prompt Library.

Naming convention:  PROMPT_<DOMAIN>_<TASK>

  DOMAIN  — the entity the prompt operates on:
    PROJECT   — project-level operations
    NOTE      — field notes / documents
    ARTEFACT  — physical finds / artefacts
    SITE      — excavation site-wide analysis
    MEMBER    — team / personnel

  TASK    — what the AI is asked to produce:
    SUMMARY   — concise status overview (short, 3–5 sentences)
    ANALYSIS  — deeper analytical breakdown (medium length)
    CLASSIFY  — categorise or label an item
    DESCRIBE  — natural-language description of an item
    SUGGEST   — proposed next steps / recommendations

Usage:
  from app.ai_prompts import PROMPT_PROJECT_SUMMARY
  prompt = PROMPT_PROJECT_SUMMARY.format(project_name="Site A", ...)

All placeholders are documented inline above each constant.
"""

# ---------------------------------------------------------------------------
# PROMPT_PROJECT_SUMMARY
#
# Placeholders:
#   project_name    str   — display name of the project
#   lmi_line        str   — "LMI Code: <id>\n" or "" if not set
#   description     str   — project description or fallback text
#   member_count    int   — number of team members
#   visibility      str   — "Public" or "Private"
#   note_count      int   — total notes included below
#   notes_text      str   — newline-separated note summaries
#   activity_count  int   — total activities included below
#   activities_text str   — newline-separated activity descriptions
# ---------------------------------------------------------------------------
PROMPT_PROJECT_SUMMARY = (
    "You are an AI assistant for STRATUM, an archaeological site management platform.\n\n"
    "Project: {project_name}\n"
    "{lmi_line}"
    "Description: {description}\n"
    "Team size: {member_count} member(s)\n"
    "Visibility: {visibility}\n\n"
    "Recent field notes ({note_count} total):\n{notes_text}\n\n"
    "Recent activity ({activity_count} events):\n{activities_text}\n\n"
    "Write a concise professional summary (3–5 sentences) of this archaeological "
    "project's current status. Focus on what work has been done, what the team has "
    "documented, and overall excavation progress. Do not reference specific user IDs "
    "or technical system details. Write as if briefing the project leader."
    "DO NOT USE EM DASHES UNDER NO CIRCUMSTANCES. USE COMMAS INSTEAD."
    "DO NOT ADD USELSS INFORMATION OR BALBBER. PRIORATISE CLARITY AND CONCISENESS"
    "If needed use MD notatin because it is supported and will be rendered in the UI (e.g. for lists or emphasis)"
)
