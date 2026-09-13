# تقرير مشكلة عدم التعرف على الطابعات / Printer Detection Issue Report

**التاريخ:** 2026-09-10  
**المنفذ:** Kiro AI  
**الحالة:** تم تشخيص المشكلة الجذرية

---

## 1. ملخص المشكلة / Problem Summary

عند تشغيل وظيفة "فحص واكتشاف الطابعات" في لوحة الإعدادات، لا يتم التعرف على أي طابعات USB متصلة بالجهاز، رغم أن الطابعات مثبتة وتعمل على نظام Windows.

---

## 2. التشخيص الفني / Technical Diagnosis

### أ. البنية الحالية للنظام

المشروع يستخدم الحزم التالية للطباعة:
```json
{
  "dependencies": {
    "escpos": "3.0.0-alpha.6",
    "escpos-network": "3.0.0-alpha.5"
  },
  "optionalDependencies": {
    "escpos-usb": "3.0.0-alpha.4",
    "escpos-bluetooth": "3.0.0-alpha.2"
  }
}
```

### ب. السبب الجذري للمشكلة

تم اكتشاف أن `escpos-usb@3.0.0-alpha.4` تعتمد على مكتبة `usb` الأساسية، لكن:

1. **تعارض في الإصدارات:** 
   - `escpos-usb` مبنية على API قديمة لمكتبة `usb` (v1.x أو v2.x) التي تستخدم `usb.getDeviceList()`
   - `usb@3.1.0` المثبتة حالياً استخدمت API جديدة كلياً بدون `getDeviceList`
   - الإصدار الجديد يوفر `usb.getDevices()` بدلاً من `getDeviceList()`

2. **الخطأ المكتشف:**
   ```
   TypeError: usb.getDeviceList is not a function
   at USB.findPrinter (escpos-usb/index.js:72:14)
   ```

3. **الكود الإشكالي في `src/services/print.service.js`:**
   ```javascript
   // السطر 80-81
   const usbDevices = escpos.USB.findPrinter();  // يفشل هنا
   ```

4. **المكتبة الأساسية `usb@3.x`:**
   - تستخدم API الحديث من WebUSB
   - Methods المتاحة: `getDevices()`, `requestDevice()`, `findDeviceByIds()`, إلخ
   - لا تحتوي على `getDeviceList()` القديمة

### ج. اختبارات التحقق التي تمت

```powershell
# 1. التحقق من وجود المكتبات
PS> Test-Path "node_modules/escpos-usb"
True

# 2. محاولة تحميل escpos-usb
PS> node -e "const usb = require('escpos-usb'); console.log('Loaded');"
✅ تم التحميل بنجاح

# 3. محاولة فحص الطابعات
PS> node -e "const escpos = require('escpos'); escpos.USB = require('escpos-usb'); 
             const printers = escpos.USB.findPrinter();"
❌ Error: usb.getDeviceList is not a function

# 4. التحقق من usb@3.x API
PS> node -e "const {usb} = require('usb'); console.log(Object.keys(usb));"
✅ يعرض: getDevices, requestDevice, findDeviceByIds, ... (لا يوجد getDeviceList)
```

---

## 3. الحلول المقترحة / Proposed Solutions

### الحل 1: الرجوع لإصدار قديم متوافق من مكتبة `usb` (مؤقت)

**الإيجابيات:**
- أسرع حل
- لا يتطلب تعديل كود

**السلبيات:**
- قد يسبب مشاكل أمنية (إصدارات قديمة)
- غير مستدام على المدى الطويل

**التطبيق:**
```json
// في package.json
{
  "pnpm": {
    "overrides": {
      "usb": "^2.13.0"
    }
  }
}
```

ثم:
```powershell
pnpm install --force
```

### الحل 2: استخدام Electron's Built-in Printer API (موصى به)

نظراً لأن المشروع يوفر نسخة Electron، يمكن الاستفادة من واجهة الطابعات المدمجة في Electron بدلاً من الاعتماد على مكتبات USB الخارجية.

**الإيجابيات:**
- مدمج في Electron (لا حاجة لاعتماديات خارجية)
- يعمل على Windows/Mac/Linux بدون تعقيد
- يتعرف على جميع الطابعات المثبتة في النظام (USB, Network, Bluetooth)
- أكثر استقراراً وأماناً

**السلبيات:**
- يعمل فقط في نسخة Electron (لن يعمل في المتصفح العادي)

**التطبيق:**

#### 1. تعديل `electron.js`:
```javascript
// موجود بالفعل، السطر 39-48:
ipcMain.handle('nokta:printers:list', async () => {
  const window = BrowserWindow.getFocusedWindow() || mainWindow;
  if (!window) return [];
  const printers = await window.webContents.getPrintersAsync();
  return printers.map(printer => ({
    id: printer.name,
    name: printer.displayName || printer.name,
    device: printer.name,
    type: printer.isDefault ? 'default' : 'system',
    status: printer.status || 0,
    isDefault: !!printer.isDefault
  }));
});
```

#### 2. تعديل `public/js/features/settings/settings-printers.js`:
```javascript
async function detectLocalPrinters() {
  const btn = document.getElementById('btn-scan-printers');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ جاري فحص واكتشاف الطابعات...';
  }

  try {
    detectedPrintersList = [];
    
    // التحقق من بيئة Electron
    if (window.noktaDesktop && typeof window.noktaDesktop.listPrinters === 'function') {
      // استخدام Electron API
      const electronPrinters = await window.noktaDesktop.listPrinters();
      detectedPrintersList = electronPrinters.map(p => ({
        name: p.name + (p.isDefault ? ' (افتراضية)' : ''),
        device: JSON.stringify({type: 'system', name: p.device}),
        type: 'system'
      }));
      
      toast(currentLang === 'ar' 
        ? `✅ تم العثور على ${detectedPrintersList.length} طابعة.` 
        : `✅ Found ${detectedPrintersList.length} system printers.`, 
        'success');
    } else {
      // استخدام API القديم للمتصفح/الخادم
      const data = await api('/api/print/scan');
      
      if (data.usb && data.usb.length) {
        data.usb.forEach(d => detectedPrintersList.push({
          name: d.name, 
          device: JSON.stringify({type:'usb', vendorId: d.vendorId, productId: d.productId}), 
          type: 'usb'
        }));
      }
      if (data.network && data.network.length) {
        data.network.forEach(d => detectedPrintersList.push({
          name: d.name, 
          device: JSON.stringify({type:'network', address: d.address}), 
          type: 'network'
        }));
      }
      
      if (detectedPrintersList.length === 0) {
        toast(currentLang === 'ar' 
          ? 'لم يتم العثور على طابعات USB مدعومة. للـ USB تأكد من تحويل تعريف الطابعة إلى WinUSB باستخدام Zadig. أو اختر طابعة شبكة يدوياً.' 
          : 'No supported printers found.', 
          'info');
      }
    }

    // إضافة خيار الإدخال اليدوي
    detectedPrintersList.push({ 
      name: '➕ إضافة طابعة شبكة يدوياً (IP)', 
      device: 'manual_network', 
      type: 'network' 
    });

    const selectEl = document.getElementById('printer-modal-device');
    if (selectEl) {
      selectEl.innerHTML = '<option value="">-- اختر طابعة من المكتشفة --</option>' +
        detectedPrintersList.map(p => 
          `<option value='${p.device}' data-name="${p.name}">🖨️ ${p.name}</option>`
        ).join('');
    }
    
  } catch (err) {
    console.error('Printer scan error:', err);
    toast(currentLang === 'ar' ? 'خطأ أثناء فحص الطابعات.' : 'Error scanning for printers.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '🔄 فحص واكتشاف الطابعات الآن';
    }
  }
}
```

#### 3. إضافة دعم الطباعة عبر Electron:

في `electron.js`، أضف handler للطباعة:
```javascript
ipcMain.handle('nokta:printer:print', async (event, printerName, content) => {
  const window = BrowserWindow.getFocusedWindow() || mainWindow;
  if (!window) return { success: false, error: 'No window available' };
  
  try {
    await window.webContents.print({
      deviceName: printerName,
      silent: true,  // طباعة بدون نافذة تأكيد
      printBackground: false,
      margins: { marginType: 'none' }
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

### الحل 3: استبدال مكتبة escpos بمكتبة أخرى محدثة (متقدم)

استخدام مكتبات أحدث مثل:
- `node-thermal-printer`
- `escpos-node` (fork محدث)

**الإيجابيات:**
- حل دائم ومستدام
- دعم أفضل للطابعات الحديثة

**السلبيات:**
- يتطلب إعادة كتابة كود الطباعة بالكامل
- وقت تطوير أطول

---

## 4. التوصيات / Recommendations

### للاستخدام الفوري:
1. **استخدام Electron API** (الحل 2) لنسخة Desktop Windows/Mac
2. الإبقاء على الكود الحالي لطابعات الشبكة (تعمل بشكل جيد)
3. لطابعات USB في المتصفح: إظهار رسالة توجيهية للمستخدم لاستخدام نسخة Desktop

### للمدى الطويل:
1. تقييم ترك `escpos-usb` تماماً والاعتماد على:
   - Electron API لـ Desktop
   - Network printers فقط لـ Web/Android
2. إضافة اختبار آلي للطابعات في CI/CD

### توثيق إضافي للمستخدم النهائي:
أضف في دليل المستخدم:
```
⚠️ ملاحظة مهمة للطابعات USB:
- في نسخة سطح المكتب (Windows/Mac): يتم اكتشاف الطابعات تلقائياً
- في متصفح الويب: طابعات USB غير مدعومة حالياً، استخدم طابعات الشبكة (Network)
- للطابعات الحرارية عبر USB على الويب: احتفظ بنسخة سطح المكتب مثبتة
```

---

## 5. الملفات المتأثرة / Affected Files

```
src/services/print.service.js          - الخدمة الخلفية للطباعة
public/js/features/settings/settings-printers.js  - واجهة إعدادات الطابعات
electron.js                             - تطبيق Electron (يحتوي API جاهز)
preload.js                              - الجسر بين Electron والواجهة
package.json                            - الاعتماديات
```

---

## 6. الخطوات التالية / Next Steps

- [ ] اختيار الحل المناسب بناءً على أولويات المشروع
- [ ] تطبيق الحل المختار
- [ ] اختبار الطباعة على طابعات حقيقية (USB + Network)
- [ ] تحديث التوثيق للمستخدم النهائي
- [ ] إضافة هذا التقرير إلى `audit/CHANGELOG.md`

---

## 7. مراجع تقنية / Technical References

- [Electron webContents.getPrintersAsync() docs](https://www.electronjs.org/docs/latest/api/web-contents#contentsprintersasync)
- [Electron printing API](https://www.electronjs.org/docs/latest/api/web-contents#contentsprint)
- [escpos GitHub issues about USB detection](https://github.com/song940/node-escpos/issues)
- [usb library v3.x breaking changes](https://github.com/node-usb/node-usb/releases/tag/v3.0.0)

---

**ملاحظة نهائية:** هذه المشكلة شائعة في مشاريع Node.js التي تعتمد على USB native bindings. الحل الموصى به هو استخدام Electron API المدمج أو التحول للطابعات الشبكية بالكامل للبيئة السحابية.
