/**
 * fileHelpers.js
 * ------------
 * Helper functions for audio processing and transcription.
 */

/**
 * Cleans up Whisper transcription output.
 * Removes bracketed text and extra whitespace.
 */
export function cleanTranscription(text) {
  return text
    .replace(/\[.*?\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Runs a command-line executable and returns output as a Promise.
 */
export function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    import("child_process").then(({ execFile }) => {
      execFile(command, args, (error, stdout, stderr) => {
        if (error) return reject(new Error(stderr || error.message));
        // ✅ Whisper transcription is in stdout, not stderr
        resolve(stdout);
      });
    });
  });
}
