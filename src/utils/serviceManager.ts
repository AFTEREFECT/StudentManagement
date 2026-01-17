// نظام إدارة المصالح والخدمات

export interface Service {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export const DEFAULT_SERVICES: Service[] = [
  {
    id: 'educational_affairs',
    name: 'مصلحة تأطير و تنشيط المؤسسات التعليمية و التوجيه',
    description: 'مصلحة تأطير و تنشيط المؤسسات التعليمية و التوجيه',
    createdAt: new Date().toISOString()
  },
  {
    id: 'student_affairs',
    name: 'مصلحة الشؤون التربوية',
    description: 'مصلحة الشؤون التربوية',
    createdAt: new Date().toISOString()
  },
  {
    id: 'administrative_affairs',
    name: 'مصلحة الشؤون الإدارية والمالية ',
    description: 'مصلحة الشؤون الإدارية والمالية',
    createdAt: new Date().toISOString()
  },
  {
    id: 'guidance_affairs',
    name: 'مصلحة التخطيط والخريطة المدرسية',
    description: 'المصلحة المسؤولة عن التخطيط الخريطة التربوي',
    createdAt: new Date().toISOString()
  }
];

class ServiceManager {
  private static readonly STORAGE_KEY = 'services';

  // تحميل جميع المصالح
  static getServices(): Service[] {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const services = JSON.parse(saved);
        // دمج المصالح الافتراضية مع المحفوظة
        const defaultIds = DEFAULT_SERVICES.map(s => s.id);
        const customServices = services.filter((s: Service) => !defaultIds.includes(s.id));
        return [...DEFAULT_SERVICES, ...customServices];
      }
      return DEFAULT_SERVICES;
    } catch (error) {
      console.error('خطأ في تحميل المصالح:', error);
      return DEFAULT_SERVICES;
    }
  }

  // إضافة مصلحة جديدة
  static addService(name: string, description: string = ''): Service {
    try {
      const services = this.getServices();
      
      // التحقق من عدم وجود مصلحة بنفس الاسم
      const existingService = services.find(s => s.name.trim().toLowerCase() === name.trim().toLowerCase());
      if (existingService) {
        throw new Error('مصلحة بهذا الاسم موجودة مسبقاً');
      }

      const newService: Service = {
        id: crypto.randomUUID(),
        name: name.trim(),
        description: description.trim(),
        createdAt: new Date().toISOString()
      };

      // حفظ المصالح المخصصة فقط (بدون الافتراضية)
      const defaultIds = DEFAULT_SERVICES.map(s => s.id);
      const customServices = services.filter(s => !defaultIds.includes(s.id));
      customServices.push(newService);
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(customServices));
      
      return newService;
    } catch (error) {
      console.error('خطأ في إضافة المصلحة:', error);
      throw error;
    }
  }

  // حذف مصلحة (المخصصة فقط)
  static deleteService(serviceId: string): boolean {
    try {
      // لا يمكن حذف المصالح الافتراضية
      const defaultIds = DEFAULT_SERVICES.map(s => s.id);
      if (defaultIds.includes(serviceId)) {
        throw new Error('لا يمكن حذف المصالح الافتراضية');
      }

      const services = this.getServices();
      const customServices = services.filter(s => s.id !== serviceId && !defaultIds.includes(s.id));
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(customServices));
      return true;
    } catch (error) {
      console.error('خطأ في حذف المصلحة:', error);
      return false;
    }
  }

  // البحث عن مصلحة بالاسم
  static findServiceByName(name: string): Service | null {
    const services = this.getServices();
    return services.find(s => s.name.trim().toLowerCase() === name.trim().toLowerCase()) || null;
  }

  // التحقق من إمكانية حذف المصلحة
  static canDeleteService(serviceId: string): boolean {
    const defaultIds = DEFAULT_SERVICES.map(s => s.id);
    return !defaultIds.includes(serviceId);
  }
}

export default ServiceManager;