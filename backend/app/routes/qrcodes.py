"""
Unified QR code registry.

Every QR code in the app encodes a short, unique identifier (e.g. STR-X7K9M2P4).
The scanner resolves the code via GET /api/qr-codes/{code}/resolve to learn what
it points to (artefact, invite, etc.) and navigate accordingly.


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

import secrets
import string

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import QRCode, User

router = APIRouter(prefix="/qr-codes", tags=["qr-codes"])

# 32-char alphabet (uppercase letters + digits, minus confusing O/I/0/1)
_ALPHABET = string.ascii_uppercase.replace("O", "").replace(
    "I", ""
) + string.digits.replace("0", "").replace("1", "")


def _generate_code(length: int = 8) -> str:
    """Return a code like ``STR-X7K9M2P4``."""
    random_part = "".join(secrets.choice(_ALPHABET) for _ in range(length))
    return f"STR-{random_part}"


def _unique_code(db: Session, max_attempts: int = 10) -> str:
    """Generate a code that does not yet exist in the ``qr_codes`` table."""
    for _ in range(max_attempts):
        code = _generate_code()
        if not db.query(QRCode).filter(QRCode.code == code).first():
            return code
    # Extremely unlikely fallback – use a longer random part
    return _generate_code(length=12)


# ── Create ───────────────────────────────────────────────────────────────────


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_qr_code(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Register a new QR code pointing at a resource.

    Body JSON::

        {
            "type": "artefact" | "invite",
            "resource_id": "<id of the target resource>",
            "project_id": "<optional project id>",
            "metadata": { ... }          // optional extra payload
        }
    """
    qr_type = body.get("type")
    resource_id = body.get("resource_id")

    if not qr_type or not resource_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="'type' and 'resource_id' are required",
        )

    code = _unique_code(db)

    entry = QRCode(
        code=code,
        type=qr_type,
        resource_id=str(resource_id),
        project_id=body.get("project_id"),
        metadata_json=body.get("metadata"),
        created_by=current_user.id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    return {
        "id": entry.id,
        "code": entry.code,
        "type": entry.type,
        "resource_id": entry.resource_id,
        "project_id": entry.project_id,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
    }


# ── Resolve ──────────────────────────────────────────────────────────────────


@router.get("/{code}/resolve")
async def resolve_qr_code(
    code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Look up what a QR code points to.

    Returns the type, resource_id, project_id, and any metadata so the client
    can navigate to the right screen.
    """
    normalised = code.strip().upper()

    entry: QRCode | None = db.query(QRCode).filter(QRCode.code == normalised).first()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="QR code not found",
        )

    return {
        "code": entry.code,
        "type": entry.type,
        "resource_id": entry.resource_id,
        "project_id": entry.project_id,
        "metadata": entry.metadata_json,
    }
