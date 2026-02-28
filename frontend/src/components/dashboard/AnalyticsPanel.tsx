import { useVisionAgent } from "@/contexts/VisionAgentContext";
import { Activity, TrendingUp, TrendingDown, Minus, MessageSquare } from "lucide-react";
import { useEffect, useRef } from "react";

const trendIcon = {
  up: <TrendingUp className="h-3 w-3 text-primary" />,
  down: <TrendingDown className="h-3 w-3 text-destructive" />,
  stable: <Minus className="h-3 w-3 text-muted-foreground" />,
};

export default function AnalyticsPanel() {
  const { metrics = [], transcript = [], activeTaskId, tasks = [] } = useVisionAgent();
  const transcriptRef = useRef<HTMLDivElement>(null);

  const activeTask = tasks?.find((t) => t?.id === activeTaskId);


  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Activity className="h-4 w-4 text-primary" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Analytics
        </h2>
      </div>

      {/* Target Metrics */}
      {activeTask && (
        <div className="border-b border-border px-4 py-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-primary">
            Target — {activeTask.title}
          </p>
          <div className="space-y-1.5">
            {activeTask.targetMetrics?.map((tm) => (
              <div key={tm.label} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{tm.label}</span>
                <span className="font-mono font-medium text-foreground">{tm.target}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Metrics */}
      <div className="border-b border-border px-4 py-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Key Metrics
        </p>
        <div className="space-y-2">
          {metrics?.map((m) => (
            <div key={m.label} className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{m.label}</span>
              <div className="flex items-center gap-1.5">
                <span className="metric-value text-sm">
                  {m.value}
                  {m.value !== "—" && <span className="text-xs text-muted-foreground">{m.unit}</span>}
                </span>
                {m.trend && trendIcon[m.trend]}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transcript */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-2 px-4 py-2">
          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Live Transcript
          </p>
        </div>
        <div ref={transcriptRef} className="flex-1 overflow-y-auto px-4 pb-3 scrollbar-thin">
          {!transcript?.length ? (
            <p className="text-xs italic text-muted-foreground/50">
              AI coach feedback will appear here…
            </p>
          ) : (
            <div className="space-y-1">
              {transcript?.map((line, i) => (
                <p key={i} className="font-mono text-[11px] leading-relaxed text-secondary-foreground/80">
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
