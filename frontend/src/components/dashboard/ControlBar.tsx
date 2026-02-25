import { useVisionAgent } from "@/contexts/VisionAgentContext";
import { Play, Square, RotateCcw, VolumeX, Volume2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ControlBar() {
  const { isStreaming, isLoading, isMuted, selectedFile, startSession, endSession, resetSession, toggleMute } =
    useVisionAgent();

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 border-t border-border bg-card/50 px-3 py-2 backdrop-blur-sm sm:gap-3 sm:px-6 sm:py-3">
      {!isStreaming ? (
        <Button
          onClick={startSession}
          disabled={isLoading}
          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Play className="h-4 w-4" />
          {isLoading ? "Connecting…" : selectedFile ? "Analyze File" : "Start Live Session"}
        </Button>
      ) : (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleMute}
            className="gap-1.5 border-border text-foreground hover:bg-secondary"
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            {isMuted ? "Unmute" : "Mute Coach"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={resetSession}
            className="gap-1.5 border-border text-foreground hover:bg-secondary"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={endSession}
            className="gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            <Square className="h-3.5 w-3.5" />
            Stop Session
          </Button>
        </>
      )}
    </div>
  );
}
