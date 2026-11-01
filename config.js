// إعدادات مشروع Firebase الجديد لنسخة SaaS (قيم عامة وليست أسراراً، تُنسخ من Firebase Console ← Project settings ← Your apps)
// ⚠️ لا تضع هنا إعدادات مشروع منهل الحالي (manhal-49df0)
export const FIREBASE_CONFIG = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.firebasestorage.app",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME"
};

// مالك المنصة (Super Admin): يرى لوحة الشركات والاشتراكات. يجب أن يطابق superEmail() في firestore.rules
export const SUPER_ADMIN_EMAIL = "salmandh02@gmail.com";

// اسم المنصة كما يظهر في شاشة الدخول والتسجيل
export const APP_NAME = "نظام أسطول الشركات";

// مدة التجربة المجانية للشركات الجديدة (بالأيام)
export const TRIAL_DAYS = 14;

// وسيلة التواصل التي تظهر للشركة عند إيقاف اشتراكها
export const SUPPORT_CONTACT = "salmandh02@gmail.com";
