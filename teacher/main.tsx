import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import TeacherApp from './TeacherApp';
import './teacher.css';
import './registerPwa';

const root = document.getElementById('root');
if (!root) throw new Error('تعذر العثور على نقطة تشغيل بوابة الأستاذ.');

createRoot(root).render(
  <StrictMode>
    <TeacherApp />
  </StrictMode>
);
