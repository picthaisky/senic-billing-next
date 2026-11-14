import React, { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BookOpen,
  Boxes,
  Calculator,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Compass,
  FileCheck,
  FileMinus2,
  FilePlus2,
  FileText,
  GraduationCap,
  HelpCircle,
  History,
  Landmark,
  LayoutDashboard,
  Lightbulb,
  Package,
  Percent,
  Receipt,
  RotateCcw,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Truck,
  User,
  Users,
  Wallet,
  Warehouse,
  X,
} from 'lucide-react';
import {
  DOCUMENT_IMPACT_MATRIX,
  MENU_HELP_GUIDES,
  MONTHLY_CLOSING_CHECKLIST,
  SYSTEM_CHART_OF_ACCOUNTS,
  THAI_TAX_CALENDAR,
  localizeText,
  normalizeHelpLang,
  type HelpCategory,
  type MenuHelpGuide,
} from './helpKnowledgeData';

const GUIDE_ICON_MAP: Record<MenuHelpGuide['iconName'], LucideIcon> = {
  Compass,
  LayoutDashboard,
  Receipt,
  Banknote,
  Truck,
  FileText,
  FileCheck,
  FileMinus2,
  FilePlus2,
  Wallet,
  ShoppingBag,
  BookOpen,
  Landmark,
  Users,
  Package,
  Warehouse,
  Settings,
  ShieldCheck,
  History,
  User,
};

function GuideIcon({
  name,
  size = 18,
  className = '',
}: {
  name: MenuHelpGuide['iconName'];
  size?: number;
  className?: string;
}) {
  const Icon = GUIDE_ICON_MAP[name] ?? HelpCircle;
  return <Icon size={size} className={className} />;
}

const CLOSING_STORAGE_KEY = 'senic_help_closing_checklist';

function loadCheckedClosingSteps(): number[] {
  try {
    const raw = localStorage.getItem(CLOSING_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

const CATEGORY_ORDER: HelpCategory[] = [
  'all',
  'cycle',
  'sales',
  'purchasing',
  'accounting',
  'masters',
  'system',
];

const ACCOUNT_TYPE_BADGE_STYLE: Record<string, string> = {
  Asset: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  Liability: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  Equity: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
  Revenue: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  Expense: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
};

const HelpPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const lang = normalizeHelpLang(i18n.language);

  const initialTab = searchParams.get('tab') === 'academy' ? 'academy' : 'guides';
  const [activeTab, setActiveTab] = useState<'guides' | 'academy'>(initialTab);
  const [selectedCategory, setSelectedCategory] = useState<HelpCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [checkedClosingSteps, setCheckedClosingSteps] = useState<number[]>(() =>
    loadCheckedClosingSteps(),
  );
  const detailRef = useRef<HTMLDivElement | null>(null);

  const requestedGuideId = searchParams.get('guide');

  const filteredGuides = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return MENU_HELP_GUIDES.filter((guide) => {
      if (selectedCategory !== 'all' && guide.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      const haystacks = [
        guide.menuName.th,
        guide.menuName.en,
        guide.shortDesc.th,
        guide.shortDesc.en,
        guide.whoShouldUse.th,
        guide.whoShouldUse.en,
        ...guide.steps.flatMap((s) => [s.title.th, s.title.en, s.detail.th, s.detail.en]),
        ...guide.accountantTips.flatMap((tip) => [
          tip.title.th,
          tip.title.en,
          tip.detail.th,
          tip.detail.en,
        ]),
        ...guide.journalScenarios.flatMap((sc) => [
          sc.condition.th,
          sc.condition.en,
          ...sc.lines.flatMap((l) => [l.accountCode, l.accountName.th, l.accountName.en]),
        ]),
        ...guide.commonPitfalls.flatMap((p) => [p.th, p.en]),
      ];
      return haystacks.some((text) => text.toLowerCase().includes(q));
    });
  }, [selectedCategory, searchQuery]);

  const activeGuide: MenuHelpGuide = useMemo(() => {
    if (requestedGuideId) {
      const exact = filteredGuides.find((g) => g.id === requestedGuideId);
      if (exact) return exact;
      const fromAll = MENU_HELP_GUIDES.find((g) => g.id === requestedGuideId);
      if (fromAll && filteredGuides.length === 0) return fromAll;
    }
    return filteredGuides[0] ?? MENU_HELP_GUIDES[0];
  }, [filteredGuides, requestedGuideId]);

  const selectGuide = (guideId: string) => {
    setActiveTab('guides');
    const next = new URLSearchParams(searchParams);
    next.set('guide', guideId);
    next.delete('tab');
    setSearchParams(next, { replace: true });
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const switchMainTab = (tab: 'guides' | 'academy') => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    if (tab === 'academy') {
      next.set('tab', 'academy');
    } else {
      next.delete('tab');
    }
    setSearchParams(next, { replace: true });
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value.trim() && activeTab !== 'guides') {
      switchMainTab('guides');
    }
  };

  const toggleClosingStep = (order: number) => {
    setCheckedClosingSteps((prev) => {
      const next = prev.includes(order) ? prev.filter((item) => item !== order) : [...prev, order];
      try {
        localStorage.setItem(CLOSING_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage write restrictions in private browsing
      }
      return next;
    });
  };

  const resetClosingChecklist = () => {
    setCheckedClosingSteps([]);
    try {
      localStorage.removeItem(CLOSING_STORAGE_KEY);
    } catch {
      // Ignore storage write restrictions
    }
  };

  const getCategoryLabel = (cat: HelpCategory): string => {
    return t(`help.categories.${cat}`);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Hero Banner & Search */}
      <section
        className="card relative overflow-hidden p-5 sm:p-6"
        style={{
          background:
            'linear-gradient(135deg, var(--color-surface-solid) 0%, var(--color-info-bg) 100%)',
        }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25">
              <GraduationCap size={14} />
              <span>{t('help.heroBadge')}</span>
            </div>
            <h1
              className="text-xl sm:text-2xl font-bold tracking-tight"
              style={{ color: 'var(--color-text)' }}
            >
              {t('help.heroTitle')}
            </h1>
            <p className="text-sm sm:text-base" style={{ color: 'var(--color-text-secondary)' }}>
              {t('help.heroSubtitle')}
            </p>
          </div>

          <div className="w-full lg:w-96 shrink-0 space-y-3">
            <div className="relative">
              <Search
                size={17}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--color-text-muted)' }}
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={t('help.searchPlaceholder')}
                aria-label={t('help.searchPlaceholder')}
                data-testid="help-search-input"
                className="w-full pl-10 pr-9 py-2.5 rounded-xl text-sm border outline-none transition-colors"
                style={{
                  backgroundColor: 'var(--color-surface-solid)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label={t('help.clearSearch')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => switchMainTab('guides')}
                data-testid="help-tab-guides"
                className={`flex-1 inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all ${
                  activeTab === 'guides'
                    ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                    : 'hover:border-orange-400/50'
                }`}
                style={
                  activeTab === 'guides'
                    ? undefined
                    : {
                        backgroundColor: 'var(--color-surface-solid)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text)',
                      }
                }
              >
                <BookOpen size={15} />
                <span>{t('help.tabGuides', { count: MENU_HELP_GUIDES.length })}</span>
              </button>
              <button
                type="button"
                onClick={() => switchMainTab('academy')}
                data-testid="help-tab-academy"
                className={`flex-1 inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all ${
                  activeTab === 'academy'
                    ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                    : 'hover:border-orange-400/50'
                }`}
                style={
                  activeTab === 'academy'
                    ? undefined
                    : {
                        backgroundColor: 'var(--color-surface-solid)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text)',
                      }
                }
              >
                <Calculator size={15} />
                <span>{t('help.tabAcademy')}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {activeTab === 'guides' ? (
        <>
          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {CATEGORY_ORDER.map((category) => {
              const isSelected = selectedCategory === category;
              const count =
                category === 'all'
                  ? MENU_HELP_GUIDES.length
                  : MENU_HELP_GUIDES.filter((g) => g.category === category).length;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  data-testid={`help-cat-${category}`}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium border transition-colors ${
                    isSelected
                      ? 'bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/40'
                      : 'hover:border-orange-400/40'
                  }`}
                  style={
                    isSelected
                      ? undefined
                      : {
                          backgroundColor: 'var(--color-surface-solid)',
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text-secondary)',
                        }
                  }
                >
                  <span>{getCategoryLabel(category)}</span>
                  <span className="text-[11px] opacity-75">({count})</span>
                </button>
              );
            })}
          </div>

          {filteredGuides.length === 0 ? (
            <div className="card p-8 text-center space-y-3">
              <Search
                size={36}
                className="mx-auto opacity-40"
                style={{ color: 'var(--color-text-muted)' }}
              />
              <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
                {t('help.noMatchTitle')}
              </h2>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {t('help.noMatchDesc')}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 transition-colors"
              >
                <RotateCcw size={15} />
                <span>{t('help.resetFilters')}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Master Menu Directory */}
              <aside className="lg:col-span-4 space-y-2 lg:sticky lg:top-20">
                <div className="card p-3 sm:p-4 space-y-1.5 max-h-[70vh] overflow-y-auto">
                  <div className="flex items-center justify-between px-2 pb-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                      {t('help.menuListTitle')}
                    </span>
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                      {t('help.showingCount', { count: filteredGuides.length })}
                    </span>
                  </div>

                  {filteredGuides.map((guide) => {
                    const isActive = activeGuide.id === guide.id;
                    return (
                      <button
                        key={guide.id}
                        type="button"
                        onClick={() => selectGuide(guide.id)}
                        data-testid={`help-guide-item-${guide.id}`}
                        className={`w-full text-left flex items-start gap-3 p-2.5 rounded-xl border transition-all ${
                          isActive
                            ? 'bg-orange-500/10 border-orange-500/40 shadow-xs'
                            : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <div
                          className={`mt-0.5 p-2 rounded-lg shrink-0 ${
                            isActive
                              ? 'bg-orange-500 text-white'
                              : 'bg-black/5 dark:bg-white/10'
                          }`}
                          style={isActive ? undefined : { color: 'var(--color-text-secondary)' }}
                        >
                          <GuideIcon name={guide.iconName} size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p
                              className={`text-sm font-semibold truncate ${
                                isActive ? 'text-orange-600 dark:text-orange-300' : ''
                              }`}
                              style={isActive ? undefined : { color: 'var(--color-text)' }}
                            >
                              {localizeText(guide.menuName, lang)}
                            </p>
                            <ChevronRight
                              size={14}
                              className={`shrink-0 ${
                                isActive ? 'text-orange-500' : 'opacity-40'
                              }`}
                            />
                          </div>
                          <p
                            className="text-xs line-clamp-2 mt-0.5"
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            {localizeText(guide.shortDesc, lang)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </aside>

              {/* Right Detailed Guide & Accountant Knowledge */}
              <div ref={detailRef} className="lg:col-span-8 space-y-5">
                {/* Guide Header Card */}
                <article className="card p-5 sm:p-6 space-y-5" data-testid="help-guide-detail">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="p-3 rounded-2xl bg-orange-500/15 text-orange-600 dark:text-orange-300 border border-orange-500/25 shrink-0">
                        <GuideIcon name={activeGuide.iconName} size={24} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-orange-500/15 text-orange-700 dark:text-orange-300">
                            {getCategoryLabel(activeGuide.category)}
                          </span>
                          <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                            {activeGuide.route}
                          </span>
                        </div>
                        <h2 className="text-lg sm:text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                          {localizeText(activeGuide.menuName, lang)}
                        </h2>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {localizeText(activeGuide.shortDesc, lang)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(activeGuide.route)}
                      data-testid="help-open-menu-btn"
                      className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 transition-colors shadow-sm"
                    >
                      <span>{t('help.openMenuBtn')}</span>
                      <ArrowRight size={15} />
                    </button>
                  </div>

                  {/* Role / Audience strip */}
                  <div
                    className="flex items-start gap-2.5 p-3 rounded-xl border text-xs sm:text-sm"
                    style={{
                      backgroundColor: 'var(--color-bg)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    <Users size={16} className="shrink-0 mt-0.5 text-orange-500" />
                    <div>
                      <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                        {t('help.whoShouldUseLabel')}:{' '}
                      </span>
                      <span>{localizeText(activeGuide.whoShouldUse, lang)}</span>
                    </div>
                  </div>

                  {/* 4-Pillar Accounting & Stock Impact Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <div
                      className="p-3 rounded-xl border space-y-1"
                      style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                        <Boxes size={14} />
                        <span>{t('help.impactStock')}</span>
                      </div>
                      <p className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                        {localizeText(activeGuide.impactSummary.stock, lang)}
                      </p>
                    </div>
                    <div
                      className="p-3 rounded-xl border space-y-1"
                      style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <Percent size={14} />
                        <span>{t('help.impactVat')}</span>
                      </div>
                      <p className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                        {localizeText(activeGuide.impactSummary.vat, lang)}
                      </p>
                    </div>
                    <div
                      className="p-3 rounded-xl border space-y-1"
                      style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                        <Scale size={14} />
                        <span>{t('help.impactWht')}</span>
                      </div>
                      <p className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                        {localizeText(activeGuide.impactSummary.wht, lang)}
                      </p>
                    </div>
                    <div
                      className="p-3 rounded-xl border space-y-1"
                      style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400">
                        <BookOpen size={14} />
                        <span>{t('help.impactJournal')}</span>
                      </div>
                      <p className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                        {localizeText(activeGuide.impactSummary.journal, lang)}
                      </p>
                    </div>
                  </div>
                </article>

                {/* Prerequisites */}
                {activeGuide.prerequisites.length > 0 && (
                  <section className="card p-5 space-y-3">
                    <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                      <CheckCircle2 size={17} className="text-emerald-500" />
                      <span>{t('help.prerequisitesTitle')}</span>
                    </h3>
                    <ul className="space-y-2">
                      {activeGuide.prerequisites.map((req, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2.5 text-sm"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span>{localizeText(req, lang)}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Step-by-Step Operational Guide */}
                <section className="card p-5 sm:p-6 space-y-4">
                  <h3 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                    <ClipboardCheck size={18} className="text-orange-500" />
                    <span>{t('help.stepByStepTitle')}</span>
                  </h3>
                  <div className="space-y-3">
                    {activeGuide.steps.map((step, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border space-y-1.5"
                        style={{
                          backgroundColor: 'var(--color-bg)',
                          borderColor: 'var(--color-border)',
                        }}
                      >
                        <h4 className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                          {localizeText(step.title, lang)}
                        </h4>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                          {localizeText(step.detail, lang)}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Automated Double-Entry Journal Table (Accountant Core) */}
                {activeGuide.journalScenarios.length > 0 && (
                  <section className="card p-5 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                        <Calculator size={18} className="text-violet-500" />
                        <span>{t('help.journalTitle')}</span>
                      </h3>
                      <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-300">
                        {t('help.doubleEntryBadge')}
                      </span>
                    </div>

                    <div className="space-y-4">
                      {activeGuide.journalScenarios.map((scenario, scIdx) => (
                        <div
                          key={scIdx}
                          className="rounded-xl border overflow-hidden"
                          style={{ borderColor: 'var(--color-border)' }}
                        >
                          <div
                            className="px-4 py-2.5 text-xs sm:text-sm font-semibold border-b"
                            style={{
                              backgroundColor: 'var(--color-bg)',
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-text)',
                            }}
                          >
                            {localizeText(scenario.condition, lang)}
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs sm:text-sm text-left">
                              <thead>
                                <tr
                                  className="border-b"
                                  style={{
                                    borderColor: 'var(--color-border)',
                                    color: 'var(--color-text-muted)',
                                  }}
                                >
                                  <th className="py-2 px-3 w-20">{t('help.colSide')}</th>
                                  <th className="py-2 px-3 w-28">{t('help.colCode')}</th>
                                  <th className="py-2 px-3">{t('help.colAccount')}</th>
                                  <th className="py-2 px-3 text-right">{t('help.colAmountRule')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {scenario.lines.map((line, lIdx) => (
                                  <tr
                                    key={lIdx}
                                    className="border-b last:border-b-0"
                                    style={{ borderColor: 'var(--color-border)' }}
                                  >
                                    <td className="py-2.5 px-3">
                                      <span
                                        className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold ${
                                          line.side === 'Dr'
                                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                            : 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                                        }`}
                                      >
                                        {line.side === 'Dr' ? t('help.sideDr') : t('help.sideCr')}
                                      </span>
                                    </td>
                                    <td
                                      className="py-2.5 px-3 font-mono font-semibold"
                                      style={{ color: 'var(--color-text)' }}
                                    >
                                      {line.accountCode}
                                    </td>
                                    <td className="py-2.5 px-3" style={{ color: 'var(--color-text)' }}>
                                      {localizeText(line.accountName, lang)}
                                    </td>
                                    <td
                                      className="py-2.5 px-3 text-right font-medium"
                                      style={{ color: 'var(--color-text-secondary)' }}
                                    >
                                      {localizeText(line.amountRule, lang)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Expert Accountant Tips & Common Pitfalls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <section className="card p-5 space-y-3 border-l-4 border-l-amber-500">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-amber-600 dark:text-amber-300">
                      <Lightbulb size={17} />
                      <span>{t('help.accountantTipsTitle')}</span>
                    </h3>
                    <div className="space-y-3">
                      {activeGuide.accountantTips.map((tip, idx) => (
                        <div key={idx} className="space-y-1">
                          <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                            {localizeText(tip.title, lang)}
                          </h4>
                          <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                            {localizeText(tip.detail, lang)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="card p-5 space-y-3 border-l-4 border-l-rose-500">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-rose-600 dark:text-rose-300">
                      <AlertTriangle size={17} />
                      <span>{t('help.pitfallsTitle')}</span>
                    </h3>
                    <ul className="space-y-2.5">
                      {activeGuide.commonPitfalls.map((pitfall, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-xs sm:text-sm leading-relaxed"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                          <span>{localizeText(pitfall, lang)}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>

                {/* Related Connected Menus */}
                {activeGuide.relatedIds.length > 0 && (
                  <section className="card p-5 space-y-3">
                    <h3 className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                      {t('help.relatedTitle')}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {activeGuide.relatedIds.map((relId) => {
                        const relGuide = MENU_HELP_GUIDES.find((g) => g.id === relId);
                        if (!relGuide) return null;
                        return (
                          <button
                            key={relId}
                            type="button"
                            onClick={() => selectGuide(relId)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium border hover:border-orange-500/50 transition-colors"
                            style={{
                              backgroundColor: 'var(--color-bg)',
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-text)',
                            }}
                          >
                            <GuideIcon name={relGuide.iconName} size={14} className="text-orange-500" />
                            <span>{localizeText(relGuide.menuName, lang)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        /* Tab 2: Accountant Academy — Monthly Closing Checklist, Document Matrix, Tax Calendar, Chart of Accounts */
        <div className="space-y-6" data-testid="help-academy-view">
          {/* Interactive Monthly Closing Checklist */}
          <section className="card p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                  <ClipboardCheck size={20} className="text-emerald-500" />
                  <span>{t('help.closingTitle')}</span>
                </h2>
                <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                  {t('help.closingSubtitle')}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  {checkedClosingSteps.length} / {MONTHLY_CLOSING_CHECKLIST.length}
                </span>
                <button
                  type="button"
                  onClick={resetClosingChecklist}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border hover:border-orange-400/50 transition-colors"
                  style={{
                    backgroundColor: 'var(--color-bg)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <RotateCcw size={13} />
                  <span>{t('help.resetChecklist')}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {MONTHLY_CLOSING_CHECKLIST.map((task) => {
                const isDone = checkedClosingSteps.includes(task.order);
                return (
                  <div
                    key={task.order}
                    className={`p-4 rounded-xl border transition-all flex items-start gap-3 ${
                      isDone ? 'border-emerald-500/40 bg-emerald-500/5' : ''
                    }`}
                    style={
                      isDone
                        ? undefined
                        : {
                            backgroundColor: 'var(--color-bg)',
                            borderColor: 'var(--color-border)',
                          }
                    }
                  >
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => toggleClosingStep(task.order)}
                      aria-label={localizeText(task.title, lang)}
                      className="mt-1 h-4 w-4 accent-emerald-600 rounded cursor-pointer shrink-0"
                    />
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <h3
                        className={`text-sm font-bold ${isDone ? 'line-through opacity-70' : ''}`}
                        style={{ color: 'var(--color-text)' }}
                      >
                        {task.order}. {localizeText(task.title, lang)}
                      </h3>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                        {localizeText(task.detail, lang)}
                      </p>
                      <button
                        type="button"
                        onClick={() => selectGuide(task.menuId)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline"
                      >
                        <span>{t('help.viewMenuGuideLink')}</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 7 Document Types Accounting & Stock Matrix */}
          <section className="card p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                <Scale size={20} className="text-orange-500" />
                <span>{t('help.docMatrixTitle')}</span>
              </h2>
              <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                {t('help.docMatrixSubtitle')}
              </p>
            </div>
            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
              <table className="w-full text-xs sm:text-sm text-left">
                <thead>
                  <tr
                    className="border-b"
                    style={{
                      backgroundColor: 'var(--color-bg)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    <th className="py-2.5 px-3">{t('help.matrixColDoc')}</th>
                    <th className="py-2.5 px-3">{t('help.matrixColEtax')}</th>
                    <th className="py-2.5 px-3">{t('help.matrixColStock')}</th>
                    <th className="py-2.5 px-3">{t('help.matrixColVat')}</th>
                    <th className="py-2.5 px-3">{t('help.matrixColGl')}</th>
                  </tr>
                </thead>
                <tbody>
                  {DOCUMENT_IMPACT_MATRIX.map((row) => (
                    <tr
                      key={row.guideId}
                      onClick={() => selectGuide(row.guideId)}
                      className="border-b last:border-b-0 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <td className="py-3 px-3 font-semibold text-orange-600 dark:text-orange-300">
                        {localizeText(row.docType, lang)}
                      </td>
                      <td className="py-3 px-3 font-mono" style={{ color: 'var(--color-text)' }}>
                        {row.etaxCode}
                      </td>
                      <td className="py-3 px-3" style={{ color: 'var(--color-text-secondary)' }}>
                        {localizeText(row.affectsStock, lang)}
                      </td>
                      <td className="py-3 px-3" style={{ color: 'var(--color-text-secondary)' }}>
                        {localizeText(row.affectsOutputVat, lang)}
                      </td>
                      <td className="py-3 px-3" style={{ color: 'var(--color-text-secondary)' }}>
                        {localizeText(row.postsJournal, lang)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Thai Tax Compliance Calendar */}
          <section className="card p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                <CalendarClock size={20} className="text-blue-500" />
                <span>{t('help.taxCalendarTitle')}</span>
              </h2>
              <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                {t('help.taxCalendarSubtitle')}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {THAI_TAX_CALENDAR.map((event) => (
                <div
                  key={event.formCode}
                  className="p-4 rounded-xl border space-y-2"
                  style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300">
                      {event.formCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => selectGuide(event.sourceMenuId)}
                      className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline inline-flex items-center gap-1"
                    >
                      <span>{t('help.viewMenuGuideLink')}</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                    {localizeText(event.title, lang)}
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="block" style={{ color: 'var(--color-text-muted)' }}>
                        {t('help.paperDeadlineLabel')}
                      </span>
                      <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                        {localizeText(event.paperDeadline, lang)}
                      </span>
                    </div>
                    <div>
                      <span className="block" style={{ color: 'var(--color-text-muted)' }}>
                        {t('help.onlineDeadlineLabel')}
                      </span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {localizeText(event.onlineDeadline, lang)}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {localizeText(event.notes, lang)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Official System Chart of Accounts (1110-5200) */}
          <section className="card p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base sm:text-lg font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                  <BookOpen size={20} className="text-violet-500" />
                  <span>{t('help.coaTitle')}</span>
                </h2>
                <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                  {t('help.coaSubtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/accounting')}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-orange-600 dark:text-orange-400 hover:underline shrink-0"
              >
                <span>{t('help.openAccountingScreen')}</span>
                <ArrowRight size={14} />
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
              <table className="w-full text-xs sm:text-sm text-left">
                <thead>
                  <tr
                    className="border-b"
                    style={{
                      backgroundColor: 'var(--color-bg)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    <th className="py-2.5 px-3 w-24">{t('help.colCode')}</th>
                    <th className="py-2.5 px-3 w-28">{t('help.coaColCategory')}</th>
                    <th className="py-2.5 px-3 w-56">{t('help.colAccount')}</th>
                    <th className="py-2.5 px-3">{t('help.coaColUsage')}</th>
                  </tr>
                </thead>
                <tbody>
                  {SYSTEM_CHART_OF_ACCOUNTS.map((acc) => (
                    <tr
                      key={acc.code}
                      className="border-b last:border-b-0"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold" style={{ color: 'var(--color-text)' }}>
                        {acc.code}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                            ACCOUNT_TYPE_BADGE_STYLE[acc.type] ?? ''
                          }`}
                        >
                          {t(`help.accountTypes.${acc.type}`)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium" style={{ color: 'var(--color-text)' }}>
                        {localizeText(acc.name, lang)}
                      </td>
                      <td className="py-2.5 px-3" style={{ color: 'var(--color-text-secondary)' }}>
                        {localizeText(acc.usage, lang)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default HelpPage;
