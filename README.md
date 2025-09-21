# AI-Interview-Coach

## 🚀 Getting Started

### 1. Create Your API Keys and `.env` File

You need to create your own API keys to use this project. Both are free to generate:

- **Google API Key:** Get it here → [Google AI Studio API Key](https://aistudio.google.com/apikey)
- **Hugging Face Access Token:** Get it here → [Hugging Face Tokens](https://huggingface.co/settings/tokens)

After creating your keys, make a `.env` file inside the `backend` folder and add the following:

```env
GOOGLE_API_KEY=your_google_api_key_here
HF_ACCESS_TOKEN=your_huggingface_access_token_here
```

> ⚠️ **Do not share your keys publicly**. Keep them secret.

---

### 2. Setup Whisper

Download the `ggml-base.en.bin` model file from Hugging Face:

🔗 [Download ggml-base.en.bin](https://huggingface.co/ggerganov/whisper.cpp/blob/main/ggml-base.en.bin)

After downloading, place the file inside:

```
backend/whisper/
```

---

### 3. Install FFmpeg (Non-Windows Users Only)

- **Windows Users**: FFmpeg is already included in the code. No action required.
- **macOS/Linux Users**: Please install FFmpeg manually before proceeding:

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg
```

---

### 4. Install Dependencies

Open your terminal and navigate to the backend folder:

```bash
cd backend
```

Then install the dependencies:

```bash
npm ci
```

---

### 5. Start the Server

Run the backend server:

```bash
npm start
```

---

## ✅ You’re Done!

Your server should now be running. You can start interacting with the project using your preferred client or front-end.

---

## 📝 Notes

- Make sure Node.js and npm are installed on your system.
- If you run into permission issues, try running the commands with `sudo` (Linux/macOS).
- Ensure the `ggml-base.en.bin` file is exactly inside `backend/whisper` or the backend will fail to start.
- Make sure your `.env` file exists with your API keys before starting the server.
