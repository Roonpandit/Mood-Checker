import React, { useRef, useState, useEffect } from 'react';

function App() {
  const [step, setStep] = useState('welcome');
  const [videoAllowed, setVideoAllowed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detectionResult, setDetectionResult] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [faceDetectionReady, setFaceDetectionReady] = useState(false);
  const videoRef = useRef();
  const canvasRef = useRef();
  const [stream, setStream] = useState(null);

  // Check if browser supports face detection
  useEffect(() => {
    const checkFaceDetection = async () => {
      setLoading(true);
      
      // Check if FaceDetector API is available (Chrome/Edge only)
      if ('FaceDetector' in window) {
        try {
          const faceDetector = new window.FaceDetector();
          setFaceDetectionReady(true);
          console.log('Using native FaceDetector API');
        } catch (e) {
          console.log('FaceDetector not supported, using fallback');
          setFaceDetectionReady(true); // Use fallback method
        }
      } else {
        console.log('FaceDetector not available, using fallback');
        setFaceDetectionReady(true); // Use fallback method
      }
      
      setLoading(false);
    };
    
    checkFaceDetection();
  }, []);

  // Face detection using browser API or fallback
  const detectFaces = async (imageElement) => {
    if ('FaceDetector' in window) {
      try {
        const faceDetector = new window.FaceDetector({
          maxDetectedFaces: 10,
          fastMode: false
        });
        
        const faces = await faceDetector.detect(imageElement);
        return faces;
      } catch (e) {
        console.log('FaceDetector failed, using fallback:', e);
        return await fallbackFaceDetection(imageElement);
      }
    } else {
      return await fallbackFaceDetection(imageElement);
    }
  };

  // Fallback face detection using image analysis
  const fallbackFaceDetection = async (canvas) => {
    return new Promise((resolve) => {
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Simple face detection based on skin tone detection and face-like patterns
      let skinPixels = 0;
      let totalPixels = data.length / 4;
      let faceRegions = [];
      
      // Analyze image in 50x50 pixel blocks to find potential face regions
      const blockSize = 50;
      const minSkinRatio = 0.3; // Minimum ratio of skin-colored pixels for a potential face
      
      for (let y = 0; y < canvas.height - blockSize; y += blockSize) {
        for (let x = 0; x < canvas.width - blockSize; x += blockSize) {
          let blockSkinPixels = 0;
          let blockTotalPixels = 0;
          
          // Check each pixel in this block
          for (let by = y; by < Math.min(y + blockSize, canvas.height); by++) {
            for (let bx = x; bx < Math.min(x + blockSize, canvas.width); bx++) {
              const i = (by * canvas.width + bx) * 4;
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              
              // Simple skin tone detection
              if (isSkinTone(r, g, b)) {
                blockSkinPixels++;
                skinPixels++;
              }
              blockTotalPixels++;
            }
          }
          
          // If this block has enough skin-colored pixels, it might be a face
          const skinRatio = blockSkinPixels / blockTotalPixels;
          if (skinRatio > minSkinRatio && blockSkinPixels > 100) {
            faceRegions.push({
              x: x,
              y: y,
              width: blockSize,
              height: blockSize,
              confidence: skinRatio
            });
          }
        }
      }
      
      // Merge overlapping regions and filter out small regions
      const mergedRegions = mergeOverlappingRegions(faceRegions);
      
      // Filter based on size and confidence
      const validFaces = mergedRegions.filter(region => 
        region.confidence > 0.4 && 
        (region.width * region.height) > 1000
      );
      
      setTimeout(() => resolve(validFaces), 500); // Simulate processing time
    });
  };

  // Check if RGB values represent skin tone
  const isSkinTone = (r, g, b) => {
    // Extended skin tone detection for various ethnicities
    const skinConditions = [
      // Light skin tones
      (r > 95 && g > 40 && b > 20 && 
       Math.max(r, g, b) - Math.min(r, g, b) > 15 && 
       Math.abs(r - g) > 15 && r > g && r > b),
      
      // Medium skin tones  
      (r > 80 && r < 220 && g > 50 && g < 180 && b > 30 && b < 150 &&
       r > g && g > b && r - g > 10),
       
      // Darker skin tones
      (r > 45 && r < 120 && g > 30 && g < 100 && b > 20 && b < 80 &&
       r > g && g >= b && (r - g) > 5),
       
      // Asian skin tones
      (r > 100 && r < 200 && g > 80 && g < 170 && b > 60 && b < 140 &&
       Math.abs(r - g) < 30 && r > b && g > b)
    ];
    
    return skinConditions.some(condition => condition);
  };

  // Merge overlapping face regions
  const mergeOverlappingRegions = (regions) => {
    if (regions.length <= 1) return regions;
    
    const merged = [];
    const used = new Array(regions.length).fill(false);
    
    for (let i = 0; i < regions.length; i++) {
      if (used[i]) continue;
      
      let currentRegion = { ...regions[i] };
      used[i] = true;
      
      // Check for overlapping regions
      for (let j = i + 1; j < regions.length; j++) {
        if (used[j]) continue;
        
        if (regionsOverlap(currentRegion, regions[j])) {
          // Merge regions
          const newX = Math.min(currentRegion.x, regions[j].x);
          const newY = Math.min(currentRegion.y, regions[j].y);
          const newWidth = Math.max(currentRegion.x + currentRegion.width, regions[j].x + regions[j].width) - newX;
          const newHeight = Math.max(currentRegion.y + currentRegion.height, regions[j].y + regions[j].height) - newY;
          
          currentRegion = {
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight,
            confidence: Math.max(currentRegion.confidence, regions[j].confidence)
          };
          used[j] = true;
        }
      }
      
      merged.push(currentRegion);
    }
    
    return merged;
  };

  // Check if two regions overlap
  const regionsOverlap = (region1, region2) => {
    return !(region1.x + region1.width < region2.x ||
             region2.x + region2.width < region1.x ||
             region1.y + region1.height < region2.y ||
             region2.y + region2.height < region1.y);
  };

  // Start camera
  const startCamera = async () => {
    setError('');
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });
      setStream(mediaStream);
      setVideoAllowed(true);
    } catch (e) {
      setError('Camera access denied. Please allow camera access and try again.');
      setVideoAllowed(false);
    }
  };

  // Attach stream to video element when both are ready
  useEffect(() => {
    if (videoAllowed && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [videoAllowed, stream]);

  // Stop camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setVideoAllowed(false);
  };

  // Capture picture and detect faces
  const handleCapturePicture = async () => {
    setLoading(true);
    setDetectionResult(null);
    setError('');
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video && canvas) {
      // Set canvas size to match video
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert canvas to image URL for display
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedImage(imageDataUrl);
      
      try {
        // Detect faces
        const detections = await detectFaces(canvas);
        const faceCount = detections.length;
        
        let result;
        if (faceCount === 0) {
          result = { type: 'no_face', count: 0 };
        } else if (faceCount === 1) {
          result = { type: 'single_face', count: 1 };
        } else {
          result = { type: 'multiple_faces', count: faceCount };
        }
        
        setDetectionResult(result);
        
      } catch (e) {
        console.error('Face detection failed:', e);
        setError('Face detection failed. Please ensure good lighting and try again.');
        setDetectionResult({ type: 'error', count: 0 });
      }
    } else {
      setError('Camera not available. Please try again.');
    }
    
    setLoading(false);
    setStep('result');
    stopCamera();
  };

  // Reset to start
  const handleTryAgain = () => {
    setDetectionResult(null);
    setCapturedImage(null);
    setStep('welcome');
    setError('');
    setLoading(false);
    stopCamera();
  };

  // Get result message based on detection
  const getResultMessage = () => {
    if (!detectionResult) return '';
    
    switch (detectionResult.type) {
      case 'no_face':
        return 'No face detected in the image. Please try again with your face clearly visible in good lighting.';
      case 'single_face':
        return 'Face detected successfully! ✅';
      case 'multiple_faces':
        return `Multiple faces detected (${detectionResult.count} faces). Please ensure only one person is in the frame.`;
      case 'error':
        return 'Face detection failed. Please try again.';
      default:
        return 'Unknown detection result.';
    }
  };

  const getResultColor = () => {
    if (!detectionResult) return '#fff';
    
    switch (detectionResult.type) {
      case 'no_face':
        return '#ff4d4f';
      case 'single_face':
        return '#52c41a';
      case 'multiple_faces':
        return '#faad14';
      case 'error':
        return '#ff4d4f';
      default:
        return '#fff';
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0f1419',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif',
      padding: '20px'
    }}>
      
      {/* Loading */}
      {!faceDetectionReady && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '20px' }}>
            Initializing face detection...
          </div>
          <div style={{ marginTop: '10px', fontSize: '14px', color: '#888' }}>
            Setting up detection algorithms
          </div>
        </div>
      )}

      {/* Camera Screen */}
      {faceDetectionReady && step === 'welcome' && (
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <h1 style={{ marginBottom: '30px', fontSize: '24px' }}>
            Face Detection Test
          </h1>
          
          <div style={{
            width: '300px',
            height: '300px',
            border: '3px solid #0f79af',
            borderRadius: '10px',
            overflow: 'hidden',
            margin: '0 auto 20px',
            backgroundColor: '#1a1a1a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {videoAllowed ? (
              <video
                ref={videoRef}
                width={300}
                height={300}
                autoPlay
                playsInline
                muted
                style={{ objectFit: 'cover' }}
                onError={() => setError('Camera stream failed. Please refresh and try again.')}
              />
            ) : (
              <div style={{ color: '#666', textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>📷</div>
                <div>Camera not active</div>
              </div>
            )}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>

          {error && (
            <div style={{ color: '#ff4d4f', marginBottom: '16px', fontSize: '14px' }}>
              {error}
            </div>
          )}

          <button
            onClick={videoAllowed ? handleCapturePicture : startCamera}
            disabled={loading}
            style={{
              backgroundColor: loading ? '#666' : '#0f79af',
              color: 'white',
              border: 'none',
              padding: '15px 30px',
              borderRadius: '6px',
              fontSize: '16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '16px',
              width: '200px'
            }}
          >
            {loading ? 'Detecting...' : (videoAllowed ? 'CAPTURE PICTURE' : 'START CAMERA')}
          </button>

          <div style={{ fontSize: '14px', color: '#888' }}>
            {videoAllowed ? 'Position your face in the frame and click capture' : 'Click to start your camera'}
          </div>
          
          <div style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
            {'FaceDetector' in window ? 'Using browser face detection API' : 'Using custom face detection'}
          </div>
        </div>
      )}

      {/* Result Screen */}
      {faceDetectionReady && step === 'result' && (
        <div style={{ textAlign: 'center', maxWidth: '500px' }}>
          <h1 style={{ marginBottom: '30px', fontSize: '24px' }}>
            Detection Result
          </h1>

          {capturedImage && (
            <div style={{
              width: '300px',
              height: '300px',
              border: '3px solid #0f79af',
              borderRadius: '10px',
              overflow: 'hidden',
              margin: '0 auto 20px',
              backgroundColor: '#1a1a1a'
            }}>
              <img 
                src={capturedImage} 
                alt="Captured" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          )}

          <div style={{
            fontSize: '18px',
            marginBottom: '30px',
            padding: '20px',
            borderRadius: '10px',
            backgroundColor: '#1a1a1a',
            border: `2px solid ${getResultColor()}`,
            color: getResultColor()
          }}>
            {getResultMessage()}
          </div>

          {detectionResult && detectionResult.type === 'single_face' && (
            <div style={{
              fontSize: '48px',
              marginBottom: '20px'
            }}>
              🎉
            </div>
          )}

          <button
            onClick={handleTryAgain}
            style={{
              backgroundColor: '#0f79af',
              color: 'white',
              border: 'none',
              padding: '15px 30px',
              borderRadius: '6px',
              fontSize: '16px',
              cursor: 'pointer',
              width: '200px'
            }}
          >
            TRY AGAIN
          </button>
        </div>
      )}
    </div>
  );
}

export default App;