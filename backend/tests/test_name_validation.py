"""
Tests for STRATUM name / username validation.

Covers:
- Real-person display-name acceptance (Latin + non-Latin scripts, accents,
  hyphens, apostrophes, initials)
- Rejection of profanity (multi-language, leetspeak, separator obfuscation),
  Morse code, ASCII/symbol soup, digits and keyboard-mashing gibberish
- Lenient username rule: only derogatory terms are blocked

Run with: pytest backend/tests/test_name_validation.py -v


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

import pytest

from app.name_validation import (
    CONTACT_EMAIL,
    NameValidationError,
    contains_profanity,
    validate_display_name,
    validate_username,
)


class TestValidDisplayNames:
    """Genuine human names must be accepted across scripts."""

    @pytest.mark.parametrize(
        "name",
        [
            "Andrei Popescu",
            "Mircea Levin-Constantin",
            "O'Brien",
            "Anne-Marie",
            "Jean-Luc Picard",
            "José García",
            "Éric",
            "Zoë",
            "Åström",
            "Muhammad al-Rashid",
            "Ng",  # short all-consonant surname
            "D.",  # initial
            "Владимир Ильич",  # Cyrillic
            "田中太郎",  # CJK
            "محمد",  # Arabic
        ],
    )
    def test_accepts_real_names(self, name):
        # Returned value is the normalised/cleaned name.
        assert validate_display_name(name)

    def test_collapses_whitespace(self):
        assert validate_display_name("  Andrei   Popescu  ") == "Andrei Popescu"


class TestInvalidDisplayNames:
    """Non-names must be rejected with the contact hint."""

    @pytest.mark.parametrize(
        "name",
        [
            "fuck you",  # profanity
            "F4ck",  # leetspeak profanity
            "sh1t head",  # leetspeak profanity
            "p u t a",  # separator-obfuscated profanity (Spanish)
            "ni99er",  # slur with digit substitution
            ".- -... -.-.",  # Morse code
            "xkcdqwrt",  # no vowels / gibberish
            "asdfghjkl",  # keyboard mashing
            "aaaaaa",  # repeated character
            "John123",  # digits
            "x_x <3 :)",  # ASCII/symbol soup
            "💀💀",  # emoji
            "@#$%^",  # pure symbols
            "admin",  # reserved / impersonation
            "a",  # too short
        ],
    )
    def test_rejects_non_names(self, name):
        with pytest.raises(NameValidationError):
            validate_display_name(name)

    def test_error_points_to_contact(self):
        with pytest.raises(NameValidationError) as exc:
            validate_display_name("fuck")
        assert CONTACT_EMAIL in exc.value.message


class TestUsernames:
    """Usernames may be handles - only derogatory language is blocked."""

    @pytest.mark.parametrize(
        "username",
        ["andrei_b", "cool.dev", "xX_gamer_Xx", "player-01", "ng"],
    )
    def test_allows_handles(self, username):
        # Should not raise.
        validate_username(username)

    @pytest.mark.parametrize(
        "username",
        ["fuck_you", "ni99a", "puta123", "sh1thead"],
    )
    def test_blocks_derogatory(self, username):
        with pytest.raises(NameValidationError):
            validate_username(username)


class TestReservedNameAndOverride:
    """"banu" is blocked like banned content unless unlocked with the override."""

    @pytest.mark.parametrize(
        "name",
        ["Banu", "Andrei Banu", "b4nu", "Bănu", "xbanux"],
    )
    def test_blocks_reserved(self, name):
        with pytest.raises(NameValidationError):
            validate_display_name(name)

    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("/regelebanu Banu", "Banu"),
            ("/regelebanu Andrei Banu", "Andrei Banu"),
            ("/RegeleBanu Andrei Banu", "Andrei Banu"),  # case-insensitive
        ],
    )
    def test_override_unlocks_display_name(self, raw, expected):
        assert validate_display_name(raw) == expected

    def test_override_still_blocks_profanity(self):
        # The override lifts the reserved block, not the profanity filter.
        with pytest.raises(NameValidationError):
            validate_display_name("/regelebanu fuck")

    def test_username_reserved_blocked(self):
        with pytest.raises(NameValidationError):
            validate_username("banu_andrei")

    def test_username_override_unlocks(self):
        assert validate_username("/regelebanu banu_andrei") == "banu_andrei"


class TestProfanityDetection:
    def test_multilanguage(self):
        assert contains_profanity("connard")  # French
        assert contains_profanity("scheisse")  # German
        assert contains_profanity("cazzo")  # Italian
        assert contains_profanity("pizda")  # Romanian

    @pytest.mark.parametrize(
        "term",
        [
            "pizdă",  # diacritics folded to ASCII
            "căcat",
            "curvă",
            "poponar",
            "gaozar",
            "bulangiu",
            "tâmpit",
            "dobitoc",
            "jegos",
            "fraier",
            "țigan",  # slur
        ],
    )
    def test_romanian_terms(self, term):
        assert contains_profanity(term)

    @pytest.mark.parametrize(
        "surname",
        ["Curtea", "Prostescu", "Vacariu", "Balaban", "Ciobanu", "Purcaru"],
    )
    def test_romanian_surnames_pass(self, surname):
        # Real surnames that share letters with insults must not be flagged.
        assert not contains_profanity(surname)

    def test_clean_text(self):
        assert not contains_profanity("Cassandra")  # contains "ass"
        assert not contains_profanity("Michelle")  # contains "hell"
        assert not contains_profanity("Andrei Popescu")
