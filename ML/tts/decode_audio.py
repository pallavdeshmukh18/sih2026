import argparse
import base64
import io
import json
import sys
import wave
from pathlib import Path


def decode_audio(input_file: Path, output_file: Path) -> bool:
    """
    Decodes base64-encoded audio from a Postman TTS response JSON or text file,
    validates the WAV header using standard library `wave`, and writes the .wav file.
    """
    if not input_file.is_file():
        print(f"Error: Input file not found: {input_file.resolve()}")
        return False

    try:
        raw_text = input_file.read_text(encoding="utf-8").strip()
    except Exception as exc:
        print(f"Error: Failed to read input file: {exc}")
        return False

    if not raw_text:
        print("Error: Input file is empty.")
        return False

    audio_base64 = None

    # Try parsing as JSON (standard Postman response format)
    if raw_text.startswith("{"):
        try:
            data = json.loads(raw_text)
        except json.JSONDecodeError as exc:
            print(f"Error: Invalid JSON format: {exc}")
            return False

        if not isinstance(data, dict):
            print("Error: JSON root must be an object.")
            return False

        if data.get("success") is False:
            err_msg = data.get("error", "Unknown error in response")
            print(f"Error: API response indicates failure: {err_msg}")
            return False

        audio_base64 = data.get("audio_base64")
        if not audio_base64:
            print("Error: Missing 'audio_base64' field in JSON response.")
            return False
    else:
        # Assume input file directly contains the raw base64 string
        audio_base64 = raw_text

    # Check for unedited example placeholder
    if audio_base64 == "BASE64_AUDIO_HERE":
        print("Error: The file contains the placeholder 'BASE64_AUDIO_HERE'. Please paste the actual audio_base64 string from your Postman response.")
        return False

    # Clean whitespace or line breaks from base64 string
    cleaned_b64 = "".join(audio_base64.split())

    # Decode Base64
    try:
        audio_bytes = base64.b64decode(cleaned_b64, validate=True)
    except Exception as exc:
        print(f"Error: Failed to decode Base64 audio data: {exc}")
        return False

    if len(audio_bytes) == 0:
        print("Error: Decoded audio data is empty (0 bytes).")
        return False

    # Validate WAV format using Python's standard library wave module
    try:
        with wave.open(io.BytesIO(audio_bytes), "rb") as wav_file:
            channels = wav_file.getnchannels()
            sample_width = wav_file.getsampwidth()
            framerate = wav_file.getframerate()
            frames = wav_file.getnframes()
            duration = frames / float(framerate) if framerate > 0 else 0.0
    except wave.Error as exc:
        print(f"Error: Decoded content is not a valid WAV file: {exc}")
        return False
    except Exception as exc:
        print(f"Error: Validation of WAV structure failed: {exc}")
        return False

    # Ensure output directory exists
    output_file.parent.mkdir(parents=True, exist_ok=True)

    # Write WAV file
    try:
        output_file.write_bytes(audio_bytes)
    except Exception as exc:
        print(f"Error: Failed to write output file: {exc}")
        return False

    abs_path = output_file.resolve()
    print("=" * 60)
    print("Audio decoded successfully.")
    print("Format:      WAV (PCM)")
    print(f"Channels:    {channels} ({'Mono' if channels == 1 else 'Stereo'})")
    print(f"Sample Rate: {framerate} Hz")
    print(f"Bit Depth:   {sample_width * 8}-bit")
    print(f"Duration:    {duration:.2f} seconds")
    print(f"Size:        {len(audio_bytes):,} bytes")
    print(f"Saved to:    {abs_path}")
    print("=" * 60)
    return True


def main():
    default_input = Path(__file__).resolve().parent / "test_response.json"
    default_output = Path(__file__).resolve().parent / "output" / "test_output.wav"

    parser = argparse.ArgumentParser(
        description="Decode Base64 audio from MediKiosk TTS API response into a playable WAV file.",
    )
    parser.add_argument(
        "input",
        nargs="?",
        default=str(default_input),
        help=f"Path to JSON response file or base64 text file (default: {default_input.name})",
    )
    parser.add_argument(
        "-o",
        "--output",
        default=str(default_output),
        help=f"Path for output WAV file (default: output/test_output.wav)",
    )

    args = parser.parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)

    success = decode_audio(input_path, output_path)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
