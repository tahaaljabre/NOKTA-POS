const Database = require('better-sqlite3');
const config = require('./src/config/app.config');
const db = new Database(config.dbPath);

console.log('Seeding menu...');

const menu = [
  {
    name: 'المرطبات', name_en: 'Soft Drinks', icon: '🥤',
    items: [
      { name: 'ميرندا', name_en: 'Mirinda Cream Soda', price: 30 },
      { name: 'ببسي زيرو', name_en: 'Pepsi zero', price: 30 },
      { name: 'شاني', name_en: 'Shani', price: 80 },
      { name: 'مياه غازيه', name_en: 'Soda Water', price: 50 },
      { name: 'باربيكان', name_en: 'Barbican', price: 100 },
      { name: 'ماء صغير', name_en: 'Small Water', price: 10 }
    ]
  },
  {
    name: 'العصائر', name_en: 'Juice', icon: '🍹',
    items: [
      { name: 'عصير برتقال', name_en: 'Orange Juice', price: 150 },
      { name: 'عصير مانجو', name_en: 'Mango Juice', price: 150 },
      { name: 'عصير بطيخ', name_en: 'Watermelon Juice', price: 150 },
      { name: 'قهوة بارد', name_en: 'Ice Coffee', price: 150 },
      { name: 'لبن عيران', name_en: 'Yogurt Juice', price: 150 }
    ]
  },
  {
    name: 'المشروبات الساخنة', name_en: 'Hot Drinks', icon: '☕',
    items: [
      { name: 'شاي حليب كرك كاسة', name_en: 'Tea with Milk', price: 60 },
      { name: 'قهوة تركية', name_en: 'Turkish Coffee', price: 80 },
      { name: 'نسكافية', name_en: 'Nescafe', price: 80 },
      { name: 'قهوة عربية كاسة', name_en: 'Arabic Coffee', price: 60 },
      { name: 'شاي احمر براد', name_en: 'Arabic Tea (Big)', price: 150 }
    ]
  },
  {
    name: 'الحلويات', name_en: 'Dessert', icon: '🍰',
    items: [
      { name: 'صحن فواكة مشكل', name_en: 'Mix Fruits', price: 250 },
      { name: 'مهلبية', name_en: 'Mahalabia', price: 150 },
      { name: 'أم على', name_en: 'Om Ali', price: 320 },
      { name: 'كنافة', name_en: 'Kunafa', price: 250 }
    ]
  },
  {
    name: 'الخبز', name_en: 'Bread', icon: '🥖',
    items: [
      { name: 'خبز تنور زبدة', name_en: 'Butter Nann', price: 100 },
      { name: 'خبز تنور بالثوم', name_en: 'Garlic Nann', price: 100 },
      { name: 'خبز يمني مع العسل', name_en: 'Yemeni Bread With Honey', price: 120 },
      { name: 'خبز طاوه يمني', name_en: 'pan bread Yemeni', price: 80 }
    ]
  },
  {
    name: 'السلطات', name_en: 'Salads', icon: '🥗',
    items: [
      { name: 'بابا غنوج', name_en: 'Baba Ghanouj', price: 150 },
      { name: 'متبل', name_en: 'Mutabble', price: 150 },
      { name: 'حمص', name_en: 'Hummus', price: 150 },
      { name: 'تبولة', name_en: 'Tabbouleh', price: 150 },
      { name: 'سلطة جرجير', name_en: 'Rocket Salad', price: 200 }
    ]
  },
  {
    name: 'المشويات', name_en: 'Barbeque', icon: '🍢',
    items: [
      { name: 'كباب لحم', name_en: 'Shish Kebab', price: 250 },
      { name: 'كباب دجاج', name_en: 'Chicken kebab', price: 220 },
      { name: 'ريش مشوي', name_en: 'Lamb Chops BBQ', price: 600 },
      { name: 'مشكل مشوي', name_en: 'Mix BBQ', price: 400 },
      { name: 'دجاج مشوي نصف', name_en: 'Chicken BBQ Half', price: 300 }
    ]
  },
  {
    name: 'أكلات يمنية لحم', name_en: 'Lamb dishes', icon: '🥩',
    items: [
      { name: 'مندي لحم', name_en: 'Mandi Lamb', price: 700 },
      { name: 'مدفون لحم', name_en: 'Madfoon Lamb', price: 700 },
      { name: 'مظبي لحم', name_en: 'Madghout Lamb', price: 700 },
      { name: 'بريانى لحم', name_en: 'Biryani Lamb', price: 700 },
      { name: 'عقدة لحم', name_en: 'Akdah Fried Lamb', price: 300 },
      { name: 'فحسة لحم', name_en: 'Fahsah (Lamb Red Sauce)', price: 400 }
    ]
  },
  {
    name: 'أكلات يمنية دجاج', name_en: 'Chicken dishes', icon: '🍗',
    items: [
      { name: 'مندي دجاج', name_en: 'Mandi Chicken', price: 350 },
      { name: 'مظبي دجاج', name_en: 'Madghout Chicken', price: 350 },
      { name: 'بريانى دجاج', name_en: 'Biryani Chicken', price: 350 },
      { name: 'عقدة دجاج', name_en: 'Akdah Chicken', price: 250 },
      { name: 'فحسة دجاج', name_en: 'Fahsah Chicken', price: 300 }
    ]
  },
  {
    name: 'أكلات بحرية', name_en: 'Seafood', icon: '🐟',
    items: [
      { name: 'سمك مقلي', name_en: 'Fried Fish', price: 400 },
      { name: 'مندي سمك كنعد', name_en: 'Mandi Fish', price: 500 },
      { name: 'مندي روبيان', name_en: 'Mandi Shrimp', price: 450 },
      { name: 'عقدة سمك', name_en: 'Fish Salona', price: 300 },
      { name: 'روبيان مشوي', name_en: 'Shrimp BBQ', price: 700 }
    ]
  }
];

db.transaction(() => {
  let catSort = 1;
  for (const cat of menu) {
    const info = db.prepare('INSERT INTO categories (name, name_en, icon, sort_order) VALUES (?, ?, ?, ?)').run(cat.name, cat.name_en, cat.icon, catSort++);
    const catId = info.lastInsertRowid;
    let itemSort = 1;
    for (const item of cat.items) {
      db.prepare('INSERT INTO items (name, name_en, category_id, price, sort_order, active) VALUES (?, ?, ?, ?, ?, 1)').run(item.name, item.name_en, catId, item.price, itemSort++);
    }
  }
})();

console.log('Menu seeded successfully.');
