import { useVisionAgent, type TaskSkill } from "@/contexts/VisionAgentContext";
import { Target, Zap, Flame, CheckCircle2 } from "lucide-react";

const difficultyConfig = {
  easy: { label: "Beginner", className: "bg-primary/15 text-primary border-primary/30" },
  medium: { label: "Intermediate", className: "bg-warning/15 text-warning border-warning/30" },
  hard: { label: "Advanced", className: "bg-destructive/15 text-destructive border-destructive/30" },
};

function TaskCard({ task }: { task: TaskSkill }) {
  const { selectTask, activeTaskId } = useVisionAgent();
  const isActive = activeTaskId === task.id;
  const diff = difficultyConfig[task.difficulty];

  return (
    <button
      onClick={() => selectTask(task.id)}
      className={`w-full text-left rounded-lg border p-3 transition-all duration-200 ${
        isActive
          ? "border-primary/50 bg-primary/5 glow-primary"
          : "border-border bg-card hover:border-muted-foreground/30 hover:bg-secondary/50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${isActive ? "text-primary" : "text-foreground"}`}>
            {task.title}
          </p>
          <span className={`mt-1.5 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${diff.className}`}>
            {diff.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`pulse-dot ${task.status === "active" ? "status-active" : "status-ready"}`} />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {task.status}
          </span>
        </div>
      </div>
    </button>
  );
}

export default function TaskSelector() {
  const { tasks } = useVisionAgent();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Target className="h-4 w-4 text-primary" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Skill Drills
        </h2>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3 scrollbar-thin">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}
