const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config/app.config');

// Import modular routes
const authRoutes = require('./routes/auth.routes');
const categoriesRoutes = require('./routes/categories.routes');
const itemsRoutes = require('./routes/items.routes');
const modifiersRoutes = require('./routes/modifiers.routes');
const tablesRoutes = require('./routes/tables.routes');
const ordersRoutes = require('./routes/orders.routes');
const invoicesRoutes = require('./routes/invoices.routes');
const customersRoutes = require('./routes/customers.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const shiftsRoutes = require('./routes/shifts.routes');
const dailyClosingRoutes = require('./routes/daily-closing.routes');
const reportsRoutes = require('./routes/reports.routes');
const employeesRoutes = require('./routes/employees.routes');
const settingsRoutes = require('./routes/settings.routes');
const syncRoutes = require('./routes/sync.routes');
const backupRoutes = require('./routes/backup.routes');
const { requirePermission } = require('./middleware/auth.middleware');

function createApp() {
  const app = express();

  // Basic Middlewares
  app.use(cors({ origin: false }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.disable('x-powered-by');
  app.use((req,res,next)=>{
    if(req.path.startsWith('/api/'))res.setHeader('Cache-Control','no-store');
    const json=res.json.bind(res);
    const language=String(req.headers['accept-language']||'ar').startsWith('en')?'en':'ar';
    const translate=message=>{
      if(typeof message!=='string')return message;
      if(message.includes(' / ')){const parts=message.split(' / ');return language==='ar'?parts[0]:parts.slice(1).join(' / ');}
      const ar={'Authentication required':'يلزم تسجيل الدخول','Admin access required':'للمدير فقط','PIN incorrect':'بيانات الدخول غير صحيحة','PIN must contain 4 to 6 digits':'الرمز من 4 إلى 6 أرقام','Username and password are required':'اسم المستخدم وكلمة المرور مطلوبان','Initial setup has already been completed':'تم الإعداد الأول مسبقًا','Current manager PIN is incorrect':'رمز المدير الحالي غير صحيح','Name and PIN required':'اسم الموظف ورمزه مطلوبان','Username is already in use':'اسم المستخدم مستخدم بالفعل','Invalid username':'اسم المستخدم غير صالح','Password must contain at least 6 characters':'كلمة المرور يجب أن تكون 6 أحرف على الأقل','Shift already open':'توجد وردية مفتوحة بالفعل','Already closed today':'أُغلق اليوم مسبقًا'};
      if(language==='ar' && message.startsWith('Missing permission'))return 'ليس لديك صلاحية لهذه العملية';
      return language==='ar'?(ar[message]||message):message;
    };
    res.json=value=>{if(value?.error)value={...value,error:translate(value.error)};if(value?.failedOrders)value={...value,failedOrders:value.failedOrders.map(o=>({...o,error:translate(o.error)}))};return json(value);};
    next();
  });

  // Security Headers against Clickjacking, MIME sniffing, and XSS
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Referrer-Policy', 'same-origin');
    if (req.path === '/' || req.path === '/sw.js' || req.url.match(/\.(html|js|css)$/)) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    if (req.headers['x-employee-name']) {
      try {
        req.headers['x-employee-name'] = decodeURIComponent(req.headers['x-employee-name']);
      } catch (e) {}
    }
    next();
  });

  // Login Brute-Force Rate Limiter (max five attempts per minute per IP)
  const loginAttempts = new Map();
  app.use(['/api/auth/login', '/api/auth/setup-admin'], (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    for(const [key,value] of loginAttempts) if(now-value.firstAttempt>60000) loginAttempts.delete(key);
    const record = loginAttempts.get(ip) || { count: 0, firstAttempt: now };

    if (now - record.firstAttempt > 60000) {
      record.count = 0;
      record.firstAttempt = now;
    }

    record.count++;
    loginAttempts.set(ip, record);

    if (record.count > 5) {
      return res.status(429).json({ error: 'Too many attempts. Please wait one minute. (محاولات كثيرة - يرجى الانتظار)' });
    }
    next();
  });

  // Serve static assets from public/
  app.use(express.static(config.publicDir));

  // Mount API Modules
  app.use('/api/auth', authRoutes);
  app.use('/api/categories', categoriesRoutes);
  app.use('/api/items', itemsRoutes);
  app.use('/api/modifiers', modifiersRoutes);
  app.use('/api/tables', tablesRoutes);
  app.use('/api/orders', ordersRoutes);
  app.use('/api/invoices', invoicesRoutes);
  app.use('/api/customers', customersRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/shifts', shiftsRoutes);
  app.use('/api/daily-closings', dailyClosingRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/employees', employeesRoutes);
  app.use('/api/settings', settingsRoutes);
  app.get('/api/audit', requirePermission('audit'), settingsRoutes.handleAuditGet);
  app.use('/api/sync', syncRoutes);
  app.use('/api/backup', backupRoutes);

  // Single Page App Fallback for GET requests
  app.use('/api',(req,res)=>res.status(404).json({error:'المسار غير موجود / API endpoint not found'}));
  app.get('*', (req, res) => {
    res.sendFile(path.join(config.publicDir, 'index.html'));
  });

  // Global Error Handler
  app.use((err, req, res, next) => {
    console.error('Unhandled API Error:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'تعذر إتمام العملية؛ راجع سجل الخادم / Operation failed; check the server log' });
  });

  return app;
}

module.exports = { createApp };
