import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, QrCode, CheckCircle, XCircle,
  RefreshCw, AlertCircle, LogIn, Loader2, Trash2
} from 'lucide-react';
import { waakuService, WaakuSessionStatus, Institution } from '../utils/waakuService';
import { supabase } from '../utils/supabaseClient';

export const WaakuWhatsAppConnection: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [grezaInput, setGrezaInput] = useState('');
  const [session, setSession] = useState<WaakuSessionStatus | null>(null);
  const [qrCode, setQrCode] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('مرحباً! هذه رسالة تجريبية من نظام PROGTALAMID 📚');
  const [isSending, setIsSending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isLoadingQr, setIsLoadingQr] = useState(false);
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const qrMonitoringIntervalRef = useRef<NodeJS.Timeout | null>(null);



    // Initial boot
  useEffect(() => {
    const storedGreza = localStorage.getItem('greza');
    const storedInstitutionId = localStorage.getItem('institutionId');
    
    console.log('🔄 Loading from localStorage:', { storedGreza, storedInstitutionId });
    
    if (storedGreza && storedInstitutionId) {
      loadInstitutionById(storedInstitutionId, storedGreza);
    } else if (storedGreza) {
      handleGrezaConfirm(storedGreza);
    } else {
      setLoading(false);
    }
  }, []);

  // Realtime Subscription
  useEffect(() => {
    if (!institution?.id) return;

    console.log('🔗 Subscribing to Realtime for institution:', institution.id);

    const channel = supabase
      .channel(`institution-${institution.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'institutions',
          filter: `id=eq.${institution.id}`,
        },
        (payload: any) => {
          console.log('🔄 Realtime Update Received:', payload);
          
          const newStatus = payload.new?.whatsapp_session_status;
          const newSessionId = payload.new?.whatsapp_session_id;

          if (newStatus) {
            if (session?.status === 'CONNECTED' && newStatus !== 'CONNECTED') {
              console.log('⚠️ Ignoring Realtime update from CONNECTED to', newStatus);
              return;
            }
            
            setSession((prev) => ({
              ...prev,
              status: newStatus,
              sessionId: newSessionId || prev?.sessionId || null,
              phoneNumber: payload.new?.whatsapp_phone_number || prev?.phoneNumber || null,
            }));

            if (newStatus === 'CONNECTED') {
              setQrCode('');
              showMessage('success', 'تم الاتصال بنجاح! ✅');
              
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }
              if (qrMonitoringIntervalRef.current) {
                clearInterval(qrMonitoringIntervalRef.current);
                qrMonitoringIntervalRef.current = null;
              }
              console.log('🛑 All monitoring stopped via Realtime');
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔌 Unsubscribing from Realtime');
      supabase.removeChannel(channel);
    };
  }, [institution?.id, session?.status]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (qrMonitoringIntervalRef.current) {
        clearInterval(qrMonitoringIntervalRef.current);
        qrMonitoringIntervalRef.current = null;
      }
    };
  }, []);




    const showMessage = (type: 'success' | 'error' | 'info', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 6000);
  };

  const getStatusIcon = () => {
    if (!session) return <XCircle className="w-6 h-6 text-red-600" />;
    switch (session.status) {
      case 'CONNECTED': return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'SCANNING': return <RefreshCw className="w-6 h-6 text-yellow-600 animate-spin" />;
      default: return <XCircle className="w-6 h-6 text-red-600" />;
    }
  };

  const getStatusText = () => {
    if (!session) return 'غير متصل';
    if (session.status === 'CONNECTED') return `متصل - ${session.phoneNumber || ''}`;
    if (session.status === 'SCANNING') return 'في انتظار المسح';
    return 'غير متصل';
  };

  const getStatusColor = () => {
    if (!session) return 'text-red-600';
    switch (session.status) {
      case 'CONNECTED': return 'text-green-600';
      case 'SCANNING': return 'text-yellow-600';
      default: return 'text-red-600';
    }
  };




    const loadInstitutionById = async (id: string, greza: string) => {
    setLoading(true);
    try {
      console.log('🔍 Loading institution by ID:', id);
      
      const { data, error } = await supabase
        .from('institutions')
        .select('id, name, greza')
        .eq('id', id)
        .single();
      
      if (error || !data) {
        console.error('❌ Institution not found by ID:', error);
        await handleGrezaConfirm(greza);
        return;
      }
      
      console.log('✅ Institution loaded:', data);
      setInstitution(data as Institution);
      setSession(null);
      setQrCode('');
      
      await checkSessionStatus(data.id, false);
      
      showMessage('success', `تم تحميل المؤسسة ${data.name}`);
    } catch (e: any) {
      console.error('❌ Error loading institution:', e);
      showMessage('error', 'حدث خطأ في تحميل المؤسسة');
      localStorage.removeItem('greza');
      localStorage.removeItem('institutionId');
      setInstitution(null);
      setSession(null);
      setQrCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleGrezaConfirm = async (greza: string) => {
    const cleanGreza = greza.trim().toUpperCase();
    if (!cleanGreza) return;
    
    setIsProcessing(true);
    setLoading(true);
    
    try {
      console.log('🔍 Confirming GREZA:', cleanGreza);
      
      const inst = await waakuService.ensureInstitutionByGreza(cleanGreza);
      
      localStorage.setItem('greza', inst.greza);
      localStorage.setItem('institutionId', inst.id);
      
      console.log('✅ Saved to localStorage:', { greza: inst.greza, id: inst.id });
      
      setInstitution(inst);
      setSession(null);
      setQrCode('');
      
      await checkSessionStatus(inst.id, false);
      
      showMessage('success', `تم ربط المؤسسة ${inst.name}`);
    } catch (e: any) {
      console.error('❌ Error in handleGrezaConfirm:', e);
      showMessage('error', e?.message || 'حدث خطأ!');
      localStorage.removeItem('greza');
      localStorage.removeItem('institutionId');
      setInstitution(null);
      setSession(null);
      setQrCode('');
    } finally {
      setIsProcessing(false);
      setLoading(false);
    }
  };

  const handleLogout = () => {
    console.log('🚪 Logging out...');
    localStorage.removeItem('greza');
    localStorage.removeItem('institutionId');
    setInstitution(null);
    setGrezaInput('');
    setSession(null);
    setQrCode('');
    setMessage(null);
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (qrMonitoringIntervalRef.current) {
      clearInterval(qrMonitoringIntervalRef.current);
      qrMonitoringIntervalRef.current = null;
    }
  };

  const updateSessionStatusInDB = async (status: 'CONNECTED' | 'SCANNING' | 'DISCONNECTED', sessionId?: string | null) => {
    if (!institution?.id) return;
    
    try {
      console.log(`💾 Updating DB: ${status}, sessionId: ${sessionId || 'null'}`);
      
      const updateData: any = {
        whatsapp_session_status: status,
        whatsapp_last_checked: new Date().toISOString()
      };
      
      if (sessionId) {
        updateData.whatsapp_session_id = sessionId;
      }
      
      if (status === 'DISCONNECTED') {
        updateData.whatsapp_session_id = null;
        updateData.whatsapp_phone_number = null;
      }
      
      const { error } = await supabase
        .from('institutions')
        .update(updateData)
        .eq('id', institution.id);
      
      if (error) {
        console.error('❌ Error updating DB:', error);
      } else {
        console.log('✅ DB updated successfully:', status, sessionId);
      }
    } catch (e) {
      console.error('❌ Exception updating DB:', e);
    }
  };



  const checkSessionStatus = async (instId?: string, silent = false) => {
    const id = instId || institution?.id;
    
    if (!id) {
      console.error('❌ [checkSessionStatus] No institution ID');
      if (!silent) showMessage('error', 'لا توجد مؤسسة محددة');
      return;
    }
    
    if (session?.status === 'CONNECTED' && silent) {
      console.log('✅ Session is CONNECTED - skipping status check');
      return;
    }
    
    if (!silent) {
      setIsChecking(true);
      console.log('🔄 [checkSessionStatus] Checking status for:', id);
    }
    
    try {
      const { data: inst } = await supabase
        .from('institutions')
        .select('whatsapp_session_id, greza')
        .eq('id', id)
        .single();
      
      const sessionId = inst?.whatsapp_session_id || inst?.greza;
      
      if (!sessionId) {
        console.log('❌ No sessionId found');
        setSession({ status: 'DISCONNECTED', sessionId: null });
        setQrCode('');
        await updateSessionStatusInDB('DISCONNECTED');
        if (!silent) showMessage('info', '❌ لا توجد جلسة. اضغط "إنشاء جلسة جديدة".');
        return;
      }
      
      console.log('🔍 Checking session on Waaku:', sessionId);
      
      const qrRes = await waakuService.getQrCode(sessionId);
      
      console.log('📊 QR Response:', qrRes);
      
      if (qrRes.qr) {
        console.log('⚠️ Session exists but QR is available - Session stuck in SCANNING');
        
        setSession({
          status: 'SCANNING',
          sessionId,
          phoneNumber: null
        });
        
        setQrCode('');
        
        await updateSessionStatusInDB('SCANNING', sessionId);
        
        if (!silent) {
          showMessage('error', '⚠️ الجلسة في حالة معلقة. يرجى حذف الجلسة وإعادة إنشائها.');
        }
        
      } else if (qrRes.notFound || (qrRes.error && qrRes.error.includes('not found'))) {
        console.log('❌ Session does NOT exist on server');
        
        setSession({ status: 'DISCONNECTED', sessionId: null });
        setQrCode('');
        
        await updateSessionStatusInDB('DISCONNECTED');
        
        if (!silent) {
          showMessage('info', '❌ لا توجد جلسة على الخادم. اضغط "إنشاء جلسة جديدة".');
        }
        
      } else if (qrRes.error && qrRes.error.includes('Session connected')) {
        console.log('✅ Session exists and is CONNECTED (no QR available)');
        
        try {
          const statusData = await waakuService.checkStatus(id);
          
          setSession({
            status: 'CONNECTED',
            sessionId,
            phoneNumber: statusData.phoneNumber || null
          });
          
          setQrCode('');
          
          await updateSessionStatusInDB('CONNECTED', sessionId);
          
          if (statusData.phoneNumber) {
            await supabase
              .from('institutions')
              .update({ whatsapp_phone_number: statusData.phoneNumber })
              .eq('id', id);
          }
          
          if (!silent) {
            const phoneDisplay = statusData.phoneNumber 
              ? ` - رقم الهاتف: ${statusData.phoneNumber}` 
              : '';
            showMessage('success', `✅ الجلسة متصلة بنجاح!${phoneDisplay}`);
          }
        } catch (e) {
          setSession({
            status: 'CONNECTED',
            sessionId,
            phoneNumber: null
          });
          
          setQrCode('');
          await updateSessionStatusInDB('CONNECTED', sessionId);
          
          if (!silent) {
            showMessage('success', '✅ الجلسة متصلة بنجاح!');
          }
        }
        
      } else {
        console.log('❌ Session not found on Waaku server');
        
        setSession({ status: 'DISCONNECTED', sessionId: null });
        setQrCode('');
        
        await updateSessionStatusInDB('DISCONNECTED');
        
        if (!silent) {
          showMessage('info', '❌ لا توجد جلسة نشطة. اضغط "إنشاء جلسة جديدة".');
        }
      }
      
    } catch (e: any) {
      console.error('❌ [checkSessionStatus] Error:', e);
      
      if (session?.status === 'CONNECTED') {
        console.log('⚠️ Error occurred but session is CONNECTED - maintaining status');
        if (!silent) {
          showMessage('info', 'حدث خطأ لكن الجلسة لا تزال متصلة.');
        }
        return;
      }
      
      setSession({ status: 'DISCONNECTED', sessionId: null });
      setQrCode('');
      
      if (!silent) {
        showMessage('error', `خطأ في الاتصال بالخادم: ${e.message || 'غير معروف'}`);
      }
    } finally {
      if (!silent) {
        setIsChecking(false);
        console.log('🏁 [checkSessionStatus] Check completed');
      }
    }
  };




    const handleCreateSession = async () => {
    if (!institution) return;
    setIsProcessing(true);
    setQrCode('');
    
    try {
      showMessage('info', 'جاري إنشاء جلسة جديدة...');
      
      const result = await waakuService.startSession(institution.id);
      
      if (!result.success || !result.sessionId) {
        showMessage('error', result.error || 'فشل إنشاء الجلسة');
        setIsProcessing(false);
        return;
      }

      console.log('📊 Session created with real status:', result.status);
      
      setSession({
        status: (result.status as any) || 'SCANNING',
        sessionId: result.sessionId,
        phoneNumber: result.phoneNumber || null,
        source: 'waaku_server'
      });
      
      if (result.status === 'CONNECTED') {
        showMessage('success', 'الجلسة متصلة بالفعل! ✅');
      } else if (result.status === 'SCANNING') {
        showMessage('success', 'تم إنشاء الجلسة. اضغط "عرض QR" للمتابعة.');
      } else {
        showMessage('info', `تم إنشاء الجلسة. الحالة: ${result.status}`);
      }
      
    } catch (e: any) {
      showMessage('error', e.message || 'خطأ في إنشاء الجلسة');
    } finally {
      setIsProcessing(false);
    }
  };





    const startQrMonitoring = () => {
    if (!session?.sessionId) return;
    
    if (qrMonitoringIntervalRef.current) {
      clearInterval(qrMonitoringIntervalRef.current);
      qrMonitoringIntervalRef.current = null;
    }
    
    console.log('👁️ بدء مراقبة QR للكشف عن الاتصال...');
    
    qrMonitoringIntervalRef.current = setInterval(async () => {
      try {
        if (session?.status === 'CONNECTED') {
          console.log('✅ Session already CONNECTED - stopping QR monitoring');
          if (qrMonitoringIntervalRef.current) {
            clearInterval(qrMonitoringIntervalRef.current);
            qrMonitoringIntervalRef.current = null;
          }
          return;
        }
        
        console.log('🔍 [QR Monitor] Checking QR status...');
        
        const qrRes = await waakuService.getQrCode(session.sessionId!);
        
        if (!qrRes.qr || qrRes.error) {
          console.log('🎉 QR disappeared! Session is now CONNECTED!');
          
          if (qrMonitoringIntervalRef.current) {
            clearInterval(qrMonitoringIntervalRef.current);
            qrMonitoringIntervalRef.current = null;
          }
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          
          console.log('🛑 All monitoring stopped');
          
          setQrCode('');
          
          setSession(prev => ({
            ...prev,
            status: 'CONNECTED',
            sessionId: session.sessionId || null
          }));
          
          await updateSessionStatusInDB('CONNECTED', session.sessionId!);
          
          showMessage('success', '🎉 تم الاتصال بنجاح! WhatsApp متصل الآن.');
          
          try {
            const statusData = await waakuService.checkStatus(institution?.id!);
            if (statusData.status === 'CONNECTED' && statusData.phoneNumber) {
              setSession(prev => ({
                ...prev,
                phoneNumber: statusData.phoneNumber
              }));
              
              await supabase
                .from('institutions')
                .update({ whatsapp_phone_number: statusData.phoneNumber })
                .eq('id', institution!.id);
              
              console.log('✅ Phone number updated:', statusData.phoneNumber);
            }
          } catch (e) {
            console.log('⚠️ Could not fetch phone number, but session is CONNECTED');
          }
          
        } else {
          console.log('⏳ QR still available, session still SCANNING');
        }
        
      } catch (error) {
        console.error('❌ Error in QR monitoring:', error);
        
        if (error instanceof Error && (error.message.includes('404') || error.message.includes('not found'))) {
          console.log('✅ QR endpoint returned 404 - Session CONNECTED');
          
          if (qrMonitoringIntervalRef.current) {
            clearInterval(qrMonitoringIntervalRef.current);
            qrMonitoringIntervalRef.current = null;
          }
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          
          console.log('🛑 All monitoring stopped due to error');
          
          setQrCode('');
          setSession(prev => ({ ...prev, status: 'CONNECTED' }));
          
          await updateSessionStatusInDB('CONNECTED', session.sessionId!);
          
          showMessage('success', '🎉 تم الاتصال بنجاح!');
          
          try {
            const statusData = await waakuService.checkStatus(institution?.id!);
            if (statusData.phoneNumber) {
              setSession(prev => ({
                ...prev,
                phoneNumber: statusData.phoneNumber
              }));
              
              await supabase
                .from('institutions')
                .update({ whatsapp_phone_number: statusData.phoneNumber })
                .eq('id', institution!.id);
            }
          } catch (e) {
            console.log('⚠️ Could not fetch phone number');
          }
        }
      }
    }, 3000);
  };






  const handleShowQr = async () => {
    if (!session?.sessionId) {
      showMessage('error', 'يجب إنشاء جلسة أولاً');
      return;
    }

    if (session.status === 'CONNECTED') {
      showMessage('info', 'الجلسة متصلة بالفعل. لا حاجة لـ QR.');
      return;
    }

    setIsLoadingQr(true);
    let attempts = 0;
    const maxAttempts = 5;

    const tryGetQr = async (): Promise<boolean> => {
      attempts++;
      console.log(`🔄 محاولة ${attempts}/${maxAttempts} لجلب QR...`);

      try {
        const qrRes = await waakuService.getQrCode(session.sessionId!);
        
        if (qrRes.qr) {
          setQrCode(qrRes.qr);
          showMessage('success', 'تم عرض رمز QR. امسحه من هاتفك.');
          
          startQrMonitoring();
          
          return true;
        }
        
        return false;
      } catch (e: any) {
        console.error('❌ خطأ في جلب QR:', e);
        return false;
      }
    };

    const success = await tryGetQr();
    
    if (!success && attempts < maxAttempts) {
      showMessage('info', 'QR غير جاهز بعد. جاري المحاولة...');
      
      const retryInterval = setInterval(async () => {
        const retrySuccess = await tryGetQr();
        
        if (retrySuccess || attempts >= maxAttempts) {
          clearInterval(retryInterval);
          setIsLoadingQr(false);
          
          if (!retrySuccess) {
            showMessage('error', 'تعذر جلب QR بعد عدة محاولات. حاول لاحقاً.');
          }
        }
      }, 3000);
      
      setTimeout(() => {
        clearInterval(retryInterval);
        setIsLoadingQr(false);
      }, 15000);
    } else {
      setIsLoadingQr(false);
      if (!success) {
        showMessage('error', 'QR غير متاح حالياً. حاول مرة أخرى.');
      }
    }
  };

  const handleDeleteSession = async () => {
    if (!institution) return;
    if (!window.confirm('هل أنت متأكد من حذف هذه الجلسة؟')) return;
    
    setIsProcessing(true);
    setQrCode('');
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (qrMonitoringIntervalRef.current) {
      clearInterval(qrMonitoringIntervalRef.current);
      qrMonitoringIntervalRef.current = null;
    }
    
    try {
      const result = await waakuService.stopSession(institution.id);
      if (result.success) {
        setSession(null);
        showMessage('success', 'تم حذف الجلسة بنجاح.');
      } else {
        showMessage('error', result.error || 'فشل حذف الجلسة.');
      }
    } catch (e: any) {
      showMessage('error', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTestSend = async () => {
    if (!institution) return;
    if (session?.status !== 'CONNECTED') {
      showMessage('error', 'يجب أن تكون الجلسة متصلة أولاً.');
      return;
    }
    if (!testPhone.trim()) {
      showMessage('error', 'يرجى إدخال رقم الهاتف.');
      return;
    }
    setIsSending(true);
    try {
      const result = await waakuService.sendMessage(institution.id, testPhone, testMessage);
      if (result.success) showMessage('success', 'تم إرسال الرسالة بنجاح.');
      else showMessage('error', result.message || 'فشل إرسال الرسالة.');
    } catch (e: any) {
      showMessage('error', e.message);
    } finally {
      setIsSending(false);
    }
  };



    if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!institution) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="p-8 bg-white rounded-lg shadow-md w-full max-w-sm">
          <h2 className="text-2xl font-bold text-center mb-4">التحقق من المؤسسة</h2>
          <p className="text-center text-gray-600 mb-6">الرجاء إدخال رمز المؤسسة (GREZA) للمتابعة.</p>
          <div className="space-y-4">
            <input
              type="text"
              value={grezaInput}
              onChange={(e) => setGrezaInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isProcessing && grezaInput.trim()) {
                  handleGrezaConfirm(grezaInput);
                }
              }}
              placeholder="أدخل الرمز هنا"
              className="w-full px-4 py-2 border rounded-md text-center"
            />
            <button
              onClick={() => handleGrezaConfirm(grezaInput)}
              disabled={isProcessing || !grezaInput.trim()}
              className="w-full flex justify-center items-center gap-2 bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isProcessing ? <Loader2 className="animate-spin" /> : <LogIn size={20} />}
              {isProcessing ? 'جاري التحقق...' : 'متابعة'}
            </button>
          </div>
          {message && (
            <p className={`mt-4 text-center ${message.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
              {message.text}
            </p>
          )}
        </div>
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-green-700 p-6 text-white">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-10 h-10" />
                <div>
                  <h1 className="text-3xl font-bold">ربط WhatsApp - {institution?.greza || ''}</h1>
                  <p className="text-green-100 mt-1">{institution?.name || ''}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded transition-colors"
              >
                تغيير المؤسسة
              </button>
            </div>
          </div>

          <div className="p-8">
            {message && (
              <div
                className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
                  message.type === 'success'
                    ? 'bg-green-100 text-green-800 border border-green-200'
                    : message.type === 'error'
                    ? 'bg-red-100 text-red-800 border border-red-200'
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
                <span className="font-medium">{message.text}</span>
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {getStatusIcon()}
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">حالة الاتصال</h3>
                    <p className={`text-sm font-medium ${getStatusColor()}`}>{getStatusText()}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => checkSessionStatus()}
                    disabled={isProcessing || isChecking}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
                    {isChecking ? 'جاري...' : 'تحديث'}
                  </button>
                  <button
                    onClick={handleDeleteSession}
                    disabled={isProcessing || !session}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    حذف
                  </button>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {(!session || session.status === 'DISCONNECTED') && (
                  <button
                    onClick={handleCreateSession}
                    disabled={isProcessing}
                    className="w-full px-6 py-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-bold text-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 flex items-center justify-center gap-3 transition-all hover:scale-105"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        جاري إنشاء الجلسة...
                      </>
                    ) : (
                      <>
                        <MessageSquare className="w-6 h-6" />
                        إنشاء جلسة جديدة
                      </>
                    )}
                  </button>
                )}

                {session && session.status === 'SCANNING' && !qrCode && (
                  <button
                    onClick={handleShowQr}
                    disabled={isLoadingQr}
                    className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-bold text-lg hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 flex items-center justify-center gap-3 transition-all hover:scale-105"
                  >
                    {isLoadingQr ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        جاري تحميل QR...
                      </>
                    ) : (
                      <>
                        <QrCode className="w-6 h-6" />
                        عرض رمز QR
                      </>
                    )}
                  </button>
                )}

                {session && session.status === 'SCANNING' && qrCode && (
                  <button
                    onClick={handleShowQr}
                    disabled={isLoadingQr}
                    className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2 font-bold transition-colors"
                  >
                    <RefreshCw className={`w-5 h-5 ${isLoadingQr ? 'animate-spin' : ''}`} />
                    {isLoadingQr ? 'جاري التجديد...' : 'تجديد رمز QR'}
                  </button>
                )}
              </div>
            </div>

            {qrCode && session?.status === 'SCANNING' && (
              <div className="text-center py-8 mb-6">
                <div className="bg-white p-6 rounded-lg shadow-lg inline-block border-2 border-purple-200">
                  <img src={qrCode} alt="QR Code" className="w-64 h-64 mx-auto" />
                  <div className="mt-4 text-gray-700">
                    <p className="font-bold mb-2 text-lg">📱 خطوات المسح:</p>
                    <ol className="text-sm text-right space-y-2">
                      <li>1️⃣ افتح تطبيق WhatsApp على هاتفك</li>
                      <li>2️⃣ اذهب إلى الإعدادات ← الأجهزة المرتبطة</li>
                      <li>3️⃣ اضغط على "ربط جهاز"</li>
                      <li>4️⃣ وجّه الكاميرا نحو الرمز أعلاه</li>
                    </ol>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-4 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  يتم الكشف التلقائي عن الاتصال...
                </p>
              </div>
            )}

            {session?.status === 'CONNECTED' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <div>
                    <h3 className="text-lg font-bold text-green-800">WhatsApp متصل!</h3>
                    <p className="text-sm text-green-700">
                      الرقم المرتبط: {session.phoneNumber || 'غير معروف'}
                    </p>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-green-200">
                  <h4 className="font-bold text-gray-800 mb-4">اختبار إرسال رسالة</h4>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="رقم الهاتف (مثال: 212612345678)"
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none"
                      dir="ltr"
                    />
                    <textarea
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none"
                    />
                    <button
                      onClick={handleTestSend}
                      disabled={isSending}
                      className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 font-bold transition-colors"
                    >
                      {isSending ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          جاري الإرسال...
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-5 h-5" />
                          إرسال رسالة تجريبية
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};




