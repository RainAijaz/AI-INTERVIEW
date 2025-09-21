/**
 * fetchQuestions.js
 * -----------------
 * Handles POST /questions route.
 * Generates domain-specific interview questions using Google Generative AI (Gemini 1.5 Flash).
 * Features:
 *  - Respects exact question count requested by the user.
 *  - Produces varied questions each time to avoid repetition.
 *  - Supports question types (introductory, technical, behavioral, etc.).
 *  - Retry logic for model overload errors.
 */

import express from "express";
import { genAI } from "../config/apiClients.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { domain, experience, count, questionType } = req.body;

  if (!domain || !experience || !count) return res.status(400).send("Missing parameters");

  try {
    const questionCount = parseInt(count, 10);
    // --- Experience-based context ---
    let experienceContext = experience === "Entry" ? "The candidate is new to the field. Questions should test fundamental concepts, problem-solving skills, and eagerness to learn. Avoid questions requiring extensive real-world experience." : experience === "Intermediate" ? "The candidate should discuss technical trade-offs and demonstrate solid hands-on experience." : "The questions should probe architectural thinking, mentorship, and leadership qualities, not just definitions.";

    // --- Question type instruction ---
    let typeInstruction = "";
    if (questionType && questionType !== "all") {
      typeInstruction = `CRITICAL: All questions MUST be of type '${questionType.replace("_", " ")}'.`;
    }

    // --- Explicit structure instructions based on count ---
    let structureInstruction = "";
    if (count === 1) {
      structureInstruction = "Provide exactly 1 introductory icebreaker question.";
    } else if (count === 2) {
      structureInstruction = `
Provide exactly 2 questions:
- FIRST: introductory icebreaker
- SECOND: technical, behavioral, or situational
`;
    } else {
      structureInstruction = `
Provide exactly ${count} questions following a logical interview arc:
- FIRST: introductory icebreaker
- MIDDLE: technical, behavioral, or situational questions
- LAST: closing question
`;
    }

    // --- Variation instruction to avoid repeated questions ---
    const variationInstruction = "Ensure each question is unique and phrased differently from previous outputs. Avoid repeating exact questions across multiple requests.";

    // DYNAMIC LENGTH CONSTRAINT ---
    let lengthConstraint = "";
    if (experience === "Entry" || experience === "Intermediate") {
      lengthConstraint = "IMPORTANT: All questions must be concise and direct. Avoid long scenarios. A question can have 2-3 short, logically connected sub-parts, but the entire question must be brief.";
    } else if (experience === "Advanced") {
      lengthConstraint = "For this advanced candidate, it is acceptable to use a brief scenario (2-3 sentences) to set up complex architectural or leadership questions. However, the final question asked should still be clear and focused.";
    }

    // --- Construct the final prompt ---
    const prompt = `
You are an expert hiring manager at a top-tier tech company. 
Craft ${count} practical interview questions for a "${experience}" level candidate in "${domain}".

${experienceContext}

${typeInstruction}
${structureInstruction}
${variationInstruction}
${lengthConstraint} 

**Output Format:** Return output ONLY as a JSON array of objects:
[
  {
    "text": "Full question text",
    "type": "introductory | technical | practical | behavioral | motivational | closing"
  }
]
`;
    // --- Initialize the model with some randomness for variation ---
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      temperature: 0.7, // Adds variation so repeated requests are different
    });

    // --- Retry logic for model overload ---
    let result;
    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) {
      try {
        result = await model.generateContent(prompt);
        break;
      } catch (err) {
        if (err.status === 503 && i < maxRetries - 1) {
          const delay = Math.pow(2, i) * 1000;
          console.warn(`⚠️ Model overloaded. Retrying in ${delay / 1000}s...`);
          await new Promise((r) => setTimeout(r, delay));
        } else throw err;
      }
    }

    // --- Parse the JSON response ---
    let text = result.response
      .text()
      .trim()
      .replace(/```json|```/g, "");
    const questions = JSON.parse(text);

    res.json({ questions });
  } catch (err) {
    console.error("❌ Error generating questions:", err);
    res.status(err.status || 500).send("Failed to generate questions");
  }
});

export default router;
