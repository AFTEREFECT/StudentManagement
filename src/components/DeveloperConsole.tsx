import React, { useState, useEffect } from 'react';
import { Terminal, Database, Download, Upload, Trash2, Search, Table, AlertCircle, CheckCircle, Code, Eye, Copy, RefreshCw, FileJson, Save } from 'lucide-react';
import { dbManager } from '../utils/database';

interface QueryResult {
  columns: string[];
  rows: any[];
  rowCount: number;
  executionTime: number;
}

const DeveloperConsole: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'query' | 'tables' | 'storage' | 'import-export'>('query');
  const [sqlQuery, setSqlQuery] = useState('');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState('');
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [tableData, setTableData] = useState<any>(null);
  const [storageData, setStorageData] = useState<any>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTables();
    loadStorageData();
  }, []);

  const loadTables = async () => {
    try {
      const tableNames = await dbManager.getAllTables();
      setTables(tableNames);
    } catch (err) {
      console.error('خطأ في تحميل الجداول:', err);
    }
  };

  const loadStorageData = () => {
    const data: any = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        try {
          data[key] = JSON.parse(localStorage.getItem(key) || '');
        } catch {
          data[key] = localStorage.getItem(key);
        }
      }
    }
    setStorageData(data);
  };

  const executeQuery = async () => {
    if (!sqlQuery.trim()) {
      setError('الرجاء إدخال استعلام SQL');
      return;
    }

    setLoading(true);
    setError('');
    setQueryResult(null);

    try {
      const startTime = performance.now();
      const result = await dbManager.executeRawQuery(sqlQuery);
      const endTime = performance.now();

      if (Array.isArray(result) && result.length > 0) {
        const columns = Object.keys(result[0]);
        setQueryResult({
          columns,
          rows: result,
          rowCount: result.length,
          executionTime: endTime - startTime
        });
      } else {
        setQueryResult({
          columns: [],
          rows: [],
          rowCount: 0,
          executionTime: endTime - startTime
        });
        setError('تم تنفيذ الاستعلام بنجاح (لا توجد نتائج)');
      }
    } catch (err: any) {
      setError(`خطأ في تنفيذ الاستعلام: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadTableData = async (tableName: string) => {
    setLoading(true);
    try {
      const result = await dbManager.executeRawQuery(`SELECT * FROM ${tableName} LIMIT 100`);
      setTableData({
        name: tableName,
        columns: result.length > 0 ? Object.keys(result[0]) : [],
        rows: result,
        count: result.length
      });
      setSelectedTable(tableName);
    } catch (err: any) {
      setError(`خطأ في تحميل بيانات الجدول: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const exportDatabase = async () => {
    try {
      const data = await dbManager.exportDatabaseToJSON();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `database-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(`خطأ في التصدير: ${err.message}`);
    }
  };

  const importDatabase = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      await dbManager.importDatabaseFromJSON(text);
      alert('✅ تم استيراد قاعدة البيانات بنجاح');
      loadTables();
    } catch (err: any) {
      setError(`خطأ في الاستيراد: ${err.message}`);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const commonQueries = [
    { label: 'عرض التلاميذ مع الرقم الترتيبي', query: 'SELECT studentId AS "ر ت", firstName AS "الاسم", lastName AS "النسب", section AS "القسم", nationalId AS "رمز المسار" FROM students ORDER BY CAST(studentId AS INTEGER) LIMIT 50' },
    { label: 'التلاميذ بدون رقم ترتيبي', query: 'SELECT id, firstName, lastName, section, studentId FROM students WHERE studentId IS NULL OR studentId = "" OR studentId = "NaN"' },
    { label: 'عدد التلاميذ لكل مستوى', query: 'SELECT level, COUNT(*) as count FROM students GROUP BY level' },
    { label: 'إعدادات المؤسسة', query: 'SELECT institution AS "المؤسسة", directorate AS "المديرية", academy AS "الأكاديمية", municipality AS "الجماعة", academicYear AS "السنة" FROM institution_settings ORDER BY updatedAt DESC LIMIT 1' },
    { label: 'جميع المستويات', query: 'SELECT * FROM levels ORDER BY code' },
    { label: 'جميع الأقسام', query: 'SELECT * FROM sections' },
    { label: 'التلاميذ الوافدين', query: 'SELECT * FROM incoming_students ORDER BY requestDate DESC LIMIT 20' },
    { label: 'التلاميذ المغادرين', query: 'SELECT * FROM outgoing_students ORDER BY requestDate DESC LIMIT 20' }
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-lg shadow-xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <Terminal className="w-8 h-8" />
          <h1 className="text-3xl font-bold">وحدة تحكم المطور</h1>
        </div>
        <p className="text-slate-300">إدارة شاملة لقاعدة البيانات والتخزين المحلي</p>
      </div>

      <div className="flex gap-2 bg-white rounded-lg p-2 shadow">
        <button
          onClick={() => setActiveTab('query')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            activeTab === 'query' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          <Code className="w-5 h-5" />
          استعلامات SQL
        </button>
        <button
          onClick={() => setActiveTab('tables')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            activeTab === 'tables' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          <Table className="w-5 h-5" />
          الجداول
        </button>
        <button
          onClick={() => setActiveTab('storage')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            activeTab === 'storage' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          <Database className="w-5 h-5" />
          التخزين المحلي
        </button>
        <button
          onClick={() => setActiveTab('import-export')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            activeTab === 'import-export' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          <FileJson className="w-5 h-5" />
          استيراد/تصدير
        </button>
      </div>

      {activeTab === 'query' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Code className="w-6 h-6" />
              محرر SQL
            </h2>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">استعلامات جاهزة:</label>
              <div className="flex flex-wrap gap-2">
                {commonQueries.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSqlQuery(q.query)}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              placeholder="أدخل استعلام SQL هنا..."
              className="w-full h-32 p-3 border rounded-lg font-mono text-sm"
              dir="ltr"
            />

            <div className="flex gap-2 mt-4">
              <button
                onClick={executeQuery}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
              >
                <Terminal className="w-5 h-5" />
                {loading ? 'جاري التنفيذ...' : 'تنفيذ'}
              </button>
              <button
                onClick={() => setSqlQuery('')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                <Trash2 className="w-5 h-5" />
                مسح
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-red-700">{error}</div>
            </div>
          )}

          {queryResult && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  النتائج
                </h3>
                <div className="text-sm text-gray-600">
                  {queryResult.rowCount} صف | {queryResult.executionTime.toFixed(2)} ms
                </div>
              </div>

              {queryResult.rows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        {queryResult.columns.map((col) => (
                          <th key={col} className="px-4 py-2 text-right font-medium">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queryResult.rows.map((row, idx) => (
                        <tr key={idx} className="border-t hover:bg-gray-50">
                          {queryResult.columns.map((col) => (
                            <td key={col} className="px-4 py-2">
                              {String(row[col] || '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">لا توجد نتائج</p>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'tables' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Table className="w-6 h-6" />
              الجداول ({tables.length})
            </h2>
            <div className="space-y-2">
              {tables.map((table) => (
                <button
                  key={table}
                  onClick={() => loadTableData(table)}
                  className={`w-full text-right px-4 py-2 rounded-lg transition-all ${
                    selectedTable === table
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {table}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-lg shadow-lg p-6">
            {tableData ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">{tableData.name}</h3>
                  <div className="text-sm text-gray-600">{tableData.count} صف</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        {tableData.columns.map((col: string) => (
                          <th key={col} className="px-4 py-2 text-right font-medium">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.rows.map((row: any, idx: number) => (
                        <tr key={idx} className="border-t hover:bg-gray-50">
                          {tableData.columns.map((col: string) => (
                            <td key={col} className="px-4 py-2">
                              {String(row[col] || '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-center py-12">اختر جدولاً لعرض بياناته</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'storage' && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Database className="w-6 h-6" />
              التخزين المحلي
            </h2>
            <button
              onClick={loadStorageData}
              className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              <RefreshCw className="w-4 h-4" />
              تحديث
            </button>
          </div>

          <div className="space-y-4">
            {Object.entries(storageData).map(([key, value]) => (
              <div key={key} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-blue-600">{key}</h3>
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(value, null, 2))}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto" dir="ltr">
                  {JSON.stringify(value, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'import-export' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Download className="w-6 h-6" />
              تصدير قاعدة البيانات
            </h2>
            <p className="text-gray-600 mb-4">
              تصدير قاعدة البيانات بالكامل إلى ملف JSON للنسخ الاحتياطي
            </p>
            <button
              onClick={exportDatabase}
              className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              <Download className="w-5 h-5" />
              تصدير الآن
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Upload className="w-6 h-6" />
              استيراد قاعدة البيانات
            </h2>
            <p className="text-gray-600 mb-4">
              استيراد قاعدة بيانات من ملف JSON (سيتم استبدال البيانات الحالية)
            </p>
            <input
              type="file"
              accept=".json"
              onChange={importDatabase}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DeveloperConsole;
