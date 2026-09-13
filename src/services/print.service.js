const escpos = require('escpos');
escpos.Network = require('escpos-network');
try {
  escpos.USB = require('escpos-usb');
} catch (e) {
  // USB adapter not available
}
try {
  escpos.Bluetooth = require('escpos-bluetooth');
} catch (e) {
  // Bluetooth adapter not available
}
const net = require('net');
const { db } = require('../database/db');
const { createSystemDevice } = require('./system-print');

function getSetting(key, defaultValue = '') {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

// Subnet scanner for port 9100
async function scanNetworkPrinters() {
  return new Promise((resolve) => {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let localIp = null;
    
    // Find local IPv4 address
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          localIp = iface.address;
          break;
        }
      }
      if (localIp) break;
    }

    if (!localIp) return resolve([]);

    const baseIp = localIp.substring(0, localIp.lastIndexOf('.') + 1);
    const printers = [];
    let pending = 254;

    for (let i = 1; i <= 254; i++) {
      const targetIp = baseIp + i;
      const socket = new net.Socket();
      socket.setTimeout(300); // Fast timeout for LAN scan
      
      socket.on('connect', () => {
        printers.push({
          type: 'network',
          name: `Network Printer (${targetIp})`,
          address: targetIp
        });
        socket.destroy();
      });

      socket.on('error', () => socket.destroy());
      socket.on('timeout', () => socket.destroy());
      socket.on('close', () => {
        pending--;
        if (pending === 0) resolve(printers);
      });

      socket.connect(9100, targetIp);
    }
  });
}

async function scanPrinters() {
  const printers = {
    usb: [],
    network: [],
    bluetooth: []
  };

  // 1. Scan USB
  try {
    const usbDevices = escpos.USB.findPrinter();
    const addDevice = (d) => {
        printers.usb.push({
            type: 'usb',
            name: `USB Printer (VID:${d.deviceDescriptor?.idVendor} PID:${d.deviceDescriptor?.idProduct})`,
            vendorId: d.deviceDescriptor?.idVendor,
            productId: d.deviceDescriptor?.idProduct
        });
    };
    
    if (usbDevices && Array.isArray(usbDevices)) {
      usbDevices.forEach(addDevice);
    } else if (usbDevices) {
      addDevice(usbDevices);
    }
  } catch (e) {
    console.error('Error scanning USB:', e.message);
  }

  // 2. Scan Network (Port 9100)
  try {
    printers.network = await scanNetworkPrinters();
  } catch (e) {
    console.error('Error scanning Network:', e.message);
  }

  // 3. Scan Bluetooth (Depends on OS paired devices)
  try {
    if (escpos.Bluetooth) {
       printers.bluetooth.push({
           type: 'bluetooth_hint',
           name: 'لمعرفة طابعات البلوتوث، يرجى إقرانها من إعدادات الويندوز/الأندرويد أولاً، ثم إدخال عنوان الـ MAC الخاص بها.'
       });
    }
  } catch (e) {
    console.error('Error scanning BT:', e.message);
  }

  return printers;
}

// Function to get a configured printer instance based on settings
async function getPrinter(printerConfigStr) {
  if (!printerConfigStr) return null;
  let config;
  try {
    // Expected format: {"type":"network","address":"192.168.1.100"}
    // Or {"type":"usb","vendorId":1234,"productId":5678}
    config = JSON.parse(printerConfigStr);
  } catch (e) {
    // Fallback if it's just an IP string
    config = { type: 'network', address: printerConfigStr };
  }

  return new Promise((resolve, reject) => {
    try {
      let device;
      if (config.type === 'network') {
        device = new escpos.Network(config.address, 9100);
      } else if (config.type === 'usb') {
        device = new escpos.USB(config.vendorId, config.productId);
      } else if (config.type === 'bluetooth' && escpos.Bluetooth) {
        device = new escpos.Bluetooth(config.address);
      } else if (config.type === 'system') {
        device = createSystemDevice(config.name);
      } else if (config.device) {
        let inner;
        try { inner = JSON.parse(config.device); } catch (e) { inner = { type: 'network', address: config.device }; }
        if (inner.type === 'network') {
          device = new escpos.Network(inner.address, 9100);
        } else if (inner.type === 'usb') {
          device = new escpos.USB(inner.vendorId, inner.productId);
        } else if (inner.type === 'bluetooth' && escpos.Bluetooth) {
          device = new escpos.Bluetooth(inner.address);
        } else if (inner.type === 'system') {
          device = createSystemDevice(inner.name);
        } else {
          return reject(new Error('Unknown printer type'));
        }
      } else {
        return reject(new Error('Unknown printer type'));
      }

      const printer = new escpos.Printer(device);
      device.open((err) => {
        if (err) return reject(new Error(`Cannot connect to printer: ${err.message}`));
        resolve({ device, printer });
      });
    } catch (err) {
      reject(err);
    }
  });
}

async function printInvoice(orderId) {
  let printerConfig = getSetting('printer_cashier');

  if (!printerConfig) {
    const printersConfigStr = getSetting('printers_config');
    if (printersConfigStr) {
      try {
        const printersConfig = JSON.parse(printersConfigStr);
        const cashierPrinter = printersConfig.find(p => !p.category_ids || p.category_ids.length === 0);
        if (cashierPrinter && cashierPrinter.device) {
          printerConfig = cashierPrinter.device;
        }
      } catch (e) {}
    }
  }

  if (!printerConfig) throw new Error('لم يتم إعداد طابعة الكاشير');

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) throw new Error('الطلب غير موجود');

  const items = db.prepare(`
    SELECT oi.*, i.name, i.name_en
    FROM order_items oi
    LEFT JOIN items i ON oi.item_id = i.id
    WHERE oi.order_id = ?
  `).all(orderId);

  const restaurantName = getSetting('restaurant_name', 'NOKTA POS');
  const currency = getSetting('currency', '');
  const footer = getSetting('receipt_footer', '');

  const { device, printer } = await getPrinter(printerConfig);

  try {
    printer
      .align('ct')
      .size(1, 1)
      .text(restaurantName)
      .text('')
      .text(`Invoice #${order.invoice_number || order.id}`)
      .text(`Date: ${new Date(order.created_at).toLocaleString('en-US')}`)
      .text(`Cashier: ${order.employee_name || 'Admin'}`)
      .text('--------------------------------')
      .align('lt');

    for (const item of items) {
      const lineItemName = item.name || item.name_en || 'Item';
      printer.text(`${item.quantity}x ${lineItemName}`);
      
      let mods = [];
      try { mods = JSON.parse(item.selected_modifiers || '[]'); } catch (e) {}
      
      for (const mod of mods) {
          printer.text(`   + ${mod.name}`);
      }
      
      const lineTotal = item.price * item.quantity;
      printer.align('rt').text(`${lineTotal.toFixed(2)} ${currency}`).align('lt');
    }

    printer
      .text('--------------------------------')
      .align('rt')
      .text(`Subtotal: ${order.subtotal.toFixed(2)} ${currency}`);
      
    if (order.discount_amount > 0) printer.text(`Discount: -${order.discount_amount.toFixed(2)} ${currency}`);
    if (order.tax_amount > 0) printer.text(`Tax: ${order.tax_amount.toFixed(2)} ${currency}`);

    printer
      .size(1, 1)
      .text(`Total: ${order.total.toFixed(2)} ${currency}`)
      .size(0, 0)
      .align('ct')
      .text('')
      .text(footer);
      
    printer.cashdraw(2);

    await printer.cut().close();
    return true;
  } catch (err) {
    try { device.close(); } catch (e) {}
    throw err;
  }
}

async function printKitchen(orderId) {
  const printersConfigStr = getSetting('printers_config');
  if (!printersConfigStr) throw new Error('لم يتم إعداد طابعات المطبخ');
  
  let printersConfig = [];
  try {
    printersConfig = JSON.parse(printersConfigStr);
  } catch (e) {
    throw new Error('إعدادات طابعات المطبخ غير صالحة');
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) throw new Error('الطلب غير موجود');

  const items = db.prepare(`
    SELECT oi.*, i.name, i.name_en, i.category_id
    FROM order_items oi
    LEFT JOIN items i ON oi.item_id = i.id
    WHERE oi.order_id = ?
  `).all(orderId);

  let printedCount = 0;

  for (const pConfig of printersConfig) {
    if (!pConfig.auto_print || !Array.isArray(pConfig.category_ids) || !pConfig.category_ids.length) continue;
    
    const categoryIds = new Set(pConfig.category_ids.map(Number));
    const printerItems = items.filter(item => categoryIds.has(Number(item.category_id)));
    
    if (printerItems.length === 0) continue;

    try {
      const { device, printer } = await getPrinter(JSON.stringify(pConfig));
      
      try {
        printer
          .align('ct')
          .size(2, 2)
          .text(`Order #${order.invoice_number || order.id}`)
          .size(1, 1)
          .text(`Station: ${pConfig.name}`)
          .text(`Table: ${order.table_id ? order.table_id : 'Takeaway'}`)
          .text(`Time: ${new Date(order.created_at).toLocaleTimeString('en-US')}`)
          .text('--------------------------------')
          .align('lt');

        for (const item of printerItems) {
          printer.size(1, 1).text(`[ ] ${item.quantity}x ${item.name || 'Item'}`);
          
          let mods = [];
          try { mods = JSON.parse(item.selected_modifiers || '[]'); } catch (e) {}
          
          printer.size(0, 0);
          for (const mod of mods) {
              printer.text(`   + ${mod.name}`);
          }
          
          if (item.note) printer.text(`   * Note: ${item.note}`);
          printer.text(''); 
        }

        await printer.cut().close();
        printedCount++;
      } catch (err) {
        try { device.close(); } catch (e) {}
        throw err;
      }
    } catch (e) {
      console.error(`Failed to print to kitchen printer ${pConfig.name}:`, e);
      // Continue to next printer even if one fails
    }
  }
  
  if (printedCount === 0) {
    console.log('No kitchen tickets needed (categories did not match any printer).');
  }
  return true;
}

async function testPrinter(printerConfigStr) {
  const { device, printer } = await getPrinter(printerConfigStr);
  return new Promise((resolve, reject) => {
    try {
      printer
        .align('ct')
        .size(1, 1)
        .text('NOKTA POS')
        .size(0, 0)
        .text('Printer Test Successful')
        .text('اختبار الطابعة ناجح')
        .text('--------------------------------')
        .cut()
        .close();
      resolve(true);
    } catch (err) {
      if (device) device.close();
      reject(err);
    }
  });
}

module.exports = {
  scanPrinters,
  printInvoice,
  printKitchen,
  testPrinter
};
