// detectionManager.js
async function initializeTensorFlowBackend() {
  await faceapi.tf.setBackend("webgl");
  await faceapi.tf.ready();
}

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
