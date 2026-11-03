import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  buildSessionId,
  extractQr,
  getInstitutionOrFail,
  handleOptions,
  jsonResponse,
  parseBody,
  saveInstitutionWhatsappState,
  waakuFetch,
} from "../_shared/waaku.ts";

Deno.serve(async (req: Request) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method Not Allowed" }, 405);
  }

  try {
    const body = await parseBody(req);
    const institutionId = body.institutionId || body.id;

    if (!institutionId) {
      return jsonResponse(
        { success: false, error: "institutionId is required" },
        400
      );
    }

    const institution = await getInstitutionOrFail(institutionId);
    const sessionId =
      institution.whatsapp_session_id || buildSessionId(institution.id);

    const qrRes = await waakuFetch(
      `/api/sessions/${encodeURIComponent(sessionId)}/qr`,
      { method: "GET" }
    );

    if (!qrRes.ok) {
      return jsonResponse(
        {
          success: false,
          error: "Failed to get QR",
          status: qrRes.status,
          sessionId,
          details: qrRes.json,
          qr: null,
        },
        400
      );
    }

    const qr = extractQr(qrRes.json);
    const status = qr ? "SCANNING" : "DISCONNECTED";

    await saveInstitutionWhatsappState({
      institutionId,
      sessionId,
      status,
      phoneNumber: null,
    });

    return jsonResponse({
      success: true,
      institutionId,
      sessionId,
      status,
      qr,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        qr: null,
      },
      500
    );
  }
});