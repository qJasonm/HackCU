import { useEffect, useRef, useState } from 'react';
import './Mirror.css';

function Mirror() {
  const videoRef = useRef(null);
  const recognitionRef = useRef(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [promptText, setPromptText] = useState(
    'What should I wear today based on today\'s weather and everything in my digital closet?'
  );
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [dailyRecommendation, setDailyRecommendation] = useState(null);
  const [dailyWeather, setDailyWeather] = useState('');
  const [isLoadingRecommendation, setIsLoadingRecommendation] = useState(true);

  useEffect(() => {
    let stream = null;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            facingMode: 'user',
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Camera access denied:', err);
        setError('Camera access denied. Please allow camera permissions and reload.');
        setIsLoading(false);
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Set up browser speech recognition for voice prompts
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setPromptText(transcript);
      setAnalysisResult(`Heard: "${transcript}". Tap Analyze to use this prompt.`);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event);
      setError('Speech recognition error: ' + event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognition && recognition.stop) {
        recognition.stop();
      }
    };
  }, []);

  // Fetch an initial AI recommendation based on closet + weather
  useEffect(() => {
    async function fetchRecommendation() {
      try {
        const res = await fetch('http://localhost:3001/api/daily-recommendation');
        if (!res.ok) {
          throw new Error('Failed to fetch recommendation');
        }
        const data = await res.json();
        setDailyRecommendation(data.recommendation || '');
        setDailyWeather(data.weather || '');
      } catch (err) {
        console.error('Error fetching daily recommendation:', err);
        setDailyRecommendation('');
      } finally {
        setIsLoadingRecommendation(false);
      }
    }

    fetchRecommendation();
  }, []);

  // Text-to-Speech helper using ElevenLabs
  const speakText = async (text) => {
    try {
      const res = await fetch('http://localhost:3001/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.play();
      } else {
        console.error('TTS request failed');
      }
    } catch (err) {
      console.error('TTS error:', err);
    }
  };

  const captureAndSendImage = async () => {
    if (!videoRef.current || isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalysisResult(null);

    // Create a canvas to capture the current frame from the video stream
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    // Get the image as a base64 string (excluding the data URI prefix)
    const base64Image = canvas.toDataURL('image/jpeg').split(',')[1];

    try {
      const response = await fetch('http://localhost:3001/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llava', // Make sure you have pulled this model: `ollama run llava`
          prompt: promptText,
          stream: false,
          images: [base64Image], // Array of base64 strings
          includeContext: true
        }),
      });
      
      const data = await response.json();
      console.log('Backend response:', data);
      if (data.error) {
        setAnalysisResult(data.error);
      } else {
        const resultText = data.response || 'Analysis complete';
        setAnalysisResult(resultText);
        // Auto-speak the result
        speakText(resultText);
      }
    } catch (err) {
      console.error('Error calling backend API:', err);
      if (err.message.includes('Failed to fetch')) {
        setAnalysisResult('Connection failed. Ensure the Node backend (localhost:3001) is running!');
      } else {
        setAnalysisResult('Analysis failed');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateOutfit = async () => {
    if (!videoRef.current || isGenerating) return;

    setIsGenerating(true);
    setGeneratedImage(null);

    // Capture frame
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const base64Image = canvas.toDataURL('image/jpeg').split(',')[1];

    try {
      const response = await fetch('http://localhost:3001/api/generate-outfit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          images: [base64Image]
        }),
      });
      
      const data = await response.json();
      console.log('Replicate response:', data);
      if (data.imageUrl) {
        setGeneratedImage(data.imageUrl);
      } else {
        setAnalysisResult(data.error || 'Generation failed without URL');
      }
    } catch (err) {
      console.error('Error calling generate API:', err);
      setAnalysisResult('Outfit Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMicClick = () => {
    if (!recognitionRef.current) {
      setError('Voice input is not supported in this browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      setAnalysisResult(null);
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
        setError('Could not start voice input.');
        setIsListening(false);
      }
    }
  };

  // Optional: Auto-capture every X seconds (commented out by default to prevent spamming)
  /*
  useEffect(() => {
    if (isLoading) return;
    const interval = setInterval(() => {
      captureAndSendImage();
    }, 10000); // 10 seconds
    return () => clearInterval(interval);
  }, [isLoading]);
  */

  return (
    <div className="mirror-app-layout">
      <div className="mirror-main">
        <div className="mirror-container">
          <div className="mirror-frame">
            {isLoading && (
              <div className="mirror-loading">
                <div className="loading-spinner" />
                <p>Starting camera…</p>
              </div>
            )}

            {error && (
              <div className="mirror-error">
                <span className="error-icon">📷</span>
                <p>{error}</p>
              </div>
            )}

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`mirror-video ${isLoading ? 'hidden' : ''}`}
            />

            <div className="mirror-shine" />
          </div>
          <p className="mirror-label">✦ Mirror ✦</p>
        </div>
      </div>

      <div className="mirror-side-panel">
        <h2 className="panel-title">AI Vision Control</h2>

        <div className="input-group">
          <label>Speak your prompt</label>
          <button
            type="button"
            onClick={handleMicClick}
            disabled={isAnalyzing || isGenerating || isLoading}
            className="capture-btn"
            style={{ width: '100%', marginTop: '4px' }}
          >
            {isListening ? (
              <>
                <div className="btn-spinner" />
                Listening...
              </>
            ) : (
              '🎤 Tap to speak'
            )}
          </button>
          {promptText && (
            <p className="idle-text" style={{ marginTop: '8px' }}>
              Last heard: "{promptText}"
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button 
            onClick={captureAndSendImage} 
            disabled={isAnalyzing || isGenerating || isLoading}
            className="capture-btn"
            style={{ flex: 1 }}
          >
            {isAnalyzing ? (
              <>
                <div className="btn-spinner" />
                Processing...
              </>
            ) : 'Analyze'}
          </button>

          <button 
            onClick={generateOutfit} 
            disabled={isAnalyzing || isGenerating || isLoading}
            className="capture-btn"
            style={{ flex: 1, background: 'linear-gradient(135deg, #ff4c8b 0%, #ff8ca0 100%)' }}
          >
            {isGenerating ? (
              <>
                <div className="btn-spinner" />
                Generating...
              </>
            ) : 'Try On Outfit'}
          </button>
        </div>

        <div className="results-container">
          <h3 className="results-title">Analysis Output</h3>
          <div className="results-content">
            {isAnalyzing ? (
              <p className="processing-text">Analyzing image...</p>
            ) : isGenerating ? (
              <p className="processing-text" style={{ color: '#ff8ca0' }}>AI is rendering your new outfit. This takes ~5-15s...</p>
            ) : generatedImage ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                <a href={generatedImage} target="_blank" rel="noopener noreferrer">
                  <img 
                    src={generatedImage} 
                    alt="Generated Try-On" 
                    style={{ width: '100%', borderRadius: '12px', border: '2px solid rgba(255,255,255,0.2)' }} 
                  />
                </a>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#aaa' }}>Click to view full size</p>
              </div>
            ) : analysisResult ? (
              <p className="result-text">{analysisResult}</p>
            ) : isLoadingRecommendation ? (
              <p className="idle-text">Checking your closet and today&apos;s weather...</p>
            ) : dailyRecommendation ? (
              <div>
                <p className="idle-text" style={{ fontWeight: 600, marginBottom: '6px' }}>
                  Today&apos;s outfit suggestion
                  {dailyWeather && (
                    <span
                      style={{
                        display: 'block',
                        fontSize: '0.85rem',
                        color: '#aaa',
                        marginTop: '2px'
                      }}
                    >
                      {dailyWeather}
                    </span>
                  )}
                </p>
                <p className="result-text">{dailyRecommendation}</p>
              </div>
            ) : (
              <p className="idle-text">Ready for capture.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Mirror;
