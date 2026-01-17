/**
 * معالج النموذج الثابت لورقة الإجابات
 * مصمم خصيصاً للنموذج المرفق مع 20 سؤال في 3 أعمدة
 */

export interface FixedTemplateConfig {
  totalQuestions: 20;
  questionsPerRow: 3;
  totalRows: 7;
  // مواقع ثابتة بناءً على النموذج المرفق
  questionsStartY: number;
  questionsEndY: number;
  questionWidth: number;
  questionHeight: number;
  circleRadius: number;
  optionSpacing: number;
  // إعدادات التظليل المحسنة
  darknessThreshold: number;
  minimumFillPercentage: number;
  textVisibilityThreshold: number;
}

export interface CirclePosition {
  x: number;
  y: number;
  radius: number;
  option: 'A' | 'B' | 'C' | 'D';
  questionNumber: number;
}

export class FixedTemplateProcessor {
  private config: FixedTemplateConfig;
  private circlePositions: CirclePosition[] = [];

  constructor(imageWidth: number, imageHeight: number) {
    // حساب المواقع الثابتة بناءً على النموذج المرفق
    this.config = {
      totalQuestions: 20,
      questionsPerRow: 3,
      totalRows: 7,
      questionsStartY: Math.floor(imageHeight * 0.52),
      questionsEndY: Math.floor(imageHeight * 0.85),
      questionWidth: imageWidth / 3,
      questionHeight: (Math.floor(imageHeight * 0.85) - Math.floor(imageHeight * 0.52)) / 7,
      circleRadius: Math.min(imageWidth / 3 * 0.06, imageHeight * 0.015),
      optionSpacing: (imageWidth / 3 * 0.75) / 4,
      // إعدادات التظليل المحسنة
      darknessThreshold: 20,
      minimumFillPercentage: 15,
      textVisibilityThreshold: 40
    };

    this.calculateCirclePositions();
  }

  /**
   * حساب مواقع جميع الدوائر بدقة مطلقة
   */
  private calculateCirclePositions(): void {
    this.circlePositions = [];

    for (let row = 0; row < this.config.totalRows; row++) {
      for (let col = 0; col < this.config.questionsPerRow; col++) {
        const questionIndex = row * this.config.questionsPerRow + col;
        if (questionIndex >= this.config.totalQuestions) break;

        const questionNumber = questionIndex + 1;
        
        // حساب موقع السؤال (من اليمين لليسار)
        const questionX = (2 - col) * this.config.questionWidth;
        const questionY = this.config.questionsStartY + row * this.config.questionHeight;
        
        // حساب مواقع الخيارات
        const optionsY = questionY + this.config.questionHeight * 0.6;
        const optionStartX = questionX + this.config.questionWidth * 0.125;

        ['A', 'B', 'C', 'D'].forEach((option, optionIndex) => {
          const optionCenterX = optionStartX + (optionIndex + 0.5) * this.config.optionSpacing;
          
          this.circlePositions.push({
            x: optionCenterX,
            y: optionsY,
            radius: this.config.circleRadius,
            option: option as 'A' | 'B' | 'C' | 'D',
            questionNumber
          });
        });
      }
    }

    console.log(`📍 تم حساب ${this.circlePositions.length} موقع دائرة للنموذج الثابت`);
  }

  /**
   * استخراج الإجابات من الصورة باستخدام المواقع الثابتة مع الطريقة المزدوجة
   */
  public extractAnswers(imageData: ImageData, settings?: any): {
    answers: string[];
    confidence: number;
    details: string[];
  } {
    const answers: string[] = Array(this.config.totalQuestions).fill('');
    const details: string[] = [];
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    let totalConfidence = 0;

    console.log('🎯 بدء استخراج الإجابات بالنموذج الثابت المحسن...');

    // تجميع الدوائر حسب السؤال
    const questionCircles = new Map<number, CirclePosition[]>();
    this.circlePositions.forEach(circle => {
      if (!questionCircles.has(circle.questionNumber)) {
        questionCircles.set(circle.questionNumber, []);
      }
      questionCircles.get(circle.questionNumber)!.push(circle);
    });

    // فحص كل سؤال
    for (let questionNum = 1; questionNum <= this.config.totalQuestions; questionNum++) {
      const circles = questionCircles.get(questionNum) || [];
      const optionDarkness: { [key: string]: number } = {};
      const optionTextVisibility: { [key: string]: number } = {};
      let maxDarkness = 0;
      let selectedOption = '';

      // فحص كل دائرة في السؤال
      circles.forEach(circle => {
        let darkPixels = 0;
        let totalPixels = 0;
        let visibleTextPixels = 0;
        let totalTextPixels = 0;

        // فحص البكسلات داخل الدائرة بدقة عالية
        for (let dy = -circle.radius; dy <= circle.radius; dy += 0.2) {
          for (let dx = -circle.radius; dx <= circle.radius; dx += 0.2) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= circle.radius) {
              const pixelX = Math.floor(circle.x + dx);
              const pixelY = Math.floor(circle.y + dy);

              if (pixelX >= 0 && pixelX < width && pixelY >= 0 && pixelY < height) {
                const pixelIndex = (pixelY * width + pixelX) * 4;
                const r = data[pixelIndex];
                const g = data[pixelIndex + 1];
                const b = data[pixelIndex + 2];
                const brightness = (r + g + b) / 3;

                totalPixels++;
                if (brightness < 80) darkPixels++; // حد محسن للنموذج الجديد
                
                // فحص منطقة النص في وسط الدائرة
                const textDistance = Math.sqrt(dx * dx + dy * dy);
                if (textDistance <= circle.radius * 0.4) { // منطقة النص في وسط الدائرة
                  totalTextPixels++;
                  if (brightness < 150) visibleTextPixels++; // النص الأسود مرئي
                }
              }
            }
          }
        }

        const darkness = totalPixels > 0 ? darkPixels / totalPixels : 0;
        const textVisibility = totalTextPixels > 0 ? (visibleTextPixels / totalTextPixels) * 100 : 100;
        
        optionDarkness[circle.option] = darkness;
        optionTextVisibility[circle.option] = textVisibility;

        if (darkness > maxDarkness) {
          maxDarkness = darkness;
          selectedOption = circle.option;
        }
      });

      // تحديد الإجابة النهائية بالطريقة المزدوجة
      const darknessThreshold = (settings?.darknessThreshold || this.config.darknessThreshold) / 100;
      const textThreshold = settings?.textVisibilityThreshold || this.config.textVisibilityThreshold;
      
      const markedOptions = Object.entries(optionDarkness)
        .filter(([option, darkness]) => {
          const textVisibility = optionTextVisibility[option];
          // الطريقة المزدوجة: تظليل عالي أو اختفاء النص
          return darkness > darknessThreshold || textVisibility < textThreshold;
        })
        .map(([option]) => option);

      const darknessSummary = Object.entries(optionDarkness)
        .map(([opt, dark]) => `${opt}:${(dark * 100).toFixed(1)}%`)
        .join(' | ');
      
      const textSummary = Object.entries(optionTextVisibility)
        .map(([opt, vis]) => `${opt}:${vis.toFixed(1)}%`)
        .join(' | ');

      details.push(`Q${questionNum} تظليل: ${darknessSummary}`);
      details.push(`Q${questionNum} نص: ${textSummary}`);

      if (markedOptions.length === 0) {
        // لا توجد إجابة واضحة
        const minFill = (settings?.minimumFillPercentage || this.config.minimumFillPercentage) / 100;
        if (maxDarkness > minFill) {
          answers[questionNum - 1] = selectedOption;
          totalConfidence += maxDarkness * 60;
          details.push(`⚠️ Q${questionNum}: إجابة ضعيفة: ${selectedOption}`);
        } else {
          answers[questionNum - 1] = '';
          details.push(`❓ Q${questionNum}: لا توجد إجابة`);
        }
      } else if (markedOptions.length === 1) {
        // إجابة واحدة واضحة
        answers[questionNum - 1] = markedOptions[0];
        const selectedDarkness = optionDarkness[markedOptions[0]];
        const selectedTextVisibility = optionTextVisibility[markedOptions[0]];
        
        // حساب الثقة بناءً على التظليل واختفاء النص
        const confidenceFromDarkness = selectedDarkness * 50;
        const confidenceFromText = (100 - selectedTextVisibility) * 0.5;
        const combinedConfidence = Math.min(95, confidenceFromDarkness + confidenceFromText);
        
        totalConfidence += combinedConfidence;
        details.push(`✅ Q${questionNum}: إجابة واضحة: ${markedOptions[0]}`);
      } else {
        // إجابات متعددة - اختيار الأوضح
        const bestOption = markedOptions.reduce((best, current) => 
          const currentScore = optionDarkness[current] + (100 - optionTextVisibility[current]) / 100;
          const bestScore = optionDarkness[best] + (100 - optionTextVisibility[best]) / 100;
          return currentScore > bestScore ? current : best;
        );
        answers[questionNum - 1] = bestOption;
        totalConfidence += optionDarkness[bestOption] * 75;
        details.push(`🔄 Q${questionNum}: اختيار الأوضح: ${bestOption} من ${markedOptions.join(', ')}`);
      }
    }

    const averageConfidence = this.config.totalQuestions > 0 ? totalConfidence / this.config.totalQuestions : 0;

    console.log('✅ تم استخراج الإجابات بالنموذج الثابت المحسن بنجاح');
    console.log('📊 الثقة المتوسطة:', averageConfidence.toFixed(1) + '%');

    return {
      answers,
      confidence: averageConfidence,
      details
    };
  }

  /**
   * التحقق من جودة الصورة للنموذج الثابت
   */
  public validateImageQuality(imageData: ImageData): {
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // فحص نقاط المرجع (المربعات السوداء في الزوايا)
    const cornerSize = Math.min(width, height) * 0.04;
    const corners = [
      { x: cornerSize / 2, y: cornerSize / 2, name: 'أعلى يمين' },
      { x: width - cornerSize / 2, y: cornerSize / 2, name: 'أعلى يسار' },
      { x: cornerSize / 2, y: height - cornerSize / 2, name: 'أسفل يمين' },
      { x: width - cornerSize / 2, y: height - cornerSize / 2, name: 'أسفل يسار' }
    ];

    let cornersDetected = 0;
    corners.forEach(corner => {
      let darkPixels = 0;
      let totalPixels = 0;

      for (let dy = -cornerSize / 2; dy <= cornerSize / 2; dy += 2) {
        for (let dx = -cornerSize / 2; dx <= cornerSize / 2; dx += 2) {
          const pixelX = Math.floor(corner.x + dx);
          const pixelY = Math.floor(corner.y + dy);

          if (pixelX >= 0 && pixelX < width && pixelY >= 0 && pixelY < height) {
            const pixelIndex = (pixelY * width + pixelX) * 4;
            const r = data[pixelIndex];
            const g = data[pixelIndex + 1];
            const b = data[pixelIndex + 2];
            const brightness = (r + g + b) / 3;

            totalPixels++;
            if (brightness < 60) darkPixels++;
          }
        }
      }

      const darkness = totalPixels > 0 ? darkPixels / totalPixels : 0;
      if (darkness > 0.5) {
        cornersDetected++;
      } else {
        issues.push(`نقطة المرجع ${corner.name} غير واضحة`);
      }
    });

    // التحقق من جودة الصورة
    if (width < 1000 || height < 1200) {
      issues.push('دقة الصورة منخفضة');
      recommendations.push('استخدم دقة أعلى (1400×1800 على الأقل)');
    }

    if (cornersDetected < 2) {
      issues.push('نقاط المرجع غير واضحة');
      recommendations.push('تأكد من وضوح المربعات السوداء في الزوايا');
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * الحصول على معلومات النموذج
   */
  public getTemplateInfo(): FixedTemplateConfig {
    return { ...this.config };
  }

  /**
   * الحصول على مواقع الدوائر
   */
  public getCirclePositions(): CirclePosition[] {
    return [...this.circlePositions];
  }
}

/**
 * دالة مساعدة لإنشاء معالج النموذج الثابت
 */
export const createFixedTemplateProcessor = (imageWidth: number, imageHeight: number): FixedTemplateProcessor => {
  return new FixedTemplateProcessor(imageWidth, imageHeight);
};

/**
 * دالة التحقق من توافق النموذج
 */
export const validateTemplateCompatibility = (quiz: { totalQuestions: number }): {
  isCompatible: boolean;
  message: string;
  recommendation: string;
} => {
  if (quiz.totalQuestions <= 20) {
    return {
      isCompatible: true,
      message: 'النموذج متوافق مع القالب الثابت المحسن',
      recommendation: 'يمكن استخدام النموذج الثابت المحسن مع الطريقة المزدوجة للكشف'
    };
  } else {
    return {
      isCompatible: false,
      message: `النموذج الثابت يدعم 20 سؤال فقط، لديك ${quiz.totalQuestions} سؤال`,
      recommendation: 'قلل عدد الأسئلة إلى 20 أو انتظر إضافة نماذج أكبر'
    };
  }
};