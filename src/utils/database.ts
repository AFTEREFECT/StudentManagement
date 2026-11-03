 import initSqlJs from 'sql.js';
 import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import type { ReceivedAttendance } from './attendanceStartupSync';
import {
  DEFAULT_DISCIPLINE_ACTIONS,
  DEFAULT_DISCIPLINE_CATEGORIES,
  DisciplineAction,
  DisciplineCategory,
  DisciplineRecordKind,
  DisciplineRecordStatus,
  NewStudentIncident,
  StudentIncident,
} from './discipline';



// أنواع البيانات للجداول الجديدة
interface Level {
  id: string;
  name: string;
  code: string;
  createdAt: string;
}
 
interface Section {
  id: string;
  name: string;
  levelId: string; ////////////////////////////////////////////////////////////////////////////////////////
  code: string;
  createdAt: string;
}

interface AcademicYear {
  id: string;
  year: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
}

interface Class {
  id: string;
  name: string;
  levelId: string; ///////////////////////////////////////////////////////////////////////////////////////////////////////
  code: string;
  createdAt: string;
}

class DatabaseManager {
  private db: any = null;
  private isInitialized = false;
  private initializing: Promise<void> | null = null;
  private persistenceQueue: Promise<void> = Promise.resolve();
  private dbName = 'StudentManagementDB';
  private dbVersion = 1;
  private storeName = 'database';

  async initialize() {
    if (this.isInitialized) return;
    if (!this.initializing) {
      this.initializing = this.initializeDatabase().finally(() => { this.initializing = null; });
    }
    return this.initializing;
  }

  private async initializeDatabase() {

   
    try {
      const SQL = await initSqlJs({
        locateFile: () => sqlWasmUrl
      });

      // Keep desktop data outside the install folder so application updates do not replace it.
      const desktopDb = window.desktopStorage
        ? await window.desktopStorage.readDatabase()
        : null;
      const savedDb = desktopDb || await this.loadFromIndexedDB();
      if (savedDb) {
        try {
          this.db = new SQL.Database(savedDb);
        } catch (error) {
          if (!desktopDb) throw error;

          const indexedDb = await this.loadFromIndexedDB();
          if (!indexedDb) throw error;
          this.db = new SQL.Database(indexedDb);
        }
      } else {
        this.db = new SQL.Database();
      }

      await this.createTables();
      await this.saveDatabase();
      this.isInitialized = true;

      console.log('تم تهيئة قاعدة البيانات بنجاح');
    } catch (error) {
      console.error('خطأ في تهيئة قاعدة البيانات:', error);
      throw error;
    }
  }

// خريطة المستويات
private levelNameMap: Record<string, string> = {
  '1APIC': 'الأولى إعدادي مسار دولي',
  '2APIC': 'الثانية إعدادي مسار دولي',
  '3APIC': 'الثالثة إعدادي مسار دولي',
  'TC': 'الجذع المشترك',
  'TCS': 'الجذع المشترك العلمي',
  'TCL': 'الجذع المشترك الأدبي',
  '1B': 'الأولى باكالوريا',
  '1BS': 'الأولى باكالوريا علوم',
  '1BL': 'الأولى باكالوريا آداب',
  '2B': 'الثانية باكالوريا',
  '2BL': 'الثانية باكالوريا آداب',
  'CP': 'التحضيري',
  'CE1': 'السنة الأولى ابتدائي',
  'CE2': 'السنة الثانية ابتدائي',
  'CM1': 'السنة الثالثة ابتدائي',
  'CM2': 'السنة الرابعة ابتدائي',
  'CI': 'السنة الخامسة ابتدائي',
  'CS': 'السنة السادسة ابتدائي'
};

// جلب المستويات
getAllLevels(): Level[] {
  const stmt = this.db.prepare('SELECT * FROM levels');
  const levels: Level[] = [];
  while (stmt.step()) {
    levels.push(stmt.getAsObject() as Level);
  }
  stmt.free();
  return levels;
}

// جلب الأقسام
getAllSections(): Class[] {
  const stmt = this.db.prepare('SELECT * FROM sections');
  const sections: Class[] = [];
  while (stmt.step()) {
  sections.push(stmt.getAsObject() as Class);
  }
  stmt.free();
  return sections;
}
///////////////
 
async resetActivationCodes(): Promise<void> {
  await this.initialize();
  this.db.run(`DELETE FROM activation_codes`);
  await this.saveDatabase();
}

 getDatabaseInstance() {
  return this.db;
}

getSupabaseInstitutionId() {
  try {
    const stmt = this.db.prepare(`
      SELECT supabaseInstitutionId
      FROM institution_settings
      ORDER BY updatedAt DESC
      LIMIT 1
    `);

    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      stmt.free();
      return String(row.supabaseInstitutionId || "").trim();
    }

    stmt.free();
    return "";
  } catch (error) {
    console.error("خطأ في getSupabaseInstitutionId:", error);
    return "";
  }
}


 async getStudentsWithActivationData(): Promise<any[]> {
  await this.initialize();

  const stmt = this.db.prepare(`
     SELECT
  s.*,
  l.name as levelName,
  sec.name as sectionName,
  ac.code as voucher,
  ac.national_id as activationNationalId,
  ac.used as voucherUsed,
  ac.created_at as voucherCreatedAt
FROM students s
LEFT JOIN levels l ON s.levelId = l.id
LEFT JOIN sections sec ON s.sectionId = sec.id
LEFT JOIN activation_codes ac ON ac.national_id = s.nationalId
ORDER BY s.lastName, s.firstName
  `);

  const students: any[] = [];

  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    const voucher = row.voucher ? String(row.voucher).trim() : "";
    const nationalId = row.nationalId ? String(row.nationalId).trim() : "";

    students.push({
      ...row,
      voucher,
      activationUrl: voucher
        ? `https://activationphone.progtalamid.com/?v=${encodeURIComponent(voucher)}&id=${encodeURIComponent(nationalId)}`
        : ""
    });
  }

  stmt.free();
  return students;
}

async getStudents(): Promise<any[]> {
  return await this.getStudentsWithActivationData();
}

async getAllStudents(): Promise<any[]> {
  return await this.getStudentsWithActivationData();
}




// دالة إنشاء أو جلب القسم

 
async getOrCreateLevel(levelName: string, levelCode: string): Promise<{ id: string, name: string, code: string }> {
  await this.initialize();

  const cleanName = levelName.trim();
  const cleanCode = levelCode.trim().toUpperCase();

  this.db.run(`
    CREATE TABLE IF NOT EXISTS levels (
      id TEXT PRIMARY KEY,
      name TEXT,
      code TEXT
    );
  `);

  const stmt = this.db.prepare("SELECT * FROM levels WHERE name = ? AND code = ?");
  stmt.bind([cleanName, cleanCode]);

  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return { id: row.id as string, name: row.name as string, code: row.code as string };
  }
  stmt.free();

  // 🛠️ إذا لم يُوجد → نقوم بإنشائه
  const newId = crypto.randomUUID();
  const insertStmt = this.db.prepare("INSERT INTO levels (id, name, code) VALUES (?, ?, ?)");
  insertStmt.run([newId, cleanName, cleanCode]);
  insertStmt.free();
return { id: newId, name: cleanName, code: cleanCode };
}



async getStudentsByLevelAndSection(levelId: string, sectionId: string): Promise<any[]> {
  const stmt = this.db.prepare(`
    SELECT * FROM students
    WHERE levelId = ? AND sectionId = ?
    AND status = 'متمدرس'
  `);

  stmt.bind([levelId, sectionId]);

  const students: any[] = [];
  while (stmt.step()) {
    students.push(stmt.getAsObject());
  }

  stmt.free();
  return students;
}

    



 
 
  // الحصول على أو إنشاء قسم
  async getOrCreateSection(sectionName: string, levelId: string): Promise<string> {
    try {
      const cleanSectionName = sectionName.trim();
      
      // البحث عن القسم الموجود في نفس المستوى
      const stmt = this.db.prepare('SELECT id FROM sections WHERE name = ? AND levelId = ?');
      const existingSection = stmt.get(cleanSectionName, levelId);
      stmt.free();
      
      if (existingSection) {
        return (existingSection as any).id;
      }
       
      // إنشاء قسم جديد
      const sectionId = crypto.randomUUID();
      const insertStmt = this.db.prepare(`
        INSERT INTO sections (id, name, levelId, createdAt) 
        VALUES (?, ?, ?, ?)
      `);
      insertStmt.run(sectionId, cleanSectionName, levelId, new Date().toISOString());
      insertStmt.free();
      
      console.log(`✅ تم إنشاء قسم جديد: ${cleanSectionName} في المستوى ${levelId} - ID: ${sectionId}`);
      return sectionId;
      
    } catch (error) {
      console.error('خطأ في إنشاء القسم:', error);
      throw error;
    }
  }   

  private async openIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  private async loadFromIndexedDB(): Promise<Uint8Array | null> {
    try {
      const db = await this.openIndexedDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.get('data');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const result = request.result;
          if (result && result.data) {
            resolve(new Uint8Array(result.data));
          } else {
            resolve(null);
          }
        };
      });
    } catch (error) {
      console.warn('خطأ في تحميل البيانات من IndexedDB:', error);
      return null;
    }
  }

  private async saveToIndexedDB(data: Uint8Array): Promise<void> {
    try {
      const db = await this.openIndexedDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      store.put({ data: Array.from(data) }, 'data');

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } catch (error) {
      console.error('خطأ في حفظ البيانات إلى IndexedDB:', error);
      throw error;
    }
  }

  private migrateAttendanceCloudLinks() {
    const schema = this.db.exec(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'attendance_cloud_links'"
    )[0]?.values[0]?.[0];
    if (!schema || String(schema).includes("'schedule'")) return;

    // CREATE TABLE IF NOT EXISTS does not update CHECK constraints in saved databases.
    // Rebuild within a savepoint so existing links survive any migration failure.
    this.db.run('SAVEPOINT migrate_attendance_cloud_links');
    try {
      this.db.run(`CREATE TABLE attendance_cloud_links_migrated (
        record_type TEXT NOT NULL CHECK (record_type IN ('student', 'teacher', 'schedule')),
        local_ref TEXT NOT NULL,
        cloud_id TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        PRIMARY KEY (record_type, local_ref),
        UNIQUE (record_type, cloud_id)
      )`);
      this.db.run(`INSERT INTO attendance_cloud_links_migrated (record_type, local_ref, cloud_id, updatedAt)
        SELECT record_type, local_ref, cloud_id, updatedAt FROM attendance_cloud_links`);
      this.db.run('DROP TABLE attendance_cloud_links');
      this.db.run('ALTER TABLE attendance_cloud_links_migrated RENAME TO attendance_cloud_links');
      this.db.run('RELEASE SAVEPOINT migrate_attendance_cloud_links');
    } catch (error) {
      this.db.run('ROLLBACK TO SAVEPOINT migrate_attendance_cloud_links');
      this.db.run('RELEASE SAVEPOINT migrate_attendance_cloud_links');
      throw error;
    }
  }

  private async createTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS local_admin_access (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        credentials TEXT NOT NULL
      )`,
      // جدول المستويات
      `CREATE TABLE IF NOT EXISTS levels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        code TEXT,
        createdAt TEXT NOT NULL
      )`,

      // جدول الأقسام
      `CREATE TABLE IF NOT EXISTS sections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        levelId TEXT,
        code TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (levelId) REFERENCES levels(id)
      )`,

      // جدول السنوات الدراسية
      `CREATE TABLE IF NOT EXISTS academic_years (
        id TEXT PRIMARY KEY,
        year TEXT NOT NULL UNIQUE,
        startDate TEXT,
        endDate TEXT,
        isActive BOOLEAN DEFAULT 0,
        createdAt TEXT NOT NULL
      )`,

      // جدول التلاميذ المحدث
      `CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        firstName TEXT NOT NULL,
        lastName TEXT NOT NULL,
        nationalId TEXT UNIQUE NOT NULL,
        gender TEXT CHECK(gender IN ('ذكر', 'أنثى')) NOT NULL,
        birthPlace TEXT,
        dateOfBirth TEXT,
        email TEXT,
        phone TEXT,
        studentId TEXT,
        grade TEXT,
        section TEXT,
        level TEXT,
        levelId TEXT,
        sectionId TEXT,
        enrollmentDate TEXT NOT NULL,
        address TEXT,
        emergencyContact TEXT,
        emergencyPhone TEXT,
        guardianName TEXT,
        guardianPhone TEXT,
        guardianRelation TEXT,
        socialSupport BOOLEAN DEFAULT 0,
        transportService BOOLEAN DEFAULT 0,
        medicalInfo TEXT,
        notes TEXT,
        status TEXT CHECK(status IN ('نشط', 'غير نشط', 'متخرج', 'منقول', 'منسحب', 'متمدرس', 'منقطع', 'مفصول', 'غير ملتحق')) DEFAULT 'نشط',
        ageGroup TEXT,
        schoolType TEXT,
        academicYear TEXT,
        region TEXT,
        province TEXT,
        municipality TEXT,
        institution TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (levelId) REFERENCES levels(id),
        FOREIGN KEY (sectionId) REFERENCES sections(id),
        FOREIGN KEY (academicYear) REFERENCES academic_years(year)
      )`,

      // إعادة إنشاء جدول سجلات الحضور مع القيود الجديدة
      `DROP TABLE IF EXISTS attendance_records`,
      `CREATE TABLE attendance_records (
        id TEXT PRIMARY KEY,
        studentId TEXT NOT NULL,
        date TEXT NOT NULL,
        status TEXT CHECK(status IN ('حاضر', 'غائب', 'متأخر', 'معذور', 'غياب مبرر', 'مخالفة', 'مسجل')) NOT NULL,
        period TEXT,
        subject TEXT,
        notes TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE
      )`,

      // جدول نقط المراقبة المستمرة
      `CREATE TABLE IF NOT EXISTS grade_records (
        id TEXT PRIMARY KEY,
        studentId TEXT NOT NULL,
        subject TEXT NOT NULL,
        grade REAL NOT NULL,
        maxGrade REAL NOT NULL DEFAULT 20,
        assignmentType TEXT CHECK(assignmentType IN ('امتحان نهائي', 'امتحان نصفي', 'اختبار قصير', 'واجب منزلي', 'مشروع', 'مشاركة صفية', 'امتحان شفهي', 'مراقبة مستمرة')) NOT NULL,
        semester TEXT CHECK(semester IN ('الفصل الأول', 'الفصل الثاني', 'الفصل الثالث')),
        academicYear TEXT,
        date TEXT NOT NULL,
        notes TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE
      )`,

      // جدول الأكواد السرية
      `CREATE TABLE IF NOT EXISTS credentials (
        student_id TEXT PRIMARY KEY,
        secret_code TEXT NOT NULL,
        issue_date TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students(nationalId) ON DELETE CASCADE
      )`,

      // إنشاء جدول إحصائيات التوجيه
      `CREATE TABLE IF NOT EXISTS guidance_statistics (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        student_id TEXT NOT NULL,
        assigned_stream TEXT,
        gender TEXT,
        decision TEXT,
        academic_year TEXT,
        level TEXT,
        section TEXT,
        age INTEGER,
        ageGroup TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(nationalId)
      )`,

  
`CREATE TABLE IF NOT EXISTS activation_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT UNIQUE,
  national_id TEXT,
  code TEXT UNIQUE,
  used INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
)`,
'CREATE INDEX IF NOT EXISTS idx_activation_codes_student_id ON activation_codes(student_id)',
'CREATE INDEX IF NOT EXISTS idx_activation_codes_national_id ON activation_codes(national_id)',
'CREATE INDEX IF NOT EXISTS idx_activation_codes_code ON activation_codes(code)',
      // الجداول الإضافية حسب المخطط
      `CREATE TABLE IF NOT EXISTS classes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        level_id TEXT,
        academic_year_id TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (level_id) REFERENCES levels(id),
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
      )`,

      `CREATE TABLE IF NOT EXISTS council_decisions (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        national_id TEXT,
        decision TEXT CHECK(decision IN ('ينتقل', 'يكرر', 'يفصل', 'إعادة إدماج', 'تنويه', 'تشجيع', 'لوحة الشرف', 'تنبيه', 'إنذار', 'توبيخ')) NOT NULL,
        source_metric TEXT,
        value REAL,
        generated BOOLEAN DEFAULT 0,
        note TEXT,
        decision_date TEXT NOT NULL,
        desired_stream TEXT,
        age INTEGER,
        level TEXT,
        section TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS dropouts (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        dropout_date TEXT NOT NULL,
        reason TEXT,
        metadata TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS reintegration (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        reintegration_date TEXT NOT NULL,
        previous_status TEXT,
        metadata TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS parents (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        relation TEXT CHECK(relation IN ('أب', 'أم', 'مكلف', 'ولي')) NOT NULL,
        parent_name TEXT NOT NULL,
        phone_1 TEXT,
        phone_2 TEXT,
        address TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS exams (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        subject TEXT NOT NULL,
        exam_type TEXT CHECK(exam_type IN ('محلي', 'جهوي', 'وطني')) NOT NULL,
        grade_value REAL NOT NULL,
        max_grade REAL NOT NULL DEFAULT 20,
        exam_date TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS averages (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        term TEXT CHECK(term IN ('1', '2', 'سنوي')) NOT NULL,
        average_value REAL NOT NULL,
        academic_year TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (academic_year) REFERENCES academic_years(year)
      )`,

      `CREATE TABLE IF NOT EXISTS transfers (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        transfer_type TEXT CHECK(transfer_type IN ('وافد', 'مغادر')) NOT NULL,
        from_school TEXT,
        to_school TEXT,
        to_province TEXT,
        to_academy TEXT,
        transfer_date TEXT NOT NULL,
        metadata TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS mobility_records (
        id TEXT PRIMARY KEY,
        record_type TEXT NOT NULL,
        student_id TEXT NOT NULL DEFAULT '',
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS absentees (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        status_date TEXT NOT NULL,
        note TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      )`,

      // جدول المفصولين
      `CREATE TABLE IF NOT EXISTS dismissed_students (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        dismissal_date TEXT NOT NULL,
        reason TEXT,
        metadata TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      )`,

      // جدول التلاميذ غير الملتحقين
      `CREATE TABLE IF NOT EXISTS unenrolled_students (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        lastName TEXT NOT NULL,
        firstName TEXT NOT NULL,
        gender TEXT,
        dateOfBirth TEXT,
        birthPlace TEXT,
        metadata TEXT,
        createdAt TEXT NOT NULL
      )`,

      // جدول إعدادات المؤسسة
 `CREATE TABLE IF NOT EXISTS institution_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academy TEXT,
  directorate TEXT,
  municipality TEXT,
  institution TEXT,
  academicYear TEXT,
  institutionCode TEXT,
  supabaseInstitutionId TEXT,
  institutionActivationCode TEXT,
  institutionSlug TEXT,
  institutionPhone TEXT,
  institutionEmail TEXT,
  licenseKey TEXT,
  subscriptionPlan TEXT,
  updatedAt TEXT NOT NULL
)`,

      // جدول جداول الحصص (من ProgMawarid)
      `CREATE TABLE IF NOT EXISTS timetable (
        id TEXT PRIMARY KEY,
        teacher_name_arabic TEXT,
        teacher_name_french TEXT,
        teacher_id TEXT,
        ppr TEXT,
        subject_code TEXT,
        subject_arabic TEXT,
        class TEXT NOT NULL,
        room_code TEXT,
        room_name TEXT,
        day TEXT,
        day_arabic TEXT,
        time_slot TEXT,
        start_time TEXT,
        end_time TEXT,
        activity_id TEXT,
        tags TEXT,
        createdAt TEXT NOT NULL
      )`,

      // جدول توزيع الأساتذة على الأقسام (من ProgMawarid)
      `CREATE TABLE IF NOT EXISTS teacher_assignments (
        id TEXT PRIMARY KEY,
        teacher_arabic TEXT,
        teacher_french TEXT,
        teacher_id TEXT,
        ppr TEXT,
        class TEXT NOT NULL,
        subject_code TEXT,
        subject_arabic TEXT,
        createdAt TEXT NOT NULL
      )`,

      // جدول المواد الدراسية (يتم ملؤه تلقائياً من جدول الحصص)
      `CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE,
        name_arabic TEXT NOT NULL,
        name_french TEXT,
        createdAt TEXT NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS attendance_cloud_links (
        record_type TEXT NOT NULL CHECK (record_type IN ('student', 'teacher', 'schedule')),
        local_ref TEXT NOT NULL,
        cloud_id TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        PRIMARY KEY (record_type, local_ref),
        UNIQUE (record_type, cloud_id)
      )`,

      `CREATE TABLE IF NOT EXISTS attendance_received (
        institution_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        revision TEXT NOT NULL,
        payload TEXT NOT NULL,
        received_at TEXT NOT NULL,
        PRIMARY KEY (institution_id, session_id)
      )`,

      `CREATE TABLE IF NOT EXISTS attendance_sync_success (
        user_id TEXT PRIMARY KEY,
        institution_id TEXT NOT NULL,
        succeeded_at TEXT NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS attendance_teacher_roster (
        national_id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        username TEXT,
        updatedAt TEXT NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS attendance_subject_mappings (
        subject_code TEXT PRIMARY KEY,
        subject_name_arabic TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS attendance_local_justifications (
        mark_id TEXT PRIMARY KEY,
        status TEXT NOT NULL CHECK (status IN ('justified', 'unjustified')),
        note TEXT NOT NULL DEFAULT '',
        updatedBy TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`,

      // جدول نماذج الرسائل
      `CREATE TABLE IF NOT EXISTS message_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        createdAt TEXT NOT NULL
      )`,

      // جدول إعدادات WhatsApp - Evolution API
      `CREATE TABLE IF NOT EXISTS whatsapp_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        evolution_api_url TEXT,
        evolution_instance_name TEXT,
        evolution_api_key TEXT,
        is_active INTEGER DEFAULT 1
      )`,

      `CREATE TABLE IF NOT EXISTS discipline_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'negative',
        severity INTEGER,
        createdAt TEXT NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS discipline_actions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        createdAt TEXT NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS student_incidents (
        id TEXT PRIMARY KEY,
        studentId TEXT NOT NULL,
        studentName TEXT NOT NULL,
        section TEXT,
        kind TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        incidentDate TEXT NOT NULL,
        incidentTime TEXT NOT NULL,
        location TEXT NOT NULL,
        details TEXT NOT NULL,
        categoryId TEXT NOT NULL,
        categoryName TEXT NOT NULL,
        severity INTEGER,
        points REAL NOT NULL DEFAULT 0,
        reporterType TEXT NOT NULL,
        reporterName TEXT,
        actions TEXT NOT NULL DEFAULT '[]',
        reviewedAt TEXT,
        reviewedBy TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE
      )`,

      'CREATE INDEX IF NOT EXISTS idx_student_incidents_student ON student_incidents(studentId)',
      'CREATE INDEX IF NOT EXISTS idx_student_incidents_date ON student_incidents(incidentDate)',
      'CREATE INDEX IF NOT EXISTS idx_student_incidents_status ON student_incidents(status)'
    ];

    for (const tableSQL of tables) {
      this.db.run(tableSQL);
    }

    this.migrateAttendanceCloudLinks();

    const getColumnNames = (tableName: string): string[] => {
      const columnStmt = this.db.prepare(`PRAGMA table_info(${tableName})`);
      const columns: string[] = [];
      try {
        while (columnStmt.step()) {
          columns.push(String(columnStmt.getAsObject().name));
        }
      } finally {
        columnStmt.free();
      }
      return columns;
    };

    const categoryColumns = getColumnNames('discipline_categories');
    if (!categoryColumns.includes('kind')) {
      this.db.run("ALTER TABLE discipline_categories ADD COLUMN kind TEXT NOT NULL DEFAULT 'negative'");
    }

    const incidentColumns = getColumnNames('student_incidents');
    if (!incidentColumns.includes('kind')) {
      this.db.run("ALTER TABLE student_incidents ADD COLUMN kind TEXT NOT NULL DEFAULT 'negative'");
    }
    if (!incidentColumns.includes('status')) {
      this.db.run("ALTER TABLE student_incidents ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'");
    }
    if (!incidentColumns.includes('points')) {
      this.db.run('ALTER TABLE student_incidents ADD COLUMN points REAL NOT NULL DEFAULT 0');
    }
    if (!incidentColumns.includes('reviewedAt')) {
      this.db.run('ALTER TABLE student_incidents ADD COLUMN reviewedAt TEXT');
    }
    if (!incidentColumns.includes('reviewedBy')) {
      this.db.run('ALTER TABLE student_incidents ADD COLUMN reviewedBy TEXT');
    }

    for (const category of DEFAULT_DISCIPLINE_CATEGORIES) {
      this.db.run(
        'INSERT OR IGNORE INTO discipline_categories (id, name, kind, severity, createdAt) VALUES (?, ?, ?, ?, ?)',
        [category.id, category.name, category.kind, category.severity ?? 1, category.createdAt]
      );
    }
    for (const action of DEFAULT_DISCIPLINE_ACTIONS) {
      this.db.run(
        'INSERT OR IGNORE INTO discipline_actions (id, name, createdAt) VALUES (?, ?, ?)',
        [action.id, action.name, action.createdAt]
      );
    }

 
    // ترحيل جدول whatsapp_settings من الهيكل القديم إلى الجديد
   // ترحيل جدول institution_settings لإضافة الأعمدة الجديدة إذا كانت القاعدة قديمة
 try {
  const stmt = this.db.prepare("PRAGMA table_info(institution_settings)");
  const columns: any[] = [];

  while (stmt.step()) {
    columns.push(stmt.getAsObject());
  }
  stmt.free();

  const columnNames = columns.map((col: any) => col.name);

  if (!columnNames.includes("institutionCode")) {
    this.db.run(`ALTER TABLE institution_settings ADD COLUMN institutionCode TEXT`);
  }

  if (!columnNames.includes("supabaseInstitutionId")) {
    this.db.run(`ALTER TABLE institution_settings ADD COLUMN supabaseInstitutionId TEXT`);
  }

  if (!columnNames.includes("institutionActivationCode")) {
    this.db.run(`ALTER TABLE institution_settings ADD COLUMN institutionActivationCode TEXT`);
  }

  if (!columnNames.includes("institutionSlug")) {
    this.db.run(`ALTER TABLE institution_settings ADD COLUMN institutionSlug TEXT`);
  }

  if (!columnNames.includes("institutionPhone")) {
    this.db.run(`ALTER TABLE institution_settings ADD COLUMN institutionPhone TEXT`);
  }

  if (!columnNames.includes("institutionEmail")) {
    this.db.run(`ALTER TABLE institution_settings ADD COLUMN institutionEmail TEXT`);
  }

  if (!columnNames.includes("licenseKey")) {
    this.db.run(`ALTER TABLE institution_settings ADD COLUMN licenseKey TEXT`);
  }

  if (!columnNames.includes("subscriptionPlan")) {
    this.db.run(`ALTER TABLE institution_settings ADD COLUMN subscriptionPlan TEXT`);
  }

  console.log("✅ تم ترحيل institution_settings بنجاح");
} catch (error) {
  console.error("❌ خطأ في ترحيل institution_settings:", error);
}

    // إنشاء فهارس لتحسين الأداء
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_students_nationalId ON students(nationalId)',
      'CREATE INDEX IF NOT EXISTS idx_students_levelId ON students(levelId)',
      'CREATE INDEX IF NOT EXISTS idx_students_sectionId ON students(sectionId)',
      'CREATE INDEX IF NOT EXISTS idx_students_status ON students(status)',
      'CREATE INDEX IF NOT EXISTS idx_mobility_records_type ON mobility_records(record_type)',
      'CREATE INDEX IF NOT EXISTS idx_mobility_records_student ON mobility_records(student_id)',
      'CREATE INDEX IF NOT EXISTS idx_attendance_studentId ON attendance_records(studentId)',
      'CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date)',
      'CREATE INDEX IF NOT EXISTS idx_grades_studentId ON grade_records(studentId)',
      'CREATE INDEX IF NOT EXISTS idx_grades_subject ON grade_records(subject)',
      'CREATE INDEX IF NOT EXISTS idx_sections_levelId ON sections(levelId)',
      'CREATE INDEX IF NOT EXISTS idx_timetable_class ON timetable(class)',
      'CREATE INDEX IF NOT EXISTS idx_timetable_day ON timetable(day)',
      'CREATE INDEX IF NOT EXISTS idx_timetable_class_day ON timetable(class, day)',
      'CREATE INDEX IF NOT EXISTS idx_teacher_assignments_class ON teacher_assignments(class)',
      'CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher ON teacher_assignments(teacher_id)',
      'CREATE INDEX IF NOT EXISTS idx_subjects_code ON subjects(code)'
    ];

    for (const indexSQL of indexes) {
      this.db.run(indexSQL);
    }

    await this.saveDatabase();
  }

  async getDisciplineCategories(): Promise<DisciplineCategory[]> {
    const stmt = this.db.prepare('SELECT * FROM discipline_categories ORDER BY kind, severity, name');
    const categories: DisciplineCategory[] = [];
    try {
      while (stmt.step()) {
        const row = stmt.getAsObject();
        const kind = String(row.kind) as DisciplineRecordKind;
        categories.push({
          id: String(row.id),
          name: String(row.name),
          kind,
          severity: kind === 'negative' ? Number(row.severity) as DisciplineCategory['severity'] : null,
          createdAt: String(row.createdAt),
        });
      }
    } finally {
      stmt.free();
    }
    return categories;
  }

  async saveDisciplineCategory(category: Pick<DisciplineCategory, 'id' | 'name' | 'kind' | 'severity'>): Promise<void> {
    const createdAt = new Date().toISOString();
    this.db.run(
      `INSERT INTO discipline_categories (id, name, kind, severity, createdAt) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, kind = excluded.kind, severity = excluded.severity`,
      [category.id, category.name.trim(), category.kind, category.severity ?? 1, createdAt]
    );
    await this.saveDatabase();
  }

  async deleteDisciplineCategory(id: string): Promise<void> {
    this.db.run('DELETE FROM discipline_categories WHERE id = ?', [id]);
    await this.saveDatabase();
  }

  async getDisciplineActions(): Promise<DisciplineAction[]> {
    const stmt = this.db.prepare('SELECT * FROM discipline_actions ORDER BY name');
    const actions: DisciplineAction[] = [];
    try {
      while (stmt.step()) {
        const row = stmt.getAsObject();
        actions.push({ id: String(row.id), name: String(row.name), createdAt: String(row.createdAt) });
      }
    } finally {
      stmt.free();
    }
    return actions;
  }

  async saveDisciplineAction(action: Pick<DisciplineAction, 'id' | 'name'>): Promise<void> {
    this.db.run(
      `INSERT INTO discipline_actions (id, name, createdAt) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
      [action.id, action.name.trim(), new Date().toISOString()]
    );
    await this.saveDatabase();
  }

  async deleteDisciplineAction(id: string): Promise<void> {
    this.db.run('DELETE FROM discipline_actions WHERE id = ?', [id]);
    await this.saveDatabase();
  }

  async getStudentIncidents(studentId?: string): Promise<StudentIncident[]> {
    const query = studentId
      ? 'SELECT * FROM student_incidents WHERE studentId = ? ORDER BY incidentDate DESC, incidentTime DESC, createdAt DESC'
      : 'SELECT * FROM student_incidents ORDER BY incidentDate DESC, incidentTime DESC, createdAt DESC';
    const stmt = this.db.prepare(query);
    const incidents: StudentIncident[] = [];
    try {
      if (studentId) stmt.bind([studentId]);
      while (stmt.step()) {
        const row = stmt.getAsObject();
        incidents.push({
          id: String(row.id),
          studentId: String(row.studentId),
          studentName: String(row.studentName),
          section: String(row.section ?? ''),
          kind: String(row.kind) as DisciplineRecordKind,
          status: String(row.status) as DisciplineRecordStatus,
          incidentDate: String(row.incidentDate),
          incidentTime: String(row.incidentTime),
          location: String(row.location),
          details: String(row.details),
          categoryId: String(row.categoryId),
          categoryName: String(row.categoryName),
          severity: String(row.kind) === 'negative' ? Number(row.severity) as StudentIncident['severity'] : null,
          points: Number(row.points) || 0,
          reporterType: String(row.reporterType) as StudentIncident['reporterType'],
          reporterName: String(row.reporterName ?? ''),
          actions: JSON.parse(String(row.actions || '[]')) as string[],
          reviewedAt: row.reviewedAt == null ? null : String(row.reviewedAt),
          reviewedBy: row.reviewedBy == null ? null : String(row.reviewedBy),
          createdAt: String(row.createdAt),
        });
      }
    } finally {
      stmt.free();
    }
    return incidents;
  }

  async addStudentIncident(incident: NewStudentIncident): Promise<string> {
    const studentStmt = this.db.prepare('SELECT id FROM students WHERE id = ?');
    studentStmt.bind([incident.studentId]);
    const studentExists = studentStmt.step();
    studentStmt.free();
    if (!studentExists) throw new Error('التلميذ المحدد غير موجود في قاعدة بيانات المؤسسة.');

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    this.db.run(
      `INSERT INTO student_incidents (
        id, studentId, studentName, section, kind, status, incidentDate, incidentTime,
        location, details, categoryId, categoryName, severity, points, reporterType,
        reporterName, actions, reviewedAt, reviewedBy, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, incident.studentId, incident.studentName, incident.section, incident.kind,
        incident.status, incident.incidentDate, incident.incidentTime, incident.location,
        incident.details, incident.categoryId, incident.categoryName, incident.severity ?? 1,
        incident.points, incident.reporterType, incident.reporterName, JSON.stringify(incident.actions),
        incident.reviewedAt, incident.reviewedBy, createdAt,
      ]
    );
    await this.saveDatabase();
    return id;
  }

  async reviewStudentIncident(id: string, status: Extract<DisciplineRecordStatus, 'approved' | 'rejected'>, reviewer?: string): Promise<void> {
    this.db.run(
      `UPDATE student_incidents SET status = ?, reviewedAt = ?, reviewedBy = ?
       WHERE id = ? AND status = 'pending'`,
      [status, new Date().toISOString(), reviewer?.trim() || null, id]
    );
    if (this.db.getRowsModified() === 0) {
      throw new Error('تعذر تحديث الملاحظة؛ ربما تمت مراجعتها من قبل.');
    }
    await this.saveDatabase();
  }
////////////////////// levelssssssssssssssssssssssssss
  // إدارة المستويات
  async addLevel(level: Omit<Level, 'id' | 'createdAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    
    this.db.run(
      'INSERT INTO levels (id, name, code, createdAt) VALUES (?, ?, ?, ?)',
      [id, level.name, level.code || '', createdAt]
    );
    
    await this.saveDatabase();
    return id;
  }


  // الحصول على جميع المستويات
  async getLevels(): Promise<{ id: string; code: string; name: string; createdAt: string }[]> {
    if (!this.db) {
      console.warn('قاعدة البيانات غير مهيأة في getLevels');
      return [];
    }

    try {
      const stmt = this.db.prepare('SELECT * FROM levels ORDER BY name');
      const rows: Level[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as Level);
      }
      stmt.free();
      return rows;
    } catch (error) {
      console.error('خطأ في جلب المستويات:', error);
      return [];
    }
  }

  async getLevelByName(name: string): Promise<Level | null> {
    const stmt = this.db.prepare('SELECT * FROM levels WHERE name = ?');
    try {
      stmt.bind([name]);
      
      if (stmt.step()) {
        return stmt.getAsObject() as Level;
      }
      
      return null;
    } finally {
      stmt.free();
    }
  }

  // إدارة الأقسام
  async addSection(section: Omit<Section, 'id' | 'createdAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    
    this.db.run(
      'INSERT INTO sections (id, name, levelId, code, createdAt) VALUES (?, ?, ?, ?, ?)',
      [id, section.name, section.levelId, section.code || '', createdAt]
    );
    
    await this.saveDatabase();
    return id;
  }

  // الحصول على جميع الأقسام
  async getSections(): Promise<{ id: string; name: string; levelId: string; createdAt: string }[]> {
    if (!this.db) {
      console.warn('قاعدة البيانات غير مهيأة في getSections');
      return [];
    }

    try {
      const stmt = this.db.prepare('SELECT * FROM sections ORDER BY name');
      const sections: any[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        sections.push ({
          class_id: row.id,
          class_name: row.name,
          level_id: row.levelId
        } as Class);
      }
      stmt.free();
      return sections;
    } catch (error) {
      console.error('خطأ في جلب الأقسام:', error);
      return [];
    }
  }

  async getSectionByName(name: string): Promise<Section | null> {
    const stmt = this.db.prepare('SELECT * FROM sections WHERE name = ?');
    try {
      stmt.bind([name]);
      
      if (stmt.step()) {
        return stmt.getAsObject() as Section;
      }
      
      return null;
    } finally {
      stmt.free();
    }
  }

  // الحصول على الأقسام لمستوى معين
  async getSectionsByLevel(levelId: string): Promise<{ id: string; name: string; levelId: string }[]> {
    try {
      const stmt = this.db.prepare('SELECT * FROM sections WHERE levelId = ? ORDER BY name');
      const sections = stmt.all(levelId);
      stmt.free();
      return sections as any[];
    } catch (error) {
      console.error('خطأ في جلب أقسام المستوى:', error);
      return [];
    }
  }

  // إدارة السنوات الدراسية
  async addAcademicYear(year: Omit<AcademicYear, 'id' | 'createdAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    
    this.db.run(
      'INSERT INTO academic_years (id, year, startDate, endDate, isActive, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      [id, year.year, year.startDate || '', year.endDate || '', year.isActive ? 1 : 0, createdAt]
    );
    
    await this.saveDatabase();
    return id;
  }

  async getAcademicYears(): Promise<AcademicYear[]> {
    if (!this.db) {
      throw new Error('قاعدة البيانات غير متاحة - يرجى انتظار التهيئة');
    }
    
    const stmt = this.db.prepare('SELECT * FROM academic_years ORDER BY year DESC');
    try {
      const years: AcademicYear[] = [];
      
      while (stmt.step()) {
        const row = stmt.getAsObject() as any;
        years.push({
          ...row,
          isActive: Boolean(row.isActive)
        });
      }
      
      return years;
    } finally {
      stmt.free();
    }
  }

async updateStudentPhone(id: string, phone: string): Promise<void> {
  await this.initialize();

  this.db.run(
    `UPDATE students SET phone = ?, updatedAt = ? WHERE id = ?`,
    [phone, new Date().toISOString(), id]
  );

  await this.saveDatabase();
}

  async getAcademicYearByYear(year: string): Promise<AcademicYear | null> {
    const stmt = this.db.prepare('SELECT * FROM academic_years WHERE year = ?');
    try {
      stmt.bind([year]);
      
      if (stmt.step()) {
        const row = stmt.getAsObject() as any;
        return {
          ...row,
          isActive: Boolean(row.isActive)
        };
      }
      
      return null;
    } finally {
      stmt.free();
    }
  }

  // إدارة الإعدادات العامة للنظام
  async getCurrentAcademicYear(): Promise<string> {
    try {
      // محاولة الحصول على السنة النشطة من جدول academic_years
      const stmt = this.db.prepare('SELECT year FROM academic_years WHERE isActive = 1 LIMIT 1');
      if (stmt.step()) {
        const result = stmt.getAsObject();
        stmt.free();
        return result.year as string;
      }
      stmt.free();
      
      // إذا لم توجد سنة نشطة، البحث عن أحدث سنة
      const latestStmt = this.db.prepare('SELECT year FROM academic_years ORDER BY year DESC LIMIT 1');
      if (latestStmt.step()) {
        const result = latestStmt.getAsObject();
        latestStmt.free();
        return result.year as string;
      }
      latestStmt.free();
      
      // إذا لم توجد سنة نشطة، إرجاع السنة الافتراضية
      return '2025/2026';
    } catch (error) {
      console.warn('خطأ في الحصول على السنة الدراسية الحالية:', error);
      return '2025/2026';
    }
  }

  async setCurrentAcademicYear(year: string): Promise<void> {
    try {
      // إلغاء تفعيل جميع السنوات
      this.db.run('UPDATE academic_years SET isActive = 0');
      
      // تفعيل السنة المحددة أو إنشاؤها إذا لم تكن موجودة
      const existingYear = await this.getAcademicYearByYear(year);
      if (existingYear) {
        this.db.run('UPDATE academic_years SET isActive = 1 WHERE year = ?', [year]);
      } else {
        await this.addAcademicYear({
          year,
          startDate: '',
          endDate: '',
          isActive: true
        });
      }
      
      await this.saveDatabase();
    } catch (error) {
      console.error('خطأ في تعيين السنة الدراسية الحالية:', error);
      throw error;
    }
  }

async ensurePhoneImportColumns(): Promise<void> {
  await this.initialize();

  try {
    const stmt = this.db.prepare("PRAGMA table_info(students)");
    const columns: any[] = [];

    while (stmt.step()) {
      columns.push(stmt.getAsObject());
    }
    stmt.free();

    const columnNames = columns.map((c: any) => String(c.name || "").trim());

    if (!columnNames.includes("fatherPhone")) {
      this.db.run(`ALTER TABLE students ADD COLUMN fatherPhone TEXT`);
    }

    if (!columnNames.includes("motherPhone")) {
      this.db.run(`ALTER TABLE students ADD COLUMN motherPhone TEXT`);
    }

    if (!columnNames.includes("phoneSource")) {
      this.db.run(`ALTER TABLE students ADD COLUMN phoneSource TEXT`);
    }

    await this.saveDatabase();
    console.log("✅ تم التحقق من أعمدة استيراد الهواتف");
  } catch (error) {
    console.error("❌ خطأ أثناء ترحيل أعمدة استيراد الهواتف:", error);
    throw error;
  }
}


  // إدارة النقل والتحويلات
  async getLocalMobilityRecords<T>(recordType: string): Promise<T[]> {
    await this.initialize();
    const stmt = this.db.prepare(
      'SELECT payload FROM mobility_records WHERE record_type = ? ORDER BY rowid'
    );
    const records: T[] = [];

    try {
      stmt.bind([recordType]);
      while (stmt.step()) {
        const row = stmt.getAsObject() as { payload: string };
        records.push(JSON.parse(row.payload) as T);
      }
      return records;
    } finally {
      stmt.free();
    }
  }

  async saveLocalMobilityRecord(
    recordType: string,
    id: string,
    studentId: string,
    payload: unknown,
    createdAt: string
  ): Promise<void> {
    await this.initialize();
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO mobility_records (id, record_type, student_id, payload, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         record_type = excluded.record_type,
         student_id = excluded.student_id,
         payload = excluded.payload,
         updated_at = excluded.updated_at`,
      [id, recordType, studentId, JSON.stringify(payload), createdAt || now, now]
    );
    await this.saveDatabase();
  }

  async replaceLocalMobilityRecords(
    recordType: string,
    records: Array<{ id: string; studentId?: string; createdAt?: string }>
  ): Promise<void> {
    await this.initialize();
    this.db.run('BEGIN TRANSACTION');
    try {
      this.db.run('DELETE FROM mobility_records WHERE record_type = ?', [recordType]);
      const now = new Date().toISOString();
      for (const record of records) {
        this.db.run(
          `INSERT INTO mobility_records (id, record_type, student_id, payload, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            record.id,
            recordType,
            record.studentId || '',
            JSON.stringify(record),
            record.createdAt || now,
            now
          ]
        );
      }
      this.db.run('COMMIT');
      await this.saveDatabase();
    } catch (error) {
      this.db.run('ROLLBACK');
      throw error;
    }
  }

  async deleteLocalMobilityRecord(recordType: string, id: string): Promise<void> {
    await this.initialize();
    this.db.run(
      'DELETE FROM mobility_records WHERE record_type = ? AND id = ?',
      [recordType, id]
    );
    await this.saveDatabase();
  }

  async deleteLocalMobilityRecords(recordType: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.initialize();
    this.db.run('BEGIN TRANSACTION');
    try {
      for (const id of ids) {
        this.db.run(
          'DELETE FROM mobility_records WHERE record_type = ? AND id = ?',
          [recordType, id]
        );
      }
      this.db.run('COMMIT');
      await this.saveDatabase();
    } catch (error) {
      this.db.run('ROLLBACK');
      throw error;
    }
  }

  async clearLocalMobilityRecords(recordType: string): Promise<void> {
    await this.initialize();
    this.db.run('DELETE FROM mobility_records WHERE record_type = ?', [recordType]);
    await this.saveDatabase();
  }

  // إدارة النقل والتحويلات
  async addTransfer(transfer: {
    student_id: string;
    transfer_type: 'وافد' | 'مغادر';
    from_school: string;
    to_school: string;
    transfer_date: string;
    to_province?: string;
    to_academy?: string;
    metadata?: any;
  }): Promise<string> {
    // التحقق من وجود نقل سابق لنفس التلميذ في نفس السنة
    const existingTransfers = await this.getTransfers();
    const duplicateTransfer = existingTransfers.find(t => 
      t.student_id === transfer.student_id && 
      t.transfer_type === transfer.transfer_type &&
      t.metadata && 
      JSON.parse(t.metadata).academicYear === transfer.metadata?.academicYear
    );
    
    if (duplicateTransfer) {
      // تحديث السجل الموجود بدلاً من إضافة جديد
      this.db.run(`
        UPDATE transfers SET 
          from_school = ?, to_school = ?, transfer_date = ?, 
          to_province = ?, to_academy = ?, metadata = ?
        WHERE id = ?
      `, [
        transfer.from_school || '', transfer.to_school || '',
        transfer.transfer_date, transfer.to_province || '', 
        transfer.to_academy || '', JSON.stringify(transfer.metadata || {}),
        duplicateTransfer.id
      ]);
      
      await this.saveDatabase();
      return duplicateTransfer.id;
    }
    
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    
    this.db.run(`
      INSERT INTO transfers (
        id, student_id, transfer_type, from_school, to_school, 
        transfer_date, to_province, to_academy, metadata, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, transfer.student_id, transfer.transfer_type, 
      transfer.from_school || '', transfer.to_school || '',
      transfer.transfer_date, transfer.to_province || '', 
      transfer.to_academy || '', JSON.stringify(transfer.metadata || {}), createdAt
    ]);
    
    await this.saveDatabase();
    return id;
  }

  async getTransfers(): Promise<any[]> {
    const stmt = this.db.prepare('SELECT * FROM transfers ORDER BY transfer_date DESC');
    try {
      const transfers: any[] = [];
      
      while (stmt.step()) {
        const row = stmt.getAsObject() as any;
        transfers.push({
          ...row,
          metadata: row.metadata ? JSON.parse(row.metadata) : {}
        });
      }
      
      return transfers;
    } finally {
      stmt.free();
    }
  }

  // إدارة المنقطعين
  async addDropout(dropout: {
    student_id: string;
    dropout_date: string;
    reason?: string;
    metadata?: any;
  }): Promise<string> {
    // التحقق من وجود سجل انقطاع سابق
    const existingDropouts = await this.getDropouts();
    const duplicateDropout = existingDropouts.find(d => 
      d.student_id === dropout.student_id &&
      d.metadata && 
      JSON.parse(d.metadata).academicYear === dropout.metadata?.academicYear
    );
    
    if (duplicateDropout) {
      // تحديث السجل الموجود
      this.db.run(`
        UPDATE dropouts SET 
          dropout_date = ?, reason = ?, metadata = ?
        WHERE id = ?
      `, [
        dropout.dropout_date, dropout.reason || '', 
        JSON.stringify(dropout.metadata || {}), duplicateDropout.id
      ]);
      
      await this.saveDatabase();
      return duplicateDropout.id;
    }
    
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    
    this.db.run(`
      INSERT INTO dropouts (id, student_id, dropout_date, reason, metadata, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      id, dropout.student_id, dropout.dropout_date, 
      dropout.reason || '', JSON.stringify(dropout.metadata || {}), createdAt
    ]);
    
    await this.saveDatabase();
    return id;
  }

  async getDropouts(): Promise<any[]> {
    const stmt = this.db.prepare('SELECT * FROM dropouts ORDER BY dropout_date DESC');
    try {
      const dropouts: any[] = [];
      
      while (stmt.step()) {
        const row = stmt.getAsObject() as any;
        dropouts.push({
          ...row,
          metadata: row.metadata ? JSON.parse(row.metadata) : {}
        });
      }
      
      return dropouts;
    } finally {
      stmt.free();
    }
  }

  // إدارة المفصولين
  async addDismissedStudent(dismissed: {
    student_id: string;
    dismissal_date: string;
    reason?: string;
    metadata?: any;
  }): Promise<string> {
    // التحقق من وجود سجل فصل سابق
    const existingDismissed = await this.getDismissedStudents();
    const duplicateDismissed = existingDismissed.find(d => 
      d.student_id === dismissed.student_id &&
      d.metadata && 
      JSON.parse(d.metadata).academicYear === dismissed.metadata?.academicYear
    );
    
    if (duplicateDismissed) {
      // تحديث السجل الموجود
      this.db.run(`
        UPDATE dismissed_students SET 
          dismissal_date = ?, reason = ?, metadata = ?
        WHERE id = ?
      `, [
        dismissed.dismissal_date, dismissed.reason || '', 
        JSON.stringify(dismissed.metadata || {}), duplicateDismissed.id
      ]);
      
      await this.saveDatabase();
      return duplicateDismissed.id;
    }
    
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    
    this.db.run(`
      INSERT INTO dismissed_students (id, student_id, dismissal_date, reason, metadata, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      id, dismissed.student_id, dismissed.dismissal_date, 
      dismissed.reason || '', JSON.stringify(dismissed.metadata || {}), createdAt
    ]);
    
    await this.saveDatabase();
    return id;
  }

  async getDismissedStudents(): Promise<any[]> {
    const stmt = this.db.prepare('SELECT * FROM dismissed_students ORDER BY dismissal_date DESC');
    try {
      const dismissed: any[] = [];
      
      while (stmt.step()) {
        const row = stmt.getAsObject() as any;
        dismissed.push({
          ...row,
          metadata: row.metadata ? JSON.parse(row.metadata) : {}
        });
      }
      
      return dismissed;
    } finally {
      stmt.free();
    }
  }

  // إدارة المدمجين
  async addReintegration(reintegration: {
    student_id: string;
    reintegration_date: string;
    previous_status: string;
    metadata?: any;
  }): Promise<string> {
    // التحقق من وجود سجل إدماج سابق
    const existingReintegrations = await this.getReintegrations();
    const duplicateReintegration = existingReintegrations.find(r => 
      r.student_id === reintegration.student_id &&
      r.metadata && 
      JSON.parse(r.metadata).academicYear === reintegration.metadata?.academicYear
    );
    
    if (duplicateReintegration) {
      // تحديث السجل الموجود
      this.db.run(`
        UPDATE reintegration SET 
          reintegration_date = ?, previous_status = ?, metadata = ?
        WHERE id = ?
      `, [
        reintegration.reintegration_date, reintegration.previous_status, 
        JSON.stringify(reintegration.metadata || {}), duplicateReintegration.id
      ]);
      
      await this.saveDatabase();
      return duplicateReintegration.id;
    }
    
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    
    this.db.run(`
      INSERT INTO reintegration (id, student_id, reintegration_date, previous_status, metadata, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      id, reintegration.student_id, reintegration.reintegration_date, 
      reintegration.previous_status, JSON.stringify(reintegration.metadata || {}), createdAt
    ]);
    
    await this.saveDatabase();
    return id;
  }

  async getReintegrations(): Promise<any[]> {
    const stmt = this.db.prepare('SELECT * FROM reintegration ORDER BY reintegration_date DESC');
    try {
      const reintegrations: any[] = [];
      
      while (stmt.step()) {
        const row = stmt.getAsObject() as any;
        reintegrations.push({
          ...row,
          metadata: row.metadata ? JSON.parse(row.metadata) : {}
        });
      }
      
      return reintegrations;
    } finally {
      stmt.free();
    }
  }

  // إدارة التلاميذ غير الملتحقين
  async addUnenrolledStudent(student: {
    student_id: string;
    lastName: string;
    firstName: string;
    gender: string;
    dateOfBirth: string;
    birthPlace: string;
    metadata?: any;
  }): Promise<string> {
    // التحقق من وجود سجل عدم التحاق سابق
    const existingUnenrolled = await this.getUnenrolledStudents();
    const duplicateUnenrolled = existingUnenrolled.find(u => 
      u.student_id === student.student_id &&
      u.metadata && 
      JSON.parse(u.metadata).academicYear === student.metadata?.academicYear
    );
    
    if (duplicateUnenrolled) {
      // تحديث السجل الموجود
      this.db.run(`
        UPDATE unenrolled_students SET 
          lastName = ?, firstName = ?, gender = ?, 
          dateOfBirth = ?, birthPlace = ?, metadata = ?
        WHERE id = ?
      `, [
        student.lastName, student.firstName, student.gender,
        student.dateOfBirth, student.birthPlace,
        JSON.stringify(student.metadata || {}), duplicateUnenrolled.id
      ]);
      
      await this.saveDatabase();
      return duplicateUnenrolled.id;
    }
    
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    
    this.db.run(`
      INSERT INTO unenrolled_students (
        id, student_id, lastName, firstName, gender, 
        dateOfBirth, birthPlace, metadata, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, student.student_id, student.lastName, student.firstName,
      student.gender, student.dateOfBirth, student.birthPlace,
      JSON.stringify(student.metadata || {}), createdAt
    ]);
    
    await this.saveDatabase();
    return id;
  }

  async getUnenrolledStudents(): Promise<any[]> {
    const stmt = this.db.prepare('SELECT * FROM unenrolled_students ORDER BY createdAt DESC');
    try {
      const students: any[] = [];
      
      while (stmt.step()) {
        const row = stmt.getAsObject() as any;
        students.push({
          ...row,
          metadata: row.metadata ? JSON.parse(row.metadata) : {}
        });
      }
      
      return students;
    } finally {
      stmt.free();
    }
  }
  // مقارنة لوائح الموسم الماضي مع الحالي
  async compareAcademicYears(currentYear: string, previousYear: string): Promise<{
    newStudents: any[];
    leftStudents: any[];
    continuingStudents: any[];
    stats: {
      continuityRate: number;
      growthRate: number;
      totalCurrent: number;
      totalPrevious: number;
    };
  }> {
    try {
      if (!this.db) {
        throw new Error('قاعدة البيانات غير متاحة - يرجى انتظار التهيئة');
      }
      
      // الحصول على تلاميذ السنة الحالية (المتمدرسين)
      const currentStudentsStmt = this.db.prepare('SELECT * FROM students WHERE academicYear = ? AND status = ?');
      currentStudentsStmt.bind([currentYear, 'متمدرس']);
      const currentStudents: any[] = [];
      while (currentStudentsStmt.step()) {
        currentStudents.push(currentStudentsStmt.getAsObject());
      }
      currentStudentsStmt.free();

      // الحصول على تلاميذ السنة الماضية (المتمدرسين)
      const previousStudentsStmt = this.db.prepare('SELECT * FROM students WHERE academicYear = ? AND status = ?');
      previousStudentsStmt.bind([previousYear, 'متمدرس']);
      const previousStudents: any[] = [];
      while (previousStudentsStmt.step()) {
        previousStudents.push(previousStudentsStmt.getAsObject());
      }
      previousStudentsStmt.free();

      console.log(`📊 مقارنة الموسمين:`, {
        currentYear,
        previousYear,
        currentCount: currentStudents.length,
        previousCount: previousStudents.length
      });
      // إنشاء خرائط للمقارنة السريعة
      const currentMap = new Map(currentStudents.map(s => [s.nationalId, s]));
      const previousMap = new Map(previousStudents.map(s => [s.nationalId, s]));

      // التلاميذ الجدد (موجودين في الحالي وغير موجودين في الماضي)
      const newStudents = currentStudents.filter(s => !previousMap.has(s.nationalId));

      // التلاميذ المغادرين (موجودين في الماضي وغير موجودين في الحالي)
      const leftStudents = previousStudents.filter(s => !currentMap.has(s.nationalId));

      // التلاميذ المستمرين (موجودين في كلا الموسمين)
      const continuingStudents = currentStudents.filter(s => previousMap.has(s.nationalId));

      // حساب الإحصائيات
      const continuityRate = previousStudents.length > 0 ? 
        Math.round((continuingStudents.length / previousStudents.length) * 100) : 0;
      
      const growthRate = previousStudents.length > 0 ? 
        Math.round(((currentStudents.length - previousStudents.length) / previousStudents.length) * 100) : 0;

      console.log(`📈 نتائج المقارنة:`, {
        newStudents: newStudents.length,
        leftStudents: leftStudents.length,
        continuingStudents: continuingStudents.length,
        continuityRate,
        growthRate
      });
      return {
        newStudents,
        leftStudents,
        continuingStudents,
        stats: {
          continuityRate,
          growthRate,
          totalCurrent: currentStudents.length,
          totalPrevious: previousStudents.length
        }
      };
    } catch (error) {
      console.error('خطأ في مقارنة السنوات الدراسية:', error);
      throw error;
    }
  }

  // إدارة الأكواد السرية
  async getCredentials(): Promise<any[]> {
    const stmt = this.db.prepare('SELECT * FROM credentials ORDER BY issue_date DESC');
    try {
      const credentials: any[] = [];
      
      while (stmt.step()) {
        credentials.push(stmt.getAsObject());
      }
      
      return credentials;
    } finally {
      stmt.free();
    }
  }

  async getCredentialByStudentId(studentId: string): Promise<any | null> {
    const stmt = this.db.prepare('SELECT * FROM credentials WHERE student_id = ?');
    try {
      stmt.bind([studentId]);
      
      if (stmt.step()) {
        return stmt.getAsObject();
      }
      
      return null;
    } finally {
      stmt.free();
    }
  }

  async addOrUpdateCredential(credential: any): Promise<void> {
    this.db.run(
      'INSERT OR REPLACE INTO credentials (student_id, secret_code, issue_date) VALUES (?, ?, ?)',
      [credential.student_id, credential.secret_code, credential.issue_date]
    );
    
    await this.saveDatabase();
  }

  async deleteCredential(studentId: string): Promise<void> {
    this.db.run('DELETE FROM credentials WHERE student_id = ?', [studentId]);
    await this.saveDatabase();
  }

  // إدارة قرارات المجالس
  async getCouncilDecisions(): Promise<any[]> {
    const stmt = this.db.prepare('SELECT * FROM council_decisions ORDER BY decision_date DESC');
    try {
      const decisions: any[] = [];
      
      while (stmt.step()) {
        decisions.push(stmt.getAsObject());
      }
      
      return decisions;
    } finally {
      stmt.free();
    }
  }

  // إدارة إحصائيات التوجيه
  async initGuidanceDatabase(): Promise<void> {
    // حذف الجدول الموجود وإعادة إنشاؤه
    try {
      this.db.run('DROP TABLE IF EXISTS guidance_statistics');
    } catch (error) {
      console.warn('لا يمكن حذف جدول guidance_statistics:', error);
    }
    
    // إنشاء الجدول من جديد
    this.db.run(`
      CREATE TABLE guidance_statistics (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        student_id TEXT NOT NULL,
        assigned_stream TEXT,
        gender TEXT,
        decision TEXT,
        academic_year TEXT,
        level TEXT,
        section TEXT,
        age INTEGER,
        ageGroup TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT,
        FOREIGN KEY (levelId) REFERENCES levels(id),
        FOREIGN KEY (sectionId) REFERENCES sections(id)
      )
    `);
   
// جدول المستويات
this.db.exec(`
  CREATE TABLE IF NOT EXISTS levels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    code TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// جدول الأقسام
this.db.exec(`
  CREATE TABLE IF NOT EXISTS sections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    levelId TEXT NOT NULL,
    code TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (levelId) REFERENCES levels(id)
  )
`);
    
    await this.saveDatabase();
  }

  async getGuidanceStatistics(): Promise<any> {
    try {
      const stmt = this.db.prepare('SELECT * FROM guidance_statistics ORDER BY createdAt DESC');
      const records: any[] = [];
      
      while (stmt.step()) {
        records.push(stmt.getAsObject());
      }
      stmt.free();
      
      return {
        totalStudents: records.length,
        records: records
      };
    } catch (error) {
      console.warn('خطأ في جلب إحصائيات التوجيه:', error);
      return {
        totalStudents: 0,
        records: []
      };
    }
  }

  async addGuidanceStatistic(statistic: any): Promise<string> {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    
    this.db.run(`
      INSERT INTO guidance_statistics (
        id, student_id, assigned_stream, gender, decision, 
        academic_year, level, section, age, ageGroup, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, statistic.student_id, statistic.assigned_stream || '', 
      statistic.gender || '', statistic.decision || '', 
      statistic.academic_year || '', statistic.level || '', 
      statistic.section || '', statistic.age || null, 
      statistic.ageGroup || '', createdAt
    ]);
    
    await this.saveDatabase();
    return id;
  }

  async clearGuidanceStatistics(): Promise<void> {
    this.db.run('DELETE FROM guidance_statistics');
    await this.saveDatabase();
  }

  async resetGuidanceStatistics(): Promise<void> {
    await this.initGuidanceDatabase();
  }

  // تصدير واستيراد قاعدة البيانات
  async exportData(): Promise<Uint8Array> {
    if (!this.db) {
      throw new Error('قاعدة البيانات غير متاحة');
    }
    return this.db.export();
  }

  async readLocalAdmin(): Promise<string | null> {
    await this.initialize();
    const stmt = this.db.prepare('SELECT credentials FROM local_admin_access WHERE id = 1');
    try {
      return stmt.step() ? String(stmt.getAsObject().credentials) : null;
    } finally { stmt.free(); }
  }

  private localAdminWriteQueue: Promise<void> = Promise.resolve();

  async writeLocalAdmin(next: string, expected: string | null): Promise<void> {
    const write = this.localAdminWriteQueue.then(async () => {
      const previous = await this.readLocalAdmin();
      if (previous !== expected) throw new Error('تغيرت بيانات حساب الإدارة. أعد تحميل البرنامج ثم حاول مجددًا.');
      this.db.run('INSERT OR REPLACE INTO local_admin_access (id, credentials) VALUES (1, ?)', [next]);
      try {
        await this.saveDatabase();
      } catch (error) {
        if (previous === null) this.db.run('DELETE FROM local_admin_access WHERE id = 1');
        else this.db.run('UPDATE local_admin_access SET credentials = ? WHERE id = 1', [previous]);
        try { await this.saveDatabase(); } catch { /* Keep the in-memory credentials consistent with the last successful write. */ }
        throw error;
      }
    });
    this.localAdminWriteQueue = write.catch(() => undefined);
    return write;
  }

  async importData(data: Uint8Array): Promise<void> {
    await this.initialize();
    const SQL = await initSqlJs({
      locateFile: () => sqlWasmUrl
    });

    const replacement = new SQL.Database(data);
    try {
      const integrity = replacement.exec('PRAGMA quick_check');
      const isValid = integrity[0]?.values?.[0]?.[0] === 'ok';
      const requiredTables = new Set(
        replacement.exec(
          "SELECT name FROM sqlite_master WHERE type = 'table'"
        )[0]?.values?.map(([name]) => name) || []
      );

      if (!isValid || !['students', 'levels', 'sections'].every((table) => requiredTables.has(table))) {
        throw new Error('ملف النسخة الاحتياطية غير صالح أو لا يحتوي على قاعدة بيانات المؤسسة.');
      }

      const previous = this.db;
      this.db = replacement;
      try {
        await this.createTables();
        await this.saveDatabase();
      } catch (error) {
        this.db = previous;
        try {
          await this.saveDatabase();
        } catch (restoreError) {
          console.error('تعذر استعادة قاعدة البيانات السابقة بعد فشل الاستيراد:', restoreError);
        }
        throw error;
      }

      previous?.close();
    } catch (error) {
      if (this.db !== replacement) replacement.close();
      throw error;
    }
  }

  
  /** 🔧 جلب إعدادات المؤسسة من قاعدة البيانات
   *
   * @returns {Promise<Object>} كائن يحتوي على:
   *   - academy: اسم الأكاديمية
   *   - directorate: اسم المديرية
   *   - municipality: اسم الجماعة
   *   - institution: اسم المؤسسة
   *   - academicYear: السنة الدراسية 
   *   - name: اسم المؤسسة (مُستعار من institution)
   *   - directorateName: اسم المديرية (مُستعار من directorate)
   *
   * @note يستخدم نظام احتياطي من localStorage إذا لم توجد البيانات في قاعدة البيانات
   * @note يقوم بإعادة مزامنة localStorage إلى قاعدة البيانات تلقائياً
   */
 async getInstitutionSettings(): Promise<any> {
  try {
    if (!this.db) {
      throw new Error('قاعدة البيانات غير مهيأة');
    }

    console.log('🔄 جلب إعدادات المؤسسة من قاعدة البيانات...');

    const stmt = this.db.prepare(`
      SELECT * FROM institution_settings
      ORDER BY updatedAt DESC
      LIMIT 1
    `);

  let result: any = null;

if (stmt.step()) {
  result = stmt.getAsObject();
}

stmt.free();

if (result) {
      const settings = {
        ...result,
        name: result.institution || '',
        directorateName: result.directorate || '',
        code: result.institutionCode || '',
        supabaseInstitutionId: result.supabaseInstitutionId || '',
        institutionActivationCode: result.institutionActivationCode || '',
        institutionSlug: result.institutionSlug || '',
        institutionPhone: result.institutionPhone || '',
        institutionEmail: result.institutionEmail || '',
        licenseKey: result.licenseKey || '',
        subscriptionPlan: result.subscriptionPlan || ''
      };

      console.log('✅ تم جلب الإعدادات من قاعدة البيانات:', settings);
      return settings;
    }

    console.log('⚠️ لا توجد إعدادات في قاعدة البيانات، محاولة الجلب من localStorage...');

    let settings: any = null;

    const backup = localStorage.getItem('institution_settings_backup');
    if (backup) {
      settings = JSON.parse(backup);
      console.log('✅ تم جلب الإعدادات من institution_settings_backup');
    }

    if (!settings) {
      const institutionSettings = localStorage.getItem('institutionSettings');
      if (institutionSettings) {
        const parsed = JSON.parse(institutionSettings);
        settings = {
          academy: parsed.province || '',
          directorate: parsed.directorateName || '',
          municipality: '',
          institution: parsed.name || '',
          academicYear: parsed.academicYear || '2025/2026',
          institutionCode: parsed.code || parsed.institutionCode || '',
          supabaseInstitutionId: parsed.supabaseInstitutionId || '',
          institutionActivationCode: parsed.institutionActivationCode || '',
          institutionSlug: parsed.institutionSlug || '',
          institutionPhone: parsed.institutionPhone || '',
          institutionEmail: parsed.institutionEmail || '',
          licenseKey: parsed.licenseKey || '',
          subscriptionPlan: parsed.subscriptionPlan || '',
          name: parsed.name || '',
          directorateName: parsed.directorateName || ''
        };
        console.log('✅ تم جلب الإعدادات من institutionSettings');
      }
    }

    if (settings) {
      try {
        this.db.run('DELETE FROM institution_settings');

        const insertStmt = this.db.prepare(`
          INSERT INTO institution_settings (
            academy,
            directorate,
            municipality,
            institution,
            academicYear,
            institutionCode,
            supabaseInstitutionId,
            institutionActivationCode,
            institutionSlug,
            institutionPhone,
            institutionEmail,
            licenseKey,
            subscriptionPlan,
            updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insertStmt.run([
          settings.academy || settings.province || '',
          settings.directorate || settings.directorateName || '',
          settings.municipality || '',
          settings.institution || settings.name || '',
          settings.academicYear || '2025/2026',
          settings.institutionCode || settings.code || '',
          settings.supabaseInstitutionId || '',
          settings.institutionActivationCode || '',
          settings.institutionSlug || '',
          settings.institutionPhone || '',
          settings.institutionEmail || '',
          settings.licenseKey || '',
          settings.subscriptionPlan || '',
          settings.updatedAt || new Date().toISOString()
        ]);

        insertStmt.free();
        await this.saveDatabase();
      } catch (syncError) {
        console.warn('⚠️ تعذرت إعادة المزامنة:', syncError);
      }

      return {
        ...settings,
        name: settings.institution || settings.name || '',
        directorateName: settings.directorate || settings.directorateName || '',
        code: settings.institutionCode || settings.code || ''
      };
    }

    return null;
  } catch (error) {
    console.warn('❌ خطأ في جلب إعدادات المؤسسة من قاعدة البيانات:', error);

    try {
      const backup = localStorage.getItem('institution_settings_backup');
      if (backup) {
        return JSON.parse(backup);
      }
    } catch {}

    return null;
  }
} 
  // حفظ إعدادات المؤسسة مع نظام مزدوج (Database + localStorage)
 async saveInstitutionSettings(settings: any): Promise<void> {
  try {
    if (!this.db) {
      throw new Error('قاعدة البيانات غير مهيأة');
    }
console.log("settings before save:", settings);
console.log("supabaseInstitutionId:", settings?.supabaseInstitutionId);
    console.log('💾 حفظ إعدادات المؤسسة:', settings);
console.log("SAVING supabaseInstitutionId =", settings.supabaseInstitutionId);
    this.db.run('DELETE FROM institution_settings');

    const stmt = this.db.prepare(`
      INSERT INTO institution_settings (
        academy,
        directorate,
        municipality,
        institution,
        academicYear,
        institutionCode,
        supabaseInstitutionId,
        institutionActivationCode,
        institutionSlug,
        institutionPhone,
        institutionEmail,
        licenseKey,
        subscriptionPlan,
        updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      settings.academy || '',
      settings.directorate || '',
      settings.municipality || '',
      settings.institution || '',
      settings.academicYear || '2025/2026',
      settings.institutionCode || settings.code || '',
      settings.supabaseInstitutionId || '',
      settings.institutionActivationCode || '',
      settings.institutionSlug || '',
      settings.institutionPhone || '',
      settings.institutionEmail || '',
      settings.licenseKey || '',
      settings.subscriptionPlan || '',
      settings.updatedAt || new Date().toISOString()
    ]);

    stmt.free();
    await this.saveDatabase();

    try {
      localStorage.setItem('institution_settings_backup', JSON.stringify(settings));
    } catch (storageError) {
      console.warn('⚠️ تعذر الحفظ الاحتياطي في localStorage:', storageError);
    }

    console.log('✅ تم حفظ إعدادات المؤسسة');
  } catch (error) {
    console.error('❌ خطأ في حفظ إعدادات المؤسسة:', error);
    throw error;
  }
}

  // باقي الدوال الموجودة...
  /**
   * إضافة تلميذ جديد
   * يستخدم في: StudentManagement, SchoolEnrollmentImport
   */
  async addStudent(student: any): Promise<string> {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const updatedAt = createdAt;

    // البحث عن المستوى والقسم بالاسم وربطهما
    let levelId = null;
    let sectionId = null;

    if (student.level) {
      const level = await this.getLevelByName(student.level);
      levelId = level?.id || null;
    }

    if (student.section && levelId) {
      const section = await this.getSectionByName(student.section);
      sectionId = section?.id || null;
    }

    this.db.run(`
      INSERT INTO students (
        id, firstName, lastName, nationalId, gender, birthPlace, dateOfBirth,
        email, phone, studentId, grade, section, level, levelId, sectionId,
        enrollmentDate, address, emergencyContact, emergencyPhone,
        guardianName, guardianPhone, guardianRelation, socialSupport,
        transportService, medicalInfo, notes, status, ageGroup, schoolType,
        academicYear, region, province, municipality, institution,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, student.firstName, student.lastName, student.nationalId,
      student.gender, student.birthPlace || '', student.dateOfBirth || '',
      student.email || '', student.phone || '', student.studentId || student.nationalId,
      student.grade || '', student.section || '', student.level || '',
      levelId, sectionId, student.enrollmentDate,
      student.address || '', student.emergencyContact || '', student.emergencyPhone || '',
      student.guardianName || '', student.guardianPhone || '', student.guardianRelation || '',
      student.socialSupport ? 1 : 0, student.transportService ? 1 : 0,
      student.medicalInfo || '', student.notes || '', student.status || 'نشط',
      student.ageGroup || '', student.schoolType || '', student.academicYear || '2025/2026',
      student.region || '', student.province || '', student.municipality || '',
      student.institution || '', createdAt, updatedAt
    ]);

    await this.saveDatabase();
    return id;
  }
 

 

  /**
   * الحصول على تلميذ بواسطة المعرف
   * يستخدم في: StudentDetail, StudentForm
   */
  async getStudentById(id: string): Promise<any | null> {
    const stmt = this.db.prepare(`
      SELECT s.*, l.name as levelName, sec.name as sectionName 
      FROM students s 
      LEFT JOIN levels l ON s.levelId = l.id 
      LEFT JOIN sections sec ON s.sectionId = sec.id 
      WHERE s.id = ?
    `);
    try {
      stmt.bind([id]);

      if (stmt.step()) {
        const row = stmt.getAsObject() as any;
        return {
          ...row,
          socialSupport: Boolean(row.socialSupport),
          transportService: Boolean(row.transportService)
        };
      }

      return null;
    } finally {
      stmt.free();
    }

  }

  /**
   * الحصول على تلميذ بواسطة الرقم الوطني
   * يستخدم في: SchoolEnrollmentImport, CouncilDecisionsImport
   */
  async getStudentByNationalId(nationalId: string): Promise<any | null> {
    const stmt = this.db.prepare(`
      SELECT s.*, l.name as levelName, sec.name as sectionName 
      FROM students s 
      LEFT JOIN levels l ON s.levelId = l.id 
      LEFT JOIN sections sec ON s.sectionId = sec.id 
      WHERE s.nationalId = ? LIMIT 1
    `);
    try {
      stmt.bind([nationalId]);

      if (stmt.step()) {
        const row = stmt.getAsObject() as any;
        return {
          ...row,
          socialSupport: Boolean(row.socialSupport),
          transportService: Boolean(row.transportService)
        };
      }

      return null;
    } finally {
      stmt.free();
    }

  }

  // التحقق من وجود تلميذ في موسم دراسي محدد
  async getStudentByNationalIdAndYear(nationalId: string, academicYear: string): Promise<any | null> {
    if (!this.db) {
      throw new Error('قاعدة البيانات غير متاحة - يرجى انتظار التهيئة');
    }
    
    const stmt = this.db.prepare(`
      SELECT s.*, l.name as levelName, sec.name as sectionName 
      FROM students s 
      LEFT JOIN levels l ON s.levelId = l.id 
      LEFT JOIN sections sec ON s.sectionId = sec.id 
      WHERE s.nationalId = ? AND s.academicYear = ? LIMIT 1
    `);
    try {
      stmt.bind([nationalId, academicYear]);

      if (stmt.step()) {
        const row = stmt.getAsObject() as any;
        return {
          ...row,
          socialSupport: Boolean(row.socialSupport),
          transportService: Boolean(row.transportService)
        };
      }

      return null;
    } finally {
      stmt.free();
    }
  }

  // الحصول على التلاميذ حسب السنة الدراسية
  async getStudentsByAcademicYear(academicYear: string): Promise<any[]> {
    const stmt = this.db.prepare(`
      SELECT s.*, l.name as levelName, sec.name as sectionName 
      FROM students s 
      LEFT JOIN levels l ON s.levelId = l.id 
      LEFT JOIN sections sec ON s.sectionId = sec.id 
      WHERE s.academicYear = ?
      ORDER BY s.lastName, s.firstName
    `);
    try {
      stmt.bind([academicYear]);
      const students: any[] = [];

      while (stmt.step()) {
        const row = stmt.getAsObject() as any;
        students.push({
          ...row,
          socialSupport: Boolean(row.socialSupport),
          transportService: Boolean(row.transportService)
        });
      }

      return students;
    } finally {
      stmt.free();
    }
  }

  /**
   * الحصول على تلميذ بواسطة رقم التلميذ
   * يستخدم في: CredentialsImport
   */
  async getStudentByStudentId(studentId: string): Promise<any | null> {
    const stmt = this.db.prepare(`
      SELECT s.*, l.name as levelName, sec.name as sectionName 
      FROM students s 
      LEFT JOIN levels l ON s.levelId = l.id 
      LEFT JOIN sections sec ON s.sectionId = sec.id 
      WHERE s.studentId = ?
    `);
    try {
      stmt.bind([studentId]);

      if (stmt.step()) {
        const row = stmt.getAsObject() as any;
        return {
          ...row,
          socialSupport: Boolean(row.socialSupport),
          transportService: Boolean(row.transportService)
        };
      }

      return null;
    } finally {
      stmt.free();
    }

  }

  /**
   * تحديث بيانات تلميذ
   * يستخدم في: StudentManagement, SchoolEnrollmentImport
   */
  async updateStudent(id: string, updates: any): Promise<void> {
    const updatedAt = new Date().toISOString();
    
    // البحث عن المستوى والقسم بالاسم وربطهما إذا تم تحديثهما
    let levelId = updates.levelId;
    let sectionId = updates.sectionId;

    if (updates.level && !levelId) {
      const level = await this.getLevelByName(updates.level);
      levelId = level?.id || null;
    }

    if (updates.section && !sectionId && levelId) {
      const section = await this.getSectionByName(updates.section);
      sectionId = section?.id || null;
    }

    const fields = Object.keys(updates).filter(key => key !== 'id').map(key => `${key} = ?`);
    const values = Object.keys(updates).filter(key => key !== 'id').map(key => {
      if (key === 'socialSupport' || key === 'transportService') {
        return updates[key] ? 1 : 0;
      }
      return updates[key];
    });

    if (levelId !== undefined) {
      fields.push('levelId = ?');
      values.push(levelId);
    }

    if (sectionId !== undefined) {
      fields.push('sectionId = ?');
      values.push(sectionId);
    }

    fields.push('updatedAt = ?');
    values.push(updatedAt);

    this.db.run(
      `UPDATE students SET ${fields.join(', ')} WHERE id = ?`,
      [...values, id]
    );

    await this.saveDatabase();
  }

  /**
   * حذف تلميذ (مع جميع البيانات المرتبطة)
   * يستخدم في: StudentManagement
   */
  async deleteStudent(id: string): Promise<void> {
    this.db.run('DELETE FROM students WHERE id = ?', [id]);
    await this.saveDatabase();
  }

  // باقي الدوال للحضور والنقط...
  async addAttendanceRecord(record: any): Promise<string> {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    this.db.run(`
      INSERT INTO attendance_records (id, studentId, date, status, period, subject, notes, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, record.studentId, record.date, record.status,
      record.period || '', record.subject || '', record.notes || '', createdAt
    ]);

    await this.saveDatabase();
    return id;
  }

  async getAttendanceRecords(studentId?: string): Promise<any[]> {
    let query = 'SELECT * FROM attendance_records';
    let params: any[] = [];

    if (studentId) {
      query += ' WHERE studentId = ?';
      params.push(studentId);
    }

    query += ' ORDER BY date DESC, createdAt DESC';

    const stmt = this.db.prepare(query);
    try {
      if (params.length > 0) {
        stmt.bind(params);
      }

      const records: any[] = [];
      while (stmt.step()) {
        records.push(stmt.getAsObject());
      }

      return records;
    } finally {
      stmt.free();
    }

  }

  async updateAttendanceRecord(id: string, updates: any): Promise<void> {
    const fields = Object.keys(updates).map(key => `${key} = ?`);
    const values = Object.values(updates);

    this.db.run(
      `UPDATE attendance_records SET ${fields.join(', ')} WHERE id = ?`,
      [...values, id]
    );

    await this.saveDatabase();
  }

  async deleteAttendanceRecord(id: string): Promise<void> {
    this.db.run('DELETE FROM attendance_records WHERE id = ?', [id]);
    await this.saveDatabase();
  }

  async addGradeRecord(record: any): Promise<string> {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    this.db.run(`
      INSERT INTO grade_records (
        id, studentId, subject, grade, maxGrade, assignmentType,
        semester, academicYear, date, notes, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, record.studentId, record.subject, record.grade, record.maxGrade,
      record.assignmentType, record.semester || '', record.academicYear || '',
      record.date, record.notes || '', createdAt
    ]);

    await this.saveDatabase();
    return id;
  }

  async getGradeRecords(studentId?: string): Promise<any[]> {
    let query = 'SELECT * FROM grade_records';
    let params: any[] = [];

    if (studentId) {
      query += ' WHERE studentId = ?';
      params.push(studentId);
    }

    query += ' ORDER BY date DESC, createdAt DESC';

    const stmt = this.db.prepare(query);
    try {
      if (params.length > 0) {
        stmt.bind(params);
      }

      const records: any[] = [];
      while (stmt.step()) {
        records.push(stmt.getAsObject());
      }

      return records;
    } finally {
      stmt.free();
    }
  }

  /**
   * مسح قاعدة البيانات بالكامل
   * يستخدم في: Settings
   */
  async clearDatabase(): Promise<void> {
    try {
      // إغلاق قاعدة البيانات الحالية
      if (this.db) {
        this.db.close();
        this.db = null;
      }

      // حذف البيانات من IndexedDB
      const db = await this.openIndexedDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });

      if (window.desktopStorage) {
        await window.desktopStorage.deleteDatabase();
      }

      // إعادة تعيين حالة التهيئة
      this.isInitialized = false;

      // إعادة تهيئة قاعدة البيانات بجداول فارغة
      await this.initialize();

      console.log('تم مسح قاعدة البيانات بنجاح');
    } catch (error) {
      console.error('خطأ في مسح قاعدة البيانات:', error);
      throw error;
    }
  }

  private async saveDatabase(): Promise<void> {
    if (!this.db) return;
    const data = this.db.export();
    const write = this.persistenceQueue.catch(() => {}).then(async () => {
      if (window.desktopStorage) {
        await window.desktopStorage.writeDatabase(data);
      }
      await this.saveToIndexedDB(data);
    });
    this.persistenceQueue = write;
    await write;
  }

  async saveReceivedAttendance(institutionId: string, rows: ReceivedAttendance[]): Promise<void> {
    await this.initialize();
    this.db.run('BEGIN TRANSACTION');
    try {
      for (const row of rows) {
        if (row.institution_id !== institutionId || !/^\d+$/.test(row.sync_revision)) {
          throw new Error('Invalid attendance institution or revision');
        }
        this.db.run(`INSERT INTO attendance_received
          (institution_id, session_id, revision, payload, received_at) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (institution_id, session_id) DO UPDATE SET
            revision = excluded.revision, payload = excluded.payload, received_at = excluded.received_at
          WHERE CAST(excluded.revision AS INTEGER) >= CAST(attendance_received.revision AS INTEGER)`,
          [institutionId, row.id, row.sync_revision, JSON.stringify(row), new Date().toISOString()]);
      }
      this.db.run('COMMIT');
    } catch (error) {
      this.db.run('ROLLBACK');
      throw error;
    }
    // Even duplicate deliveries must be persisted before acknowledging them.
    await this.saveDatabase();
  }

  async getReceivedAttendance(institutionId: string): Promise<ReceivedAttendance[]> {
    await this.initialize();
    const stmt = this.db.prepare('SELECT payload FROM attendance_received WHERE institution_id = ?');
    try {
      stmt.bind([institutionId]);
      const rows: ReceivedAttendance[] = [];
      while (stmt.step()) rows.push(JSON.parse(String(stmt.getAsObject().payload)));
      return rows.sort((a, b) => b.lesson_date.localeCompare(a.lesson_date));
    } finally { stmt.free(); }
  }

  async getAttendanceSyncSuccess(userId?: string): Promise<{ institutionId: string; lastSuccess: string } | null> {
    await this.initialize();
    const stmt = this.db.prepare('SELECT institution_id, succeeded_at FROM attendance_sync_success' +
      (userId ? ' WHERE user_id = ?' : ' ORDER BY succeeded_at DESC LIMIT 1'));
    try {
      if (userId) stmt.bind([userId]);
      if (!stmt.step()) return null;
      const row = stmt.getAsObject();
      return { institutionId: String(row.institution_id), lastSuccess: String(row.succeeded_at) };
    } finally { stmt.free(); }
  }

  async saveAttendanceSyncSuccess(userId: string, institutionId: string, at: string): Promise<void> {
    await this.initialize();
    this.db.run(`INSERT INTO attendance_sync_success VALUES (?, ?, ?)
      ON CONFLICT (user_id) DO UPDATE SET institution_id = excluded.institution_id, succeeded_at = excluded.succeeded_at`,
      [userId, institutionId, at]);
    await this.saveDatabase();
  }

  /**
   * الحصول على إحصائيات قاعدة البيانات للوحة التحكم
   * يستخدم في: Dashboard
   */
  async getDatabaseStats(academicYear?: string): Promise<any> {
    try {
      // تحديد السنة الدراسية الحالية
      const currentYear = academicYear || '2025/2026';
      
      const stats = {
        totalStudents: 0,
        activeStudents: 0,
        maleStudents: 0,
        femaleStudents: 0,
        totalAttendanceRecords: 0,
        totalGradeRecords: 0,
        averageGrade: 0,
        attendanceRate: 0,
        socialSupportCount: 0,
        transportServiceCount: 0
      };

    // التأكد من تهيئة قاعدة البيانات
    if (!this.db) {
      console.warn('قاعدة البيانات غير مهيأة، جاري إعادة التهيئة...');
      await this.initialize();
    }
    
    if (!this.db) {
      throw new Error('فشل في تهيئة قاعدة البيانات');
    }

      // إحصائيات التلاميذ - المتمدرسين + الوافدين + المدمجين في السنة الحالية
      const totalStudentsStmt = this.db.prepare('SELECT COUNT(*) as count FROM students WHERE academicYear = ? AND status = ?');
      totalStudentsStmt.bind([currentYear, 'متمدرس']);
      if (totalStudentsStmt.step()) {
        stats.totalStudents = totalStudentsStmt.getAsObject().count as number;
      }
      totalStudentsStmt.free();

      // التلاميذ النشطون - نفس العدد لأننا نحسب المتمدرسين (شامل الوافدين والمدمجين)
      const activeStudentsStmt = this.db.prepare("SELECT COUNT(*) as count FROM students WHERE academicYear = ? AND status = ?");
      activeStudentsStmt.bind([currentYear, 'متمدرس']);
      if (activeStudentsStmt.step()) {
        stats.activeStudents = activeStudentsStmt.getAsObject().count as number;
      }
      activeStudentsStmt.free();

      // التلاميذ الذكور - فقط المتمدرسين في السنة الحالية
      const maleStudentsStmt = this.db.prepare("SELECT COUNT(*) as count FROM students WHERE gender = ? AND academicYear = ? AND status = ?");
      maleStudentsStmt.bind(['ذكر', currentYear, 'متمدرس']);
      if (maleStudentsStmt.step()) {
        stats.maleStudents = maleStudentsStmt.getAsObject().count as number;
      }
      maleStudentsStmt.free();

      // التلميذات الإناث - فقط المتمدرسات في السنة الحالية
      const femaleStudentsStmt = this.db.prepare("SELECT COUNT(*) as count FROM students WHERE gender = ? AND academicYear = ? AND status = ?");
      femaleStudentsStmt.bind(['أنثى', currentYear, 'متمدرس']);
      if (femaleStudentsStmt.step()) {
        stats.femaleStudents = femaleStudentsStmt.getAsObject().count as number;
      }
      femaleStudentsStmt.free();

      // المستفيدون من الدعم الاجتماعي - فقط المتمدرسين في السنة الحالية
      const socialSupportStmt = this.db.prepare('SELECT COUNT(*) as count FROM students WHERE socialSupport = 1 AND academicYear = ? AND status = ?');
      socialSupportStmt.bind([currentYear, 'متمدرس']);
      if (socialSupportStmt.step()) {
        stats.socialSupportCount = socialSupportStmt.getAsObject().count as number;
      }
      socialSupportStmt.free();

      // المستفيدون من خدمة النقل - فقط المتمدرسين في السنة الحالية
      const transportServiceStmt = this.db.prepare('SELECT COUNT(*) as count FROM students WHERE transportService = 1 AND academicYear = ? AND status = ?');
      transportServiceStmt.bind([currentYear, 'متمدرس']);
      if (transportServiceStmt.step()) {
        stats.transportServiceCount = transportServiceStmt.getAsObject().count as number;
      }
      transportServiceStmt.free();

      // إحصائيات الحضور
      const attendanceStmt = this.db.prepare('SELECT COUNT(*) as count FROM attendance_records');
      if (attendanceStmt.step()) {
        stats.totalAttendanceRecords = attendanceStmt.getAsObject().count as number;
      }
      attendanceStmt.free();

      // إحصائيات النقط
      const gradesStmt = this.db.prepare('SELECT COUNT(*) as count FROM grade_records');
      if (gradesStmt.step()) {
        stats.totalGradeRecords = gradesStmt.getAsObject().count as number;
      }
      gradesStmt.free();

      // متوسط النقط
      const avgGradeStmt = this.db.prepare('SELECT AVG(grade) as avg FROM grade_records');
      if (avgGradeStmt.step()) {
        const avgResult = avgGradeStmt.getAsObject().avg;
        stats.averageGrade = avgResult ? Math.round(avgResult as number * 100) / 100 : 0;
      }
      avgGradeStmt.free();

      // معدل الحضور
      const attendanceRateStmt = this.db.prepare("SELECT COUNT(*) as present FROM attendance_records WHERE status = 'حاضر'");
      if (attendanceRateStmt.step()) {
        const presentCount = attendanceRateStmt.getAsObject().present as number;
        stats.attendanceRate = stats.totalAttendanceRecords > 0 
          ? Math.round((presentCount / stats.totalAttendanceRecords) * 100) 
          : 0;
      }
      attendanceRateStmt.free();

      return stats;
    } catch (error) {
      console.error('خطأ في حساب إحصائيات قاعدة البيانات:', error);
      // إرجاع إحصائيات فارغة في حالة الخطأ
      return {
        totalStudents: 0,
        activeStudents: 0,
        maleStudents: 0,
        femaleStudents: 0,
        totalAttendanceRecords: 0,
        totalGradeRecords: 0,
        averageGrade: 0,
        attendanceRate: 0,
        socialSupportCount: 0,
        transportServiceCount: 0
      };
    }
  }

  // ============ دوال وحدة تحكم المطور ============

  /**
   * الحصول على أسماء جميع الجداول في قاعدة البيانات
   */
  async getAllTables(): Promise<string[]> {
    try {
      if (!this.db) await this.initialize();

      const stmt = this.db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table'
        AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `);

      const tables: string[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        tables.push(row.name as string);
      }
      stmt.free();

      return tables;
    } catch (error) {
      console.error('خطأ في الحصول على الجداول:', error);
      return [];
    }
  }

  /**
   * تنفيذ استعلام SQL خام وإرجاع النتائج
   */
  async executeRawQuery(query: string): Promise<any[]> {
    try {
      if (!this.db) await this.initialize();

      const stmt = this.db.prepare(query);
      const results: any[] = [];

      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }

      stmt.free();
      return results;
    } catch (error: any) {
      console.error('خطأ في تنفيذ الاستعلام:', error);
      throw new Error(`فشل تنفيذ الاستعلام: ${error.message}`);
    }
  }

  /**
   * تصدير قاعدة البيانات بالكامل إلى JSON
   */
  async exportDatabaseToJSON(): Promise<string> {
    try {
      if (!this.db) await this.initialize();

      const data: any = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        tables: {}
      };

      const tables = await this.getAllTables();

      for (const tableName of tables) {
        const rows = await this.executeRawQuery(`SELECT * FROM ${tableName}`);
        data.tables[tableName] = rows;
      }

      return JSON.stringify(data, null, 2);
    } catch (error: any) {
      console.error('خطأ في تصدير قاعدة البيانات:', error);
      throw new Error(`فشل التصدير: ${error.message}`);
    }
  }

  /**
   * استيراد قاعدة بيانات من JSON
   */
  async importDatabaseFromJSON(jsonData: string): Promise<void> {
    try {
      if (!this.db) await this.initialize();

      const data = JSON.parse(jsonData);

      if (!data.tables) {
        throw new Error('تنسيق JSON غير صحيح');
      }

      // حذف جميع البيانات الحالية
      const tables = await this.getAllTables();
      for (const tableName of tables) {
        this.db.run(`DELETE FROM ${tableName}`);
      }

      // استيراد البيانات الجديدة
      for (const [tableName, rows] of Object.entries(data.tables)) {
        if (!Array.isArray(rows) || rows.length === 0) continue;

        const columns = Object.keys(rows[0]);
        const placeholders = columns.map(() => '?').join(', ');

        for (const row of rows as any[]) {
          const values = columns.map(col => row[col]);
          this.db.run(
            `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
            values
          );
        }
      }

      await this.saveDatabase();
    } catch (error: any) {
      console.error('خطأ في استيراد قاعدة البيانات:', error);
      throw new Error(`فشل الاستيراد: ${error.message}`);
    }
  }

  // ============ دوال إدارة جداول الحصص ============

  /**
   * إضافة سجل جدول حصة
   */
  async addTimetableEntry(entry: {
    teacher_name_arabic: string;
    teacher_name_french: string;
    teacher_id: string;
    ppr: string;
    subject_code: string;
    subject_arabic: string;
    class: string;
    room_code: string;
    room_name: string;
    day: string;
    day_arabic: string;
    time_slot: string;
    start_time: string;
    end_time: string;
    activity_id: string;
    tags: string;
  }): Promise<string> {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    this.db.run(`
      INSERT INTO timetable (
        id, teacher_name_arabic, teacher_name_french, teacher_id, ppr,
        subject_code, subject_arabic, class, room_code, room_name,
        day, day_arabic, time_slot, start_time, end_time,
        activity_id, tags, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, entry.teacher_name_arabic, entry.teacher_name_french,
      entry.teacher_id, entry.ppr, entry.subject_code, entry.subject_arabic,
      entry.class, entry.room_code, entry.room_name, entry.day,
      entry.day_arabic, entry.time_slot, entry.start_time, entry.end_time,
      entry.activity_id, entry.tags, createdAt
    ]);

    await this.saveDatabase();
    return id;
  }

  /**
   * إضافة توزيع أستاذ
   */
  async addTeacherAssignment(assignment: {
    teacher_arabic: string;
    teacher_french: string;
    teacher_id: string;
    ppr: string;
    class: string;
    subject_code: string;
    subject_arabic: string;
  }): Promise<string> {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    this.db.run(`
      INSERT INTO teacher_assignments (
        id, teacher_arabic, teacher_french, teacher_id, ppr,
        class, subject_code, subject_arabic, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, assignment.teacher_arabic, assignment.teacher_french,
      assignment.teacher_id, assignment.ppr, assignment.class,
      assignment.subject_code, assignment.subject_arabic, createdAt
    ]);

    await this.saveDatabase();
    return id;
  }

  /**
   * جلب جدول حصص قسم معين
   */
  async getTimetableByClass(className: string): Promise<any[]> {
    try {
      console.log('🔎 [getTimetableByClass] البحث عن القسم:', className);
      const stmt = this.db.prepare('SELECT * FROM timetable WHERE class = ? ORDER BY day, start_time');
      const entries: any[] = [];
      stmt.bind([className]);

      while (stmt.step()) {
        entries.push(stmt.getAsObject());
      }

      stmt.free();
      console.log(`✅ [getTimetableByClass] وجدنا ${entries.length} حصص للقسم ${className}`);

      // إذا لم نجد حصص، دعنا نفحص جميع الأقسام الموجودة
      if (entries.length === 0) {
        console.warn('⚠️ لم نجد حصص! دعنا نفحص جميع الأقسام الموجودة في timetable...');
        const allClassesStmt = this.db.prepare('SELECT DISTINCT class FROM timetable LIMIT 20');
        const allClasses: string[] = [];
        while (allClassesStmt.step()) {
          const row = allClassesStmt.getAsObject();
          allClasses.push(row.class as string);
        }
        allClassesStmt.free();
        console.log('📚 جميع الأقسام الموجودة في timetable:', allClasses);
      }

      return entries;
    } catch (error) {
      console.error('❌ خطأ في جلب جدول القسم:', error);
      return [];
    }
  }

  /**
   * جلب حصة معينة حسب القسم واليوم والتوقيت
   */
  async getTimetableByClassAndTime(className: string, day: string, timeSlot: string): Promise<any | null> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM timetable
        WHERE class = ? AND (day = ? OR day_arabic = ?) AND time_slot = ?
        LIMIT 1
      `);
      stmt.bind([className, day, day, timeSlot]);

      if (stmt.step()) {
        const result = stmt.getAsObject();
        stmt.free();
        return result;
      }

      stmt.free();
      return null;
    } catch (error) {
      console.error('خطأ في جلب الحصة:', error);
      return null;
    }
  }

  /**
   * جلب جميع جداول الحصص
   */
  async getAllTimetable(): Promise<any[]> {
    try {
      const stmt = this.db.prepare('SELECT * FROM timetable ORDER BY class, day, start_time');
      const entries: any[] = [];

      while (stmt.step()) {
        entries.push(stmt.getAsObject());
      }

      stmt.free();
      return entries;
    } catch (error) {
      console.error('خطأ في جلب جميع جداول الحصص:', error);
      return [];
    }
  }

  /**
   * جلب توزيع الأساتذة
   */
  async getTeacherAssignments(className?: string): Promise<any[]> {
    try {
      let query = 'SELECT * FROM teacher_assignments';
      const params: any[] = [];

      if (className) {
        query += ' WHERE class = ?';
        params.push(className);
      }

      query += ' ORDER BY class, teacher_arabic';

      const stmt = this.db.prepare(query);
      if (params.length > 0) {
        stmt.bind(params);
      }

      const assignments: any[] = [];
      while (stmt.step()) {
        assignments.push(stmt.getAsObject());
      }

      stmt.free();
      return assignments;
    } catch (error) {
      console.error('خطأ في جلب توزيع الأساتذة:', error);
      return [];
    }
  }

  /**
   * حذف جداول الحصص القديمة
   */
  async clearTimetable(): Promise<void> {
    this.db.run('DELETE FROM timetable');
    await this.saveDatabase();
  }

  async replaceTimetable(entries: Array<{
    teacher_name_arabic: string;
    teacher_name_french: string;
    teacher_id: string;
    ppr: string;
    subject_code: string;
    subject_arabic: string;
    class: string;
    room_code: string;
    room_name: string;
    day: string;
    day_arabic: string;
    time_slot: string;
    start_time: string;
    end_time: string;
    activity_id: string;
    tags: string;
  }>): Promise<void> {
    let committed = false;
    this.db.run('BEGIN TRANSACTION');
    try {
      this.db.run('DELETE FROM timetable');
      for (const entry of entries) {
        this.db.run(`
          INSERT INTO timetable (
            id, teacher_name_arabic, teacher_name_french, teacher_id, ppr,
            subject_code, subject_arabic, class, room_code, room_name,
            day, day_arabic, time_slot, start_time, end_time,
            activity_id, tags, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          crypto.randomUUID(), entry.teacher_name_arabic, entry.teacher_name_french,
          entry.teacher_id, entry.ppr, entry.subject_code, entry.subject_arabic,
          entry.class, entry.room_code, entry.room_name, entry.day,
          entry.day_arabic, entry.time_slot, entry.start_time, entry.end_time,
          entry.activity_id, entry.tags, new Date().toISOString(),
        ]);
      }
      this.db.run('COMMIT');
      committed = true;
      await this.saveDatabase();
    } catch (error) {
      if (!committed) this.db.run('ROLLBACK');
      throw error;
    }
  }

  /**
   * حذف توزيع الأساتذة القديم
   */
  async clearTeacherAssignments(): Promise<void> {
    this.db.run('DELETE FROM teacher_assignments');
    await this.saveDatabase();
  }

  /**
   * استيراد جداول حصص متعددة دفعة واحدة
   */
  async bulkInsertTimetable(entries: any[]): Promise<number> {
    let count = 0;
    for (const entry of entries) {
      try {
        await this.addTimetableEntry(entry);
        count++;
      } catch (error) {
        console.error('خطأ في إضافة سجل:', error);
      }
    }
    return count;
  }

  /**
   * استيراد توزيعات أساتذة متعددة دفعة واحدة
   */
  async bulkInsertTeacherAssignments(assignments: any[]): Promise<number> {
    let count = 0;
    for (const assignment of assignments) {
      try {
        await this.addTeacherAssignment(assignment);
        count++;
      } catch (error) {
        console.error('خطأ في إضافة توزيع:', error);
      }
    }
    return count;
  }

  // ============ دوال إدارة المواد الدراسية ============

  /**
   * إضافة مادة دراسية
   */
  async addSubject(subject: { code: string; name_arabic: string; name_french?: string }): Promise<string> {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    try {
      this.db.run(`
        INSERT OR IGNORE INTO subjects (id, code, name_arabic, name_french, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `, [id, subject.code, subject.name_arabic, subject.name_french || '', createdAt]);

      await this.saveDatabase();
      return id;
    } catch (error) {
      console.error('خطأ في إضافة المادة:', error);
      throw error;
    }
  }

  /**
   * جلب جميع المواد الدراسية
   */
  async getAllSubjects(): Promise<any[]> {
    try {
      const stmt = this.db.prepare('SELECT * FROM subjects ORDER BY name_arabic');
      const subjects: any[] = [];

      while (stmt.step()) {
        subjects.push(stmt.getAsObject());
      }

      stmt.free();
      return subjects;
    } catch (error) {
      console.error('خطأ في جلب المواد:', error);
      return [];
    }
  }

  /**
   * استخراج وحفظ المواد من جدول الحصص
   */
  async extractSubjectsFromTimetable(): Promise<number> {
    try {
      const timetable = await this.getAllTimetable();
      const uniqueSubjects = new Map<string, { code: string; name_arabic: string }>();

      for (const entry of timetable) {
        if (entry.subject_code && entry.subject_arabic) {
          uniqueSubjects.set(entry.subject_code, {
            code: entry.subject_code,
            name_arabic: entry.subject_arabic
          });
        }
      }

      let count = 0;
      for (const subject of uniqueSubjects.values()) {
        try {
          await this.addSubject(subject);
          count++;
        } catch (error) {
          console.error('خطأ في إضافة مادة:', error);
        }
      }

      return count;
    } catch (error) {
      console.error('خطأ في استخراج المواد:', error);
      return 0;
    }
  }

  async getStudentCredential(nationalId: string): Promise<string | null> {
    try {
      await this.initialize();
      const stmt = this.db.prepare('SELECT secret_code FROM credentials WHERE student_id = ?');
      stmt.bind([nationalId]);
      if (stmt.step()) {
        const result = stmt.getAsObject();
        stmt.free();
        return result.secret_code as string;
      }
      stmt.free();
      return null;
    } catch (error) {
      console.error('خطأ في جلب الكود السري:', error);
      return null;
    }
  }

  async addMessageTemplate(template: { name: string; category: string; content: string }): Promise<void> {
    await this.initialize();
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    this.db.run(`
      INSERT INTO message_templates (id, name, category, content, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `, [id, template.name, template.category, template.content, createdAt]);
    await this.saveDatabase();
  }

  async getMessageTemplates(): Promise<any[]> {
    await this.initialize();
    const stmt = this.db.prepare('SELECT * FROM message_templates ORDER BY category, name');
    const templates: any[] = [];
    while (stmt.step()) {
      templates.push(stmt.getAsObject());
    }
    stmt.free();
    return templates;
  }

  async deleteMessageTemplate(id: string): Promise<void> {
    await this.initialize();
    this.db.run('DELETE FROM message_templates WHERE id = ?', [id]);
    await this.saveDatabase();
  }

  async getMessageTemplatesByCategory(category: string): Promise<any[]> {
    await this.initialize();
    const stmt = this.db.prepare('SELECT * FROM message_templates WHERE category = ? ORDER BY name');
    stmt.bind([category]);
    const templates: any[] = [];
    while (stmt.step()) {
      templates.push(stmt.getAsObject());
    }
    stmt.free();
    return templates;
  }

  async getWhatsAppSettings(): Promise<any | null> {
    await this.initialize();
    try {
      const stmt = this.db.prepare('SELECT * FROM whatsapp_settings LIMIT 1');
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return {
          evolutionApiUrl: row.evolution_api_url || '',
          evolutionInstanceName: row.evolution_instance_name || '',
          evolutionApiKey: row.evolution_api_key || '',
          isActive: row.is_active === 1
        };
      }
      stmt.free();
      return null;
    } catch (error) {
      console.error('❌ خطأ في تحميل إعدادات واتساب:', error);
      return null;
    }
  }

  async saveWhatsAppSettings(settings: {
    evolution_api_url: string;
    evolution_instance_name: string;
    evolution_api_key: string;
    is_active: boolean;
  }): Promise<void> {
    await this.initialize();

    try {
      // التحقق من وجود الأعمدة الصحيحة
      const checkColumns = this.db.prepare("PRAGMA table_info(whatsapp_settings)");
      const columns: any[] = [];
      while (checkColumns.step()) {
        columns.push(checkColumns.getAsObject());
      }
      checkColumns.free();

      const columnNames = columns.map((col: any) => col.name);
      if (!columnNames.includes('evolution_api_url')) {
        console.error('❌ جدول whatsapp_settings لا يحتوي على الأعمدة الصحيحة');
        throw new Error('جدول whatsapp_settings بحاجة إلى ترحيل. الرجاء إعادة تحميل الصفحة.');
      }

      const stmt = this.db.prepare('SELECT COUNT(*) as count FROM whatsapp_settings');
      stmt.step();
      const result = stmt.getAsObject();
      stmt.free();

      if ((result.count as number) > 0) {
        this.db.run(
          'UPDATE whatsapp_settings SET evolution_api_url = ?, evolution_instance_name = ?, evolution_api_key = ?, is_active = ?',
          [settings.evolution_api_url, settings.evolution_instance_name, settings.evolution_api_key, settings.is_active ? 1 : 0]
        );
      } else {
        this.db.run(
          'INSERT INTO whatsapp_settings (evolution_api_url, evolution_instance_name, evolution_api_key, is_active) VALUES (?, ?, ?, ?)',
          [settings.evolution_api_url, settings.evolution_instance_name, settings.evolution_api_key, settings.is_active ? 1 : 0]
        );
      }
      await this.saveDatabase();
    } catch (error) {
      console.error('❌ خطأ في حفظ إعدادات WhatsApp:', error);
      throw error;
    }
  }

  async getAttendanceCloudLinks(recordType: 'student' | 'teacher' | 'schedule'): Promise<Record<string, string>> {
    await this.initialize();
    const stmt = this.db.prepare(
      'SELECT local_ref, cloud_id FROM attendance_cloud_links WHERE record_type = ?'
    );
    stmt.bind([recordType]);
    const links: Record<string, string> = {};
    try {
      while (stmt.step()) {
        const row = stmt.getAsObject() as { local_ref: string; cloud_id: string };
        links[row.local_ref] = row.cloud_id;
      }
      return links;
    } finally {
      stmt.free();
    }
  }

  async saveAttendanceCloudLinks(
    recordType: 'student' | 'teacher' | 'schedule',
    links: Array<{ localRef: string; cloudId: string }>
  ): Promise<void> {
    await this.initialize();
    this.db.run('BEGIN TRANSACTION');
    try {
      for (const link of links) {
        this.db.run(
          `INSERT INTO attendance_cloud_links (record_type, local_ref, cloud_id, updatedAt)
           VALUES (?, ?, ?, ?)
           ON CONFLICT (record_type, local_ref)
           DO UPDATE SET cloud_id = excluded.cloud_id, updatedAt = excluded.updatedAt`,
          [recordType, link.localRef, link.cloudId, new Date().toISOString()]
        );
      }
      this.db.run('COMMIT');
      await this.saveDatabase();
    } catch (error) {
      this.db.run('ROLLBACK');
      throw error;
    }
  }

  async getAttendanceTeacherRoster(): Promise<Array<{
    nationalId: string;
    displayName: string;
    username?: string;
  }>> {
    await this.initialize();
    const stmt = this.db.prepare(
      'SELECT national_id, display_name, username FROM attendance_teacher_roster ORDER BY display_name'
    );
    const teachers: Array<{ nationalId: string; displayName: string; username?: string }> = [];
    try {
      while (stmt.step()) {
        const row = stmt.getAsObject() as {
          national_id: string;
          display_name: string;
          username: string | null;
        };
        teachers.push({
          nationalId: row.national_id,
          displayName: row.display_name,
          ...(row.username ? { username: row.username } : {}),
        });
      }
      return teachers;
    } finally {
      stmt.free();
    }
  }

  async saveAttendanceTeacherRoster(teachers: Array<{
    nationalId: string;
    displayName: string;
    username?: string;
  }>): Promise<void> {
    await this.initialize();
    this.db.run('BEGIN TRANSACTION');
    try {
      for (const teacher of teachers) {
        this.db.run(
          `INSERT INTO attendance_teacher_roster (national_id, display_name, username, updatedAt)
           VALUES (?, ?, ?, ?)
           ON CONFLICT (national_id) DO UPDATE SET
             display_name = excluded.display_name,
             username = COALESCE(excluded.username, attendance_teacher_roster.username),
             updatedAt = excluded.updatedAt`,
          [teacher.nationalId, teacher.displayName, teacher.username || null, new Date().toISOString()]
        );
      }
      this.db.run('COMMIT');
      await this.saveDatabase();
    } catch (error) {
      this.db.run('ROLLBACK');
      throw error;
    }
  }

  async updateTimetableTimes(
    updates: Array<{ id: string; start_time: string; end_time: string }>
  ): Promise<void> {
    await this.initialize();
    this.db.run('BEGIN TRANSACTION');
    try {
      for (const update of updates) {
        this.db.run(
          'UPDATE timetable SET start_time = ?, end_time = ? WHERE id = ?',
          [update.start_time, update.end_time, update.id]
        );
      }
      this.db.run('COMMIT');
      await this.saveDatabase();
    } catch (error) {
      this.db.run('ROLLBACK');
      throw error;
    }
  }

  async getAttendanceSubjectMappings(): Promise<Record<string, string>> {
    await this.initialize();
    const stmt = this.db.prepare(
      'SELECT subject_code, subject_name_arabic FROM attendance_subject_mappings ORDER BY subject_code'
    );
    const mappings: Record<string, string> = {};
    try {
      while (stmt.step()) {
        const row = stmt.getAsObject() as { subject_code: string; subject_name_arabic: string };
        mappings[row.subject_code] = row.subject_name_arabic;
      }
      return mappings;
    } finally {
      stmt.free();
    }
  }

  async saveAttendanceSubjectMapping(subjectCode: string, subjectNameArabic: string): Promise<void> {
    await this.initialize();
    const code = subjectCode.trim();
    const name = subjectNameArabic.trim();
    if (!code || !name) throw new Error('رمز المادة واسمها مطلوبان.');
    this.db.run(
      `INSERT INTO attendance_subject_mappings (subject_code, subject_name_arabic, updatedAt)
       VALUES (?, ?, ?)
       ON CONFLICT (subject_code)
       DO UPDATE SET subject_name_arabic = excluded.subject_name_arabic, updatedAt = excluded.updatedAt`,
      [code, name, new Date().toISOString()]
    );
    await this.saveDatabase();
  }

  async getAttendanceLocalJustifications(markIds: string[]): Promise<Record<string, { status: 'justified' | 'unjustified'; note: string }>> {
    await this.initialize();
    if (!markIds.length) return {};
    const placeholders = markIds.map(() => '?').join(', ');
    const stmt = this.db.prepare(
      `SELECT mark_id, status, note FROM attendance_local_justifications
       WHERE mark_id IN (${placeholders})`
    );
    stmt.bind(markIds);
    const reviews: Record<string, { status: 'justified' | 'unjustified'; note: string }> = {};
    try {
      while (stmt.step()) {
        const row = stmt.getAsObject() as { mark_id: string; status: 'justified' | 'unjustified'; note: string };
        reviews[row.mark_id] = { status: row.status, note: row.note };
      }
      return reviews;
    } finally {
      stmt.free();
    }
  }

  async saveAttendanceLocalJustification(
    markId: string,
    status: 'justified' | 'unjustified',
    note: string,
    updatedBy: string
  ): Promise<void> {
    await this.initialize();
    this.db.run(
      `INSERT INTO attendance_local_justifications (mark_id, status, note, updatedBy, updatedAt)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (mark_id)
       DO UPDATE SET status = excluded.status, note = excluded.note,
         updatedBy = excluded.updatedBy, updatedAt = excluded.updatedAt`,
      [markId, status, note, updatedBy, new Date().toISOString()]
    );
    await this.saveDatabase();
  }

}

// إنشاء وتصدير مثيل من مدير قاعدة البيانات
export const dbManager = new DatabaseManager();
