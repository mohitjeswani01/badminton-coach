import asyncio
import websockets
import json
import random
import time

async def send_mock_telemetry():
    uri = "ws://127.0.0.1:8000/ws/telemetry"
    print(f"Connecting to {uri}...")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ Connected! Sending 5 seconds of mock data...")
            
            for i in range(5):
                # We simulate a "Smash" on the 3rd second
                is_smash = True if i == 2 else False
                angle = 170 if is_smash else random.randint(140, 160)
                
                payload = {
                    "arm_angle": angle,
                    "avg_knee_flexion": random.randint(25, 35),
                    "is_smash": is_smash,
                    "feedback": "Perfect extension!" if is_smash else "Keep your racket up",
                    "timestamp": time.time()
                }
                
                await websocket.send(json.dumps(payload))
                print(f"Sent: Smash={is_smash}, Angle={angle}")
                await asyncio.sleep(1)
                
            print("✅ Test complete. Check your dashboard!")
    except Exception as e:
        print(f"❌ Failed: {e}")

if __name__ == "__main__":
    asyncio.run(send_mock_telemetry())