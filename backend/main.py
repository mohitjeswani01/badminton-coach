import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import json
import logging
import os
import torch
import math
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
                
        # Force CPU decoding to avoid hardware/CUDA acceleration bugs
        device = "cpu"
        
        # Note: OpenAI Realtime fallback was requested but is not supported by the 
        # current version of the `vision_agents` SDK installed in this environment.
        # Defaulting to Gemini Realtime at 5 FPS to reduce latency.
        
        print("[DEBUG] Using Gemini Realtime LLM (Default)")
        active_llm = gemini.Realtime(fps=4)

        # Native SDK Construction matching golf_coach exactly
        agent = Agent(
            edge=Edge(),
            agent_user=User(name="AI Badminton Coach", id="badminton-coach"),
            instructions=coach_prompt,
            llm=active_llm,
            tts=elevenlabs.TTS(api_key=ELEVENLABS_API_KEY),
            processors=[ultralytics.YOLOPoseProcessor(model_path="yolo11n-pose.pt", device=device)]
        )
        
        # Native Telemetry Intercept for Frontend UI Syncing
        from vision_agents.core.events import EventManager, BaseEvent
        from vision_agents.core.edge.events import TrackAddedEvent, TrackRemovedEvent
        from vision_agents.core.llm.events import RealtimeResponseEvent

        @agent.events.subscribe
        async def on_generic_event(event: BaseEvent):
            # Print all events for deep debugging
            event_type = getattr(event, "type", type(event).__name__)
            print(f"[GLOBAL EVENT SNIFFER] Event captured: {event_type}")

            if event_type in ["agent.say", "agent.speech"]:
                print(f"[AUDIO DEBUG] Agent speaking: {getattr(event, 'text', '')}")

            if hasattr(event, "frame"):
                print("[FRAME DEBUG] FRAME RECEIVED")
            
            if hasattr(event, "keypoints"):
                try: 
                    print(f"[YOLO DEBUG] POSE DETECTED with {len(event.keypoints)} keypoints")
                except TypeError:
                    pass
        
        @agent.events.subscribe
        async def on_track_added(event: TrackAddedEvent):
            print(f"[EVENT DEBUG] Track Added: {event.track_type} | id: {event.track_id}")

        @agent.events.subscribe
        async def on_track_removed(event: TrackRemovedEvent):
            print(f"[EVENT DEBUG] Track Removed: {event.track_type} | id: {event.track_id}")
            
        @agent.events.subscribe
        async def on_agent_response(event: RealtimeResponseEvent):
            event_type = getattr(event, "type", "unknown")
            print(f"[EVENT DEBUG] {event_type}") # Sniffer
            
            # Capture speech for Live Transcript
            if event_type in ["agent.say", "agent.speech", "agent.say_done"]:
                text = getattr(event, "text", "")
                if text:
                    payload = {
                        "type": "transcript",
                        "text": text
                    }
                    telemetry_queue.put_nowait(payload)
                
            elif "pose_data" in event_type or "keypoints" in event_type or "yolo" in event_type.lower():
                print("[FRAME DEBUG] frame received")
                keypoints = getattr(event, "keypoints", [])
                print("[YOLO DEBUG] Pose detected:", keypoints)
                if keypoints:
                    payload = {
                        "type": "pose_telemetry",
                        "keypoints": keypoints
                    }
                    
                    # Compute Angles for Analytics Panel
                    try:
                        def get_kp(name):
                            for kp in keypoints:
                                if kp.get("name") == name: return kp
                            return None

                        def calc_angle(p1, p2, p3):
                            if not (p1 and p2 and p3): return None
                            angle = math.degrees(math.atan2(p3['y'] - p2['y'], p3['x'] - p2['x']) - 
                                                 math.atan2(p1['y'] - p2['y'], p1['x'] - p2['x']))
                            angle = abs(angle)
                            return angle if angle <= 180 else 360 - angle

                        # Right Arm Angle (Shoulder -> Elbow -> Wrist)
                        r_sh, r_el, r_wr = get_kp("right_shoulder"), get_kp("right_elbow"), get_kp("right_wrist")
                        arm_angle = calc_angle(r_sh, r_el, r_wr)
                        if arm_angle:
                            payload["arm_angle"] = arm_angle
                            
                        # Right Knee Flexion (Hip -> Knee -> Ankle)
                        r_hp, r_kn, r_an = get_kp("right_hip"), get_kp("right_knee"), get_kp("right_ankle")
                        knee_flexion = calc_angle(r_hp, r_kn, r_an)
                        if knee_flexion:
                            payload["avg_knee_flexion"] = knee_flexion
                            
                    except Exception as e:
                        print(f"[MATH ERROR] Failed to calculate angles: {e}")

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
                    
                    async def log_tracks():
                        while True:
                            try:
                                parts = agent_instance.edge._connection.participants_state.get_participants()
                                agent_has_tracks = False
                                for p in parts:
                                    print(f"--- [TRACK POLICE] User: {p.user_id} | Tracks: {p.published_tracks} ---")
                                    if p.user_id == "badminton-coach" and p.published_tracks:
                                        agent_has_tracks = True
                                
                                if not agent_has_tracks:
                                    print("--- WARNING: Agent has no audio track ---")
                            except Exception as e:
                                print(f"--- [TRACK POLICE ERROR] {e} ---")
                            await asyncio.sleep(2.0)
                    asyncio.create_task(log_tracks())
                    
                    try:
                        print("--- [DEBUG] Calling agent_instance.say() to force audio track creation ---")
                        await agent_instance.say("Starting coaching session.")
                        print("--- [DEBUG] agent.say() completed successfully ---")
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
