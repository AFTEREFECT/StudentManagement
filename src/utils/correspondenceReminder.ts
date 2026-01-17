// نظام التذكير التلقائي للمراسلات المتكررة

export interface CorrespondenceRecord {
  id: string;
  studentId: string;
  studentName: string;
  institutionName: string;
  requestType: string;
  requestDate: string;
  sendingNumber?: string;
  reference?: string;
  subject: string;
  content: string;
  createdAt: string;
}

export interface ReminderAlert {
  hasReminder: boolean;
  previousRequests: CorrespondenceRecord[];
  message: string;
  lastRequestDate?: string;
  requestCount: number;
}

class CorrespondenceReminderSystem {
  private readonly STORAGE_KEY = 'correspondenceHistory';

  // حفظ طلب جديد في السجل
  saveRequest(record: Omit<CorrespondenceRecord, 'id' | 'createdAt'>): string {
    try {
      const history = this.getHistory();
      const newRecord: CorrespondenceRecord = {
        ...record,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString()
      };
      
      history.push(newRecord);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
      
      console.log('✅ تم حفظ طلب جديد:', newRecord);
      return newRecord.id;
    } catch (error) {
      console.error('خطأ في حفظ الطلب:', error);
      return '';
    }
  }

  // البحث عن طلبات مشابهة لنفس التلميذ
  checkForSimilarRequests(studentId: string, institutionName: string): ReminderAlert {
    try {
      const history = this.getHistory();
      
      // البحث عن طلبات سابقة لنفس التلميذ ونفس المؤسسة
      const similarRequests = history.filter(record => 
        record.studentId === studentId && 
        record.institutionName.toLowerCase().trim() === institutionName.toLowerCase().trim()
      );

      if (similarRequests.length === 0) {
        return {
          hasReminder: false,
          previousRequests: [],
          message: '',
          requestCount: 0
        };
      }

      // ترتيب الطلبات من الأحدث للأقدم
      const sortedRequests = similarRequests.sort((a, b) => 
        new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()
      );

      // أخذ آخر 4 طلبات كحد أقصى
      const recentRequests = sortedRequests.slice(0, 4);
      
      // تنسيق التواريخ
      const formattedDates = recentRequests.map(req => 
        new Date(req.requestDate).toLocaleDateString('fr-MA')
      ).join('، ');

      const message = ` نذكركم أنه سبق إرسال طلب مشابه لهذا التلميذ إلى مؤسستكم في التواريخ التالية: ${formattedDates}`;

      return {
        hasReminder: true,
        previousRequests: recentRequests,
        message,
        lastRequestDate: recentRequests[0].requestDate,
        requestCount: similarRequests.length
      };
    } catch (error) {
      console.error('خطأ في فحص الطلبات المشابهة:', error);
      return {
        hasReminder: false,
        previousRequests: [],
        message: '',
        requestCount: 0
      };
    }
  }

  // الحصول على سجل المراسلات
  private getHistory(): CorrespondenceRecord[] {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('خطأ في تحميل سجل المراسلات:', error);
      return [];
    }
  }

  // الحصول على جميع الطلبات لمؤسسة معينة
  getInstitutionHistory(institutionName: string): CorrespondenceRecord[] {
    const history = this.getHistory();
    return history.filter(record => 
      record.institutionName.toLowerCase().trim() === institutionName.toLowerCase().trim()
    ).sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
  }

  // الحصول على إحصائيات المراسلات
  getStatistics() {
    const history = this.getHistory();
    const institutionCounts = new Map<string, number>();
    const monthlyRequests = new Map<string, number>();

    history.forEach(record => {
      // إحصائيات المؤسسات
      const institution = record.institutionName;
      institutionCounts.set(institution, (institutionCounts.get(institution) || 0) + 1);

      // إحصائيات شهرية
      const month = new Date(record.requestDate).toISOString().substring(0, 7);
      monthlyRequests.set(month, (monthlyRequests.get(month) || 0) + 1);
    });

    return {
      totalRequests: history.length,
      institutionCounts: Object.fromEntries(institutionCounts),
      monthlyRequests: Object.fromEntries(monthlyRequests),
      mostActiveInstitution: institutionCounts.size > 0 ? 
        Array.from(institutionCounts.entries()).reduce((a, b) => a[1] > b[1] ? a : b)[0] : null
    };
  }

  // مسح السجل (للصيانة)
  clearHistory(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  // تصدير السجل
  exportHistory(): string {
    const history = this.getHistory();
    return JSON.stringify(history, null, 2);
  }
}

// إنشاء مثيل واحد للاستخدام في جميع أنحاء التطبيق
export const correspondenceReminder = new CorrespondenceReminderSystem();