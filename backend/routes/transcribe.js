/**
 * transcribe.js
 * ------------
 * Handles /transcribe route.
 * - Receives audio, converts it, and transcribes with Whisper.
 * - Classifies the emotion of the transcribed text using a separate model.
 * - Uses a single, powerful AI call to generate a comprehensive
 * evaluation by synthesizing verbal content, non-verbal cues, and textual emotion.
 */

import express from "express";
import fs from "fs";
import path from "path";
import { HfInference } from "@huggingface/inference";
import { ffmpegPath, whisperExe, modelBin, uploadsDir } from "../utils/paths.js";
import { cleanTranscription, runCommand } from "../utils/fileHelpers.js";
import { genAI } from "../config/apiClients.js";

const hf = new HfInference(process.env.HF_ACCESS_TOKEN);
const router = express.Router();

const emotionMap = {
  joy: "Confident",
  love: "Confident",
  surprise: "Engaged",
  sadness: "Hesitant",
  fear: "Cautious",
  anger: "Assertive",
};

async function classifyParagraph(text) {
  const sentences = text.match(/[^.!?]+[.!?]?/g) || [text];
  const scoreMap = {};
  const maxRetries = 3;

  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed.length) continue;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await hf.textClassification({
          model: "bhadresh-savani/bert-base-uncased-emotion",
          inputs: trimmed,
        });
        res.forEach((r) => {
          if (!scoreMap[r.label]) scoreMap[r.label] = 0;
          scoreMap[r.label] += r.score;
        });
        break;
      } catch (err) {
        if (attempt === maxRetries) {
          console.warn(`⚠️ HF API call failed for sentence: "${trimmed}". Error: ${err.message}`);
        } else {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }
  }

  const totalScore = Object.values(scoreMap).reduce((sum, score) => sum + score, 0);
  if (totalScore > 0) {
    for (const label in scoreMap) {
      scoreMap[label] = parseFloat((scoreMap[label] / totalScore).toFixed(4));
    }
  }

  const sorted = Object.entries(scoreMap).sort((a, b) => b[1] - a[1]);
  return {
    dominantEmotion: sorted.length > 0 ? sorted[0][0] : "neutral",
    detailedScores: scoreMap,
  };
}

router.post("/", async (req, res) => {
  if (!req.files || !req.files.audio) return res.status(400).send("No audio uploaded");

  const { questionText, domain, experience, postureData, emotionData } = req.body || {};
  const audioFile = req.files.audio;
  const uniqueId = Date.now() + "-" + Math.round(Math.random() * 1e9);
  const webmPath = path.join(uploadsDir, `${uniqueId}-answer.webm`);
  const wavPath = webmPath.replace(/\.[^/.]+$/, ".wav");

  try {
    await audioFile.mv(webmPath);
    await runCommand(ffmpegPath, ["-y", "-i", webmPath, "-ar", "16000", "-ac", "1", "-acodec", "pcm_s16le", wavPath]);
    const whisperOutput = await runCommand(whisperExe, ["-f", wavPath, "-m", modelBin]);
    const cleanedText = cleanTranscription(whisperOutput);

    if (!cleanedText) {
      return res.json({ skipEvaluation: true, message: "No speech detected." });
    }

    const textualEmotionResult = await classifyParagraph(cleanedText);
    const parsedPostureData = postureData ? JSON.parse(postureData) : null;
    const parsedEmotionData = emotionData ? JSON.parse(emotionData) : null;
    const mappedDominantEmotion = emotionMap[textualEmotionResult.dominantEmotion] || textualEmotionResult.dominantEmotion;

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

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(masterPrompt);
    const rawResponseText = result.response
      .text()
      .trim()
      .replace(/```json|```/g, "");
    const aiFeedback = JSON.parse(rawResponseText);

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
    console.error("Error in /transcribe route:", err);
    res.status(500).send(`Processing failed: ${err.message}`);
  } finally {
    fs.unlink(webmPath, () => {});
    fs.unlink(wavPath, () => {});
  }
});

export default router;
