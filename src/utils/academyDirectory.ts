import academyDirectoryCsv from '../data/academies-directions.csv?raw';

export interface AcademyDirectoryEntry {
  regionCode: string;
  academy: string;
  directorateCode: string;
  directorate: string;
}

const parseDelimitedRow = (row: string): string[] =>
  row.match(/"(?:[^"]|"")*"|[^;]+/g)?.map(value =>
    value.replace(/^"|"$/g, '').replace(/""/g, '"').trim()
  ) || [];

export const academyDirectory: AcademyDirectoryEntry[] = academyDirectoryCsv
  .replace(/^\uFEFF/, '')
  .split(/\r?\n/)
  .slice(1)
  .filter(Boolean)
  .map(row => {
    const [regionCode = '', academy = '', directorateCode = '', directorate = ''] = parseDelimitedRow(row);
    return { regionCode, academy, directorateCode, directorate };
  })
  .filter(entry => entry.academy && entry.directorate);

export const academies = Array.from(new Set(academyDirectory.map(entry => entry.academy)));

export const isKnownAcademy = (academy: string): boolean =>
  academies.some(candidate => candidate === academy);

export const directoratesForAcademy = (academy: string): string[] =>
  academyDirectory
    .filter(entry => entry.academy === academy)
    .map(entry => entry.directorate.replace(/^[^:：]+[:：]\s*/, '').trim());

const normalizeName = (value: string): string =>
  value
    .trim()
    .replace(/^الأكاديمية الجهوية للتربية والتكوين\s*(?:ل)?(?:جهة)?\s*/u, '')
    .replace(/^(?:ال)?مديرية(?:\s+الإقليمية)?\s*/u, '')
    .replace(/^(?:إقليم|عمالة|عمالة مقاطعات|عمالة مقاطعة)\s*[:：]?\s*/u, '')
    .replace(/^(?:جهة|بـ|ب)\s*/u, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ـ/g, '')
    .replace(/[‐‑‒–—-]/g, ' ')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .toLocaleLowerCase();

export const canonicalAcademy = (value: string): string => {
  const normalized = normalizeName(value);
  return academies.find(academy => normalizeName(academy) === normalized) || value.trim();
};

export const canonicalDirectorate = (value: string, academy?: string): string => {
  const normalized = normalizeName(value);
  const candidates = academy
    ? academyDirectory.filter(entry => entry.academy === academy)
    : academyDirectory;
  const match = candidates.find(entry =>
    normalizeName(entry.directorate) === normalized ||
    normalizeName(entry.directorate.replace(/^[^:：]+[:：]\s*/, '')) === normalized
  );
  return match
    ? match.directorate.replace(/^[^:：]+[:：]\s*/, '').trim()
    : value.trim();
};

export const isDirectorateInAcademy = (directorate: string, academy: string): boolean =>
  academyDirectory.some(entry =>
    entry.academy === academy &&
    normalizeName(entry.directorate) === normalizeName(directorate)
  );
