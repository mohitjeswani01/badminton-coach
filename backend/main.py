import asyncio
import json
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import os
from dotenv import load_dotenv

load_dotenv()

STREAM_API_KEY = os.getenv("STREAM_API_KEY")
STREAM_API_SECRET = os.getenv("STREAM_API_SECRET")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

if not all([STREAM_API_KEY, STREAM_API_SECRET, GOOGLE_API_KEY]):
    raise RuntimeError("Missing required environment variables. Ensure STREAM_API_KEY, STREAM_API_SECRET, and GOOGLE_API_KEY are set.")

from vision_agents.core import Agent, User

from vision_agents.plugins.getstream import Edge
from vision_agents.plugins.gemini import VLM
from vision_agents.plugins.ultralytics import YOLOPoseProcessor

from physics_engine import analyze_smash, analyze_ready_stance

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://127.0.0.1:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "ok", "message": "AI Badminton Coach API Server Running"}

telemetry_queue = asyncio.Queue()

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in list(self.active_connections):
            try:
                await connection.send_text(message)
            except Exception as e:
                print(f"Broadcast error: {e}")
                self.disconnect(connection)

manager = ConnectionManager()

async def broadcast_telemetry_task():
    while True:
        data = await telemetry_queue.get()
        await manager.broadcast(json.dumps(data))
        telemetry_queue.task_done()

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(broadcast_telemetry_task())

class SessionRequest(BaseModel):
    call_id: str

def pose_processor_callback(frame_data):
    """
    Sub-30ms execution path.
    Extract keypoints, run physics engine, embed payload into queue.
    """
    try:
        # Check standard layout: frame_data with keypoints
        if hasattr(frame_data, 'keypoints') and frame_data.keypoints is not None:
            # Check if there are any detections in the tensor
            if len(frame_data.keypoints) > 0:
                # Try handling direct ultralytics Results object vs SDK FrameData
                kp = getattr(frame_data.keypoints, 'data', frame_data.keypoints)
                if len(kp) > 0 and len(kp[0]) > 0:
                    # Grab first person detected
                    person_keypoints = kp[0]
                    
                    smash_data = analyze_smash(person_keypoints)
                    stance_data = analyze_ready_stance(person_keypoints)
                    
                    payload = {
                        "type": "pose_telemetry",
                        "smash": smash_data,
                        "stance": stance_data
                    }
                    
                    # Non-blocking enqueue
                    try:
                        telemetry_queue.put_nowait(payload)
                    except asyncio.QueueFull:
                        pass
    except Exception as e:
        print(f"Pose processing err: {e}")

@app.post("/start-session")
async def start_session(request: SessionRequest):
    try:
        edge = Edge()
        vlm = VLM()
        user = User(id="user_badminton_coach")
        
        pose_processor = YOLOPoseProcessor(model_path="yolo11n-pose.pt")
        
        if hasattr(pose_processor, 'set_callback'):
            pose_processor.set_callback(pose_processor_callback)
            
        agent = Agent(
            agent_user=user,
            llm=vlm,
            edge=edge,
            processors=[pose_processor]
        )
        
        async def run_agent_task(agent_instance, c_id):
            try:
                import getstream
                client = getstream.AsyncStream(api_key=STREAM_API_KEY, api_secret=STREAM_API_SECRET)
                call = client.video.call("default", c_id)
                await call.create(data={"created_by_id": "user_badminton_coach"})
                async with agent_instance.join(call):
                    await agent_instance.finish()
            except Exception as e:
                import traceback
                traceback.print_exc()
                print(f"Agent run background task failed: {e}")

        asyncio.create_task(run_agent_task(agent, request.call_id))
        
        return {"status": "Agent starting", "call_id": request.call_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/get-token")
async def get_token():
    try:
        import getstream
        client = getstream.AsyncStream(api_key=STREAM_API_KEY, api_secret=STREAM_API_SECRET)
        token = client.create_token("user_badminton_player")
        return {"token": token}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/telemetry")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive; just pass if a message arrives
            message = await websocket.receive_text()
            pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)
