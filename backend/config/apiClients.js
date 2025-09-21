/**
 * config/apiClients.js
 * ------------
 * Sets up external AI clients (Google Generative AI).
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config(); // Ensure env vars are loaded

// Initialize Google Generative AI client
export const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

