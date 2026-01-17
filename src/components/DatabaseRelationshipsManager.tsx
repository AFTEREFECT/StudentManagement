import React, { useState, useEffect } from 'react';
import { Link2, Plus, Trash2, Edit, Save, X, Database, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '../utils/supabase';

interface Relationship {
  id: string;
  name: string;
  source_table: string;
  source_column: string;
  target_table: string;
  target_column: string;
  relationship_type: string;
  on_delete: string;
  on_update: string;
  is_active: boolean;
  description: string;
  created_at: string;
  updated_at: string;
}

interface Table {
  name: string;
  schema: string;
}

const DatabaseRelationshipsManager: React.FC = () => {
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    source_table: '',
    source_column: '',
    target_table: '',
    target_column: '',
    relationship_type: 'many-to-one',
    on_delete: 'CASCADE',
    on_update: 'CASCADE',
    is_active: true,
    description: ''
  });

  useEffect(() => {
    loadRelationships();
    loadTables();
  }, []);

  const loadRelationships = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('database_relationships')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRelationships(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadTables = async () => {
    try {
      const { data, error } = await supabase
        .from('information_schema.tables')
        .select('table_name, table_schema')
        .eq('table_schema', 'public');

      if (error) {
        const defaultTables = [
          'students', 'levels', 'sections', 'quiz_templates', 'quiz_results',
          'credentials', 'guidance_data', 'council_decisions', 'incoming_students',
          'outgoing_students', 'dismissed_students', 'unenrolled_students',
          'schedules', 'teachers', 'absences', 'permit_tickets',
          'notifications_log', 'whatsapp_settings', 'message_templates'
        ].map(name => ({ name, schema: 'public' }));
        setTables(defaultTables);
      } else {
        setTables(data?.map(t => ({ name: t.table_name, schema: t.table_schema })) || []);
      }
    } catch (err) {
      console.error('Error loading tables:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (editingId) {
        const { error } = await supabase
          .from('database_relationships')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId);

        if (error) throw error;
        setSuccess('تم تحديث العلاقة بنجاح');
      } else {
        const { error } = await supabase
          .from('database_relationships')
          .insert([formData]);

        if (error) throw error;
        setSuccess('تم إضافة العلاقة بنجاح');
      }

      resetForm();
      loadRelationships();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (relationship: Relationship) => {
    setFormData({
      name: relationship.name,
      source_table: relationship.source_table,
      source_column: relationship.source_column,
      target_table: relationship.target_table,
      target_column: relationship.target_column,
      relationship_type: relationship.relationship_type,
      on_delete: relationship.on_delete,
      on_update: relationship.on_update,
      is_active: relationship.is_active,
      description: relationship.description
    });
    setEditingId(relationship.id);
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه العلاقة؟')) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('database_relationships')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setSuccess('تم حذف العلاقة بنجاح');
      loadRelationships();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('database_relationships')
        .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      loadRelationships();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      source_table: '',
      source_column: '',
      target_table: '',
      target_column: '',
      relationship_type: 'many-to-one',
      on_delete: 'CASCADE',
      on_update: 'CASCADE',
      is_active: true,
      description: ''
    });
    setEditingId(null);
    setShowAddForm(false);
  };

  const getRelationshipIcon = (type: string) => {
    switch (type) {
      case 'one-to-one': return '1:1';
      case 'one-to-many': return '1:N';
      case 'many-to-one': return 'N:1';
      case 'many-to-many': return 'N:N';
      default: return '?';
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Database className="w-8 h-8 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">إدارة علاقات قاعدة البيانات</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadRelationships}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <RefreshCw className="w-4 h-4" />
            تحديث
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            إضافة علاقة جديدة
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <AlertCircle className="w-5 h-5" />
          {success}
        </div>
      )}

      {showAddForm && (
        <div className="mb-6 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingId ? 'تعديل العلاقة' : 'إضافة علاقة جديدة'}
            </h3>
            <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  اسم العلاقة *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="مثال: Students to Levels"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  نوع العلاقة *
                </label>
                <select
                  value={formData.relationship_type}
                  onChange={(e) => setFormData({ ...formData, relationship_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="one-to-one">One-to-One (1:1)</option>
                  <option value="one-to-many">One-to-Many (1:N)</option>
                  <option value="many-to-one">Many-to-One (N:1)</option>
                  <option value="many-to-many">Many-to-Many (N:N)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  الجدول المصدر *
                </label>
                <select
                  value={formData.source_table}
                  onChange={(e) => setFormData({ ...formData, source_table: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">اختر الجدول المصدر</option>
                  {tables.map(table => (
                    <option key={table.name} value={table.name}>{table.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  العمود المصدر *
                </label>
                <input
                  type="text"
                  value={formData.source_column}
                  onChange={(e) => setFormData({ ...formData, source_column: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="مثال: level_id"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  الجدول الهدف *
                </label>
                <select
                  value={formData.target_table}
                  onChange={(e) => setFormData({ ...formData, target_table: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">اختر الجدول الهدف</option>
                  {tables.map(table => (
                    <option key={table.name} value={table.name}>{table.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  العمود الهدف *
                </label>
                <input
                  type="text"
                  value={formData.target_column}
                  onChange={(e) => setFormData({ ...formData, target_column: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="مثال: level_id"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  سلوك الحذف
                </label>
                <select
                  value={formData.on_delete}
                  onChange={(e) => setFormData({ ...formData, on_delete: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="CASCADE">CASCADE</option>
                  <option value="SET NULL">SET NULL</option>
                  <option value="RESTRICT">RESTRICT</option>
                  <option value="NO ACTION">NO ACTION</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  سلوك التحديث
                </label>
                <select
                  value={formData.on_update}
                  onChange={(e) => setFormData({ ...formData, on_update: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="CASCADE">CASCADE</option>
                  <option value="SET NULL">SET NULL</option>
                  <option value="RESTRICT">RESTRICT</option>
                  <option value="NO ACTION">NO ACTION</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                الوصف
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="وصف العلاقة..."
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                العلاقة نشطة
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {editingId ? 'تحديث' : 'حفظ'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border">اسم العلاقة</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border">النوع</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border">من</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border">إلى</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border">الوصف</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border">الحالة</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading && relationships.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  جاري التحميل...
                </td>
              </tr>
            ) : relationships.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  لا توجد علاقات محفوظة
                </td>
              </tr>
            ) : (
              relationships.map((rel) => (
                <tr key={rel.id} className={`hover:bg-gray-50 ${!rel.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 border">
                    <div className="flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-blue-600" />
                      <span className="font-medium">{rel.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 border">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      {getRelationshipIcon(rel.relationship_type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 border">
                    <div className="text-sm">
                      <div className="font-medium">{rel.source_table}</div>
                      <div className="text-gray-500 text-xs">{rel.source_column}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 border">
                    <div className="text-sm">
                      <div className="font-medium">{rel.target_table}</div>
                      <div className="text-gray-500 text-xs">{rel.target_column}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 border text-sm text-gray-600">{rel.description}</td>
                  <td className="px-4 py-3 border">
                    <button
                      onClick={() => toggleActive(rel.id, rel.is_active)}
                      className={`px-2 py-1 rounded text-xs ${
                        rel.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {rel.is_active ? 'نشط' : 'غير نشط'}
                    </button>
                  </td>
                  <td className="px-4 py-3 border">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(rel)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="تعديل"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(rel.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-gray-900 mb-2">ملاحظات هامة:</h3>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>• العلاقات المحفوظة هنا للتوثيق والإدارة فقط</li>
          <li>• لتطبيق القيود (Foreign Keys) الفعلية، يجب إنشاء Migration في Supabase</li>
          <li>• CASCADE: حذف/تحديث السجلات المرتبطة تلقائياً</li>
          <li>• SET NULL: تعيين القيمة إلى NULL عند الحذف/التحديث</li>
          <li>• RESTRICT: منع الحذف/التحديث إذا وجدت سجلات مرتبطة</li>
        </ul>
      </div>
    </div>
  );
};

export default DatabaseRelationshipsManager;
