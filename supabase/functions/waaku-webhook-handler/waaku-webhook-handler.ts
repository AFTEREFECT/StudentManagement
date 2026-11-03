const handleCreateSession = async () => {
  if (!institution) return;

  setIsProcessing(true);
  setQrCode('');

  try {
    showMessage('info', 'جاري إنشاء جلسة واتساب جديدة...');

    const result = await waakuService.startSession(institution.id);

    if (!result.success || !result.instanceName) {
      showMessage('error', result.error || 'فشل إنشاء الجلسة');
      setIsProcessing(false);
      return;
    }

    console.log('📊 Evolution instance created:', result.status);

    setSession({
      status: result.status || 'SCANNING',
      instanceName: result.instanceName,
      phoneNumber: result.phoneNumber || null,
      source: 'evolution_server'
    });

    // رسائل حسب الحالة الحقيقية القادمة من Evolution
    if (result.status === 'CONNECTED') {
      showMessage('success', 'الجلسة متصلة بالفعل! ✅');
    } 
    else if (result.status === 'SCANNING') {
      showMessage('success', 'تم إنشاء الجلسة. اضغط "عرض QR" للمتابعة.');
    } 
    else {
      showMessage('info', `تم إنشاء الجلسة. الحالة الحالية: ${result.status}`);
    }

  } catch (e: any) {
    showMessage('error', e.message || 'خطأ في إنشاء الجلسة');
  } finally {
    setIsProcessing(false);
  }
};
