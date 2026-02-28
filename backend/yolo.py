import asyncio
from vision_agents.core import Agent, User
from vision_agents.core.events import BaseEvent
from vision_agents.plugins import ultralytics, gemini
from vision_agents.plugins.getstream import Edge
import torch

# IMPORTANT NOTE FOR BADMINTON COACH:
# You DO NOT need to run this file for the AI Coach to work. 
# Vision Agents automatically runs YOLO when you pass it in the `processors` list (as seen in main.py).
# This file is provided purely as an example if you ever wanted to decouple YOLO from the main agent
# or intercept the bounding boxes and keypoints for custom logging or analytics without LLM overhead.

async def main():
    print("Initializing YOLO Example Pipeline...")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    
    agent = Agent(
        edge=Edge(),
        agent_user=User(name="YOLO Test Agent", id="yolo-test"),
        instructions="Analyze the posture.",
        llm=gemini.Realtime(fps=5),
        # 1. ADD YOLO TO THE PROCESSORS LIST
        processors=[ultralytics.YOLOPoseProcessor(model_path="yolo11n-pose.pt", device=device)]
    )

    # 2. SUBSCRIBE TO EVENTS TO INTERCEPT YOLO KEYPOINTS
    @agent.events.subscribe
    async def on_agent_event(event: BaseEvent):
        event_type = getattr(event, "type", "unknown")
        
        if "pose_data" in event_type or "keypoints" in event_type or "yolo" in event_type.lower():
            keypoints = getattr(event, "keypoints", [])
            
            if keypoints:
                # 3. DO CUSTOM PROCESSING HERE
                print("\n[YOLO EVENT FIRED]")
                print(f"Detected {len(keypoints)} keypoints in frame!")
                
                # Example: Extract right elbow confidence
                for kp in keypoints:
                    if kp.get("name") == "right_elbow":
                        x, y, conf = kp.get("x", 0), kp.get("y", 0), kp.get("confidence", 0)
                        print(f"Right Elbow is at X:{x:.2f}, Y:{y:.2f} (Confidence: {conf:.2f})")
                        
                # 4. SEND TO FRONTEND (Example logic for websocket)
                # payload = {"type": "pose_telemetry", "keypoints": keypoints}
                # await websocket.send_json(payload)

    print("YOLO Pipeline is ready to attach to a Stream WebRTC call.")
    print("To test live, you would do: async with agent.join(stream_call): await asyncio.Event().wait()")

if __name__ == "__main__":
    asyncio.run(main())
