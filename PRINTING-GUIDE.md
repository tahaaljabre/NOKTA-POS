# دليل الطباعة في NOKTA POS
## Printing Guide

## Arabic / العربية

### أنواع الطباعة المتاحة:

#### 1️⃣ الطباعة من المتصفح (Browser Print)
- **الاستخدام**: عند طباعة الفاتورة، سيفتح نافذة الطباعة
- **اختيار الطابعة**: يمكنك اختيار **أي طابعة** متصلة بجهازك:
  - طابعة حرارية (80mm أو 58mm)
  - طابعة عادية (A4)
  - طابعة PDF
  - أي طابعة أخرى في النظام

#### 2️⃣ إعدادات الطباعة الحرارية
للحصول على أفضل نتائج مع الطابعة الحرارية:

**في نافذة الطباعة:**
1. اختر الطابعة الحرارية من القائمة
2. **المقاس**: اختر "مخصص" أو Custom Size
3. **العرض**: 80mm (أو 58mm حسب طابعتك)
4. **الطول**: Auto أو 200mm
5. **الهوامش**: 0mm (صفر)

**في Windows:**
- الإعدادات → الطابعات والماسحات الضوئية
- اختر الطابعة الحرارية → إدارة
- تفضيلات الطباعة → حجم الورق: 80mm (تخصيص)

#### 3️⃣ حل المشاكل الشائعة

**المشكلة**: الفاتورة تطبع على ورق A4 كبير
- **الحل**: في نافذة الطباعة، غيّر المقاس إلى 80mm

**المشكلة**: الهوامش كبيرة أو النص مقصوص
- **الحل**: اضبط الهوامش إلى 0 من إعدادات الطباعة

**المشكلة**: النص صغير جداً أو كبير جداً
- **الحل**: استخدم خاصية التكبير/التصغير (Zoom/Scale) في نافذة الطباعة

#### 4️⃣ الطباعة الآلية (للمطورين)
إذا أردت طباعة آلية بدون نافذة:
- استخدم خادم طباعة ESC/POS مخصص
- راجع `/api/print/invoice/:id` في `src/routes/print.routes.js`

---

## English

### Available Printing Methods:

#### 1️⃣ Browser Print
- **Usage**: When printing a receipt, a print dialog will open
- **Printer Selection**: You can choose **ANY printer** connected to your device:
  - Thermal printer (80mm or 58mm)
  - Regular printer (A4)
  - PDF printer
  - Any other system printer

#### 2️⃣ Thermal Printing Setup
For best results with thermal printers:

**In the print dialog:**
1. Select your thermal printer from the list
2. **Size**: Choose "Custom"
3. **Width**: 80mm (or 58mm depending on your printer)
4. **Height**: Auto or 200mm
5. **Margins**: 0mm (zero)

**In Windows:**
- Settings → Printers & Scanners
- Select thermal printer → Manage
- Printing Preferences → Paper Size: 80mm (custom)

#### 3️⃣ Troubleshooting

**Issue**: Receipt prints on large A4 paper
- **Solution**: Change size to 80mm in print dialog

**Issue**: Large margins or cut-off text
- **Solution**: Set margins to 0 in print settings

**Issue**: Text too small or too large
- **Solution**: Use Zoom/Scale feature in print dialog

#### 4️⃣ Automatic Printing (For Developers)
For automatic printing without dialogs:
- Use a dedicated ESC/POS print server
- See `/api/print/invoice/:id` in `src/routes/print.routes.js`

---

## ملاحظات تقنية / Technical Notes

- النظام يستخدم `@page { size: 80mm auto; }` كمقاس افتراضي
- المتصفح يسمح للمستخدم باختيار أي طابعة وتعديل الإعدادات
- للطباعة الآلية، يمكن دمج خادم ESC/POS منفصل
- The system uses `@page { size: 80mm auto; }` as default size
- Browser allows user to select any printer and modify settings
- For automatic printing, integrate a separate ESC/POS server
