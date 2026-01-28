============================
WebSockets & Real-Time
============================

STRATUM uses Socket.IO for real-time bidirectional communication between clients and the server.

.. seealso::
   **What are WebSockets?** See `legend.rst <legend.rst>`_ for definitions of WebSockets, real-time communication, and all technical terms in this guide.

.. contents:: Table of Contents
   :local:
   :depth: 3

Overview
========

Real-time features enable instant collaboration without manual refresh:

.. graphviz::

   digraph realtime_overview {
      rankdir=LR;
      node [shape=box, style=rounded];
      
      client1 [label="Client 1\n(Browser)"];
      client2 [label="Client 2\n(Mobile)"];
      client3 [label="Client 3\n(Tablet)"];
      server [label="Socket.IO\nServer"];
      room [label="Project\nRoom"];
      
      client1 -> server [label="WebSocket"];
      client2 -> server [label="WebSocket"];
      client3 -> server [label="WebSocket"];
      server -> room [style=dashed];
      room -> client1 [style=dashed, label="broadcast"];
      room -> client2 [style=dashed, label="broadcast"];
      room -> client3 [style=dashed, label="broadcast"];
   }

.. important::
   WebSocket connections are established automatically when viewing a project.

Architecture
============

Server-Side Implementation
--------------------------

Location: :file:`backend/app/websocket.py`

.. code-block:: python

   import socketio

   # Create Socket.IO server
   sio = socketio.AsyncServer(
       async_mode="asgi",
       cors_allowed_origins="*",
       logger=True,
       engineio_logger=True
   )

   # Mount to ASGI app
   sio_app = socketio.ASGIApp(sio, app)

Connection Management
~~~~~~~~~~~~~~~~~~~~~

.. code-block:: python

   # Track active connections
   project_rooms: dict[str, set[str]] = {}
   user_sessions: dict[str, dict[str, str]] = {}

   @sio.event
   async def connect(sid, environ, auth):
       """Handle client connection"""
       logger.info(f"Client connected: {sid}")
       return True

   @sio.event
   async def disconnect(sid):
       """Handle client disconnection"""
       # Cleanup user from project rooms
       if sid in user_sessions:
           session_data = user_sessions[sid]
           cleanup_user(session_data)
           del user_sessions[sid]

Room Management
~~~~~~~~~~~~~~~

Rooms group users by project for targeted broadcasting.

.. code-block:: python

   @sio.event
   async def join_project(sid, data):
       """Join a project room for real-time updates"""
       project_id = data.get("project_id")
       user_id = data.get("user_id")
       
       # Join Socket.IO room
       room = f"project_{project_id}"
       await sio.enter_room(sid, room)
       
       # Track user
       if project_id not in project_rooms:
           project_rooms[project_id] = set()
       project_rooms[project_id].add(user_id)
       
       user_sessions[sid] = {
           "project_id": project_id,
           "user_id": user_id
       }
       
       return {"status": "success"}

Client-Side Implementation
--------------------------

Location: :file:`frontend/stratum-app/src/contexts/WebSocketContext.tsx`

.. code-block:: typescript

   import { io, Socket } from 'socket.io-client';

   const socket = io(process.env.EXPO_PUBLIC_WS_URL!, {
     transports: ['websocket'],
     reconnection: true,
     reconnectionAttempts: 5,
     reconnectionDelay: 1000,
   });

   // Join project room
   socket.emit('join_project', {
     project_id: projectId,
     user_id: userId,
   });

Event Types
===========

Member Management Events
------------------------

member_kicked
~~~~~~~~~~~~~

Notifies a user they've been removed from a project.

**Server Emission:**

.. code-block:: python

   async def emit_member_kicked(project_id: str, user_id: str):
       """Notify user they've been kicked"""
       room = f"project_{project_id}"
       await sio.emit(
           "member_kicked",
           {
               "project_id": project_id,
               "user_id": user_id,
               "message": "You have been removed from this project"
           },
           room=room
       )

**Client Handler:**

.. code-block:: typescript

   socket.on('member_kicked', (data) => {
     if (data.user_id === currentUser.id) {
       // Navigate away from project
       navigation.navigate('projects');
       
       // Show notification
       Alert.alert(
         'Removed from Project',
         'You have been removed from this project.',
         [{ text: 'OK' }]
       );
     }
   });

.. warning::
   The kicked user should immediately lose access to the project.

role_changed
~~~~~~~~~~~~

Notifies a user their role has changed.

**Payload:**

.. code-block:: typescript

   {
     project_id: string;
     user_id: string;
     old_role: 'leader' | 'researcher' | 'guest';
     new_role: 'leader' | 'researcher' | 'guest';
   }

**Example:**

.. code-block:: python

   await emit_role_changed(
       project_id="abc-123",
       user_id="user-456",
       new_role="leader"
   )

Content Update Events
---------------------

content_updated
~~~~~~~~~~~~~~~

Generic notification for content changes.

.. code-block:: python

   async def emit_content_update(
       project_id: str,
       update_type: str,
       data: dict
   ):
       """Notify all project members of content changes"""
       room = f"project_{project_id}"
       await sio.emit(
           "content_updated",
           {
               "project_id": project_id,
               "type": update_type,
               "data": data,
               "timestamp": datetime.utcnow().isoformat()
           },
           room=room
       )

**Update Types:**

.. list-table::
   :widths: 30 70
   :header-rows: 1

   * - Type
     - Description
   * - ``note_created``
     - New note added
   * - ``note_updated``
     - Note content modified
   * - ``note_deleted``
     - Note removed
   * - ``file_uploaded``
     - New file added
   * - ``file_deleted``
     - File removed
   * - ``folder_created``
     - New folder created
   * - ``form_submitted``
     - Archaeological form submitted
   * - ``gps_updated``
     - GPS boundaries modified

**Client Handler:**

.. code-block:: typescript

   socket.on('content_updated', (data) => {
     switch (data.type) {
       case 'note_created':
         refetchNotes();
         showToast('New note added');
         break;
       
       case 'file_uploaded':
         refetchFiles();
         showToast(`${data.data.filename} uploaded`);
         break;
       
       case 'gps_updated':
         refetchGPSData();
         showToast('Map updated');
         break;
     }
   });

Activity Feed Events
--------------------

activity_logged
~~~~~~~~~~~~~~~

Broadcasts activity log entries to all members.

.. code-block:: python

   async def log_activity(
       project_id: str,
       user_id: str,
       activity_type: ActivityType,
       description: str,
       extra_data: dict | None = None
   ):
       """Log and broadcast activity"""
       # 1. Save to database
       activity = ProjectActivity(
           project_id=project_id,
           user_id=user_id,
           activity_type=activity_type,
           description=description,
           extra_data=json.dumps(extra_data) if extra_data else None
       )
       db.add(activity)
       db.commit()
       
       # 2. Broadcast via WebSocket
       await sio.emit(
           "activity_logged",
           {
               "id": activity.id,
               "project_id": project_id,
               "user_name": user.display_name,
               "activity_type": activity_type.value,
               "description": description,
               "timestamp": activity.created_at.isoformat()
           },
           room=f"project_{project_id}"
       )

Connection Lifecycle
====================

Connection Flow
---------------

.. graphviz::

   digraph connection_flow {
      rankdir=TB;
      node [shape=box, style=rounded];
      
      start [label="Page Load", shape=ellipse];
      connect [label="Establish\nWebSocket"];
      auth [label="Send User\nCredentials"];
      join [label="Join Project\nRoom"];
      listen [label="Listen for\nEvents"];
      disconnect [label="Disconnect\non Leave", shape=ellipse];
      
      start -> connect;
      connect -> auth;
      auth -> join;
      join -> listen;
      listen -> disconnect;
   }

**Client Implementation:**

.. code-block:: typescript

   useEffect(() => {
     if (!projectId || !user) return;

     // 1. Connect to WebSocket server
     socket.connect();

     // 2. Join project room
     socket.emit('join_project', {
       project_id: projectId,
       user_id: user.id,
     });

     // 3. Set up event listeners
     socket.on('member_kicked', handleMemberKicked);
     socket.on('role_changed', handleRoleChanged);
     socket.on('content_updated', handleContentUpdate);
     socket.on('activity_logged', handleActivity);

     // 4. Cleanup on unmount
     return () => {
       socket.emit('leave_project', {
         project_id: projectId,
         user_id: user.id,
       });
       socket.off('member_kicked');
       socket.off('role_changed');
       socket.off('content_updated');
       socket.off('activity_logged');
     };
   }, [projectId, user]);

Reconnection Strategy
---------------------

.. code-block:: typescript

   const socket = io(WS_URL, {
     reconnection: true,
     reconnectionAttempts: 5,
     reconnectionDelay: 1000,
     reconnectionDelayMax: 5000,
     timeout: 20000,
   });

   socket.on('reconnect', (attemptNumber) => {
     console.log('Reconnected after', attemptNumber, 'attempts');
     
     // Rejoin project room
     socket.emit('join_project', {
       project_id: currentProjectId,
       user_id: currentUserId,
     });
   });

   socket.on('reconnect_error', (error) => {
     console.error('Reconnection failed:', error);
     showReconnectingIndicator();
   });

.. note::
   The client automatically rejoins project rooms after reconnection.

Use Cases
=========

Collaborative Note Editing
--------------------------

**Scenario:** Multiple users editing notes simultaneously.

.. code-block:: python

   @router.put("/notes/{note_id}")
   async def update_note(
       note_id: str,
       updates: NoteUpdate,
       current_user: User = Depends(get_current_user),
       db: Session = Depends(get_db)
   ):
       # Update note in database
       note = db.query(Note).filter(Note.id == note_id).first()
       note.content = updates.content
       note.updated_at = datetime.utcnow()
       db.commit()
       
       # Broadcast update
       await emit_content_update(
           project_id=note.project_id,
           update_type="note_updated",
           data={
               "note_id": note_id,
               "updated_by": current_user.display_name,
               "title": note.title
           }
       )
       
       return note

.. code-block:: typescript

   // Client receives update
   socket.on('content_updated', (data) => {
     if (data.type === 'note_updated' && 
         data.data.note_id === currentNoteId) {
       
       // Show indicator
       setShowUpdateBanner(true);
       setBannerMessage(
         `Note updated by ${data.data.updated_by}`
       );
       
       // Offer to refresh
       setTimeout(() => {
         if (confirm('Reload note to see changes?')) {
           refetchNote();
         }
       }, 2000);
     }
   });

Team Member Management
----------------------

**Scenario:** Project leader removes a team member.

.. code-block:: python

   @router.delete("/{project_id}/members/{user_id}")
   async def remove_member(
       project_id: str,
       user_id: str,
       current_user: User = Depends(get_current_user),
       db: Session = Depends(get_db)
   ):
       # Check permissions
       check_leader_permission(project_id, current_user, db)
       
       # Remove from database
       stmt = delete(project_members).where(
           project_members.c.project_id == project_id,
           project_members.c.user_id == user_id
       )
       db.execute(stmt)
       db.commit()
       
       # Notify via WebSocket
       await emit_member_kicked(project_id, user_id)
       
       # Log activity
       await log_activity(
           project_id=project_id,
           user_id=current_user.id,
           activity_type=ActivityType.MEMBER_LEFT,
           description=f"{removed_user.display_name} was removed"
       )
       
       return {"message": "Member removed"}

File Upload Notifications
--------------------------

**Scenario:** User uploads a file, team sees it immediately.

.. code-block:: python

   @router.post("/project/{project_id}/upload")
   async def upload_file(
       project_id: str,
       file: UploadFile,
       current_user: User = Depends(get_current_user),
       db: Session = Depends(get_db)
   ):
       # Save file to MinIO
       object_name = f"files/{project_id}/{uuid4()}"
       minio_client.put_object(
           bucket_name=BUCKET,
           object_name=object_name,
           data=file.file,
           length=file.size
       )
       
       # Create file node
       file_node = FileNode(
           project_id=project_id,
           name=file.filename,
           type=FileNodeType.FILE,
           storage_path=object_name,
           size=str(file.size)
       )
       db.add(file_node)
       db.commit()
       
       # Broadcast to all members
       await emit_content_update(
           project_id=project_id,
           update_type="file_uploaded",
           data={
               "filename": file.filename,
               "size": file.size,
               "uploaded_by": current_user.display_name
           }
       )
       
       return {"file_id": file_node.id}

Testing WebSockets
==================

Server-Side Testing
-------------------

.. code-block:: python

   import pytest
   from socketio import AsyncClient

   @pytest.mark.asyncio
   async def test_join_project():
       client = AsyncClient()
       
       # Connect to server
       await client.connect('http://localhost:8000')
       
       # Join project
       response = await client.call('join_project', {
           'project_id': 'test-project-123',
           'user_id': 'test-user-456'
       })
       
       assert response['status'] == 'success'
       
       await client.disconnect()

   @pytest.mark.asyncio
   async def test_member_kicked_event():
       client = AsyncClient()
       await client.connect('http://localhost:8000')
       
       # Set up event listener
       kicked_data = None
       
       @client.on('member_kicked')
       async def on_kicked(data):
           nonlocal kicked_data
           kicked_data = data
       
       # Join project
       await client.call('join_project', {
           'project_id': 'test-project',
           'user_id': 'user-to-kick'
       })
       
       # Trigger kick (via API call)
       # ... API request ...
       
       # Wait for event
       await client.sleep(1)
       
       assert kicked_data is not None
       assert kicked_data['user_id'] == 'user-to-kick'

Client-Side Testing
-------------------

.. code-block:: typescript

   import { io } from 'socket.io-client';

   describe('WebSocket Integration', () => {
     let socket: Socket;

     beforeEach(() => {
       socket = io('http://localhost:8000', {
         transports: ['websocket'],
       });
     });

     afterEach(() => {
       socket.disconnect();
     });

     test('should join project room', (done) => {
       socket.emit('join_project', {
         project_id: 'test-123',
         user_id: 'user-456',
       }, (response) => {
         expect(response.status).toBe('success');
         done();
       });
     });

     test('should receive content updates', (done) => {
       socket.on('content_updated', (data) => {
         expect(data.type).toBe('note_created');
         expect(data.project_id).toBe('test-123');
         done();
       });

       // Trigger update via API
       // ...
     });
   });

Debugging
=========

Enable Debug Logging
--------------------

**Server:**

.. code-block:: python

   import logging
   logging.basicConfig(level=logging.DEBUG)
   
   sio = socketio.AsyncServer(
       logger=True,
       engineio_logger=True
   )

**Client:**

.. code-block:: typescript

   import { io } from 'socket.io-client';

   const socket = io(WS_URL, {
     transports: ['websocket'],
   });

   socket.onAny((event, ...args) => {
     console.log('WS Event:', event, args);
   });

Monitor Active Connections
---------------------------

.. code-block:: python

   @router.get("/debug/websocket/status")
   async def websocket_status():
       """Debug endpoint to view WebSocket status"""
       return {
           "total_sessions": len(user_sessions),
           "active_rooms": len(project_rooms),
           "room_details": {
               room_id: list(users)
               for room_id, users in project_rooms.items()
           }
       }

Common Issues
-------------

.. error::
   **Connection refused**
   
   Check that the WebSocket server is running and the URL is correct.
   
   .. code-block:: bash
   
      # Verify server is listening
      netstat -an | grep 8000

.. error::
   **Reconnection loop**
   
   Client may be sending invalid data during join. Check authentication.

.. error::
   **Events not received**
   
   Ensure client has joined the correct room. Check room names match.

Performance Considerations
==========================

Connection Limits
-----------------

.. code-block:: python

   # Configure Socket.IO for production
   sio = socketio.AsyncServer(
       async_mode="asgi",
       cors_allowed_origins=ALLOWED_ORIGINS,
       max_http_buffer_size=1024 * 1024,  # 1MB
       ping_timeout=60000,                 # 60 seconds
       ping_interval=25000,                # 25 seconds
   )

Scaling with Redis
------------------

For multi-instance deployments:

.. code-block:: python

   import socketio
   from socketio import AsyncRedisManager

   # Use Redis for pub/sub across instances
   mgr = AsyncRedisManager('redis://localhost:6379')
   
   sio = socketio.AsyncServer(
       async_mode="asgi",
       client_manager=mgr
   )

Best Practices
==============

.. tip::
   **Do's:**
   
   - ✅ Use rooms to target broadcasts
   - ✅ Clean up listeners on unmount
   - ✅ Handle reconnection gracefully
   - ✅ Validate all incoming events
   - ✅ Log activities for audit trail
   
   **Don'ts:**
   
   - ❌ Don't send large payloads via WebSocket
   - ❌ Don't forget to leave rooms on disconnect
   - ❌ Don't expose sensitive data in events
   - ❌ Don't rely solely on WebSockets (have fallback)
   - ❌ Don't create too many event types

Security
--------

.. warning::
   WebSocket security considerations:
   
   - Validate user permissions before joining rooms
   - Sanitize all event data
   - Use authentication tokens
   - Rate limit event emissions
   - Monitor for abuse

Next Steps
==========

- Review `api/websockets.rst <api/websockets.rst>`_ for API details
- Check `architecture.rst <architecture.rst>`_ for system design
- Read `development.rst <development.rst>`_ for contributing
- See `troubleshooting.rst <troubleshooting.rst>`_ for common issues
