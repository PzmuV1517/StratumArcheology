"""
Voice note transcription using local OpenAI Whisper.

The model is loaded once at startup (downloading it from the internet if it
isn't already cached in ~/.cache/whisper/). After that, every transcription
runs in a thread-pool executor so the async event loop is never blocked.

STRATUM - Proprietary and Confidential
Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
All rights reserved.
No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
"""

import asyncio
import logging
import os
import tempfile
from concurrent.futures import ThreadPoolExecutor
from typing import Any

try:
    import whisper as whisper_module
except Exception:  # pragma: no cover - optional dependency in self-host profile
    whisper_module = None

from app.config import settings
from app.database import SessionLocal
from app.minio_client import minio_client
from app.models import Note
from app.websocket import emit_content_update, log_activity

logger = logging.getLogger(__name__)

# Loaded once at startup; None until load_whisper_model() is called.
_model: Any | None = None
_executor = ThreadPoolExecutor(max_workers=1)  # one transcription at a time


def load_whisper_model() -> None:
    """
    Load (and download if needed) the Whisper model.
    Called from the FastAPI startup event — blocks briefly while downloading
    on first run, then is instant on subsequent starts because Whisper caches
    the weights in ~/.cache/whisper/.
    """
    global _model
    if whisper_module is None:
        logger.warning(
            "openai-whisper is not installed; voice transcription is disabled"
        )
        return

    model_name = settings.WHISPER_MODEL
    logger.info("Loading Whisper model '%s' …", model_name)
    _model = whisper_module.load_model(model_name)
    logger.info("Whisper model '%s' ready.", model_name)


def _run_transcription(audio_path: str) -> str:
    """Synchronous transcription — runs inside the thread-pool executor."""
    if _model is None:
        raise RuntimeError("Whisper model is not loaded")
    result = _model.transcribe(audio_path, language="en")
    return result["text"].strip()


async def transcribe_note_audio(
    note_id: str,
    attachment_id: str,
    storage_path: str,
    filename: str,
    project_id: str,
    author_id: str,
) -> None:
    """
    Background task: download audio from MinIO → Whisper → update Note.

    Sets transcription_status to 'processing' while running, then
    'completed' or 'failed'. Emits a WebSocket note update on finish.
    """
    if _model is None:
        logger.warning(
            "Whisper model not loaded — transcription skipped for %s", note_id
        )
        db = SessionLocal()
        try:
            note = db.query(Note).filter(Note.id == note_id).first()
            if note:
                note.transcription_status = "failed"
                db.commit()
        finally:
            db.close()
        return

    db = SessionLocal()
    tmp_path: str | None = None
    try:
        note = db.query(Note).filter(Note.id == note_id).first()
        if not note:
            return

        note.transcription_status = "processing"
        db.commit()

        # Download audio bytes from MinIO
        audio_bytes = await minio_client.get_file(storage_path)
        if not audio_bytes:
            raise RuntimeError(
                f"Could not download audio from MinIO: {storage_path}"
            )

        # Write to a temp file (Whisper needs a path, not raw bytes)
        ext = filename.rsplit(".", 1)[-1] if "." in filename else "webm"
        with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        # Run synchronous Whisper in the executor so we don't block the loop
        loop = asyncio.get_running_loop()
        text = await loop.run_in_executor(_executor, _run_transcription, tmp_path)

        note.transcription = text
        note.transcription_original = text
        note.transcription_modified = False
        note.transcription_status = "completed"
        db.commit()

        await log_activity(
            db=db,
            project_id=project_id,
            activity_type="NOTE_TRANSCRIPTION_COMPLETED",
            description=f'Transcription completed for voice note "{note.title}"',
            user_id=author_id,
            metadata={"note_id": note_id},
        )

    except Exception:
        logger.exception("Transcription failed for note %s", note_id)
        try:
            note = db.query(Note).filter(Note.id == note_id).first()
            if note:
                note.transcription_status = "failed"
                db.commit()
        except Exception:
            logger.exception(
                "Failed to mark transcription as failed for note %s", note_id
            )
        return
    finally:
        db.close()
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

    await emit_content_update(project_id, "notes")
