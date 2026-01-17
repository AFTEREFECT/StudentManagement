const handleCreateSession = async () => {
  if (!institution) return;
  setIsProcessing(true);
  setQrCode(''); // مسح QR القديم
  
  try {
    showMessage('info', 'جاري إنشاء جلسة جديدة...');
    
    const result = await waakuService.startSession(institution.id);
    
    if (!result.success || !result.sessionId) {
      showMessage('error', result.error || 'فشل إنشاء الجلسة');
      setIsProcessing(false);
      return;
    }

    // ✅ الحالة جاءت مع الرد - استخدمها مباشرة (من الخادم!)
    console.log('📊 Session created with real status:', result.status);
    
    setSession({
      status: (result.status as any) || 'SCANNING',
      sessionId: result.sessionId,
      phoneNumber: result.phoneNumber || null,
      source: 'waaku_server'
    });
    
    // ✅ رسائل واضحة حسب الحالة الحقيقية
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
