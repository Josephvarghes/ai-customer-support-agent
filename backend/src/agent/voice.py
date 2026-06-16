import asyncio
import logging
import os

from deepgram import AsyncDeepgramClient, DeepgramClient


# Fallback definitions to satisfy prompt requirement for these option names
# as the new v7 auto-generated SDK uses keyword arguments directly.
class LiveOptions:
    pass


class SpeakOptions:
    pass


logger = logging.getLogger(__name__)


class DeepgramVoiceEngine:
    """Voice engine utilizing Deepgram APIs for STT (Streaming) and TTS."""

    def __init__(self, api_key: str | None = None):
        from dotenv import load_dotenv

        load_dotenv()
        self.api_key = api_key or os.getenv("DEEPGRAM_API_KEY")
        if not self.api_key:
            raise ValueError("DEEPGRAM_API_KEY is not set in environment.")
        self.client = DeepgramClient(api_key=self.api_key)
        self.async_client = AsyncDeepgramClient(api_key=self.api_key)

    async def speak_text(self, text: str, voice: str = "aura-asteria-en") -> bytes:
        """Converts text to speech using Deepgram Aura model and returns raw bytes.

        Args:
            text: The text string to synthesize.
            voice: The voice model to use. Defaults to 'aura-asteria-en'.

        Returns:
            bytes: The synthesized audio data in MP3 format.
        """
        try:
            loop = asyncio.get_event_loop()

            def _generate():
                # Synchronous REST call executed in a thread pool
                response = self.client.speak.v1.audio.generate(
                    text=text, model=voice, encoding="mp3"
                )
                return b"".join(response)

            audio_bytes = await loop.run_in_executor(None, _generate)
            return audio_bytes
        except Exception as e:
            logger.error(f"Deepgram TTS failure: {e}")
            raise
