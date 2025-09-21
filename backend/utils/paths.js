/**
 * paths.js
 * ------------
 * Defines all important file paths used in the server.
 */

import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Convert ES module URL to file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Uploads directory (temporary audio storage)
export const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// FFMPEG path
export const ffmpegPath = path.join(__dirname, "../ffmpeg/bin/ffmpeg.exe");

// Whisper model/executable paths
export const whisperDir = path.join(__dirname, "../whisper");
export const whisperExe = path.join(whisperDir, "whisper.exe");
export const modelBin = path.join(whisperDir, "ggml-base.en.bin");
