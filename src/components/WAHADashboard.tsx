import React, { useState, useEffect } from 'react';
import { Server, Plus, Trash2, RefreshCw, QrCode, Check, X, Activity, MessageSquare, Settings, CheckCircle, AlertCircle } from 'lucide-react';
import {ahwService,ahwServer,ahwSession } from '../utils/wahaService';

export constahwDashboard: React.FC = () => {
  const [servers, setServers] = useState<WAHAServer[]>([]);
  const [sessions, setSessions] = useState<{ [serverId: string]:ahwSession[] }>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [showAddServer, setShowAddServer] = useState(false);
  const [newServer, setNewServer] = useState({
    name: '',
    server_url: '',
    api_key: '',
    provider: 'AWS'
  });

  const [showAddSession, setShowAddSession] = useState<string | null>(null);
  const [newSessionName, setNewSessionName] = useState('');

  const [qrCode, setQrCode] = useState<{ sessionId: string; qr: string } | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('مرحباً! هذه رسالة تجريبية منahw 📱');
  const [selectedSession, setSelectedSession] = useState<string>('');

  const [messageStats, setMessageStats] = useState<{ total: number; success: number; failed: number } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const serversData = awaitahwService.getAllServers();
      setServers(serversData);

      const sessionsData: { [serverId: string]:ahwSession[] } = {};
      for (const server of serversData) {
        const serverSessions = awaitahwService.getSessionsByServer(server.id);
        sessionsData[server.id] = serverSessions;
      }
      setSessions(sessionsData);

      const stats = awaitahwService.getMessageStats();
      setMessageStats(stats);
    } catch (error) {
      console.error('خطأ في تحميل البيانات:', error);
      showMessage('error', 'فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleAddServer = async () => {
    if (!newServer.name || !newServer.server_url) {
      showMessage('error', 'الرجاء إدخال اسم الخادم والعنوان');
      return;
    }

    try {
      const serverUrl = newServer.server_url.trim();
      const isConnected = awaitahwService.testServerConnection(serverUrl, newServer.api_key || undefined);

      if (!isConnected) {
        showMessage('error', 'فشل الاتصال بالخادم. تحقق من العنوان');
        return;
      }

      awaitahwService.createServer({
        name: newServer.name.trim(),
        server_url: serverUrl,
        api_key: newServer.api_key.trim() || undefined,
        provider: newServer.provider,
        is_active: true,
        is_default: servers.length === 0
      });

      showMessage('success', 'تم إضافة الخادم بنجاح');
      setShowAddServer(false);
      setNewServer({ name: '', server_url: '', api_key: '', provider: 'AWS' });
      loadData();
    } catch (error) {
      console.error('خطأ في إضافة الخادم:', error);
      showMessage('error', 'فشل في إضافة الخادم');
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الخادم؟ سيتم حذف جميع الجلسات المرتبطة به.')) {
      return;
    }

    try {
      awaitahwService.deleteServer(serverId);
      showMessage('success', 'تم حذف الخادم بنجاح');
      loadData();
    } catch (error) {
      console.error('خطأ في حذف الخادم:', error);
      showMessage('error', 'فشل في حذف الخادم');
    }
  };

  const handleToggleServerStatus = async (serverId: string, currentStatus: boolean) => {
    try {
      awaitahwService.updateServer(serverId, { is_active: !currentStatus });
      showMessage('success', `تم ${!currentStatus ? 'تفعيل' : 'تعطيل'} الخادم`);
      loadData();
    } catch (error) {
      console.error('خطأ في تحديث حالة الخادم:', error);
      showMessage('error', 'فشل في تحديث حالة الخادم');
    }
  };

  const handleSetDefaultServer = async (serverId: string) => {
    try {
      awaitahwService.updateServer(serverId, { is_default: true });
      showMessage('success', 'تم تعيين الخادم كافتراضي');
      loadData();
    } catch (error) {
      console.error('خطأ في تعيين الخادم الافتراضي:', error);
      showMessage('error', 'فشل في تعيين الخادم الافتراضي');
    }
  };

  const handleAddSession = async (serverId: string) => {
    if (!newSessionName.trim()) {
      showMessage('error', 'الرجاء إدخال اسم الجلسة');
      return;
    }

    try {
      const result = awaitahwService.createSession(serverId, newSessionName.trim());
      if (result.success) {
        showMessage('success', 'تم إنشاء الجلسة بنجاح. يمكنك الآن مسح QR Code');
        setShowAddSession(null);
        setNewSessionName('');
        loadData();
      } else {
        showMessage('error', result.error || 'فشل في إنشاء الجلسة');
      }
    } catch (error) {
      console.error('خطأ في إنشاء الجلسة:', error);
      showMessage('error', 'فشل في إنشاء الجلسة');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الجلسة؟')) {
      return;
    }

    try {
      const result = awaitahwService.deleteSession(sessionId);
      if (result.success) {
        showMessage('success', 'تم حذف الجلسة بنجاح');
        loadData();
      } else {
        showMessage('error', result.error || 'فشل في حذف الجلسة');
      }
    } catch (error) {
      console.error('خطأ في حذف الجلسة:', error);
      showMessage('error', 'فشل في حذف الجلسة');
    }
  };

  const handleGetQRCode = async (sessionId: string) => {
    try {
      const result = awaitahwService.getSessionQRCode(sessionId);
      if (result.qrCode) {
        setQrCode({ sessionId, qr: result.qrCode });
      } else {
        showMessage('error', result.error || 'فشل في الحصول على QR Code');
      }
    } catch (error) {
      console.error('خطأ في الحصول على QR Code:', error);
      showMessage('error', 'فشل في الحصول على QR Code');
    }
  };

  const handleCheckStatus = async (sessionId: string) => {
    try {
      const result = awaitahwService.checkSessionStatus(sessionId);
      if (result.status) {
        showMessage('success', `حالة الجلسة: ${result.status === 'connected' ? 'متصلة' : result.status === 'qr_needed' ? 'تحتاج QR' : 'غير متصلة'}`);
        loadData();
      } else {
        showMessage('error', result.error || 'فشل في التحقق من الحالة');
      }
    } catch (error) {
      console.error('خطأ في التحقق من الحالة:', error);
      showMessage('error', 'فشل في التحقق من الحالة');
    }
  };

  const handleRestartSession = async (sessionId: string) => {
    try {
      const result = awaitahwService.restartSession(sessionId);
      if (result.success) {
        showMessage('success', 'تم إعادة تشغيل الجلسة');
        loadData();
      } else {
        showMessage('error', result.error || 'فشل في إعادة التشغيل');
      }
    } catch (error) {
      console.error('خطأ في إعادة التشغيل:', error);
      showMessage('error', 'فشل في إعادة التشغيل');
    }
  };

  const handleTestMessage = async () => {
    if (!testPhone.trim() || !selectedSession) {
      showMessage('error', 'الرجاء اختيار جلسة وإدخال رقم الهاتف');
      return;
    }

    try {
      const { sendWhatsAppMessage } = await import('../utils/whatsappService');
      const result = await sendWhatsAppMessage(testPhone, testMessage);

      if (result.success) {
        showMessage('success', 'تم إرسال الرسالة بنجاح');
        loadData();
      } else {
        showMessage('error', result.message);
      }
    } catch (error) {
      console.error('خطأ في إرسال الرسالة:', error);
      showMessage('error', 'فشل في إرسال الرسالة');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold flex items-center gap-1"><Check className="w-4 h-4" /> متصل</span>;
      case 'qr_needed':
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-semibold flex items-center gap-1"><QrCode className="w-4 h-4" /> يحتاج QR</span>;
      default:
        return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold flex items-center gap-1"><X className="w-4 h-4" /> غير متصل</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل لوحةahw...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Server className="w-10 h-10" />
                <div>
                  <h1 className="text-3xl font-bold">لوحة تحكمahw</h1>
                  <p className="text-blue-100 mt-1">إدارة خوادم وجلسات WhatsApp</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddServer(true)}
                className="bg-white text-blue-600 px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-50 transition-all shadow-lg"
              >
                <Plus className="w-5 h-5" />
                إضافة خادم
              </button>
            </div>
          </div>

          {message && (
            <div className={`p-4 flex items-center gap-3 ${
              message.type === 'success' ? 'bg-green-50 text-green-800 border-b border-green-200' : 'bg-red-50 text-red-800 border-b border-red-200'
            }`}>
              {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span className="font-medium">{message.text}</span>
            </div>
          )}

          {messageStats && (
            <div className="p-6 border-b bg-gradient-to-r from-green-50 to-blue-50">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                إحصائيات الرسائل
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg shadow">
                  <div className="text-2xl font-bold text-gray-800">{messageStats.total}</div>
                  <div className="text-sm text-gray-600">إجمالي الرسائل</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                  <div className="text-2xl font-bold text-green-600">{messageStats.success}</div>
                  <div className="text-sm text-gray-600">تم الإرسال</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                  <div className="text-2xl font-bold text-red-600">{messageStats.failed}</div>
                  <div className="text-sm text-gray-600">فشل الإرسال</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {showAddServer && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl">
              <h2 className="text-2xl font-bold mb-6 text-gray-800">إضافة خادمahw جديد</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">اسم الخادم</label>
                  <input
                    type="text"
                    value={newServer.name}
                    onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                    placeholder="مثال: خادم AWS الرئيسي"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">عنوان الخادم</label>
                  <input
                    type="text"
                    value={newServer.server_url}
                    onChange={(e) => setNewServer({ ...newServer, server_url: e.target.value })}
                    placeholder="مثال: http://51.21.197.126:3000"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">API Key (اختياري)</label>
                  <input
                    type="password"
                    value={newServer.api_key}
                    onChange={(e) => setNewServer({ ...newServer, api_key: e.target.value })}
                    placeholder="••••••••••••"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">المزود</label>
                  <select
                    value={newServer.provider}
                    onChange={(e) => setNewServer({ ...newServer, provider: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="AWS">AWS</option>
                    <option value="Oracle Cloud">Oracle Cloud</option>
                    <option value="Azure">Azure</option>
                    <option value="Google Cloud">Google Cloud</option>
                    <option value="Other">أخرى</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleAddServer}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-all"
                >
                  إضافة
                </button>
                <button
                  onClick={() => setShowAddServer(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-300 transition-all"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {qrCode && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
              <h2 className="text-2xl font-bold mb-4 text-gray-800 text-center">مسح QR Code</h2>
              <p className="text-gray-600 mb-6 text-center">افتح واتساب واختر ربط جهاز</p>
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <img src={qrCode.qr} alt="QR Code" className="w-full" />
              </div>
              <button
                onClick={() => setQrCode(null)}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-all"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {servers.map((server) => (
            <div key={server.id} className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className={`p-6 ${server.is_active ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-gray-400'}`}>
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center gap-4">
                    <Server className="w-8 h-8" />
                    <div>
                      <h3 className="text-xl font-bold">{server.name}</h3>
                      <p className="text-sm opacity-90" dir="ltr">{server.server_url}</p>
                      <p className="text-xs opacity-75 mt-1">المزود: {server.provider}</p>
                    </div>
                    {server.is_default && (
                      <span className="px-3 py-1 bg-white bg-opacity-20 rounded-full text-xs font-bold">افتراضي</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleServerStatus(server.id, server.is_active)}
                      className={`p-2 rounded-lg ${server.is_active ? 'bg-white bg-opacity-20 hover:bg-opacity-30' : 'bg-green-500 hover:bg-green-600'} transition-all`}
                      title={server.is_active ? 'تعطيل' : 'تفعيل'}
                    >
                      {server.is_active ? <X className="w-5 h-5" /> : <Check className="w-5 h-5" />}
                    </button>
                    {!server.is_default && (
                      <button
                        onClick={() => handleSetDefaultServer(server.id)}
                        className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-all"
                        title="تعيين كافتراضي"
                      >
                        <Settings className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteServer(server.id)}
                      className="p-2 bg-red-500 hover:bg-red-600 rounded-lg transition-all"
                      title="حذف"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-bold text-gray-800">الجلسات النشطة</h4>
                  <button
                    onClick={() => setShowAddSession(server.id)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    جلسة جديدة
                  </button>
                </div>

                {showAddSession === server.id && (
                  <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newSessionName}
                        onChange={(e) => setNewSessionName(e.target.value)}
                        placeholder="اسم الجلسة (مثال: مؤسسة-1)"
                        className="flex-1 px-4 py-2 border-2 border-blue-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      />
                      <button
                        onClick={() => handleAddSession(server.id)}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700"
                      >
                        إنشاء
                      </button>
                      <button
                        onClick={() => setShowAddSession(null)}
                        className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-300"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                )}

                {sessions[server.id] && sessions[server.id].length > 0 ? (
                  <div className="grid gap-4">
                    {sessions[server.id].map((session) => (
                      <div key={session.id} className="border-2 border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-all">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <MessageSquare className="w-6 h-6 text-blue-600" />
                            <div>
                              <h5 className="font-bold text-gray-800">{session.session_name}</h5>
                              {session.phone_number && (
                                <p className="text-sm text-gray-600" dir="ltr">{session.phone_number}</p>
                              )}
                            </div>
                          </div>
                          {getStatusBadge(session.status)}
                        </div>

                        <div className="flex gap-2 flex-wrap">
                          {session.status !== 'connected' && (
                            <button
                              onClick={() => handleGetQRCode(session.id)}
                              className="flex-1 bg-yellow-500 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-yellow-600 transition-all"
                            >
                              <QrCode className="w-4 h-4" />
                              QR Code
                            </button>
                          )}
                          <button
                            onClick={() => handleCheckStatus(session.id)}
                            className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-blue-600 transition-all"
                          >
                            <Activity className="w-4 h-4" />
                            تحديث الحالة
                          </button>
                          <button
                            onClick={() => handleRestartSession(session.id)}
                            className="flex-1 bg-orange-500 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-orange-600 transition-all"
                          >
                            <RefreshCw className="w-4 h-4" />
                            إعادة تشغيل
                          </button>
                          <button
                            onClick={() => handleDeleteSession(session.id)}
                            className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-red-600 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">لا توجد جلسات. قم بإنشاء جلسة جديدة</p>
                )}
              </div>
            </div>
          ))}

          {servers.length === 0 && (
            <div className="text-center py-12">
              <Server className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">لا توجد خوادم. ابدأ بإضافة خادمahw</p>
            </div>
          )}
        </div>

        {sessions && Object.values(sessions).flat().some(s => s.status === 'connected') && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mt-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-blue-600" />
              اختبار إرسال رسالة
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">اختر الجلسة</label>
                <select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">-- اختر جلسة --</option>
                  {Object.values(sessions).flat().filter(s => s.status === 'connected').map(session => (
                    <option key={session.id} value={session.id}>
                      {session.session_name} ({session.phone_number})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">رقم الهاتف</label>
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="مثال: 212612345678"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">الرسالة</label>
                <textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <button
                onClick={handleTestMessage}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-green-700 transition-all shadow-lg"
              >
                <MessageSquare className="w-5 h-5" />
                إرسال رسالة تجريبية
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
