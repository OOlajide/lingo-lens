# LingoLens
### Real-time AI Language Tutor powered by Gemini Live API

LingoLens is an interactive language learning application that leverages the power of the Gemini Live API to provide a real-time, visually-grounded tutoring experience. By analyzing your webcam feed and microphone input, LingoLens offers a conversational way to learn vocabulary and practice pronunciation in various target languages.

---

## 🚀 Key Features
- **Real-time Multimodal Interaction**: Low-latency communication with Gemini 2.5 Flash Live using both audio and video streams.
- **Contextual Learning**: The AI tutor can identify objects and actions in your environment to provide relevant vocabulary.
- **Support for Multiple Languages**: Choose from a wide range of target languages, including Spanish, French, German, Arabic, Japanese, Korean, and more.

---

## 🛠 Tech Stack
- **Backend**: Node.js, Express
- **Frontend**: Vanilla JS, Vite
- **AI Integration**: Gemini Live API (`gemini-2.5-flash-native-audio-preview-12-2025`)

![LingoLens Architecture Diagram](architecture-diagram.png)

---

## 📋 Prerequisites
- **Node.js**: Version 18.0.0 or higher.
- **Gemini API Key**: Obtain a key from the [Google AI Studio](https://aistudio.google.com/).

---

## 🧪 Reproducible Testing Instructions

To set up and run LingoLens locally, please follow these steps:

### Step 1: Clone the Repository
```bash
git clone <repository-url>
cd lingo-lens
```

### Step 2: Environment Configuration
1. Create a `.env` file in the root directory:
   ```bash
   cp .env.example .env
   ```
2. Open the `.env` file and add your Gemini API Key:
   ```env
   GEMINI_API_KEY=your_actual_api_key_here
   ```

### Step 3: Installation
Install the necessary dependencies for both the backend and frontend:
```bash
npm install
```

### Step 4: Build and Start the Application
1. Build the frontend assets using Vite:
   ```bash
   npm run build
   ```
2. Start the Node.js server:
   ```bash
   npm start
   ```
   The server will start, typically on `http://localhost:8080` (or the port specified in your environment).

### Step 5: Access and Verify
1. Open your browser and navigate to `http://localhost:8080`.
2. Grant the application permission to access your **Camera** and **Microphone**.
3. Use the **GUIDE** button to understand the basic workflow.
4. Select a target language (e.g., Japanese).
5. Click **START SESSION** to begin your real-time tutoring session.
6. Interact with the tutor by showing objects to your camera or asking questions like "What is this?".

---