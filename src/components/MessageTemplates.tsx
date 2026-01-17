import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, Edit2, Trash2, Save, X, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import { dbManager } from '../utils/database';

interface MessageTemplate {
  id?: string;
  name: string;
  content: string;
  category: string;
}

export const MessageTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const categories = ['غياب', 'تأخر', 'مخالفة', 'إشعار عام', 'استدعاء ولي الأمر', 'تهنئة', 'أخرى'];

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await dbManager.getMessageTemplates();
      setTemplates(data || []);
    } catch (error) {
      console.error('خطأ في تحميل النماذج:', error);
    }
  };

  const handleSave = async () => {
    if (!editingTemplate?.name || !editingTemplate?.content) {
      setMessage({ type: 'error', text: '❌ الرجاء ملء جميع الحقول' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await dbManager.addMessageTemplate({
        name: editingTemplate.name,
        content: editingTemplate.content,
        category: editingTemplate.category
      });

      setMessage({ type: 'success', text: '✅ تم حفظ النموذج بنجاح' });
      setIsEditing(false);
      setEditingTemplate(null);
      loadTemplates();
    } catch (error) {
      console.error('خطأ في الحفظ:', error);
      setMessage({ type: 'error', text: '❌ فشل حفظ النموذج' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا النموذج؟')) return;

    try {
      await dbManager.deleteMessageTemplate(id);

      setMessage({ type: 'success', text: '✅ تم حذف النموذج بنجاح' });
      loadTemplates();
    } catch (error) {
      console.error('خطأ في الحذف:', error);
      setMessage({ type: 'error', text: '❌ فشل حذف النموذج' });
    }
  };

  const handleCopyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    setMessage({ type: 'success', text: '✅ تم نسخ النموذج إلى الحافظة' });
    setTimeout(() => setMessage(null), 2000);
  };

  const handleNew = () => {
    setEditingTemplate({
      name: '',
      content: '',
      category: 'غياب'
    });
    setIsEditing(true);
  };

  const handleEdit = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingTemplate(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-10 h-10" />
                <div>
                  <h1 className="text-3xl font-bold">نماذج الرسائل الجاهزة</h1>
                  <p className="text-blue-100 mt-1">إنشاء وإدارة نماذج الرسائل لواتساب</p>
                </div>
              </div>
              {!isEditing && (
                <button
                  onClick={handleNew}
                  className="bg-white text-blue-600 px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-50 transition-all shadow-lg"
                >
                  <Plus className="w-5 h-5" />
                  نموذج جديد
                </button>
              )}
            </div>
          </div>

          <div className="p-6">
            {message && (
              <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
                message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                <span className="font-medium">{message.text}</span>
              </div>
            )}

            {isEditing ? (
              <div className="bg-gray-50 rounded-xl p-6 border-2 border-blue-200">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">
                  {editingTemplate?.id ? 'تعديل النموذج' : 'نموذج جديد'}
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">اسم النموذج</label>
                    <input
                      type="text"
                      value={editingTemplate?.name || ''}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate!, name: e.target.value })}
                      placeholder="مثال: إشعار غياب"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">الفئة</label>
                    <select
                      value={editingTemplate?.category || 'غياب'}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate!, category: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">محتوى الرسالة</label>
                    <div className="mb-2 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <p className="font-semibold mb-1">المتغيرات المتاحة:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <code className="bg-white px-2 py-1 rounded">{'{اسم_التلميذ}'}</code>
                        <code className="bg-white px-2 py-1 rounded">{'{التاريخ}'}</code>
                        <code className="bg-white px-2 py-1 rounded">{'{الحصة}'}</code>
                        <code className="bg-white px-2 py-1 rounded">{'{المادة}'}</code>
                        <code className="bg-white px-2 py-1 rounded">{'{الوقت_من}'}</code>
                        <code className="bg-white px-2 py-1 rounded">{'{الوقت_إلى}'}</code>
                        <code className="bg-white px-2 py-1 rounded">{'{القاعة}'}</code>
                        <code className="bg-white px-2 py-1 rounded">{'{القسم}'}</code>
                      </div>
                    </div>
                    <textarea
                      value={editingTemplate?.content || ''}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate!, content: e.target.value })}
                      placeholder="مثال: #نخبركم أن ابنكم {اسم_التلميذ} تغيب يوم {التاريخ} الحصة: {الحصة} من الساعة {الوقت_من} إلى الساعة {الوقت_إلى} مادة: {المادة} القاعة: {القاعة} عن الإدارة."
                      rows={6}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 font-mono"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleSave}
                      disabled={loading}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-3 px-6 rounded-lg font-bold flex items-center justify-center gap-2 hover:from-blue-700 hover:to-indigo-800 transition-all shadow-lg disabled:opacity-50"
                    >
                      <Save className="w-5 h-5" />
                      {loading ? 'جاري الحفظ...' : 'حفظ النموذج'}
                    </button>
                    <button
                      onClick={handleCancel}
                      className="bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-gray-300 transition-all"
                    >
                      <X className="w-5 h-5" />
                      إلغاء
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.length === 0 ? (
                  <div className="col-span-2 text-center py-12 text-gray-500">
                    <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>لا توجد نماذج رسائل. قم بإنشاء نموذج جديد.</p>
                  </div>
                ) : (
                  templates.map(template => (
                    <div key={template.id} className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-5 border-2 border-gray-200 hover:border-blue-300 transition-all shadow-md">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">{template.name}</h3>
                          <span className="inline-block bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full mt-1">
                            {template.category}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCopyToClipboard(template.content)}
                            className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                            title="نسخ"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(template)}
                            className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                            title="تعديل"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(template.id!)}
                            className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                          {template.content}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
