import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, X, Scan, CheckCircle, AlertCircle, QrCode, RotateCcw, Zap, Target, Square, Play, Pause } from 'lucide-react';
import Tesseract from 'tesseract.js';
import jsQR from 'jsqr';

interface Quiz {
  id: string;
  title: string;
  subject: string;
  level: string;
  section: string;
  totalQuestions: number;
  maxScore: number;
  correctAnswers: string[];
  questionPoints: number[];
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  level: string;
  section: string;
}

interface QuizResult {
  id: string;
  quizId: string;
  studentId: string;
  nationalId: string;
  studentName: string;
  score: number;
  percentage: number;
  answers: string[];
  correctAnswers: number;
  wrongAnswers: number;
  scannedAt: string;
  verified: boolean;
}

interface QuizScannerProps {
  quizzes: Quiz[];
  students: Student[];
  onResultAdded: (result: Omit<QuizResult, 'id' | 'scannedAt'>) => void;
}

interface FrameQuality {
  hasBlackCorners: boolean;
  cornerCount: number;
  overallQuality: 'excellent' | 'good' | 'poor';
  confidence: number;
}

const QuizScanner: React.FC<QuizScannerProps> = ({ quizzes, students, onResultAdded }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<string>('');
  const [frameQuality, setFrameQuality] = useState<FrameQuality>({
    hasBlackCorners: false,
    cornerCount: 0,
    overallQuality: 'poor',
    confidence: 0
  });
  const [scanMode, setScanMode] = useState<'barcode' | 'national_id'>('barcode');
  const [captureCount, setCaptureCount] = useState(0);
  const [processingCount, setProcessingCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [recentResults, setRecentResults] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [autoAdjustSettings, setAutoAdjustSettings] = useState(true);
  const [imageStabilization, setImageStabilization] = useState(true);
  const lastFramesRef = useRef<ImageData[]>([]);

  // تحميل إعدادات المسح المتقدمة
  const loadScanSettings = useCallback(() => {
    try {
      const saved = localStorage.getItem('advancedScanSettings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('خطأ في تحميل إعدادات المسح:', error);
    }
    return null;
  }, []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionRef = useRef<NodeJS.Timeout | null>(null);
  const lastProcessedTime = useRef<number>(0);

  // تنظيف الموارد
  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (detectionRef.current) {
      clearInterval(detectionRef.current);
      detectionRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // كشف المربعات السوداء في الزوايا - محسن
  const detectFrameQuality = useCallback((imageData: ImageData, width: number, height: number) => {
    const data = imageData.data;
    let cornersDetected = 0;
    let totalConfidence = 0;
    
    // مناطق البحث في الزوايا (8% من كل زاوية)
    const cornerSize = Math.min(width, height) * 0.08;
    const cornerRegions = [
      { startX: 0, startY: 0, endX: cornerSize, endY: cornerSize, name: 'top-right' },
      { startX: width - cornerSize, startY: 0, endX: width, endY: cornerSize, name: 'top-left' },
      { startX: 0, startY: height - cornerSize, endX: cornerSize, endY: height, name: 'bottom-right' },
      { startX: width - cornerSize, startY: height - cornerSize, endX: width, endY: height, name: 'bottom-left' }
    ];

    cornerRegions.forEach(region => {
      let maxDarkness = 0;
      const searchStep = 3;
      
      for (let y = region.startY; y < region.endY - 12; y += searchStep) {
        for (let x = region.startX; x < region.endX - 12; x += searchStep) {
          let darkPixels = 0;
          let totalPixels = 0;
          
          // فحص مربع 12x12 بكسل
          for (let dy = 0; dy < 12; dy += 2) {
            for (let dx = 0; dx < 12; dx += 2) {
              const pixelX = x + dx;
              const pixelY = y + dy;
              
              if (pixelX < width && pixelY < height) {
                const pixelIndex = (pixelY * width + pixelX) * 4;
                const r = data[pixelIndex];
                const g = data[pixelIndex + 1];
                const b = data[pixelIndex + 2];
                const brightness = (r + g + b) / 3;
                
                totalPixels++;
                if (brightness < 80) darkPixels++;
              }
            }
          }
          
          const darkness = totalPixels > 0 ? darkPixels / totalPixels : 0;
          if (darkness > maxDarkness) {
            maxDarkness = darkness;
          }
        }
      }
      
      if (maxDarkness > 0.4) {
        cornersDetected++;
        totalConfidence += maxDarkness;
      }
    });
    
    const averageConfidence = cornersDetected > 0 ? totalConfidence / cornersDetected : 0;
    
    return {
      hasBlackCorners: cornersDetected >= 2,
      cornerCount: cornersDetected,
      overallQuality: cornersDetected >= 3 ? 'excellent' : 
                     cornersDetected >= 2 ? 'good' : 'poor',
      confidence: averageConfidence
    };
  }, []);

  // كشف تلقائي للإطار
  const startFrameDetection = useCallback(() => {
    if (detectionRef.current) clearInterval(detectionRef.current);
    
    detectionRef.current = setInterval(() => {
      if (!videoRef.current || !canvasRef.current || isProcessing) return;
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (!ctx || video.videoWidth === 0) return;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const quality = detectFrameQuality(imageData, canvas.width, canvas.height);
      
      setFrameQuality(quality);
      
    }, 150);
  }, [detectFrameQuality, isProcessing]);

  // بدء الكاميرا
  const startCamera = useCallback(async () => {
    try {
      cleanup();
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          focusMode: ['continuous', 'auto'],
          whiteBalanceMode: 'continuous',
          exposureMode: 'continuous',
          frameRate: { ideal: 30 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play();
              resolve();
            };
          }
        });

        startFrameDetection();
      }
    } catch (error) {
      console.error('خطأ في الكاميرا:', error);
      alert('لا يمكن الوصول للكاميرا. تأكد من السماح بالوصول للكاميرا.');
    }
  }, [cleanup, startFrameDetection]);

  // تحسين جودة الصورة بشكل ديناميكي
  const enhanceImageQuality = useCallback((imageData: ImageData): ImageData => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return imageData;

    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);

    // تطبيق مجموعة من الفلاتر الذكية
    const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageDataObj.data;

    // 1. Adaptive Contrast Enhancement
    let minBrightness = 255, maxBrightness = 0;
    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      minBrightness = Math.min(minBrightness, brightness);
      maxBrightness = Math.max(maxBrightness, brightness);
    }

    const range = maxBrightness - minBrightness;
    if (range > 0) {
      for (let i = 0; i < data.length; i += 4) {
        for (let j = 0; j < 3; j++) {
          data[i + j] = ((data[i + j] - minBrightness) / range) * 255;
        }
      }
    }

    // 2. Noise Reduction
    const tempData = new Uint8ClampedArray(data);
    const radius = 1;
    for (let y = radius; y < imageDataObj.height - radius; y++) {
      for (let x = radius; x < imageDataObj.width - radius; x++) {
        for (let c = 0; c < 3; c++) {
          let sum = 0, count = 0;
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              const idx = ((y + dy) * imageDataObj.width + (x + dx)) * 4 + c;
              sum += tempData[idx];
              count++;
            }
          }
          const idx = (y * imageDataObj.width + x) * 4 + c;
          data[idx] = sum / count;
        }
      }
    }

    // 3. Sharpening
    const kernel = [-1, -1, -1, -1, 9, -1, -1, -1, -1];
    const tempData2 = new Uint8ClampedArray(data);
    for (let y = 1; y < imageDataObj.height - 1; y++) {
      for (let x = 1; x < imageDataObj.width - 1; x++) {
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const idx = ((y + ky) * imageDataObj.width + (x + kx)) * 4 + c;
              sum += tempData2[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
            }
          }
          const idx = (y * imageDataObj.width + x) * 4 + c;
          data[idx] = Math.max(0, Math.min(255, sum));
        }
      }
    }

    ctx.putImageData(imageDataObj, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }, []);

  // تثبيت الصورة باستخدام عدة إطارات
  const stabilizeFrame = useCallback((imageData: ImageData): ImageData => {
    if (!imageStabilization) return imageData;

    lastFramesRef.current.push(imageData);
    if (lastFramesRef.current.length > 3) {
      lastFramesRef.current.shift();
    }

    if (lastFramesRef.current.length < 2) return imageData;

    // دمج الإطارات المتعددة لتحسين الجودة
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return imageData;

    canvas.width = imageData.width;
    canvas.height = imageData.height;

    const mergedData = new Uint8ClampedArray(imageData.data.length);
    const frameCount = lastFramesRef.current.length;

    for (let i = 0; i < mergedData.length; i++) {
      let sum = 0;
      for (const frame of lastFramesRef.current) {
        sum += frame.data[i];
      }
      mergedData[i] = sum / frameCount;
    }

    const stabilizedImageData = new ImageData(mergedData, imageData.width, imageData.height);
    return stabilizedImageData;
  }, [imageStabilization]);

  // قراءة الباركود المحسنة والمضمونة
  const readBarcodeAdvanced = useCallback(async (imageData: ImageData): Promise<{ id: string; nationalId: string; name: string } | null> => {
    try {
      console.log('🔍 بدء قراءة الباركود المحسنة...');

      // استخدام التحسينات التلقائية أولاً
      let processedImage = imageData;
      if (autoAdjustSettings) {
        processedImage = enhanceImageQuality(imageData);
      }

      // المحاولة 1: قراءة مباشرة من الصورة المحسنة
      let qrResult = jsQR(processedImage.data, processedImage.width, processedImage.height, {
        inversionAttempts: 'attemptBoth' // محاولة الصورة العادية والمعكوسة
      });

      if (qrResult?.data) {
        console.log('✅ باركود مقروء مباشرة:', qrResult.data);
        return parseQRCodeData(qrResult.data);
      }

      // المحاولة 2: تطبيق فلاتر متعددة وتجربة كل واحدة
      console.log('🔄 تطبيق فلاتر متعددة...');
      const filters = [
        'contrast(200%) brightness(120%)',
        'contrast(300%) brightness(100%)',
        'grayscale(100%) contrast(200%)',
        'contrast(250%) brightness(150%) grayscale(100%)',
        'saturate(0%) contrast(180%) brightness(110%)'
      ];

      for (const filter of filters) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        canvas.width = processedImage.width;
        canvas.height = processedImage.height;
        ctx.putImageData(processedImage, 0, 0);
        ctx.filter = filter;
        ctx.drawImage(canvas, 0, 0);

        const filteredData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        qrResult = jsQR(filteredData.data, filteredData.width, filteredData.height, {
          inversionAttempts: 'attemptBoth'
        });

        if (qrResult?.data) {
          console.log(`✅ باركود مقروء بفلتر: ${filter}`, qrResult.data);
          return parseQRCodeData(qrResult.data);
        }
      }

      // المحاولة 3: البحث في مناطق مختلفة من الصورة
      console.log('🎯 البحث في مناطق متعددة...');
      const regions = [
        { x: 0.62, y: 0.08, w: 0.35, h: 0.35 }, // المنطقة الزرقاء الأصلية
        { x: 0.60, y: 0.05, w: 0.38, h: 0.38 }, // منطقة أوسع قليلاً
        { x: 0.58, y: 0.10, w: 0.40, h: 0.32 }, // منطقة مختلفة
        { x: 0.0, y: 0.0, w: 0.5, h: 0.3 },     // الربع العلوي الأيمن
        { x: 0.5, y: 0.0, w: 0.5, h: 0.3 }      // الربع العلوي الأيسر
      ];

      for (const region of regions) {
        const regionWidth = Math.floor(processedImage.width * region.w);
        const regionHeight = Math.floor(processedImage.height * region.h);
        const startX = Math.floor(processedImage.width * region.x);
        const startY = Math.floor(processedImage.height * region.y);

        if (startX + regionWidth > processedImage.width || startY + regionHeight > processedImage.height) {
          continue;
        }

        const regionCanvas = document.createElement('canvas');
        const regionCtx = regionCanvas.getContext('2d');
        if (!regionCtx) continue;

        regionCanvas.width = regionWidth;
        regionCanvas.height = regionHeight;

        // استخراج المنطقة
        const regionData = new Uint8ClampedArray(regionWidth * regionHeight * 4);
        for (let y = 0; y < regionHeight; y++) {
          for (let x = 0; x < regionWidth; x++) {
            const srcIndex = ((startY + y) * processedImage.width + (startX + x)) * 4;
            const destIndex = (y * regionWidth + x) * 4;

            if (srcIndex < processedImage.data.length - 3) {
              regionData[destIndex] = processedImage.data[srcIndex];
              regionData[destIndex + 1] = processedImage.data[srcIndex + 1];
              regionData[destIndex + 2] = processedImage.data[srcIndex + 2];
              regionData[destIndex + 3] = processedImage.data[srcIndex + 3];
            }
          }
        }

        const regionImageData = new ImageData(regionData, regionWidth, regionHeight);

        // تجربة عدة فلاتر على المنطقة
        for (const filter of filters) {
          regionCtx.clearRect(0, 0, regionWidth, regionHeight);
          regionCtx.putImageData(regionImageData, 0, 0);
          regionCtx.filter = filter;
          regionCtx.drawImage(regionCanvas, 0, 0);

          const finalRegionData = regionCtx.getImageData(0, 0, regionWidth, regionHeight);
          qrResult = jsQR(finalRegionData.data, finalRegionData.width, finalRegionData.height, {
            inversionAttempts: 'attemptBoth'
          });

          if (qrResult?.data) {
            console.log('✅ باركود مقروء من منطقة محددة:', qrResult.data);
            return parseQRCodeData(qrResult.data);
          }
        }
      }

      console.warn('❌ لم يتم العثور على باركود في جميع المحاولات');
      return null;

    } catch (error) {
      console.error('خطأ في قراءة الباركود:', error);
      return null;
    }
  }, [autoAdjustSettings, enhanceImageQuality]);

  // تحليل بيانات QR Code
  const parseQRCodeData = useCallback((qrData: string): { id: string; nationalId: string; name: string } | null => {
    try {
      console.log('📊 تحليل بيانات QR:', qrData);
      
      const parts = qrData.split('|');
      
      if (parts.length >= 1) {
        const nationalId = parts[0].trim();
        console.log('🆔 الرقم الوطني من QR:', nationalId);
        
        // البحث عن التلميذ بطرق متعددة
        let student = students.find(s => s.nationalId === nationalId);
        
        // بحث مرن إضافي
        if (!student) {
          student = students.find(s => 
            s.nationalId.toLowerCase().replace(/\s/g, '') === nationalId.toLowerCase().replace(/\s/g, '') ||
            s.nationalId.includes(nationalId) ||
            nationalId.includes(s.nationalId)
          );
        }
        
        if (student) {
          console.log('✅ تم العثور على التلميذ:', student);
          return {
            id: student.id,
            nationalId: student.nationalId,
            name: `${student.firstName} ${student.lastName}`
          };
        } else {
          console.warn('⚠️ التلميذ غير موجود:', nationalId);
          throw new Error(`التلميذ غير موجود: ${nationalId}`);
        }
      } else {
        throw new Error('تنسيق الباركود غير صحيح');
      }
    } catch (error) {
      console.error('خطأ في تحليل بيانات الباركود:', error);
      throw error;
    }
  }, [students]);

  // استخراج الإجابات بالطريقة التقليدية المحسنة
  const extractAnswersTraditional = useCallback(async (imageData: ImageData, quiz: Quiz, settings: any): Promise<{ answers: string[]; confidence: number; details: string[] }> => {
    console.log('📝 بدء استخراج الإجابات بالنموذج الثابت...');

    // تحسين جودة الصورة قبل المعالجة
    let processedImage = imageData;
    if (autoAdjustSettings) {
      console.log('🔧 تطبيق التحسينات التلقائية...');
      processedImage = stabilizeFrame(imageData);
      processedImage = enhanceImageQuality(processedImage);
    }

    // النموذج الثابت يدعم 20 سؤال فقط
    const totalQuestions = Math.min(quiz.totalQuestions, 20);
    const answers: string[] = Array(totalQuestions).fill('');
    const details: string[] = [];
    const data = processedImage.data;
    const width = processedImage.width;
    const height = processedImage.height;
    let totalConfidence = 0;
    let processedQuestions = 0;

    // حساب مناطق الأسئلة بدقة مطلقة حسب النموذج الثابت المرفق
    const questionsStartY = Math.floor(height * 0.52); // بداية منطقة الأسئلة (محسنة للنموذج الجديد)
    const questionsEndY = Math.floor(height * 0.85);   // نهاية منطقة الأسئلة (محسنة للنموذج الجديد)
    const questionsHeight = questionsEndY - questionsStartY;
    
    const questionsPerRow = 3;
    const totalRows = Math.ceil(totalQuestions / questionsPerRow);
    const questionHeight = questionsHeight / totalRows;
    const questionWidth = width / questionsPerRow;
    
    console.log('📊 معلومات النموذج الثابت:', {
      questionsStartY,
      questionsHeight,
      questionHeight,
      questionWidth,
      totalRows,
      totalQuestions: totalQuestions
    });
    
    // فحص كل سؤال بدقة عالية
    for (let row = 0; row < totalRows; row++) {
      for (let col = 0; col < questionsPerRow; col++) { 
        const questionIndex = row * questionsPerRow + col;
        if (questionIndex >= totalQuestions) break;
        
        // حساب موقع السؤال (من اليمين لليسار) - حسب النموذج الثابت
        const questionX = (2 - col) * questionWidth; // العمود الأيمن = 0، الأوسط = 1، الأيسر = 2
        const questionY = questionsStartY + row * questionHeight;
        
        // موقع الخيارات محسن حسب النموذج الثابت الجديد
        const optionsY = questionY + questionHeight * 0.6; // موقع الدوائر عمودياً (محسن للنموذج الجديد)
        const optionWidth = questionWidth * 0.75 / 4;      // عرض كل خيار (محسن للنموذج الجديد)
        const optionStartX = questionX + questionWidth * 0.125; // بداية الخيارات أفقياً (محسن للنموذج الجديد)
        
        let selectedOption = '';
        let maxDarkness = 0;
        const optionDarkness: { [key: string]: number } = {};
        const markedOptions: string[] = [];
        let questionConfidence = 0;
        
        // فحص كل خيار بدقة عالية محسنة
        ['A', 'B', 'C', 'D'].forEach((option, optionIndex) => {
          const optionCenterX = optionStartX + (optionIndex + 0.5) * optionWidth;
          const circleRadius = Math.min(optionWidth * 0.25, questionHeight * 0.1);

          let darkPixels = 0;
          let totalPixels = 0;
          let edgePixels = 0; // لتحديد حواف الدائرة

          // فحص دائرة الخيار بدقة فائقة مع تحديد الحواف
          for (let dy = -circleRadius; dy <= circleRadius; dy += 0.15) {
            for (let dx = -circleRadius; dx <= circleRadius; dx += 0.15) {
              const distance = Math.sqrt(dx * dx + dy * dy);
              if (distance <= circleRadius) {
                const pixelX = Math.floor(optionCenterX + dx);
                const pixelY = Math.floor(optionsY + dy);

                if (pixelX >= 0 && pixelX < width && pixelY >= 0 && pixelY < height) {
                  const pixelIndex = (pixelY * width + pixelX) * 4;
                  const r = data[pixelIndex];
                  const g = data[pixelIndex + 1];
                  const b = data[pixelIndex + 2];
                  const brightness = (r + g + b) / 3;

                  totalPixels++;

                  // نظام ذكي لتحديد التظليل
                  if (brightness < 80) {
                    darkPixels++;
                  }

                  // تحديد حواف الدائرة للتأكد من وجود تظليل حقيقي
                  if (distance > circleRadius * 0.7 && brightness < 100) {
                    edgePixels++;
                  }
                }
              }
            }
          }

          const darkness = totalPixels > 0 ? darkPixels / totalPixels : 0;
          const edgeDarkness = totalPixels > 0 ? edgePixels / (totalPixels * 0.3) : 0;

          // دمج قياسات متعددة للحصول على دقة أفضل
          const combinedDarkness = (darkness * 0.7) + (edgeDarkness * 0.3);
          optionDarkness[option] = combinedDarkness;

          // حد ديناميكي محسن
          const baseThreshold = (settings?.traditional?.darknessThreshold || 20) / 100;
          const adaptiveThreshold = Math.max(baseThreshold, maxDarkness * 0.6);

          if (combinedDarkness > adaptiveThreshold) {
            markedOptions.push(option);
          }

          if (combinedDarkness > maxDarkness) {
            maxDarkness = combinedDarkness;
            selectedOption = option;
          }
        });
        
        // تحديد الإجابة النهائية
        const darknessSummary = Object.entries(optionDarkness)
          .map(([opt, dark]) => `${opt}:${(dark * 100).toFixed(1)}%`)
          .join(' | ');
        
        details.push(`Q${questionIndex + 1}: ${darknessSummary}`);
        
        if (markedOptions.length === 0) {
          const minFill = (settings?.traditional?.minimumFillPercentage || 15) / 100;
          if (maxDarkness > minFill) {
            answers[questionIndex] = selectedOption;
            questionConfidence = maxDarkness * 60; // ثقة محسنة للنموذج الجديد
            details.push(`⚠️ Q${questionIndex + 1}: إجابة ضعيفة: ${selectedOption}`);
          } else {
            answers[questionIndex] = '';
            questionConfidence = 0;
            details.push(`❓ Q${questionIndex + 1}: لا توجد إجابة`);
          }
        } else if (markedOptions.length > 1) {
          // التعامل مع الإجابات المتعددة حسب الإعدادات
          const handling = settings?.general?.multipleAnswerHandling || 'best';
          
          if (handling === 'best') {
            const bestOption = markedOptions.reduce((best, current) => 
              optionDarkness[current] > optionDarkness[best] ? current : best
            );
            answers[questionIndex] = bestOption;
            questionConfidence = optionDarkness[bestOption] * 75;
            details.push(`🔄 Q${questionIndex + 1}: اختيار الأفضل: ${bestOption}`);
          } else if (handling === 'first') {
            answers[questionIndex] = markedOptions[0];
            questionConfidence = optionDarkness[markedOptions[0]] * 75;
            details.push(`🔄 Q${questionIndex + 1}: اختيار الأول: ${markedOptions[0]}`);
          } else {
            answers[questionIndex] = 'MULTIPLE';
            questionConfidence = 0;
            details.push(`❌ Q${questionIndex + 1}: إجابات متعددة مرفوضة`);
          }
        } else {
          answers[questionIndex] = markedOptions[0];
          questionConfidence = optionDarkness[markedOptions[0]] * 90; // ثقة عالية للنموذج الجديد
          details.push(`✅ Q${questionIndex + 1}: إجابة واضحة: ${markedOptions[0]}`);
        }
        
        totalConfidence += questionConfidence;
        processedQuestions++;
      }
    }
    
    const averageConfidence = processedQuestions > 0 ? totalConfidence / processedQuestions : 0;
    
    return {
      answers,
      confidence: averageConfidence,
      details
    };
  }, []);

  // استخراج الإجابات بطريقة الأحرف المخفية
  const extractAnswersHiddenLetters = useCallback(async (imageData: ImageData, quiz: Quiz, settings: any): Promise<{ answers: string[]; confidence: number; details: string[] }> => {
    console.log('👁️ بدء استخراج الإجابات بطريقة الأحرف المخفية...');
    
    const answers: string[] = Array(quiz.totalQuestions).fill('');
    const details: string[] = [];
    let totalConfidence = 0;
    let processedQuestions = 0;
    
    // نفس حسابات المواقع
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    const questionsStartY = Math.floor(height * 0.52);
    const questionsEndY = Math.floor(height * 0.85);
    const questionsHeight = questionsEndY - questionsStartY;
    
    const questionsPerRow = 3;
    const totalRows = Math.ceil(quiz.totalQuestions / questionsPerRow);
    const questionHeight = questionsHeight / totalRows;
    const questionWidth = width / questionsPerRow;
    
    for (let row = 0; row < totalRows; row++) {
      for (let col = 0; col < questionsPerRow; col++) { 
        const questionIndex = row * questionsPerRow + col;
        if (questionIndex >= quiz.totalQuestions) break;
        
        const questionX = (2 - col) * questionWidth;
        const questionY = questionsStartY + row * questionHeight;
        const optionsY = questionY + questionHeight * 0.6;
        const optionWidth = questionWidth * 0.75 / 4;
        const optionStartX = questionX + questionWidth * 0.125;
        
        const letterVisibility: { [key: string]: number } = {};
        const hiddenLetters: string[] = [];
        
        // فحص كل خيار لكشف اختفاء الحرف
        for (const [optionIndex, option] of ['A', 'B', 'C', 'D'].entries()) {
          const optionCenterX = optionStartX + (optionIndex + 0.5) * optionWidth;
          const textRadius = Math.min(optionWidth * 0.25, questionHeight * 0.1);
          
          let visiblePixels = 0;
          let totalTextPixels = 0;
          
          // فحص منطقة النص في وسط الدائرة
          for (let dy = -textRadius; dy <= textRadius; dy += 0.3) {
            for (let dx = -textRadius; dx <= textRadius; dx += 0.3) {
              const distance = Math.sqrt(dx * dx + dy * dy);
              if (distance <= textRadius) {
                const pixelX = Math.floor(optionCenterX + dx);
                const pixelY = Math.floor(optionsY + dy);
                
                if (pixelX >= 0 && pixelX < width && pixelY >= 0 && pixelY < height) {
                  const pixelIndex = (pixelY * width + pixelX) * 4;
                  const r = data[pixelIndex];
                  const g = data[pixelIndex + 1];
                  const b = data[pixelIndex + 2];
                  const brightness = (r + g + b) / 3;
                  
                  totalTextPixels++;
                  // النص الأسود يكون مرئياً إذا كان داكناً
                  if (brightness < 150) visiblePixels++;
                }
              }
            }
          }
          
          const visibility = totalTextPixels > 0 ? (visiblePixels / totalTextPixels) * 100 : 0;
          letterVisibility[option] = visibility;
          
          // الحرف مخفي إذا كانت رؤيته أقل من الحد المحدد
          const visibilityThreshold = settings?.hiddenLetters?.textVisibilityThreshold || 40;
          if (visibility < visibilityThreshold) {
            hiddenLetters.push(option);
          }
        }
        
        // تحديد الإجابة بناءً على الحرف المخفي
        const visibilitySummary = Object.entries(letterVisibility)
          .map(([opt, vis]) => `${opt}:${vis.toFixed(1)}%`)
          .join(' | ');
        
        details.push(`Q${questionIndex + 1} رؤية: ${visibilitySummary}`);
        
        if (hiddenLetters.length === 0) {
          answers[questionIndex] = '';
          details.push(`❓ Q${questionIndex + 1}: جميع الأحرف مرئية`);
        } else if (hiddenLetters.length === 1) {
          answers[questionIndex] = hiddenLetters[0];
          questionConfidence = 100 - letterVisibility[hiddenLetters[0]];
          details.push(`✅ Q${questionIndex + 1}: حرف مخفي: ${hiddenLetters[0]}`);
        } else {
          // اختيار الأكثر اختفاءً
          const mostHidden = hiddenLetters.reduce((best, current) => 
            letterVisibility[current] < letterVisibility[best] ? current : best
          );
          answers[questionIndex] = mostHidden;
          questionConfidence = 100 - letterVisibility[mostHidden];
          details.push(`🔄 Q${questionIndex + 1}: أكثر اختفاءً: ${mostHidden}`);
        }
        
        totalConfidence += questionConfidence;
        processedQuestions++;
      }
    }
    
    const averageConfidence = processedQuestions > 0 ? totalConfidence / processedQuestions : 0;
    
    return {
      answers,
      confidence: averageConfidence,
      details
    };
  }, []);

  // استخراج الإجابات بالطريقة المختلطة
  const extractAnswersHybrid = useCallback(async (imageData: ImageData, quiz: Quiz, settings: any): Promise<{ answers: string[]; confidence: number; details: string[] }> => {
    console.log('🔄 بدء استخراج الإجابات بالطريقة المختلطة...');
    
    // تطبيق الطريقتين
    const traditionalResult = await extractAnswersTraditional(imageData, quiz, settings);
    const hiddenLettersResult = await extractAnswersHiddenLetters(imageData, quiz, settings);
    
    const answers: string[] = Array(quiz.totalQuestions).fill('');
    const details: string[] = [];
    let totalConfidence = 0;
    
    const traditionalWeight = (settings?.hybrid?.traditionalWeight || 40) / 100;
    const hiddenWeight = (settings?.hybrid?.hiddenLettersWeight || 60) / 100;
    const agreementThreshold = settings?.hybrid?.agreementThreshold || 80;
    
    for (let i = 0; i < quiz.totalQuestions; i++) {
      const traditionalAnswer = traditionalResult.answers[i];
      const hiddenAnswer = hiddenLettersResult.answers[i];
      
      if (traditionalAnswer === hiddenAnswer && traditionalAnswer !== '') {
        // الطريقتان متفقتان
        answers[i] = traditionalAnswer;
        const confidence = (traditionalResult.confidence * traditionalWeight + 
                          hiddenLettersResult.confidence * hiddenWeight);
        totalConfidence += confidence;
        details.push(`✅ Q${i + 1}: متفق: ${traditionalAnswer} (ثقة: ${confidence.toFixed(1)}%)`);
      } else {
        // تعارض بين الطريقتين
        const conflictResolution = settings?.hybrid?.conflictResolution || 'confidence';
        
        if (conflictResolution === 'traditional') {
          answers[i] = traditionalAnswer;
          totalConfidence += traditionalResult.confidence * 0.7;
          details.push(`🔵 Q${i + 1}: تقليدي: ${traditionalAnswer} vs مخفي: ${hiddenAnswer}`);
        } else if (conflictResolution === 'hidden') {
          answers[i] = hiddenAnswer;
          totalConfidence += hiddenLettersResult.confidence * 0.7;
          details.push(`🟢 Q${i + 1}: مخفي: ${hiddenAnswer} vs تقليدي: ${traditionalAnswer}`);
        } else {
          // اختيار الأعلى ثقة
          if (traditionalResult.confidence > hiddenLettersResult.confidence) {
            answers[i] = traditionalAnswer;
            totalConfidence += traditionalResult.confidence * 0.8;
            details.push(`🔵 Q${i + 1}: أعلى ثقة تقليدي: ${traditionalAnswer}`);
          } else {
            answers[i] = hiddenAnswer;
            totalConfidence += hiddenLettersResult.confidence * 0.8;
            details.push(`🟢 Q${i + 1}: أعلى ثقة مخفي: ${hiddenAnswer}`);
          }
        }
      }
    }
    
    const averageConfidence = quiz.totalQuestions > 0 ? totalConfidence / quiz.totalQuestions : 0;
    
    return {
      answers,
      confidence: averageConfidence,
      details: [...details, ...traditionalResult.details, ...hiddenLettersResult.details]
    };
  }, [extractAnswersTraditional, extractAnswersHiddenLetters]);

  // حساب النتيجة مع التحقق المضاعف
  const calculateScore = useCallback((studentAnswers: string[], quiz: Quiz): {
    correctCount: number;
    wrongCount: number;
    totalScore: number;
    percentage: number;
    details: string[];
  } => {
    console.log('🧮 بدء حساب النتيجة...');
    console.log('📚 مفتاح التصحيح:', quiz.correctAnswers);
    console.log('📝 إجابات التلميذ:', studentAnswers);
    
    // التأكد من وجود مفتاح التصحيح
    if (!quiz.correctAnswers || quiz.correctAnswers.length === 0) {
      console.error('❌ مفتاح التصحيح غير موجود!');
      return {
        correctCount: 0,
        wrongCount: quiz.totalQuestions,
        totalScore: 0,
        percentage: 0,
        details: ['❌ خطأ: مفتاح التصحيح غير موجود في الرائز']
      };
    }
    
    const questionPoints = quiz.questionPoints || Array(quiz.totalQuestions).fill(1);
    const correctAnswers = quiz.correctAnswers;
    
    let correctCount = 0;
    let wrongCount = 0;
    let totalScore = 0;
    const details: string[] = [];
    
    console.log('🔍 بدء التصحيح سؤال بسؤال...');
    
    for (let i = 0; i < quiz.totalQuestions; i++) {
      const studentAnswer = studentAnswers[i] ? studentAnswers[i].trim().toUpperCase() : '';
      const correctAnswer = correctAnswers[i] ? correctAnswers[i].trim().toUpperCase() : '';
      const points = questionPoints[i] || 1;
      
      let result = '';
      
      if (!correctAnswer) {
        // لا يوجد جواب صحيح محدد لهذا السؤال
        wrongCount++;
        result = `⚠️ Q${i + 1}: لا يوجد جواب صحيح محدد → 0 نقطة`;
      } else if (studentAnswer === 'MULTIPLE') {
        // إجابات متعددة
        wrongCount++;
        result = `❌ Q${i + 1}: إجابات متعددة → 0 نقطة`;
      } else if (!studentAnswer || studentAnswer === '') {
        // لا توجد إجابة
        wrongCount++;
        result = `⭕ Q${i + 1}: لا توجد إجابة → 0 نقطة`;
      } else if (studentAnswer === correctAnswer) {
        // إجابة صحيحة
        correctCount++;
        totalScore += points;
        result = `✅ Q${i + 1}: ${studentAnswer} = ${correctAnswer} → +${points} نقطة`;
      } else {
        // إجابة خاطئة
        wrongCount++;
        result = `❌ Q${i + 1}: ${studentAnswer} ≠ ${correctAnswer} → 0 نقطة`;
      }
      
      details.push(result);
    }
    
    // التحقق النهائي
    const totalAnswered = correctCount + wrongCount;
    if (totalAnswered !== quiz.totalQuestions) {
      console.warn(`⚠️ عدم تطابق الأسئلة: ${totalAnswered} من ${quiz.totalQuestions}`);
      const missing = quiz.totalQuestions - totalAnswered;
      wrongCount += missing;
      details.push(`⚠️ تم إضافة ${missing} إجابة مفقودة كخطأ`);
    }
    
    // حساب النسبة المئوية بناءً على النقط المحصل عليها
    const maxPossibleScore = questionPoints.reduce((sum, points) => sum + points, 0);
    const percentage = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;
    
    console.log('📊 النتيجة النهائية:');
    console.log(`✅ صحيح: ${correctCount}/${quiz.totalQuestions}`);
    console.log(`❌ خطأ: ${wrongCount}/${quiz.totalQuestions}`);
    console.log(`🎯 النقطة: ${totalScore}/${maxPossibleScore}`);
    console.log(`📊 النسبة: ${percentage}%`);
    
    return {
      correctCount,
      wrongCount,
      totalScore,
      percentage,
      details
    };
  }, []);

  // استخراج الإجابات حسب الإعدادات
  const extractAnswersWithSettings = useCallback(async (imageData: ImageData, quiz: Quiz, settings: any) => {
    const scanMethod = settings?.general?.scanMethod || 'traditional';
    
    switch (scanMethod) {
      case 'hiddenLetters':
        return await extractAnswersHiddenLetters(imageData, quiz, settings);
      case 'hybrid':
        return await extractAnswersHybrid(imageData, quiz, settings);
      default:
        return await extractAnswersTraditional(imageData, quiz, settings);
    }
  }, [extractAnswersTraditional, extractAnswersHiddenLetters, extractAnswersHybrid]);

  // معالجة الصورة مع حساب صحيح
  const processImageAdvanced = useCallback(async (imageData: ImageData, quiz: Quiz, captureNumber: number) => {
    try {
      // تحميل الإعدادات
      const scanSettings = loadScanSettings();
      
      console.log(`🔄 معالجة الصورة ${captureNumber}...`);
      setDebugInfo(`🔄 معالجة الصورة ${captureNumber}...`);
      
      let studentInfo = null;
      
      if (scanMode === 'barcode') {
        studentInfo = await readBarcodeAdvanced(imageData);
        setDebugInfo(`📱 قراءة الباركود...`);
      } else {
        setDebugInfo(`🆔 قراءة الرقم الوطني...`);
        throw new Error('وضع الرقم الوطني قيد التطوير');
      }
      
      if (!studentInfo) {
        throw new Error('لم يتم العثور على الباركود في الصورة');
      }
      
      console.log('👤 معلومات التلميذ:', studentInfo);
      setDebugInfo(`👤 تم العثور على: ${studentInfo.name}`);
      
      // استخراج الإجابات
      const extractionResult = await extractAnswersWithSettings(imageData, quiz, scanSettings);
      setDebugInfo(`📝 استخراج الإجابات...`);
      
      // حساب النتيجة بالطريقة المصححة
      const scoreResult = calculateScore(extractionResult.answers, quiz);
      setDebugInfo(`🧮 حساب النتيجة...`);
      
      const scanResult = {
        quizId: quiz.id,
        studentId: studentInfo.id,
        nationalId: studentInfo.nationalId,
        studentName: studentInfo.name,
        score: scoreResult.totalScore,
        percentage: scoreResult.percentage,
        answers: extractionResult.answers.map(a => a === 'MULTIPLE' ? '' : a),
        correctAnswers: scoreResult.correctCount,
        wrongAnswers: scoreResult.wrongCount,
        verified: true
      };
      
      console.log('🎯 النتيجة النهائية المؤكدة:', scanResult);
      console.log('📋 تفاصيل التصحيح:', scoreResult.details);
      setDebugInfo(`✅ ${scanResult.studentName}: ${scoreResult.correctCount}✅ ${scoreResult.wrongCount}❌ (${scoreResult.percentage}%)`);
      
      // تحديث العدادات
      setProcessingCount(prev => prev - 1);
      setCompletedCount(prev => prev + 1);
      
      // إضافة النتيجة
      onResultAdded(scanResult);
      setRecentResults(prev => [scanResult, ...prev.slice(0, 4)]);
      
      // إشعار النجاح
      showInstantNotification(`✅ ${scanResult.studentName}: ${scoreResult.correctCount}✅ ${scoreResult.wrongCount}❌ = ${scoreResult.percentage}%`, 'success');
      
    } catch (error) {
      console.error('❌ خطأ في المعالجة:', error);
      setDebugInfo(`❌ ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
      
      setProcessingCount(prev => prev - 1);
      setErrorCount(prev => prev + 1);
      
      showInstantNotification(`❌ ${error instanceof Error ? error.message : 'خطأ غير معروف'}`, 'error');
    }
  }, [scanMode, readBarcodeAdvanced, calculateScore, onResultAdded, loadScanSettings, extractAnswersWithSettings]);

  // التقاط سريع ومحسن
  const fastCapture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !selectedQuiz || isProcessing) return;
    
    const now = Date.now();
    if (now - lastProcessedTime.current < 1500) {
      console.log('⏳ انتظار...');
      return;
    }
    lastProcessedTime.current = now;
    
    const quiz = quizzes.find(q => q.id === selectedQuiz);
    if (!quiz) return;
    
    try {
      setIsProcessing(true);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      setCaptureCount(prev => prev + 1);
      setProcessingCount(prev => prev + 1);
      
      showInstantNotification(`📸 تم التقاط الصورة ${captureCount + 1}`, 'info');
      
      await processImageAdvanced(imageData, quiz, captureCount + 1);
      
    } catch (error) {
      console.error('❌ خطأ في الالتقاط:', error);
      showInstantNotification(`❌ خطأ في التقاط الصورة`, 'error');
      setErrorCount(prev => prev + 1);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedQuiz, quizzes, captureCount, isProcessing, processImageAdvanced]);

  // إشعارات فورية
  const showInstantNotification = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    const colors = {
      success: '#10B981',
      error: '#EF4444',
      info: '#3B82F6'
    };
    
    const notification = document.createElement('div');
    notification.innerHTML = `
      <div style="
        position: fixed; 
        top: 20px; 
        left: 50%; 
        transform: translateX(-50%); 
        background: ${colors[type]}; 
        color: white; 
        padding: 16px 24px; 
        border-radius: 12px; 
        font-weight: bold; 
        z-index: 1000;
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        text-align: center;
        min-width: 300px;
        animation: slideDown 0.3s ease-out;
      ">
        ${message}
      </div>
      <style>
        @keyframes slideDown {
          from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
      </style>
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 3000);
  }, []);

  // بدء المسح
  const startScanning = useCallback(async () => {
    if (!selectedQuiz) {
      alert('يرجى اختيار رائز أولاً');
      return;
    }
    setIsScanning(true);
    setCaptureCount(0);
    setProcessingCount(0);
    setCompletedCount(0);
    setErrorCount(0);
    setRecentResults([]);
    setDebugInfo('');
    await startCamera();
  }, [selectedQuiz, startCamera]);

  // إيقاف المسح
  const stopScanning = useCallback(() => {
    setIsScanning(false);
    setIsProcessing(false);
    setDebugInfo('');
    cleanup();
  }, [cleanup]);

  // حساب لون الإطار
  const getFrameColor = () => {
    if (frameQuality.overallQuality === 'excellent') return '#10B981';
    if (frameQuality.overallQuality === 'good') return '#F59E0B';
    return '#EF4444';
  };

  const getFrameMessage = () => {
    if (frameQuality.overallQuality === 'excellent') return '✅ إطار ممتاز - جاهز للمسح!';
    if (frameQuality.overallQuality === 'good') return '⚠️ إطار جيد - يمكن المسح';
    return '❌ إطار ضعيف - حرك الكاميرا';
  };

  return (
    <div className="p-6">
      {!isScanning ? (
        // واجهة الإعداد
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Scan className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">مسح الروائز المحسن والدقيق</h2>
            <p className="text-gray-600 text-lg">نظام مسح محسن مع قراءة دقيقة للباركود وحساب صحيح للنقط</p>
          </div>

          {/* اختيار الرائز */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              اختر الرائز *
            </label>
            <select
              value={selectedQuiz}
              onChange={(e) => setSelectedQuiz(e.target.value)}
              className="w-full px-4 py-4 border-2 border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- اختر الرائز --</option>
              {quizzes.map(quiz => (
                <option key={quiz.id} value={quiz.id}>
                  {quiz.title} - {quiz.subject} ({quiz.totalQuestions} سؤال)
                </option>
              ))}
            </select>
          </div>

          {/* اختيار نوع المسح */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              طريقة التعرف على التلميذ
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setScanMode('barcode')}
                className={`p-6 rounded-xl border-2 transition-all duration-200 ${
                  scanMode === 'barcode' 
                    ? 'border-green-500 bg-green-50 text-green-700 shadow-lg transform scale-105' 
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="text-center">
                  <QrCode className="w-8 h-8 mx-auto mb-2" />
                  <div className="font-bold text-lg">الباركود المحسن</div>
                  <div className="text-sm">قراءة محسنة ومضمونة</div>
                </div>
              </button>
              
              <button
                onClick={() => setScanMode('national_id')}
                className={`p-6 rounded-xl border-2 transition-all duration-200 ${
                  scanMode === 'national_id' 
                    ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-lg transform scale-105' 
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="text-center">
                  <Target className="w-8 h-8 mx-auto mb-2" />
                  <div className="font-bold text-lg">الرقم الوطني</div>
                  <div className="text-sm">قيد التطوير</div>
                </div>
              </button>
            </div>
          </div>

          {/* زر بدء المسح */}
          <button
            onClick={startScanning}
            disabled={!selectedQuiz}
            className="w-full py-8 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-2xl text-2xl font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:scale-105"
          >
            <div className="flex items-center justify-center gap-4">
              <Scan className="w-10 h-10" />
              بدء المسح المحسن والدقيق
            </div>
          </button>
        </div>
      ) : (
        // واجهة المسح
        <div className="fixed inset-0 z-50 bg-black">
          {/* أزرار التحكم العلوية */}
          <div className="absolute top-4 left-4 right-4 z-60 flex justify-between items-center">
            <div className="bg-black bg-opacity-70 text-white px-6 py-3 rounded-lg">
              <div className="text-lg font-bold">
                📸 {captureCount} | ⏳ {processingCount} | ✅ {completedCount} | ❌ {errorCount}
              </div>
              <div className="text-sm text-gray-300">
                📱 وضع الباركود المحسن والدقيق
              </div>
            </div>
            
            <button
              onClick={stopScanning}
              className="w-16 h-16 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-700 transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
          </div>

          {/* الكاميرا */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* كانفاس مخفي */}
          <canvas ref={canvasRef} className="hidden" />

          {/* الإطار الذكي المحسن */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div 
              className="relative transition-all duration-300"
              style={{
                width: '85%',
                height: '75%',
                maxWidth: '600px',
                maxHeight: '800px',
                border: `6px solid ${getFrameColor()}`,
                borderRadius: '20px',
                boxShadow: `0 0 30px ${getFrameColor()}80`
              }}
            >
              {/* زوايا الإطار المحسنة */}
              <div className="absolute -top-3 -right-3 w-8 h-8 border-4 border-t-4 border-r-4 border-transparent" 
                   style={{ borderTopColor: getFrameColor(), borderRightColor: getFrameColor() }}></div>
              <div className="absolute -top-3 -left-3 w-8 h-8 border-4 border-t-4 border-l-4 border-transparent" 
                   style={{ borderTopColor: getFrameColor(), borderLeftColor: getFrameColor() }}></div>
              <div className="absolute -bottom-3 -right-3 w-8 h-8 border-4 border-b-4 border-r-4 border-transparent" 
                   style={{ borderBottomColor: getFrameColor(), borderRightColor: getFrameColor() }}></div>
              <div className="absolute -bottom-3 -left-3 w-8 h-8 border-4 border-b-4 border-l-4 border-transparent" 
                   style={{ borderBottomColor: getFrameColor(), borderLeftColor: getFrameColor() }}></div>
              
              {/* رسالة الحالة */}
              <div 
                className="absolute -top-16 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full text-white font-bold text-lg"
                style={{ background: getFrameColor() }}
              >
                {getFrameMessage()}
              </div>
              
              {/* مؤشر جودة الإطار */}
              <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg">
                <div className="text-sm">
                  🎯 {frameQuality.cornerCount}/4 زوايا
                </div>
                <div className="text-xs">
                  ثقة: {Math.round(frameQuality.confidence * 100)}%
                </div>
              </div>

              {/* معلومات التصحيح */}
              {debugInfo && (
                <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg">
                  <div className="text-sm text-center">{debugInfo}</div>
                </div>
              )}
            </div>
          </div>

          {/* زر التقاط محسن */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-60">
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={fastCapture}
                disabled={isProcessing}
                className={`px-16 py-8 rounded-full flex items-center gap-4 font-bold text-3xl transition-all duration-200 shadow-2xl ${
                  isProcessing 
                    ? 'bg-gray-600 text-white cursor-not-allowed'
                    : frameQuality.overallQuality === 'excellent'
                    ? 'bg-green-600 text-white hover:bg-green-700 animate-pulse scale-110'
                    : frameQuality.overallQuality === 'good'
                    ? 'bg-yellow-600 text-white hover:bg-yellow-700 scale-105'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-white"></div>
                    معالجة...
                  </>
                ) : (
                  <>
                    <Camera className="w-10 h-10" />
                    {frameQuality.overallQuality === 'excellent' ? 'التقاط الآن!' : 
                     frameQuality.overallQuality === 'good' ? 'التقاط' : 
                     'ضع الورقة في الإطار'}
                  </>
                )}
              </button>
              
              {/* مؤشر المعالجة */}
              {processingCount > 0 && (
                <div className="bg-blue-600 px-8 py-4 rounded-full">
                  <span className="text-white font-bold text-xl">
                    🔄 معالجة {processingCount} صورة...
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* قائمة النتائج الأخيرة */}
          {recentResults.length > 0 && (
            <div className="absolute top-20 right-4 z-60 max-w-sm">
              <div className="bg-white rounded-xl shadow-2xl p-6 max-h-96 overflow-y-auto">
                <h3 className="font-bold text-gray-900 mb-4 text-lg">آخر النتائج ({completedCount})</h3>
                <div className="space-y-3">
                  {recentResults.map((result, index) => (
                    <div key={index} className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <div className="font-bold text-green-900 text-lg">{result.studentName}</div>
                      <div className="text-green-700 font-semibold">
                        النقطة: {result.score}/{quizzes.find(q => q.id === result.quizId)?.maxScore} ({result.percentage}%)
                      </div>
                      <div className="text-sm text-green-600">
                        صحيح: {result.correctAnswers} | خطأ: {result.wrongAnswers}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QuizScanner;