import asyncio
import io
import wave
import uuid
import time
import logging
import subprocess

import pyttsx3
from getstream.video.rtc.track_util import PcmData, AudioFormat
from vision_agents.core import tts

logger = logging.getLogger(__name__)

class Pyttsx3TTS(tts.TTS):
    """
    Local fallback text-to-speech utilizing pyttsx3.
    Pre-initializes the engine to avoid synthesis lag.
    """
    def __init__(self, rate: int = 150):
        super().__init__()
        self.rate = rate
        logger.info("[AUDIO] Fallback engine ready (subprocess mode).")

    async def stream_audio(
        self, text: str, *args, **kwargs
    ) -> PcmData:
        """
        Creates speech locally via pyttsx3, saves to a temporary wave file,
        reads the PCM frames directly out of the wav, and yields a PcmData.
        """
        # Save to memory instead of writing to disk using a temporary wave
        # Actually, pyttsx3 is heavily reliant on actual filesystem for save_to_file on some platforms.
        # So we write to a fast tmp_audio.wav
        
        tmp_filename = f"tmp_audio_{uuid.uuid4().hex[:8]}.wav"
        
        script = f"""
import pyttsx3
engine = pyttsx3.init()
engine.setProperty('rate', {self.rate})
engine.save_to_file({repr(text)}, r'{tmp_filename}')
engine.runAndWait()
"""
        # Run in a completely isolated process to avoid COM threading issues
        # Use standard subprocess.run instead of asyncio because pyttsx3 win32com 
        # attempts to interact with the current async event loop internals on Windows even in subprocesses if launched through asyncio.
        def _run_script():
            subprocess.run(
                ["python", "-c", script],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=True
            )
            
        await asyncio.to_thread(_run_script)

        # Read the raw PCM frames
        try:
            with wave.open(tmp_filename, 'rb') as wf:
                sr = wf.getframerate()
                ch = wf.getnchannels()
                sw = wf.getsampwidth()
                frames = wf.readframes(wf.getnframes())
                
                # Determine precise format
                # Usually it's S16LE in pyttsx3
                fmt = AudioFormat.S16
                
                # Wrap it all cleanly to be identical in output format downstream
                # The getstream SDK requires `from_bytes` to parse raw `wav.readframes` safely
                pcm = PcmData.from_bytes(
                    audio_bytes=frames,
                    sample_rate=sr,
                    format=fmt,
                    channels=ch
                )
        finally:
            import os
            if os.path.exists(tmp_filename):
                os.remove(tmp_filename)
                
        return pcm

    async def stop_audio(self) -> None:
        pass


class ResilientTTS(tts.TTS):
    """
    Wrapper TTS that tries the Primary TTS (usually network bounded like ElevenLabs),
    and falls back to a secondary TTS (usually a local Pyttsx3TTS) upon unhandled failure.
    """
    def __init__(self, primary: tts.TTS, fallback: tts.TTS):
        super().__init__()
        self.primary = primary
        self.fallback = fallback

    async def stream_audio(
        self, text: str, *args, **kwargs
    ):
        try:
            print("[AUDIO] Using ElevenLabs...")
            return await self.primary.stream_audio(text, *args, **kwargs)
        except Exception as e:
            print(f"[AUDIO] ElevenLabs Failed ({e}).")
            print("[AUDIO] Fallback: Using pyttsx3...")
            return await self.fallback.stream_audio(text, *args, **kwargs)

    async def stop_audio(self) -> None:
        await self.primary.stop_audio()
        await self.fallback.stop_audio()
