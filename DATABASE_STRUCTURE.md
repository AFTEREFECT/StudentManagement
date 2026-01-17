# هيكل قاعدة بيانات Supabase - نظام إدارة التلاميذ

## نظرة عامة
تم إنشاء قاعدة بيانات Supabase كاملة بدلاً من IndexedDB المحلي، مع جداول شاملة وعلاقات محددة.

---

## الجداول الرئيسية

### 1. **students** - جدول التلاميذ الرئيسي ⭐
**الوصف**: يحتوي على جميع بيانات التلاميذ

| العمود | النوع | الوصف |
|--------|------|-------|
| id | uuid | المعرف الفريد |
| national_id | text (unique) | الرقم الوطني |
| student_id | text (unique) | الرقم المدرسي |
| first_name | text | الاسم الشخصي |
| last_name | text | الاسم العائلي |
| gender | text | النوع (ذكر/أنثى) |
| date_of_birth | date | تاريخ الميلاد |
| birth_place | text | مكان الازدياد |
| age_group | text | الفئة العمرية |
| email | text | البريد الإلكتروني |
| phone | text | رقم الهاتف |
| address | text | العنوان |
| level_id | text | معرف المستوى الدراسي |
| section_id | text | معرف القسم |
| grade | text | الصف |
| enrollment_date | date | تاريخ التسجيل |
| academic_year | text | السنة الدراسية |
| school_type | text | نوع المدرسة |
| status | text | حالة التلميذ |
| region | text | الجهة |
| province | text | الإقليم/العمالة |
| municipality | text | الجماعة |
| institution | text | المؤسسة |
| guardian_name | text | اسم ولي الأمر |
| guardian_phone | text | هاتف ولي الأمر |
| guardian_relation | text | صلة القرابة |
| emergency_contact | text | جهة اتصال الطوارئ |
| emergency_phone | text | هاتف الطوارئ |
| social_support | boolean | الدعم الاجتماعي |
| transport_service | boolean | خدمة النقل |
| medical_info | text | المعلومات الطبية |
| notes | text | ملاحظات |
| created_at | timestamptz | تاريخ الإنشاء |
| updated_at | timestamptz | تاريخ التحديث |

**الفهارس**:
- idx_students_national_id
- idx_students_student_id
- idx_students_level_id
- idx_students_section_id
- idx_students_status
- idx_students_academic_year

---

### 2. **levels** - المستويات الدراسية

| العمود | النوع | الوصف |
|--------|------|-------|
| id | uuid | المعرف الفريد |
| level_id | text (unique) | معرف المستوى |
| level_name | text | اسم المستوى |
| level_code | text | رمز المستوى |
| order_index | integer | ترتيب المستوى |
| created_at | timestamptz | تاريخ الإنشاء |
| updated_at | timestamptz | تاريخ التحديث |

---

### 3. **sections** - الأقسام

| العمود | النوع | الوصف |
|--------|------|-------|
| id | uuid | المعرف الفريد |
| class_id | text (unique) | معرف القسم |
| class_name | text | اسم القسم |
| level_id | text | معرف المستوى المرتبط |
| created_at | timestamptz | تاريخ الإنشاء |
| updated_at | timestamptz | تاريخ التحديث |

**الفهارس**:
- idx_sections_level_id

---

### 4. **quiz_templates** - قوالب الامتحانات

| العمود | النوع | الوصف |
|--------|------|-------|
| id | uuid | المعرف الفريد |
| name | text | اسم القالب |
| subject | text | المادة |
| level_id | text | المستوى |
| section_id | text | القسم |
| total_questions | integer | عدد الأسئلة |
| questions_per_page | integer | عدد الأسئلة لكل صفحة |
| options_count | integer | عدد الخيارات |
| template_config | jsonb | إعدادات القالب |
| created_at | timestamptz | تاريخ الإنشاء |
| updated_at | timestamptz | تاريخ التحديث |

---

### 5. **quiz_results** - نتائج الامتحانات

| العمود | النوع | الوصف |
|--------|------|-------|
| id | uuid | المعرف الفريد |
| template_id | uuid | معرف القالب |
| student_id | text | الرقم المدرسي |
| student_national_id | text | الرقم الوطني |
| student_name | text | اسم التلميذ |
| answers | jsonb | إجابات التلميذ |
| correct_answers | jsonb | الإجابات الصحيحة |
| score | numeric | النقطة |
| total_questions | integer | مجموع الأسئلة |
| scanned_at | timestamptz | تاريخ المسح |
| created_at | timestamptz | تاريخ الإنشاء |

---

### 6. **credentials** - بيانات الدخول

| العمود | النوع | الوصف |
|--------|------|-------|
| id | uuid | المعرف الفريد |
| student_id | text | الرقم المدرسي |
| national_id | text | الرقم الوطني |
| username | text | اسم المستخدم |
| password | text | كلمة المرور |
| platform | text | المنصة (Massar, Moodle) |
| notes | text | ملاحظات |
| created_at | timestamptz | تاريخ الإنشاء |
| updated_at | timestamptz | تاريخ التحديث |

---

### 7. **guidance_data** - بيانات التوجيه

| العمود | النوع | الوصف |
|--------|------|-------|
| id | uuid | المعرف الفريد |
| student_id | text | الرقم المدرسي |
| national_id | text | الرقم الوطني |
| student_name | text | اسم التلميذ |
| current_level | text | المستوى الحالي |
| current_section | text | القسم الحالي |
| guidance_choice_1 | text | الاختيار الأول |
| guidance_choice_2 | text | الاختيار الثاني |
| guidance_choice_3 | text | الاختيار الثالث |
| council_decision | text | قرار المجلس |
| academic_year | text | السنة الدراسية |
| notes | text | ملاحظات |
| created_at | timestamptz | تاريخ الإنشاء |
| updated_at | timestamptz | تاريخ التحديث |

---

### 8. **council_decisions** - قرارات المجالس

| العمود | النوع | الوصف |
|--------|------|-------|
| id | uuid | المعرف الفريد |
| student_id | text | الرقم المدرسي |
| national_id | text | الرقم الوطني |
| student_name | text | اسم التلميذ |
| current_level | text | المستوى الحالي |
| decision | text | القرار |
| next_level | text | المستوى القادم |
| notes | text | ملاحظات |
| academic_year | text | السنة الدراسية |
| decision_date | date | تاريخ القرار |
| created_at | timestamptz | تاريخ الإنشاء |
| updated_at | timestamptz | تاريخ التحديث |

---

### 9. **incoming_students** - التلاميذ الوافدين

| العمود | النوع | الوصف |
|--------|------|-------|
| id | uuid | المعرف الفريد |
| student_id | text | الرقم المدرسي |
| national_id | text | الرقم الوطني |
| first_name | text | الاسم الشخصي |
| last_name | text | الاسم العائلي |
| gender | text | النوع |
| date_of_birth | date | تاريخ الميلاد |
| previous_institution | text | المؤسسة السابقة |
| previous_level | text | المستوى السابق |
| transfer_date | date | تاريخ الانتقال |
| new_level | text | المستوى الجديد |
| new_section | text | القسم الجديد |
| request_number | text | رقم الطلب |
| status | text | حالة الطلب |
| documents | jsonb | الوثائق المطلوبة |
| notes | text | ملاحظات |
| academic_year | text | السنة الدراسية |
| created_at | timestamptz | تاريخ الإنشاء |
| updated_at | timestamptz | تاريخ التحديث |

---

### 10. **outgoing_students** - التلاميذ المغادرين

| العمود | النوع | الوصف |
|--------|------|-------|
| id | uuid | المعرف الفريد |
| student_id | text | الرقم المدرسي |
| national_id | text | الرقم الوطني |
| first_name | text | الاسم الشخصي |
| last_name | text | الاسم العائلي |
| gender | text | النوع |
| current_level | text | المستوى الحالي |
| current_section | text | القسم الحالي |
| destination_institution | text | المؤسسة المستقبلة |
| transfer_date | date | تاريخ المغادرة |
| reason | text | سبب المغادرة |
| request_number | text | رقم الطلب |
| status | text | حالة الطلب |
| documents_sent | boolean | تم إرسال الوثائق |
| notes | text | ملاحظات |
| academic_year | text | السنة الدراسية |
| created_at | timestamptz | تاريخ الإنشاء |
| updated_at | timestamptz | تاريخ التحديث |

---

### 11. **schedules** - جداول الحصص

| العمود | النوع | الوصف |
|--------|------|-------|
| id | uuid | المعرف الفريد |
| section | text | القسم |
| day | text | اليوم |
| period | text | الحصة |
| subject | text | المادة |
| teacher_code | text | رمز الأستاذ |
| teacher_name | text | اسم الأستاذ |
| time_from | text | من الساعة |
| time_to | text | إلى الساعة |
| room | text | القاعة |
| created_at | timestamptz | تاريخ الإنشاء |

---

### 12. **teachers** - الأساتذة

| العمود | النوع | الوصف |
|--------|------|-------|
| id | uuid | المعرف الفريد |
| code | text (unique) | رمز الأستاذ |
| name | text | الاسم الكامل |
| phone | text | رقم الهاتف |
| email | text | البريد الإلكتروني |
| subjects | text[] | المواد المدرسة |
| sections | text[] | الأقسام |
| created_at | timestamptz | تاريخ الإنشاء |

---

### 13. **absences** - الغيابات

| العمود | النوع | الوصف |
|--------|------|-------|
| id | uuid | المعرف الفريد |
| student_id | text | الرقم المدرسي |
| date | date | تاريخ الغياب |
| period | text | الحصة |
| subject | text | المادة |
| time_from | text | من الساعة |
| time_to | text | إلى الساعة |
| room | text | القاعة |
| status | text | الحالة (غائب، حاضر) |
| reason | text | السبب |
| notified | boolean | تم الإشعار |
| created_at | timestamptz | تاريخ الإنشاء |

---

### 14. **permit_tickets** - رخص الغياب

| العمود | النوع | الوصف |
|--------|------|-------|
| id | uuid | المعرف الفريد |
| student_id | text | الرقم المدرسي |
| absence_id | uuid | معرف الغياب |
| issue_date | date | تاريخ الإصدار |
| issued_by | text | أصدرت من طرف |
| printed | boolean | تم الطباعة |
| created_at | timestamptz | تاريخ الإنشاء |

---

### 15. **notifications_log** - سجل الإشعارات

| العمود | النوع | الوصف |
|--------|------|-------|
| id | uuid | المعرف الفريد |
| student_id | text | الرقم المدرسي |
| phone_number | text | رقم الهاتف |
| message | text | الرسالة |
| status | text | حالة الإرسال |
| response | jsonb | استجابة API |
| sent_at | timestamptz | تاريخ الإرسال |

---

### 16. **whatsapp_settings** - إعدادات واتساب

| العمود | النوع | الوصف |
|--------|------|-------|
| id | uuid | المعرف الفريد |
| instance_id | text | معرف Instance |
| access_token | text | Token الوصول |
| is_active | boolean | نشط |
| created_at | timestamptz | تاريخ الإنشاء |
| updated_at | timestamptz | تاريخ التحديث |

---

### 17. **message_templates** - نماذج الرسائل

| العمود | النوع | الوصف |
|--------|------|-------|
| id | uuid | المعرف الفريد |
| name | text | اسم النموذج |
| content | text | محتوى الرسالة |
| category | text | التصنيف |
| created_at | timestamptz | تاريخ الإنشاء |
| updated_at | timestamptz | تاريخ التحديث |

---

### 18. **dismissed_students** - التلاميذ المفصولين

| العمود | النوع | الوصف |
|--------|------|-------|
| id | uuid | المعرف الفريد |
| student_id | text | الرقم المدرسي |
| dismissal_date | date | تاريخ الفصل |
| reason | text | السبب |
| metadata | jsonb | بيانات إضافية |
| created_at | timestamptz | تاريخ الإنشاء |

---

### 19. **unenrolled_students** - التلاميذ غير الملتحقين

| العمود | النوع | الوصف |
|--------|------|-------|
| id | uuid | المعرف الفريد |
| student_id | text | الرقم المدرسي |
| expected_level | text | المستوى المتوقع |
| contact_attempts | integer | عدد محاولات الاتصال |
| last_contact_date | date | آخر تاريخ اتصال |
| reason | text | السبب |
| metadata | jsonb | بيانات إضافية |
| created_at | timestamptz | تاريخ الإنشاء |
| updated_at | timestamptz | تاريخ التحديث |

---

### 20. **database_relationships** - إدارة العلاقات 🔗

| العمود | النوع | الوصف |
|--------|------|-------|
| id | uuid | المعرف الفريد |
| name | text | اسم العلاقة |
| source_table | text | الجدول المصدر |
| source_column | text | العمود المصدر |
| target_table | text | الجدول الهدف |
| target_column | text | العمود الهدف |
| relationship_type | text | نوع العلاقة (1:1, 1:N, N:1, N:N) |
| on_delete | text | سلوك الحذف |
| on_update | text | سلوك التحديث |
| is_active | boolean | نشط |
| description | text | الوصف |
| created_at | timestamptz | تاريخ الإنشاء |
| updated_at | timestamptz | تاريخ التحديث |

---

## العلاقات الأساسية المحددة مسبقاً

1. **students → levels**: N:1 (كل تلميذ لمستوى واحد)
2. **students → sections**: N:1 (كل تلميذ لقسم واحد)
3. **sections → levels**: N:1 (كل قسم لمستوى واحد)
4. **quiz_results → quiz_templates**: N:1
5. **quiz_results → students**: N:1
6. **credentials → students**: 1:1
7. **guidance_data → students**: 1:1
8. **council_decisions → students**: N:1
9. **schedules → sections**: N:1
10. **schedules → teachers**: N:1
11. **absences → students**: N:1
12. **permit_tickets → absences**: 1:1
13. **notifications_log → students**: N:1
14. **incoming_students → levels**: N:1
15. **outgoing_students → students**: N:1
16. **dismissed_students → students**: N:1
17. **unenrolled_students → students**: N:1

---

## الأمان (RLS)

✅ **جميع الجداول محمية بـ Row Level Security (RLS)**

### سياسات الوصول:
- **القراءة**: متاحة للجميع (public read)
- **الكتابة**: للمستخدمين المصادق عليهم فقط (authenticated users)
- **التحديث**: للمستخدمين المصادق عليهم فقط
- **الحذف**: للمستخدمين المصادق عليهم فقط

---

## الوصول إلى صفحة إدارة العلاقات

من القائمة الجانبية → **إدارة علاقات قاعدة البيانات**

### الميزات:
- ✅ عرض جميع العلاقات
- ✅ إضافة علاقة جديدة
- ✅ تعديل علاقة موجودة
- ✅ حذف علاقة
- ✅ تفعيل/تعطيل علاقة
- ✅ تحديد نوع العلاقة (1:1, 1:N, N:1, N:N)
- ✅ تحديد سلوك الحذف والتحديث (CASCADE, SET NULL, RESTRICT)

---

## الجداول المتوفرة في Supabase

```
✅ students
✅ levels
✅ sections
✅ quiz_templates
✅ quiz_results
✅ credentials
✅ guidance_data
✅ council_decisions
✅ incoming_students
✅ outgoing_students
✅ dismissed_students
✅ unenrolled_students
✅ schedules
✅ teachers
✅ absences
✅ permit_tickets
✅ notifications_log
✅ whatsapp_settings
✅ message_templates
✅ database_relationships
```

**إجمالي: 20 جدول**

---

## ملاحظات مهمة

1. **البيانات الحالية في IndexedDB**: لا تزال موجودة محلياً في المتصفح
2. **للانتقال إلى Supabase**: يجب تحديث كود `database.ts` للاتصال بـ Supabase بدلاً من IndexedDB
3. **الجداول فارغة حالياً**: يجب استيراد البيانات من IndexedDB أو إدخالها يدوياً
4. **العلاقات**: محفوظة في جدول `database_relationships` للتوثيق، لتطبيقها كـ Foreign Keys فعلية يجب إنشاء Migration

---

## الخطوات التالية المقترحة

1. تحديث `src/utils/database.ts` للاتصال بـ Supabase
2. إنشاء نصوص لاستيراد البيانات من IndexedDB إلى Supabase
3. تطبيق Foreign Keys الفعلية عبر Migrations
4. اختبار جميع الوظائف مع Supabase

---

تم إنشاء هذا التوثيق بتاريخ: 2025-10-21
