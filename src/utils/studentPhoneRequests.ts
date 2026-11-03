import { supabase } from "./supabase";

export type PhoneRequestStatus = "pending" | "approved" | "rejected";

export type StudentPhoneRequest = {
  id: string;
  institution_id: string;
  student_id?: string | null;
  national_id: string;
  section_name: string;
  submitted_phone: string;
  phone_owner?: string | null;
  birth_date?: string | null;
  status: PhoneRequestStatus;
  reject_reason?: string | null;
  created_at?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
};

export const normalizeMoroccanPhone = (value: string) => {
  const digits = String(value || "").replace(/\D/g, "");

  if (/^0[67]\d{8}$/.test(digits)) return digits;
  if (/^212[67]\d{8}$/.test(digits)) return `0${digits.slice(3)}`;
  if (/^[67]\d{8}$/.test(digits)) return `0${digits}`;

  return digits;
};

export const fetchPhoneRequests = async (
  institutionId: string,
  status: PhoneRequestStatus | "all" = "pending"
): Promise<StudentPhoneRequest[]> => {
  let query = supabase
    .from("student_phone_requests")
    .select("*")
    .eq("institution_id", institutionId)
    .order("created_at", { ascending: false });

  if (status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []) as StudentPhoneRequest[];
};

export const approvePhoneRequest = async (requestId: string, approvedBy = "admin") => {
  const { data, error } = await supabase
    .from("student_phone_requests")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: approvedBy,
      reject_reason: null,
    })
    .eq("id", requestId)
    .select()
    .single();

  if (error) throw error;
  return data as StudentPhoneRequest;
};

export const rejectPhoneRequest = async (
  requestId: string,
  reason = "تم الرفض من الإدارة",
  approvedBy = "admin"
) => {
  const { data, error } = await supabase
    .from("student_phone_requests")
    .update({
      status: "rejected",
      reject_reason: reason,
      approved_at: new Date().toISOString(),
      approved_by: approvedBy,
    })
    .eq("id", requestId)
    .select()
    .single();

  if (error) throw error;
  return data as StudentPhoneRequest;
};
