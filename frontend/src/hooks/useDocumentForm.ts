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

  function createEmptyLine(): DocumentLineItem {
    return {
      id: crypto.randomUUID(),
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
    let grandTotal: number;

    if (vatMode === 'exclusive') {
      vatAmount = Math.round((totalBeforeVat * vatRate / 100) * 100) / 100;
      grandTotal = totalBeforeVat + vatAmount;
    } else {
      grandTotal = totalBeforeVat;
      vatAmount = Math.round((totalBeforeVat * vatRate / (100 + vatRate)) * 100) / 100;
    }

    return { subtotal, totalBeforeVat, vatAmount, grandTotal };
  }, [lines, discountAmount, vatMode, vatRate]);

  const resetForm = useCallback(() => {
    setLines([createEmptyLine()]);
    setDiscountAmount(0);
    setVatMode('exclusive');
  }, []);

  return {
    lines, addLine, removeLine, updateLine,
    vatMode, setVatMode,
    discountAmount, setDiscountAmount,
    totals, resetForm,
  };
}
