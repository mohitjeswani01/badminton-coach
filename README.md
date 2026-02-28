# 🏸 AI Badminton Coach

An AI-powered, real-time badminton coaching platform that uses **computer vision**, **pose estimation**, and **large language models** to analyze player technique and deliver instant feedback through voice and text.

> Built with Vision Agents SDK, Google Gemini, YOLO Pose Estimation, Stream WebRTC, and ElevenLabs TTS.

---

## 📸 Screenshots

<!-- Add your screenshots here -->
<!-- ![Dashboard](screenshots/dashboard.png) -->
<!-- ![Pose Estimation](screenshots/pose-estimation.png) -->
<!-- ![AI Chat](screenshots/ai-chat.png) -->

> **TODO:** Add screenshots of the dashboard, pose overlay, and AI chat panel here.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│                  (React + Vite + Tailwind)                   │
│                                                             │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  Camera   │  │  Dashboard   │  │   AI Chat Panel       │  │
│  │  Feed     │  │  (Metrics,   │  │   (OpenAI / Gemini)   │  │
│  │          │  │   Cues,      │  │   POST /chat           │  │
│  │          │  │   Transcript)│  │                       │  │
│  └────┬─────┘  └──────┬───────┘  └───────────┬───────────┘  │
│       │               │                      │              │
│       │  WebRTC       │  WebSocket           │  REST API    │
│       │  (Stream SDK) │  /ws/telemetry       │  /chat       │
└───────┼───────────────┼──────────────────────┼──────────────┘
        │               │                      │
┌───────┼───────────────┼──────────────────────┼──────────────┐
│       ▼               ▼                      ▼              │
│                       BACKEND                               │
│                  (FastAPI + Python)                          │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Vision Agents SDK                         │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐ │  │
│  │  │  Gemini  │  │  YOLO    │  │  ElevenLabs TTS     │ │  │
│  │  │  Realtime│  │  Pose    │  │  (Voice Feedback)   │ │  │
│  │  │  LLM     │  │  v11     │  │                     │ │  │
│  │  └──────────┘  └──────────┘  └──────────────────────┘ │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐  │
│  │         Standalone Chat Endpoint (/chat)               │  │
│  │    OpenAI gpt-4o-mini  ──▶  Gemini 2.0 Flash (REST)   │  │
│  │         (Fallback chain, isolated from agent)          │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────────────────────┐  │
│  │  Stream WebRTC   │  │  WebSocket Telemetry Broadcast  │  │
│  │  (Video/Audio)   │  │  (Pose data + Transcripts)      │  │
│  └──────────────────┘  └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚡ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui |
| **Backend** | FastAPI, Python 3.12, Uvicorn |
| **Vision AI** | Vision Agents SDK, YOLO v11 Pose Estimation |
| **LLMs** | Google Gemini Realtime (coaching), OpenAI GPT-4o-mini + Gemini 2.0 Flash (chat) |
| **Voice** | ElevenLabs TTS |
| **Real-Time** | Stream WebRTC (video/audio), WebSocket (telemetry) |

---

## 🚀 How to Run (Local Development)

### Prerequisites

- **Node.js** ≥ 18 and **npm**
- **Python** ≥ 3.10
- API keys: Stream, Google AI, ElevenLabs (and optionally OpenAI)

### 1. Clone the Repository

```bash
git clone https://github.com/mohitjeswani01/badminton-coach.git
cd badminton-coach
```

### 2. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file with your keys
cp .env.example .env   # Then edit with your actual API keys

# Start the server
uvicorn main:app --reload
```

The backend runs at **http://localhost:8000**.

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env.local
# VITE_STREAM_API_KEY=your_stream_key
# VITE_BACKEND_URL=http://localhost:8000

# Start dev server
npm run dev
```

The frontend runs at **http://localhost:8080**.

---

## 🌐 Production Deployment

- Backend deployment on **Render**
- Frontend deployment on **Vercel** or **Netlify**
- Environment variable configuration
- CORS setup

---

## 🧠 How It Works

1. **Player opens the dashboard** → Camera feed starts via WebRTC (Stream SDK)
2. **Video frames stream to backend** → YOLO v11 Pose processes each frame for keypoint detection
3. **Gemini Realtime LLM** → Analyzes pose data in real-time and generates coaching feedback
4. **ElevenLabs TTS** → Converts feedback to natural voice audio streamed back via WebRTC
5. **Telemetry WebSocket** → Broadcasts pose angles, transcripts, and cues to the dashboard
6. **AI Chat Panel** → Independent text chat with OpenAI/Gemini for on-demand coaching Q&A

---

## 📁 Project Structure

```
badminton-coach/
├── backend/
│   ├── main.py               # FastAPI server, WebRTC, chat endpoint
│   ├── badminton_coach.md     # AI coach system prompt
│   ├── requirements.txt       # Python dependencies
│   ├── Procfile               # Production server config
│   └── .env                   # API keys (not committed)
├── frontend/
│   ├── src/
│   │   ├── components/dashboard/  # Dashboard UI components
│   │   ├── contexts/              # VisionAgentContext (state management)
│   │   └── hooks/                 # useCoachTelemetry WebSocket hook
│   ├── .env.local                 # Frontend env vars
│   └── vite.config.ts             # Vite configuration
└── README.md
```

---

## 📝 License

This project is built for the Stream x Google AI Hackathon.

---

## 👤 Author

**Mohit Jeswani** — [GitHub](https://github.com/mohitjeswani01)
