"""
STRATUM AI Prompt Library.

Naming convention:  PROMPT_<DOMAIN>_<TASK>

  DOMAIN - the entity the prompt operates on:
    PROJECT  - project-level operations
    NOTE     - field notes / documents
    ARTEFACT - physical finds / artefacts
    SITE     - excavation site-wide analysis
    MEMBER   - team / personnel

  TASK   - what the AI is asked to produce:
    SUMMARY  - concise status overview (short, 3–5 sentences)
    ANALYSIS - deeper analytical breakdown (medium length)
    CLASSIFY - categorise or label an item
    DESCRIBE - natural-language description of an item
    SUGGEST  - proposed next steps / recommendations

Usage:
  from app.ai_prompts import PROMPT_PROJECT_SUMMARY
  prompt = PROMPT_PROJECT_SUMMARY.format(project_name="Site A", ...)

All placeholders are documented inline above each constant.
"""

# ---------------------------------------------------------------------------
# PROMPT_PROJECT_SUMMARY
#
# Placeholders:
#   project_name    str  - display name of the project
#   lmi_line        str  - "LMI Code: <id>\n" or "" if not set
#   description     str  - project description or fallback text
#   member_count    int  - number of team members
#   visibility      str  - "Public" or "Private"
#   note_count      int  - total notes included below
#   notes_text      str  - newline-separated note summaries
#   activity_count  int  - total activities included below
#   activities_text str  - newline-separated activity descriptions
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
    "Write a concise professional summary (3 to 5 sentences) of this archaeological "
    "project's current status. Focus on what work has been done, what the team has "
    "documented, and overall excavation progress. Do not reference specific user IDs "
    "or technical system details. Write as if briefing the project leader.\n\n"
    "Rules:\n"
    "- Do NOT use em dashes or en dashes; use commas instead\n"
    "- Prioritise clarity and concision; do not pad with filler\n"
    "- Markdown is rendered in the UI, so use it where it helps (lists, emphasis)"
)

# ---------------------------------------------------------------------------
# PROMPT_SITE_HISTORY
#
# Generates a rich, public-facing narrative about what happened at the site.
# Written for a general audience, like a museum display or Wikipedia entry.
#
# Placeholders:
#   project_name    str  - display name of the project / site
#   lmi_line        str  - "LMI Code: <id>\n" or "" if not set
#   description     str  - project description or fallback text
#   created_at      str  - project creation date (human-readable)
#   member_count    int  - number of team members
#   note_count      int  - total notes included below
#   notes_text      str  - newline-separated note title + excerpt pairs
#   activity_count  int  - total activities included below
#   activities_text str  - newline-separated activity descriptions
# ---------------------------------------------------------------------------
PROMPT_SITE_HISTORY = (
    "You are a historian and science communicator writing for the public-facing page "
    "of an archaeological site. Your task is to write a compelling, newspaper-style "
    "feature about this excavation, based on the field data provided.\n\n"
    "Site: {project_name}\n"
    "{lmi_line}"
    "Description: {description}\n"
    "Excavation started: {created_at}\n"
    "Team size: {member_count} researcher(s)\n\n"
    "Field notes ({note_count} total):\n{notes_text}\n\n"
    "Site activity log ({activity_count} events):\n{activities_text}\n\n"
    "Structure your response as follows - all Markdown will be fully rendered in the "
    "UI, so use it liberally:\n\n"
    "**1. Narrative body**\n"
    "Write 5 to 8 paragraphs (approx. 400-600 words) divided by `## Section Headings`. "
    "Cover: the site's historical context and significance, what the team set out to "
    "investigate, key discoveries and documented findings, observed patterns and their "
    "meaning, and the broader importance of the work.\n\n"
    "**2. Pull quotes**\n"
    "Use `> blockquote` formatting 1-2 times within the narrative to call out the "
    "single most striking finding or moment as a pull quote (1-2 sentences max). "
    "Place them naturally between paragraphs for visual rhythm.\n\n"
    "Formatting rules:\n"
    "- Use **bold** for key finds, site names, and important dates\n"
    "- Use `## Headings` to divide narrative sections\n"
    "- Use `---` as a section divider between major parts\n"
    "- Use bullet lists when enumerating multiple discoveries\n"
    "- Do NOT use em dashes or en dashes; use commas instead\n"
    "- Write in an accessible, engaging style, like a printed newspaper or museum "
    "exhibit panel, not an academic paper\n"
    "- Do not reference user IDs, system events (joined project, uploaded file), or "
    "technical platform details or basic details about the project since those are included by the platform itself below the History Review\n"
    "- Do not invent facts; if data is sparse, write thoughtfully about what the "
    "available evidence suggests"
)
