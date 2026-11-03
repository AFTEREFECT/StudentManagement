import React, { useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";

type Student = {
  id: string | number;
  firstName?: string;
  lastName?: string;
  sectionName?: string;
  section?: string;
  nationalId?: string;
  voucher?: string;
};

type Props = {
  students: Student[];
};

const chunkArray = <T,>(arr: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
};

const VoucherPrintSheet: React.FC<Props> = ({ students }) => {
  const printableStudents = useMemo(() => {
    return students
      .filter((s) => String(s.voucher || "").trim() !== "")
      .sort((a, b) => {
        const sectionA = String(a.sectionName || a.section || "");
        const sectionB = String(b.sectionName || b.section || "");

        if (sectionA !== sectionB) {
          return sectionA.localeCompare(sectionB, "ar");
        }

        const nameA = `${a.firstName || ""} ${a.lastName || ""}`.trim();
        const nameB = `${b.firstName || ""} ${b.lastName || ""}`.trim();
        return nameA.localeCompare(nameB, "ar");
      });
  }, [students]);

  const pages = useMemo(() => chunkArray(printableStudents, 8), [printableStudents]);

  return (
    <div className="print-only" dir="rtl">
      {pages.map((page, pageIndex) => (
        <div className="a4-page" key={pageIndex}>
          <div className="cards-grid">
            {page.map((s) => {
              const fullName = `${s.firstName || ""} ${s.lastName || ""}`.trim();
              const section = s.sectionName || s.section || "-";
              const voucher = s.voucher || "";
              const activationUrl = `https://activationphone.progtalamid.com/?v=${voucher}&id=${s.nationalId || ""}`;

              return (
                <div className="voucher-card" key={s.id}>
                  <div className="card-header">بطاقة التفعيل</div>
                  <div className="card-body">
                    <div className="student-name">{fullName}</div>
                    <div className="student-section">القسم: {section}</div>
                    <div className="student-massar">مسار: {s.nationalId || "-"}</div>
                    <div className="voucher-box">{voucher}</div>
                    <div className="qr-box">
                      <QRCodeSVG value={activationUrl} size={50} level="M" includeMargin={false} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default VoucherPrintSheet;