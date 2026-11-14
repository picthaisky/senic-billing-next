export type HelpCategory =
  | 'all'
  | 'cycle'
  | 'sales'
  | 'purchasing'
  | 'accounting'
  | 'masters'
  | 'system';

export type HelpLang = 'th' | 'en';

export interface LocalizedText {
  th: string;
  en: string;
}

export interface JournalPostingLine {
  side: 'Dr' | 'Cr';
  accountCode: string;
  accountName: LocalizedText;
  amountRule: LocalizedText;
}

export interface JournalScenario {
  condition: LocalizedText;
  lines: JournalPostingLine[];
}

export interface HelpStep {
  title: LocalizedText;
  detail: LocalizedText;
}

export interface AccountingProTip {
  title: LocalizedText;
  detail: LocalizedText;
}

export interface MenuHelpGuide {
  id: string;
  category: Exclude<HelpCategory, 'all'>;
  route: string;
  iconName:
    | 'Compass'
    | 'LayoutDashboard'
    | 'Receipt'
    | 'Banknote'
    | 'Truck'
    | 'FileText'
    | 'FileCheck'
    | 'FileMinus2'
    | 'FilePlus2'
    | 'Wallet'
    | 'ShoppingBag'
    | 'BookOpen'
    | 'Landmark'
    | 'Users'
    | 'Package'
    | 'Warehouse'
    | 'Settings'
    | 'ShieldCheck'
    | 'History'
    | 'User';
  menuName: LocalizedText;
  shortDesc: LocalizedText;
  whoShouldUse: LocalizedText;
  prerequisites: LocalizedText[];
  steps: HelpStep[];
  journalScenarios: JournalScenario[];
  accountantTips: AccountingProTip[];
  commonPitfalls: LocalizedText[];
  relatedIds: string[];
  impactSummary: {
    stock: LocalizedText;
    vat: LocalizedText;
    wht: LocalizedText;
    journal: LocalizedText;
  };
}

export interface ChartOfAccountRef {
  code: string;
  type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  name: LocalizedText;
  usage: LocalizedText;
}

export interface TaxCalendarEvent {
  formCode: string;
  title: LocalizedText;
  paperDeadline: LocalizedText;
  onlineDeadline: LocalizedText;
  sourceMenuId: string;
  notes: LocalizedText;
}

export interface MonthlyClosingTask {
  order: number;
  title: LocalizedText;
  detail: LocalizedText;
  menuId: string;
}

export interface DocumentMatrixRow {
  guideId: string;
  docType: LocalizedText;
  etaxCode: string;
  affectsStock: LocalizedText;
  affectsOutputVat: LocalizedText;
  postsJournal: LocalizedText;
}

export const SYSTEM_CHART_OF_ACCOUNTS: ChartOfAccountRef[] = [
  {
    code: '1110',
    type: 'Asset',
    name: {
      th: 'เงินสดและเงินฝากธนาคาร',
      en: 'Cash and Bank Deposits',
    },
    usage: {
      th: 'บันทึกการรับเงินสด/โอน/PromptPay จากบิลเงินสด ใบเสร็จ และเมื่อกระทบยอดธนาคาร รวมถึงตัดจ่ายค่าใช้จ่ายที่ชำระแล้ว',
      en: 'Records cash, bank transfer, and PromptPay inflows from cash bills, receipts, and bank reconciliation, plus paid expense outflows.',
    },
  },
  {
    code: '1130',
    type: 'Asset',
    name: {
      th: 'ลูกหนี้การค้า',
      en: 'Accounts Receivable (A/R)',
    },
    usage: {
      th: 'ตั้งลูกหนี้เมื่อออกใบกำกับภาษี/ใบเพิ่มหนี้แบบขายเชื่อ และล้างลูกหนี้เมื่อรับชำระเงินหรือออกใบลดหนี้',
      en: 'Debited on credit Tax Invoices / Debit Notes and credited when payment is collected or a Credit Note is issued.',
    },
  },
  {
    code: '1140',
    type: 'Asset',
    name: {
      th: 'ภาษีเงินได้ถูกหัก ณ ที่จ่าย',
      en: 'Withholding Tax Deducted (Asset)',
    },
    usage: {
      th: 'บันทึกยอดภาษีที่ลูกค้าหักไว้เมื่อจ่ายชำระ (ถือเป็นเครดิตภาษีของกิจการเพื่อนำไปหักตอนยื่น ภ.ง.ด.50)',
      en: 'Tracks WHT deducted by customers on receipt; used as a corporate tax credit when filing annual P.N.D.50.',
    },
  },
  {
    code: '1150',
    type: 'Asset',
    name: {
      th: 'สินค้าคงเหลือ',
      en: 'Inventory',
    },
    usage: {
      th: 'บัญชีสินค้าคงเหลือสำหรับผังบัญชีมาตรฐาน ใช้ปรับปรุงยอดสต็อกคงเหลือสิ้นงวดในสมุดรายวันทั่วไป (Manual JV)',
      en: 'Standard inventory asset account used for manual period-end stock valuation adjustments (Manual JV).',
    },
  },
  {
    code: '1170',
    type: 'Asset',
    name: {
      th: 'ภาษีซื้อ',
      en: 'Input VAT',
    },
    usage: {
      th: 'บันทึกอัตโนมัติจากค่าใช้จ่าย/ใบสั่งซื้อที่ติ๊ก "ขอคืนภาษีซื้อได้" เพื่อนำไปหักกลบกับภาษีขาย (2130) ในแบบ ภ.พ.30',
      en: 'Auto-posted from Approved/Paid expenses marked Refundable VAT to net against Output VAT (2130) in P.P.30.',
    },
  },
  {
    code: '2110',
    type: 'Liability',
    name: {
      th: 'เจ้าหนี้การค้า',
      en: 'Accounts Payable (A/P)',
    },
    usage: {
      th: 'ตั้งเจ้าหนี้อัตโนมัติเมื่อบันทึกค่าใช้จ่ายสถานะ "อนุมัติรอจ่าย (Approved)" และลดยอดเมื่อจ่ายชำระแล้ว',
      en: 'Credited when an expense or received PO is Approved (awaiting payment) until marked Paid.',
    },
  },
  {
    code: '2130',
    type: 'Liability',
    name: {
      th: 'ภาษีขาย',
      en: 'Output VAT',
    },
    usage: {
      th: 'ภาษีมูลค่าเพิ่ม 7% ที่เก็บแทนกรมสรรพากรจากใบกำกับภาษี บิลเงินสด ใบเสร็จ และใบเพิ่มหนี้ (ลดยอดเมื่อออกใบลดหนี้)',
      en: '7% VAT collected on Tax Invoices, Receipts, Cash Bills, and Debit Notes; reduced by Credit Notes.',
    },
  },
  {
    code: '2140',
    type: 'Liability',
    name: {
      th: 'ภาษีหัก ณ ที่จ่ายค้างจ่าย (ภ.ง.ด.3/53)',
      en: 'Withholding Tax Payable (P.N.D.3/53)',
    },
    usage: {
      th: 'ยอดภาษีที่กิจการหักจากผู้ขาย/ผู้ให้บริการ (ภ.ง.ด.3 หรือ ภ.ง.ด.53) เพื่อรอนำส่งกรมสรรพากรภายในวันที่ 7/15 ของเดือนถัดไป',
      en: 'WHT deducted from vendors/contractors (P.N.D.3 or P.N.D.53) pending remittance to the Revenue Department.',
    },
  },
  {
    code: '3100',
    type: 'Equity',
    name: {
      th: 'ทุนเรือนหุ้น / กำไรสะสม',
      en: 'Share Capital / Retained Earnings',
    },
    usage: {
      th: 'ใช้ในงบดุลและรายการปรับปรุงส่วนของเจ้าของหรือโอนปิดบัญชีรายได้-ค่าใช้จ่ายสิ้นปี',
      en: 'Displayed in Balance Sheet equity and used for manual capital or year-end retained earnings closing journals.',
    },
  },
  {
    code: '4100',
    type: 'Revenue',
    name: {
      th: 'รายได้จากการขายและบริการ',
      en: 'Sales & Service Revenue',
    },
    usage: {
      th: 'บันทึกยอดมูลค่าก่อน VAT (TotalBeforeVat) เมื่อเอกสารขายถูกออก (Issued) หรือชำระเงินสด',
      en: 'Credited for pre-VAT revenue on issued sales documents; debited on Credit Notes or reversals.',
    },
  },
  {
    code: '5100',
    type: 'Expense',
    name: {
      th: 'ต้นทุนขาย / ซื้อสินค้า',
      en: 'Cost of Goods Sold / Purchases',
    },
    usage: {
      th: 'บันทึกรายจ่ายหมวด "ซื้อสินค้า/ต้นทุนขาย (CostOfGoods)" ทั้งที่บันทึกเองและที่สร้างอัตโนมัติจากการรับของใบสั่งซื้อ (PO)',
      en: 'Debited for expenses categorized as CostOfGoods, including auto-generated expenses upon full PO receipt.',
    },
  },
  {
    code: '5200',
    type: 'Expense',
    name: {
      th: 'ค่าใช้จ่ายดำเนินงาน',
      en: 'Operating Expenses',
    },
    usage: {
      th: 'บันทึกรายจ่ายค่าเช่า สาธารณูปโภค เงินเดือน การตลาด ค่าขนส่ง และภาษีซื้อต้องห้าม (เมื่อไม่ขอคืน VAT)',
      en: 'Debited for rent, utilities, payroll, marketing, shipping, and non-refundable VAT capitalized into expense cost.',
    },
  },
];

export const THAI_TAX_CALENDAR: TaxCalendarEvent[] = [
  {
    formCode: 'ภ.ง.ด. 1 / 3 / 53',
    title: {
      th: 'ยื่นและนำส่งภาษีเงินได้หัก ณ ที่จ่าย (เงินเดือน & จ่ายคู่ค้า)',
      en: 'File & Remit Withholding Tax Returns (Payroll & Vendors)',
    },
    paperDeadline: { th: 'ภายในวันที่ 7 ของเดือนถัดไป', en: 'By the 7th of the following month' },
    onlineDeadline: { th: 'ภายในวันที่ 15 ของเดือนถัดไป (e-Filing)', en: 'By the 15th via RD e-Filing' },
    sourceMenuId: 'expenses',
    notes: {
      th: 'ตรวจสอบรายงาน ภ.ง.ด.3 (บุคคลธรรมดา) และ ภ.ง.ด.53 (นิติบุคคล) ในเมนูค่าใช้จ่าย ให้ตรงกับยอดบัญชี 2140',
      en: 'Reconcile P.N.D.3 (individuals) and P.N.D.53 (corporates) from Expenses against Ledger Account 2140.',
    },
  },
  {
    formCode: 'ภ.พ. 30',
    title: {
      th: 'ยื่นแบบแสดงรายการภาษีมูลค่าเพิ่ม (ภาษีขาย - ภาษีซื้อ)',
      en: 'Monthly Value Added Tax Return (Output VAT - Input VAT)',
    },
    paperDeadline: { th: 'ภายในวันที่ 15 ของเดือนถัดไป', en: 'By the 15th of the following month' },
    onlineDeadline: { th: 'ภายในวันที่ 23 ของเดือนถัดไป (e-Filing)', en: 'By the 23rd via RD e-Filing' },
    sourceMenuId: 'dashboard',
    notes: {
      th: 'ใช้รายงานภาษีขาย Excel (รวม CN/DN และเอกสารยกเลิก) หักลบภาษีซื้อที่ขอคืนได้ (บัญชี 1170) และตรวจสอบตัวเลขบน Tax Estimator',
      en: 'Use Output VAT Excel (including CN/DN & voided rows) less refundable Input VAT (1170) verified on Tax Estimator.',
    },
  },
  {
    formCode: 'ปิดงวด (Period Lock)',
    title: {
      th: 'กระทบยอดธนาคาร ปรับปรุง Manual JV และล็อกงวดบัญชีประจำเดือน',
      en: 'Bank Reconciliation, Accrual JVs & Monthly Period Lock',
    },
    paperDeadline: { th: 'หลังยื่น ภ.พ.30 เสร็จสิ้นทุกเดือน', en: 'Monthly immediately after P.P.30 filing' },
    onlineDeadline: { th: 'ไม่เกินสิ้นเดือนถัดไป (แนะนำ)', en: 'Recommended before next month-end' },
    sourceMenuId: 'accounting',
    notes: {
      th: 'ล็อกงวด MM/YYYY เพื่อป้องกันการแก้ไขหรือยกเลิกบิลย้อนหลัง ซึ่งจะทำให้งบและยอดภาษีที่ยื่นแล้วคลาดเคลื่อน',
      en: 'Lock MM/YYYY to prevent retroactive edits or voids that would desync already-filed tax returns.',
    },
  },
  {
    formCode: 'ภ.ง.ด. 50 / งบการเงิน',
    title: {
      th: 'ปิดบัญชีสิ้นปี ส่งงบการเงินและแบบภาษีเงินได้นิติบุคคล',
      en: 'Annual Financial Statements & Corporate Income Tax (P.N.D.50)',
    },
    paperDeadline: { th: 'ภายใน 150 วันนับจากวันสิ้นรอบบัญชี', en: 'Within 150 days from fiscal year-end' },
    onlineDeadline: { th: 'ขยายเวลา +8 วันผ่าน e-Filing', en: '+8 days extension via e-Filing' },
    sourceMenuId: 'accounting',
    notes: {
      th: 'Export งบการเงิน Excel (งบดุล + งบกำไรขาดทุน + งบทดลอง) และรวบรวมยอดบัญชี 1140 (ถูกหัก ณ ที่จ่าย) มาใช้เป็นเครดิตภาษี',
      en: 'Export Financial Statements Excel and gather Account 1140 (WHT Deducted) certificates to offset corporate tax.',
    },
  },
];

export const MONTHLY_CLOSING_CHECKLIST: MonthlyClosingTask[] = [
  {
    order: 1,
    title: {
      th: 'ตรวจความครบถ้วนของเอกสารขาย ใบลดหนี้ และใบเพิ่มหนี้',
      en: 'Verify All Sales Tax Invoices, Credit Notes, and Debit Notes',
    },
    detail: {
      th: 'เช็คว่าไม่มีใบกำกับภาษีที่ค้างอยู่สถานะ Draft และเอกสารยกเลิกทุกใบมีหมายเหตุ/เหตุผลชัดเจน ก่อนดาวน์โหลดรายงานภาษีขาย Excel',
      en: 'Ensure no intended Tax Invoice remains in Draft and every voided document is accounted for before exporting Output VAT Excel.',
    },
    menuId: 'taxinvoice',
  },
  {
    order: 2,
    title: {
      th: 'ตรวจสอบใบกำกับภาษีซื้อ, ภาษีซื้อต้องห้าม และออกหนังสือ 50 ทวิ',
      en: 'Audit Purchase Input VAT, Non-Refundable VAT & 50 Tawi WHT',
    },
    detail: {
      th: 'แนบรูปใบกำกับภาษีซื้อตัวจริง ตรวจเลขประจำตัวผู้เสียภาษี 13 หลักของคู่ค้า และตรวจติ๊ก "ขอคืนภาษีซื้อได้" ให้ถูกต้อง (ค่ารับรอง/รถไม่เกิน 10 ที่นั่งห้ามขอคืน)',
      en: 'Attach source tax invoice images, validate 13-digit vendor Tax IDs for WHT, and mark non-refundable items (entertainment/passenger cars) correctly.',
    },
    menuId: 'expenses',
  },
  {
    order: 3,
    title: {
      th: 'กระทบยอด Statement ธนาคารให้ครบ 100%',
      en: 'Complete 100% Bank Statement Reconciliation',
    },
    detail: {
      th: 'อัปโหลดไฟล์ CSV จากธนาคาร จับคู่เงินเข้า-ออกที่คงค้าง ตรวจสอบส่วนต่างจากค่าธรรมเนียมโอนหรือยอดถูกหัก ณ ที่จ่าย',
      en: 'Import bank CSV, clear unmatched deposits/withdrawals, and confirm net amounts match GrandTotal minus WHT.',
    },
    menuId: 'bank-reconciliation',
  },
  {
    order: 4,
    title: {
      th: 'บันทึกปรับปรุงบัญชีสิ้นงวด (Manual JV) และตรวจงบทดลอง/งบดุล',
      en: 'Post Month-End Accruals (Manual JV) & Verify Trial Balance / Balance Sheet',
    },
    detail: {
      th: 'ลงรายการค้างจ่าย/จ่ายล่วงหน้า ค่าเสื่อมราคา หรือปิดภาษีซื้อ-ขาย (1170/2130) แล้วตรวจว่ายอดสินทรัพย์ = หนี้สิน + ทุน + กำไรสุทธิ',
      en: 'Record depreciation, accruals, or VAT netting JVs and confirm the Balance Sheet shows the Balanced badge.',
    },
    menuId: 'accounting',
  },
  {
    order: 5,
    title: {
      th: 'ตรวจยอดภาษีบน Tax Estimator แล้วยื่นแบบ ภ.ง.ด.3/53 และ ภ.พ.30',
      en: 'Verify Tax Estimator & File P.N.D.3/53 + P.P.30',
    },
    detail: {
      th: 'เปรียบเทียบตัวเลขบนแดชบอร์ดกับรายงานภาษีขายและบัญชี 2140/1170/2130 ก่อนกดยื่นแบบสรรพากรออนไลน์',
      en: 'Cross-check Dashboard Tax Estimator against Excel exports and ledger accounts 2140/1170/2130 before filing.',
    },
    menuId: 'dashboard',
  },
  {
    order: 6,
    title: {
      th: 'กด "ปิดงวดบัญชี (Lock Period)" ป้องกันการแก้ไขย้อนหลัง',
      en: 'Lock Monthly Accounting Period to Protect Filed Data',
    },
    detail: {
      th: 'ให้ Admin ล็อกงวดเดือนที่ปิดงบแล้วยื่นภาษีเสร็จแล้ว ระบบจะป้องกันไม่ให้แก้ไข ยกเลิก หรือลงบัญชีทับในเดือนนั้นโดยเด็ดขาด',
      en: 'Have an Admin lock the completed MM/YYYY period so no user can backdate, edit, void, or match transactions in that month.',
    },
    menuId: 'accounting',
  },
];

export const DOCUMENT_IMPACT_MATRIX: DocumentMatrixRow[] = [
  {
    guideId: 'quotation',
    docType: { th: 'ใบเสนอราคา (QT)', en: 'Quotation (QT)' },
    etaxCode: '-',
    affectsStock: { th: 'ไม่ตัดสต็อก', en: 'No' },
    affectsOutputVat: { th: 'ไม่นำส่ง VAT', en: 'No' },
    postsJournal: { th: 'ไม่ลงบัญชี', en: 'No JV' },
  },
  {
    guideId: 'delivery',
    docType: { th: 'ใบส่งของ (DN)', en: 'Delivery Note (DN)' },
    etaxCode: '-',
    affectsStock: { th: 'ตัดสต็อกเมื่อออกเอกสาร', en: 'Deducts on Issue' },
    affectsOutputVat: { th: 'ไม่นำส่ง VAT จนกว่าจะเปิด TAX', en: 'No (until TAX)' },
    postsJournal: { th: 'ไม่ลงบัญชี', en: 'No JV' },
  },
  {
    guideId: 'taxinvoice',
    docType: { th: 'ใบกำกับภาษี (TAX/INV)', en: 'Tax Invoice (TAX)' },
    etaxCode: '388',
    affectsStock: { th: 'ตัด (เว้นแต่แปลงจาก DN แล้ว)', en: 'Deducts (unless from DN)' },
    affectsOutputVat: { th: 'เพิ่มภาษีขาย (+)', en: 'Output VAT (+)' },
    postsJournal: { th: 'ลงบัญชีขายเชื่อ/สด (1130/1110)', en: 'Posts A/R or Cash' },
  },
  {
    guideId: 'receipt',
    docType: { th: 'ใบเสร็จรับเงิน (REC)', en: 'Receipt (REC)' },
    etaxCode: '380',
    affectsStock: { th: 'ไม่ตัดสต็อกซ้ำ', en: 'No stock change' },
    affectsOutputVat: { th: 'ไม่รวมในรายงาน ภ.พ.30 (เว้นขายบริการ/สด)', en: 'Only TAX/CN/DN in Report' },
    postsJournal: { th: 'ลงรับเงินสด (1110 / 4100 / 2130)', en: 'Posts Cash Receipt' },
  },
  {
    guideId: 'cashbill',
    docType: { th: 'บิลเงินสด (CB)', en: 'Cash Bill (CB)' },
    etaxCode: '380',
    affectsStock: { th: 'ตัดสต็อกทันที', en: 'Deducts Immediately' },
    affectsOutputVat: { th: 'คำนวณ VAT เมื่อกำหนดโหมด VAT', en: 'VAT if VAT Mode set' },
    postsJournal: { th: 'ลงรับเงินสด (1110 / 4100)', en: 'Posts Cash Sale' },
  },
  {
    guideId: 'creditnote',
    docType: { th: 'ใบลดหนี้ (CN)', en: 'Credit Note (CN)' },
    etaxCode: '381',
    affectsStock: { th: 'ไม่เปลี่ยนสต็อกอัตโนมัติ (ยกเว้นยกเลิก)', en: 'No auto stock return' },
    affectsOutputVat: { th: 'ลดภาษีขาย (-)', en: 'Output VAT (-)' },
    postsJournal: { th: 'กลับรายการรายได้ & 2130', en: 'Reverses Rev & VAT' },
  },
  {
    guideId: 'debitnote',
    docType: { th: 'ใบเพิ่มหนี้ (DB/DN-V)', en: 'Debit Note (DB)' },
    etaxCode: '383',
    affectsStock: { th: 'ไม่ตัดสต็อก', en: 'No' },
    affectsOutputVat: { th: 'เพิ่มภาษีขาย (+)', en: 'Output VAT (+)' },
    postsJournal: { th: 'เพิ่มลูกหนี้ 1130 & รายได้ 4100', en: 'Adds A/R & Rev' },
  },
];

export const MENU_HELP_GUIDES: MenuHelpGuide[] = [
  {
    id: 'overview-accounting-cycle',
    category: 'cycle',
    route: '/dashboard',
    iconName: 'Compass',
    menuName: {
      th: 'ภาพรวมวงจรบัญชี & การไหลข้อมูลทั้งระบบ',
      en: 'End-to-End Accounting Cycle & System Data Flow',
    },
    shortDesc: {
      th: 'เข้าใจความเชื่อมโยงระหว่างเอกสารขาย การรับเงิน ค่าใช้จ่าย คลังสินค้า กระทบยอดธนาคาร และการปิดงบอัตโนมัติ',
      en: 'Understand how Sales, Payments, Expenses, Inventory, Bank Reconciliation, and Auto Accounting connect across modules.',
    },
    whoShouldUse: {
      th: 'เจ้าของกิจการ ผู้จัดการฝ่ายบัญชี พนักงานขาย และนักบัญชีทุกคนที่เริ่มใช้งานระบบ',
      en: 'Business owners, accounting managers, sales staff, and accountants onboarding to Senic Billing Next.',
    },
    prerequisites: [
      {
        th: 'ตั้งค่าชื่อบริษัท เลขประจำตัวผู้เสียภาษี 13 หลัก ที่อยู่ และรูปแบบเลขรันเอกสารในเมนู "ตั้งค่า"',
        en: 'Configure company legal name, 13-digit Tax ID, address, and document running prefixes in Settings.',
      },
      {
        th: 'ตรวจสอบความพร้อมของผังบัญชีมาตรฐาน (1110–5200) ในเมนู "บัญชีอัตโนมัติ"',
        en: 'Verify standard Chart of Accounts (1110–5200) in Auto Accounting.',
      },
    ],
    steps: [
      {
        title: { th: '1. วงจรรายได้ (Order-to-Cash)', en: '1. Revenue Cycle (Order-to-Cash)' },
        detail: {
          th: 'เริ่มจาก "ใบเสนอราคา" (ไม่มีผลบัญชี) -> แปลงเป็น "ใบส่งของ" (ตัดสต็อกสินค้า) -> แปลงเป็น "ใบกำกับภาษี" (ตั้งลูกหนี้ 1130 + ภาษีขาย 2130 + รายได้ 4100) -> รับเงินผ่าน PromptPay/โอน/กระทบยอดธนาคาร (เดบิตเงินฝาก 1110 + ถูกหัก ณ ที่จ่าย 1140 / เครดิตลูกหนี้ 1130)',
          en: 'Start from Quotation (no GL/stock) -> convert to Delivery Note (deducts stock) -> convert to Tax Invoice (posts A/R 1130, VAT 2130, Revenue 4100) -> collect payment or reconcile bank statement (Dr. 1110 + 1140 / Cr. 1130).',
        },
      },
      {
        title: { th: '2. วงจรรายจ่ายและจัดซื้อ (Procure-to-Pay)', en: '2. Expenditure Cycle (Procure-to-Pay)' },
        detail: {
          th: 'เปิด "ใบสั่งซื้อ (PO)" -> เมื่อรับของครบระบบเพิ่มสต็อกเข้าคลัง (PurchaseIn) และสร้าง "ค่าใช้จ่ายหมวดต้นทุนขาย 5100" ให้อัตโนมัติ หรือคีย์รายจ่ายทั่วไปเข้า "ค่าใช้จ่าย/ภาษีซื้อ" พร้อมหัก ณ ที่จ่าย (2140) และภาษีซื้อ (1170)',
          en: 'Issue Purchase Order (PO) -> full goods receipt increases Warehouse Stock (PurchaseIn) and auto-creates a CostOfGoods Expense (5100), or enter operating bills in Expenses with Input VAT (1170) and WHT Payable (2140).',
        },
      },
      {
        title: { th: '3. การควบคุมภายในและปิดงวดประจำเดือน', en: '3. Internal Control & Monthly Closing' },
        detail: {
          th: 'ตรวจสอบ Statement ใน "กระทบยอดยอดธนาคาร" -> ปรับปรุงรายการค้างจ่าย/ค่าเสื่อมใน "Manual JV" -> ตรวจงบกำไรขาดทุน งบดุล และ Tax Estimator -> ล็อกงวด MM/YYYY ในเมนูบัญชีเพื่อป้องกันข้อมูลย้อนหลังเปลี่ยน',
          en: 'Reconcile Bank Statements -> post period-end accruals via Manual JV -> review P&L, Balance Sheet, and Tax Estimator -> lock the MM/YYYY period to freeze filed figures.',
        },
      },
    ],
    journalScenarios: [
      {
        condition: {
          th: 'ตัวอย่างภาพรวม 1 วงจรขายเชื่อที่มี VAT 7% และถูกหัก ณ ที่จ่าย 3% (ค่าบริการ 10,000 + VAT 700)',
          en: 'Complete service credit sale flow: 10,000 base + 700 VAT, with 3% WHT deducted upon collection',
        },
        lines: [
          {
            side: 'Dr',
            accountCode: '1130',
            accountName: { th: 'ลูกหนี้การค้า (เมื่อออกใบกำกับภาษี)', en: 'Accounts Receivable (on Tax Invoice issue)' },
            amountRule: { th: '10,700.00', en: '10,700.00' },
          },
          {
            side: 'Cr',
            accountCode: '4100',
            accountName: { th: 'รายได้จากการขายและบริการ', en: 'Sales & Service Revenue' },
            amountRule: { th: '10,000.00', en: '10,000.00' },
          },
          {
            side: 'Cr',
            accountCode: '2130',
            accountName: { th: 'ภาษีขาย', en: 'Output VAT' },
            amountRule: { th: '700.00', en: '700.00' },
          },
          {
            side: 'Dr',
            accountCode: '1110',
            accountName: { th: 'เงินสดและเงินฝาก (เมื่อรับชำระสุทธิ)', en: 'Cash & Bank (on net collection)' },
            amountRule: { th: '10,400.00 (10,700 - 300)', en: '10,400.00 (10,700 - 300)' },
          },
          {
            side: 'Dr',
            accountCode: '1140',
            accountName: { th: 'ภาษีเงินได้ถูกหัก ณ ที่จ่าย (3% ของฐาน 10,000)', en: 'WHT Deducted Asset (3% of 10,000)' },
            amountRule: { th: '300.00', en: '300.00' },
          },
          {
            side: 'Cr',
            accountCode: '1130',
            accountName: { th: 'ลูกหนี้การค้า (ล้างลูกหนี้เต็มจำนวน)', en: 'Accounts Receivable (cleared in full)' },
            amountRule: { th: '10,700.00', en: '10,700.00' },
          },
        ],
      },
    ],
    accountantTips: [
      {
        title: {
          th: 'แยกเกณฑ์สิทธิ (Accrual) ออกจากเกณฑ์เงินสด (Cash) ให้ชัดเจน',
          en: 'Separate Accrual Recognition from Cash Flow Timing',
        },
        detail: {
          th: 'รายได้และภาษีขายเกิดขึ้นทันทีเมื่อออกเอกสารการขาย (ไม่ว่าจะรับเงินแล้วหรือยัง) ส่วนการรับเงินจะกระทบเพียงการย้ายยอดจาก "ลูกหนี้ 1130" ไปเป็น "เงินสด 1110" และ "ถูกหัก ณ ที่จ่าย 1140"',
          en: 'Revenue and Output VAT recognize upon issuing the sales document regardless of payment timing; collecting cash simply reclassifies A/R (1130) into Cash (1110) and WHT Asset (1140).',
        },
      },
      {
        title: {
          th: 'อย่าใช้เอกสาร "ฉบับร่าง (Draft)" ส่งให้ลูกค้า',
          en: 'Never Send Draft Documents as Official Tax Invoices',
        },
        detail: {
          th: 'เอกสารสถานะ Draft ยังไม่ตัดสต็อกและยังไม่บันทึกบัญชี JV จึงควรเปลี่ยนสถานะเป็น "ออกเอกสารแล้ว (Issued)" ก่อนดาวน์โหลด PDF หรือส่ง e-Tax XML',
          en: 'Draft documents neither deduct inventory nor post JV entries. Always transition to Issued before PDF/e-Tax XML distribution.',
        },
      },
    ],
    commonPitfalls: [
      {
        th: 'คำนวณภาษีหัก ณ ที่จ่าย (WHT) จากยอดรวม VAT แทนยอดก่อน VAT — กฎหมายให้หักจากฐานมูลค่าสินค้า/บริการก่อน VAT เสมอ',
        en: 'Computing WHT on the VAT-inclusive total instead of the pre-VAT subtotal — Thai tax law bases WHT strictly on pre-VAT value.',
      },
      {
        th: 'เปิดบิลซ้ำระหว่าง "ใบส่งของ" กับ "ใบกำกับภาษี" โดยไม่กดปุ่ม "แปลงเอกสาร" ทำให้ระบบตัดสต็อกสินค้าซ้ำ 2 รอบ',
        en: 'Manually re-creating a Tax Invoice instead of converting from the Delivery Note causes duplicate inventory deduction.',
      },
    ],
    relatedIds: ['dashboard', 'taxinvoice', 'expenses', 'accounting'],
    impactSummary: {
      stock: { th: 'ตัดตาม DeliveryNote / CashBill / TaxInvoice', en: 'Driven by DeliveryNote / CashBill / TaxInvoice' },
      vat: { th: 'หักกลบภาษีขาย (2130) กับภาษีซื้อ (1170)', en: 'Nets Output VAT (2130) against Input VAT (1170)' },
      wht: { th: 'แยกฝั่งถูกหัก (1140) และหักจ่าย (2140)', en: 'Tracks Deducted Asset (1140) & Payable (2140)' },
      journal: { th: 'ลงบัญชีอัตโนมัติ 100% พร้อมระบบกลับรายการ', en: '100% Automated Double-Entry + Reversals' },
    },
  },
  {
    id: 'dashboard',
    category: 'cycle',
    route: '/dashboard',
    iconName: 'LayoutDashboard',
    menuName: {
      th: 'แดชบอร์ด & ประมาณการภาษี (Tax Estimator)',
      en: 'Dashboard & Tax Estimator',
    },
    shortDesc: {
      th: 'ศูนย์รวมภาพรวมยอดขาย กำไรเบื้องต้น ประมาณการ ภ.พ.30 / หัก ณ ที่จ่าย และอายุลูกหนี้ค้างชำระ 5 ช่วงเวลา',
      en: 'Executive overview of revenue, sales VAT charts, P.P.30 & WHT tax estimator, 5-bucket A/R aging, and Excel exports.',
    },
    whoShouldUse: {
      th: 'ผู้บริหาร นักบัญชี และฝ่ายการเงินสำหรับติดตามสภาพคล่องและเตรียมเงินจ่ายภาษีรายเดือน',
      en: 'Executives, accountants, and finance teams monitoring cash collection and monthly tax liabilities.',
    },
    prerequisites: [
      {
        th: 'มีเอกสารขายหรือค่าใช้จ่ายที่บันทึกในระบบในเดือนที่ต้องการดูผล',
        en: 'Sales documents or expenses recorded for the target reporting period.',
      },
    ],
    steps: [
      {
        title: { th: '1. อ่าน KPI รายได้และลูกหนี้ค้างรับ', en: '1. Review Revenue & Receivable KPIs' },
        detail: {
          th: 'ดูยอดขายรวม ยอดเก็บเงินได้จริง ยอดรอเก็บ และกราฟเปรียบเทียบรายได้กับภาษีขายรายเดือนย้อนหลัง',
          en: 'Inspect total revenue, collected cash, pending receivables, and monthly Revenue vs Output VAT trend charts.',
        },
      },
      {
        title: { th: '2. ตรวจสอบ Tax Estimator (ประมาณการภาษี)', en: '2. Inspect Monthly Tax Estimator' },
        detail: {
          th: 'ช่อง "ภาษีขายสุทธิ" จะคำนวณรวมใบเพิ่มหนี้และหักใบลดหนี้ให้อัตโนมัติ ส่วน "ภาษีซื้อที่ขอคืนได้" ดึงเฉพาะรายการที่ติ๊กขอคืน VAT แล้วแสดงยอด ภ.พ.30 ที่ต้องชำระเพิ่มหรือขอคืน',
          en: 'Output VAT automatically incorporates Debit Notes and subtracts Credit Notes; Refundable Input VAT nets against it to project net P.P.30 payable or refundable, alongside monthly P.N.D.3/53 totals.',
        },
      },
      {
        title: { th: '3. ติดตามรายงานอายุหนี้ (A/R Aging 5 Buckets)', en: '3. Track 5-Bucket A/R Aging' },
        detail: {
          th: 'ตารางแยกบิลค้างชำระออกเป็น 5 ช่วง: ยังไม่ครบกำหนด, เกินกำหนด 1–30 วัน, 31–60 วัน, 61–90 วัน และ >90 วัน พร้อมปุ่ม Export Excel สำหรับโทรติดตามหนี้',
          en: 'Reviews unpaid receivables segmented into Current, 1–30, 31–60, 61–90, and >90 days overdue with Excel export.',
        },
      },
    ],
    journalScenarios: [],
    accountantTips: [
      {
        title: {
          th: 'เทียบตัวเลข Tax Estimator กับรายงาน ภ.พ.30 ก่อนวันที่ 15 ทุกเดือน',
          en: 'Reconcile Tax Estimator Before the 15th Monthly Filing Deadline',
        },
        detail: {
          th: 'หากยอด ภ.พ.30 บนแดชบอร์ดดูสูงผิดปกติ ให้เช็ค 2 จุด: (1) มีใบเสร็จรับเงินหรือใบกำกับภาษีที่ค้างยังไม่คีย์ค่าใช้จ่าย/ใบกำกับภาษีซื้อเข้าสู่ระบบหรือไม่ และ (2) ค่าใช้จ่ายในเดือนนั้นเผลอตั้งสถานะเป็น Draft หรือไม่ติ๊กขอคืนภาษีซื้อ',
          en: 'If projected P.P.30 looks unexpectedly high, verify whether vendor bills remain in Draft or lack the Refundable VAT flag.',
        },
      },
      {
        title: {
          th: 'ใช้รายงานอายุหนี้ >60 วัน ประเมินการตั้งสำรองหนี้สงสัยจะสูญ',
          en: 'Use >60 Day A/R Aging Buckets for Credit Risk Control',
        },
        detail: {
          th: 'ลูกหนี้ที่ค้างเกิน 90 วันควรส่งทีมขาย/บัญชีส่งทวงถามอย่างเป็นทางการ (ผ่านปุ่มแจ้งเตือนในหน้าเอกสาร) และชะลอการปล่อยเครดิตเพิ่ม',
          en: 'Invoices exceeding 90 days overdue warrant formal collection reminders and credit-hold review.',
        },
      },
    ],
    commonPitfalls: [
      {
        th: 'ลืมว่า Tax Estimator เป็นตัวเลข Real-time หากมีบิลที่ลูกค้าหัก ณ ที่จ่ายแล้วยังไม่กดรับชำระ ยอดค้างรับจะยังรวมเงินก้อนนั้นอยู่',
        en: 'Tax Estimator reflects live posted state; uncollected invoices remain in A/R Aging until recorded via payment or Bank Reconciliation.',
      },
    ],
    relatedIds: ['overview-accounting-cycle', 'taxinvoice', 'expenses', 'accounting'],
    impactSummary: {
      stock: { th: 'แสดงสินค้าขายดี Top 5 เท่านั้น (ไม่แก้สต็อก)', en: 'Read-only Top 5 Product stats' },
      vat: { th: 'สรุป ภาษีขายสุทธิ vs ภาษีซื้อขอคืนได้', en: 'Projects Net P.P.30 (Output - Input VAT)' },
      wht: { th: 'แสดงยอดสะสม ภ.ง.ด.3 / ภ.ง.ด.53 ประจำเดือน', en: 'Shows monthly P.N.D.3/53 cumulative WHT' },
      journal: { th: 'อ่านข้อมูลจาก GL และเอกสารที่โพสต์แล้ว', en: 'Read-only analytics across posted docs & GL' },
    },
  },
  {
    id: 'receipt',
    category: 'sales',
    route: '/documents/receipt',
    iconName: 'Receipt',
    menuName: {
      th: 'ใบเสร็จรับเงิน (Receipt)',
      en: 'Receipts',
    },
    shortDesc: {
      th: 'ออกหลักฐานการรับชำระเงินจากลูกค้า บันทึกรับเงินสด/โอน พร้อมรองรับ e-Tax XML รหัส 380',
      en: 'Issue official customer payment receipts with cash/bank GL posting and ETDA e-Tax XML code 380.',
    },
    whoShouldUse: {
      th: 'ฝ่ายการเงิน พนักงานบัญชีรับ (AR) และธุรกิจบริการที่ออกใบเสร็จพร้อมรับเงิน',
      en: 'Finance officers, A/R clerks, and service businesses issuing receipts upon payment.',
    },
    prerequisites: [
      {
        th: 'มีข้อมูลลูกค้าและรายการสินค้า/บริการ หรือเอกสารใบแจ้งหนี้/ใบกำกับภาษีที่ต้องการรับชำระ',
        en: 'Customer master record and line items or underlying invoice details.',
      },
    ],
    steps: [
      {
        title: { th: '1. กดสร้างใบเสร็จรับเงินใหม่ หรือแปลงจากใบเสนอราคา/ใบกำกับภาษี', en: '1. Create Receipt or Convert from Quotation / Tax Invoice' },
        detail: {
          th: 'เข้าเมนู "ใบเสร็จรับเงิน" -> กด "+ สร้างใบเสร็จรับเงิน" เลือกลูกค้า วันที่รับเงิน และเพิ่มรายการจากคลังสินค้าหรือพิมพ์รายการบริการ',
          en: 'Open Receipts -> click "+ Create", pick the customer, receipt date, and add catalog products or service descriptions.',
        },
      },
      {
        title: { th: '2. ตั้งค่า VAT และภาษีหัก ณ ที่จ่าย (WHT)', en: '2. Configure VAT Mode & Customer WHT' },
        detail: {
          th: 'เลือก Exclude VAT (บวก 7%), Include VAT (รวม 7% ในราคา) หรือ Non-VAT และกำหนดอัตราหัก ณ ที่จ่าย (เช่น 3% สำหรับค่าบริการ) หากลูกค้าหักไว้',
          en: 'Choose VAT Exclusive/Inclusive/Exempt and specify WHT rate (e.g. 3% for services) if deducted by the customer.',
        },
      },
      {
        title: { th: '3. บันทึกออกเอกสาร พิมพ์ PDF หรือส่งลิงก์/e-Tax XML', en: '3. Issue, Print PDF, Share Link, or Export e-Tax XML' },
        detail: {
          th: 'เมื่อออกใบเสร็จ สถานะจะบันทึกเป็น Paid/Issued ทันที สามารถดาวน์โหลด e-Tax XML (Document Type 380) ส่งให้ลูกค้าได้จากตารางรายการ',
          en: 'Upon issuing, download official PDF, share public link, or export ETDA e-Tax XML (type 380).',
        },
      },
    ],
    journalScenarios: [
      {
        condition: {
          th: 'เมื่อออกใบเสร็จรับเงิน (มีผลเป็นการรับเงินสด/โอนทันที)',
          en: 'When issuing an immediate Receipt (cash/bank collection)',
        },
        lines: [
          {
            side: 'Dr',
            accountCode: '1110',
            accountName: { th: 'เงินสดและเงินฝากธนาคาร', en: 'Cash & Bank' },
            amountRule: { th: 'ยอดรับจริง (GrandTotal - WHT)', en: 'Net Received (GrandTotal - WHT)' },
          },
          {
            side: 'Dr',
            accountCode: '1140',
            accountName: { th: 'ภาษีเงินได้ถูกหัก ณ ที่จ่าย (ถ้ามี)', en: 'WHT Deducted Asset (if applicable)' },
            amountRule: { th: 'WhtAmount', en: 'WhtAmount' },
          },
          {
            side: 'Cr',
            accountCode: '4100',
            accountName: { th: 'รายได้จากการขายและบริการ', en: 'Sales & Service Revenue' },
            amountRule: { th: 'ยอดก่อน VAT (TotalBeforeVat)', en: 'Pre-VAT Total' },
          },
          {
            side: 'Cr',
            accountCode: '2130',
            accountName: { th: 'ภาษีขาย (กรณีจด VAT)', en: 'Output VAT (if VAT applies)' },
            amountRule: { th: 'VatAmount', en: 'VatAmount' },
          },
        ],
      },
    ],
    accountantTips: [
      {
        title: {
          th: 'ความแตกต่างระหว่าง "ใบเสร็จรับเงิน" กับ "ใบกำกับภาษี"',
          en: 'Receipt vs. Tax Invoice in Thai VAT Practice',
        },
        detail: {
          th: 'หากบริษัทจดทะเบียน VAT และขายสินค้า ให้ส่งมอบ "ใบกำกับภาษี (TAX)" เมื่อส่งมอบสินค้า (เพื่อเข้าแบบ ภ.พ.30) ส่วนกิจการที่ขายบริการที่จุดรับเงินเกิดพร้อมจุดรับภาระภาษี หรือรับเงินตามงวด ให้ระวังไม่บันทึกรายได้ซ้ำหากเปิดใบกำกับภาษีไว้ก่อนหน้าแล้ว',
          en: 'For VAT-registered goods sellers, Tax Invoices trigger Output VAT in P.P.30. If an invoice was already issued on credit, record payment directly on that Tax Invoice rather than creating a duplicate standalone revenue Receipt.',
        },
      },
      {
        title: {
          th: 'ขอหนังสือรับรอง 50 ทวิ จากลูกค้าทุกครั้งที่ถูกหัก WHT',
          en: 'Always Collect 50 Tawi Certificates from Customers',
        },
        detail: {
          th: 'ยอดในบัญชี 1140 (ถูกหัก ณ ที่จ่าย) จะใช้หักภาษีเงินได้นิติบุคคลปลายปี (ภ.ง.ด.50) ได้ก็ต่อเมื่อมีใบ 50 ทวิตัวจริง/อิเล็กทรอนิกส์จากลูกค้าเป็นหลักฐานเท่านั้น',
          en: 'Amounts accumulated in Account 1140 are only deductible on annual P.N.D.50 when backed by official 50 Tawi certificates issued by customers.',
        },
      },
    ],
    commonPitfalls: [
      {
        th: 'สร้างใบเสร็จรับเงินซ้ำซ้อนกับการกด "รับชำระเงิน" บนใบกำกับภาษีเดิม ทำให้ยอดรายได้ 4100 และภาษีขาย 2130 เบิ้ล 2 เท่า',
        en: 'Creating a brand-new standalone Receipt for an already-issued Tax Invoice instead of recording payment on the invoice duplicates revenue (4100).',
      },
    ],
    relatedIds: ['taxinvoice', 'cashbill', 'bank-reconciliation'],
    impactSummary: {
      stock: { th: 'ไม่ตัดสต็อกซ้ำ', en: 'Does not auto-deduct stock' },
      vat: { th: 'ส่งออก e-Tax 380; รายงาน ภ.พ.30 ใช้ TAX/CN/DN', en: 'e-Tax 380; P.P.30 Excel tracks TAX/CN/DN' },
      wht: { th: 'รองรับการถูกหัก ณ ที่จ่าย (1140)', en: 'Tracks customer-deducted WHT (1140)' },
      journal: { th: 'เดบิตเงินสด 1110 / เครดิตรายได้ 4100', en: 'Dr. Cash 1110 / Cr. Revenue 4100' },
    },
  },
  {
    id: 'cashbill',
    category: 'sales',
    route: '/documents/cashbill',
    iconName: 'Banknote',
    menuName: {
      th: 'บิลเงินสด / ขายหน้าร้าน POS',
      en: 'Cash Bills & POS Barcode Sales',
    },
    shortDesc: {
      th: 'บันทึกการขายรับเงินสดหน้าร้านพร้อมสแกนบาร์โค้ด POS และตัดสต็อกสินค้าทันที',
      en: 'Record immediate walk-in cash sales with POS barcode scanning, instant stock deduction, and cash GL posting.',
    },
    whoShouldUse: {
      th: 'พนักงานขายหน้าร้าน แคชเชียร์ และร้านค้าที่ขายสดรับเงินทันที',
      en: 'Counter sales staff, cashiers, and retail operations collecting cash at point of sale.',
    },
    prerequisites: [
      {
        th: 'ตั้งค่ารหัสบาร์โค้ดและราคาขาย/สต็อกสินค้าในเมนู "สินค้า" (แยกช่อง Barcode กับ SKU)',
        en: 'Assign Barcode, price, and stock quantity (non-null) in Products to enable fast POS scanning.',
      },
    ],
    steps: [
      {
        title: { th: '1. เปิดฟอร์มบิลเงินสดและสแกนบาร์โค้ด (POS)', en: '1. Open Cash Bill Form & Scan Product Barcode' },
        detail: {
          th: 'กดสร้างบิลเงินสด เลือกลูกค้าทั่วไปหรือสมาชิกร้าน แล้ววางเคอร์เซอร์ที่ช่อง Barcode Scanner เพื่อยิงสแกนสินค้า ระบบจะเพิ่มจำนวนให้อัตโนมัติและเช็คสต็อกคงเหลือ',
          en: 'Create a Cash Bill, select customer (or walk-in), and scan items into the POS barcode input to auto-increment quantities.',
        },
      },
      {
        title: { th: '2. ตรวจสอบส่วนลด ภาษี และคลังสินค้าที่ตัดจ่าย', en: '2. Confirm Discounts, Tax & Warehouse' },
        detail: {
          th: 'ตรวจยอดรวมสุทธิและวิธีชำระเงิน (เงินสด/โอน/QR) ระบบจะอัดข้อมูล Draft ไว้ในเบราว์เซอร์อัตโนมัติกันข้อมูลหายหากเน็ตหลุด',
          en: 'Verify net total and payment method; form progress auto-saves locally to prevent accidental loss.',
        },
      },
      {
        title: { th: '3. บันทึกและพิมพ์ใบเสร็จรับเงิน/บิลเงินสดอย่างย่อ', en: '3. Save & Print Cash Bill' },
        detail: {
          th: 'เมื่อบันทึก ระบบจะตัดสต็อก (SaleOut) และลงบัญชีเงินสด (1110) ทันที สามารถเปิดหน้าพิมพ์และส่งลิงก์ให้ลูกค้าได้เลย',
          en: 'Saving triggers instant inventory SaleOut deduction and posts Cash (1110) journal entries.',
        },
      },
    ],
    journalScenarios: [
      {
        condition: {
          th: 'เมื่อออกบิลเงินสด (รับเงินทันที)',
          en: 'When issuing a Cash Bill',
        },
        lines: [
          {
            side: 'Dr',
            accountCode: '1110',
            accountName: { th: 'เงินสดและเงินฝากธนาคาร', en: 'Cash & Bank' },
            amountRule: { th: 'ยอดรับสุทธิ (GrandTotal)', en: 'GrandTotal' },
          },
          {
            side: 'Cr',
            accountCode: '4100',
            accountName: { th: 'รายได้จากการขายและบริการ', en: 'Sales & Service Revenue' },
            amountRule: { th: 'ยอดก่อน VAT', en: 'Pre-VAT Total' },
          },
          {
            side: 'Cr',
            accountCode: '2130',
            accountName: { th: 'ภาษีขาย (หากเลือกคิด VAT)', en: 'Output VAT (if VAT enabled)' },
            amountRule: { th: 'VatAmount', en: 'VatAmount' },
          },
        ],
      },
    ],
    accountantTips: [
      {
        title: {
          th: 'ข้อควรระวังทางภาษีสำหรับ "บิลเงินสด" กับผู้ซื้อนิติบุคคล',
          en: 'Tax Deductibility Advisory on Cash Bills',
        },
        detail: {
          th: 'หากผู้ซื้อขอไปลงเป็นค่าใช้จ่ายบริษัท บิลเงินสดต้องระบุชื่อ-ที่อยู่-เลขผู้เสียภาษีผู้ขายชัดเจนและแนบสำเนาบัตรหรือใบรับเงิน ส่วนหากลูกค้าต้องการขอคืนภาษีซื้อ (VAT 7%) ต้องออกเป็น "ใบกำกับภาษี (TAX)" เท่านั้น บิลเงินสดใช้ขอคืนภาษีซื้อไม่ได้',
          en: 'Cash Bills cannot be used by VAT-registered buyers to claim Input VAT — issue a full Tax Invoice whenever a buyer requests a tax credit.',
        },
      },
    ],
    commonPitfalls: [
      {
        th: 'นำบิลเงินสดที่ไม่ระบุผู้ซื้อไปรวมคาดการณ์ว่าจะใช้แทนใบกำกับภาษีอย่างย่อที่ต้องขออนุญาตกรมสรรพากร',
        en: 'Treating non-VAT cash bills as formal abbreviated tax invoices without proper VAT registration/POS authorization.',
      },
    ],
    relatedIds: ['products', 'warehouses', 'taxinvoice'],
    impactSummary: {
      stock: { th: 'ตัดสต็อกทันที (SaleOut)', en: 'Immediate Stock Deduction' },
      vat: { th: 'รองรับ VAT / Non-VAT ตามที่เลือก', en: 'Calculates VAT if VAT mode set' },
      wht: { th: 'รองรับ WHT (พบน้อยในขายสดหน้าร้าน)', en: 'Optional WHT field supported' },
      journal: { th: 'Dr. 1110 / Cr. 4100 (+ 2130)', en: 'Dr. 1110 / Cr. 4100 (+ 2130)' },
    },
  },
  {
    id: 'delivery',
    category: 'sales',
    route: '/documents/delivery',
    iconName: 'Truck',
    menuName: {
      th: 'ใบส่งของ (Delivery Note)',
      en: 'Delivery Notes',
    },
    shortDesc: {
      th: 'คุมการจัดส่งสินค้าและตัดสต็อกออกจากคลัง พร้อมติดตามสถานะขนส่งและแปลงเป็นใบกำกับภาษีไม่ให้ตัดสต็อกซ้ำ',
      en: 'Manage physical deliveries, deduct stock at dispatch, track shipment status, and convert to Tax Invoice without double-deducting.',
    },
    whoShouldUse: {
      th: 'ฝ่ายคลังสินค้า จัดส่ง และฝ่ายขายที่ส่งสินค้าก่อนวางบิล/ออกใบกำกับภาษีปลายเดือน',
      en: 'Warehouse, logistics, and sales teams shipping physical goods prior to consolidated billing.',
    },
    prerequisites: [
      {
        th: 'มีสต็อกสินค้าเพียงพอในคลังสินค้า (สำหรับสินค้าที่เปิดนับสต็อก)',
        en: 'Available stock in the selected warehouse for stock-tracked items.',
      },
    ],
    steps: [
      {
        title: { th: '1. สร้างใบส่งของใหม่ หรือแปลงจากใบเสนอราคา', en: '1. Create Delivery Note or Convert from Quotation' },
        detail: {
          th: 'กดแปลงจากใบเสนอราคาที่ลูกค้าอนุมัติแล้ว หรือสร้างใบส่งของใหม่โดยตรง เพื่อตัดสินค้าออกจากคลัง (SaleOut)',
          en: 'Convert an approved Quotation or create a Delivery Note directly to issue goods from inventory (SaleOut).',
        },
      },
      {
        title: { th: '2. อัปเดตสถานะการจัดส่งแบบ Real-time', en: '2. Update Delivery Tracking Status' },
        detail: {
          th: 'ปรับสถานะในตารางได้ 3 ระดับ: "รอส่ง" -> "กำลังจัดส่ง" -> "ส่งสำเร็จแล้ว" เพื่อให้ทีมขายและบัญชีทราบเวลาส่งมอบจริง',
          en: 'Track fulfillment through 3 statuses: Pending ("รอส่ง") -> In Transit ("กำลังจัดส่ง") -> Delivered ("ส่งสำเร็จแล้ว").',
        },
      },
      {
        title: { th: '3. แปลงเป็นใบกำกับภาษีเมื่อพร้อมเรียกเก็บเงิน', en: '3. Convert to Tax Invoice When Billing' },
        detail: {
          th: 'ใช้ปุ่มแปลงเอกสารจากใบส่งของเป็นใบกำกับภาษี ระบบรู้จำ SourceDocumentId จึง **ไม่ตัดสต็อกซ้ำ** แต่จะเริ่มตั้งลูกหนี้และบันทึกภาษีขายให้',
          en: 'Use the Convert action to generate a Tax Invoice. Because SourceDocumentId is linked, stock is NOT deducted twice.',
        },
      },
    ],
    journalScenarios: [
      {
        condition: {
          th: 'ณ วันที่ออกใบส่งของ (DeliveryNote)',
          en: 'Upon issuing a Delivery Note',
        },
        lines: [
          {
            side: 'Dr',
            accountCode: '-',
            accountName: { th: 'ไม่มีการลงบัญชีอัตโนมัติ (ตัดเฉพาะปริมาณสต็อก)', en: 'No automated GL entry (Inventory Qty movement only)' },
            amountRule: { th: '0.00', en: '0.00' },
          },
        ],
      },
    ],
    accountantTips: [
      {
        title: {
          th: 'จุดรับผิดภาษีขายสินค้า (Tax Point) ตามประมวลรัษฎากร',
          en: 'Thai VAT Tax Point on Delivery of Goods',
        },
        detail: {
          th: 'สำหรับการขายสินค้า ภาระภาษีมูลค่าเพิ่มเกิดขึ้น "เมื่อส่งมอบสินค้า" เว้นแต่ได้โอนกรรมสิทธิ์/รับชำระเงิน/ออกใบกำกับภาษีก่อน ดังนั้นตามหลักนักบัญชี ควรออกใบกำกับภาษี (TAX) ให้สอดคล้องกับเดือนที่ส่งมอบสินค้าจริง อย่าค้างใบส่งของข้ามเดือนโดยไม่ออกใบกำกับภาษี',
          en: 'Under Thai Revenue Code, VAT on goods triggers upon physical delivery unless payment or invoicing occurred earlier. Avoid leaving deliveries unbilled across month-end.',
        },
      },
    ],
    commonPitfalls: [
      {
        th: 'ส่งของข้ามเดือนแต่เพิ่งนึกออกแล้วมาออกใบกำกับภาษีเดือนถัดไป อาจเสี่ยงโดนประเมินยื่นภาษีขายล่าช้าหากลูกค้าเซ็นรับของในเดือนก่อนแล้ว',
        en: 'Delivering goods in Month 1 and issuing the Tax Invoice in Month 2 creates late-VAT filing risk if the signed delivery receipt dates to Month 1.',
      },
    ],
    relatedIds: ['quotation', 'taxinvoice', 'warehouses'],
    impactSummary: {
      stock: { th: 'ตัดสต็อกทันทีที่ออก (SaleOut)', en: 'Deducts stock on issue' },
      vat: { th: 'ยังไม่บันทึกภาษีขาย (รอแปลงเป็น TAX)', en: 'No VAT until converted to Tax Invoice' },
      wht: { th: 'ไม่มีผล WHT', en: 'No WHT impact' },
      journal: { th: 'ไม่ลงบัญชี (Non-posting)', en: 'No GL posting' },
    },
  },
  {
    id: 'quotation',
    category: 'sales',
    route: '/documents/quotation',
    iconName: 'FileText',
    menuName: {
      th: 'ใบเสนอราคา (Quotation)',
      en: 'Quotations',
    },
    shortDesc: {
      th: 'ทำใบเสนอราคา ส่งอนุมัติภายใน แชร์ลิงก์ออนไลน์ให้ลูกค้าเปิดดู และแปลงเป็นใบส่งของ/ใบกำกับภาษี/ใบเสร็จในคลิกเดียว',
      en: 'Draft price quotes, route for internal approval, share live customer links, and convert to Delivery Note/Tax Invoice/Receipt in 1 click.',
    },
    whoShouldUse: {
      th: 'ฝ่ายขาย ทีมการตลาด และผู้จัดการผู้อนุมัติราคา/ส่วนลด',
      en: 'Sales representatives, account managers, and sales directors approving discounts.',
    },
    prerequisites: [
      {
        th: 'มีข้อมูลผู้มุ่งหวัง/ลูกค้า และรายการสินค้าหรือบริการที่ต้องการเสนอราคา',
        en: 'Target customer record and catalog items or custom service scope.',
      },
    ],
    steps: [
      {
        title: { th: '1. สร้างใบเสนอราคาและกำหนดเงื่อนไขยืนราคา', en: '1. Draft Quotation & Validity Period' },
        detail: {
          th: 'เลือกลูกค้า ใส่รายการสินค้า ส่วนลด และหมายเหตุการชำระเงิน/รับประกัน กำหนดวันครบกำหนด (Valid Until)',
          en: 'Select the customer, line items, discounts, payment terms, and quote expiration date.',
        },
      },
      {
        title: { th: '2. ส่งอนุมัติภายใน (Approval Workflow) หากกำหนดสิทธิ์ไว้', en: '2. Internal Approval Workflow' },
        detail: {
          th: 'กด "ขออนุมัติ" เพื่อให้ผู้จัดการหรือ Admin กดอนุมัติ/ตีกลับก่อนส่งออกลูกค้า ช่วยควบคุมส่วนลดและอัตรากำไรขั้นต้น',
          en: 'Submit for internal approval so managers/admins can approve or reject margins before customer dispatch.',
        },
      },
      {
        title: { th: '3. แชร์ลิงก์ออนไลน์ (ตรวจสถานะเปิดอ่าน ViewedAt) แล้วแปลงเอกสาร', en: '3. Share Customer Link (Viewed Tracking) & Convert' },
        detail: {
          th: 'คัดลอก Public Link ส่ง LINE/Email ให้ลูกค้า (ระบบบันทึกเวลาที่ลูกค้าเปิดอ่านจริง) เมื่อลูกค้าตกลง กดแปลงเป็นใบส่งของหรือใบกำกับภาษีได้ทันที',
          en: 'Send the Public Share Link (tracks customer ViewedAt timestamp). Once accepted, convert straight into Delivery Note, Tax Invoice, or Receipt.',
        },
      },
    ],
    journalScenarios: [
      {
        condition: {
          th: 'ณ วันที่ออกใบเสนอราคา',
          en: 'Upon creating or issuing a Quotation',
        },
        lines: [
          {
            side: 'Dr',
            accountCode: '-',
            accountName: { th: 'ไม่มีการลงบัญชีและไม่มีผลต่อสต็อก/ภาษี (เอกสารเชิงพาณิชย์)', en: 'Non-accounting document (zero GL, VAT, and inventory effect)' },
            amountRule: { th: '0.00', en: '0.00' },
          },
        ],
      },
    ],
    accountantTips: [
      {
        title: {
          th: 'ระบุอัตรา VAT และเงื่อนไขหัก ณ ที่จ่ายให้ชัดเจนตั้งแต่ใบเสนอราคา',
          en: 'Clarify VAT and WHT Expectations Early on Quotes',
        },
        detail: {
          th: 'ช่วยลดปัญหาลูกค้าเข้าใจผิดเรื่องราคารวม VAT หรือไม่รวม VAT และป้องกันฝ่ายขายตั้งราคาต่ำกว่า CostPrice ในเมนูสินค้า',
          en: 'Eliminates client disputes over VAT-exclusive vs inclusive pricing and helps prevent quoting below product CostPrice.',
        },
      },
    ],
    commonPitfalls: [
      {
        th: 'เข้าใจผิดว่าออกใบเสนอราคาแล้วระบบตัดจองสต็อก — ในระบบนี้ใบเสนอราคาไม่ตัดสต็อกจนกว่าจะแปลงเป็นใบส่งของหรือใบกำกับภาษี',
        en: 'Assuming Quotations reserve inventory — stock is unaffected until converted into a Delivery Note, Cash Bill, or Tax Invoice.',
      },
    ],
    relatedIds: ['delivery', 'taxinvoice', 'customers', 'products'],
    impactSummary: {
      stock: { th: 'ไม่มีผลต่อสต็อก', en: 'No stock impact' },
      vat: { th: 'ไม่มีผลต่อ VAT', en: 'No VAT impact' },
      wht: { th: 'ไม่มีผลต่อ WHT', en: 'No WHT impact' },
      journal: { th: 'ไม่ลงบัญชี (Non-posting)', en: 'No GL posting' },
    },
  },
  {
    id: 'taxinvoice',
    category: 'sales',
    route: '/documents/taxinvoice',
    iconName: 'FileCheck',
    menuName: {
      th: 'ใบกำกับภาษี / ใบแจ้งหนี้ (Tax Invoice)',
      en: 'Tax Invoices',
    },
    shortDesc: {
      th: 'หัวใจของระบบขายและภาษีมูลค่าเพิ่ม รองรับ e-Tax XML (388), PromptPay QR, แจ้งเตือนทวงหนี้, รายงานภาษีขาย Excel และออกใบลดหนี้/เพิ่มหนี้',
      en: 'Core VAT sales document supporting ETDA e-Tax XML (388), PromptPay QR, payment reminders, Output VAT Excel, and CN/DN issuance.',
    },
    whoShouldUse: {
      th: 'ฝ่ายบัญชีขาย (AR) ฝ่ายขาย และผู้ประกอบการจดทะเบียน VAT 7%',
      en: 'A/R accountants, billing specialists, and VAT-registered businesses.',
    },
    prerequisites: [
      {
        th: 'ข้อมูลลูกค้าต้องมีชื่อจดทะเบียน ที่อยู่ และเลขประจำตัวผู้เสียภาษี 13 หลัก + รหัสสาขา (เช่น 00000) เพื่อความถูกต้องของใบกำกับภาษีเต็มรูป',
        en: 'Customer profile must have legal name, address, 13-digit Tax ID, and branch code (e.g., 00000) for full Tax Invoice compliance.',
      },
    ],
    steps: [
      {
        title: { th: '1. สร้างใบกำกับภาษี (หรือแปลงจากใบส่งของ/ใบเสนอราคา)', en: '1. Create or Convert to Tax Invoice' },
        detail: {
          th: 'ระบุวันที่เอกสาร วันครบกำหนดชำระ เลือกรูปแบบภาษี (Exclude/Include/Exempt VAT) และอัตรา WHT ที่ลูกค้าจะหักเมื่อจ่าย หากต้องการวางบิลอัตโนมัติทุกเดือนสามารถตั้งค่า Recurring Template ได้ในหน้าฟอร์ม',
          en: 'Set issue & due dates, VAT mode, expected WHT rate, and optional Recurring Schedule right in the invoice form.',
        },
      },
      {
        title: { th: '2. ออกเอกสาร ส่งลิงก์ชำระเงิน PromptPay / ดาวน์โหลด e-Tax XML', en: '2. Issue, Collect via PromptPay / Export e-Tax XML (388)' },
        detail: {
          th: 'กดออกเอกสารเพื่อสร้าง JV ตั้งลูกหนี้และภาษีขาย จากนั้นส่ง Public Link ที่มี QR PromptPay / Omise ให้ลูกค้าจ่าย หรือกด Export e-Tax XML (รหัส 388 ตามมาตรฐาน ETDA)',
          en: 'Issuing posts A/R and Output VAT journals. Share the payment portal link (PromptPay/Omise) or export ETDA UN/CEFACT XML (type 388).',
        },
      },
      {
        title: { th: '3. รับชำระเงิน ส่งทวงหนี้ หรือออกใบลดหนี้/เพิ่มหนี้', en: '3. Record Payment, Send Reminders, or Issue CN/DN' },
        detail: {
          th: 'เมื่อเงินเข้า กดบันทึกชำระ (หรือให้ Omise Webhook / Bank Reconciliation ปิดให้อัตโนมัติ) หากบิลเกินกำหนดกดปุ่ม "ส่งแจ้งเตือน 1 คลิก" และหากมีการปรับราคาหลังออกบิล ใช้ปุ่ม "สร้าง CN / DN" จากบิลต้นทางได้เลย',
          en: 'Mark paid manually or via Omise webhook / Bank Reconciliation, trigger 1-click overdue reminders, or issue linked Credit/Debit Notes.',
        },
      },
      {
        title: { th: '4. ส่งออกรายงานภาษีขาย Excel ประจำเดือน', en: '4. Export Monthly Output Tax Excel' },
        detail: {
          th: 'เลือกเดือน/ปี บนแถบด้านบนแล้วกดส่งออก "รายงานภาษีขาย (Excel)" ระบบจะสรุปใบกำกับภาษี (+) ใบเพิ่มหนี้ (+) ใบลดหนี้ (-) และแสดงใบที่ยกเลิกเป็นยอด 0.00 พร้อมหมายเหตุ "ยกเลิก" ครบตามเกณฑ์สรรพากร',
          en: 'Select Month/Year and export TaxReport_YYYY_MM.xlsx — includes TaxInvoices (+), DebitNotes (+), CreditNotes (-), and zeroed Cancelled rows marked "ยกเลิก".',
        },
      },
    ],
    journalScenarios: [
      {
        condition: {
          th: 'เมื่อออกใบกำกับภาษีขายเชื่อ (สถานะ Issued)',
          en: 'Upon issuing an unpaid Credit Tax Invoice (Issued)',
        },
        lines: [
          {
            side: 'Dr',
            accountCode: '1130',
            accountName: { th: 'ลูกหนี้การค้า', en: 'Accounts Receivable' },
            amountRule: { th: 'GrandTotal', en: 'GrandTotal' },
          },
          {
            side: 'Cr',
            accountCode: '4100',
            accountName: { th: 'รายได้จากการขายและบริการ', en: 'Sales & Service Revenue' },
            amountRule: { th: 'TotalBeforeVat', en: 'TotalBeforeVat' },
          },
          {
            side: 'Cr',
            accountCode: '2130',
            accountName: { th: 'ภาษีขาย', en: 'Output VAT' },
            amountRule: { th: 'VatAmount', en: 'VatAmount' },
          },
        ],
      },
      {
        condition: {
          th: 'เมื่อลูกค้าชำระเงินค่าใบกำกับภาษี (รวมกรณีถูกหัก ณ ที่จ่าย)',
          en: 'When payment is recorded on the Tax Invoice (with optional WHT)',
        },
        lines: [
          {
            side: 'Dr',
            accountCode: '1110',
            accountName: { th: 'เงินสดและเงินฝากธนาคาร', en: 'Cash & Bank' },
            amountRule: { th: 'GrandTotal - WhtAmount', en: 'GrandTotal - WhtAmount' },
          },
          {
            side: 'Dr',
            accountCode: '1140',
            accountName: { th: 'ภาษีเงินได้ถูกหัก ณ ที่จ่าย (ถ้ามี)', en: 'WHT Deducted Asset (if any)' },
            amountRule: { th: 'WhtAmount', en: 'WhtAmount' },
          },
          {
            side: 'Cr',
            accountCode: '1130',
            accountName: { th: 'ลูกหนี้การค้า', en: 'Accounts Receivable' },
            amountRule: { th: 'GrandTotal', en: 'GrandTotal' },
          },
        ],
      },
    ],
    accountantTips: [
      {
        title: {
          th: 'ใบกำกับภาษีที่ยกเลิก (Void/Cancel) ห้ามลบเลขรันทิ้งเด็ดขาด',
          en: 'Never Delete Voided Tax Invoice Numbers — Keep Audit Trail in Tax Report',
        },
        detail: {
          th: 'ตามกฎหมาย VAT ไทย ต้องเก็บต้นฉบับ/สำเนาใบกำกับภาษีที่ยกเลิกไว้และแสดงเลขที่เอกสารนั้นในรายงานภาษีขายด้วยยอด 0.00 และหมายเหตุ "ยกเลิก" ซึ่งระบบทำให้อัตโนมัติ พร้อมสร้างรายการ Reversal JV ย้อนกลับในสมุดบัญชีให้ทันที',
          en: 'Thai VAT law requires listing cancelled Tax Invoice numbers with 0.00 amount and "ยกเลิก" remark in the Output VAT Report. The system automatically handles this plus Reversal JVs.',
        },
      },
      {
        title: {
          th: 'เช็คมูลค่าในรายงานภาษีขาย vs งบทดลองบัญชี 2130 ทุกสิ้นเดือน',
          en: 'Reconcile Output VAT Excel Total Against Account 2130 Monthly',
        },
        detail: {
          th: 'ยอดรวมภาษีขายในไฟล์ TaxReport_YYYY_MM.xlsx ต้องตรงกับยอดเคลื่อนไหวสุทธิฝั่งเครดิตของบัญชี 2130 (ภาษีขาย) ในเดือนเดียวกัน',
          en: 'Total VAT in TaxReport_YYYY_MM.xlsx should tie out to net movements in Ledger Account 2130 for that month.',
        },
      },
    ],
    commonPitfalls: [
      {
        th: 'กดยกเลิกใบกำกับภาษีหลังยื่นแบบ ภ.พ.30 เดือนนั้นไปแล้ว — หากข้ามเดือนและส่งใบกำกับภาษีให้ลูกค้าไปแล้ว ควรออก "ใบลดหนี้ (CN)" แทนการยกเลิกบิลเดิม',
        en: 'Cancelling an invoice after P.P.30 filing instead of issuing a Credit Note (CN) when the buyer has already accepted the original Tax Invoice.',
      },
      {
        th: 'เลขผู้เสียภาษีหรือรหัสสาขาลูกค้าว่าง ทำให้ส่งออก e-Tax XML แล้วระบบคู่ค้าหรือ ETDA ไม่ผ่านการตรวจ Schema',
        en: 'Blank customer Tax ID or branch code causes ETDA e-Tax XML schema validation rejection.',
      },
    ],
    relatedIds: ['creditnote', 'debitnote', 'receipt', 'bank-reconciliation', 'accounting'],
    impactSummary: {
      stock: { th: 'ตัดสต็อก (ยกเว้นแปลงจาก DN)', en: 'Deducts stock (unless from DN)' },
      vat: { th: 'เพิ่มภาษีขาย (+) และเข้า TaxReport Excel', en: 'Output VAT (+) & Monthly Report' },
      wht: { th: 'บันทึกถูกหัก (1140) เมื่อรับชำระ', en: 'Posts WHT Asset (1140) on payment' },
      journal: { th: 'Dr. 1130 / Cr. 4100 + 2130 (และกลับรายการเมื่อยกเลิก)', en: 'Dr. 1130 / Cr. 4100 + 2130 (+ Reversal)' },
    },
  },
  {
    id: 'creditnote',
    category: 'sales',
    route: '/documents/creditnote',
    iconName: 'FileMinus2',
    menuName: {
      th: 'ใบลดหนี้ (Credit Note / CN)',
      en: 'Credit Notes (CN)',
    },
    shortDesc: {
      th: 'ลดมูลค่าสินค้า/บริการหรือภาษีขายจากใบกำกับภาษีเดิมตามมาตรา 82/10 พร้อมปรับปรุง ภ.พ.30 และ e-Tax XML รหัส 381',
      en: 'Reduce invoiced sales value and Output VAT under Section 82/10, adjusting P.P.30 and supporting e-Tax XML code 381.',
    },
    whoShouldUse: {
      th: 'ฝ่ายบัญชีขาย (AR) และฝ่ายบริการลูกค้าเมื่อมีการคืนสินค้า ลดราคา หรือออกบิลเกินราคา',
      en: 'A/R accountants handling returns, rebates, defective allowances, or overbilling corrections.',
    },
    prerequisites: [
      {
        th: 'ต้องมีใบกำกับภาษีต้นทางที่ออกไปแล้ว (Reference Document) เพื่ออ้างอิงเลขที่เดิมตามกฎหมายสรรพากร',
        en: 'An already-issued original Tax Invoice to reference per Thai Revenue Code Section 86/10.',
      },
    ],
    steps: [
      {
        title: { th: '1. กดออกใบลดหนี้จากใบกำกับภาษีเดิม หรือจากเมนูใบลดหนี้', en: '1. Issue CN from Original Tax Invoice or CN Menu' },
        detail: {
          th: 'แนะนำให้กดปุ่มสร้าง CN จากแถวใบกำกับภาษีต้นทาง เพื่อให้ระบบดึงข้อมูลลูกค้า รายการ และเลขที่อ้างอิงใบกำกับภาษีเดิมโดยอัตโนมัติ',
          en: 'Best practice: launch Create CN directly from the source Tax Invoice row so customer, line items, and original reference link automatically.',
        },
      },
      {
        title: { th: '2. ระบุเหตุผลตามกฎหมายและปรับยอดเฉพาะส่วนที่ลดลง', en: '2. Enter Legal Reason & Adjusted Differential Amount' },
        detail: {
          th: 'ระบุเฉพาะ "ส่วนต่างที่ลดลง" (ไม่ใช่ยอดเต็มหลังหักหากเป็นการลดราคาบางส่วน) และเขียนเหตุผลการลดหนี้ในหมายเหตุให้ชัดเจน',
          en: 'Specify only the reduction delta (not the remaining balance for partial discounts) and record clear Section 82/10 justification.',
        },
      },
      {
        title: { th: '3. ตรวจสอบสต็อกสินค้า (กรณีรับคืนสินค้าจริง)', en: '3. Verify Inventory Return (If Physical Return)' },
        detail: {
          th: 'เนื่องจากระบบออกแบบให้ CN รองรับทั้งการลดราคา (Price Adjustment) จึง **ไม่บวกสต็อกคืนอัตโนมัติ** หากมีการรับสินค้าคืนเข้าคลังจริง ให้ไปปรับเพิ่มสต็อกในเมนู "คลังสินค้า" (Stock Adjustment)',
          en: 'Because price-discount CNs do not return goods, CNs do not auto-restock inventory. For physical returns, perform a Stock Adjustment in Warehouses.',
        },
      },
    ],
    journalScenarios: [
      {
        condition: {
          th: 'เมื่อออกใบลดหนี้ (กลับรายการรายได้และภาษีขาย)',
          en: 'Upon issuing a Credit Note',
        },
        lines: [
          {
            side: 'Dr',
            accountCode: '4100',
            accountName: { th: 'รายได้จากการขายและบริการ (ลดยอดขาย)', en: 'Sales & Service Revenue (reduced)' },
            amountRule: { th: 'TotalBeforeVat', en: 'Pre-VAT Reduction' },
          },
          {
            side: 'Dr',
            accountCode: '2130',
            accountName: { th: 'ภาษีขาย (ลดภาษีขาย)', en: 'Output VAT (reduced)' },
            amountRule: { th: 'VatAmount', en: 'VAT Reduction' },
          },
          {
            side: 'Cr',
            accountCode: '1130',
            accountName: { th: 'ลูกหนี้การค้า (หรือ 1110 เงินสดหากคืนเงินแล้ว)', en: 'Accounts Receivable (or 1110 Cash if refunded)' },
            amountRule: { th: 'GrandTotal', en: 'GrandTotal' },
          },
        ],
      },
    ],
    accountantTips: [
      {
        title: {
          th: 'เหตุผลออกใบลดหนี้ที่สรรพากรยอมรับ (ม.82/10)',
          en: 'Revenue Code Section 82/10 Valid CN Grounds',
        },
        detail: {
          th: 'ใช้ได้เฉพาะเหตุ: ลดราคาสินค้าที่ผิดข้อกำหนด, สินค้าชำรุดเสียหาย/ขาดจำนวน, คำนวณราคาผิดพลาดสูงเกินจริง, รับคืนสินค้า หรือเลิกสัญญาบริการ (ต้องระบุเหตุและเลขใบกำกับภาษีเดิมในเอกสารเสมอ)',
          en: 'Valid only for post-sale price reductions, defective/short-shipped goods, overcalculation errors, physical returns, or terminated service contracts.',
        },
      },
      {
        title: {
          th: 'ยื่นใบลดหนี้เข้าแบบ ภ.พ.30 ของเดือนที่ออกใบลดหนี้',
          en: 'Include CN in Output VAT of the Month CN Is Issued',
        },
        detail: {
          th: 'รายงานภาษีขาย Excel ของระบบจะแสดงยอดใบลดหนี้เป็นค่าติดลบ (-) เพื่อลดภาษีขายสุทธิในเดือนที่ออก CN โดยอัตโนมัติ',
          en: 'Monthly TaxReport Excel automatically includes Credit Notes as negative amounts reducing Output VAT in the CN issue month.',
        },
      },
    ],
    commonPitfalls: [
      {
        th: 'ลืมปรับสต็อกเข้าคลังในเมนู Warehouses เมื่อลูกค้าส่งสินค้าคืนพร้อมออกใบลดหนี้',
        en: 'Forgetting to record a manual Warehouses restock adjustment when a Credit Note accompanies an actual physical return.',
      },
    ],
    relatedIds: ['taxinvoice', 'debitnote', 'warehouses', 'accounting'],
    impactSummary: {
      stock: { th: 'ไม่แก้สต็อกอัตโนมัติ (ปรับมือที่ Warehouses ถ้ารับของคืน)', en: 'No auto stock change (manual adjust on return)' },
      vat: { th: 'ลดภาษีขาย (-) ในเดือนที่ออก CN', en: 'Output VAT (-) in CN issue month' },
      wht: { th: 'ปรับยอดลดหนี้ตามมูลค่าเอกสาร', en: 'Adjusts receivable balance' },
      journal: { th: 'Dr. 4100 + 2130 / Cr. 1130 (หรือ 1110)', en: 'Dr. 4100 + 2130 / Cr. 1130 (or 1110)' },
    },
  },
  {
    id: 'debitnote',
    category: 'sales',
    route: '/documents/debitnote',
    iconName: 'FilePlus2',
    menuName: {
      th: 'ใบเพิ่มหนี้ (Debit Note / DB)',
      en: 'Debit Notes (DB)',
    },
    shortDesc: {
      th: 'เรียกเก็บส่วนต่างเพิ่มจากใบกำกับภาษีเดิมกรณีคิดราคาต่ำเกินจริงหรือส่งสินค้าเกินจำนวน รองรับ e-Tax XML รหัส 383',
      en: 'Bill incremental value onto a prior Tax Invoice for underbilling or over-shipment, with e-Tax XML code 383.',
    },
    whoShouldUse: {
      th: 'ฝ่ายบัญชีขาย (AR) และผู้จัดการฝ่ายขาย',
      en: 'A/R accountants and billing managers issuing post-invoice surcharges.',
    },
    prerequisites: [
      {
        th: 'มีใบกำกับภาษีต้นทางที่ออกไปแล้วและต้องการเรียกเก็บมูลค่าส่วนเพิ่ม',
        en: 'An existing issued Tax Invoice requiring an upward price or quantity adjustment.',
      },
    ],
    steps: [
      {
        title: { th: '1. กดสร้างใบเพิ่มหนี้ (แนะนำอ้างอิงจากใบกำกับภาษีเดิม)', en: '1. Create Debit Note Linked to Original Tax Invoice' },
        detail: {
          th: 'เลือกสร้างใบเพิ่มหนี้ ใส่เฉพาะ "มูลค่าส่วนที่เพิ่มขึ้น" และระบุเลขที่ใบกำกับภาษีอ้างอิงพร้อมสาเหตุตามมาตรา 82/9',
          en: 'Enter only the incremental price/quantity increase plus original Tax Invoice reference and Section 82/9 reason.',
        },
      },
      {
        title: { th: '2. ออกเอกสารและส่งออก e-Tax XML (รหัส 383)', en: '2. Issue & Export ETDA e-Tax XML (Type 383)' },
        detail: {
          th: 'เมื่อออกเอกสาร ระบบจะเพิ่มลูกหนี้การค้า 1130 และเพิ่มภาษีขาย 2130 รวมถึงนำไปบวกเพิ่มในรายงานภาษีขายประจำเดือนให้อัตโนมัติ',
          en: 'Issuing increases A/R (1130) and Output VAT (2130) and adds the positive delta to monthly Output VAT Excel.',
        },
      },
    ],
    journalScenarios: [
      {
        condition: {
          th: 'เมื่อออกใบเพิ่มหนี้ (เพิ่มมูลค่าลูกหนี้และภาษีขาย)',
          en: 'Upon issuing a Debit Note',
        },
        lines: [
          {
            side: 'Dr',
            accountCode: '1130',
            accountName: { th: 'ลูกหนี้การค้า (หรือ 1110 หากรับเงินทันที)', en: 'Accounts Receivable (or 1110 Cash)' },
            amountRule: { th: 'GrandTotal (ส่วนเพิ่ม)', en: 'Incremental GrandTotal' },
          },
          {
            side: 'Cr',
            accountCode: '4100',
            accountName: { th: 'รายได้จากการขายและบริการ', en: 'Sales & Service Revenue' },
            amountRule: { th: 'TotalBeforeVat', en: 'Incremental Pre-VAT' },
          },
          {
            side: 'Cr',
            accountCode: '2130',
            accountName: { th: 'ภาษีขาย', en: 'Output VAT' },
            amountRule: { th: 'VatAmount', en: 'Incremental VAT' },
          },
        ],
      },
    ],
    accountantTips: [
      {
        title: {
          th: 'ใส่เฉพาะส่วนต่างที่เพิ่มขึ้น ห้ามใส่ยอดเต็มรวมบิลเก่า',
          en: 'Enter Only the Upward Delta — Never Repeat the Full Original Invoice',
        },
        detail: {
          th: 'มิฉะนั้นระบบจะคิดรายได้และภาษีขายซ้ำซ้อนกับใบกำกับภาษีเดิม ทำให้ยอดขายในงบและ ภ.พ.30 สูงเกินจริง',
          en: 'Repeating the original amount would double-count revenue and Output VAT in both GL and P.P.30.',
        },
      },
    ],
    commonPitfalls: [
      {
        th: 'ใช้ใบเพิ่มหนี้เก็บค่าใช้จ่ายที่ไม่เกี่ยวข้องกับใบกำกับภาษีเดิมเลย — กรณีเป็นงานใหม่ควรออกใบกำกับภาษีใบใหม่ ไม่ใช่ใบเพิ่มหนี้',
        en: 'Using a Debit Note for unrelated new work instead of issuing a new Tax Invoice.',
      },
    ],
    relatedIds: ['taxinvoice', 'creditnote', 'accounting'],
    impactSummary: {
      stock: { th: 'ไม่ตัดสต็อกอัตโนมัติ', en: 'No auto stock impact' },
      vat: { th: 'เพิ่มภาษีขาย (+) ในเดือนที่ออก DB', en: 'Output VAT (+) in DB issue month' },
      wht: { th: 'เพิ่มยอดรับชำระส่วนเพิ่ม', en: 'Adds incremental receivable' },
      journal: { th: 'Dr. 1130 / Cr. 4100 + 2130', en: 'Dr. 1130 / Cr. 4100 + 2130' },
    },
  },
  {
    id: 'expenses',
    category: 'purchasing',
    route: '/expenses',
    iconName: 'Wallet',
    menuName: {
      th: 'ค่าใช้จ่าย, ภาษีซื้อ & หัก ณ ที่จ่าย (50 ทวิ)',
      en: 'Expenses, Input VAT & 50 Tawi WHT',
    },
    shortDesc: {
      th: 'บันทึกค่าใช้จ่าย แยกภาษีซื้อขอคืนได้/ต้องห้าม หัก ณ ที่จ่าย ภ.ง.ด.3/53 พิมพ์หนังสือรับรอง 50 ทวิ และลงบัญชี 5100/5200/1170/2140 อัตโนมัติ',
      en: 'Record vendor bills, separate refundable vs non-refundable Input VAT, deduct P.N.D.3/53 WHT, print 50 Tawi PDFs, and auto-post GL.',
    },
    whoShouldUse: {
      th: 'ฝ่ายบัญชีจ่าย (AP) เจ้าหน้าที่การเงิน และฝ่ายจัดซื้อ',
      en: 'A/P accountants, finance officers, and procurement teams.',
    },
    prerequisites: [
      {
        th: 'มีใบกำกับภาษีซื้อตัวจริง/e-Tax หรือใบเสร็จรับเงินจากผู้ขาย พร้อมเลขประจำตัวผู้เสียภาษี 13 หลักหากต้องหัก ณ ที่จ่าย',
        en: 'Source vendor tax invoice / receipt and 13-digit vendor Tax ID whenever WHT applies.',
      },
    ],
    steps: [
      {
        title: { th: '1. เพิ่มรายจ่าย & เลือกหมวดหมู่บัญชี (CostOfGoods vs Operating)', en: '1. Create Expense & Pick Accounting Category' },
        detail: {
          th: 'เลือกหมวด "ซื้อสินค้า/ต้นทุนขาย (CostOfGoods)" เพื่อลงบัญชี 5100 หรือหมวดค่าใช้จ่ายดำเนินงาน (เช่น ค่าเช่า ค่าบริการ เงินเดือน สาธารณูปโภค) เพื่อลงบัญชี 5200 และแนบสลิป/รูปบิลได้ทันที',
          en: 'Choose CostOfGoods (maps to 5100) or operating categories (maps to 5200), enter vendor details, and upload supporting invoice images.',
        },
      },
      {
        title: { th: '2. ตั้งค่าภาษีซื้อ 7% และติ๊ก "ขอคืนภาษีซื้อได้ (Refundable VAT)"', en: '2. Configure VAT 7% & Refundable Input VAT Flag' },
        detail: {
          th: 'หากมีใบกำกับภาษีซื้อถูกต้องตามมาตรา 86/4 ให้ติ๊กขอคืน VAT เพื่อให้ระบบนำไปลงบัญชี 1170 และลดยอด ภ.พ.30 แต่ถ้าเป็น "ภาษีซื้อต้องห้าม" (เช่น ค่ารับรอง รถยนต์นั่งไม่เกิน 10 ที่นั่ง) ให้นำเครื่องหมายออก ระบบจะนำ VAT ไปรวมเป็นค่าใช้จ่ายใน 5100/5200 อัตโนมัติ',
          en: 'Check "Refundable VAT" only for valid Section 86/4 tax invoices (posts to 1170). Uncheck for non-refundable VAT (entertainment, passenger vehicles <=10 seats) so VAT capitalizes directly into 5100/5200.',
        },
      },
      {
        title: { th: '3. คำนวณภาษีหัก ณ ที่จ่าย (ภ.ง.ด.3 / ภ.ง.ด.53) และพิมพ์ 50 ทวิ', en: '3. Deduct P.N.D.3 / P.N.D.53 WHT & Print 50 Tawi PDF' },
        detail: {
          th: 'เลือกประเภทผู้ถูกหัก (ภ.ง.ด.3 บุคคลธรรมดา หรือ ภ.ง.ด.53 นิติบุคคล) และอัตราหัก (0, 1, 1.5, 2, 3, 5, 10, 15%) โดยระบบบังคับใส่เลขผู้เสียภาษีผู้ขาย 13 หลักเมื่อ WHT > 0 จากนั้นกดพิมพ์ PDF หนังสือรับรอง 50 ทวิ จากแถวรายการได้เลย',
          en: 'Select PND3 (individual) or PND53 (corporate) and rate (0–15%). A 13-digit vendor Tax ID is strictly validated when WHT > 0. Print 50 Tawi PDFs directly from each row.',
        },
      },
      {
        title: { th: '4. คุมสถานะ Draft -> Approved -> Paid (และกลับรายการเมื่อแก้ไข/ยกเลิก)', en: '4. Manage Draft -> Approved -> Paid Lifecycle' },
        detail: {
          th: 'สถานะ Draft ยังไม่ลงบัญชี; Approved ตั้งเจ้าหนี้ 2110; Paid ตัดจ่ายเงิน 1110 หากแก้ไขตัวเลขหรือยกเลิกในภายหลัง ระบบจะกลับรายการ JV เดิม (Reversal) และลงยอดใหม่ให้อัตโนมัติ เว้นแต่งวดบัญชีเดือนนั้นถูกล็อกแล้ว',
          en: 'Draft does not post; Approved credits A/P (2110); Paid credits Cash (1110). Editing or cancelling auto-reverses prior JVs unless the period is locked.',
        },
      },
    ],
    journalScenarios: [
      {
        condition: {
          th: 'ค่าใช้จ่ายขอคืน VAT ได้ + หัก ณ ที่จ่าย + สถานะอนุมัติรอจ่าย (Approved)',
          en: 'Expense with Refundable VAT + WHT (Status: Approved / Awaiting Payment)',
        },
        lines: [
          {
            side: 'Dr',
            accountCode: '5100 / 5200',
            accountName: { th: 'ต้นทุนขาย (5100) หรือ ค่าใช้จ่ายดำเนินงาน (5200)', en: 'COGS (5100) or Operating Expense (5200)' },
            amountRule: { th: 'TotalBeforeVat', en: 'Pre-VAT Amount' },
          },
          {
            side: 'Dr',
            accountCode: '1170',
            accountName: { th: 'ภาษีซื้อ', en: 'Input VAT' },
            amountRule: { th: 'VatAmount', en: 'VatAmount' },
          },
          {
            side: 'Cr',
            accountCode: '2140',
            accountName: { th: 'ภาษีหัก ณ ที่จ่ายค้างจ่าย (ภ.ง.ด.3/53)', en: 'WHT Payable (P.N.D.3/53)' },
            amountRule: { th: 'WhtAmount', en: 'WhtAmount' },
          },
          {
            side: 'Cr',
            accountCode: '2110',
            accountName: { th: 'เจ้าหนี้การค้า', en: 'Accounts Payable' },
            amountRule: { th: 'GrandTotal - WhtAmount', en: 'Net Payable (GrandTotal - WhtAmount)' },
          },
        ],
      },
      {
        condition: {
          th: 'ค่าใช้จ่ายภาษีซื้อต้องห้าม (ไม่ขอคืน VAT) + จ่ายเงินแล้ว (Paid)',
          en: 'Non-Refundable VAT Expense (Status: Paid)',
        },
        lines: [
          {
            side: 'Dr',
            accountCode: '5200',
            accountName: { th: 'ค่าใช้จ่ายดำเนินงาน (รวม VAT เข้าเป็นต้นทุน)', en: 'Operating Expense (VAT capitalized into cost)' },
            amountRule: { th: 'GrandTotal (TotalBeforeVat + VatAmount)', en: 'GrandTotal (incl. non-refundable VAT)' },
          },
          {
            side: 'Cr',
            accountCode: '2140',
            accountName: { th: 'ภาษีหัก ณ ที่จ่ายค้างจ่าย (ถ้ามี)', en: 'WHT Payable (if WHT > 0)' },
            amountRule: { th: 'WhtAmount', en: 'WhtAmount' },
          },
          {
            side: 'Cr',
            accountCode: '1110',
            accountName: { th: 'เงินสดและเงินฝากธนาคาร', en: 'Cash & Bank' },
            amountRule: { th: 'GrandTotal - WhtAmount', en: 'Net Paid' },
          },
        ],
      },
    ],
    accountantTips: [
      {
        title: {
          th: 'เช็คลิสต์อัตราหัก ณ ที่จ่ายที่พบบ่อยใน SME ไทย',
          en: 'Quick Thai WHT Rate Reference Table',
        },
        detail: {
          th: '1% = ค่าขนส่ง (ไม่ใช่ขนส่งสาธารณะ) / ประกันวินาศภัย | 2% = ค่าโฆษณา | 3% = ค่าจ้างทำของ ค่าบริการ ค่าซ่อม ค่าที่ปรึกษา ค่าวิชาชีพ | 5% = ค่าเช่าอสังหาริมทรัพย์ รางวัลส่วนลดส่งเสริมการขาย',
          en: '1% Freight/Non-life Insurance | 2% Advertising | 3% Services, Contractors, Repairs, Professional Fees | 5% Property Rent, Promotional Prizes.',
        },
      },
      {
        title: {
          th: 'อายุความการใช้สิทธิภาษีซื้อ (6 เดือน)',
          en: '6-Month Claim Window for Input VAT',
        },
        detail: {
          th: 'ใบกำกับภาษีซื้อสามารถนำไปใช้เครดิตภาษีซื้อในแบบ ภ.พ.30 ย้อนหลังได้ไม่เกิน 6 เดือนนับจากเดือนที่ระบุในใบกำกับภาษี โดยใส่วันที่เอกสาร/วันที่ยื่นภาษีให้ถูกงวด',
          en: 'Valid Input VAT tax invoices may be claimed up to 6 months from their issue month if unused previously.',
        },
      },
    ],
    commonPitfalls: [
      {
        th: 'ติ๊ก "ขอคืนภาษีซื้อได้" ให้บิลค่ารับรอง (เช่น เลี้ยงรับรองลูกค้า) หรือค่าน้ำมัน/ซ่อมรถยนต์นั่งไม่เกิน 10 ที่นั่ง — ซึ่งผิดกฎหมายต้องห้ามขอคืนและอาจถูกเบี้ยปรับเงินเพิ่มจากสรรพากร',
        en: 'Marking client entertainment or <=10-seat passenger car bills as Refundable VAT — disallowed under Thai VAT law.',
      },
      {
        th: 'ใส่เลข Tax ID ผู้ขายผิดหรือไม่ครบ 13 หลัก ทำให้ระบบไม่ยอมบันทึกเมื่อมี WHT > 0',
        en: 'Omitting a valid 13-digit Tax ID triggers validation errors when saving expenses with WHT > 0.',
      },
    ],
    relatedIds: ['purchase-orders', 'accounting', 'bank-reconciliation', 'dashboard'],
    impactSummary: {
      stock: { th: 'ไม่แก้สต็อก (ใช้ PO Receive เพื่อรับสต็อก)', en: 'No stock change (use PO Receive)' },
      vat: { th: 'ลง 1170 ถ้าขอคืนได้; รวมเข้า 5200 ถ้าต้องห้าม', en: '1170 if refundable; else cost in 5100/5200' },
      wht: { th: 'ตั้ง 2140 (ภ.ง.ด.3/53) + พิมพ์ 50 ทวิ', en: 'Posts 2140 + Generates 50 Tawi PDF' },
      journal: { th: 'Dr. 5100/5200 + 1170 / Cr. 2140 + 2110|1110', en: 'Dr. 5100/5200 + 1170 / Cr. 2140 + 2110|1110' },
    },
  },
  {
    id: 'purchase-orders',
    category: 'purchasing',
    route: '/purchase-orders',
    iconName: 'ShoppingBag',
    menuName: {
      th: 'ใบสั่งซื้อ (PO) & ทะเบียนผู้จำหน่าย (Vendors)',
      en: 'Purchase Orders & Vendors',
    },
    shortDesc: {
      th: 'บริหารฐานข้อมูลผู้ขาย ออกใบสั่งซื้อ รับสินค้าเข้าคลังแบบทยอยรับหรือรับครบ พร้อมสร้างค่าใช้จ่ายต้นทุนขาย (5100) อัตโนมัติ',
      en: 'Manage Vendors (default WHT/PND), issue POs, receive partial/full stock into warehouses, and auto-create COGS expenses.',
    },
    whoShouldUse: {
      th: 'ฝ่ายจัดซื้อ พนักงานคลังสินค้ารับของ และฝ่ายบัญชีต้นทุน',
      en: 'Procurement officers, receiving warehouse staff, and cost accountants.',
    },
    prerequisites: [
      {
        th: 'สร้างรายการสินค้าใน "สินค้า" และกำหนดคลังรับสินค้าใน "คลังสินค้า"',
        en: 'Products created in Catalog and target receiving warehouse configured.',
      },
    ],
    steps: [
      {
        title: { th: '1. เพิ่มผู้จำหน่าย (Vendor) พร้อมตั้งค่าเริ่มต้น WHT & ภ.ง.ด.', en: '1. Register Vendor with Default WHT & PND Type' },
        detail: {
          th: 'สลับไปแท็บ "ผู้จำหน่าย (Vendors)" กรอกชื่อ Tax ID 13 หลัก ประเภทบุคคล/นิติบุคคล (PND3/PND53) และอัตราหัก ณ ที่จ่ายประจำ เพื่อให้ระบบดึงมาใช้อัตโนมัติ',
          en: 'Switch to Vendors tab, enter Tax ID, PND3/PND53 type, and default WHT rate for automated PO-to-Expense handoffs.',
        },
      },
      {
        title: { th: '2. สร้างใบสั่งซื้อ (Draft -> Sent) และระบุคลังปลายทาง', en: '2. Create & Send Purchase Order (PO)' },
        detail: {
          th: 'เลือก Vendor รายการสินค้า ต้นทุนต่อหน่วย และคลังที่จะรับของ เมื่อส่งคำสั่งให้ผู้ขายให้เปลี่ยนสถานะเป็น "สั่งซื้อแล้ว (Sent)"',
          en: 'Select vendor, items, unit purchase cost, and destination warehouse; mark PO as Sent once confirmed.',
        },
      },
      {
        title: { th: '3. กดรับสินค้า (Partial หรือ Full Receive)', en: '3. Receive Goods (Partial or Full Receive)' },
        detail: {
          th: 'เมื่อของมาส่ง กด "รับสินค้า" ระบุจำนวนที่รับจริงและเลือกคลัง ระบบจะบันทึก Stock Movement (PurchaseIn) เพิ่มยอดคงเหลือทันที และเมื่อรับครบ 100% (Received) ระบบสามารถสร้างรายการค่าใช้จ่าย (CostOfGoods -> 5100) ให้อัตโนมัติ',
          en: 'Click Receive, enter actual delivered quantities to post PurchaseIn stock movements, and upon full receipt (Received) automatically generate a CostOfGoods Expense (5100).',
        },
      },
    ],
    journalScenarios: [
      {
        condition: {
          th: 'เมื่อรับสินค้าจาก PO ครบและระบบสร้าง ExpenseRecord (CostOfGoods)',
          en: 'On Full PO Receipt generating CostOfGoods Expense',
        },
        lines: [
          {
            side: 'Dr',
            accountCode: '5100',
            accountName: { th: 'ต้นทุนขาย / ซื้อสินค้า', en: 'Cost of Goods Sold / Purchases' },
            amountRule: { th: 'ยอดซื้อก่อน VAT', en: 'Pre-VAT PO Amount' },
          },
          {
            side: 'Dr',
            accountCode: '1170',
            accountName: { th: 'ภาษีซื้อ (กรณีใบกำกับภาษีซื้อถูกต้อง)', en: 'Input VAT (if refundable)' },
            amountRule: { th: 'VatAmount', en: 'VatAmount' },
          },
          {
            side: 'Cr',
            accountCode: '2140',
            accountName: { th: 'ภาษีหัก ณ ที่จ่ายค้างจ่าย (ตาม Vendor Default)', en: 'WHT Payable (if Vendor WHT > 0)' },
            amountRule: { th: 'WhtAmount', en: 'WhtAmount' },
          },
          {
            side: 'Cr',
            accountCode: '2110',
            accountName: { th: 'เจ้าหนี้การค้า', en: 'Accounts Payable' },
            amountRule: { th: 'ยอดสุทธิรอจ่าย', en: 'Net Payable' },
          },
        ],
      },
    ],
    accountantTips: [
      {
        title: {
          th: 'การเชื่อมโยงต้นทุนซื้อจริง (PO Cost) เข้าสู่รายงานกำไรขั้นต้น (Sales Margin)',
          en: 'PO Average Purchase Cost Automatically Powers Gross Margin Fallback',
        },
        detail: {
          th: 'หากสินค้าใดยังไม่ได้กรอกราคาทุนคงที่ (CostPrice) ในหน้าสินค้า รายงานวิเคราะห์กำไรขั้นต้นในหน้าบัญชีจะคำนวณต้นทุนเฉลี่ยจากการรับของใบสั่งซื้อ (Received POs) มาใช้อัตโนมัติ',
          en: 'When a product lacks a fixed CostPrice, the Sales Margin report automatically falls back to average unit cost from Received POs.',
        },
      },
    ],
    commonPitfalls: [
      {
        th: 'รับ PO ครบจนระบบสร้างค่าใช้จ่ายอัตโนมัติให้แล้ว แต่พนักงานบัญชีไปคีย์บิลซื้อใบเดียวกันซ้ำในเมนู "ค่าใช้จ่าย" ทำให้ตั้งเจ้าหนี้ 2110 และต้นทุน 5100 เบิ้ล',
        en: 'Manually re-entering a vendor bill in Expenses after full PO receipt already auto-created the CostOfGoods ExpenseRecord.',
      },
    ],
    relatedIds: ['expenses', 'warehouses', 'products', 'accounting'],
    impactSummary: {
      stock: { th: 'เพิ่มสต็อกเข้าคลังเมื่อรับของ (PurchaseIn)', en: 'Adds warehouse stock on Receive (PurchaseIn)' },
      vat: { th: 'ส่งต่อ VAT ไปยัง Expense อัตโนมัติเมื่อรับครบ', en: 'Flows to Expense Input VAT upon full receive' },
      wht: { th: 'ดึง Default WHT/PND จาก Vendor', en: 'Inherits Vendor default WHT/PND' },
      journal: { th: 'ลง Dr. 5100 + 1170 / Cr. 2110 เมื่อรับครบ', en: 'Dr. 5100 + 1170 / Cr. 2110 on full receive' },
    },
  },
  {
    id: 'accounting',
    category: 'accounting',
    route: '/accounting',
    iconName: 'BookOpen',
    menuName: {
      th: 'บัญชีอัตโนมัติ, งบการเงิน & ปิดงวด',
      en: 'Auto Accounting, Financial Reports & Period Lock',
    },
    shortDesc: {
      th: 'สมุดรายวันทั่วไป (JV + Reversal), Manual JV, งบทดลอง, งบกำไรขาดทุน, งบดุล, งบกระแสเงินสด, วิเคราะห์กำไรขั้นต้น, Export งบ Excel และปิดงวด MM/YYYY',
      en: 'Automated & Manual Journals, Trial Balance, P&L, Balance Sheet, Direct Cash Flow, Sales Margin, 2-Sheet Excel Export, and Period Lock.',
    },
    whoShouldUse: {
      th: 'นักบัญชี ผู้ทำบัญชี (CPD/CPA) ผู้ตรวจสอบบัญชี และผู้บริหาร',
      en: 'Accountants, CPAs/auditors, finance controllers, and company admins.',
    },
    prerequisites: [
      {
        th: 'มีเอกสารขาย ค่าใช้จ่าย หรือรายการ Manual JV ที่บันทึกแล้ว',
        en: 'Posted sales, expense, payment, or manual journal transactions.',
      },
    ],
    steps: [
      {
        title: { th: '1. แท็บสมุดรายวัน (Journals) & บันทึกรายการเอง (Manual JV)', en: '1. Journal Entries & Balanced Manual JV' },
        detail: {
          th: 'ดูรหัส JV อัตโนมัติ (JV-YYYYMM-XXXX) พร้อมลิงก์ที่มาเอกสาร สำหรับรายการที่ไม่ได้เกิดจากเอกสารขาย/ซื้อ (เช่น ค่าเสื่อมราคา ค่าใช้จ่ายค้างจ่าย ปิดบัญชีภาษีซื้อ-ขาย) กด "+ บันทึกสมุดรายวัน" โดยยอดเดบิตต้องเท่ากับเครดิตเสมอ',
          en: 'Inspect auto-generated JV-YYYYMM-XXXX entries and reversals. Use Manual JV for depreciation, accruals, or VAT clearing (Debits must equal Credits).',
        },
      },
      {
        title: { th: '2. ตรวจสอบงบการเงินทั้ง 5 รายงาน + Export งบ Excel', en: '2. Review All 5 Financial Statements & Excel Export' },
        detail: {
          th: 'ไล่ตรวจ: (1) งบทดลอง (Trial Balance) | (2) งบกำไรขาดทุน (P&L) | (3) งบดุล (Balance Sheet พร้อมป้ายเช็คความสมดุล) | (4) งบกระแสเงินสดทางตรง (Cash Flow 1110) | (5) รายงานกำไรขั้นต้นรายสินค้า/พนักงาน (Sales Margin) และ Export เป็นไฟล์ Excel 2 แผ่นงานได้ทันที',
          en: 'Audit Trial Balance, Income Statement (P&L), Balance Sheet (with Balanced badge check), Direct Cash Flow (Account 1110), and Sales Margin by Product/Staff, or export the 2-sheet Financial Statements Excel.',
        },
      },
      {
        title: { th: '3. จัดการผังบัญชี (Chart of Accounts)', en: '3. Customize Chart of Accounts' },
        detail: {
          th: 'บัญชีระบบ 12 รหัสหลัก (1110–5200) ถูกล็อกป้องกันการลบ แต่คุณสามารถสร้างรหัสบัญชีย่อยเพิ่มเติม (Custom Accounts) เพื่อใช้ในการลงบัญชี Manual JV ได้อย่างอิสระ',
          en: 'Core system accounts (1110–5200) are protected while custom sub-accounts can be added for granular Manual JV reporting.',
        },
      },
      {
        title: { th: '4. ปิดงวดบัญชีรายเดือน (Period Lock — เฉพาะ Admin)', en: '4. Close Monthly Accounting Period (Admin Only)' },
        detail: {
          th: 'ในแท็บ "ปิดงวดบัญชี (Periods)" กดปิดงวดเดือนที่ยื่นภาษีและตรวจสอบงบครบแล้ว (เช่น 10/2026) ระบบจะป้องกันไม่ให้ทุกคนสร้าง แก้ไข ยกเลิก หรือจับคู่ธนาคารในเดือนนั้นจนกว่า Admin จะปลดล็อกพร้อมบันทึกเหตุผลลง Audit Log',
          en: 'In the Periods tab, lock completed MM/YYYY months to block creating, editing, cancelling, or bank matching in that period. Unlocking is restricted to Admins with mandatory Audit Log reason.',
        },
      },
    ],
    journalScenarios: [
      {
        condition: {
          th: 'ตัวอย่าง Manual JV: ปิดบัญชีภาษีขาย (2130) กับภาษีซื้อ (1170) ณ สิ้นเดือนเพื่อตั้ง ภ.พ.30 ค้างจ่าย',
          en: 'Manual JV Example: Month-End VAT Clearing (2130 Output VAT vs 1170 Input VAT)',
        },
        lines: [
          {
            side: 'Dr',
            accountCode: '2130',
            accountName: { th: 'ภาษีขาย (ล้างยอดขายประจำเดือน)', en: 'Output VAT (cleared for month)' },
            amountRule: { th: 'ยอดคงเหลือเครดิต 2130', en: 'Monthly 2130 Balance' },
          },
          {
            side: 'Cr',
            accountCode: '1170',
            accountName: { th: 'ภาษีซื้อ (ล้างยอดซื้อประจำเดือน)', en: 'Input VAT (cleared for month)' },
            amountRule: { th: 'ยอดคงเหลือเดบิต 1170', en: 'Monthly 1170 Balance' },
          },
          {
            side: 'Cr',
            accountCode: '1110 / Custom',
            accountName: { th: 'เงินฝาก (เมื่อจ่าย ภ.พ.30) หรือ บัญชีภาษีมูลค่าเพิ่มค้างจ่าย', en: 'Bank (upon payment) or VAT Payable Custom Account' },
            amountRule: { th: 'ผลต่าง ภ.พ.30 ที่ต้องชำระ', en: 'Net P.P.30 Difference' },
          },
        ],
      },
    ],
    accountantTips: [
      {
        title: {
          th: 'ตรวจสมการงบดุล: สินทรัพย์ = หนี้สิน + ทุน + กำไรสุทธิ',
          en: 'Always Confirm the Balance Sheet Equilibrium Badge',
        },
        detail: {
          th: 'ในแท็บ Balance Sheet จะมีป้ายแสดงสถานะ "สมดุล (Balanced)" เพราะระบบรวมกำไรสุทธิสะสม (Net Income) จาก P&L เข้าไว้ในส่วนของเจ้าของโดยอัตโนมัติก่อนปิดงบสิ้นปี',
          en: 'The Balance Sheet tab calculates Net Income dynamically into Equity so the Balanced indicator verifies double-entry integrity year-round.',
        },
      },
      {
        title: {
          th: 'ป้อนบันทึกปรับปรุงสิ้นงวด (Accruals & Depreciation) ด้วย Manual JV',
          en: 'Record Depreciation, Prepaid & Accruals via Manual JV',
        },
        detail: {
          th: 'เนื่องจากค่าน้ำ/ค่าไฟเดือนธันวาคมอาจได้รับบิลในเดือนมกราคม นักบัญชีควรลง Manual JV ตั้งค่าใช้จ่ายค้างจ่ายในเดือนธันวาคมเพื่อให้ต้นทุนตรงงวดตามเกณฑ์คงค้าง (Accrual Basis)',
          en: 'For expenses consumed in Month N whose bill arrives in Month N+1, accrue them via Manual JV in Month N to uphold matching principles.',
        },
      },
    ],
    commonPitfalls: [
      {
        th: 'เปิดงวดบัญชีทิ้งไว้ตลอดปีโดยไม่ล็อกงวด ทำให้พนักงานเผลอแก้ไขวันที่หรือยกเลิกบิลของเดือนที่ยื่น ภ.พ.30 ไปแล้ว',
        en: 'Leaving past periods unlocked allows accidental edits or cancellations in months already filed to the Revenue Department.',
      },
    ],
    relatedIds: ['bank-reconciliation', 'taxinvoice', 'expenses', 'audit-logs'],
    impactSummary: {
      stock: { th: 'อ่านต้นทุนขายใน Sales Margin', en: 'Reads COGS for Sales Margin report' },
      vat: { th: 'รองรับ Manual JV ปิดบัญชี 2130 / 1170', en: 'Supports manual VAT clearing JVs' },
      wht: { th: 'แสดงยอดคงเหลือ 1140 และ 2140 ในงบทดลอง/งบดุล', en: 'Reports 1140 & 2140 balances in TB/BS' },
      journal: { th: 'ศูนย์รวม JV อัตโนมัติ, Reversal และ Manual JV', en: 'Central GL Ledger (Auto, Reversal, Manual)' },
    },
  },
  {
    id: 'bank-reconciliation',
    category: 'accounting',
    route: '/bank-reconciliation',
    iconName: 'Landmark',
    menuName: {
      th: 'กระทบยอดธนาคาร (Bank Reconciliation)',
      en: 'Bank Reconciliation',
    },
    shortDesc: {
      th: 'นำเข้า Statement ธนาคาร (CSV/Excel) จับคู่ยอดรับเงินสุทธิ (GrandTotal - WHT) อัตโนมัติ ปิดบิลค้างรับ และลงบัญชี 1110 พร้อมกัน',
      en: 'Import bank CSV statements, auto-match net receivables (GrandTotal - WHT), settle open invoices, and post 1110 cash entries automatically.',
    },
    whoShouldUse: {
      th: 'ฝ่ายการเงินและนักบัญชีที่ตรวจเช็คยอดเงินเดินบัญชี (Bank Statement) ประจำวัน/ประจำเดือน',
      en: 'Finance officers and accountants reconciling daily or monthly bank statements.',
    },
    prerequisites: [
      {
        th: 'ดาวน์โหลดไฟล์ Bank Statement (.csv) จากระบบ Internet Banking (เช่น KBank, SCB, BBL, KTB)',
        en: 'Export a CSV Bank Statement file from your corporate banking portal.',
      },
      {
        th: 'งวดบัญชีของวันที่ทำรายการใน Statement ต้องยังไม่ถูกล็อก',
        en: 'The target transaction month must be unlocked in Accounting Periods.',
      },
    ],
    steps: [
      {
        title: { th: '1. นำเข้าไฟล์ Statement (CSV/Excel) พร้อม Auto-Mapping คอลัมน์', en: '1. Import Bank Statement (Auto Column Mapping)' },
        detail: {
          th: 'เลือกไฟล์ Statement ระบบจะอ่านหัวคอลัมน์วันที่ รายละเอียด ยอดฝาก (Deposit) ยอดถอน (Withdrawal) และรหัสอ้างอิงให้โดยอัตโนมัติ',
          en: 'Upload your bank CSV; auto-mapping detects Date, Description, Deposit, Withdrawal, and Reference columns.',
        },
      },
      {
        title: { th: '2. กด "จับคู่อัตโนมัติ (Auto-Reconcile)" และตรวจรายการ Suggested', en: '2. Run Auto-Reconcile & Review Suggestions' },
        detail: {
          th: 'ระบบจะนำยอดเงินเข้าธนาคารไปเทียบกับยอดรับสุทธิ (Net Receivable = ยอดรวมบิล - ยอดหัก ณ ที่จ่าย) หรือเลขที่อ้างอิงของใบกำกับภาษีที่ค้างชำระ แล้วจัดกลุ่ม Suggested / Unmatched / Matched / Ignored',
          en: 'Auto-Reconcile compares bank deposits against unpaid invoices net receivable (GrandTotal - WhtAmount) and references, grouping items into Suggested, Unmatched, Matched, or Ignored.',
        },
      },
      {
        title: { th: '3. ยืนยันจับคู่ (Match) หรือกดข้าม (Ignore) รายการไม่เกี่ยวข้อง', en: '3. Confirm Match or Ignore Non-Invoice Rows' },
        detail: {
          th: 'เมื่อกดยืนยัน Match ระบบจะสร้าง Payment Record ปิดสถานะบิลเป็น Paid และลงบัญชี Dr. 1110 เงินฝาก + Dr. 1140 ถูกหัก ณ ที่จ่าย / Cr. 1130 ลูกหนี้การค้า ให้อัตโนมัติทันที ส่วนค่าธรรมเนียมธนาคารสามารถเลือก Ignore แล้วไปลง Manual JV (5200) ได้',
          en: 'Confirming a match settles the invoice to Paid and posts Dr. 1110 + Dr. 1140 / Cr. 1130 automatically. Bank charges can be marked Ignored and posted via Manual JV.',
        },
      },
    ],
    journalScenarios: [
      {
        condition: {
          th: 'เมื่อยืนยัน Match เงินโอนเข้าจาก Statement กับใบกำกับภาษีค้างชำระ',
          en: 'Upon confirming a Bank Statement Match against an open Tax Invoice',
        },
        lines: [
          {
            side: 'Dr',
            accountCode: '1110',
            accountName: { th: 'เงินสดและเงินฝากธนาคาร', en: 'Cash & Bank' },
            amountRule: { th: 'ยอดเงินเข้าจริงใน Statement (GrandTotal - Wht)', en: 'Statement Deposit (GrandTotal - Wht)' },
          },
          {
            side: 'Dr',
            accountCode: '1140',
            accountName: { th: 'ภาษีเงินได้ถูกหัก ณ ที่จ่าย (ถ้ามี)', en: 'WHT Deducted Asset (if any)' },
            amountRule: { th: 'WhtAmount จากใบกำกับภาษี', en: 'Invoice WhtAmount' },
          },
          {
            side: 'Cr',
            accountCode: '1130',
            accountName: { th: 'ลูกหนี้การค้า', en: 'Accounts Receivable' },
            amountRule: { th: 'GrandTotal', en: 'GrandTotal' },
          },
        ],
      },
    ],
    accountantTips: [
      {
        title: {
          th: 'เข้าใจเหตุผลที่ยอดเงินเข้าไม่เท่ากับยอด GrandTotal ในบิล',
          en: 'Why Bank Deposits Differ from Invoice GrandTotal',
        },
        detail: {
          th: 'กรณีลูกค้าจ่ายช้ากว่ายอดหน้าบิล มักเกิดจาก 2 สาเหตุ: (1) ลูกค้าหักภาษี ณ ที่จ่าย 1%–5% ซึ่งระบบคำนวณ Net Receivable = GrandTotal - WhtAmount รอให้แล้ว หรือ (2) ลูกค้ารวมจ่ายหลายบิลพร้อมกัน ให้ใช้ Manual Match เพื่อตรวจจับคู่ทีละใบ',
          en: 'Short-pays usually reflect either WHT deduction (handled natively via Net Receivable) or batched multi-invoice transfers.',
        },
      },
    ],
    commonPitfalls: [
      {
        th: 'กดบันทึก "รับชำระเงิน" ในหน้าใบกำกับภาษีไปแล้ว แล้วยังมาจับคู่ซ้ำในหน้า Statement จนอาจสับสนหาบิลไม่เจอ (บิลที่จ่ายแล้วจะไม่อยู่ในคิวค้างรับ)',
        en: 'Manually marking an invoice Paid removes it from the open-invoice pool before Bank Reconciliation runs.',
      },
    ],
    relatedIds: ['taxinvoice', 'accounting', 'dashboard'],
    impactSummary: {
      stock: { th: 'ไม่แก้สต็อก', en: 'No stock impact' },
      vat: { th: 'ไม่กระทบภาษีขาย', en: 'No VAT impact' },
      wht: { th: 'ลง Dr. 1140 อัตโนมัติตามบิลที่จับคู่', en: 'Posts WHT Asset 1140 on matched invoice' },
      journal: { th: 'Dr. 1110 + 1140 / Cr. 1130 อัตโนมัติ', en: 'Auto posts Dr. 1110 + 1140 / Cr. 1130' },
    },
  },
  {
    id: 'customers',
    category: 'masters',
    route: '/customers',
    iconName: 'Users',
    menuName: {
      th: 'ทะเบียนลูกค้า (Customers)',
      en: 'Customer Management',
    },
    shortDesc: {
      th: 'จัดการข้อมูลลูกค้า นิติบุคคล/บุคคลธรรมดา ตรวจความถูกต้อง Tax ID 13 หลัก รหัสสาขา เครดิตเทอม และประวัติการซื้อ',
      en: 'Manage customer profiles, validate 13-digit Thai Tax IDs & branch codes, track credit terms, and view full purchase history.',
    },
    whoShouldUse: {
      th: 'ฝ่ายขาย ฝ่ายบัญชีลูกหนี้ และแอดมินที่เปิดหน้าบัญชีลูกค้าใหม่',
      en: 'Sales coordinators, A/R staff, and customer onboarding teams.',
    },
    prerequisites: [
      {
        th: 'ภ.พ.20 หรือหนังสือรับรองบริษัทของลูกค้า (สำหรับลูกค้าองค์กรที่ขอใบกำกับภาษีเต็มรูป)',
        en: 'Customer P.P.20 / company registration details for full Tax Invoice billing.',
      },
    ],
    steps: [
      {
        title: { th: '1. เพิ่มลูกค้าใหม่ พร้อมตรวจสอบ Tax ID 13 หลักและรหัสสาขา', en: '1. Add Customer & Validate 13-Digit Tax ID + Branch' },
        detail: {
          th: 'ระบุชื่อบริษัท/ชื่อลูกค้า เลขประจำตัวผู้เสียภาษี 13 หลัก (ระบบมี Checksum Validation ป้องกันคีย์ผิด) และรหัสสาขา (00000 สำหรับสำนักงานใหญ่ หรือ 00001 ฯลฯ)',
          en: 'Enter legal name, 13-digit Tax ID (validated automatically), and 5-digit branch code (00000 for Head Office).',
        },
      },
      {
        title: { th: '2. ตรวจสอบประวัติการซื้อ (Purchase History) & ยอดสะสม', en: '2. Inspect Customer Purchase History' },
        detail: {
          th: 'กดดูรายละเอียดลูกค้าแต่ละรายเพื่อดูรายการเอกสารทั้งหมด ยอดซื้อสะสม และสถานะการชำระเงิน เพื่อช่วยประเมินเครดิตก่อนปล่อยบิลใหม่',
          en: 'Open the Purchase History modal on any customer to review past invoices, total spend, and unpaid status.',
        },
      },
      {
        title: { th: '3. ส่งออกฐานข้อมูลลูกค้า (Excel)', en: '3. Export Customer Directory' },
        detail: {
          th: 'ใช้ปุ่ม Export Excel เพื่อนำไปทำแคมเปญการตลาดหรือตรวจสอบความครบถ้วนของเลขผู้เสียภาษีทั้งพอร์ต',
          en: 'Export the customer database to Excel for Tax ID audits or CRM reviews.',
        },
      },
    ],
    journalScenarios: [],
    accountantTips: [
      {
        title: {
          th: 'กฎใบกำกับภาษีเต็มรูปมาตรา 86/4 เรื่องชื่อ-ที่อยู่-เลขผู้เสียภาษี',
          en: 'Section 86/4 Tax ID & Branch Code Requirement',
        },
        detail: {
          th: 'ใบกำกับภาษีแบบเต็มรูปต้องระบุคำว่า "สำนักงานใหญ่" หรือ "สาขาที่ ....." และเลขประจำตัวผู้เสียภาษี 13 หลักของผู้ซื้อ (กรณีผู้ซื้อเป็นผู้ประกอบการจดทะเบียน VAT) ให้ถูกต้องทุกตัวอักษร หากผิดพลาดลูกค้าจะนำไปขอคืนภาษีซื้อ (1170) ไม่ได้และต้องขอให้ออก CN/ออกใบใหม่ทดแทน',
          en: 'Incorrect Tax IDs or missing Head Office/Branch designations prevent VAT-registered buyers from claiming Input VAT.',
        },
      },
    ],
    commonPitfalls: [
      {
        th: 'สร้างลูกค้าบริษัทเดียวกันซ้ำหลายรายด้วยชื่อย่อต่างกัน ทำให้รายงาน Top Spenders และยอดลูกหนี้รายตัวกระจัดกระจาย',
        en: 'Creating duplicate customer records under slightly different spellings fragments A/R Aging and Top Spender metrics.',
      },
    ],
    relatedIds: ['taxinvoice', 'quotation', 'dashboard'],
    impactSummary: {
      stock: { th: 'ไม่มีผล', en: 'None' },
      vat: { th: 'เป็นข้อมูลหัวใบกำกับภาษี & e-Tax XML', en: 'Supplies buyer Tax ID/Branch for VAT & XML' },
      wht: { th: 'ใช้ระบุผู้หัก 50 ทวิเมื่อเราเป็นผู้ขาย', en: 'Identifies WHT-deducting customer' },
      journal: { th: 'ผูกกับรายการลูกหนี้ 1130 รายบุคคล', en: 'Sub-ledger entity for A/R 1130' },
    },
  },
  {
    id: 'products',
    category: 'masters',
    route: '/products',
    iconName: 'Package',
    menuName: {
      th: 'สินค้า, บริการ, ราคาทุน & บาร์โค้ด',
      en: 'Products, Services, Cost Price & Barcode',
    },
    shortDesc: {
      th: 'บริหารแคตตาล็อก แยก SKU กับ Barcode สำหรับสแกน POS ตั้งราคาทุน (CostPrice) และเลือกระหว่างสินค้านับสต็อกกับงานบริการ (ไม่ตัดสต็อก)',
      en: 'Manage product/service catalogs, separate SKU & Barcode for POS, track CostPrice for margins, and toggle Stock vs Non-Stock Service items.',
    },
    whoShouldUse: {
      th: 'ผู้ดูแลระบบสินค้า ฝ่ายจัดซื้อ ฝ่ายคลัง และฝ่ายบัญชีต้นทุน',
      en: 'Merchandising staff, inventory planners, and cost accountants.',
    },
    prerequisites: [
      {
        th: 'วางโครงสร้างรหัส SKU, รหัสบาร์โค้ดหน้าร้าน และจำแนกว่าสินค้าไหนต้องนับสต็อก vs งานบริการ',
        en: 'Define SKU naming conventions, POS barcode values, and stock-tracked vs service classification.',
      },
    ],
    steps: [
      {
        title: { th: '1. สร้างสินค้าและแยกช่อง SKU กับ Barcode ให้ชัดเจน', en: '1. Separate Internal SKU & POS Barcode' },
        detail: {
          th: 'ใส่รหัสภายในองค์กรในช่อง SKU และใส่รหัสบาร์โค้ดบนฉลากสินค้า (EAN-13 / Code128) ในช่อง Barcode เพื่อให้เครื่องสแกนหน้าร้านในฟอร์มบิลค้นหาเจอทันที',
          en: 'Keep internal stock codes in SKU and scanner-readable EAN/UPC strings in Barcode for POS InvoiceForm scanning.',
        },
      },
      {
        title: { th: '2. กำหนดโหมดนับสต็อก (Stock) vs สินค้าบริการ (Service / Null Stock)', en: '2. Choose Stock-Tracked vs Non-Stock Service' },
        detail: {
          th: 'หากเป็นบริการ ค่าขนส่ง ค่าแรง หรือสินค้าที่ซื้อมาขายไปไม่สต็อก ให้ตั้งค่าเป็นไม่ติดตามสต็อก (StockQuantity = null) ระบบจะยอมให้ออกบิลได้ตลอดโดยไม่ติด Error สต็อกไม่พอ',
          en: 'For consulting, shipping, or labor fees, disable stock tracking (null StockQuantity) so billing never blocks on zero stock.',
        },
      },
      {
        title: { th: '3. กรอกราคาทุนมาตรฐาน (CostPrice) เพื่อใช้วิเคราะห์กำไรขั้นต้น', en: '3. Maintain CostPrice for Sales Margin Analytics' },
        detail: {
          th: 'ป้อน CostPrice ให้ครบทุกตัวเพื่อให้รายงาน Gross Margin ในเมนูบัญชีคำนวณกำไรขั้นต้นได้แม่นยำ (หากเว้น 0 ระบบจะถอยไปดึงต้นทุนเฉลี่ยจากใบสั่งซื้อ PO แทน)',
          en: 'Enter CostPrice so the Sales Margin report calculates accurate gross profit (falling back to average Received PO cost if unset).',
        },
      },
    ],
    journalScenarios: [],
    accountantTips: [
      {
        title: {
          th: 'แยกสินค้าออกจากบริการเพื่อวางแผนภาษีหัก ณ ที่จ่าย',
          en: 'Distinguish Goods vs Services for WHT Compliance',
        },
        detail: {
          th: 'การขายสินค้า (โดยทั่วไปไม่ถูกหัก ณ ที่จ่าย เว้นแต่เข้าเงื่อนไขสั่งผลิต/จ้างทำของ) กับการให้บริการ (มักถูกหัก 3%) ควรตั้งรหัสแยกกันชัดเจนในแคตตาล็อก เพื่อความสะดวกในการออกใบแจ้งหนี้และคำนวณภาษีหัก ณ ที่จ่าย',
          en: 'Keep goods and service items separate so sales teams apply 0% WHT on standard goods sales and 3% on services consistently.',
        },
      },
    ],
    commonPitfalls: [
      {
        th: 'สร้างงานบริการ (เช่น ค่าติดตั้ง/ค่าส่ง) โดยเผลอเปิดนับสต็อกไว้ที่ 0 ชิ้น ทำให้พนักงานขายออกใบกำกับภาษีไม่ได้เพราะระบบแจ้ง "สต็อกไม่พอ"',
        en: 'Leaving a service fee tracked at 0 stock blocks invoicing with insufficient-stock errors.',
      },
    ],
    relatedIds: ['warehouses', 'cashbill', 'purchase-orders', 'accounting'],
    impactSummary: {
      stock: { th: 'กำหนดว่าตัด/ไม่ตัดสต็อก และซิงค์กับคลัง', en: 'Controls stock-tracked vs service mode' },
      vat: { th: 'ใช้ราคาขายเป็นฐานภาษีเมื่อออกเอกสาร', en: 'Supplies unit pricing for invoices' },
      wht: { th: 'แยกกลุ่มสินค้าและบริการช่วยกำหนด WHT', en: 'Helps classify goods vs WHT services' },
      journal: { th: 'CostPrice ใช้คำนวณ Margin ในเมนูบัญชี', en: 'Drives COGS / Margin analytics' },
    },
  },
  {
    id: 'warehouses',
    category: 'masters',
    route: '/warehouses',
    iconName: 'Warehouse',
    menuName: {
      th: 'คลังสินค้า & การเคลื่อนไหวสต็อก (Stock Card)',
      en: 'Warehouses & Stock Movements',
    },
    shortDesc: {
      th: 'จัดการหลายคลังสินค้า ดูสต็อกคงเหลือรายคลัง โอนย้ายสินค้าข้ามคลัง ปรับปรุงยอดสต็อก (Stock Adjust) และตรวจสอบ Stock Card ย้อนหลัง',
      en: 'Manage multiple warehouses, monitor per-warehouse balances, transfer stock across locations, adjust quantities, and audit Stock Card history.',
    },
    whoShouldUse: {
      th: 'หัวหน้าคลังสินค้า พนักงานคลัง และนักบัญชีตรวจนับสต็อก',
      en: 'Warehouse supervisors, inventory controllers, and stock-audit accountants.',
    },
    prerequisites: [
      {
        th: 'มีอย่างน้อย 1 คลังสินค้าหลัก (Main Warehouse) และสินค้าที่เปิดนับสต็อก',
        en: 'At least one active warehouse and stock-tracked products.',
      },
    ],
    steps: [
      {
        title: { th: '1. สร้าง/บริหารคลังสินค้าและตรวจแท็บคงเหลือ (Stocks)', en: '1. Configure Warehouses & Inspect Per-Warehouse Balances' },
        detail: {
          th: 'ดูจำนวนสินค้าคงเหลือแยกตามคลัง พร้อมแถบแจ้งเตือนสินค้าใกล้หมด (Low Stock) และต้นทุนประเมิน',
          en: 'Check balances per warehouse with low-stock warning indicators.',
        },
      },
      {
        title: { th: '2. โอนย้ายสินค้าข้ามคลัง (Transfer) & ปรับปรุงยอด (Adjust)', en: '2. Transfer Between Warehouses or Post Stock Adjustment' },
        detail: {
          th: 'ใช้ปุ่มโอนย้ายเพื่อลดยอดคลังต้นทาง (TransferOut) และเพิ่มคลังปลายทาง (TransferIn) แบบ Atomic Transaction หรือใช้ปุ่มปรับปรุงสต็อก (Adjustment) พร้อมระบุเหตุผลเมื่อตรวจนับสินค้าขาด/เกิน/ชำรุด/รับคืนจาก CN',
          en: 'Transfer stock atomically (TransferOut/TransferIn) or record audited Stock Adjustments for physical count variances, damage, or Credit Note physical returns.',
        },
      },
      {
        title: { th: '3. ตรวจสอบประวัติความเคลื่อนไหว (Stock Card / Movements)', en: '3. Audit Complete Stock Card Movements' },
        detail: {
          th: 'แท็บ "ความเคลื่อนไหว (Movements)" บันทึกทุกเหตุการณ์พร้อมเลขที่อ้างอิงเอกสาร: PurchaseIn, SaleOut, SaleRestock, TransferIn, TransferOut และ Adjustment',
          en: 'The Movements tab logs immutable history with reference numbers: PurchaseIn, SaleOut, SaleRestock, TransferIn, TransferOut, and Adjustment.',
        },
      },
    ],
    journalScenarios: [
      {
        condition: {
          th: 'ตัวอย่าง Manual JV กรณีตรวจนับพบสินค้าขาด/เสียหาย (Write-off)',
          en: 'Manual JV when physical stock count reveals damaged/missing inventory write-off',
        },
        lines: [
          {
            side: 'Dr',
            accountCode: '5100 / 5200',
            accountName: { th: 'ต้นทุนขาย / ผลขาดทุนจากสินค้าเสียหาย', en: 'COGS / Inventory Shrinkage Loss' },
            amountRule: { th: 'มูลค่าทุนสินค้าที่หาย/เสื่อมสภาพ', en: 'Cost Value of Adjusted Units' },
          },
          {
            side: 'Cr',
            accountCode: '1150',
            accountName: { th: 'สินค้าคงเหลือ', en: 'Inventory' },
            amountRule: { th: 'มูลค่าทุนสินค้าที่ปรับลด', en: 'Cost Value Reduced' },
          },
        ],
      },
    ],
    accountantTips: [
      {
        title: {
          th: 'ข้อควรระวังเรื่อง VAT เมื่อ "สินค้าขาดจากรายงานสินค้าและวัตถุดิบ"',
          en: 'Thai VAT Rule on Unexplained Stock Shortages',
        },
        detail: {
          th: 'ตามกฎหมายสรรพากร หากตรวจนับแล้วสินค้าคงเหลือ "ขาด" จากบัญชีคุมสต็อกโดยไม่มีหลักฐานการทำลายหรือแจ้งความสูญหายที่ถูกต้อง อาจถือเป็นการขายสินค้าต้องนำส่ง VAT ดังนั้นทุกครั้งที่ปรับลดสต็อก (Adjustment) ควรระบุหมายเหตุและเก็บเอกสารอนุมัติทำลาย/ตรวจนับไว้เสมอ',
          en: 'Unexplained inventory shortages during tax audits may be deemed taxable sales under Thai VAT law — always document physical count approvals or certified destruction reports on adjustments.',
        },
      },
    ],
    commonPitfalls: [
      {
        th: 'ปรับสต็อกแก้ไขโดยไม่ตรวจ Stock Card ก่อนว่ามีการยกเลิกใบกำกับภาษีหรือรับของ PO ซ้ำหรือไม่',
        en: 'Manually adjusting stock before checking Stock Card movements for uncancelled SaleOut or duplicate PurchaseIn events.',
      },
    ],
    relatedIds: ['products', 'delivery', 'purchase-orders', 'creditnote'],
    impactSummary: {
      stock: { th: 'ควบคุมปริมาณสต็อกรายคลังแบบ Real-time', en: 'Authoritative multi-warehouse ledger' },
      vat: { th: 'ระวังการปรับลดสต็อกต้องมีเอกสารอ้างอิงภาษี', en: 'Document write-offs for VAT audit safety' },
      wht: { th: 'ไม่มีผล', en: 'None' },
      journal: { th: 'ปรับมูลค่าบัญชี 1150 สิ้นงวดผ่าน Manual JV', en: 'Reconcile Account 1150 via Manual JV' },
    },
  },
  {
    id: 'settings',
    category: 'system',
    route: '/settings',
    iconName: 'Settings',
    menuName: {
      th: 'ตั้งค่าองค์กร, โลโก้, LINE, แจ้งเตือน, บิลประจำ & สำรองข้อมูล',
      en: 'Settings: Organization, Logo, LINE, VAPID, Recurring & Backup',
    },
    shortDesc: {
      th: 'ตั้งค่าข้อมูลบริษัทและเลขผู้เสียภาษี อัปโหลดโลโก้ เชื่อม LINE OA/Notify รับแจ้งเตือน PromptPay/VAPID ตั้งค่าบิลอัตโนมัติรายเดือน และ Backup ข้อมูล JSON',
      en: 'Configure company tax identity & logo, LINE OA/Notify & payment gateways, Web Push VAPID, Recurring Invoice automation, quotas, and JSON backups.',
    },
    whoShouldUse: {
      th: 'ผู้ดูแลระบบ (Admin) เจ้าของกิจการ และหัวหน้าฝ่ายบัญชี',
      en: 'Tenant Admins, business owners, and lead accountants.',
    },
    prerequisites: [
      {
        th: 'สิทธิ์ระดับ Admin หรือ Manager เพื่อแก้ไขข้อมูลองค์กรและการเชื่อมต่อภายนอก',
        en: 'Admin or Manager permission to modify tenant profile and integrations.',
      },
    ],
    steps: [
      {
        title: { th: '1. กรอกข้อมูลนิติบุคคล อัปโหลดโลโก้ และที่อยู่จดทะเบียน', en: '1. Set Legal Tax Identity, Logo & Registered Address' },
        detail: {
          th: 'กรอกชื่อบริษัท เลขประจำตัวผู้เสียภาษี 13 หลัก อีเมล เบอร์โทร ที่อยู่จดทะเบียน และอัปโหลดโลโก้ PNG/JPG/WEBP (สูงสุด 5 MB) เพื่อนำไปแสดงบนเอกสาร PDF/Print และ e-Tax',
          en: 'Fill registered company name, 13-digit Tax ID, contact info, address, and upload PNG/JPG/WEBP logo (up to 5 MB) used on PDFs & printouts.',
        },
      },
      {
        title: { th: '2. ตั้งค่าการเชื่อมต่อ LINE, การชำระเงิน & Push Notifications (VAPID)', en: '2. Connect LINE, Payment Alerts & Web Push (VAPID)' },
        detail: {
          th: 'ใส่ LINE Channel Token / Notify Token, คัดลอก Webhook URL, เปิดรับแจ้งเตือน Web Push เมื่อลูกค้าจ่าย PromptPay/บิลเกินกำหนด และสลับภาษา TH/EN',
          en: 'Configure LINE tokens, Webhook URL, enable browser Web Push (VAPID) for real-time payment & overdue notifications, and toggle language.',
        },
      },
      {
        title: { th: '3. จัดการเทมเพลตออกบิลอัตโนมัติ (Recurring) & ตรวจโควตาแพ็กเกจ', en: '3. Configure Recurring Invoices & Monitor Subscription Quota' },
        detail: {
          th: 'ดูหรือหยุดตารางออกบิลรายเดือนอัตโนมัติ (RecurringInvoiceWorker) ตรวจสอบโควตาจำนวนผู้ใช้/เอกสารต่อเดือน และดาวน์โหลดสำรองข้อมูลทั้งองค์กร (Tenant Backup JSON) เก็บไว้นอกระบบเป็นระยะ',
          en: 'Manage automated RecurringInvoiceWorker schedules, inspect monthly user/document quotas, and download full Tenant Backup JSON archives.',
        },
      },
    ],
    journalScenarios: [],
    accountantTips: [
      {
        title: {
          th: 'สำรองข้อมูล (Tenant Backup) ก่อนปิดบัญชีสิ้นปีหรือปรับปรุงฐานข้อมูลใหญ่',
          en: 'Export Full Tenant Backup Before Year-End Closing',
        },
        detail: {
          th: 'การ Export ไฟล์สำรองข้อมูลประจำเดือน/ประจำปีเก็บไว้ในไดรฟ์องค์กรช่วยเสริมความมั่นใจตามมาตรฐานการเก็บรักษาข้อมูลทางบัญชี (ไม่น้อยกว่า 5 ปีตาม พ.ร.บ.การบัญชี)',
          en: 'Regular JSON backups supplement statutory 5-year electronic accounting record retention under the Thai Accounting Act.',
        },
      },
    ],
    commonPitfalls: [
      {
        th: 'แก้ไขชื่อบริษัทหรือเลขประจำตัวผู้เสียภาษีระหว่างงวดโดยไม่แจ้งลูกค้า หรือตั้งเวลา Recurring Invoice ซ้ำซ้อนจนออกบิลเดือนละ 2 รอบ',
        en: 'Duplicate active Recurring templates for the same client contract cause double monthly billing.',
      },
    ],
    relatedIds: ['users', 'audit-logs', 'taxinvoice'],
    impactSummary: {
      stock: { th: 'ไม่มีผล', en: 'None' },
      vat: { th: 'กำหนดเลข Tax ID ผู้ออกเอกสารในระบบ & e-Tax', en: 'Supplies seller Tax ID for VAT docs & e-Tax' },
      wht: { th: 'ข้อมูลผู้หัก/ผู้ถูกหักบนหัว 50 ทวิ', en: 'Supplies company header on 50 Tawi PDF' },
      journal: { th: 'Recurring Worker สร้างบิลและลง JV อัตโนมัติตามกำหนด', en: 'Recurring invoices auto-post JV on schedule' },
    },
  },
  {
    id: 'users',
    category: 'system',
    route: '/users',
    iconName: 'ShieldCheck',
    menuName: {
      th: 'จัดการผู้ใช้งาน & สิทธิ์ (Users & RBAC)',
      en: 'Users & Role Permissions (RBAC)',
    },
    shortDesc: {
      th: 'สร้างบัญชีพนักงาน กำหนดบทบาทหน้าที่ (Admin, Manager, Accountant, Staff, Viewer) เปิด/ปิดสถานะใช้งาน และคุมโควตาผู้ใช้',
      en: 'Create staff logins, assign RBAC roles (Admin, Manager, Accountant, Staff, Viewer), activate/deactivate accounts within MaxUsers quota.',
    },
    whoShouldUse: {
      th: 'ผู้ดูแลระบบ (Admin / SystemAdmin) และหัวหน้าฝ่ายบัญชีที่แบ่งหน้าที่ผู้ทำและผู้ตรวจ',
      en: 'Company Admins and accounting supervisors enforcing segregation of duties.',
    },
    prerequisites: [
      {
        th: 'เข้าสู่ระบบด้วยสิทธิ์ Admin และมีโควตาผู้ใช้งานคงเหลือในแพ็กเกจ',
        en: 'Admin role access and available user seats within your subscription plan quota.',
      },
    ],
    steps: [
      {
        title: { th: '1. เพิ่มผู้ใช้งานใหม่และเลือกบทบาท (Role)', en: '1. Add User & Assign Appropriate Role' },
        detail: {
          th: 'กำหนด Username, ชื่อแสดงผล, อีเมล, รหัสผ่านเริ่มต้น และเลือก Role ที่เหมาะสมกับหน้าที่ เช่น พนักงานขาย (Staff), นักบัญชี (Accountant), ผู้จัดการ (Manager) หรือผู้ดูข้อมูลอย่างเดียว (Viewer)',
          en: 'Specify username, display name, email, initial password, and least-privilege role (Staff, Accountant, Manager, Viewer, or Admin).',
        },
      },
      {
        title: { th: '2. ตรวจสอบตารางสิทธิ์ (Roles & Permissions Matrix)', en: '2. Review Permissions Matrix' },
        detail: {
          th: 'สลับแท็บไปที่ "บทบาทและสิทธิ์" เพื่อดูขอบเขตการเข้าถึงของแต่ละ Role (เช่น มีเพียง Admin เท่านั้นที่ล็อก/ปลดล็อกงวดบัญชีและดู Audit Log ได้)',
          en: 'Switch to the Roles tab to inspect action-level privileges (e.g. only Admin can lock/unlock periods and inspect Audit Logs).',
        },
      },
      {
        title: { th: '3. ปิดการใช้งานพนักงานที่ลาออกทันที (Deactivate แทน Delete)', en: '3. Deactivate Departed Staff Immediately' },
        detail: {
          th: 'กดสลับสถานะเป็น Inactive เพื่อปิดกั้น Token การเข้าสู่ระบบ โดยยังเก็บประวัติผู้ออกเอกสารในอดีตและ Audit Log ไว้ครบถ้วน',
          en: 'Toggle status to Inactive instead of deleting so historical invoice issuer records and audit trails stay intact.',
        },
      },
    ],
    journalScenarios: [],
    accountantTips: [
      {
        title: {
          th: 'หลักการแบ่งแยกหน้าที่ (Segregation of Duties) ในงานบัญชี',
          en: 'Segregation of Duties Best Practice',
        },
        detail: {
          th: 'ไม่ควรให้พนักงานคนเดียวมีสิทธิ์ทั้งออกเอกสารขาย กดอนุมัติ ลดหนี้ ปิดงบ และปลดล็อกงวดบัญชี — ให้ฝ่ายขายใช้สิทธิ์ Staff (สร้างบิล/เสนอราคา) และให้หัวหน้าบัญชี/Admin เป็นผู้อนุมัติ ตรวจกระทบยอดธนาคาร และปิดงวดบัญชี',
          en: 'Separate creator (Staff) from approver/period-locker (Manager/Admin) to prevent unauthorized credit notes or retroactive deletions.',
        },
      },
    ],
    commonPitfalls: [
      {
        th: 'ใช้รหัสผ่านกลางร่วมกันทั้งออฟฟิศ — ทำให้ไม่สามารถตรวจสอบใน Audit Log ได้ว่าใครเป็นคนแก้หรือลบเอกสาร',
        en: 'Sharing a single Admin login across multiple employees destroys user accountability in Audit Logs.',
      },
    ],
    relatedIds: ['audit-logs', 'settings', 'profile'],
    impactSummary: {
      stock: { th: 'ควบคุมสิทธิ์ผู้ปรับปรุงสต็อก', en: 'Governs who can adjust stock' },
      vat: { th: 'จำกัดสิทธิ์ผู้ยกเลิก/แก้ไขใบกำกับภาษี', en: 'Restricts invoice voids & edits' },
      wht: { th: 'จำกัดสิทธิ์จัดการค่าใช้จ่ายและ 50 ทวิ', en: 'Controls expense & 50 Tawi creation' },
      journal: { th: 'มีเพียง Admin ล็อก/ปลดล็อกงวดบัญชีได้', en: 'Only Admin locks/unlocks GL periods' },
    },
  },
  {
    id: 'audit-logs',
    category: 'system',
    route: '/audit-logs',
    iconName: 'History',
    menuName: {
      th: 'ประวัติการใช้งานและตรวจสอบ (Audit Logs)',
      en: 'Audit Logs & Compliance Trail',
    },
    shortDesc: {
      th: 'บันทึกทุกการสร้าง แก้ไข ยกเลิก ล็อกงวดบัญชี และเปลี่ยนการตั้งค่าแบบแก้ไม่ได้ พร้อมดูค่าเก่า vs ค่าใหม่ (Diff View)',
      en: 'Immutable security & compliance log capturing Created/Updated/Deleted actions with before-and-after OldValues vs NewValues diffs.',
    },
    whoShouldUse: {
      th: 'ผู้ดูแลระบบ (Admin) เจ้าของกิจการ และผู้สอบบัญชี (CPA)',
      en: 'Admins, business owners, and external auditors (CPAs).',
    },
    prerequisites: [
      {
        th: 'เข้าสู่ระบบด้วยบัญชีที่มีสิทธิ์ Admin / SystemAdmin / SuperAdmin',
        en: 'Signed in with Admin-level permissions.',
      },
    ],
    steps: [
      {
        title: { th: '1. กรองค้นหาตามโมดูล การกระทำ และช่วงวันที่', en: '1. Filter by Entity, Action Type & Date Range' },
        detail: {
          th: 'กรองดูเหตุการณ์เฉพาะ เช่น Entity = TaxDocument / ExpenseRecord / AccountingPeriod หรือ Action = Deleted / Updated ในช่วงวันที่ที่ต้องการตรวจสอบ',
          en: 'Filter by Entity (e.g. Document, ExpenseRecord, AccountingPeriod), Action (Created/Updated/Deleted), search keyword, and dates.',
        },
      },
      {
        title: { th: '2. กดดูรายละเอียด Diff (ค่าเดิม -> ค่าใหม่)', en: '2. Inspect Before/After Diff (OldValues vs NewValues)' },
        detail: {
          th: 'คลิกที่แถวรายการเพื่อเทียบ JSON ค่าก่อนแก้กับหลังแก้ รวมถึงชื่อผู้ทำรายการ เวลา (UTC/Local) และ IP Address',
          en: 'Expand any row to inspect field-level OldValues vs NewValues JSON alongside actor name and timestamp.',
        },
      },
      {
        title: { th: '3. ส่งออกรายงานการตรวจสอบ (CSV/Export)', en: '3. Export Audit Trail for Auditors' },
        detail: {
          th: 'ดาวน์โหลดไฟล์ประวัติการใช้งานส่งมอบให้ผู้สอบบัญชีรับอนุญาตประกอบการตรวจสอบความถูกต้องของงบการเงิน',
          en: 'Export filtered audit logs when requested during statutory CPA financial audits.',
        },
      },
    ],
    journalScenarios: [],
    accountantTips: [
      {
        title: {
          th: 'ใช้ Audit Log ตรวจสอบเหตุการณ์ปลดล็อกงวดบัญชีและแก้ไขค่าใช้จ่าย',
          en: 'Monitor Period Unlock & High-Value Expense Edits',
        },
        detail: {
          th: 'ทุกครั้งที่มีการปลดล็อกงวดบัญชีที่ปิดไปแล้ว ระบบจะบันทึกผู้ทำรายการและเหตุผลไว้ใน Audit Log เสมอ ผู้บริหารควรตรวจเช็คเดือนละ 1 ครั้ง',
          en: 'Every accounting period unlock and backdated expense adjustment leaves a permanent OldValues/NewValues trace for management review.',
        },
      },
    ],
    commonPitfalls: [
      {
        th: 'ละเลยการตรวจ Audit Log เมื่อพบยอดงบทดลองหรือสต็อกเปลี่ยนแปลงผิดปกติ',
        en: 'Guessing who changed a document or stock level instead of filtering Audit Logs by entity and date.',
      },
    ],
    relatedIds: ['users', 'accounting', 'settings'],
    impactSummary: {
      stock: { th: 'เก็บประวัติการแก้ไขสินค้าและปรับสต็อก', en: 'Logs stock adjustments & product edits' },
      vat: { th: 'เก็บประวัติการยกเลิก/แก้เอกสารภาษี', en: 'Logs document issue, edit & void history' },
      wht: { th: 'เก็บประวัติแก้ไขค่าใช้จ่าย/WHT', en: 'Logs expense & WHT modifications' },
      journal: { th: 'บันทึกการล็อก/ปลดล็อกงวดและ Manual JV', en: 'Logs period locks & manual JVs' },
    },
  },
  {
    id: 'profile',
    category: 'system',
    route: '/profile',
    iconName: 'User',
    menuName: {
      th: 'โปรไฟล์ของฉัน, ค้นหาด่วน, พิมพ์ & พอร์ทัลลูกค้า',
      en: 'My Profile, Global Search, Print & Customer Portal',
    },
    shortDesc: {
      th: 'จัดการข้อมูลส่วนตัว เปลี่ยนรหัสผ่าน ใช้ค้นหาด่วนบนแถบหัว (Global Search) ผู้ช่วย AI และเข้าใจหน้าพิมพ์เอกสาร + หน้าลิงก์ลูกค้า',
      en: 'Update personal profile & password, master Header Global Search / AI Assistant, and understand Print View & Public Payment Links.',
    },
    whoShouldUse: {
      th: 'ผู้ใช้งานทุกคนในระบบ',
      en: 'Every signed-in user across the organization.',
    },
    prerequisites: [
      {
        th: 'เข้าสู่ระบบด้วยบัญชีผู้ใช้งานของตนเอง',
        en: 'Signed into your own user account.',
      },
    ],
    steps: [
      {
        title: { th: '1. จัดการข้อมูลส่วนตัวและเปลี่ยนรหัสผ่านที่เมนูโปรไฟล์', en: '1. Maintain Profile & Rotate Password' },
        detail: {
          th: 'คลิกชื่อมุมขวาบน -> "โปรไฟล์ของฉัน" เพื่ออัปเดตชื่อแสดงผล อีเมล และเปลี่ยนรหัสผ่านใหม่เป็นระยะเพื่อความปลอดภัยของข้อมูลการเงิน',
          en: 'Click your user badge -> My Profile to update display details and periodically rotate your password.',
        },
      },
      {
        title: { th: '2. ใช้ Global Search (แถบค้นหาด้านบน) & ผู้ช่วย AI', en: '2. Use Header Global Search & AI Assistant' },
        detail: {
          th: 'พิมพ์เลขที่เอกสาร ชื่อลูกค้า หรือสินค้าในช่องค้นหาบน Header เพื่อกระโดดไปเปิดหน้านั้นทันที พร้อมปุ่มเปลี่ยนภาษา (TH/EN) เปลี่ยนธีมสว่าง/มืด และกระดิ่งแจ้งเตือนแบบ Real-time',
          en: 'Search any document number, customer, or product directly from the Header bar, switch TH/EN, toggle Warm Horizon / Deep Ocean theme, or view real-time notifications.',
        },
      },
      {
        title: { th: '3. การพิมพ์เอกสาร A4 & หน้าพอร์ทัลสาธารณะของลูกค้า', en: '3. Document Print View & Customer Public Link' },
        detail: {
          th: 'หน้าพิมพ์เอกสารรองรับหัวเอกสารต้นฉบับ/สำเนา โลโก้บริษัท ลายเซ็นผู้รับ/ผู้มีอำนาจ และ QR PromptPay โดยเมื่อลูกค้าเปิดลิงก์ออนไลน์ระบบจะบันทึกสถานะ ViewedAt กลับมาแสดงในตารางเอกสารทันที',
          en: 'Print view renders company logos, tax details, signature blocks, and PromptPay QR; customer views on Public Links record live ViewedAt timestamps.',
        },
      },
    ],
    journalScenarios: [],
    accountantTips: [
      {
        title: {
          th: 'พิมพ์ "ต้นฉบับ" และ "สำเนา" อย่างน้อย 2 ชุดสำหรับใบกำกับภาษีกระดาษ',
          en: 'Maintain Clear Original vs. Copy Distinction on Printed Tax Invoices',
        },
        detail: {
          th: 'กรณีไม่ได้ส่ง e-Tax ให้ส่ง "ต้นฉบับ" ให้ผู้ซื้อและเก็บ "สำเนา" (พร้อมหลักฐานเซ็นรับ/สลิปโอนเงิน) ไว้ในแฟ้มบัญชีรายเดือนเรียงตามเลขที่เอกสาร JV และ TaxReport',
          en: 'Deliver the Original print to the buyer and archive the signed Copy alongside payment proof ordered sequentially with TaxReport.',
        },
      },
    ],
    commonPitfalls: [
      {
        th: 'นำ "สำเนา" ใบกำกับภาษีซื้อมาขอคืนภาษีมูลค่าเพิ่ม — สรรพากรกำหนดให้ใช้เฉพาะ "ต้นฉบับ" หรือเอกสารอิเล็กทรอนิกส์ e-Tax ที่ถูกต้องเท่านั้น',
        en: 'Attempting to claim Input VAT with a photocopy ("สำเนา") instead of the valid Original or signed e-Tax file.',
      },
    ],
    relatedIds: ['overview-accounting-cycle', 'settings', 'taxinvoice'],
    impactSummary: {
      stock: { th: 'ไม่มีผล', en: 'None' },
      vat: { th: 'แสดงองค์ประกอบครบตาม ม.86/4 ในหน้าพิมพ์', en: 'Renders full Section 86/4 tax fields in Print View' },
      wht: { th: 'รองรับการแจ้งเตือนและค้นหาเอกสารหักภาษี', en: 'Quick search across WHT/tax docs' },
      journal: { th: 'ไม่มีผลต่อสมุดบัญชี', en: 'No GL posting' },
    },
  },
];

export function localizeText(text: LocalizedText, lang: HelpLang): string {
  return lang === 'en' ? text.en : text.th;
}

export function normalizeHelpLang(language: string | undefined): HelpLang {
  return language?.toLowerCase().startsWith('en') ? 'en' : 'th';
}
