"""
WebSocket manager for real-time project updates.
Handles member kicks, role changes, and other real-time events.
"""
import socketio
from typing import Dict, Set, Optional
import logging
import json
from app.config import settings

logger = logging.getLogger(__name__)

# Create Socket.IO server instance with CORS support
# Socket.IO requires '*' or explicit origins list
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',  # Allow all origins for development
    logger=True,
    engineio_logger=True
)

# Track which users are in which project rooms
# Format: {project_id: {user_id1, user_id2, ...}}
project_rooms: Dict[str, Set[str]] = {}

# Track user sessions
# Format: {session_id: {"user_id": "...", "project_id": "..."}}
user_sessions: Dict[str, Dict[str, str]] = {}


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
        project_id = session_data.get('project_id')
        user_id = session_data.get('user_id')
        
        if project_id and user_id:
            if project_id in project_rooms:
                project_rooms[project_id].discard(user_id)
                if not project_rooms[project_id]:
                    del project_rooms[project_id]
        
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
        project_id = data.get('project_id')
        user_id = data.get('user_id')
        
        if not project_id or not user_id:
            logger.warning(f"Invalid join_project data from {sid}: {data}")
            return {'status': 'error', 'message': 'Missing project_id or user_id'}
        
        # Join the Socket.IO room for this project
        room = f"project_{project_id}"
        await sio.enter_room(sid, room)
        
        # Track user in project room
        if project_id not in project_rooms:
            project_rooms[project_id] = set()
        project_rooms[project_id].add(user_id)
        
        # Store session data
        user_sessions[sid] = {
            'project_id': project_id,
            'user_id': user_id
        }
        
        logger.info(f"User {user_id} joined project {project_id} (session: {sid})")
        return {'status': 'success', 'message': f'Joined project {project_id}'}
        
    except Exception as e:
        logger.error(f"Error in join_project: {e}")
        return {'status': 'error', 'message': str(e)}


@sio.event
async def leave_project(sid, data):
    """Client leaves a project room."""
    try:
        project_id = data.get('project_id')
        user_id = data.get('user_id')
        
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
            return {'status': 'success', 'message': f'Left project {project_id}'}
        
    except Exception as e:
        logger.error(f"Error in leave_project: {e}")
        return {'status': 'error', 'message': str(e)}


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
            'member_kicked',
            {
                'project_id': project_id,
                'user_id': user_id,
                'message': 'You have been removed from this project'
            },
            room=room
        )
        logger.info(f"Emitted member_kicked for user {user_id} in project {project_id}")
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
            'role_changed',
            {
                'project_id': project_id,
                'user_id': user_id,
                'new_role': new_role,
                'message': f'Your role has been changed to {new_role}'
            },
            room=room
        )
        logger.info(f"Emitted role_changed for user {user_id} to {new_role} in project {project_id}")
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
            'members_updated',
            {
                'project_id': project_id,
                'message': 'Project members have been updated'
            },
            room=room
        )
        logger.info(f"Emitted members_updated for project {project_id}")
    except Exception as e:
        logger.error(f"Error emitting member_update: {e}")


async def emit_content_update(project_id: str, content_type: str = 'general'):
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
            'content_updated',
            {
                'project_id': project_id,
                'content_type': content_type,
                'message': f'Project {content_type} have been updated'
            },
            room=room
        )
        logger.info(f"Emitted content_updated ({content_type}) for project {project_id}")
    except Exception as e:
        logger.error(f"Error emitting content_update: {e}")


async def log_activity(
    db,
    project_id: str,
    activity_type: str,
    description: str,
    user_id: Optional[str] = None,
    metadata: Optional[dict] = None
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
        from app.models import ProjectActivity, ActivityType
        
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
            extra_data=json.dumps(metadata) if metadata else None
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
            'timeline_updated',
            {
                'project_id': project_id,
                'message': 'Project timeline has been updated'
            },
            room=room
        )
        logger.info(f"Emitted timeline_updated for project {project_id}")
    except Exception as e:
        logger.error(f"Error emitting timeline_update: {e}")


# Create ASGI app wrapper for Socket.IO
sio_app = socketio.ASGIApp(
    sio,
    socketio_path='/socket.io'
)
