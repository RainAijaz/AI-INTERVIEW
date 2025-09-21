/**
 * --------------------------------------------------------------------------
 * emotionDetection.js
 * --------------------------------------------------------------------------
 * Purpose:
 *   Detects facial emotions from the webcam video using face-api.js and updates
 *   the UI with the dominant emotion. Also logs emotions to the current answer
 *   if recording is active.
 *
 * Responsibilities:
 *   - Detect faces in the current video frame
 *   - Determine dominant facial expression
 *   - Update emoji and text labels in the UI
 *   - Record emotion if the user is currently answering a question
 *
 * Dependencies:
 *   - `videoElement` must be a valid HTMLVideoElement
 *   - `faceapi` library loaded with TinyFaceDetectorOptions
 *   - `currentAnswerEmotions` array for storing detected emotions during recording
 *
 * --------------------------------------------------------------------------**/
let badEmotionTimer = null;
let isAlertingEmotion = false;
let lastDetectedEmotion = "neutral";
const EMOTION_ALERT_THRESHOLD_MS = 3000; // 3 seconds
const NEGATIVE_EMOTIONS = new Set(["sad", "angry", "fearful"]);
// --- END: Added variables ---

async function runEmotionDetection() {
  // 1️⃣ Skip if video is not ready
  if (!videoElement || videoElement.paused || videoElement.ended) return;

  // 2️⃣ Run face-api.js detection
  const detections = await faceapi.detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();

  // 3️⃣ UI elements
  const emotionEmoji = document.getElementById("emotion-emoji");
  const emotionLabel = document.getElementById("emotion-label");

  // 4️⃣ Emotion to Emoji Map
  const EMOTION_MAP = {
    happy: "😊",
    sad: "😢",
    neutral: "😐",
    surprised: "😮",
    angry: "😠",
    fearful: "😨",
  };

  // 5️⃣ Process detection results
  if (detections.length > 0) {
    const expressions = detections[0].expressions;
    const [dominantEmotion] = Object.entries(expressions).sort((a, b) => b[1] - a[1])[0];
    lastDetectedEmotion = dominantEmotion; // Always keep track of the latest emotion

    // Update UI
    emotionEmoji.textContent = EMOTION_MAP[dominantEmotion] || "🤔";
    emotionLabel.textContent = dominantEmotion.charAt(0).toUpperCase() + dominantEmotion.slice(1);

    // --- START: New logic for prolonged emotion warning ---
    if (typeof recording !== "undefined" && recording) {
      const isBadEmotion = NEGATIVE_EMOTIONS.has(dominantEmotion);

      if (isBadEmotion) {
        // If a negative emotion is detected and a timer isn't running, start one.
        if (!badEmotionTimer && !isAlertingEmotion) {
          badEmotionTimer = setTimeout(() => {
            // After few seconds, check if the last detected emotion was still negative.
            if (NEGATIVE_EMOTIONS.has(lastDetectedEmotion)) {
              showNotification("💡 Coaching Tip: Remember to convey confidence and positivity!", "error");
              isAlertingEmotion = true;
            }
            badEmotionTimer = null; // Clear the timer ID
          }, EMOTION_ALERT_THRESHOLD_MS);
        }
      } else {
        // If emotion is not negative, clear the timer and reset the alert flag.
        if (badEmotionTimer) {
          clearTimeout(badEmotionTimer);
          badEmotionTimer = null;
        }
        isAlertingEmotion = false;
      }

      // 6️⃣ If recording, save detected emotion for the final report
      currentAnswerEmotions.push(dominantEmotion);
    }
    // --- END: New logic for prolonged emotion warning ---
  } else {
    // 7️⃣ No face detected
    emotionEmoji.textContent = "😐";
    emotionLabel.textContent = "No Face";
    lastDetectedEmotion = "neutral";
  }
}
