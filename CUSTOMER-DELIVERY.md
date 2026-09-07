# تسليم NOKTA POS للعميل / Customer delivery

## ما يتم تسليمه

- مثبت Windows: `release/windows/NOKTA POS Setup 1.0.0.exe`
- تطبيق Android: لا يُسلّم `app-release-unsigned.apk`. يجب توقيعه أولًا بمفتاح إصدار محفوظ لدى مالك البرنامج.
- دليل الوصول: `REMOTE-ACCESS.md`

## إعداد كمبيوتر المطعم

1. ثبّت NOKTA POS على الكمبيوتر الرئيسي.
2. اجعل عنوان IP الداخلي للكمبيوتر ثابتًا من إعدادات الراوتر.
3. ثبّت Tailscale وسجل الدخول بحساب يملكه العميل، ثم فعّل Serve إلى `http://127.0.0.1:3000`.
4. أنشئ حساب المدير من شاشة الإعداد الأولى، ولا تشارك كلمة مروره.
5. افتح التطبيق من جهاز داخل المطعم باستخدام `http://IP:3000`، ومن جهاز المدير باستخدام رابط Tailscale HTTPS.
6. نفّذ طلبًا تجريبيًا وطباعة وإلغاء واسترجاع نسخة احتياطية قبل بدء البيع الحقيقي.

## الحماية والاستمرارية

- يعمل البيع داخل المطعم من الشبكة المحلية عند انقطاع الإنترنت.
- يتوقف دخول المدير من الخارج أثناء انقطاع إنترنت المطعم، ويعود بعد رجوعه.
- تحفظ النسخ اليومية في مجلد بيانات البرنامج لمدة 30 يومًا. انسخ مجلد النسخ إلى قرص خارجي أو وجهة مشفرة خارج الكمبيوتر أسبوعيًا.
- احتفظ بمفتاح توقيع Android وكلماته في مكانين آمنين. فقدانه يمنع إصدار تحديث يُثبت فوق النسخة الحالية.

## English

Install NOKTA POS on the restaurant's main Windows computer, reserve its LAN IP, enroll that computer in a customer-owned Tailscale account, and enable Serve to `http://127.0.0.1:3000`. Restaurant devices use the LAN URL; the manager uses the HTTPS Tailscale URL. Complete an on-site order, print, cancellation, and restore test before live sales. Keep the Android release key and an off-computer encrypted backup under the software owner's control.
