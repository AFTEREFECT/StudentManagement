import { supabase } from "../lib/supabaseClient";

/* حفظ المؤسسة في localStorage */
export function saveInstitution(id: string, name: string) {
  localStorage.setItem("institution_id", id);
  localStorage.setItem("institution_name", name);
}

/* جلب المؤسسة من localStorage */
export function getInstitutionId(): string | null {
  return localStorage.getItem("institution_id");
}

/* جلب اسم المؤسسة */
export function getInstitutionName(): string | null {
  return localStorage.getItem("institution_name");
}

/* حذف الربط */
export function clearInstitution() {
  localStorage.removeItem("institution_id");
  localStorage.removeItem("institution_name");
}

/* ربط المؤسسة عبر GREZA */
export async function linkInstitutionByGreza(greza: string) {

  if (!greza) {
    throw new Error("يجب إدخال GREZA");
  }

  try {

    const { data, error } = await supabase
      .from("institutions")
      .select("id,name,greza")
      .eq("greza", greza)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error("المؤسسة غير موجودة");
    }

    /* حفظ المؤسسة */
    saveInstitution(data.id, data.name);

    console.log("تم ربط المؤسسة:", data.name);

    return {
      success: true,
      institution_id: data.id,
      institution_name: data.name
    };

  } catch (err) {

    console.error("خطأ ربط المؤسسة:", err);

    return {
      success: false,
      message: err instanceof Error ? err.message : "خطأ غير معروف"
    };

  }

}

/* التحقق إن كانت المؤسسة مربوطة */
export function isInstitutionLinked(): boolean {
  const id = localStorage.getItem("institution_id");
  return !!id;
}