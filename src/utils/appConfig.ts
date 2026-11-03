export const API_BASE_URL = "https://waapi.progtalamid.com";
export const API_BASE_URL2 = "https://waapi.progtalamid.com";



export function normalizePhone(input: string): string {
  let p = (input || "").replace(/\D/g, "");
  if (p.startsWith("00")) p = p.slice(2);
  if (p.startsWith("0")) p = p.slice(1);
  if (!p.startsWith("212")) p = "212" + p;
  return p;
}