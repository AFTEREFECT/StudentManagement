import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { password } = await req.json();

    // كلمة المرور المخزنة بشكل آمن في Environment Variable
    const correctPassword = Deno.env.get('DEVELOPER_PASSWORD') || 'BGA161';

    if (!password) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'كلمة المرور مطلوبة' 
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // التحقق من كلمة المرور
    const isValid = password === correctPassword;

    // تسجيل المحاولة (للأمان)
    console.log(`Developer password verification: ${isValid ? 'SUCCESS' : 'FAILED'}`);

    if (!isValid) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'كلمة المرور غير صحيحة' 
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // إنشاء session token (اختياري)
    const sessionToken = crypto.randomUUID();

    return new Response(
      JSON.stringify({
        valid: true,
        message: 'تم التحقق بنجاح',
        sessionToken: sessionToken
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in verify-developer-password:', error);
    return new Response(
      JSON.stringify({ 
        valid: false, 
        message: 'خطأ في الخادم' 
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
