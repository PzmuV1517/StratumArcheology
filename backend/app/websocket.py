"""
WebSocket manager for real-time project updates.
Handles member kicks, role changes, and other real-time events.

STRATUM - Proprietary and Confidential
Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
All rights reserved.
No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
"""

import json
import logging

import socketio

logger = logging.getLogger(__name__)

# Create Socket.IO server instance
# CORS is handled by FastAPI's CORSMiddleware, so we don't configure it here
# to avoid duplicate Access-Control-Allow-Origin headers
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=[],  # Empty list - CORS handled by FastAPI middleware
    logger=False,  # Disable verbose Socket.IO logging
    engineio_logger=False,  # Disable verbose Engine.IO logging
)

# Track which users are in which project rooms
# Format: {project_id: {user_id1, user_id2, ...}}
project_rooms: dict[str, set[str]] = {}

# Track user sessions
# Format: {session_id: {"user_id": "...", "project_id": "..."}}
user_sessions: dict[str, dict[str, str]] = {}

# Reverse lookup: user_id → set of session ids (for DM delivery)
user_sids: dict[str, set[str]] = {}


@sio.event
async def connect(sid, environ, auth):
    """Handle client connection."""
    logger.info(f"Client connected: {sid}")
    return True


@sio.event
async def disconnect(sid):
    """Handle client disconnection."""
    logger.info(f"Client disconnected: {sid}")

    # Clean up user from project rooms
    if sid in user_sessions:
        session_data = user_sessions[sid]
        project_id = session_data.get("project_id")
        user_id = session_data.get("user_id")

        if project_id and user_id:
            if project_id in project_rooms:
                project_rooms[project_id].discard(user_id)
                if not project_rooms[project_id]:
                    del project_rooms[project_id]

        # Clean up user_sids reverse lookup
        if user_id and user_id in user_sids:
            user_sids[user_id].discard(sid)
            if not user_sids[user_id]:
                del user_sids[user_id]

        del user_sessions[sid]


@sio.event
async def join_project(sid, data):
    """
    Client joins a project room to receive real-time updates.

    Data format:
    {
        "project_id": "project-uuid",
        "user_id": "user-uuid"
    }
    """
    try:
        project_id = data.get("project_id")
        user_id = data.get("user_id")

        if not project_id or not user_id:
            logger.warning(f"Invalid join_project data from {sid}: {data}")
            return {"status": "error", "message": "Missing project_id or user_id"}

        # Join the Socket.IO room for this project
        room = f"project_{project_id}"
        await sio.enter_room(sid, room)

        # Track user in project room
        if project_id not in project_rooms:
            project_rooms[project_id] = set()
        project_rooms[project_id].add(user_id)

        # Store session data
        user_sessions[sid] = {"project_id": project_id, "user_id": user_id}

        logger.info(f"User {user_id} joined project {project_id} (session: {sid})")
        return {"status": "success", "message": f"Joined project {project_id}"}

    except Exception as e:
        logger.error(f"Error in join_project: {e}")
        return {"status": "error", "message": str(e)}


@sio.event
async def identify(sid, data):
    """Client identifies itself so we can route DMs.

    Data: { "user_id": "uuid" }
    Must be called immediately after connecting.
    """
    user_id = data.get("user_id") if data else None
    if not user_id:
        return {"status": "error", "message": "Missing user_id"}
    if user_id not in user_sids:
        user_sids[user_id] = set()
    user_sids[user_id].add(sid)
    # Also join a personal room so emit_to_user works even simpler
    await sio.enter_room(sid, f"user_{user_id}")
    logger.info(f"User {user_id} identified (sid {sid})")
    return {"status": "success"}


@sio.event
async def leave_project(sid, data):
    """Client leaves a project room."""
    try:
        project_id = data.get("project_id")
        user_id = data.get("user_id")

        if project_id and user_id:
            room = f"project_{project_id}"
            await sio.leave_room(sid, room)

            if project_id in project_rooms:
                project_rooms[project_id].discard(user_id)
                if not project_rooms[project_id]:
                    del project_rooms[project_id]

            if sid in user_sessions:
                del user_sessions[sid]

            logger.info(f"User {user_id} left project {project_id}")
            return {"status": "success", "message": f"Left project {project_id}"}

    except Exception as e:
        logger.error(f"Error in leave_project: {e}")
        return {"status": "error", "message": str(e)}


@sio.event
async def join_channel(sid, data):
    """Client joins a channel room to receive channel messages.

    Data: { "channel_id": "uuid" }
    """
    try:
        channel_id = data.get("channel_id") if data else None
        if not channel_id:
            return {"status": "error", "message": "Missing channel_id"}
        room = f"channel_{channel_id}"
        await sio.enter_room(sid, room)
        logger.debug(f"sid {sid} joined channel room {room}")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error in join_channel: {e}")
        return {"status": "error", "message": str(e)}


@sio.event
async def leave_channel(sid, data):
    """Client leaves a channel room.

    Data: { "channel_id": "uuid" }
    """
    try:
        channel_id = data.get("channel_id") if data else None
        if not channel_id:
            return {"status": "error", "message": "Missing channel_id"}
        room = f"channel_{channel_id}"
        await sio.leave_room(sid, room)
        logger.debug(f"sid {sid} left channel room {room}")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error in leave_channel: {e}")
        return {"status": "error", "message": str(e)}


async def emit_member_kicked(project_id: str, user_id: str):
    """
    Notify a specific user they've been kicked from a project.

    Args:
        project_id: The project UUID
        user_id: The user UUID who was kicked
    """
    try:
        room = f"project_{project_id}"
        await sio.emit(
            "member_kicked",
            {
                "project_id": project_id,
                "user_id": user_id,
                "message": "You have been removed from this project",
            },
            room=room,
        )
        logger.info(
            f"Emitted member_kicked for user {user_id} in project {project_id}"
        )
    except Exception as e:
        logger.error(f"Error emitting member_kicked: {e}")


async def emit_role_changed(project_id: str, user_id: str, new_role: str):
    """
    Notify a specific user their role has changed.

    Args:
        project_id: The project UUID
        user_id: The user UUID whose role changed
        new_role: The new role (LEADER, RESEARCHER, GUEST)
    """
    try:
        room = f"project_{project_id}"
        await sio.emit(
            "role_changed",
            {
                "project_id": project_id,
                "user_id": user_id,
                "new_role": new_role,
                "message": f"Your role has been changed to {new_role}",
            },
            room=room,
        )
        logger.info(
            f"Emitted role_changed for user {user_id} to {new_role} in project {project_id}"
        )
    except Exception as e:
        logger.error(f"Error emitting role_changed: {e}")


async def emit_member_update(project_id: str):
    """
    Notify all users in a project that the member list has been updated.

    Args:
        project_id: The project UUID
    """
    try:
        room = f"project_{project_id}"
        await sio.emit(
            "members_updated",
            {
                "project_id": project_id,
                "message": "Project members have been updated",
            },
            room=room,
        )
        logger.info(f"Emitted members_updated for project {project_id}")
    except Exception as e:
        logger.error(f"Error emitting member_update: {e}")


async def emit_content_update(project_id: str, content_type: str = "general"):
    """
    Notify all users in a project that content has been updated.
    This is for notes, files, artefacts, etc.

    Args:
        project_id: The project UUID
        content_type: Type of content updated (notes, files, artefacts, general)
    """
    try:
        room = f"project_{project_id}"
        await sio.emit(
            "content_updated",
            {
                "project_id": project_id,
                "content_type": content_type,
                "message": f"Project {content_type} have been updated",
            },
            room=room,
        )

        # Also emit specific files_updated event for file changes
        if content_type == "files":
            await sio.emit(
                "files_updated",
                {
                    "project_id": project_id,
                    "message": "Project files have been updated",
                },
                room=room,
            )

        logger.info(
            f"Emitted content_updated ({content_type}) for project {project_id}"
        )
    except Exception as e:
        logger.error(f"Error emitting content_update: {e}")


async def log_activity(
    db,
    project_id: str,
    activity_type: str,
    description: str,
    user_id: str | None = None,
    metadata: dict | None = None,
):
    """
    Log an activity to the project timeline.

    Args:
        db: Database session
        project_id: The project UUID
        activity_type: Type from ActivityType enum (name like 'FILE_UPLOADED' or value like 'file_uploaded')
        description: Human-readable description
        user_id: Optional user who performed the action
        metadata: Optional dict with additional data
    """
    try:
        from app.models import ActivityType, ProjectActivity

        # Validate activity type - try both name and value lookups
        activity_enum = None

        # Try to get by name first (e.g., 'FILE_UPLOADED')
        if hasattr(ActivityType, activity_type):
            activity_enum = getattr(ActivityType, activity_type)
        else:
            # Try to get by value (e.g., 'file_uploaded')
            try:
                activity_enum = ActivityType(activity_type.lower())
            except ValueError:
                logger.error(f"Invalid activity type: {activity_type}")
                return

        activity = ProjectActivity(
            project_id=project_id,
            user_id=user_id,
            activity_type=activity_enum,
            description=description,
            extra_data=json.dumps(metadata) if metadata else None,
        )

        db.add(activity)
        db.commit()

        # Emit timeline update via WebSocket
        await emit_timeline_update(project_id)

        logger.info(f"Logged activity: {activity_type} for project {project_id}")

    except Exception as e:
        logger.error(f"Error logging activity: {e}")
        import traceback

        traceback.print_exc()
        db.rollback()


async def emit_timeline_update(project_id: str):
    """
    Notify all users in a project that the timeline has been updated.

    Args:
        project_id: The project UUID
    """
    try:
        room = f"project_{project_id}"
        await sio.emit(
            "timeline_updated",
            {
                "project_id": project_id,
                "message": "Project timeline has been updated",
            },
            room=room,
        )
        logger.info(f"Emitted timeline_updated for project {project_id}")
    except Exception as e:
        logger.error(f"Error emitting timeline_update: {e}")


# Create ASGI app wrapper for Socket.IO
# socketio_path='' because we mount this at /ws in main.py
sio_app = socketio.ASGIApp(sio, socketio_path="")


# ── Chat WebSocket Events ────────────────────────────────────────────────────


def _get_db():
    """Create a throwaway DB session for WS event handlers."""
    from app.database import SessionLocal

    return SessionLocal()


@sio.event
async def send_message(sid, data):
    """Client sends a chat message.

    Data: {
        "content": "...",
        "project_id": "..." | null,
        "channel_id": "..." | null,
        "recipient_id": "..." | null,
        "reply_to_id": "..." | null,
        "mentions": [...] | null
    }
    Exactly one of project_id or recipient_id must be provided.
    """
    try:
        content = (data.get("content") or "").strip()
        project_id = data.get("project_id")
        channel_id = data.get("channel_id")
        recipient_id = data.get("recipient_id")
        reply_to_id = data.get("reply_to_id")
        mentions = data.get("mentions")

        if not content:
            return {"status": "error", "message": "Empty message"}
        if not project_id and not recipient_id:
            return {
                "status": "error",
                "message": "project_id or recipient_id required",
            }
        if project_id and recipient_id:
            return {
                "status": "error",
                "message": "Cannot set both project_id and recipient_id",
            }

        # Resolve sender from session or identify data
        sender_id = None
        if sid in user_sessions:
            sender_id = user_sessions[sid].get("user_id")
        if not sender_id:
            # Check user_sids reverse map
            for uid, sids in user_sids.items():
                if sid in sids:
                    sender_id = uid
                    break
        if not sender_id:
            return {
                "status": "error",
                "message": "Not identified. Call 'identify' first.",
            }

        from app.models import ChatMessage, User

        db = _get_db()
        try:
            # Look up sender display info
            sender = db.query(User).filter(User.id == sender_id).first()
            sender_name = sender.display_name if sender else None
            sender_username = sender.username if sender else None
            sender_photo = sender.photo_url if sender else None

            msg = ChatMessage(
                sender_id=sender_id,
                project_id=project_id,
                channel_id=channel_id,
                recipient_id=recipient_id,
                content=content,
                reply_to_id=reply_to_id,
                mentions=mentions,
            )
            db.add(msg)
            db.commit()
            db.refresh(msg)

            payload = {
                "id": msg.id,
                "sender_id": sender_id,
                "sender_name": sender_name,
                "sender_username": sender_username,
                "sender_photo": sender_photo,
                "project_id": project_id,
                "channel_id": channel_id,
                "recipient_id": recipient_id,
                "content": content,
                "mentions": mentions,
                "reply_to_id": reply_to_id,
                "created_at": msg.created_at.isoformat(),
                "edited_at": None,
                "is_deleted": False,
            }

            if channel_id:
                # Broadcast to the specific channel room
                await sio.emit("new_message", payload, room=f"channel_{channel_id}")
            elif project_id:
                # Broadcast to the project room (non-channel project messages)
                room = f"project_{project_id}"
                await sio.emit("new_message", payload, room=room)
            else:
                # DM: send to recipient's personal room and echo to sender
                await sio.emit("new_message", payload, room=f"user_{recipient_id}")
                await sio.emit("new_message", payload, room=f"user_{sender_id}")

            logger.info(f"Chat message {msg.id} from {sender_id}")
            return {"status": "success", "message_id": msg.id}
        finally:
            db.close()

    except Exception as e:
        logger.error(f"Error in send_message: {e}")
        return {"status": "error", "message": str(e)}


@sio.event
async def edit_message(sid, data):
    """Client edits an existing message.

    Data: { "message_id": "...", "content": "..." }
    """
    try:
        message_id = data.get("message_id")
        content = (data.get("content") or "").strip()
        if not message_id or not content:
            return {"status": "error", "message": "message_id and content required"}

        sender_id = None
        if sid in user_sessions:
            sender_id = user_sessions[sid].get("user_id")
        if not sender_id:
            for uid, sids in user_sids.items():
                if sid in sids:
                    sender_id = uid
                    break
        if not sender_id:
            return {"status": "error", "message": "Not identified"}

        from datetime import datetime

        from app.models import ChatMessage

        db = _get_db()
        try:
            msg = (
                db.query(ChatMessage)
                .filter(
                    ChatMessage.id == message_id,
                    ChatMessage.sender_id == sender_id,
                )
                .first()
            )
            if not msg:
                return {
                    "status": "error",
                    "message": "Message not found or not yours",
                }

            msg.content = content
            msg.edited_at = datetime.utcnow()
            db.commit()

            payload = {
                "id": msg.id,
                "content": content,
                "edited_at": msg.edited_at.isoformat(),
            }

            if msg.project_id:
                await sio.emit(
                    "message_edited", payload, room=f"project_{msg.project_id}"
                )
            else:
                await sio.emit(
                    "message_edited", payload, room=f"user_{msg.recipient_id}"
                )
                await sio.emit("message_edited", payload, room=f"user_{sender_id}")

            return {"status": "success"}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error in edit_message: {e}")
        return {"status": "error", "message": str(e)}


@sio.event
async def delete_message(sid, data):
    """Soft-delete a message.

    Data: { "message_id": "..." }
    """
    try:
        message_id = data.get("message_id")
        if not message_id:
            return {"status": "error", "message": "message_id required"}

        sender_id = None
        if sid in user_sessions:
            sender_id = user_sessions[sid].get("user_id")
        if not sender_id:
            for uid, sids in user_sids.items():
                if sid in sids:
                    sender_id = uid
                    break
        if not sender_id:
            return {"status": "error", "message": "Not identified"}

        from app.models import ChatMessage

        db = _get_db()
        try:
            msg = (
                db.query(ChatMessage)
                .filter(
                    ChatMessage.id == message_id,
                    ChatMessage.sender_id == sender_id,
                )
                .first()
            )
            if not msg:
                return {
                    "status": "error",
                    "message": "Message not found or not yours",
                }

            msg.is_deleted = True
            msg.content = ""  # scrub content
            db.commit()

            payload = {"id": msg.id}

            if msg.project_id:
                await sio.emit(
                    "message_deleted", payload, room=f"project_{msg.project_id}"
                )
            else:
                await sio.emit(
                    "message_deleted", payload, room=f"user_{msg.recipient_id}"
                )
                await sio.emit("message_deleted", payload, room=f"user_{sender_id}")

            return {"status": "success"}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error in delete_message: {e}")
        return {"status": "error", "message": str(e)}


@sio.event
async def typing(sid, data):
    """Broadcast typing indicator.

    Data: { "project_id": "..." | null, "recipient_id": "..." | null, "user_id": "...", "display_name": "..." }
    """
    project_id = data.get("project_id")
    recipient_id = data.get("recipient_id")
    user_id = data.get("user_id")
    display_name = data.get("display_name", "Someone")

    payload = {"user_id": user_id, "display_name": display_name}

    if project_id:
        await sio.emit(
            "user_typing", payload, room=f"project_{project_id}", skip_sid=sid
        )
    elif recipient_id:
        await sio.emit("user_typing", payload, room=f"user_{recipient_id}")
