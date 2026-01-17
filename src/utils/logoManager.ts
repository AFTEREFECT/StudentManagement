// مدير الشعار - للاستخدام في جميع أنحاء التطبيق

interface LogoSettings {
  logoUrl: string;
  logoType: 'image' | 'text';
  textContent: string;
  width: number;
  height: number;
  position: 'center' | 'right' | 'left';
  lastUpdated: string;
}

const DEFAULT_LOGO_SETTINGS: LogoSettings = {
  logoUrl: '',
  logoType: 'text',
  textContent: 'المملكة المغربية\nوزارة التربية الوطنية والتعليم الأولي والرياضة',
  width: 300,
  height: 40, 
  position: 'center',
  lastUpdated: new Date().toISOString()
};

class LogoManager {
  private static instance: LogoManager;
  private settings: LogoSettings;

  private constructor() {
    this.settings = this.loadSettings();
  }

  public static getInstance(): LogoManager {
    if (!LogoManager.instance) {
      LogoManager.instance = new LogoManager();
    }
    return LogoManager.instance;
  }

  // تحميل الإعدادات من Local Storage
  private loadSettings(): LogoSettings {
    try {
      const saved = localStorage.getItem('logoSettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_LOGO_SETTINGS, ...parsed };
      }
    } catch (error) {
      console.warn('خطأ في تحميل إعدادات الشعار:', error);
    }
    return { ...DEFAULT_LOGO_SETTINGS };
  }

  // الحصول على الإعدادات الحالية
  public getSettings(): LogoSettings {
    return { ...this.settings };
  }

  // تحديث الإعدادات مع الحفظ في Local Storage
  public updateSettings(newSettings: Partial<LogoSettings>): boolean {
    try {
      this.settings = { 
        ...this.settings, 
        ...newSettings,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem('logoSettings', JSON.stringify(this.settings));
      return true;
    } catch (error) {
      console.error('خطأ في حفظ إعدادات الشعار:', error);
      return false;
    }
  }

  // رفع شعار جديد
  public async uploadLogo(file: File): Promise<{ success: boolean; message: string }> {
    try {
      // التحقق من نوع الملف
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
      if (!allowedTypes.includes(file.type)) {
        return { success: false, message: 'نوع الملف غير مدعوم. يرجى اختيار PNG أو JPG أو SVG' };
      }

      // التحقق من حجم الملف (أقل من 2MB)
      if (file.size > 2 * 1024 * 1024) {
        return { success: false, message: 'حجم الملف كبير جداً. يرجى اختيار ملف أقل من 2 ميجابايت' };
      }

      // تحويل الملف إلى Base64
      const logoUrl = await this.fileToBase64(file);
      
      const success = this.updateSettings({
        logoUrl,
        logoType: 'image'
      });

      if (success) {
        return { success: true, message: 'تم رفع الشعار بنجاح!' };
      } else {
        return { success: false, message: 'خطأ في حفظ الشعار' };
      }
    } catch (error) {
      console.error('خطأ في رفع الشعار:', error);
      return { success: false, message: 'خطأ في رفع الشعار' };
    }
  }

  // تحويل الملف إلى Base64
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // حذف الشعار
  public deleteLogo(): boolean {
    try {
      const success = this.updateSettings({
        logoUrl: '',
        logoType: 'text'
      });
      return success;
    } catch (error) {
      console.error('خطأ في حذف الشعار:', error);
      return false;
    }
  }

  // الحصول على HTML للشعار للاستخدام في التقارير
  public getLogoHTML(): string {
    if (this.settings.logoUrl && this.settings.logoType === 'image') {
      return `
        <img 
          src="${this.settings.logoUrl}" 
          alt="شعار الوزارة"
          style="
            width: ${this.settings.width}px;
            height: ${this.settings.height}px;
            object-fit: contain;
            display: block;
            margin: 0 auto;
          "
        />
      `;
    } else {
      return `
        <div style="
          width: ${this.settings.width}px;
          height: ${this.settings.height}px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          font-size: 10px;
          line-height: 1.2;
          color: #dc2626;
          font-weight: bold;
          margin: 0 auto;
        ">
          ${this.settings.textContent.split('\n').map(line => `<div>${line}</div>`).join('')}
        </div>
      `;
    }
  }

  // إعادة تحميل الإعدادات (للتحديث من مكونات أخرى)
  public reloadSettings(): void {
    this.settings = this.loadSettings();
  }
}

// تصدير مثيل واحد للاستخدام في جميع أنحاء التطبيق
export const logoManager = LogoManager.getInstance();