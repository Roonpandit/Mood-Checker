import React, { useRef, useState, useEffect } from 'react';
import * as faceapi from 'face-api.js';
import './App.css';

const MOVIES = {
  Happy: {
    name: 'Welcome',
    link: 'https://www.primevideo.com/detail/0MJFLZHIV04F9V9V21RAY2Z8ZZ/',
    thumbnail:
      'https://m.media-amazon.com/images/S/pv-target-images/af13e1c59556eb143d2b213c9f95567677f409033d4c9619c553367d71bee982._SX1920_FMwebp_.jpg',
  },
  Sad: {
    name: 'Call me Bae',
    link: 'https://www.primevideo.com/detail/0TF2BODX83KZOWTP08NXFE897E/',
    thumbnail:
      'https://m.media-amazon.com/images/S/pv-target-images/0cb7ac74d1d6e8eb2e3d59aa5354359714eb54d84fcfaa616d9de19d64b492ca._SX1920_FMwebp_.jpg',
  },
  Excited: {
    name: 'Citadel Honey Bunny',
    link: 'https://www.primevideo.com/detail/0KYRVT4JDB957NXZO72E2MIFW5',
    thumbnail:
      'https://m.media-amazon.com/images/S/pv-target-images/51c2c75da778c109ccc33ff293ff48f0cccc60b18c3fef8a42afe2a80e07acac._SX1920_FMwebp_.jpg',
  },
  Neutral: {
    name: 'Farzi',
    link: 'https://www.primevideo.com/detail/0HDHQAUF5LPWOJRCO025LFJSJI',
    thumbnail:
      'https://m.media-amazon.com/images/S/pv-target-images/8aed532f0875925f72c4012aab688ed409773ecbfb3b18e1a39cd9ad1a4dd485._SX1920_FMwebp_.jpg',
  },
  Angry: {
    name: 'Agneepath',
    link: 'https://www.primevideo.com/detail/0NU7IFXPL2WWSDHNGAR5Z1GUJE/',
    thumbnail:
      'https://images-eu.ssl-images-amazon.com/images/S/pv-target-images/1863426056ae862def9a69ca76e8af54cdb6b8a5a2be1100e096e59b00060847._UX1920_.png',
  },
};

const MOODS = ['Happy', 'Excited', 'Neutral', 'Angry', 'Sad'];

// Map face-api.js expressions to our moods
const mapExpressionToMood = (expressions) => {
  if (!expressions) return 'Neutral';
  const sorted = Object.entries(expressions).sort((a, b) => b[1] - a[1]);
  const top = sorted[0][0];
  switch (top) {
    case 'happy':
      return 'Happy';
    case 'surprised':
      return 'Excited';
    case 'angry':
      return 'Angry';
    case 'sad':
      return 'Sad';
    case 'neutral':
      return 'Neutral';
    case 'fearful':
      return 'Sad';
    case 'disgusted':
      return 'Angry';
    default:
      return 'Neutral';
  }
};

function App() {
  const [step, setStep] = useState('welcome');
  const [mood, setMood] = useState(null);
  const [selectedMood, setSelectedMood] = useState('');
  const [videoAllowed, setVideoAllowed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelError, setModelError] = useState('');
  const [debugLog, setDebugLog] = useState([]);
  const videoRef = useRef();
  const canvasRef = useRef();
  const [scanBarPos, setScanBarPos] = useState(0);
  const scanBarInterval = useRef(null);
  const [stream, setStream] = useState(null);

  const log = (msg) => {
    setDebugLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    console.log(msg);
  };

  // Load face-api.js models on mount
  useEffect(() => {
    const loadModels = async () => {
      setLoading(true);
      setModelError('');
      log('Loading face-api.js models...');
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceExpressionNet.loadFromUri('/models');
        setModelsLoaded(true);
        log('Models loaded successfully.');
      } catch (e) {
        setModelError('Failed to load face detection models.\nMake sure you have the required files in public/models.');
        log('Model loading error: ' + e);
      }
      setLoading(false);
    };
    loadModels();
  }, []);

  // Start camera
  const startCamera = async () => {
    setError('');
    log('Requesting camera access...');
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      log('Camera stream received.');
      setStream(mediaStream);
      setVideoAllowed(true);
    } catch (e) {
      setError('Camera access denied.');
      setVideoAllowed(false);
      log('Camera access denied: ' + e);
    }
  };

  // Attach stream to video element when both are ready
  useEffect(() => {
    if (videoAllowed && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      log('Video element srcObject set in useEffect.');
    }
  }, [videoAllowed, stream]);

  // Stop camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      log('Camera stopped and srcObject cleared.');
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      log('Stream tracks stopped and stream cleared.');
    }
    setVideoAllowed(false);
  };

  // Detect mood using face-api.js
  const detectMood = async (imageElement) => {
    if (!modelsLoaded) return 'Neutral';
    try {
      const detection = await faceapi
        .detectSingleFace(imageElement, new faceapi.TinyFaceDetectorOptions())
        .withFaceExpressions();
      if (!detection || !detection.expressions) return 'Neutral';
      return mapExpressionToMood(detection.expressions);
    } catch {
      return 'Neutral';
    }
  };

  // Handle "Check My Mood"
  const handleCheckMood = async () => {
    setStep('scanning');
    setLoading(true);
    setScanBarPos(0);
    log('Starting face scan...');
    scanBarInterval.current = setInterval(() => {
      setScanBarPos((pos) => (pos < 85 ? pos + 5 : 0));
    }, 60);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, 220, 220);
      log('Captured image from video to canvas.');
      try {
        const detectedMood = await detectMood(canvas);
        setMood(MOVIES[detectedMood] ? detectedMood : 'Neutral');
        log('Detected mood: ' + detectedMood);
      } catch (e) {
        setMood('Neutral');
        log('Face detection error: ' + e);
      }
    } else {
      setMood('Neutral');
      log('Video or canvas not available for face scan.');
    }
    clearInterval(scanBarInterval.current);
    setLoading(false);
    setStep('result');
    stopCamera();
  };

  // Handle manual mood selection
  const handleManualMood = () => {
    setMood(selectedMood);
    setStep('result');
  };

  // Reset to start
  const handleScanAgain = () => {
    setMood(null);
    setSelectedMood('');
    setStep('welcome');
    setError('');
    setScanBarPos(0);
    setLoading(false);
    stopCamera();
  };

  // UI Components
  return (
    <div className="ad-container">
      {/* Prime Video Logo */}
      <img
        src="https://upload.wikimedia.org/wikipedia/commons/1/11/Amazon_Prime_Video_logo.svg"
        alt="Prime Video"
        className="prime-logo"
      />
      {/* Loading models or error */}
      {!modelsLoaded && (
        <div className="ad-title">
          {modelError ? (
            <>
              <div style={{ color: '#ff4d4f', marginBottom: 8 }}>{modelError}</div>
              <div style={{ fontSize: '0.95em', color: '#fff' }}>
                Download the required model files from <a href="https://justadudewhohacks.github.io/face-api.js/models/" target="_blank" rel="noopener noreferrer" style={{ color: '#0f79af' }}>here</a> and place them in <b>public/models</b>.<br />
                Then restart your dev server and reload this page.
              </div>
              <button className="main-btn" style={{ marginTop: 16 }} onClick={() => window.location.reload()}>Retry</button>
            </>
          ) : (
            'Loading face detection models...'
          )}
        </div>
      )}
      {/* Welcome / Camera Screen */}
      {modelsLoaded && step === 'welcome' && (
        <>
          <div className="face-frame">
            {videoAllowed ? (
              <video
                ref={videoRef}
                width={220}
                height={220}
                autoPlay
                playsInline
                muted
                className="video-feed"
                onLoadedData={() => setError('')}
                onError={() => setError('Camera stream failed to display. Try refreshing or check your camera.')}
              />
            ) : (
              <img
                src="https://randomuser.me/api/portraits/women/44.jpg"
                alt="face placeholder"
                className="face-placeholder"
              />
            )}
            <canvas ref={canvasRef} width={220} height={220} style={{ display: 'none' }} />
          </div>
          <div className="ad-title">Smile, frown, or just stare,<br />We will read your face!</div>
          {error && <div className="error-msg">{error}</div>}
          <button
            className="main-btn"
            onClick={() => {
              if (!videoAllowed) startCamera();
              else handleCheckMood();
            }}
          >
            {videoAllowed ? 'CHECK MY MOOD' : 'ALLOW CAMERA'}
          </button>
          <div
            className="choose-mood-link"
            onClick={() => {
              stopCamera();
              setStep('manual');
            }}
          >
            No Pic? No problem! choose your mood
          </div>
        </>
      )}
      {/* Scanning Animation */}
      {modelsLoaded && step === 'scanning' && (
        <div className="face-frame scanning">
          <img
            src="https://randomuser.me/api/portraits/women/44.jpg"
            alt="face placeholder"
            className="face-placeholder"
          />
          <div
            className="scan-bar"
            style={{ top: `${scanBarPos}%` }}
          ></div>
          <div className="scanning-text">Scanning your face...</div>
        </div>
      )}
      {/* Manual Mood Selection */}
      {modelsLoaded && step === 'manual' && (
        <div className="manual-mood">
          <div className="ad-title">How would you describe your mood?</div>
          <div className="mood-list">
            {MOODS.map((m) => (
              <button
                key={m}
                className={`mood-btn${selectedMood === m ? ' selected' : ''}`}
                onClick={() => setSelectedMood(m)}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            className="main-btn"
            disabled={!selectedMood}
            onClick={handleManualMood}
          >
            THIS IS MY MOOD
          </button>
          <div className="choose-mood-link" onClick={handleScanAgain}>
            Back to face scan
          </div>
        </div>
      )}
      {/* Result / Movie Recommendation */}
      {modelsLoaded && step === 'result' && mood && (
        <div className="result-screen">
          <div className="ad-title">
            Hey! You're in a <span className={`mood-text ${mood}`}>{mood}</span> mood<br />and we got stories to match!
          </div>
          <div className="movie-card">
            <img
              src={MOVIES[mood].thumbnail}
              alt={MOVIES[mood].name}
              className="movie-thumb"
            />
            <div className="movie-title">{MOVIES[mood].name}</div>
            <a
              href={MOVIES[mood].link}
              target="_blank"
              rel="noopener noreferrer"
              className="main-btn movie-btn"
            >
              Watch Now
            </a>
          </div>
          <button className="main-btn scan-again" onClick={handleScanAgain}>
            SCAN AGAIN
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
