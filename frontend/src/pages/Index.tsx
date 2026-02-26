import { useState } from "react";
import { VisionAgentProvider, useVisionAgent } from "@/contexts/VisionAgentContext";
import TaskSelector from "@/components/dashboard/TaskSelector";
import MediaLayer from "@/components/dashboard/MediaLayer";
import AnalyticsPanel from "@/components/dashboard/AnalyticsPanel";
import ControlBar from "@/components/dashboard/ControlBar";
import AiChatPanel from "@/components/dashboard/AiChatPanel";
import { Cpu, PanelLeft, PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const DashboardLayout = () => {
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const { isConnected } = useVisionAgent();

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="flex items-center justify-between border-b border-border bg-card/50 px-3 py-2 backdrop-blur-sm sm:px-5 sm:py-2.5">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile toggle for left sidebar */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 lg:hidden"
            onClick={() => setLeftOpen(true)}
            aria-label="Open skill drills"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            <h1 className="text-xs font-bold tracking-tight text-foreground sm:text-sm">
              AI Badminton Coach
            </h1>
          </div>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${isConnected
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-warning/30 bg-warning/10 text-warning"
              }`}
          >
            {isConnected ? "Live" : "Reconnecting..."}
          </span>
        </div>

        {/* Mobile toggle for right sidebar */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 xl:hidden"
          onClick={() => setRightOpen(true)}
          aria-label="Open analytics"
        >
          <PanelRight className="h-4 w-4" />
        </Button>
      </header>

      {/* Three-Column Layout */}
      <div className="flex min-h-0 flex-1">
        {/* Left Sidebar — desktop */}
        <aside className="hidden w-64 flex-shrink-0 border-r border-border bg-card/30 lg:flex lg:flex-col">
          <TaskSelector />
        </aside>

        {/* Center */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 items-center justify-center p-2 sm:p-4 overflow-y-auto">
            <div className="w-full h-full max-w-4xl flex items-center justify-center">
              <MediaLayer />
            </div>
          </div>
          <ControlBar />
        </main>

        {/* Right Sidebar — desktop */}
        <aside className="hidden w-72 flex-shrink-0 border-l border-border bg-card/30 xl:flex xl:flex-col">
          <AnalyticsPanel />
        </aside>
      </div>

      {/* Left Sheet — mobile/tablet */}
      <Sheet open={leftOpen} onOpenChange={setLeftOpen}>
        <SheetContent side="left" className="w-72 bg-card p-0">
          <SheetHeader className="border-b border-border px-4 py-3">
            <SheetTitle className="text-sm text-foreground">Skill Drills</SheetTitle>
          </SheetHeader>
          <TaskSelector />
        </SheetContent>
      </Sheet>

      {/* Right Sheet — mobile/tablet */}
      <Sheet open={rightOpen} onOpenChange={setRightOpen}>
        <SheetContent side="right" className="w-80 bg-card p-0">
          <SheetHeader className="border-b border-border px-4 py-3">
            <SheetTitle className="text-sm text-foreground">Analytics</SheetTitle>
          </SheetHeader>
          <AnalyticsPanel />
        </SheetContent>
      </Sheet>

      {/* AI Chat Panel */}
      <AiChatPanel />
    </div>
  );
};

const Index = () => {
  return (
    <VisionAgentProvider>
      <DashboardLayout />
    </VisionAgentProvider>
  );
};

export default Index;
