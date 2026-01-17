import React from 'react';

interface FixedQuizTemplateProps {
  quiz: {
    title: string;
    subject: string;
    level: string;
    section: string;
    totalQuestions: number;
    maxScore: number;
    date: string;
  };
  student?: {
    firstName: string;
    lastName: string;
    nationalId: string;
  };
  barcodeUrl?: string;
  isAnswerKey?: boolean;
  correctAnswers?: string[];
}

/**
 * نموذج ثابت لورقة الإجابات بناءً على الصورة المرفقة
 * يدعم 20 سؤال مرتبة في 3 أعمدة بالضبط كما في النموذج الأصلي
 */
const FixedQuizTemplate: React.FC<FixedQuizTemplateProps> = ({ 
  quiz, 
  student, 
  barcodeUrl, 
  isAnswerKey = false, 
  correctAnswers = [] 
}) => {
  const totalQuestions = Math.min(quiz.totalQuestions, 20); // النموذج الثابت يدعم 20 سؤال فقط
  const questionsPerRow = 3;
  const totalRows = Math.ceil(totalQuestions / questionsPerRow);

  return (
    <div style={{
      fontFamily: "'Cairo', Arial, sans-serif",
      direction: 'rtl',
      background: 'white',
      color: '#000',
      lineHeight: 1.2,
      padding: '8mm',
      width: '210mm',
      minHeight: '297mm',
      maxHeight: '297mm',
      margin: '0 auto',
      boxSizing: 'border-box',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* نقاط المسح الضوئي - 4 مربعات سوداء في الزوايا */}
      <div style={{ position: 'absolute', top: '5mm', right: '5mm', width: '8mm', height: '8mm', background: '#000' }}></div>
      <div style={{ position: 'absolute', top: '5mm', left: '5mm', width: '8mm', height: '8mm', background: '#000' }}></div>
      <div style={{ position: 'absolute', bottom: '5mm', right: '5mm', width: '8mm', height: '8mm', background: '#000' }}></div>
      <div style={{ position: 'absolute', bottom: '5mm', left: '5mm', width: '8mm', height: '8mm', background: '#000' }}></div>

      {/* رأس النموذج */}
      <div style={{ textAlign: 'center', marginBottom: '4mm' }}>
        <div style={{ border: '2px solid #000', padding: '3mm', marginBottom: '2mm', background: 'white' }}>
          <div style={{ fontSize: '10px', color: '#000', fontWeight: 900, marginBottom: '2mm', lineHeight: 1.1 }}>
            المملكة المغربية - وزارة التربية الوطنية والتعليم الأولي والرياضة
          </div>
          
          <h2 style={{ color: '#000', fontSize: '14px', margin: '2mm 0', fontWeight: 900, textDecoration: 'underline' }}>
            {quiz.title || 'الرائز التقويمي'}
          </h2>
          
          <div style={{ fontSize: '9px', color: '#000', fontWeight: 700, lineHeight: 1.2, marginTop: '2mm', borderTop: '1px solid #000', paddingTop: '1mm' }}>
            <div style={{ marginBottom: '1mm' }}><strong>المادة:</strong> {quiz.subject || 'غير محدد'}</div>
            <div style={{ marginBottom: '1mm' }}><strong>المستوى:</strong> {quiz.level || 'غير محدد'} | <strong>القسم:</strong> {quiz.section || 'غير محدد'}</div>
            <div><strong>التاريخ:</strong> {quiz.date ? new Date(quiz.date).toLocaleDateString('fr-EG') : 'غير محدد'} | <strong>المدة:</strong> ساعة واحدة</div>
          </div>
        </div>
      </div>

      {/* معلومات التلميذ مع الباركود */}
      <div style={{ marginBottom: '3mm', border: '2px solid #000', padding: '2mm', background: 'white' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4mm', fontSize: '10px', fontWeight: 900 }}>
          {/* الباركود في المكان المحدد بالأزرق */}
          <div>
            <strong style={{ color: '#000' }}>الكود الشريطي:</strong>
            <div style={{ border: '2px solid #0066cc', padding: '2mm', marginTop: '1mm', background: '#f0f8ff', textAlign: 'center', minHeight: '15mm', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {barcodeUrl ? 
                <img src={barcodeUrl} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt={`باركود ${student?.nationalId}`} /> : 
                <div style={{ color: '#0066cc', fontSize: '8px', textAlign: 'center' }}>سيتم إدراج<br/>الكود الشريطي<br/>هنا</div>
              }
            </div>
          </div>
          
          <div>
            <strong style={{ color: '#000' }}>اسم التلميذ:</strong>
            <div style={{ border: '1px solid #000', padding: '2mm', marginTop: '1mm', fontSize: '18px', fontWeight: 900, textAlign: 'center', background: 'white', minHeight: '6mm' }}>
              {student ? `${student.firstName} ${student.lastName}` : ''}
            </div>
          </div>
          
          <div>
            <strong style={{ color: '#000' }}>الرقم الوطني:</strong>
            <div style={{ border: '1px solid #000', padding: '2mm', marginTop: '1mm', fontFamily: "'Courier New', monospace", fontSize: '18px', fontWeight: 900, letterSpacing: '1px', textAlign: 'center', background: 'white', minHeight: '6mm' }}>
              {student ? student.nationalId : ''}
            </div>
          </div>
        </div>
      </div>

      {/* ورقة الإجابات - النموذج الثابت */}
      <div style={{ border: '2px solid #000', padding: '5mm', background: 'white', minHeight: '180mm' }}>
        <h3 style={{ textAlign: 'center', color: '#000', fontSize: '16px', margin: '0 0 5mm 0', fontWeight: 900, borderBottom: '2px solid #000', paddingBottom: '3mm' }}>
          ورقة الإجابات
        </h3>
        
        {/* الأسئلة مرتبة في 3 أعمدة بالتصميم الثابت */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4mm', direction: 'rtl', padding: '3mm 0' }}>
          {Array.from({ length: totalRows }, (_, row) => {
            return Array.from({ length: questionsPerRow }, (_, col) => {
              const questionIndex = row * questionsPerRow + col;
              if (questionIndex >= totalQuestions) return null;
              
              const questionNumber = questionIndex + 1;
              const correctAnswer = correctAnswers[questionIndex] || '';
              
              return (
                <div key={questionIndex} style={{ 
                  border: '2px solid #000', 
                  padding: '4mm', 
                  background: 'white', 
                  textAlign: 'center', 
                  minHeight: '22mm',
                  marginBottom: '2mm',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center'
                }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4mm', color: '#000' }}>
                    Q:{questionNumber}
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '3mm', direction: 'ltr' }}>
                    {['A', 'B', 'C', 'D'].map(option => (
                      <div
                        key={option}
                        style={{
                          width: '14mm',
                          height: '14mm',
                          border: '3px solid #000',
                          borderRadius: '50%',
                          background: isAnswerKey && correctAnswer === option ? '#000' : 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: 'bold',
                          color: isAnswerKey && correctAnswer === option ? 'white' : '#000',
                          position: 'relative'
                        }}
                      >
                        {option}
                      </div>
                    ))}
                  </div>
                </div>
              );
            }).filter(Boolean);
          }).flat()}
        </div>
      </div>

      {/* تذييل النموذج */}
      <div style={{ position: 'absolute', bottom: '3mm', left: '8mm', right: '8mm', textAlign: 'center', fontSize: '7px', color: '#000', borderTop: '1px solid #000', paddingTop: '1mm', fontWeight: 700 }}>
        <p style={{ margin: 0 }}>نظام إدارة التلاميذ - نموذج ثابت محسن - {new Date().toLocaleDateString('fr-EG')}</p>
        {student && (
          <p style={{ margin: '0.5mm 0 0 0', fontFamily: 'monospace', fontSize: '6px' }}>
            رمز التلميذ: {student.nationalId} | النموذج الثابت 20 سؤال
          </p>
        )}
      </div>
    </div>
  );
};

export default FixedQuizTemplate;