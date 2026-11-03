export function getCurrentInstitutionId(): string | null {
  return localStorage.getItem("institution_id");
}

export function setCurrentInstitutionId(institutionId: string): void {
  localStorage.setItem("institution_id", institutionId);
}