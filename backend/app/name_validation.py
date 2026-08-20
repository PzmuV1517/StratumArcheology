"""
Human-name and username validation for STRATUM signup.

Two public entry points:

- ``validate_display_name`` - the strict "does this look like a real person's
  name?" check. Applied to the ``display_name`` a user chooses at signup /
  profile edit. Rejects profanity (any language), Morse code, ASCII art /
  symbol soup, digits, keyboard mashing and other gibberish that no real name
  would contain.

- ``validate_username`` - the lenient check. A username is allowed to be a
  handle rather than a real name, so it is only rejected when it contains a
  derogatory / profane term (in any language).

Both raise :class:`NameValidationError` on failure. The message always points
the user at the manual-account contact address so a false positive never fully
locks a genuine person out.

MIT License

Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""

import re
import unicodedata

# Address a rejected user should write to for a manually created account.
CONTACT_EMAIL = "contact@stratumarcheology.com"
_CONTACT_HINT = (
    f" If you believe this is a mistake, please contact {CONTACT_EMAIL} "
    "to request an account with your details."
)


class NameValidationError(Exception):
    """Raised when a name / username fails validation.

    ``message`` already includes the contact hint and is safe to surface to the
    end user.
    """

    def __init__(self, reason: str):
        self.message = reason + _CONTACT_HINT
        super().__init__(self.message)


# ---------------------------------------------------------------------------
# Profanity / derogatory term detection (language-agnostic)
# ---------------------------------------------------------------------------

# Leetspeak / homoglyph folding so "f4ck", "sh1t", "@ss" etc. are caught.
_LEET_MAP = str.maketrans(
    {
        "0": "o",
        "1": "i",
        "3": "e",
        "4": "a",
        "5": "s",
        "6": "g",
        "7": "t",
        "8": "b",
        "9": "g",
        "@": "a",
        "$": "s",
        "!": "i",
        "|": "i",
        "€": "e",
        "£": "l",
    }
)

# Strong obscenities / slurs. Matched as a *substring* of the whole collapsed
# (letters-only) form, so obfuscations like "f.u.c.k", "you_are_a_fuck" and
# "f u c k" are all caught. Kept to terms that essentially never appear inside a
# genuine name, to avoid the "Scunthorpe problem".
_SUBSTRING_BLOCK = {
    # English
    "fuck",
    "shit",
    "bitch",
    "cunt",
    "whore",
    "slut",
    "bastard",
    "asshole",
    "dickhead",
    "motherfuck",
    "nigger",
    "nigga",
    "faggot",
    "retard",
    "wanker",
    "bollocks",
    "pussy",
    "cock",
    "dildo",
    "coon",
    "chink",
    "spic",
    "kike",
    "twat",
    "pedophile",
    "rapist",
    # Spanish / Portuguese
    "puta",
    "puto",
    "mierda",
    "cabron",
    "pendejo",
    "coño",
    "cono",
    "caralho",
    "merda",
    "porra",
    "buceta",
    # French
    "merde",
    "putain",
    "salope",
    "connard",
    "encule",
    "pute",
    # German
    "scheisse",
    "scheiss",
    "arschloch",
    "fotze",
    "hurensohn",
    "wichser",
    # Italian
    "stronzo",
    "cazzo",
    "vaffanculo",
    "troia",
    "puttana",
    # Romanian (home language of the team - moderated carefully).
    # Strong vulgarities + slurs, matched anywhere. Accent-folding means the
    # diacritic spellings (pizdă, căcat, curvă, pulă, muișt, țigan…) all map
    # onto these ASCII forms before matching.
    "pizda",
    "pizde",
    "pizdulice",
    "pizdit",
    "muie",
    "muist",
    "cacat",
    "cacacios",
    "futu",
    "fututi",
    "futere",
    "curva",
    "curve",
    "curvar",
    "coaie",
    "pula",
    "pule",
    "poponar",
    "gaozar",
    "pederast",
    "bulangiu",
    "sugaci",
    "bozgor",  # ethnic slur (Hungarians)
    # Russian (transliterated)
    "suka",
    "blyat",
    "pizdec",
    "yebat",
    "mudak",
    # Arabic / Turkish (transliterated)
    "sharmuta",
    "kahba",
    "orospu",
    "amina",
    # Hindi (transliterated)
    "chutiya",
    "madarchod",
    "bhenchod",
    "randi",
    # Generic hate / harassment
    "nazi",
    "hitler",
    "rape",
    "kill",
}

# Milder or short terms that DO occur inside legitimate names ("ass" in
# "Cassandra", "hell" in "Michelle"). Matched only as a *whole token* so those
# names survive.
_WORD_BLOCK = {
    "ass",
    "damn",
    "hell",
    "crap",
    "dick",
    "piss",
    "tit",
    "tits",
    "hoe",
    "fag",
    "gay",  # blocked only as a standalone insult token, not inside a name
    "sex",
    "porn",
    "anus",
    "penis",
    "vagina",
    "boob",
    "boobs",
    "idiot",
    "cretin",
    "imbecil",
    "dumb",
    "stupid",
    "loser",
    # Romanian - milder insults and short words that can collide with real
    # surnames (e.g. "porc" in nothing common, but "cur" in "Curtea"), so only
    # blocked as a standalone token, never inside a longer name.
    "prostituata",
    "prost",  # stupid
    "prostanac",
    "prostovan",
    "tampit",  # tâmpit - moron
    "dobitoc",
    "handicapat",
    "nesimtit",
    "nemernic",
    "jeg",  # filth
    "jegos",
    "gunoi",  # trash
    "ratat",  # loser
    "fraier",  # sucker
    "porc",  # pig (insult)
    "cur",  # arse
    "fut",  # verb form of the f-word
    "fute",
    "laba",  # masturbation slang
    "suge",  # suck (imperative insult)
    "sugi",  # you suck
    "scarba",  # scârbă - disgust / scumbag
    "tigan",  # țigan - ethnic slur (Roma)
    "tiganca",
    "admin",
    "root",
    "moderator",
    "support",
    "official",
    "stratum",  # reserve brand-impersonation handles
}


def _fold(text: str) -> str:
    """Lowercase, strip accents and apply leet folding - no length change of
    meaningful letters, non-letters preserved for tokenisation."""
    text = text.lower().translate(_LEET_MAP)
    # Decompose accents (é -> e) and drop the combining marks.
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    return text


def contains_profanity(text: str) -> bool:
    """True if ``text`` contains a derogatory / profane term in any supported
    language, allowing for accents, leetspeak and separator obfuscation."""
    folded = _fold(text)

    # Collapse to letters only and scan for strong terms as substrings.
    collapsed = re.sub(r"[^a-z]", "", folded)
    for bad in _SUBSTRING_BLOCK:
        if bad in collapsed:
            return True

    # Whole-token scan for the false-positive-prone shorter terms.
    tokens = re.split(r"[^a-z]+", folded)
    for token in tokens:
        if token in _WORD_BLOCK:
            return True

    return False


# ---------------------------------------------------------------------------
# Reserved terms + secret override
# ---------------------------------------------------------------------------

# Terms treated exactly like banned content: any name / username containing one
# is rejected, UNLESS the input was unlocked with the override prefix below.
# Matched as a substring of the collapsed (leet-/accent-folded, letters-only)
# form, so "Banu", "b4nu", "Bănu" and "xbanux" are all caught.
_RESERVED = {"banu"}

# The single exception. A value prefixed with this token is allowed to contain
# a reserved term; the prefix is stripped and the remainder becomes the actual
# name / username. Matched case-insensitively at the very start of the input.
OVERRIDE_PREFIX = "/regelebanu"


def strip_override(raw: str) -> tuple[str, bool]:
    """Detect and strip the reserved-name override prefix.

    Returns ``(remainder, unlocked)``. When ``raw`` starts with
    :data:`OVERRIDE_PREFIX` (case-insensitive, leading/trailing whitespace
    ignored), the prefix is removed and ``unlocked`` is True. Otherwise the
    input is returned unchanged with ``unlocked`` False.
    """
    if not raw:
        return raw, False
    lead = raw.lstrip()
    if lead.lower().startswith(OVERRIDE_PREFIX.lower()):
        return lead[len(OVERRIDE_PREFIX) :].lstrip(), True
    return raw, False


def contains_reserved(text: str) -> bool:
    """True if ``text`` contains a reserved term (leet/accent/separator aware)."""
    collapsed = re.sub(r"[^a-z]", "", _fold(text))
    return any(term in collapsed for term in _RESERVED)


# ---------------------------------------------------------------------------
# "Looks like a real person's name?" heuristics
# ---------------------------------------------------------------------------

# Characters allowed in a human name besides Unicode letters: intra-name space,
# hyphen, apostrophe variants and a period (initials like "J.").
_NAME_PUNCT = {" ", "-", "'", "’", "ʼ", "`", ".", "·"}
_VOWELS = set("aeiouy")

_MIN_LEN = 2
_MAX_LEN = 60
_MAX_WORDS = 6


def _is_morse(raw: str) -> bool:
    """A string built only from dots, dashes, slashes and spaces (and holding
    at least one dot/dash) is Morse code, not a name."""
    if not re.fullmatch(r"[.\-/ ]+", raw):
        return False
    return ("." in raw) or ("-" in raw)


def validate_display_name(raw: str) -> str:
    """Validate and return a cleaned real-person display name.

    Raises :class:`NameValidationError` (with the contact hint) when the value
    is profane, Morse code, symbol/ASCII soup, contains digits, contains a
    reserved term, or otherwise does not resemble a genuine human name.

    A reserved term (see :data:`_RESERVED`) is allowed only when the input is
    prefixed with :data:`OVERRIDE_PREFIX`; the prefix is then stripped and the
    remainder is validated as the real name.
    """
    if raw is None:
        raise NameValidationError("A name is required.")

    raw, unlocked = strip_override(raw)

    name = unicodedata.normalize("NFC", raw).replace("\x00", "").strip()
    # Collapse internal whitespace runs to single spaces.
    name = re.sub(r"\s+", " ", name)

    if len(name) < _MIN_LEN:
        raise NameValidationError("This name is too short.")
    if len(name) > _MAX_LEN:
        raise NameValidationError("This name is too long.")

    if _is_morse(name):
        raise NameValidationError("This does not look like a real name.")

    # Character whitelist: Unicode letters (any script) plus name punctuation.
    # Anything else (digits, emoji, symbols, control chars - i.e. ASCII soup)
    # means it is not a name.
    for ch in name:
        if ch in _NAME_PUNCT:
            continue
        if ch.isdigit():
            raise NameValidationError("A name cannot contain numbers.")
        if not ch.isalpha():
            raise NameValidationError("This does not look like a real name.")

    letters = [c for c in name if c.isalpha()]
    if not letters:
        raise NameValidationError("This does not look like a real name.")

    # Punctuation must not dominate - real names are mostly letters.
    if len(letters) < len(name.replace(" ", "")) * 0.5:
        raise NameValidationError("This does not look like a real name.")

    words = re.split(r"[ \-'’ʼ`.]+", name)
    words = [w for w in words if w]
    if len(words) > _MAX_WORDS:
        raise NameValidationError("This does not look like a real name.")

    for word in words:
        folded = _fold(word)

        # No character repeated 3+ times in a row ("aaargh", "jjjj").
        # Script-agnostic, so it applies to every alphabet.
        if re.search(r"(.)\1\1", folded):
            raise NameValidationError("This does not look like a real name.")

        # The vowel / consonant-cluster heuristics only make sense for the
        # Latin alphabet. For other scripts (Cyrillic, Greek, Arabic, CJK, …)
        # our ASCII vowel set is meaningless, so skip them there.
        if folded.isascii():
            # Longer words must contain a vowel; a run of 5+ consonants is
            # keyboard-mashing, not a name. Short (<4 char) all-consonant words
            # are allowed (e.g. the surname "Ng").
            if len(folded) >= 4 and not (set(folded) & _VOWELS):
                raise NameValidationError("This does not look like a real name.")
            if re.search(r"[^aeiouy]{5,}", folded):
                raise NameValidationError("This does not look like a real name.")

    if contains_profanity(name):
        raise NameValidationError("This name contains inappropriate language.")

    # Reserved terms are blocked like banned content unless unlocked above.
    if not unlocked and contains_reserved(name):
        raise NameValidationError("This name is reserved.")

    return name


def validate_username(raw: str) -> str:
    """Clean a username and reject derogatory / reserved values.

    Strips the optional :data:`OVERRIDE_PREFIX`, lower-cases and trims, then
    rejects the value if it contains a profane term (any language) or a
    reserved term (unless unlocked by the prefix). Returns the cleaned
    username; format rules (length, allowed characters, uniqueness) stay with
    the caller.
    """
    text, unlocked = strip_override(raw or "")
    text = text.strip().lower()

    if text and contains_profanity(text):
        raise NameValidationError(
            "This username contains inappropriate language."
        )
    if not unlocked and contains_reserved(text):
        raise NameValidationError("This username is reserved.")

    return text
