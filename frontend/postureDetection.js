/**
 * --------------------------------------------------------------------------
 * postureDetection.js
 * --------------------------------------------------------------------------
 * Purpose:
 *   Handles real-time posture detection and baseline calibration using
 *   pose keypoints (e.g., shoulders, nose, mouth). Updates UI icons/labels
 *   and logs posture data for interview analysis.
 *
 * Global Variables:
 *   - baselinePosture: stores the calibrated posture ratio
 *   - lastKeypoints: continuously updated with the latest valid pose
 *
 * Dependencies:
 *   - videoElement, canvasElement, canvasContext from main.js
 *   - currentAnswerPostures array for storing posture during recording
 *
 * Core Functions:
 *   - setBaseline(): captures a stable reference posture for slouch detection
 *   - handlePoseResults(results): updates posture UI and logs posture flags
 *
 * --------------------------------------------------------------------------
 */
/**
 * --------------------------------------------------------------------------
 * postureDetection.js
 * --------------------------------------------------------------------------
 * Handles real-time posture detection, baseline calibration, and now
 * provides real-time coaching warnings for prolonged bad posture.
 */

// ----------------------
// Global Variables
// ----------------------
let baselinePosture = null;
let lastKeypoints = null; // Latest valid keypoints from pose detection

// --- START: Added variables for posture warnings ---
let badPostureTimer = null;
let isAlertingPosture = false;
const POSTURE_ALERT_THRESHOLD_MS = 5000; // 5 seconds
// --- END: Added variables ---

// ----------------------
// Set Baseline Posture
// ----------------------
function setBaseline() {

  if (!lastKeypoints) {
    showNotification("Still calibrating. Please wait a moment and try again.", "error");
    return false;
  }

  const keypoints = lastKeypoints;
  const leftShoulder = findKeypoint(keypoints, "left_shoulder");
  const rightShoulder = findKeypoint(keypoints, "right_shoulder");
  const nose = findKeypoint(keypoints, "nose");

  if (!leftShoulder || !rightShoulder || !nose) {
    showNotification("Could not detect shoulders clearly. Try adjusting your position.", "error");
    return false;
  }

  const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
  if (shoulderWidth < 10) {
    showNotification("Cannot determine shoulder width. Please sit upright.", "error");
    return false;
  }

  const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const noseToShoulderGap = avgShoulderY - nose.y;
  baselinePosture = { ratio: noseToShoulderGap / shoulderWidth };

  showNotification("Baseline posture saved!", "success");
  return true;
}

// ----------------------
// Helper: Find Keypoint by Name
// ----------------------
function findKeypoint(keypoints, name) {
  return keypoints.find((k) => (k.part || k.name) === name);
}

// ----------------------
// Handle Pose Detection Results
// ----------------------
function handlePoseResults(results) {
  if (!results || !results[0] || !results[0].keypoints || isNaN(results[0].keypoints[0].x)) {
    updatePostureUI("🤔", "Calibrating...");
    return;
  }

  const keypoints = results[0].keypoints || [];
  lastKeypoints = keypoints;

  if (!canvasContext) return;
  resizeCanvasToVideo();

  const postureFlags = analyzePosture(keypoints);
  const isBadPosture = postureFlags.length > 0;

  // Update UI based on detected posture
  if (isBadPosture) {
    updatePostureUI("⚠️", postureFlags[0]);
  } else {
    updatePostureUI("✅", "Good Posture");
  }

  // --- START: New logic for prolonged posture warning ---
  // Only run this logic if the user is currently recording an answer.
  if (typeof recording !== "undefined" && recording) {
    if (isBadPosture) {
      // If bad posture is detected and a timer isn't already running, start one.
      if (!badPostureTimer && !isAlertingPosture) {
        badPostureTimer = setTimeout(() => {
          // After 15 seconds, re-check the most recent posture.
          const currentPostureFlags = analyzePosture(lastKeypoints);
          if (currentPostureFlags.length > 0) {
            // If posture is still bad, show the coaching tip.
            showNotification("💡 Coaching Tip: Try to maintain an upright posture.", "error");
            isAlertingPosture = true; // Set flag to prevent re-alerting.
          }
          badPostureTimer = null; // Clear timer ID
        }, POSTURE_ALERT_THRESHOLD_MS);
      }
    } else {
      // If posture is good, clear any running timer and reset the alert flag.
      if (badPostureTimer) {
        clearTimeout(badPostureTimer);
        badPostureTimer = null;
      }
      isAlertingPosture = false;
    }

    // Log posture for the final report
    currentAnswerPostures.push(isBadPosture ? postureFlags[0] : "Good Posture");
  }
  // --- END: New logic for prolonged posture warning ---
}

// ----------------------
// Helper: Resize Canvas to Video
// ----------------------
function resizeCanvasToVideo() {
  const videoWidth = videoElement.clientWidth;
  const videoHeight = videoElement.clientHeight;
  if (canvasElement.width !== videoWidth || canvasElement.height !== videoHeight) {
    canvasElement.width = videoWidth;
    canvasElement.height = videoHeight;
  }
  canvasContext.clearRect(0, 0, canvasElement.width, canvasElement.height);
}

// ----------------------
// Helper: Analyze Posture
// ----------------------
// ----------------------
// Helper: Analyze Posture
// ----------------------
function analyzePosture(keypoints) {
  const flags = [];
  const leftShoulder = findKeypoint(keypoints, "left_shoulder");
  const rightShoulder = findKeypoint(keypoints, "right_shoulder");
  const nose = findKeypoint(keypoints, "nose");
  const mouthLeft = findKeypoint(keypoints, "mouth_left");
  const mouthRight = findKeypoint(keypoints, "mouth_right");

  // --- START: Add eye and ear keypoints for the new check ---
  const leftEye = findKeypoint(keypoints, "left_eye");
  const rightEye = findKeypoint(keypoints, "right_eye");
  const leftEar = findKeypoint(keypoints, "left_ear");
  const rightEar = findKeypoint(keypoints, "right_ear");
  // --- END: Add eye and ear keypoints ---

  if (leftShoulder && rightShoulder && nose) {
    const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);

    // ✅ PRIORITY 1: Check for Slouching first, as it's most important.
    if (baselinePosture && shoulderWidth > 0) {
      const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
      const noseToShoulderGap = avgShoulderY - nose.y;
      const deviation = baselinePosture.ratio ? (noseToShoulderGap / shoulderWidth - baselinePosture.ratio) / baselinePosture.ratio : 0;
      if (deviation < -0.25) flags.push("Slouching");
    }

    // --- START: NEW CHECK FOR VERTICAL HEAD TILT (LOOKING UP/DOWN) ---
    // ✅ PRIORITY 2: Check for vertical head tilt.
    if (leftEye && rightEye && leftEar && rightEar) {
      const avgEyeY = (leftEye.y + rightEye.y) / 2;
      const avgEarY = (leftEar.y + rightEar.y) / 2;
      const eyeDistance = Math.abs(leftEye.x - rightEye.x);

      // Calculate the vertical gap as a ratio of the eye distance
      const tiltRatio = (avgEarY - avgEyeY) / eyeDistance;

      if (tiltRatio < -0.2) {
        // Threshold for looking down
        flags.push("Looking Down");
      } else if (tiltRatio > 0.35) {
        // Threshold for looking up
        flags.push("Looking Up");
      }
    }
    // --- END: NEW CHECK FOR VERTICAL HEAD TILT ---

    // ✅ PRIORITY 3: Check for Head Leaning (side-to-side).
    if (mouthLeft && mouthRight) {
      const midShoulderX = (leftShoulder.x + rightShoulder.x) / 2;
      const midMouthX = (mouthLeft.x + mouthRight.x) / 2;
      if (Math.abs(midMouthX - midShoulderX) > shoulderWidth * 0.15) flags.push("Leaning Head");
    }

    // ✅ PRIORITY 4: Check for Tilted Shoulders last.
    const shoulderAngleDeg = Math.abs((Math.atan2(rightShoulder.y - leftShoulder.y, rightShoulder.x - leftShoulder.x) * 180) / Math.PI);
    if (shoulderAngleDeg < 174) flags.push("Tilted Shoulders");
  } else {
    flags.push("Key points hidden");
  }

  return flags;
} // ----------------------
// Helper: Update Posture UI
// ----------------------
function updatePostureUI(icon, label) {
  const postureIcon = document.getElementById("posture-icon");
  const postureLabel = document.getElementById("posture-label");
  if (postureIcon) postureIcon.textContent = icon;
  if (postureLabel) postureLabel.textContent = label;
}
