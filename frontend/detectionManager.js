/**
 * detectionManager.js
 *
 * Purpose:
 * This module handles real-time detection of both facial expressions and body poses
 * for the AI Interview Coach application. It initializes TensorFlow.js and Mediapipe
 * BlazePose backends, loads necessary models, and continuously processes webcam
 * video input to estimate user poses and emotions.
 *
 * Functions included:
 * - initializeTensorFlowBackend: Sets up TensorFlow.js with the WebGL backend.
 * - loadDetectionModels: Loads face-api.js and BlazePose models for emotion and posture detection.
 * - runPoseDetectionLoop: Continuously estimates poses from the video element.
 * - startDetection: Starts both pose and emotion detection loops after ensuring video readiness.
 * - stopAllDetections: Stops all detection loops and the webcam stream to free resources.
 *
 * This code is critical for providing non-verbal performance feedback in mock interviews.
 */
async function initializeTensorFlowBackend() {
  await faceapi.tf.setBackend("webgl");
  await faceapi.tf.ready();
}
const FACE_API_MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model/";
async function loadDetectionModels() {
  await Promise.all([faceapi.nets.tinyFaceDetector.loadFromUri(FACE_API_MODEL_URL), faceapi.nets.faceExpressionNet.loadFromUri(FACE_API_MODEL_URL)]);
  await new Promise((resolve) => setTimeout(resolve, 500));
  const model = poseDetection.SupportedModels.BlazePose;
  const detectorConfig = {
    runtime: "mediapipe",
    solutionPath: "https://cdn.jsdelivr.net/npm/@mediapipe/pose", // Tell it where to find the files
    modelType: "lite",
  };
  poseDetector = await poseDetection.createDetector(model, detectorConfig);
}

async function runPoseDetectionLoop(videoEl) {
  if (!poseDetector) return;
  const poses = await poseDetector.estimatePoses(videoEl);
  if (poses && poses.length > 0) {
    handlePoseResults(poses);
  }
  poseDetectionFrameId = requestAnimationFrame(() => runPoseDetectionLoop(videoEl));
}

function startDetection(videoEl) {
  if (poseDetectionFrameId) {
    cancelAnimationFrame(poseDetectionFrameId);
  }
  const checkDimensionsInterval = setInterval(() => {
    if (videoEl.videoWidth > 0) {
      clearInterval(checkDimensionsInterval);
      runPoseDetectionLoop(videoEl);
    }
  }, 100);
  detectionInterval = setInterval(runEmotionDetection, EMOTION_DETECTION_INTERVAL_MS);
}

function stopAllDetections() {
  // 1. Stop the pose detection loop (requestAnimationFrame)
  if (poseDetectionFrameId) {
    cancelAnimationFrame(poseDetectionFrameId);
    poseDetectionFrameId = null; // Reset the ID
  }

  // 2. Stop the emotion detection loop (setInterval)
  if (detectionInterval) {
    clearInterval(detectionInterval);
    detectionInterval = null; // Reset the ID
  }

  // 3. Stop the webcam stream
  stopWebcam();
}
