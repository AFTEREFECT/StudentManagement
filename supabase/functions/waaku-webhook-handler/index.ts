const handleCreateSession = async () => {
  if (!institution) return;

  setIsProcessing(true);
  setQrCode('');

  try {
    showMessage('info', 'جاري إنشاء جلسة واتساب جديدة...');

    const result = await waakuService.startSession(institution.id);

 if (!result.success || !result.instanceName) {
  showMessage('error', result.error || 'فشل إنشاء الجلسة');
  return;
}

console.log('📊 Waaku session created:', result.status);

const normalizedStatus =
  result.status === 'READY' || result.status === 'CONNECTED'
    ? 'CONNECTED'
    : result.status === 'SCANNING' || result.status === 'QR' || result.status === 'CONNECTING'
    ? 'SCANNING'
    : 'DISCONNECTED';

setSession({
  status: normalizedStatus,
  instanceName: result.instanceName,
  phoneNumber: result.phoneNumber || null,
  source: 'waaku_server'
});

if (normalizedStatus === 'CONNECTED') {
  setQrCode('');
  showMessage('success', 'الجلسة متصلة بالفعل! ✅');
} else if (normalizedStatus === 'SCANNING') {
  showMessage('success', 'تم إنشاء الجلسة. اضغط "عرض QR" للمتابعة.');
} else {
  showMessage('info', `تم إنشاء الجلسة. الحالة الحالية: ${result.status}`);
}

  } catch (e: any) {
    showMessage('error', e.message || 'خطأ في إنشاء الجلسة');
  } finally {
    setIsProcessing(false);
  }
};