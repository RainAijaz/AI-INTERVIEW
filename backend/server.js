/**
 * index.js
 * ------------
 * Entry point for the AI Interview Coach backend server.
 * Sets up Express, middlewares, and routes for /questions and /transcribe.
 */
import express from "express";
import fileUpload from "express-fileupload";
import cors from "cors";

import fetchQuestionsRoute from "./routes/fetchQuestions.js";
import transcribeRoute from "./routes/transcribe.js";

const app = express();

// ----------------------
// Middlewares
// ----------------------
app.use(fileUpload()); // Handle multipart file uploads
app.use(express.json()); // Parse JSON request bodies
app.use(cors()); // Enable Cross-Origin requests

// ----------------------
// API Routes
// ----------------------
app.use("/questions", fetchQuestionsRoute);
app.use("/transcribe", transcribeRoute);

// ----------------------
// Start Server
// ----------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Backend running at http://localhost:${PORT}`));
