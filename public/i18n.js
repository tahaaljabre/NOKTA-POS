// ===== i18n: Arabic & English =====
// Translation engine. Dictionaries are loaded first from i18n/ar.js and i18n/en.js.
const I18N = { ar: I18N_AR, en: I18N_EN };

Object.assign(I18N.ar,{perm_kitchen:'تجهيز المطبخ',perm_discount_orders:'منح الخصومات',perm_cancel_orders:'إلغاء الطلبات',emp_role_kitchen:'المطبخ',business_timezone:'المنطقة الزمنية للمنشأة',backup_private:'تحتوي النسخة على بيانات حساسة؛ احفظها في مكان آمن',backup_database_btn:'تنزيل قاعدة النظام كاملة',backup_database_exporting:'جاري تجهيز نسخة قاعدة النظام الكاملة...',backup_database_success:'تم تنزيل نسخة قاعدة النظام الكاملة',backup_database_failed:'تعذر تنزيل نسخة قاعدة النظام',backup_restore_database_title:'استعادة قاعدة البيانات الكاملة',backup_restore_database_warn:'⚠️ تحذير: سيتم استبدال قاعدة البيانات بالكامل وإعادة تشغيل الخادم. استخدم ملف .sqlite فقط.',backup_choose_database_file:'اختر ملف .sqlite',backup_restore_database_btn:'استعادة القاعدة',closing_backup_success:'تم حفظ نسخة كاملة بعد الإغلاق',closing_backup_failed:'تم الإغلاق لكن تعذر حفظ النسخة الاحتياطية',export_excel:'تصدير Excel',excel_exporting:'جاري إنشاء ملف Excel...',excel_export_success:'تم تنزيل تقرير Excel',excel_export_failed:'تعذر إنشاء تقرير Excel',loading_modifiers:'جاري تحميل الإضافات...',modifiers_failed:'تعذر تحميل الإضافات',no_modifiers:'لا توجد إضافات',modifier_required:'مطلوب',unsecured_connection:'اتصال غير مشفر؛ استخدم HTTPS على شبكة المنشأة لتفعيل العمل دون اتصال بأمان',kds_no_table:'بدون طاولة',max_discount_reached:'تم تجاوز الحد الأقصى للخصم المسموح لك',setup_app_title:"إعداد التطبيق",setup_app_desc:"أدخل عنوان الخادم للاتصال بشبكة المنشأة",server_url_label:"عنوان الخادم",save_and_start:"حفظ والبدء",setup_offline_hint:"يمكنك تغيير العنوان لاحقًا من إعدادات التطبيق",server_connection:"اتصال الخادم",server_connection_desc:"عنوان الخادم المستخدم من هذا الجهاز",refresh_ip:"تحديث العنوان",copy_link:"نسخ الرابط",open_new_tab:"فتح في تبويب جديد",financial_settings:"الإعدادات المالية",tax_type:"نوع الضريبة",tax_inclusive:"شاملة",tax_exclusive:"غير شاملة",receipt_preview:"معاينة الإيصال",receipt_preview_desc:"ما سيظهر في الإيصال المطبوع",perm_inventory:"إدارة المخزون",perm_tables:"إدارة الطاولات",perm_dashboard:"لوحة القيادة",perm_customers:"إدارة العملاء",invoice_number_ph:"رقم الفاتورة",payment_info:"بيانات الدفعة",payment_date:"تاريخ الدفعة",add_modifier:"+ إضافة جديدة",dash_sales_trend:"اتجاه المبيعات",dash_payment_methods:"طرق الدفع",dash_employee_performance:"أداء الموظفين",printer_name_label:"اسم الطابعة",printer_device_label:"الجهاز",printer_auto_print_label:"طباعة تلقائية"});
Object.assign(I18N.en,{perm_kitchen:'Kitchen preparation',perm_discount_orders:'Apply discounts',perm_cancel_orders:'Cancel orders',emp_role_kitchen:'Kitchen',business_timezone:'Business time zone',backup_private:'Backup contains sensitive data; keep it in a secure location',backup_database_btn:'Download full system database',backup_database_exporting:'Preparing the full system database backup...',backup_database_success:'Full system database backup downloaded',backup_database_failed:'Unable to download the full system database backup',backup_restore_database_title:'Restore Full Database',backup_restore_database_warn:'⚠️ Warning: The entire database will be replaced and the server will restart. Use .sqlite file only.',backup_choose_database_file:'Choose .sqlite file',backup_restore_database_btn:'Restore Database',closing_backup_success:'Full backup saved after closing',closing_backup_failed:'Closing completed, but the backup could not be saved',export_excel:'Export Excel',excel_exporting:'Creating the Excel file...',excel_export_success:'Excel report downloaded',excel_export_failed:'Unable to create the Excel report',loading_modifiers:'Loading modifiers...',modifiers_failed:'Unable to load modifiers',no_modifiers:'No modifiers available',modifier_required:'Required',unsecured_connection:'Unencrypted connection; use HTTPS on the business network for secure offline support',kds_no_table:'No table',max_discount_reached:'You have reached your maximum allowed discount',setup_app_title:"App Setup",setup_app_desc:"Enter the server address to connect to the business network",server_url_label:"Server address",save_and_start:"Save and start",setup_offline_hint:"You can change this address later from the app settings",server_connection:"Server connection",server_connection_desc:"The server address this device uses",refresh_ip:"Refresh address",copy_link:"Copy link",open_new_tab:"Open in a new tab",financial_settings:"Financial settings",tax_type:"Tax type",tax_inclusive:"Inclusive",tax_exclusive:"Exclusive",receipt_preview:"Receipt preview",receipt_preview_desc:"What the printed receipt will show",perm_inventory:"Manage inventory",perm_tables:"Manage tables",perm_dashboard:"Dashboard",perm_customers:"Manage customers",invoice_number_ph:"Invoice number",payment_info:"Payment information",payment_date:"Payment date",add_modifier:"+ Add modifier",dash_sales_trend:"Sales trend",dash_payment_methods:"Payment methods",dash_employee_performance:"Employee performance",printer_name_label:"Printer name",printer_device_label:"Device",printer_auto_print_label:"Auto print"});
let currentLang = localStorage.getItem('pos_lang') || 'ar';

function t(key) {
  if (key === 'currency') {
    return (typeof getCurrency === 'function') ? getCurrency() : (localStorage.getItem('pos_currency') || '฿');
  }
  return (I18N[currentLang] && I18N[currentLang][key]) || key;
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key === 'currency') {
      el.textContent = t('currency');
    } else if (I18N[currentLang] && I18N[currentLang][key]) {
      el.textContent = I18N[currentLang][key];
    }
  });
  document.querySelectorAll('.currency').forEach(el => {
    el.textContent = t('currency');
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (I18N[currentLang] && I18N[currentLang][key]) {
      el.placeholder = I18N[currentLang][key];
    }
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (I18N[currentLang] && I18N[currentLang][key]) {
      el.title = I18N[currentLang][key];
      el.setAttribute('aria-label', I18N[currentLang][key]);
    }
  });
  document.documentElement.lang = currentLang;
  document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
}

function toggleLanguage() {
  currentLang = currentLang === 'ar' ? 'en' : 'ar';
  localStorage.setItem('pos_lang', currentLang);
  applyTranslations();
  if (typeof renderCategoryTabs === 'function') renderCategoryTabs();
  if (typeof loadMenuGrid === 'function') loadMenuGrid();
  if (typeof renderOrderItems === 'function') renderOrderItems();
  if (typeof loadTables === 'function') loadTables();
  if (typeof loadActiveOrders === 'function') loadActiveOrders();
  if (typeof loadInvoices === 'function') loadInvoices();
  if (typeof loadMenuAdmin === 'function') loadMenuAdmin();
  if (typeof loadEmployeesAdmin === 'function') loadEmployeesAdmin();
  if (typeof loadAttendanceAdmin === 'function') loadAttendanceAdmin();
  if (typeof loadTablesAdmin === 'function') loadTablesAdmin();
  
  if (typeof updateHeaderRestaurantName === 'function') updateHeaderRestaurantName();
  const loginSub = document.getElementById('login-subtitle');
  if (loginSub) {
    const mode = document.getElementById('login-screen')?.dataset.setupMode;
    loginSub.textContent = mode === 'migration' ? t('migrate_admin_login') : (mode === 'initial' ? t('setup_first_admin') : t('login_subtitle'));
  }
}
