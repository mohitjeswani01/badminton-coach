import { useVisionAgent } from "@/contexts/VisionAgentContext";
import { useCallback, useRef, useEffect } from "react";
import { UploadCloud, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCallStateHooks, ParticipantView, useCall } from "@stream-io/video-react-sdk";
import VideoFeed from "./VideoFeed";

function LiveCameraView() {
    const { useLocalParticipant } = useCallStateHooks();
    const localParticipant = useLocalParticipant();

    if (!localParticipant) {
        return (
            <div className="flex h-full min-h-[400px] w-full items-center justify-center bg-black/50 rounded-xl animate-pulse">
                <p className="text-muted-foreground font-medium tracking-wide">Publishing WebRTC Camera...</p>
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-[400px] w-full relative overflow-hidden bg-black rounded-xl items-center justify-center">
            <ParticipantView participant={localParticipant} />
        </div>
    );
}

function FileStreamPublisher({ file }: { file: File }) {
    const call = useCall();
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (!videoRef.current || !call) return;
        const video = videoRef.current;
        const url = URL.createObjectURL(file);
        video.src = url;

        let published = false;

        video.onplay = async () => {
            if (published) return;
            try {
                // @ts-ignore
                const stream = video.captureStream();
                const videoTrack = stream.getVideoTracks()[0];
                if (videoTrack) {
                    await call.publishVideoStream(stream);
                    published = true;
                }
            } catch (err) {
                console.error("Failed to publish video stream from file", err);
            }
        };

        video.play().catch(console.error);

        return () => {
            URL.revokeObjectURL(url);
            if (published) {
                // Ignore types to force unpublish just in case
                call.stopPublish('video' as any).catch(() => { });
            }
        };
    }, [call, file]);

    return (
        <div className="flex w-full h-full items-center justify-center overflow-hidden relative">
            <video ref={videoRef} className="w-full max-h-full" controls loop muted playsInline />
            <div className="absolute top-4 left-4 rounded-full bg-primary/20 border border-primary/50 text-primary px-3 py-1 text-xs font-bold backdrop-blur">
                NATIVE FILE STREAM
            </div>
        </div>
    );
}

export default function MediaLayer() {
    const { selectedFile, setSelectedFile, isStreaming, isLoading, streamCall } = useVisionAgent();

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith("video/")) {
                setSelectedFile(file);
            } else {
                alert("Please upload a valid video file.");
            }
        }
    }, [setSelectedFile]);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.type.startsWith("video/")) {
                setSelectedFile(file);
            }
        }
    }, [setSelectedFile]);

    // When actively streaming, just show the WebRTC publisher or custom file publisher
    if (isStreaming || isLoading) {
        if (!streamCall) {
            return (
                <div className="flex h-full w-full items-center justify-center bg-black rounded-xl animate-pulse">
                    <p className="text-muted-foreground font-medium tracking-wide">Initializing Vision Agent...</p>
                </div>
            );
        }

        if (selectedFile) {
            return (
                <div className="relative flex h-full max-h-full w-full overflow-hidden bg-black rounded-xl">
                    <FileStreamPublisher file={selectedFile} />
                    <VideoFeed />
                </div>
            );
        } else {
            return (
                <div className="relative flex h-full max-h-full w-full overflow-hidden bg-black rounded-xl">
                    <LiveCameraView />
                    <VideoFeed />
                </div>
            );
        }
    }

    return (
        <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-border bg-card/40">
            {!selectedFile ? (
                <div
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className="flex h-full w-full flex-col items-center justify-center border-2 border-dashed border-muted-foreground/20 p-6 text-center transition-colors hover:border-primary/50"
                >
                    <UploadCloud className="mb-4 h-12 w-12 text-muted-foreground/50" />
                    <h3 className="mb-2 text-lg font-semibold text-foreground">Upload Practice Session</h3>
                    <p className="mb-6 text-sm text-muted-foreground">Drag and drop MP4 or MOV, or click to browse.</p>
                    <label className="cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                        Browse Files
                        <input type="file" className="hidden" accept="video/mp4,video/quicktime" onChange={handleFileChange} />
                    </label>
                </div>
            ) : (
                <div className="relative flex h-full w-full flex-col items-center justify-center bg-black/20 p-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-4 top-4 z-10 h-8 w-8 rounded-full bg-background/50 text-foreground backdrop-blur hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => setSelectedFile(null)}
                    >
                        <X className="h-4 w-4" />
                    </Button>

                    <div className="flex flex-col items-center justify-center gap-4 text-center">
                        <Video className="h-16 w-16 text-primary" />
                        <div>
                            <p className="font-medium text-foreground">{selectedFile.name}</p>
                            <p className="text-xs text-muted-foreground">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                        </div>
                        <p className="mt-4 max-w-sm text-sm text-muted-foreground">
                            Click 'Start Live Session' below to natively ingest this file into the Vision Edge.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
