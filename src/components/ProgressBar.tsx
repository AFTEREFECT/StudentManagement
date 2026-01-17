import React from 'react';

interface ProgressBarProps {
  progress: number;
  status?: 'loading' | 'success' | 'error' | 'idle';
  message?: string;
  estimatedTime?: number;
  details?: {
    levels: number;
    sections: number;
    students: number;
    males: number;
    females: number;
  };
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, status, message, estimatedTime, details }) => {
  return (
    <div className="w-full">
      {message && (
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>{message}</span>
          {estimatedTime && estimatedTime > 0 && (
            <span>الوقت المتبقي: {Math.round(estimatedTime)}ث</span>
          )}
        </div>
      )}
      
      <div className="flex justify-between text-sm text-gray-600 mb-2">
        <span>التقدم</span>
        <span>{Math.round(progress)}%</span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
        <div 
          className={`h-2.5 rounded-full transition-all duration-300 ${
            status === 'success' ? 'bg-green-600' :
            status === 'error' ? 'bg-red-600' :
            'bg-blue-600'
          }`}
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      {details && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div className="text-center">
            <div className="font-semibold text-purple-600">{details.levels || 0}</div>
            <div className="text-gray-500">المستويات</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-indigo-600">{details.sections || 0}</div>
            <div className="text-gray-500">الأقسام</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-green-600">{details.students || 0}</div>
            <div className="text-gray-500">التلاميذ</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-blue-600">{details.males || 0}</div>
            <div className="text-gray-500">الذكور</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-pink-600">{details.females || 0}</div>
            <div className="text-gray-500">الإناث</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressBar;