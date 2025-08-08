// app.js - Classroom Sonic Feedback Logic


let audioContext;
let analyser;
let microphone;
let javascriptNode;
let isListening = false;
let oscillator;
let gainNode;

// DOM elements
const startBtn = document.getElementById('startBtn');
const statusText = document.getElementById('status');

// Event listener
startBtn.addEventListener('click', startListening);

async function startListening() {
  if (isListening) return;

  try {
    // Request microphone access
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Setup Web Audio API
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create a bandpass filter to focus on human voice frequencies (~85Hz to 255Hz)
    const bandpassFilter = audioContext.createBiquadFilter();
    bandpassFilter.type = 'bandpass';
    bandpassFilter.frequency.setValueAtTime(170, audioContext.currentTime); // Center frequency
    bandpassFilter.Q.setValueAtTime(1, audioContext.currentTime); // Quality factor

    analyser = audioContext.createAnalyser();
    microphone = audioContext.createMediaStreamSource(stream);

    microphone.connect(bandpassFilter);
    bandpassFilter.connect(analyser);

    analyser.fftSize = 256;

    // Create processing node
    javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);
    analyser.connect(javascriptNode);
    javascriptNode.connect(audioContext.destination);

    // Setup oscillator for continuous high-pitched sound
    oscillator = audioContext.createOscillator();
    gainNode = audioContext.createGain();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(1200, audioContext.currentTime); // High pitch
    gainNode.gain.setValueAtTime(0, audioContext.currentTime); // Start muted

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();

    // Process audio data
    javascriptNode.onaudioprocess = processAudio;

    isListening = true;
    startBtn.disabled = true;
    statusText.textContent = "Listening...";
  } catch (err) {
    console.error("Error accessing microphone:", err);
    statusText.textContent = "Error accessing microphone!";
  }
}

function processAudio() {
  if (!isListening) return;

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteFrequencyData(dataArray);

  // Calculate average volume in the human voice band
  let sum = 0;
  for (let i = 0; i < bufferLength; i++) {
    sum += dataArray[i];
  }
  const average = sum / bufferLength;

  // Threshold for voice detection
  const threshold = 10;

  if (average > threshold) {
    statusText.textContent = "Voice detected! Screaming back!";
    // Adjust volume proportionally to voice intensity (clamped 0 to 1)
    let volume = Math.min(average / 100, 1);
    gainNode.gain.setTargetAtTime(volume, audioContext.currentTime, 0.05);
  } else {
    statusText.textContent = "Silent... Waiting for voice.";
    // Mute the oscillator gradually
    gainNode.gain.setTargetAtTime(0, audioContext.currentTime, 0.1);
  }
}

// Handle page visibility to prevent audio issues
document.addEventListener('visibilitychange', () => {
  if (document.hidden && isListening) {
    stopListening();
  }
});

function stopListening() {
  if (!isListening) return;

  if (javascriptNode) {
    javascriptNode.disconnect();
    analyser.disconnect();
    microphone.disconnect();
  }

  if (oscillator) {
    oscillator.stop();
    oscillator.disconnect();
  }

  if (gainNode) {
    gainNode.disconnect();
  }

  if (audioContext) {
    audioContext.close();
  }

  isListening = false;
  startBtn.disabled = false;
  statusText.textContent = "Stopped listening";
}