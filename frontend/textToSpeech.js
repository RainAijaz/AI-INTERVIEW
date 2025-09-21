// textToSpeech.js
// ----------------------
// Text-to-Speech Utility for AI Interview Coach
// ----------------------
// This module provides a function to speak text aloud using the
// browser's SpeechSynthesis API. It respects a UI toggle to enable/disable
// speech, allows for voice selection, and applies configurable rate/pitch.
//
// Usage:
//   speak("Hello, how are you?");
// ----------------------

/**
 * Speak the provided text aloud using the browser's TTS engine.
 * Respects the "Speak Questions" toggle in the UI.
 *
 * @param {string} text - The text to be spoken.
 */
function speak(text) {
  // Check if the "Speak Questions" toggle exists and is enabled
  const speakToggle = document.getElementById("speak-questions-toggle");
  if (!speakToggle || !speakToggle.checked) {
    return; // TTS is disabled, so exit early
  }

  // Stop any currently active speech
  speechSynthesis.cancel();

  // Create a new utterance for the text
  const utterance = new SpeechSynthesisUtterance(text);

  // Set speech properties for clarity
  utterance.rate = 0.9;   // slightly slower than normal
  utterance.pitch = 1.1;  // slightly higher pitch

  // Attempt to use a high-quality voice if available
  const voices = speechSynthesis.getVoices();
  const preferredVoice = voices.find(
    (voice) =>
      voice.name.includes("Google US English") ||
      voice.name.includes("Samantha") ||
      voice.name.includes("Microsoft Zira")
  );
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  // Speak the utterance
  speechSynthesis.speak(utterance);
}
