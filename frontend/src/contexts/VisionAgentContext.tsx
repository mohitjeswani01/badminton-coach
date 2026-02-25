import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { useCoachTelemetry } from "../hooks/useCoachTelemetry";
import { StreamVideoClient, StreamVideo, Call, StreamCall } from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";

export interface PoseKeypoint {
  name: string;
  x: number;
  y: number;
  confidence: number;
}

export interface TaskSkill {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  status: "ready" | "active" | "completed";
  targetMetrics: { label: string; target: string }[];
}

export interface CoachingCue {
  id: string;
  message: string;
  timestamp: number;
}

export interface Metric {
  label: string;
  value: string;
  unit: string;
  trend?: "up" | "down" | "stable";
}

interface VisionAgentState {
  isStreaming: boolean;
  isSyncing: boolean;
  isLoading: boolean;
  isMuted: boolean;
  isConnected: boolean;
  score: number;
  activeTaskId: string | null;
  tasks: TaskSkill[];
  metrics: Metric[];
  keypoints: PoseKeypoint[];
  coachingCues: CoachingCue[];
  transcript: string[];
  selectedFile: File | null;
  streamCall: Call | null;
}

interface VisionAgentActions {
  startSession: () => void;
  endSession: () => void;
  resetSession: () => void;
  toggleMute: () => void;
  selectTask: (taskId: string) => void;
  setSelectedFile: (file: File | null) => void;
}

type VisionAgentContextType = VisionAgentState & VisionAgentActions;

const VisionAgentContext = createContext<VisionAgentContextType | null>(null);

const MOCK_TASKS: TaskSkill[] = [
  {
    id: "ready-stance",
    title: "Ready Stance",
    difficulty: "easy",
    status: "ready",
    targetMetrics: [
      { label: "Knee Flexion", target: "25-35°" },
      { label: "Weight Distribution", target: "50/50" },
      { label: "Racket Height", target: "Chest Level" },
    ],
  },
  {
    id: "serve",
    title: "Backhand Serve",
    difficulty: "medium",
    status: "ready",
    targetMetrics: [
      { label: "Shuttle Height", target: "<1.15m" },
      { label: "Racket Angle", target: "15-25°" },
      { label: "Follow Through", target: "Smooth" },
    ],
  },
  {
    id: "footwork",
    title: "Split Step",
    difficulty: "medium",
    status: "ready",
    targetMetrics: [
      { label: "Timing", target: "Pre-contact" },
      { label: "Foot Width", target: "Shoulder Width" },
      { label: "Landing Balance", target: "Centered" },
    ],
  },
  {
    id: "smash",
    title: "Overhead Smash",
    difficulty: "hard",
    status: "ready",
    targetMetrics: [
      { label: "Elbow Angle", target: "140-160°" },
      { label: "Contact Height", target: ">2.2m" },
      { label: "Wrist Snap Speed", target: ">80°/s" },
    ],
  },
];

const MOCK_KEYPOINTS: PoseKeypoint[] = [
  { name: "nose", x: 0.5, y: 0.15, confidence: 0.95 },
  { name: "left_shoulder", x: 0.42, y: 0.3, confidence: 0.92 },
  { name: "right_shoulder", x: 0.58, y: 0.3, confidence: 0.93 },
  { name: "left_elbow", x: 0.35, y: 0.45, confidence: 0.88 },
  { name: "right_elbow", x: 0.68, y: 0.38, confidence: 0.90 },
  { name: "left_wrist", x: 0.30, y: 0.55, confidence: 0.85 },
  { name: "right_wrist", x: 0.75, y: 0.32, confidence: 0.87 },
  { name: "left_hip", x: 0.44, y: 0.58, confidence: 0.91 },
  { name: "right_hip", x: 0.56, y: 0.58, confidence: 0.90 },
  { name: "left_knee", x: 0.42, y: 0.75, confidence: 0.89 },
  { name: "right_knee", x: 0.58, y: 0.75, confidence: 0.88 },
  { name: "left_ankle", x: 0.40, y: 0.92, confidence: 0.86 },
  { name: "right_ankle", x: 0.60, y: 0.92, confidence: 0.85 },
];

const COACHING_MESSAGES = [
  "Lower your center of gravity",
  "Keep your racket up — be ready!",
  "Good elbow position, hold it",
  "Shift weight to front foot",
  "Faster recovery to base position",
  "Excellent wrist snap!",
  "Wider stance for better balance",
];

export function VisionAgentProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<VisionAgentState>({
    isStreaming: false,
    isSyncing: false,
    isLoading: false,
    isMuted: false,
    isConnected: false,
    score: 0,
    activeTaskId: null,
    tasks: MOCK_TASKS,
    metrics: [
      { label: "Elbow Angle", value: "—", unit: "°" },
      { label: "Knee Flexion", value: "—", unit: "°" },
      { label: "Shoulder Rotation", value: "—", unit: "°" },
      { label: "Hip Alignment", value: "—", unit: "%" },
      { label: "Stance Width", value: "—", unit: "cm" },
    ],
    keypoints: [],
    coachingCues: [],
    transcript: [],
    selectedFile: null,
    streamCall: null,
  });

  const [streamClient, setStreamClient] = useState<StreamVideoClient | null>(null);

  const intervalRef = useRef<number | null>(null);

  // Real-time Telemetry Hook
  const { isConnected, latestPayload } = useCoachTelemetry();

  // Helper to map telemetry data safely to the metrics array format
  const updateMetricsFromTelemetry = useCallback((data: any) => {
    setState((prev) => {
      const newMetrics = [...prev.metrics];

      // Safe access functions for nested (main.py) or flat (test_connection.py) payloads
      const armAngle = data.smash?.arm_angle ?? data.arm_angle;
      const kneeFlexion = data.stance?.avg_knee_flexion ?? data.avg_knee_flexion;
      const isSmash = data.smash?.is_smash ?? data.is_smash;
      const isStance = data.stance?.is_ready_stance;
      const feedback = data.feedback;

      // Map Arm Angle
      if (armAngle !== undefined) {
        const angleIdx = newMetrics.findIndex(m => m.label === "Elbow Angle");
        if (angleIdx >= 0) {
          newMetrics[angleIdx] = { ...newMetrics[angleIdx], value: String(Math.floor(armAngle)) };
        }
      }

      // Map Knee Flexion
      if (kneeFlexion !== undefined) {
        const kneeIdx = newMetrics.findIndex(m => m.label === "Knee Flexion");
        if (kneeIdx >= 0) {
          newMetrics[kneeIdx] = { ...newMetrics[kneeIdx], value: String(Math.floor(kneeFlexion)) };
        }
      }

      // Populate Transcripts/Cues
      let newTranscript = prev.transcript;
      let newCues = prev.coachingCues;

      if (isSmash) {
        const customMsg = feedback || "Great overhead extension!";
        const fullMsg = `[${new Date().toLocaleTimeString()}] ${customMsg} Arm angle at ${Math.floor(armAngle)}°.`;
        if (!prev.transcript[prev.transcript.length - 1]?.includes(customMsg)) {
          newTranscript = [...newTranscript.slice(-19), fullMsg];
          newCues = [...newCues.slice(-4), { id: Date.now().toString(), message: customMsg, timestamp: Date.now() }];
        }
      } else if (feedback) {
        // Handles generic flat feedback sent individually from the mock
        const fullMsg = `[${new Date().toLocaleTimeString()}] [Coach]: ${feedback}`;
        if (!prev.transcript[prev.transcript.length - 1]?.includes(feedback)) {
          newTranscript = [...newTranscript.slice(-19), fullMsg];
          newCues = [...newCues.slice(-4), { id: Date.now().toString(), message: feedback, timestamp: Date.now() }];
        }
      }

      if (isStance) {
        const fullMsg = `[${new Date().toLocaleTimeString()}] Excellent foundation. Knees bent at ${Math.floor(kneeFlexion)}°.`;
        if (!prev.transcript[prev.transcript.length - 1]?.includes("Excellent foundation.")) {
          newTranscript = [...newTranscript.slice(-19), fullMsg];
          newCues = [...newCues.slice(-4), { id: Date.now().toString(), message: "Excellent foundation.", timestamp: Date.now() }];
        }
      }

      return {
        ...prev,
        metrics: newMetrics,
        transcript: newTranscript,
        coachingCues: newCues
      };
    });
  }, []);

  // Sync WebSocket payload updates with context state when streaming
  useEffect(() => {
    if (state.isStreaming && isConnected && latestPayload) {
      updateMetricsFromTelemetry(latestPayload);
    }
  }, [latestPayload, isConnected, state.isStreaming, updateMetricsFromTelemetry]);

  const simulateData = useCallback(() => {
    // Only mock if WebSocket is NOT delivering a connection
    if (isConnected) return;

    setState((prev) => {
      const newMetrics = prev.metrics.map((m) => ({
        ...m,
        value: String(Math.floor(Math.random() * 60) + 100),
        trend: (["up", "down", "stable"] as const)[Math.floor(Math.random() * 3)],
      }));

      const jitteredKeypoints = MOCK_KEYPOINTS.map((kp) => ({
        ...kp,
        x: kp.x + (Math.random() - 0.5) * 0.02,
        y: kp.y + (Math.random() - 0.5) * 0.02,
      }));

      const shouldAddCue = Math.random() > 0.7;
      const newCues = shouldAddCue
        ? [
          ...prev.coachingCues.slice(-4),
          {
            id: Date.now().toString(),
            message: COACHING_MESSAGES[Math.floor(Math.random() * COACHING_MESSAGES.length)],
            timestamp: Date.now(),
          },
        ]
        : prev.coachingCues;

      const shouldAddTranscript = Math.random() > 0.8;
      const newTranscript = shouldAddTranscript
        ? [
          ...prev.transcript.slice(-19),
          `[${new Date().toLocaleTimeString()}] ${COACHING_MESSAGES[Math.floor(Math.random() * COACHING_MESSAGES.length)]}`,
        ]
        : prev.transcript;

      return {
        ...prev,
        metrics: newMetrics,
        keypoints: jitteredKeypoints,
        coachingCues: newCues,
        transcript: newTranscript,
        score: Math.min(100, prev.score + Math.floor(Math.random() * 3)),
        isSyncing: Math.random() > 0.9,
      };
    });
  }, [isConnected]);

  const startSession = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, isStreaming: false }));
    try {
      let callToUse = state.streamCall;

      if (!streamClient) {
        // Fetch Stream API Token generated for the badminton player
        const tokenRes = await fetch("http://127.0.0.1:8000/get-token");
        const { token } = await tokenRes.json();

        const client = new StreamVideoClient({
          apiKey: "snqahz79zupf", // Provided from server's Stream credentials
          user: { id: "user_badminton_player" },
          token,
        });
        setStreamClient(client);

        const call = client.call("default", "default_stream_call");
        await call.join({ create: true });
        callToUse = call;
      }

      setState((prev) => ({ ...prev, streamCall: callToUse! }));

      // We no longer send files via POST /analyze-file. 
      // MediaLayer will instead capture the HTML video and publish it via streamCall.
      if (!state.selectedFile) {
        await callToUse?.camera.enable();
      }

      // Tell the backend Agent hardware to join the WebRTC call
      await fetch("http://127.0.0.1:8000/start-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ call_id: "default_stream_call" }),
      });

      // Activate streaming UI modes; websocket data will flow automatically if connected
      setState((prev) => ({ ...prev, isLoading: false, isStreaming: true, isSyncing: false }));

      // Fallback: If not connected to WS backend, start simulating mock data so UI works without it
      if (!isConnected) {
        intervalRef.current = window.setInterval(simulateData, 800);
      }
    } catch (e) {
      console.error("Failed to start backend session", e);
      setState((prev) => ({ ...prev, isLoading: false, isStreaming: false, isSyncing: false }));
    }
  }, [simulateData, isConnected, state.selectedFile, streamClient, state.streamCall]);

  const endSession = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (state.streamCall) {
      state.streamCall.camera.disable();
      state.streamCall.microphone.disable();
    }
    setState((prev) => ({ ...prev, isStreaming: false, isSyncing: false, keypoints: [], selectedFile: null }));
  }, [state.streamCall]);

  const resetSession = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setState((prev) => ({
      ...prev,
      isStreaming: false,
      isSyncing: false,
      isLoading: false,
      score: 0,
      keypoints: [],
      coachingCues: [],
      transcript: [],
      selectedFile: null,
      streamCall: null,
      metrics: prev.metrics.map((m) => ({ ...m, value: "—", trend: undefined })),
      tasks: MOCK_TASKS,
      activeTaskId: null,
    }));
  }, []);

  const toggleMute = useCallback(() => {
    setState((prev) => ({ ...prev, isMuted: !prev.isMuted }));
  }, []);

  const selectTask = useCallback((taskId: string) => {
    setState((prev) => ({
      ...prev,
      activeTaskId: taskId,
      tasks: prev.tasks.map((t) => ({
        ...t,
        status: t.id === taskId ? "active" : t.status === "active" ? "ready" : t.status,
      })),
    }));
  }, []);

  const setSelectedFile = useCallback((file: File | null) => {
    setState((prev) => ({ ...prev, selectedFile: file }));
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (streamClient) {
        streamClient.disconnectUser();
      }
    };
  }, [streamClient]);

  return (
    <VisionAgentContext.Provider
      value={{ ...state, isConnected, startSession, endSession, resetSession, toggleMute, selectTask, setSelectedFile }}
    >
      {streamClient ? (
        <StreamVideo client={streamClient}>
          {state.streamCall ? (
            <StreamCall call={state.streamCall}>
              {children}
            </StreamCall>
          ) : (
            children
          )}
        </StreamVideo>
      ) : (
        children
      )}
    </VisionAgentContext.Provider>
  );
}

export function useVisionAgent() {
  const ctx = useContext(VisionAgentContext);
  if (!ctx) throw new Error("useVisionAgent must be used within VisionAgentProvider");
  return ctx;
}
