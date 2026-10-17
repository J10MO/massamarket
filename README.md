# Juman جُمان — متجر فساتين نسائية

React (Vite) + Node.js (Express) + PostgreSQL. Arabic RTL, mobile-first. Product images come from public Pinterest boards.

## التشغيل

```bash
npm run install:all                     # install all dependencies
copy server\.env.example server\.env    # then set your postgres password in DATABASE_URL
npm run setup                           # creates DB + tables + admin + imports ~350 dresses from Pinterest
npm run dev                             # API :5000 + site :5173
```

Open http://localhost:5173 (on a phone on the same Wi-Fi: http://<your-PC-IP>:5173).

**لوحة التحكم:** سجّلي الدخول بحساب المدير (`ADMIN_EMAIL` / `ADMIN_PASSWORD` من `.env`) فتُفتح `/admin` في نافذة جديدة. فيها: لوحة معلومات، الطلبات، الفساتين (إضافة/تعديل/رفع صور)، الأقسام، العملاء، الاستيراد من Pinterest، والإعدادات (العملة، التوصيل، المحافظات، واتساب، إنستغرام، نصوص الواجهة). غيّري كلمة مرور المدير من صفحة الإعدادات.

الصور المرفوعة تُحفظ في `server/uploads/`. تعديلات قاعدة البيانات تُطبَّق تلقائياً عند تشغيل الخادم.

## Pinterest
- Uses Pinterest's public endpoints: the board RSS feed (`/user/board.rss`, latest ~25 pins) and oEmbed (single pin).
- Each category's boards are in [server/src/lib/catalog.js](server/src/lib/catalog.js). `npm run import` pulls new pins.
- Product names, prices and sizes are generated automatically. Edit them from the admin dashboard.
- Images on Pinterest belong to their owners. Before going live commercially, replace them with photos of your own products or ones you have rights to.

## Production
```bash
npm run build && npm start   # Express serves the API and client/dist on port 5000
```

## سوق المستعمل (بيع مباشر بين العميلات)
- `/market` تصفح، `/sell` إضافة إعلان، `/my/listings` مركز البائعة، `/my/purchases` مشتريات المستعمل.
- الإعلان يُراجع من الإدارة قبل النشر (يمكن تعطيل المراجعة من الإعدادات).
- الشراء يحجز الفستان؛ البائعة تقبل → يظهر رقمها للمشترية → عند التسليم تؤكد البيع → المشترية تقيّم.
- الترويج المدفوع: البائعة تختار باقة وتدفع (زين كاش/آسيا حوالة...) وترسل رقم العملية أو الإيصال، والإدارة تؤكد الدفع من **لوحة التحكم ← سوق المستعمل ← الإعلانات المدفوعة** فيظهر الإعلان أولاً مع شارة "مميز".
- الباقات وأسعارها، طرق الدفع، ونسبة العمولة من **الإعدادات**.
