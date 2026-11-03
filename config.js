// إعدادات مشروع Firebase الجديد لنسخة SaaS (قيم عامة وليست أسراراً، تُنسخ من Firebase Console ← Project settings ← Your apps)
// ⚠️ لا تضع هنا إعدادات مشروع منهل الحالي (manhal-49df0)
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBYB2p-84Xcz1X-e6iZnExl9wR4QMXNlpE",
  authDomain: "fleet-sa-f0678.firebaseapp.com",
  projectId: "fleet-sa-f0678",
  storageBucket: "fleet-sa-f0678.firebasestorage.app",
  messagingSenderId: "351010607604",
  appId: "1:351010607604:web:fde4d65c07f3c23e13a9a1"
};

// مالك المنصة (Super Admin): يرى لوحة الشركات والاشتراكات. يجب أن يطابق superEmail() في firestore.rules
export const SUPER_ADMIN_EMAIL = "salmandh02@gmail.com";

// اسم المنصة كما يظهر في شاشة الدخول والتسجيل
export const APP_NAME = "نظام أسطول الشركات";

// مدة التجربة المجانية للشركات الجديدة (بالأيام)
export const TRIAL_DAYS = 14;

// وسيلة التواصل التي تظهر للشركة عند إيقاف اشتراكها
export const SUPPORT_CONTACT = "salmandh02@gmail.com";

// مفتاح إشعارات الجوال العام (VAPID) – يطابق VAPID_PUBLIC في Netlify و PUSH_PUBLIC في index.html
export const PUSH_PUBLIC = "BOrIcCMkeIBxvAz1HnPQD6FFVpMyBH7EVi7frgi61TBDguAHLH3uKxn1cEfOSfC6FcpCh7yXIqh9Pj6qZNyHE1c";
