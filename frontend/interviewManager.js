/**
 * interviewManager.js
 * -----------------------
 * Purpose:
 * - Controls the flow of the interview session.
 * - Manages question fetching, session state, answer recording, and final report transition.
 *
 * Responsibilities:
 * - Interview lifecycle: start, fetch questions, answer handling, end/reset.
 * - UI updates for question text, counters, and session overlays.
 * - Coordinates with detectionManager (baseline, webcam, AI detections).
 * - Delegates report generation to reportManager.
 *
 * NOTE:
 * - No DOM/UI layout logic lives here (that’s in uiManager.js).
 * - No raw recording logic lives here (that’s in audioRecorder.js).
 */

// ----------------------
// DOM Elements
// ----------------------
const getStartedBtn = document.getElementById("get-started-btn");
const startSessionBtn = document.getElementById("start-session-btn");
const setBaselineBtn = document.getElementById("set-baseline-btn");
const answerBtn = document.getElementById("answer-btn");
const endInterviewBtn = document.getElementById("end-interview-btn");
const restartInterviewBtn = document.getElementById("restart-interview-btn");

const questionTextElement = document.getElementById("current-question-text");
const questionCounterElement = document.getElementById("question-counter");
const preInterviewOverlay = document.getElementById("pre-interview-overlay");

// ----------------------
// State Variables
// ----------------------
let isFetchingQuestions = true;
let answersBeingProcessed = 0;

let questions = [];
let currentQuestionIndex = 0;
let totalQuestions = 0;
let domain = "";
let experience = "";
let questionType = "all";

let interviewData = [];
let currentAnswerEmotions = [];
let currentAnswerPostures = [];

// ----------------------
// Session Lifecycle
// ----------------------

/**
 * startSession
 * ----------------------
 * Starts a new interview session after user input is validated.
 */
async function startSession() {
  domain = document.getElementById("domain").value.trim();
  experience = document.getElementById("experience").value;
  totalQuestions = parseInt(document.getElementById("question-count").value, 10);
  questionType = document.getElementById("question-type").value;

  if (!domain || !experience || !totalQuestions) {
    showNotification("Please fill out all fields.", "error");
    return;
  }

  showScreen("interview");
  fetchQuestions();

  const mainVideo = document.getElementById("video");
  await setupWebcamStream(mainVideo);

  mainVideo.addEventListener("canplay", () => {
    startDetection(mainVideo);
    setBaselineBtn.disabled = false;
  });
}

/**
 * fetchQuestions
 * ----------------------
 * Fetches interview questions from backend based on domain, experience, and type.
 */
async function fetchQuestions() {
  try {
    isFetchingQuestions = true;

    const response = await fetch("http://localhost:3000/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, experience, count: totalQuestions, questionType }),
    });

    if (!response.ok) throw new Error("Failed to fetch questions");
    const data = await response.json();

    questions = data.questions;
    currentQuestionIndex = 0;
    interviewData = [];
    isFetchingQuestions = false;

    if (questionTextElement.textContent === "Loading Interview Questions...") {
      displayCurrentQuestion();
    }
  } catch (err) {
    console.error(err);
    showNotification("Could not fetch questions. Please try again.", "error");

    setBaselineBtn.textContent = "Set Baseline & Begin";
    preInterviewOverlay.classList.add("visible");
  }
}

// ----------------------
// Answer Handling
// ----------------------

/**
 * handleAnswerButtonClick
 * ----------------------
 * Toggles recording state for an answer (start vs stop).
 */
async function handleAnswerButtonClick() {
  if (!recording) {
    startRecording();
  } else {
    stopRecording();
  }
}

/**
 * startRecording
 * ----------------------
 * Prepares audio recording for answer capture.
 */
async function startRecording() {
  speechSynthesis.cancel();
  currentAnswerEmotions = [];
  currentAnswerPostures = [];

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  audioChunks = [];

  mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
  mediaRecorder.start();
  recording = true;

  answerBtn.textContent = "⏹️ Stop Answer";
  answerBtn.classList.add("recording");
}

/**
 * stopRecording
 * ----------------------
 * Ends recording and prepares to process answer.
 */
function stopRecording() {
  mediaRecorder.stop();
  answersBeingProcessed++; // INCREMENT here when stopped
  recording = false;
  mediaRecorder.onstop = processAnswer;

  answerBtn.textContent = "🎤 Start Answer";
  answerBtn.disabled = true;
  answerBtn.classList.remove("recording");

  displayCurrentQuestion();
}

/**
 * processAnswer
 * ----------------------
 * Processes a recorded answer:
 * - Packages audio + emotion + posture data
 * - Sends to backend for transcription/evaluation
 * - Saves results into interviewData
 */
async function processAnswer() {
  const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
  const formData = prepareFormData(audioBlob);
  try {
    const data = await sendAnswerToBackend(formData);
    if (data.skipEvaluation) {
      showNotification(data.message, "error");
    } else {
      interviewData.push(data);
    }
  } catch (err) {
    console.error(err);
    showNotification("Error processing your answer.", "error");
  } finally {
    answersBeingProcessed--; // DECREMENT when finished
  }
}

/**
 * prepareFormData
 * ----------------------
 * Builds FormData with audio, question info, and posture/emotion distributions.
 */
function prepareFormData(audioBlob) {
  const formData = new FormData();
  formData.append("audio", audioBlob, "answer.webm");

  const currentQ = questions[currentQuestionIndex - 2];
  formData.append("questionIndex", currentQuestionIndex + 1);
  formData.append("questionText", currentQ.text);
  formData.append("questionType", currentQ.type);
  formData.append("domain", domain);
  formData.append("experience", experience);
  formData.append("skipSentiment", currentQ.type === "technical" ? "true" : "false");

  const postureDistribution = calculateDistribution(currentAnswerPostures);
  const emotionDistribution = calculateDistribution(currentAnswerEmotions);

  formData.append("postureData", JSON.stringify(postureDistribution));
  formData.append("emotionData", JSON.stringify(emotionDistribution));

  return formData;
}

/**
 * calculateDistribution
 * ----------------------
 * Converts an array of labels (emotions/postures) into percentage distribution.
 */
function calculateDistribution(dataArray) {
  if (dataArray.length === 0) return {};
  const counts = dataArray.reduce((acc, val) => {
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
  const distribution = {};
  for (const key in counts) {
    distribution[key] = Math.round((counts[key] / dataArray.length) * 100);
  }
  return distribution;
}

/**
 * sendAnswerToBackend
 * ----------------------
 * Sends FormData with recorded answer to backend for transcription.
 */
async function sendAnswerToBackend(formData) {
  const response = await fetch("http://localhost:3000/transcribe", {
    method: "POST",
    body: formData,
  });
  if (!response.ok) throw new Error(`Backend error: ${response.status}`);
  return await response.json();
}

// ----------------------
// Ending / Resetting Interview
// ----------------------

/**
 * endInterview
 * ----------------------
 * Ends the current interview session:
 * - Stops detections
 * - Waits for all answers to finish processing
 * - Displays report
 */
async function endInterview() {
  speechSynthesis.cancel();
  currentQuestionIndex++;

  if (recording) {
    mediaRecorder.stop();
    answersBeingProcessed++;
    recording = false;
  }

  showScreen("report");
  stopAllDetections();

  const loader = document.getElementById("report-loader");
  const content = document.getElementById("report-content");
  const controls = document.querySelector(".report-controls");
  const downloadBtn = document.getElementById("download-report-btn");

  showReportLoader(loader, content, controls, downloadBtn);
  await waitForAllAnswers();

  setTimeout(() => {
    generateReport();
    showReportContent(loader, content, controls, downloadBtn);
  }, 500);
}

/**
 * showReportLoader
 * ----------------------
 * Prepares UI for loading state before report is generated.
 */
function showReportLoader(loader, content, controls, downloadBtn) {
  loader.style.display = "block";
  content.style.display = "none";
  controls.style.display = "none";
  if (downloadBtn) downloadBtn.disabled = true;
}

/**
 * showReportContent
 * ----------------------
 * Switches UI to show report content once it’s ready.
 */
function showReportContent(loader, content, controls, downloadBtn) {
  loader.style.display = "none";
  content.style.display = "block";
  controls.style.display = "flex";
  if (downloadBtn) downloadBtn.disabled = false;
}

/**
 * waitForAllAnswers
 * ----------------------
 * Waits until all answer processing has finished before generating report.
 */
function waitForAllAnswers() {
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (answersBeingProcessed === 0) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);
  });
}

/**
 * resetInterview
 * ----------------------
 * Clears all interview state and resets UI back to setup screen.
 */
function resetInterview() {
  questions = [];
  currentQuestionIndex = 0;
  totalQuestions = 0;
  interviewData = [];
  currentAnswerEmotions = [];
  currentAnswerPostures = [];
  answersBeingProcessed = 0;
  isFetchingQuestions = false;
  if (typeof baselinePosture !== "undefined") baselinePosture = null;

  questionTextElement.textContent = "Waiting for you to set your baseline posture...";
  questionCounterElement.textContent = "";
  setBaselineBtn.disabled = false;
  setBaselineBtn.textContent = "Set Baseline & Begin";
  preInterviewOverlay.classList.add("visible");

  showScreen("setup");
}

// ----------------------
// Event Listeners
// ----------------------
setBaselineBtn.addEventListener("click", async (event) => {
  const baselineWasSet = await setBaseline();
  if (!baselineWasSet) return;

  const btn = event.target;
  btn.disabled = true;
  btn.textContent = "Loading Interview...";
  preInterviewOverlay.classList.remove("visible");
  await displayCurrentQuestion();
});

endInterviewBtn.addEventListener("click", endInterview);
restartInterviewBtn.addEventListener("click", resetInterview);
answerBtn.addEventListener("click", handleAnswerButtonClick);
getStartedBtn.addEventListener("click", () => showScreen("setup"));
startSessionBtn.addEventListener("click", startSession);
