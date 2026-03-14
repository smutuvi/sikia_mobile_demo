# Plan: Test ASR model with a WAV file (temporary)

This describes how to verify that the ASR (Whisper) model works by transcribing a fixed test file: `Ellena.wav`.

## What was done

1. **`transcribeWavFile(filePathOrAsset, options?)`** in `src/services/whisperVoiceService.ts`  
   - Uses the same ASR model as the app (bundled or selected in Models screen).  
   - Calls `WhisperContext.transcribe()` with **language: 'en'** and **maxThreads: 4** by default (optional overrides supported).  
   - Returns `{ result, language, segments }`.

2. **Dev Tools → "Test ASR (transcribe file)"**  
   - Button that loads the bundled `Ellena.wav` and runs `transcribeWavFile` on it.  
   - Shows the transcription in an alert and logs in dev.

3. **Test asset**  
   - `Ellena.wav` was copied to `src/assets/models/Ellena.wav` so it is bundled with the app.

## How to run the test

1. Open the app (iOS or Android, **debug** build — Dev Tools only appears in debug).
2. Open **Dev Tools** from the drawer (hamburger menu).
3. Tap **"Transcribe Ellena.wav"**.
4. Wait for transcription (may take a few seconds).
5. Check the alert for the text and detected language; in dev, check logs for full `result`, `language`, `segments`.

## Test on device (physical phone)

Use a **debug** build on the device so the Dev Tools menu is visible.

### iOS (iPhone)

1. Connect your iPhone and trust the computer if prompted.
2. From the project root:
   ```bash
   ./scripts/run-ios-device.sh
   ```
   Or with a specific device name: `./scripts/run-ios-device.sh "Your iPhone Name"`.
3. When the app is running, open the drawer → **Dev Tools** → **Transcribe Ellena.wav**.

### Android (phone)

1. Enable **USB debugging** on the phone and connect via USB.
2. From the project root, start Metro (if not already running):
   ```bash
   yarn start
   ```
3. In another terminal, build and run the **debug** app on the connected device:
   ```bash
   npx react-native run-android
   ```
   If multiple devices are connected, use: `npx react-native run-android --deviceId=<id>`.
4. When the app is running, open the drawer → **Dev Tools** → **Transcribe Ellena.wav**.

Note: `scripts/build-android-release-and-install.sh` installs a **release** build; Dev Tools is hidden there. Use `npx react-native run-android` for device testing.

## If you need to use a different WAV

- Replace `src/assets/models/Ellena.wav` with your file (same name), or:
- Add your file (e.g. `MyFile.wav`) under `src/assets/models/`, then in `DevToolsScreen.tsx` change the `require` to `require('../../assets/models/MyFile.wav')` and the button label if you like.

## Audio format

- whisper.rn accepts WAV. For best compatibility use **16 kHz, mono**; many other WAVs still work (native may resample).

## Language and speed

- Transcription uses **language: 'en'** (English) by default so the model doesn’t misdetect language.
- **maxThreads: 4** is used by default to speed up processing.
- **Chunked transcription**: Long audio is processed in **30-second chunks**. When possible, the **file is read once** and PCM is sent to the engine per chunk (faster). Otherwise the previous file-path-per-chunk method is used.
- **Quick test (30s)**: Use the **"Quick 30s"** button in the chat input to transcribe only the first 30 seconds (~1–3 min on device). Use **"Test ASR"** for the full file.
- **How long it takes**: On a typical phone, expect about **1–3 minutes of processing per minute of audio** (e.g. a 2‑minute file can take 2–6 minutes). The button shows **"Transcribing… (chunk N)"** so you can see progress. If it stays on "Transcribing…" or "chunk 1" for more than **~5 minutes**, the first chunk may be stuck (try a shorter test file or check that the ASR model is loaded).
- For very long files (e.g. >10 min), only the first 10 minutes are processed; you can increase `MAX_CHUNKS` in `whisperVoiceService.ts` if needed.

## Cleanup (after testing)

- Remove the "Test ASR (transcribe file)" card from `DevToolsScreen.tsx` if you no longer need it.
- Optionally remove `transcribeWavFile` from `whisperVoiceService.ts` and delete `src/assets/models/Ellena.wav` to avoid bundling the file in release builds.
