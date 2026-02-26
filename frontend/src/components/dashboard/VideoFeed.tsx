import { useVisionAgent } from "@/contexts/VisionAgentContext";
import { Loader2, WifiOff } from "lucide-react";

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
  const { isStreaming, isLoading, isSyncing, score, keypoints, coachingCues, isFormGood } = useVisionAgent();

  const latestCue = coachingCues[coachingCues.length - 1];

  // Dynamic Coloring
  // Green for good, Red for bad, Neutral (Warning/Orange or Green) if null
  const strokeColor = isFormGood === true
    ? "hsl(142, 72%, 50%)"
    : isFormGood === false
      ? "hsl(0, 84%, 60%)"
      : "hsl(38, 92%, 55%)"; // Orange/Yellow default

  const kpMap = Object.fromEntries(keypoints.map((kp) => [kp.name, kp]));

  return (
    <div className="pointer-events-none absolute inset-0 z-20 h-full w-full">
      {/* SVG Skeleton overlay */}
      <svg
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full object-contain overflow-visible"
        style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.5))' }}
      >
        {/* Draw connections */}
        {SKELETON_CONNECTIONS.map(([a, b], idx) => {
          if (kpMap[a] && kpMap[b]) {
            return (
              <line
                key={`line-${idx}`}
                x1={kpMap[a].x}
                y1={kpMap[a].y}
                x2={kpMap[b].x}
                y2={kpMap[b].y}
                stroke={strokeColor}
                strokeWidth={0.005}
                strokeOpacity={0.8}
                strokeLinecap="round"
              />
            );
          }
          return null;
        })}

        {/* Draw keypoints */}
        {keypoints.map((kp, idx) => {
          const fill = kp.confidence > 0.8 ? strokeColor : "hsl(38, 92%, 55%)";
          return (
            <circle
              key={`kp-${idx}`}
              cx={kp.x}
              cy={kp.y}
              r={0.008}
              fill={fill}
              stroke="hsl(220, 40%, 8%)"
              strokeWidth={0.002}
            />
          );
        })}
      </svg>

      {/* Loading state overlay inside canvas box */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-sm pointer-events-auto">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Connecting Vision Edge...</p>
        </div>
      )}

      {/* Score badge */}
      {isStreaming && (
        <div className="absolute right-3 top-3 flex items-center gap-2 rounded-lg border border-primary/30 bg-card/80 px-3 py-1.5 backdrop-blur-md">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Score</span>
          <span className="metric-value text-base">{score}</span>
        </div>
      )}

      {/* Syncing indicator */}
      {isSyncing && isStreaming && (
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-warning/30 bg-card/80 px-2.5 py-1 backdrop-blur-md">
          <WifiOff className="h-3 w-3 text-warning" />
          <span className="text-[10px] font-medium text-warning">Syncing</span>
        </div>
      )}

      {/* Coaching cue */}
      {latestCue && isStreaming && (
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-primary/20 bg-card/90 px-6 py-3 shadow-2xl backdrop-blur-xl pointer-events-auto">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary">
            <span className="font-bold">AI</span>
          </div>
          <p className="font-medium text-foreground">{latestCue.message}</p>
        </div>
      )}
    </div>
  );
}
