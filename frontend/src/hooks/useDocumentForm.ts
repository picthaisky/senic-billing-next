import { useState, useMemo, useCallback } from 'react';

export interface DocumentLineItem {
  id: string;
  productId?: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountAmount: number;
  lineTotal: number;
}

export type VatMode = 'exclusive' | 'inclusive';

export function useDocumentForm(vatRate: number = 7) {
  const [lines, setLines] = useState<DocumentLineItem[]>([createEmptyLine()]);
  const [vatMode, setVatMode] = useState<VatMode>('exclusive');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [whtRate, setWhtRate] = useState(0); // 0, 1, 3, 5

  function createEmptyLine(): DocumentLineItem {
    return {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10),
      description: '',
      quantity: 1,
      unit: 'ชิ้น',
      unitPrice: 0,
      discountAmount: 0,
      lineTotal: 0,
    };
  }

  const addLine = useCallback(() => {
    setLines((prev) => [...prev, createEmptyLine()]);
  }, []);

  const removeLine = useCallback((id: string) => {
    setLines((prev) => prev.length > 1 ? prev.filter((l) => l.id !== id) : prev);
  }, []);

  const updateLine = useCallback((id: string, updates: Partial<DocumentLineItem>) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        const updated = { ...line, ...updates };
        updated.lineTotal = (updated.quantity * updated.unitPrice) - updated.discountAmount;
        return updated;
      })
    );
  }, []);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
    const totalBeforeVat = subtotal - discountAmount;

    let vatAmount: number;
    let baseGrandTotal: number;

    if (vatMode === 'exclusive') {
      vatAmount = Math.round((totalBeforeVat * vatRate / 100) * 100) / 100;
      baseGrandTotal = totalBeforeVat + vatAmount;
    } else {
      baseGrandTotal = totalBeforeVat;
      vatAmount = Math.round((totalBeforeVat * vatRate / (100 + vatRate)) * 100) / 100;
    }
    
    // WHT is calculated on TotalBeforeVat (Thai standard)
    // For inclusive vat, totalBeforeVat is currently the GrandTotal including VAT in this calculation logic.
    // Wait, if VAT is inclusive, totalBeforeVat here is the user input sum. 
    // True totalBeforeVat = baseGrandTotal - vatAmount
    const trueTotalBeforeVat = vatMode === 'inclusive' ? baseGrandTotal - vatAmount : totalBeforeVat;
    
    const whtAmount = Math.round((trueTotalBeforeVat * whtRate / 100) * 100) / 100;
    const grandTotal = baseGrandTotal - whtAmount;

    return { subtotal, totalBeforeVat: trueTotalBeforeVat, vatAmount, whtAmount, grandTotal };
  }, [lines, discountAmount, vatMode, vatRate, whtRate]);

  const resetForm = useCallback(() => {
    setLines([createEmptyLine()]);
    setDiscountAmount(0);
    setVatMode('exclusive');
    setWhtRate(0);
  }, []);

  const restoreState = useCallback((savedState: any) => {
    if (savedState.lines && Array.isArray(savedState.lines)) setLines(savedState.lines);
    if (savedState.vatMode) setVatMode(savedState.vatMode);
    if (savedState.discountAmount !== undefined) setDiscountAmount(savedState.discountAmount);
    if (savedState.whtRate !== undefined) setWhtRate(savedState.whtRate);
  }, []);

  return {
    lines, addLine, removeLine, updateLine,
    vatMode, setVatMode,
    discountAmount, setDiscountAmount,
    whtRate, setWhtRate,
    totals, resetForm, restoreState,
  };
}
