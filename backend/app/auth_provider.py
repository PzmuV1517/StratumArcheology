"""Helpers for inferring and classifying Firebase auth providers."""

from typing import Any

import firebase_admin.auth as firebase_auth

GOOGLE_PROVIDER_ID = "google.com"
PASSWORD_PROVIDER_ID = "password"


def _normalize_provider(provider: str | None) -> str | None:
    if provider is None:
        return None
    cleaned = provider.strip().lower()
    return cleaned or None


def extract_provider_from_decoded_token(decoded_token: dict[str, Any]) -> str | None:
    """Extract Firebase sign-in provider from decoded ID token claims."""
    firebase_claim = decoded_token.get("firebase")
    if not isinstance(firebase_claim, dict):
        return None

    raw_provider = firebase_claim.get("sign_in_provider")
    if not isinstance(raw_provider, str):
        return None

    return _normalize_provider(raw_provider)


def extract_provider_ids_from_firebase_user(
    firebase_user: firebase_auth.UserRecord,
) -> list[str]:
    """Return normalized provider IDs attached to a Firebase user."""
    providers: list[str] = []

    for provider_info in firebase_user.provider_data or []:
        provider_id = _normalize_provider(
            getattr(provider_info, "provider_id", None)
        )
        if provider_id and provider_id not in providers:
            providers.append(provider_id)

    user_provider = _normalize_provider(getattr(firebase_user, "provider_id", None))
    if user_provider and user_provider not in providers:
        providers.append(user_provider)

    return providers


def choose_primary_auth_provider(
    *providers_or_lists: str | None | list[str],
) -> str | None:
    """Choose canonical provider with Google prioritized for policy checks."""
    flattened: list[str] = []

    for value in providers_or_lists:
        if isinstance(value, list):
            candidates = value
        else:
            candidates = [value]

        for candidate in candidates:
            normalized = _normalize_provider(candidate)
            if normalized and normalized not in flattened:
                flattened.append(normalized)

    if GOOGLE_PROVIDER_ID in flattened:
        return GOOGLE_PROVIDER_ID
    if PASSWORD_PROVIDER_ID in flattened:
        return PASSWORD_PROVIDER_ID
    if flattened:
        return flattened[0]
    return None


def is_google_provider(provider: str | None) -> bool:
    return _normalize_provider(provider) == GOOGLE_PROVIDER_ID


def infer_auth_provider(
    decoded_token: dict[str, Any],
    firebase_user: firebase_auth.UserRecord | None = None,
) -> str | None:
    """Infer canonical auth provider from token claims and Firebase record."""
    token_provider = extract_provider_from_decoded_token(decoded_token)
    user_providers = (
        extract_provider_ids_from_firebase_user(firebase_user)
        if firebase_user is not None
        else []
    )
    return choose_primary_auth_provider(token_provider, user_providers)
