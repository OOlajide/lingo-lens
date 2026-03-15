import { GoogleGenAI, Modality } from '@google/genai';
import { systemInstructions } from './system-instructions.js';

let stream;
let videoElement;
let canvas, ctx;
let audioContext;
let audioWorkletNode;
let session;
let isSessionActive = false;
let nextPlayTime = 0;
let frameInterval;
let lastSpeaker = null;
let currentMsgContent = null;

// DOM Elements
const statusText = document.getElementById('statusText');
const statusDot = document.getElementById('statusDot');
const visualizer = document.getElementById('visualizer');
const transcriptEl = document.getElementById('transcript');
const emptyState = document.getElementById('emptyState');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const languageSelect = document.getElementById('languageSelect');
const ambientGlow = document.getElementById('ambientGlow');

function updateStatus(state, text) {
  statusText.textContent = text;
  statusDot.className = 'status-dot'; // reset
  if (state === 'active') statusDot.classList.add('active');
  if (state === 'error') statusDot.classList.add('error');
  if (state === 'connecting') statusDot.classList.add('connecting');
  
  if (state === 'active') {
    visualizer.classList.add('active');
    ambientGlow.classList.add('active');
  } else {
    visualizer.classList.remove('active');
    ambientGlow.classList.remove('active');
  }
}

async function initMedia() {
  videoElement = document.getElementById('webcam');
  stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480 },
    audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
  });
  videoElement.srcObject = stream;
  videoElement.classList.add('active');
  
  canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  ctx = canvas.getContext('2d');
}

function base64Encode(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function playAudio(base64Data) {
  if (!audioContext) return;
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const int16Array = new Int16Array(bytes.buffer);
  const audioBuffer = audioContext.createBuffer(1, int16Array.length, 24000);
  const channelData = audioBuffer.getChannelData(0);
  for (let i = 0; i < int16Array.length; i++) {
    channelData[i] = int16Array[i] / 32768.0;
  }
  
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  
  if (nextPlayTime < audioContext.currentTime) {
    nextPlayTime = audioContext.currentTime;
  }
  source.start(nextPlayTime);
  nextPlayTime += audioBuffer.duration;
  
  return source;
}

function appendTranscript(text, isTutor) {
  if (!text) return;
  
  if (emptyState && emptyState.parentNode) {
    emptyState.remove();
  }
  
  const speaker = isTutor ? 'tutor' : 'user';
  
  if (speaker !== lastSpeaker) {
    const div = document.createElement('div');
    div.className = 'msg ' + (isTutor ? 'tutor-msg' : 'user-msg');
    
    const label = document.createElement('div');
    label.className = 'msg-label';
    label.textContent = isTutor ? 'Tutor' : 'You';
    
    currentMsgContent = document.createElement('div');
    currentMsgContent.className = 'msg-content';
    
    div.appendChild(label);
    div.appendChild(currentMsgContent);
    transcriptEl.appendChild(div);
    
    lastSpeaker = speaker;
  }
  
  // Append text with a space if content already exists
  const separator = currentMsgContent.innerHTML ? ' ' : '';
  let processedText = text.trim();
  
  // Simple markdown bold parser
  // This handles the case where ** might be split across messages by joining first
  let fullText = currentMsgContent.getAttribute('data-raw') || '';
  fullText += separator + processedText;
  currentMsgContent.setAttribute('data-raw', fullText);
  
  // Replace **text** with <b>text</b>
  const htmlText = fullText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  currentMsgContent.innerHTML = htmlText;
  
  transcriptEl.scrollTop = transcriptEl.scrollHeight;
}

startBtn.onclick = async () => {
  try {
    startBtn.disabled = true;
    updateStatus('connecting', 'Initializing Media...');
    
    if (!stream) {
      await initMedia();
    }
    
    updateStatus('connecting', 'Fetching Token...');
    // Fetch ephemeral token from our backend
    const res = await fetch('/api/token');
    if (!res.ok) throw new Error('Failed to fetch token');
    const { token } = await res.json();
    
    updateStatus('connecting', 'Connecting to Gemini...');
    
    // CRITICAL FIX: The Live API requires v1alpha when using ephemeral tokens.
    const ai = new GoogleGenAI({ 
      apiKey: token,
      httpOptions: { apiVersion: 'v1alpha' }
    });
    
    const selectedLanguage = languageSelect.value;
    const finalInstructions = systemInstructions + `\n\nCRITICAL: The user wants to learn ${selectedLanguage}. Speak in English for guidance and ${selectedLanguage} for the vocabulary.`;
    
    session = await ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: { parts: [{ text: finalInstructions }] },
        inputAudioTranscription: { outputTranscriptionMimeType: 'text/plain' },
        outputAudioTranscription: { outputTranscriptionMimeType: 'text/plain' }
      },
      callbacks: {
        onopen: () => {
          updateStatus('active', 'Session Active');
          isSessionActive = true;
          startBtn.disabled = true;
          stopBtn.disabled = false;
          languageSelect.disabled = true;
        },
        onmessage: (response) => {
          const content = response.serverContent;
          if (content?.modelTurn?.parts) {
            for (const part of content.modelTurn.parts) {
              if (part.inlineData) {
                playAudio(part.inlineData.data);
              }
            }
          }
          if (content?.inputTranscription) {
            appendTranscript(content.inputTranscription.text, false);
          }
          if (content?.outputTranscription) {
            appendTranscript(content.outputTranscription.text, true);
          }
          if (content?.interrupted) {
            // VAD interrupted, stop current queue
            nextPlayTime = audioContext.currentTime;
          }
        },
        onerror: (error) => {
          console.error("Live API Error:", error);
          updateStatus('error', 'Error Occurred');
        },
        onclose: (event) => {
          console.log("Session closed", event);
          if (isSessionActive) {
            updateStatus('ready', 'Session Ended');
            stopSession();
          }
        }
      }
    });

    audioContext = new AudioContext({ sampleRate: 16000 });
    await audioContext.audioWorklet.addModule('/audio-processor.js');
    const source = audioContext.createMediaStreamSource(stream);
    audioWorkletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
    source.connect(audioWorkletNode);
    audioWorkletNode.connect(audioContext.destination);

    audioWorkletNode.port.onmessage = (event) => {
      if (isSessionActive) {
        const pcmData = event.data;
        const base64Data = base64Encode(pcmData.buffer);
        session.sendRealtimeInput({
          audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      }
    };
    
    // Send video frames at ~1 FPS
    frameInterval = setInterval(() => {
      if (isSessionActive) {
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
        const base64Data = dataUrl.split(',')[1];
        session.sendRealtimeInput({
          video: { data: base64Data, mimeType: 'image/jpeg' }
        });
      }
    }, 1000); 
    
  } catch (err) {
    console.error(err);
    updateStatus('error', 'Setup failed');
    startBtn.disabled = false;
  }
};

function stopSession() {
  isSessionActive = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  languageSelect.disabled = false;
  updateStatus('ready', 'Ready');
  
  lastSpeaker = null;
  currentMsgContent = null;
  nextPlayTime = 0;
  
  clearInterval(frameInterval);
  if (session) session.close();
  
  if (audioWorkletNode) {
    audioWorkletNode.disconnect();
    audioWorkletNode = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
}

stopBtn.onclick = stopSession;
