import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type AdminLocale = 'th' | 'en';

export interface AdminTranslations {
  login: {
    subtitle: string;
    usernameLabel: string;
    passwordLabel: string;
    signingIn: string;
    signInBtn: string;
    demoSignInBtn: string;
    onlyPlatformAdmin: string;
    invalidResponse: string;
    loginFailed: string;
    demoFailed: string;
  };
  nav: {
    dashboard: string;
    tenants: string;
    packages: string;
    invoices: string;
    announcements: string;
    logout: string;
    switchLocaleLabel: string;
  };
  dashboard: {
    loading: string;
    title: string;
    totalTenantsLabel: string;
    activeTenantsChange: (count: number) => string;
    totalUsersLabel: string;
    totalUsersChange: string;
    mrrLabel: string;
    mrrChange: string;
    systemStatusLabel: string;
    recentTxTitle: string;
    colTenant: string;
    colPlan: string;
    colPeriod: string;
    colAmount: string;
    colStatus: string;
    noRecentTx: string;
  };
  tenants: {
    title: string;
    searchPlaceholder: string;
    colOrg: string;
    colPlan: string;
    colUsage: string;
    colStatus: string;
    colManage: string;
    selectPlanLabel: string;
    usersShort: string;
    docsShort: string;
    unlimited: string;
    impersonateBtn: string;
    impersonatingBtn: string;
    impersonateMissingToken: string;
    impersonateCopiedNotice: (name: string) => string;
    impersonateOpenedNotice: (name: string) => string;
    impersonateFailedNotice: (name: string) => string;
    suspendBtn: string;
    activateBtn: string;
    loading: string;
    empty: string;
  };
  packages: {
    title: string;
    subtitle: string;
    createBtn: string;
    perMonth: string;
    yearlyLine: (price: string) => string;
    maxUsersLabel: string;
    maxDocsLabel: string;
    unlimited: string;
    usersSuffix: string;
    docsSuffix: string;
    editBtn: string;
    empty: string;
    modalEditTitle: string;
    modalCreateTitle: string;
    planNameLabel: string;
    monthlyPriceLabel: string;
    yearlyPriceLabel: string;
    maxUsersInputLabel: string;
    maxDocsInputLabel: string;
    featuresInputLabel: string;
    activeCheckboxLabel: string;
    cancelBtn: string;
    savingBtn: string;
    saveBtn: string;
    saveFailed: string;
  };
  invoices: {
    title: string;
    subtitle: string;
    filteredTotalLabel: string;
    searchPlaceholder: string;
    filterAria: string;
    filterAll: string;
    colTenant: string;
    colPlan: string;
    colAmount: string;
    colPeriod: string;
    colStatus: string;
    colManage: string;
    confirmPaidBtn: string;
    updatingBtn: string;
    paidDone: string;
    markPaidFailed: string;
    loading: string;
    empty: string;
  };
  announcements: {
    title: string;
    subtitle: string;
    createBtn: string;
    loading: string;
    empty: string;
    statusActive: string;
    statusClosed: string;
    createdAtPrefix: string;
    startsAtPrefix: string;
    endsAtPrefix: string;
    editTitle: string;
    deleteTitle: string;
    modalEditTitle: string;
    modalCreateTitle: string;
    titleLabel: string;
    messageLabel: string;
    severityLabel: string;
    severityInfo: string;
    severityWarning: string;
    severityCritical: string;
    activeCheckboxLabel: string;
    startsAtLabel: string;
    endsAtLabel: string;
    cancelBtn: string;
    savingBtn: string;
    saveBtn: string;
  };
}

// eslint-disable-next-line react-refresh/only-export-components
export const ADMIN_RESOURCES: Record<AdminLocale, AdminTranslations> = {
  th: {
    login: {
      subtitle: 'เข้าสู่ระบบจัดการแพลตฟอร์ม SaaS Multi-Tenant',
      usernameLabel: 'ชื่อผู้ใช้ (Admin)',
      passwordLabel: 'รหัสผ่าน',
      signingIn: 'กำลังเข้าสู่ระบบ...',
      signInBtn: 'เข้าสู่ระบบ',
      demoSignInBtn: 'เข้าสู่ระบบด่วน (Demo Super Admin)',
      onlyPlatformAdmin: 'บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลแพลตฟอร์ม (Super Admin)',
      invalidResponse: 'ข้อมูลเข้าสู่ระบบไม่ถูกต้อง',
      loginFailed: 'ไม่สามารถเข้าสู่ระบบได้ กรุณาตรวจสอบชื่อผู้ใช้และรหัสผ่าน',
      demoFailed: 'ไม่สามารถเข้าสู่ระบบ Demo ได้',
    },
    nav: {
      dashboard: 'ภาพรวม (Dashboard)',
      tenants: 'ผู้ใช้บริการ (Tenants)',
      packages: 'แพ็กเกจราคา (Packages)',
      invoices: 'บิลค่าบริการ SaaS',
      announcements: 'ประกาศส่วนกลาง',
      logout: 'ออกจากระบบ',
      switchLocaleLabel: 'เปลี่ยนภาษา / Switch Language',
    },
    dashboard: {
      loading: 'กำลังโหลดข้อมูล...',
      title: 'ภาพรวมระบบ (Platform Dashboard)',
      totalTenantsLabel: 'ผู้ใช้บริการทั้งหมด (Tenants)',
      activeTenantsChange: (count) => `เปิดใช้งาน ${count} องค์กร`,
      totalUsersLabel: 'ผู้ใช้งานระบบ (Total Users)',
      totalUsersChange: 'ทุกองค์กรรวมกัน',
      mrrLabel: 'รายได้รายเดือน (MRR)',
      mrrChange: 'จากแพ็กเกจที่เปิดใช้งาน',
      systemStatusLabel: 'สถานะระบบ (System Status)',
      recentTxTitle: 'ประวัติการสมัครและต่ออายุแพ็กเกจล่าสุด (Recent SaaS Subscriptions)',
      colTenant: 'องค์กร (Tenant)',
      colPlan: 'แพ็กเกจ',
      colPeriod: 'วันที่เริ่ม - สิ้นสุด',
      colAmount: 'ค่าบริการ (บาท)',
      colStatus: 'สถานะ',
      noRecentTx: 'ยังไม่มีรายการสมัครแพ็กเกจ',
    },
    tenants: {
      title: 'ผู้ใช้บริการ (Tenants)',
      searchPlaceholder: 'ค้นหาชื่อบริษัท หรืออีเมล...',
      colOrg: 'ชื่อบริษัท',
      colPlan: 'แพ็กเกจปัจจุบัน',
      colUsage: 'การใช้งานโควต้า (เดือนนี้)',
      colStatus: 'สถานะ',
      colManage: 'จัดการ',
      selectPlanLabel: 'เลือกแพ็กเกจ',
      usersShort: 'ผู้ใช้',
      docsShort: 'บิลเดือนนี้',
      unlimited: 'ไม่จำกัด',
      impersonateBtn: 'เข้าดูในฐานะองค์กร',
      impersonatingBtn: 'กำลังสร้าง...',
      impersonateMissingToken: 'ไม่สามารถออกโทเค็นเข้าดูองค์กรได้',
      impersonateCopiedNotice: (name) => `สร้างลิงก์เข้าดู ${name} สำเร็จและคัดลอกไว้แล้ว (เบราว์เซอร์บล็อกหน้าต่างใหม่)`,
      impersonateOpenedNotice: (name) => `เปิดหน้าต่างเข้าดูองค์กร ${name} แล้ว (บันทึก Audit Log เรียบร้อย)`,
      impersonateFailedNotice: (name) => `ไม่สามารถเข้าดูองค์กร ${name} ได้`,
      suspendBtn: 'ระงับการใช้งาน',
      activateBtn: 'เปิดใช้งาน',
      loading: 'กำลังโหลดข้อมูล...',
      empty: 'ไม่พบข้อมูลองค์กร',
    },
    packages: {
      title: 'แพ็กเกจราคา (Subscription Plans)',
      subtitle: 'จัดการแพ็กเกจและข้อจำกัด Quota ของแต่ละระดับ',
      createBtn: 'เพิ่มแพ็กเกจใหม่',
      perMonth: '/เดือน',
      yearlyLine: (price) => `หรือ ฿${price}/ปี`,
      maxUsersLabel: 'ผู้ใช้งานสูงสุด',
      maxDocsLabel: 'โควต้าเอกสารรายเดือน',
      unlimited: 'ไม่จำกัด',
      usersSuffix: 'บัญชี',
      docsSuffix: 'ใบ',
      editBtn: 'แก้ไขแพ็กเกจ',
      empty: 'ยังไม่มีข้อมูลแพ็กเกจ',
      modalEditTitle: 'แก้ไขแพ็กเกจ',
      modalCreateTitle: 'เพิ่มแพ็กเกจใหม่',
      planNameLabel: 'ชื่อแพ็กเกจ *',
      monthlyPriceLabel: 'ราคารายเดือน (บาท)',
      yearlyPriceLabel: 'ราคารายปี (บาท)',
      maxUsersInputLabel: 'ผู้ใช้งานสูงสุด (-1 = ไม่จำกัด)',
      maxDocsInputLabel: 'โควต้าเอกสาร/เดือน (-1 = ไม่จำกัด)',
      featuresInputLabel: 'ฟีเจอร์ (JSON Array)',
      activeCheckboxLabel: 'เปิดใช้งานแพ็กเกจนี้ (Active)',
      cancelBtn: 'ยกเลิก',
      savingBtn: 'กำลังบันทึก...',
      saveBtn: 'บันทึกแพ็กเกจ',
      saveFailed: 'ไม่สามารถบันทึกแพ็กเกจได้',
    },
    invoices: {
      title: 'บิลค่าบริการแพ็กเกจ (SaaS Billing Invoices)',
      subtitle: 'ตรวจสอบประวัติการสมัครและต่ออายุแพ็กเกจขององค์กรลูกค้าทั้งหมด',
      filteredTotalLabel: 'ยอดรวมตามตัวกรอง',
      searchPlaceholder: 'ค้นหาชื่อบริษัท หรือแพ็กเกจ...',
      filterAria: 'กรองสถานะบิล',
      filterAll: 'ทุกสถานะ',
      colTenant: 'องค์กร (Tenant)',
      colPlan: 'แพ็กเกจ',
      colAmount: 'ยอดค่าบริการ',
      colPeriod: 'รอบอายุการใช้งาน',
      colStatus: 'สถานะ',
      colManage: 'การจัดการ',
      confirmPaidBtn: 'ยืนยันชำระเงิน',
      updatingBtn: 'กำลังบันทึก...',
      paidDone: 'ชำระแล้ว',
      markPaidFailed: 'ไม่สามารถอัปเดตสถานะการชำระเงินได้',
      loading: 'กำลังโหลดข้อมูลบิล...',
      empty: 'ไม่พบรายการบิลค่าบริการ',
    },
    announcements: {
      title: 'ประกาศส่วนกลาง (Platform Announcements)',
      subtitle: 'ส่งแถบแจ้งเตือนถึงผู้ใช้งาน SME ทุกองค์กร เช่น กำหนดการปิดปรับปรุงระบบ หรืออัปเดตฟีเจอร์ใหม่',
      createBtn: 'สร้างประกาศใหม่',
      loading: 'กำลังโหลดประกาศ...',
      empty: 'ยังไม่มีประกาศในระบบ',
      statusActive: 'กำลังแสดงผล',
      statusClosed: 'ปิดการแสดงผล',
      createdAtPrefix: 'สร้างเมื่อ',
      startsAtPrefix: 'เริ่ม',
      endsAtPrefix: 'สิ้นสุด',
      editTitle: 'แก้ไข',
      deleteTitle: 'ลบ',
      modalEditTitle: 'แก้ไขประกาศส่วนกลาง',
      modalCreateTitle: 'สร้างประกาศส่วนกลาง',
      titleLabel: 'หัวข้อประกาศ *',
      messageLabel: 'รายละเอียดข้อความ *',
      severityLabel: 'ระดับความสำคัญ',
      severityInfo: 'Info (ข้อมูลทั่วไป)',
      severityWarning: 'Warning (แจ้งเตือนสำคัญ)',
      severityCritical: 'Critical (เร่งด่วน/ปิดปรับปรุง)',
      activeCheckboxLabel: 'เปิดแสดงผลประกาศนี้ทันที',
      startsAtLabel: 'วันที่เริ่มแสดง (ถ้ามี)',
      endsAtLabel: 'วันที่สิ้นสุด (ถ้ามี)',
      cancelBtn: 'ยกเลิก',
      savingBtn: 'กำลังบันทึก...',
      saveBtn: 'บันทึกประกาศ',
    },
  },
  en: {
    login: {
      subtitle: 'Sign in to the Multi-Tenant SaaS Platform Portal',
      usernameLabel: 'Username (Admin)',
      passwordLabel: 'Password',
      signingIn: 'Signing in...',
      signInBtn: 'Sign In',
      demoSignInBtn: 'Quick Sign In (Demo Super Admin)',
      onlyPlatformAdmin: 'This account does not have Platform Super Admin privileges',
      invalidResponse: 'Invalid login response',
      loginFailed: 'Unable to sign in. Please verify your username and password',
      demoFailed: 'Unable to sign in to Demo account',
    },
    nav: {
      dashboard: 'Overview (Dashboard)',
      tenants: 'Organizations (Tenants)',
      packages: 'Pricing Plans (Packages)',
      invoices: 'SaaS Billing Invoices',
      announcements: 'Platform Announcements',
      logout: 'Sign Out',
      switchLocaleLabel: 'Switch Language / เปลี่ยนภาษา',
    },
    dashboard: {
      loading: 'Loading data...',
      title: 'Platform Dashboard',
      totalTenantsLabel: 'Total Organizations (Tenants)',
      activeTenantsChange: (count) => `${count} active tenants`,
      totalUsersLabel: 'Total Platform Users',
      totalUsersChange: 'Across all tenants',
      mrrLabel: 'Monthly Recurring Revenue (MRR)',
      mrrChange: 'From active subscriptions',
      systemStatusLabel: 'System Status',
      recentTxTitle: 'Recent SaaS Subscriptions',
      colTenant: 'Organization (Tenant)',
      colPlan: 'Plan',
      colPeriod: 'Start - End Date',
      colAmount: 'Amount (THB)',
      colStatus: 'Status',
      noRecentTx: 'No recent subscription records',
    },
    tenants: {
      title: 'Organizations (Tenants)',
      searchPlaceholder: 'Search company name or email...',
      colOrg: 'Company Name',
      colPlan: 'Current Plan',
      colUsage: 'Quota Usage (This Month)',
      colStatus: 'Status',
      colManage: 'Actions',
      selectPlanLabel: 'Select Plan',
      usersShort: 'Users',
      docsShort: 'Docs this month',
      unlimited: 'Unlimited',
      impersonateBtn: 'View as Tenant',
      impersonatingBtn: 'Generating...',
      impersonateMissingToken: 'Unable to issue tenant impersonation token',
      impersonateCopiedNotice: (name) => `Generated and copied impersonation link for ${name} (popup blocked)`,
      impersonateOpenedNotice: (name) => `Opened impersonation window for ${name} (Audit Log recorded)`,
      impersonateFailedNotice: (name) => `Failed to impersonate ${name}`,
      suspendBtn: 'Suspend Tenant',
      activateBtn: 'Activate Tenant',
      loading: 'Loading tenants...',
      empty: 'No tenants found',
    },
    packages: {
      title: 'Subscription Plans',
      subtitle: 'Manage subscription pricing tiers and monthly quota limits',
      createBtn: 'Add New Plan',
      perMonth: '/month',
      yearlyLine: (price) => `or ฿${price}/year`,
      maxUsersLabel: 'Max Users',
      maxDocsLabel: 'Monthly Document Quota',
      unlimited: 'Unlimited',
      usersSuffix: 'seats',
      docsSuffix: 'docs',
      editBtn: 'Edit Plan',
      empty: 'No subscription plans found',
      modalEditTitle: 'Edit Plan',
      modalCreateTitle: 'Add New Plan',
      planNameLabel: 'Plan Name *',
      monthlyPriceLabel: 'Monthly Price (THB)',
      yearlyPriceLabel: 'Yearly Price (THB)',
      maxUsersInputLabel: 'Max Users (-1 = Unlimited)',
      maxDocsInputLabel: 'Monthly Document Quota (-1 = Unlimited)',
      featuresInputLabel: 'Features (JSON Array)',
      activeCheckboxLabel: 'Enable this plan (Active)',
      cancelBtn: 'Cancel',
      savingBtn: 'Saving...',
      saveBtn: 'Save Plan',
      saveFailed: 'Failed to save subscription plan',
    },
    invoices: {
      title: 'SaaS Billing Invoices',
      subtitle: 'Review subscription billing history and confirm tenant payments',
      filteredTotalLabel: 'Filtered Total',
      searchPlaceholder: 'Search company or plan...',
      filterAria: 'Filter invoice status',
      filterAll: 'All Statuses',
      colTenant: 'Organization (Tenant)',
      colPlan: 'Plan',
      colAmount: 'Amount',
      colPeriod: 'Billing Period',
      colStatus: 'Status',
      colManage: 'Actions',
      confirmPaidBtn: 'Confirm Payment',
      updatingBtn: 'Saving...',
      paidDone: 'Paid',
      markPaidFailed: 'Failed to update payment status',
      loading: 'Loading billing invoices...',
      empty: 'No billing invoices found',
    },
    announcements: {
      title: 'Platform Announcements',
      subtitle: 'Broadcast system-wide alert banners to all SME tenants',
      createBtn: 'New Announcement',
      loading: 'Loading announcements...',
      empty: 'No announcements found',
      statusActive: 'Active',
      statusClosed: 'Inactive',
      createdAtPrefix: 'Created',
      startsAtPrefix: 'Starts',
      endsAtPrefix: 'Ends',
      editTitle: 'Edit',
      deleteTitle: 'Delete',
      modalEditTitle: 'Edit Platform Announcement',
      modalCreateTitle: 'Create Platform Announcement',
      titleLabel: 'Announcement Title *',
      messageLabel: 'Announcement Message *',
      severityLabel: 'Severity Level',
      severityInfo: 'Info (General Information)',
      severityWarning: 'Warning (Important Notice)',
      severityCritical: 'Critical (Urgent / Maintenance)',
      activeCheckboxLabel: 'Publish this announcement immediately',
      startsAtLabel: 'Start Date (Optional)',
      endsAtLabel: 'End Date (Optional)',
      cancelBtn: 'Cancel',
      savingBtn: 'Saving...',
      saveBtn: 'Save Announcement',
    },
  },
};

interface AdminLocaleContextValue {
  locale: AdminLocale;
  setLocale: (locale: AdminLocale) => void;
  toggleLocale: () => void;
  t: AdminTranslations;
}

const STORAGE_KEY = 'sa_locale';

const AdminLocaleContext = createContext<AdminLocaleContextValue | undefined>(undefined);

export function AdminLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AdminLocale>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'en' || saved === 'th' ? saved : 'th';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (next: AdminLocale) => setLocaleState(next);
  const toggleLocale = () => setLocaleState((prev) => (prev === 'th' ? 'en' : 'th'));

  return (
    <AdminLocaleContext.Provider
      value={{
        locale,
        setLocale,
        toggleLocale,
        t: ADMIN_RESOURCES[locale],
      }}
    >
      {children}
    </AdminLocaleContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdminLocale() {
  const ctx = useContext(AdminLocaleContext);
  if (!ctx) {
    return {
      locale: 'th' as AdminLocale,
      setLocale: () => {},
      toggleLocale: () => {},
      t: ADMIN_RESOURCES.th,
    };
  }
  return ctx;
}
