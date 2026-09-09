// ===== i18n: Arabic & English =====
// Translation engine. Dictionaries are loaded first from i18n/ar.js and i18n/en.js.
const I18N = { ar: I18N_AR, en: I18N_EN };

Object.assign(I18N.ar,{perm_kitchen:'تجهيز المطبخ',perm_discount_orders:'منح الخصومات',perm_cancel_orders:'إلغاء الطلبات',emp_role_kitchen:'المطبخ',business_timezone:'المنطقة الزمنية للمنشأة',backup_private:'تحتوي النسخة على بيانات حساسة؛ احفظها في مكان آمن',backup_database_btn:'تنزيل قاعدة النظام كاملة',backup_database_exporting:'جاري تجهيز نسخة قاعدة النظام الكاملة...',backup_database_success:'تم تنزيل نسخة قاعدة النظام الكاملة',backup_database_failed:'تعذر تنزيل نسخة قاعدة النظام',closing_backup_success:'تم حفظ نسخة كاملة بعد الإغلاق',closing_backup_failed:'تم الإغلاق لكن تعذر حفظ النسخة الاحتياطية',export_excel:'تصدير Excel',excel_exporting:'جاري إنشاء ملف Excel...',excel_export_success:'تم تنزيل تقرير Excel',excel_export_failed:'تعذر إنشاء تقرير Excel',loading_modifiers:'جاري تحميل الإضافات...',modifiers_failed:'تعذر تحميل الإضافات',no_modifiers:'لا توجد إضافات',modifier_required:'مطلوب',unsecured_connection:'اتصال غير مشفر؛ استخدم HTTPS على شبكة المنشأة لتفعيل العمل دون اتصال بأمان',kds_no_table:'بدون طاولة'});
Object.assign(I18N.en,{perm_kitchen:'Kitchen preparation',perm_discount_orders:'Apply discounts',perm_cancel_orders:'Cancel orders',emp_role_kitchen:'Kitchen',business_timezone:'Business time zone',backup_private:'Backup contains sensitive data; keep it in a secure location',backup_database_btn:'Download full system database',backup_database_exporting:'Preparing the full system database backup...',backup_database_success:'Full system database backup downloaded',backup_database_failed:'Unable to download the full system database backup',closing_backup_success:'Full backup saved after closing',closing_backup_failed:'Closing completed, but the backup could not be saved',export_excel:'Export Excel',excel_exporting:'Creating the Excel file...',excel_export_success:'Excel report downloaded',excel_export_failed:'Unable to create the Excel report',loading_modifiers:'Loading modifiers...',modifiers_failed:'Unable to load modifiers',no_modifiers:'No modifiers available',modifier_required:'Required',unsecured_connection:'Unencrypted connection; use HTTPS on the business network for secure offline support',kds_no_table:'No table'});
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
