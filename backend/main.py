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
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")

if not all([STREAM_API_KEY, STREAM_API_SECRET, GOOGLE_API_KEY]):
    raise RuntimeError("Missing required environment variables. Ensure STREAM_API_KEY, STREAM_API_SECRET, and GOOGLE_API_KEY are set.")

from vision_agents.core import Agent, User

from vision_agents.plugins.getstream import Edge
from vision_agents.plugins.gemini import VLM
from vision_agents.plugins.ultralytics import YOLOPoseProcessor
from vision_agents.plugins.elevenlabs import TTS

from physics_engine import analyze_smash, analyze_ready_stance
from audio_engine import Pyttsx3TTS, ResilientTTS
import time

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

global_agent = None
active_drill = "ready-stance"
last_tts_time = 0.0
app_loop = None

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
    global app_loop
    app_loop = asyncio.get_running_loop()
    asyncio.create_task(broadcast_telemetry_task())

class SessionRequest(BaseModel):
    call_id: str
    drill: str = "ready-stance"

def pose_processor_callback(frame_data):
    """
    Sub-30ms execution path.
    Extract keypoints, run physics engine, embed payload into queue.
    """
    global last_tts_time, active_drill, global_agent, app_loop
    try:
        # Check dictionary layout from monkey-patched YOLO pose processor
        if isinstance(frame_data, dict) and "persons" in frame_data:
            persons = frame_data["persons"]
            if len(persons) > 0:
                # Grab first person detected
                person_keypoints = persons[0]["keypoints"]
                
                smash_data = analyze_smash(person_keypoints)
                stance_data = analyze_ready_stance(person_keypoints)
                    
                # Logic Branching
                trigger_tts = False
                feedback_msg = ""
                if active_drill == "smash" and smash_data["is_smash"]:
                    trigger_tts = True
                    feedback_msg = f"Focus on that extension! Elbow reached {smash_data['arm_angle']} degrees."
                elif active_drill == "ready-stance" and stance_data["is_ready_stance"]:
                    trigger_tts = True
                    feedback_msg = f"Hold that stance! Great knee flexion at {stance_data['avg_knee_flexion']} degrees."

                payload = {
                    "type": "pose_telemetry",
                    "smash": smash_data,
                    "stance": stance_data
                }
                
                current_time = time.time()
                if trigger_tts and (current_time - last_tts_time > 10.0):
                    last_tts_time = current_time
                    payload["feedback"] = feedback_msg
                    if global_agent and app_loop:
                        asyncio.run_coroutine_threadsafe(global_agent.say(feedback_msg), app_loop)

                # Non-blocking enqueue
                try:
                    telemetry_queue.put_nowait(payload)
                except asyncio.QueueFull:
                    pass
    except Exception as e:
        print(f"Pose processing err: {e}")

@app.post("/start-session")
async def start_session(request: SessionRequest):
    global active_drill, global_agent
    
    try:
        active_drill = request.drill
        edge = Edge()
        vlm = VLM()
        user = User(id="user_badminton_coach")
        
        primary_tts = TTS(api_key=ELEVENLABS_API_KEY)
        fallback_tts = Pyttsx3TTS()
        resilient_tts = ResilientTTS(primary=primary_tts, fallback=fallback_tts)
        
        pose_processor = YOLOPoseProcessor(model_path="yolo11n-pose.pt")
        
        # Monkey-patch add_pose_to_ndarray to intercept telemetry data, as the SDK drops it by default
        original_add_pose = pose_processor.add_pose_to_ndarray
        async def intercepted_add_pose(frame_array):
            annotated_array, pose_data = await original_add_pose(frame_array)
            if isinstance(pose_data, dict) and "persons" in pose_data:
                try:
                    pose_processor_callback(pose_data)
                except Exception as e:
                    print(f"Callback error: {e}")
            return annotated_array, pose_data
            
        pose_processor.add_pose_to_ndarray = intercepted_add_pose
            
        agent = Agent(
            agent_user=user,
            llm=vlm,
            edge=edge,
            tts=resilient_tts,
            processors=[pose_processor]
        )
        global_agent = agent
        
        async def run_agent_task(agent_instance, c_id):
            try:
                import getstream
                client = getstream.AsyncStream(api_key=STREAM_API_KEY, api_secret=STREAM_API_SECRET)
                call = client.video.call("default", c_id)
                await call.create(data={"created_by_id": "user_badminton_coach"})
                async with agent_instance.join(call):
                    await agent_instance.speak(f"Starting {request.drill} drill. Make sure you are in the frame.")
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
