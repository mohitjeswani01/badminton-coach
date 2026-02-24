import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";

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
  score: number;
  activeTaskId: string | null;
  tasks: TaskSkill[];
  metrics: Metric[];
  keypoints: PoseKeypoint[];
  coachingCues: CoachingCue[];
  transcript: string[];
}

interface VisionAgentActions {
  startSession: () => void;
  endSession: () => void;
  resetSession: () => void;
  toggleMute: () => void;
  selectTask: (taskId: string) => void;
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
  });

  const intervalRef = useRef<number | null>(null);

  const simulateData = useCallback(() => {
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
  }, []);

  const startSession = useCallback(() => {
    setState((prev) => ({ ...prev, isLoading: true, isStreaming: false }));
    setTimeout(() => {
      setState((prev) => ({ ...prev, isLoading: false, isStreaming: true, isSyncing: false }));
      intervalRef.current = window.setInterval(simulateData, 800);
    }, 500);
  }, [simulateData]);

  const endSession = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setState((prev) => ({ ...prev, isStreaming: false, isSyncing: false, keypoints: [] }));
  }, []);

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

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <VisionAgentContext.Provider
      value={{ ...state, startSession, endSession, resetSession, toggleMute, selectTask }}
    >
      {children}
    </VisionAgentContext.Provider>
  );
}

export function useVisionAgent() {
  const ctx = useContext(VisionAgentContext);
  if (!ctx) throw new Error("useVisionAgent must be used within VisionAgentProvider");
  return ctx;
}
