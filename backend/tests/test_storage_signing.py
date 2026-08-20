"""Tests for the storage-proxy signature.

The proxy is unauthenticated so that <img>/<video> tags can load objects
without an Authorization header, which means the signature is the only
thing standing between a stored object and the public internet.
"""

import time

from app.minio_client import sign_storage_path, verify_storage_signature

BUCKET = "stratum-files"
KEY = "profiles/user-123/avatar.png"


def _future() -> int:
    return int(time.time()) + 3600


def test_signature_round_trips():
    exp = _future()
    sig = sign_storage_path(BUCKET, KEY, exp)
    assert verify_storage_signature(BUCKET, KEY, str(exp), sig)


def test_rejects_missing_signature():
    assert not verify_storage_signature(BUCKET, KEY, "", "")
    assert not verify_storage_signature(BUCKET, KEY, str(_future()), "")


def test_rejects_expired_link():
    past = int(time.time()) - 1
    sig = sign_storage_path(BUCKET, KEY, past)
    assert not verify_storage_signature(BUCKET, KEY, str(past), sig)


def test_signature_is_bound_to_key():
    """A signature for one object must not unlock another."""
    exp = _future()
    sig = sign_storage_path(BUCKET, KEY, exp)
    assert not verify_storage_signature(
        BUCKET, "profiles/user-999/avatar.png", str(exp), sig
    )


def test_signature_is_bound_to_bucket():
    exp = _future()
    sig = sign_storage_path(BUCKET, KEY, exp)
    assert not verify_storage_signature("wheeler-renders", KEY, str(exp), sig)


def test_expiry_cannot_be_extended_without_resigning():
    """Bumping exp in the URL must invalidate the signature."""
    exp = _future()
    sig = sign_storage_path(BUCKET, KEY, exp)
    assert not verify_storage_signature(BUCKET, KEY, str(exp + 86400), sig)


def test_malformed_expiry_is_rejected():
    assert not verify_storage_signature(BUCKET, KEY, "not-a-number", "a" * 32)
