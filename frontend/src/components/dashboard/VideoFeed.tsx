import { useVisionAgent } from "@/contexts/VisionAgentContext";
import { useEffect, useRef } from "react";
import { Loader2, WifiOff, Video } from "lucide-react";

const SKELETON_CONNECTIONS = [
  ["nose", "left_shoulder"], ["nose", "right_shoulder"],
  ["left_shoulder", "right_shoulder"],
  ["left_shoulder", "left_elbow"], ["left_elbow", "left_wrist"],
  ["right_shoulder", "right_elbow"], ["right_elbow", "right_wrist"],
  ["left_shoulder", "left_hip"], ["right_shoulder", "right_hip"],
  ["left_hip", "right_hip"],
  ["left_hip", "left_knee"], ["left_knee", "left_ankle"],
  ["right_hip", "right_knee"], ["right_knee", "right_ankle"],
];

export default function VideoFeed() {
  const { isStreaming, isLoading, isSyncing, score, keypoints, coachingCues } = useVisionAgent();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || keypoints.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Draw connections
    ctx.strokeStyle = "hsl(142, 72%, 50%)";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    const kpMap = Object.fromEntries(keypoints.map((kp) => [kp.name, kp]));
    for (const [a, b] of SKELETON_CONNECTIONS) {
      if (kpMap[a] && kpMap[b]) {
        ctx.beginPath();
        ctx.moveTo(kpMap[a].x * w, kpMap[a].y * h);
        ctx.lineTo(kpMap[b].x * w, kpMap[b].y * h);
        ctx.stroke();
      }
    }

    // Draw keypoints
    ctx.globalAlpha = 1;
    for (const kp of keypoints) {
      ctx.beginPath();
      ctx.arc(kp.x * w, kp.y * h, 4, 0, Math.PI * 2);
      ctx.fillStyle = kp.confidence > 0.9 ? "hsl(142, 72%, 50%)" : "hsl(38, 92%, 55%)";
      ctx.fill();
      ctx.strokeStyle = "hsl(220, 40%, 8%)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }, [keypoints]);

  const latestCue = coachingCues[coachingCues.length - 1];

  return (
    <div className="video-container w-full">
      {/* Dark background simulating camera feed */}
      <div className="absolute inset-0 bg-gradient-to-br from-secondary/30 to-background" />

      {/* Canvas overlay */}
      <canvas
        ref={canvasRef}
        width={960}
        height={540}
        className="absolute inset-0 h-full w-full"
      />

      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Connecting camera…</p>
        </div>
      )}

      {/* Idle state */}
      {!isStreaming && !isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
          <Video className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Start a session to begin</p>
        </div>
      )}

      {/* Score badge */}
      {isStreaming && (
        <div className="absolute right-3 top-3 z-20 flex items-center gap-2 rounded-lg border border-primary/30 bg-card/80 px-3 py-1.5 backdrop-blur-md">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Score</span>
          <span className="metric-value text-base">{score}</span>
        </div>
      )}

      {/* Syncing indicator */}
      {isSyncing && isStreaming && (
        <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full border border-warning/30 bg-card/80 px-2.5 py-1 backdrop-blur-md">
          <WifiOff className="h-3 w-3 text-warning" />
          <span className="text-[10px] font-medium text-warning">Syncing</span>
        </div>
      )}

      {/* Coaching toast */}
      {latestCue && isStreaming && (
        <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2">
          <div className="toast-coaching flex items-center gap-2 shadow-lg">
            <span className="pulse-dot status-active" />
            {latestCue.message}
          </div>
        </div>
      )}
    </div>
  );
}
