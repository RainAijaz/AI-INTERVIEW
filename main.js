// ============================================================================
// main.js
// ============================================================================
// Purpose:
// --------
// This module handles the initialization of AI models, webcam setup, and canvas
// drawing for the interview coach application. It ensures the video stream is
// captured, the AI detection models are loaded, and drawing contexts are ready.
//
// Responsibilities:
// - Initialize TensorFlow backend and face/pose detection models
// - Manage webcam stream lifecycle (start, stop)
// - Set up the drawing canvas for rendering overlays
// - Provide user feedback during model loading (via "Get Started" button)
//
// ============================================================================

// ------------------------------
// Global State Variables
// ------------------------------
let mediaRecorder; // Records audio from the microphone
let audioChunks = []; // Buffers recorded audio data
let recording = false; // Flag: are we currently recording?

let poseDetector; // Reference to pose detection model (BlazePose)
let videoElement; // HTML <video> element for webcam
let canvasElement; // HTML <canvas> element for overlays
let canvasContext; // Drawing context for the canvas
let detectionInterval; // Interval ID for emotion detection loop
let poseDetectionFrameId; // Animation frame ID for pose detection loop

// ------------------------------
// Constants
// ------------------------------
const EMOTION_DETECTION_INTERVAL_MS = 1000; // Emotion check every 1 second

// ------------------------------
// App Initialization (on load)
// ------------------------------
// When the page loads, disable the "Get Started" button, load all models,
// and re-enable the button once initialization completes.
window.addEventListener("load", async () => {
  const getStartedBtn = document.getElementById("get-started-btn");
  if (getStartedBtn) updateGetStartedBtn("Loading AI Models...", true);
  try {
    await initializeApp(); // Loads backend + detection models + canvas
    if (getStartedBtn) updateGetStartedBtn("Get Started", false);
    speechSynthesis.cancel();
  } catch (err) {
    console.error("❌ App initialization failed:", err);
    showNotification("Failed to load AI models. Please refresh.", "error");
    if (getStartedBtn) updateGetStartedBtn("Error Loading Models", true);
  }
});

// ------------------------------
// Initialization Helpers
// ------------------------------

/**
 * Performs all startup tasks required for AI detections.
 * - Initializes TensorFlow backend
 * - Loads face/pose detection models
 * - Sets up canvas for rendering
 */
async function initializeApp() {
  await initializeTensorFlowBackend();
  await loadDetectionModels();
  setupCanvasDrawing();
}

/**
 * Updates the "Get Started" button label and disabled state.
 * @param {string} label - The text to display on the button
 * @param {boolean} disabled - Whether the button should be disabled
 */
function updateGetStartedBtn(label, disabled) {
  const btn = document.getElementById("get-started-btn");
  if (!btn) return;
  btn.textContent = label;
  btn.disabled = disabled;
}

// ------------------------------
// Webcam Handling
// ------------------------------

/**
 * Starts the webcam stream and attaches it to a <video> element.
 * @param {HTMLVideoElement} videoEl - The video element to attach stream to
 * @returns {Promise<void>} Resolves when metadata is loaded
 */
async function setupWebcamStream(videoEl) {
  if (!videoEl) throw new Error("Missing video element.");
  videoElement = videoEl;

  // Request webcam video (no audio here, handled separately)
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  });

  // Attach stream to video element
  videoElement.srcObject = stream;

  // Wait until video metadata is ready
  return new Promise((resolve) => {
    videoElement.onloadedmetadata = () => resolve();
  });
}

/**
 * Stops the webcam stream and releases resources.
 * Ensures all media tracks are properly closed.
 */
function stopWebcam() {
  if (!videoElement || !videoElement.srcObject) return;

  const stream = videoElement.srcObject;
  const tracks = stream.getTracks();

  tracks.forEach((track) => track.stop()); // Stop each track explicitly
  videoElement.srcObject = null;
}

// ------------------------------
// Canvas Handling
// ------------------------------

/**
 * Sets up the canvas element used for drawing detection overlays.
 * - Validates existence of the <canvas> element
 * - Stores the 2D drawing context for later use
 */
function setupCanvasDrawing() {
  canvasElement = document.getElementById("canvas");
  if (!canvasElement) throw new Error("Missing canvas element.");
  canvasContext = canvasElement.getContext("2d");
}
