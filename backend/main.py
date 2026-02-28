import asyncio
import json
import logging
import os
import torch
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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
from vision_agents.plugins import gemini, ultralytics, elevenlabs
import getstream

try:
    if not os.path.exists("yolo11n-pose.pt") or os.path.getsize("yolo11n-pose.pt") < 1000000:
        print("[DEBUG] Downloading yolo11n-pose.pt via Ultralytics YOLO...")
        from ultralytics import YOLO
        YOLO('yolo11n-pose.pt')
except Exception as e:
    print(f"[DEBUG] Model check error: {e}")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

telemetry_queue = asyncio.Queue()

@app.get("/")
async def root():
    return {"status": "ok", "message": "AI Badminton Coach AI Engine is Online and Ready."}

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
    drill: str = "ready-stance"
    ready: bool = False

@app.post("/start-session")
async def start_session(request: SessionRequest):
    try:
        # Drain old queue
        while not telemetry_queue.empty():
            telemetry_queue.get_nowait()
            telemetry_queue.task_done()

        # Load instructions from markdown file correctly
        coach_prompt = "You are an AI coach."
        if os.path.exists("badminton_coach.md"):
            with open("badminton_coach.md", "r", encoding="utf-8") as f:
                coach_prompt = f.read()

        coach_prompt += f"\n\nCURRENT DRILL: {request.drill}"
                
        device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # Native SDK Construction matching golf_coach exactly
        agent = Agent(
            edge=Edge(),
            agent_user=User(name="AI Badminton Coach", id="badminton-coach"),
            instructions=coach_prompt,
            llm=gemini.Realtime(fps=10), # Native audio-video duplex
            processors=[ultralytics.YOLOPoseProcessor(model_path="yolo11n-pose.pt", device=device)]
        )
        
        # Native Telemetry Intercept for Frontend UI Syncing
        from vision_agents.core.events import BaseEvent
        @agent.events.subscribe
        async def on_agent_event(event: BaseEvent):
            event_type = getattr(event, "type", "unknown")
            print(f"[EVENT DEBUG] {event_type}") # Sniffer
            
            if event_type == "agent.say_started":
                payload = {
                    "type": "transcript",
                    "text": getattr(event, "text", "Agent Speech Started...")
                }
                telemetry_queue.put_nowait(payload)
                
            elif "pose_data" in event_type or "keypoints" in event_type or "yolo" in event_type.lower():
                keypoints = getattr(event, "keypoints", [])
                if keypoints:
                    payload = {
                        "type": "pose_telemetry",
                        "keypoints": keypoints
                    }
                    telemetry_queue.put_nowait(payload)

        async def run_agent_task(agent_instance: Agent, c_id: str):
            print(f"--- [AGENT INIT] Aligning directly with Stream SDK for call_id: {c_id} ---")
            try:
                import getstream
                print(f"--- [WAIT] Fetching Stream client for call: {c_id} ---")
                client = getstream.AsyncStream(api_key=STREAM_API_KEY, api_secret=STREAM_API_SECRET)
                call = client.video.call("default", c_id)
                
                print("--- [WAIT] Entering native SDK agent.join() context ---")
                async with agent_instance.join(call):
                    print("--- [SUCCESS] Native Agent fully bound to WebRTC. Monitoring... ---")
                    await asyncio.sleep(2.0)
                    
                    try:
                        print("--- [DEBUG] Calling agent.llm.simple_response() ---")
                        await agent_instance.llm.simple_response(text=f"Say hi to Mohit! You are fully connected.")
                        print("--- [DEBUG] simple_response() completely successfully ---")
                    except Exception as speech_err:
                        print(f"--- [SPEECH INVOCATION FATAL ERROR]: {speech_err} ---")
                        import traceback
                        traceback.print_exc()
                        
                    print("--- [DEBUG] Agent is now monitoring the stream indefinitely... ---")
                    try:
                        # Keep the agent alive so it can process video frames!
                        await asyncio.Event().wait()
                    except asyncio.CancelledError:
                        print("--- [DEBUG] Agent disconnected cleanly. ---")
            except Exception as e:
                import traceback
                print(f"--- [WEBRTC FATAL CRASH CODE: {str(e)[:50]}] ---")
                traceback.print_exc()

        asyncio.create_task(run_agent_task(agent, request.call_id))
        
        return {"status": "Agent starting", "call_id": request.call_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/get-token")
async def get_token():
    try:
        client = getstream.AsyncStream(api_key=STREAM_API_KEY, api_secret=STREAM_API_SECRET)
        token = client.create_token("user_badminton_player")
        return {"token": token}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/telemetry")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    print("--- [WS] Client Handshake Successful ---")
    try:
        while True:
            await websocket.receive_text()
            pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)
