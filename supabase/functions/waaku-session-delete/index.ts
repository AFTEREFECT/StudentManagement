// index.ts لـ waaku-session-delete

export const OPTIONS = async () => {
  // معالجة طلبات التحقق القبلي من CORS
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
      'Access-Control-Max-Age': '86400',
    },
  });
};

export const POST = async (req: Request) => {
  try {
    const { id } = await req.json();

    // تحقق الصلاحية/المصادقة هنا إذا أردت (JWT أو user/session check)
    // ...

    const waakuRes = await fetch(`https://progtalamid.ddns.net/api/sessions/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
    const waakuData = await waakuRes.json();

    // سجل الحذف في قاعدة supabase لو أردت...
    // await supabase.from('logs').insert({ ... })

    return new Response(JSON.stringify(waakuData), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // إضافة رأس CORS هنا أيضًا
      },
      status: waakuRes.status
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // حتى لرسائل الخطأ
      },
      status: 500
    });
  }
};
