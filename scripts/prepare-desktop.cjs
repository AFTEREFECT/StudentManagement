const fs = require('node:fs/promises');
const path = require('node:path');
const ExcelJS = require('exceljs');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'dist');
const outputDir = path.join(root, 'dist-desktop');

function getCellText(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  if ('richText' in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part?.text || '').join('');
  }
  if ('text' in value && typeof value.text === 'string') return value.text;
  if ('result' in value && typeof value.result === 'string') return value.result;
  return '';
}

function findAttendanceFooterRow(worksheet) {
  let footerRow;
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (footerRow !== undefined) return;
    let hasFooterLabel = false;
    row.eachCell({ includeEmpty: false }, (cell) => {
      const text = getCellText(cell.value);
      if (text.includes('عدد المتغيبين') || text.includes('عدد التلاميذ')) {
        hasFooterLabel = true;
      }
    });
    if (hasFooterLabel) footerRow = rowNumber;
  });

  if (footerRow === undefined) {
    throw new Error(`Attendance footer not found in template: ${worksheet.name}`);
  }
  return footerRow;
}

async function clearRowsFrom(worksheet, firstRow, endRowExclusive = worksheet.rowCount + 1) {
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < firstRow || rowNumber >= endRowExclusive) return;

    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.value = null;
      cell.note = undefined;
    });
  });
}

async function createCleanTemplate(
  sourceName,
  outputName,
  firstDataRow,
  clearInstitutionFields,
  preserveAttendanceFooter = false
) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(root, 'public', sourceName));

  for (const worksheet of workbook.worksheets) {
    const footerRow = preserveAttendanceFooter ? findAttendanceFooterRow(worksheet) : undefined;
    await clearRowsFrom(worksheet, firstDataRow, footerRow);

    if (clearInstitutionFields) {
      for (const address of ['B2', 'D1', 'D2', 'T1', 'AH2', 'AK2', 'BA2']) {
        worksheet.getCell(address).value = null;
      }
    }
  }

  workbook.creator = 'PROGTALAMID';
  workbook.lastModifiedBy = 'PROGTALAMID';
  workbook.subject = '';
  workbook.title = 'PROGTALAMID template';
  workbook.keywords = '';
  workbook.description = '';
  workbook.created = new Date('2020-01-01T00:00:00.000Z');
  workbook.modified = new Date('2020-01-01T00:00:00.000Z');

  const outputPath = path.join(outputDir, outputName);
  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}

async function verifyCleanTemplate(filePath, firstDataRow, preserveAttendanceFooter = false) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  for (const worksheet of workbook.worksheets) {
    const footerRow = preserveAttendanceFooter ? findAttendanceFooterRow(worksheet) : undefined;
    let remainingData = false;
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber >= firstDataRow && (footerRow === undefined || rowNumber < footerRow)) {
        row.eachCell({ includeEmpty: false }, (cell) => {
          if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
            remainingData = true;
          }
        });
      }
    });

    if (remainingData) {
      throw new Error(`Personal data remains in template: ${path.basename(filePath)}`);
    }
  }
}

async function main() {
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.cp(sourceDir, outputDir, {
    recursive: true,
    filter: (source) => path.extname(source).toLowerCase() !== '.xlsx',
  });

  const attendanceFiles = [
    ['Absence_fatra1.xlsx', 'Absence_fatra1.xlsx'],
    ['Absence_fatra2.xlsx', 'Absence_fatra2.xlsx'],
    ['feuilAbsence.xlsx', 'feuilAbsence.xlsx'],
  ];

  for (const [sourceName, outputName] of attendanceFiles) {
    const outputPath = await createCleanTemplate(sourceName, outputName, 5, true, true);
    await verifyCleanTemplate(outputPath, 5, true);
  }

  const dailyTemplatePath = await createCleanTemplate(
    'Absence_fatra1.xlsx',
    'Absence_daily.xlsx',
    5,
    true,
    true,
  );
  await verifyCleanTemplate(dailyTemplatePath, 5, true);

  const studentListPath = await createCleanTemplate(
    'ListeEleves.xlsx',
    'ListeEleves.xlsx',
    3,
    false,
  );
  await verifyCleanTemplate(studentListPath, 3);

  console.log('Prepared desktop build with blank Excel templates and no school records.');
}

main().catch((error) => {
  console.error('Failed to prepare the desktop distribution:', error);
  process.exitCode = 1;
});
