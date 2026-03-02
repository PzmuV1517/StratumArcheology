"""
Chat / messaging API routes.

Provides REST endpoints for:
- Paginated message history (project rooms & DMs)
- DM conversation list (inbox)
- Sending messages (REST fallback when WS is unavailable)
- Editing / deleting messages

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

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, and_, func, case
from sqlalchemy.orm import Session, aliased

from app.database import get_db
from app.dependencies import check_project_permission, get_current_user
from app.models import Channel, ChatMessage, User
from app.schemas import (
    ChatMessageCreate,
    ChatMessageEdit,
    ChatMessagePage,
    ChatMessageResponse,
    ConversationPreview,
)

router = APIRouter(prefix="/chat", tags=["chat"])

PAGE_SIZE = 50


# ── Helpers ──────────────────────────────────────────────────────────────────


def _msg_to_response(msg: ChatMessage, sender: User | None = None) -> ChatMessageResponse:
    """Convert an ORM ChatMessage into a Pydantic response."""
    return ChatMessageResponse(
        id=msg.id,
        sender_id=msg.sender_id,
        sender_name=sender.display_name if sender else None,
        sender_photo=sender.photo_url if sender else None,
        sender_username=sender.username if sender else None,
        channel_id=msg.channel_id,
        project_id=msg.project_id,
        recipient_id=msg.recipient_id,
        content="" if msg.is_deleted else msg.content,
        mentions=msg.mentions if not msg.is_deleted else None,
        reply_to_id=msg.reply_to_id,
        created_at=msg.created_at,
        edited_at=msg.edited_at,
        is_deleted=msg.is_deleted,
    )


# ── Project room history ────────────────────────────────────────────────────


@router.get(
    "/project/{project_id}",
    response_model=ChatMessagePage,
)
async def get_project_messages(
    project_id: str,
    cursor: str | None = Query(None, description="ISO timestamp cursor for pagination"),
    limit: int = Query(PAGE_SIZE, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return paginated chat history for a project room (newest first)."""
    check_project_permission(project_id, current_user, db)

    q = db.query(ChatMessage, User).outerjoin(
        User, ChatMessage.sender_id == User.id
    ).filter(ChatMessage.project_id == project_id)

    if cursor:
        try:
            cursor_dt = datetime.fromisoformat(cursor)
            q = q.filter(ChatMessage.created_at < cursor_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid cursor format")

    rows = q.order_by(ChatMessage.created_at.desc()).limit(limit + 1).all()

    has_more = len(rows) > limit
    rows = rows[:limit]

    messages = [_msg_to_response(msg, sender) for msg, sender in rows]
    next_cursor = messages[-1].created_at.isoformat() if has_more and messages else None

    return ChatMessagePage(messages=messages, next_cursor=next_cursor, has_more=has_more)


# ── Channel message history ─────────────────────────────────────────────────


@router.get(
    "/channel/{channel_id}",
    response_model=ChatMessagePage,
)
async def get_channel_messages(
    channel_id: str,
    cursor: str | None = Query(None, description="ISO timestamp cursor for pagination"),
    limit: int = Query(PAGE_SIZE, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return paginated chat history for a channel (newest first)."""
    ch = db.query(Channel).filter(Channel.id == channel_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")
    check_project_permission(ch.project_id, current_user, db)

    q = db.query(ChatMessage, User).outerjoin(
        User, ChatMessage.sender_id == User.id
    ).filter(ChatMessage.channel_id == channel_id)

    if cursor:
        try:
            cursor_dt = datetime.fromisoformat(cursor)
            q = q.filter(ChatMessage.created_at < cursor_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid cursor format")

    rows = q.order_by(ChatMessage.created_at.desc()).limit(limit + 1).all()
    has_more = len(rows) > limit
    rows = rows[:limit]

    messages = [_msg_to_response(msg, sender) for msg, sender in rows]
    next_cursor = messages[-1].created_at.isoformat() if has_more and messages else None

    return ChatMessagePage(messages=messages, next_cursor=next_cursor, has_more=has_more)


# ── DM history ──────────────────────────────────────────────────────────────


@router.get(
    "/dm/{other_user_id}",
    response_model=ChatMessagePage,
)
async def get_dm_messages(
    other_user_id: str,
    cursor: str | None = Query(None),
    limit: int = Query(PAGE_SIZE, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return paginated DM history between the current user and another user."""
    q = db.query(ChatMessage, User).outerjoin(
        User, ChatMessage.sender_id == User.id
    ).filter(
        ChatMessage.project_id.is_(None),
        or_(
            and_(
                ChatMessage.sender_id == current_user.id,
                ChatMessage.recipient_id == other_user_id,
            ),
            and_(
                ChatMessage.sender_id == other_user_id,
                ChatMessage.recipient_id == current_user.id,
            ),
        ),
    )

    if cursor:
        try:
            cursor_dt = datetime.fromisoformat(cursor)
            q = q.filter(ChatMessage.created_at < cursor_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid cursor format")

    rows = q.order_by(ChatMessage.created_at.desc()).limit(limit + 1).all()
    has_more = len(rows) > limit
    rows = rows[:limit]

    messages = [_msg_to_response(msg, sender) for msg, sender in rows]
    next_cursor = messages[-1].created_at.isoformat() if has_more and messages else None

    return ChatMessagePage(messages=messages, next_cursor=next_cursor, has_more=has_more)


# ── DM inbox (conversation list) ────────────────────────────────────────────


@router.get(
    "/conversations",
    response_model=list[ConversationPreview],
)
async def get_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return a list of all DM conversations the current user is part of,
    ordered by most recent message."""

    # Determine the "other" user in each conversation
    other_id = case(
        (ChatMessage.sender_id == current_user.id, ChatMessage.recipient_id),
        else_=ChatMessage.sender_id,
    )

    subq = (
        db.query(
            other_id.label("other_user_id"),
            func.max(ChatMessage.created_at).label("last_at"),
        )
        .filter(
            ChatMessage.project_id.is_(None),
            or_(
                ChatMessage.sender_id == current_user.id,
                ChatMessage.recipient_id == current_user.id,
            ),
        )
        .group_by("other_user_id")
        .subquery()
    )

    OtherUser = aliased(User)

    # Join to get user info + last message
    rows = (
        db.query(subq, OtherUser.display_name, OtherUser.photo_url, OtherUser.username)
        .outerjoin(OtherUser, OtherUser.id == subq.c.other_user_id)
        .order_by(subq.c.last_at.desc())
        .all()
    )

    result: list[ConversationPreview] = []
    for row in rows:
        # Fetch the last message text
        last_msg = (
            db.query(ChatMessage)
            .filter(
                ChatMessage.project_id.is_(None),
                or_(
                    and_(
                        ChatMessage.sender_id == current_user.id,
                        ChatMessage.recipient_id == row.other_user_id,
                    ),
                    and_(
                        ChatMessage.sender_id == row.other_user_id,
                        ChatMessage.recipient_id == current_user.id,
                    ),
                ),
            )
            .order_by(ChatMessage.created_at.desc())
            .first()
        )
        result.append(
            ConversationPreview(
                other_user_id=row.other_user_id,
                other_user_name=row.display_name,
                other_user_photo=row.photo_url,
                other_user_username=row.username,
                last_message="" if (last_msg and last_msg.is_deleted) else (last_msg.content if last_msg else ""),
                last_message_at=row.last_at,
            )
        )

    return result


# ── Send message (REST fallback) ────────────────────────────────────────────


@router.post(
    "/messages",
    response_model=ChatMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/messages/",
    response_model=ChatMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    body: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a chat message via REST (useful when WS is not connected)."""
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="Empty message")
    if not body.project_id and not body.recipient_id and not body.channel_id:
        raise HTTPException(status_code=400, detail="channel_id, project_id, or recipient_id required")

    if body.project_id:
        check_project_permission(body.project_id, current_user, db)
    if body.channel_id:
        ch = db.query(Channel).filter(Channel.id == body.channel_id).first()
        if not ch:
            raise HTTPException(status_code=404, detail="Channel not found")
        check_project_permission(ch.project_id, current_user, db)

    msg = ChatMessage(
        sender_id=current_user.id,
        channel_id=body.channel_id,
        project_id=body.project_id,
        recipient_id=body.recipient_id,
        content=body.content.strip(),
        mentions=body.mentions,
        reply_to_id=body.reply_to_id,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    # Best-effort WS broadcast (non-blocking)
    try:
        from app.websocket import sio

        payload = {
            "id": msg.id,
            "sender_id": current_user.id,
            "sender_name": current_user.display_name,
            "sender_photo": current_user.photo_url,
            "sender_username": current_user.username,
            "channel_id": body.channel_id,
            "project_id": body.project_id,
            "recipient_id": body.recipient_id,
            "content": msg.content,
            "mentions": body.mentions,
            "reply_to_id": body.reply_to_id,
            "created_at": msg.created_at.isoformat(),
            "edited_at": None,
            "is_deleted": False,
        }
        if body.channel_id:
            ch = db.query(Channel).filter(Channel.id == body.channel_id).first()
            if ch:
                await sio.emit("new_message", payload, room=f"channel_{body.channel_id}")
        elif body.project_id:
            await sio.emit("new_message", payload, room=f"project_{body.project_id}")
        else:
            await sio.emit("new_message", payload, room=f"user_{body.recipient_id}")
            await sio.emit("new_message", payload, room=f"user_{current_user.id}")
    except Exception:
        pass  # WS delivery is best-effort from REST

    return _msg_to_response(msg, current_user)


# ── Edit message ─────────────────────────────────────────────────────────────


@router.patch(
    "/messages/{message_id}",
    response_model=ChatMessageResponse,
)
async def edit_message(
    message_id: str,
    body: ChatMessageEdit,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Edit a message you sent."""
    msg = db.query(ChatMessage).filter(
        ChatMessage.id == message_id,
        ChatMessage.sender_id == current_user.id,
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found or not yours")

    msg.content = body.content.strip()
    msg.edited_at = datetime.utcnow()
    db.commit()
    db.refresh(msg)

    return _msg_to_response(msg, current_user)


# ── Delete message ───────────────────────────────────────────────────────────


@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Soft-delete a message you sent."""
    msg = db.query(ChatMessage).filter(
        ChatMessage.id == message_id,
        ChatMessage.sender_id == current_user.id,
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found or not yours")

    msg.is_deleted = True
    msg.content = ""
    db.commit()
