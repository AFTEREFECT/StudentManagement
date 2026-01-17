# أمثلة الربط مع نظام إدارة التلاميذ

## ملاحظة مهمة
هذه الأمثلة للمرجع فقط. **لا تقم بتعديل أي ملفات في المشروع الرئيسي**.
النظام الحالي يمكنه الاتصال بـ Evolution API عبر HTTP فقط.

---

## 1. إرسال رسالة نصية

### Endpoint
```
POST http://[SERVER_IP]:8080/message/sendText/[INSTANCE_NAME]
```

### Headers
```json
{
  "Content-Type": "application/json",
  "apikey": "myEvolutionKey2025"
}
```

### Body
```json
{
  "number": "212600000000",
  "text": "السلام عليكم، هذه رسالة من نظام إدارة التلاميذ"
}
```

### مثال باستخدام fetch
```typescript
const sendTextMessage = async (phoneNumber: string, message: string) => {
  try {
    const response = await fetch('http://localhost:8080/message/sendText/school_system', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'myEvolutionKey2025'
      },
      body: JSON.stringify({
        number: phoneNumber,
        text: message
      })
    });

    const result = await response.json();
    console.log('Message sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};
```

---

## 2. إرسال رسالة مع ملف

### Endpoint
```
POST http://[SERVER_IP]:8080/message/sendMedia/[INSTANCE_NAME]
```

### Body
```json
{
  "number": "212600000000",
  "mediatype": "document",
  "media": "https://example.com/document.pdf",
  "caption": "تقرير الغياب الشهري"
}
```

### مثال
```typescript
const sendMediaMessage = async (phoneNumber: string, fileUrl: string, caption: string) => {
  const response = await fetch('http://localhost:8080/message/sendMedia/school_system', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': 'myEvolutionKey2025'
    },
    body: JSON.stringify({
      number: phoneNumber,
      mediatype: 'document',
      media: fileUrl,
      caption: caption
    })
  });

  return response.json();
};
```

---

## 3. إرسال رسائل جماعية

```typescript
const sendBulkMessages = async (contacts: Array<{phone: string, message: string}>) => {
  const results = [];

  for (const contact of contacts) {
    try {
      const result = await sendTextMessage(contact.phone, contact.message);
      results.push({ phone: contact.phone, success: true, data: result });

      // انتظار ثانية بين كل رسالة لتجنب الحظر
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      results.push({ phone: contact.phone, success: false, error });
    }
  }

  return results;
};
```

---

## 4. التحقق من حالة Instance

### Endpoint
```
GET http://[SERVER_IP]:8080/instance/connectionState/[INSTANCE_NAME]
```

### مثال
```typescript
const checkInstanceStatus = async () => {
  const response = await fetch('http://localhost:8080/instance/connectionState/school_system', {
    headers: {
      'apikey': 'myEvolutionKey2025'
    }
  });

  const data = await response.json();
  console.log('Instance status:', data.state); // 'open', 'close', 'connecting'
  return data;
};
```

---

## 5. الحصول على معلومات Instance

```typescript
const getInstanceInfo = async () => {
  const response = await fetch('http://localhost:8080/instance/fetchInstances', {
    headers: {
      'apikey': 'myEvolutionKey2025'
    }
  });

  return response.json();
};
```

---

## 6. إعادة الاتصال بـ WhatsApp

```typescript
const reconnectInstance = async () => {
  const response = await fetch('http://localhost:8080/instance/restart/school_system', {
    method: 'PUT',
    headers: {
      'apikey': 'myEvolutionKey2025'
    }
  });

  return response.json();
};
```

---

## 7. استقبال الرسائل (Webhook - اختياري)

إذا أردت استقبال الرسائل الواردة، يمكنك إعداد webhook:

### إعداد Webhook
```typescript
const setupWebhook = async (webhookUrl: string) => {
  const response = await fetch('http://localhost:8080/webhook/set/school_system', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': 'myEvolutionKey2025'
    },
    body: JSON.stringify({
      url: webhookUrl,
      enabled: true,
      events: ['MESSAGES_UPSERT', 'SEND_MESSAGE']
    })
  });

  return response.json();
};
```

---

## 8. مثال تطبيق كامل: إرسال إشعار غياب

```typescript
interface Student {
  name: string;
  parentPhone: string;
  absenceDays: number;
}

const sendAbsenceNotifications = async (students: Student[]) => {
  console.log(`Sending notifications to ${students.length} parents...`);

  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  for (const student of students) {
    const message = `
السلام عليكم ورحمة الله

نود إعلامكم أن ابنكم/ابنتكم *${student.name}*
قد تغيب/ت لمدة *${student.absenceDays}* يوم.

يرجى التواصل مع إدارة المؤسسة.

شكرا لتفهمكم
    `.trim();

    try {
      await sendTextMessage(student.parentPhone, message);
      results.success++;
      console.log(`✓ Sent to ${student.name}`);

      // انتظار ثانية بين الرسائل
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      results.failed++;
      results.errors.push({ student: student.name, error });
      console.error(`✗ Failed for ${student.name}:`, error);
    }
  }

  console.log('\nResults:');
  console.log(`Success: ${results.success}`);
  console.log(`Failed: ${results.failed}`);

  return results;
};
```

---

## معلومات مهمة

### أنواع الرسائل المدعومة
- **text**: رسائل نصية عادية
- **image**: صور
- **video**: فيديو
- **audio**: ملفات صوتية
- **document**: ملفات PDF, Word, Excel, إلخ

### تنسيق رقم الهاتف
يجب أن يكون الرقم بالصيغة الدولية بدون `+` أو `-` أو مسافات:
- ✅ صحيح: `212600000000`
- ❌ خطأ: `+212 6 00 00 00 00`
- ❌ خطأ: `0600000000`

### معدل الإرسال
لتجنب الحظر من WhatsApp:
- لا ترسل أكثر من رسالة واحدة في الثانية
- استخدم فترات انتظار بين الرسائل الجماعية
- لا ترسل نفس الرسالة لأكثر من 100 شخص في اليوم

### معالجة الأخطاء
```typescript
try {
  const result = await sendTextMessage(phone, message);
  if (result.key) {
    console.log('Message sent successfully');
  }
} catch (error) {
  if (error.response?.status === 401) {
    console.error('Invalid API key');
  } else if (error.response?.status === 404) {
    console.error('Instance not found');
  } else {
    console.error('Unknown error:', error);
  }
}
```

---

## التوثيق الكامل

للمزيد من endpoints والخيارات المتقدمة:
- https://doc.evolution-api.com/v2/pt/get-started/introduction
- https://doc.evolution-api.com/v2/pt/endpoints/send-messages

---

**تذكير**: هذه الأمثلة للمرجع فقط. استخدمها عبر HTTP API من برنامجك الحالي دون تعديل أي كود موجود.
