/**
 * transcribe.js
 * -------------
 * Handles /transcribe route for the AI Interview Coach.
 *
 * Main responsibilities:
 * - Receives audio uploads from the frontend.
 * - Converts audio to the correct format using FFmpeg.
 * - Transcribes speech using Whisper.
 * - Classifies textual emotion using a BERT-based sentiment model.
 * - Maps generic emotion labels to interview-relevant feedback.
 * - Generates a comprehensive evaluation using a generative AI model.
 */

import express from "express";
import fs from "fs";
import path from "path";
import { HfInference } from "@huggingface/inference";
import { ffmpegPath, whisperExe, modelBin, uploadsDir } from "../utils/paths.js";
import { cleanTranscription, runCommand } from "../utils/fileHelpers.js";
import { genAI } from "../config/apiClients.js";

// Initialize Hugging Face inference client using API token
const hf = new HfInference(process.env.HF_ACCESS_TOKEN);
const router = express.Router();

// Map generic BERT sentiment labels to interview-relevant behavior
const emotionMap = {
  joy: "Confident",
  love: "Confident",
  surprise: "Engaged",
  sadness: "Hesitant",
  fear: "Cautious",
  anger: "Assertive",
};

/**
 * classifyParagraph
 * -----------------
 * Performs sentence-level emotion classification using Hugging Face BERT model.
 * Aggregates scores for each label and normalizes them to generate a dominant emotion.
 * @param {string} text - The transcribed text from the user.
 * @returns {object} - Object containing dominantEmotion and detailedScores.
 */
async function classifyParagraph(text) {
  const sentences = text.match(/[^.!?]+[.!?]?/g) || [text]; // Split text into sentences
  const scoreMap = {};
  const maxRetries = 3; // Retry mechanism in case HF API fails

  // Loop through each sentence and classify its emotion
  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed.length) continue;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await hf.textClassification({
          model: "bhadresh-savani/bert-base-uncased-emotion",
          inputs: trimmed,
        });

        // Accumulate scores for each label
        res.forEach((r) => {
          if (!scoreMap[r.label]) scoreMap[r.label] = 0;
          scoreMap[r.label] += r.score;
        });
        break; // Break retry loop if successful
      } catch (err) {
        if (attempt === maxRetries) {
          console.warn(`⚠️ HF API call failed for sentence: "${trimmed}". Error: ${err.message}`);
        } else {
          await new Promise((resolve) => setTimeout(resolve, 500)); // Wait before retry
        }
      }
    }
  }

  // Normalize scores to sum up to 1
  const totalScore = Object.values(scoreMap).reduce((sum, score) => sum + score, 0);
  if (totalScore > 0) {
    for (const label in scoreMap) {
      scoreMap[label] = parseFloat((scoreMap[label] / totalScore).toFixed(4));
    }
  }

  // Sort labels by descending score to get dominant emotion
  const sorted = Object.entries(scoreMap).sort((a, b) => b[1] - a[1]);
  return {
    dominantEmotion: sorted.length > 0 ? sorted[0][0] : "neutral",
    detailedScores: scoreMap,
  };
}

/**
 * POST /
 * ------
 * Main endpoint to handle audio uploads and generate evaluation.
 */
router.post("/", async (req, res) => {
  // Check if audio is uploaded
  if (!req.files || !req.files.audio) return res.status(400).send("No audio uploaded");

  // Extract data from request body
  const { questionText, domain, experience, postureData, emotionData } = req.body || {};
  const audioFile = req.files.audio;
  const uniqueId = Date.now() + "-" + Math.round(Math.random() * 1e9); // Unique filename

  // Define paths for uploaded audio
  const webmPath = path.join(uploadsDir, `${uniqueId}-answer.webm`);
  const wavPath = webmPath.replace(/\.[^/.]+$/, ".wav"); // Convert webm to wav

  try {
    // Move uploaded file to backend storage
    await audioFile.mv(webmPath);

    // Convert audio to WAV format using FFmpeg
    await runCommand(ffmpegPath, ["-y", "-i", webmPath, "-ar", "16000", "-ac", "1", "-acodec", "pcm_s16le", wavPath]);

    // Transcribe using Whisper executable
    const whisperOutput = await runCommand(whisperExe, ["-f", wavPath, "-m", modelBin]);
    const cleanedText = cleanTranscription(whisperOutput);

    // Skip evaluation if no speech detected
    if (!cleanedText) {
      return res.json({ skipEvaluation: true, message: "No speech detected." });
    }

    // Perform textual emotion classification
    const textualEmotionResult = await classifyParagraph(cleanedText);

    // Parse optional posture and facial emotion data
    const parsedPostureData = postureData ? JSON.parse(postureData) : null;
    const parsedEmotionData = emotionData ? JSON.parse(emotionData) : null;

    // Map dominant emotion to interview-relevant label
    const mappedDominantEmotion = emotionMap[textualEmotionResult.dominantEmotion] || textualEmotionResult.dominantEmotion;

    // Construct a master prompt for the generative AI evaluation
    const masterPrompt = `
      You are an elite AI interview coach. Your task is to provide a structured, precise evaluation based ONLY on the data provided.

      **INPUT DATA:**
      - **Context:** Role: "${domain}", Level: "${experience}".
      - **Question:** "${questionText}"
      - **Transcript:** "${cleanedText}"
      - **Posture Data:** ${JSON.stringify(parsedPostureData)}
      - **Facial Emotion Data:** ${JSON.stringify(parsedEmotionData)}
      - **Textual Tone (Mapped):** The dominant tone of the words was "${mappedDominantEmotion}".

      **YOUR TASK:**
      Respond ONLY with a valid JSON object. Follow these rules precisely:
      1.  **Ratings & Justifications:** For each rating (clarity, relevance, completeness), provide a score (1-5 integer) AND a concise, one-sentence justification explaining *why* you gave that score.
      2.  **Consistent Tone Analysis:** In 'sentimentTone', use the mapped term "${mappedDominantEmotion}" and compare it to the facial emotion data. Highlight alignment or divergence and its impact.
      3.  **Strict Adherence:** Do not add any text, markdown, or explanations outside the JSON structure.

      **JSON OUTPUT TEMPLATE:**
      {
        "evaluation": {
          "ratings": {
            "clarity": { "score": 1-5, "justification": "Why this score was given for clarity." },
            "relevance": { "score": 1-5, "justification": "Why this score was given for relevance." },
            "completeness": { "score": 1-5, "justification": "Why this score was given for completeness." }
          },
          "sentimentTone": "A 2-3 sentence analysis comparing the '${mappedDominantEmotion}' textual tone with facial data along with the tip to improve the verbal tone of answer.",
          "answerStrength": "The strongest part of the answer's content.",
          "howToMakeItBetter": ["Actionable tip 1.", "Actionable tip 2. and so on.. As many tips as required but not more than 5 tips"],
          "suggestedBetterAnswer": "An improved version of the answer."
        },
        "holisticFeedback": {
          "insight": "A 2-3 sentence synthesis of transcript, tone, and non-verbal cues, noting any conflicts.",
          "strength": "The single most positive non-verbal behavior observed.",
          "improvement_tip": "The single most impactful non-verbal tip."
        }
      }
    `;

    // Call the generative AI model for evaluation
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(masterPrompt);

    // Parse AI response JSON
    const rawResponseText = result.response
      .text()
      .trim()
      .replace(/```json|```/g, "");
    const aiFeedback = JSON.parse(rawResponseText);

    // Respond with all evaluation data
    res.json({
      transcription: cleanedText,
      postureAnalysis: { data: parsedPostureData },
      emotionAnalysis: { data: parsedEmotionData },
      dominantEmotion: textualEmotionResult.dominantEmotion,
      textualEmotionAnalysis: { data: textualEmotionResult.detailedScores },
      evaluation: aiFeedback.evaluation,
      holisticFeedback: aiFeedback.holisticFeedback,
      question: questionText,
    });
  } catch (err) {
    // Catch and log any errors during processing
    console.error("Error in /transcribe route:", err);
    res.status(500).send(`Processing failed: ${err.message}`);
  } finally {
    // Clean up temporary audio files
    fs.unlink(webmPath, () => {});
    fs.unlink(wavPath, () => {});
  }
});

export default router;
