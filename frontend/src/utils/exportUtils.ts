import * as XLSX from 'xlsx';

/**
 * Helper function to export data to Excel with Thai column headers
 */
export function exportToExcel(data: any[], filename: string, columnMapping: Record<string, string>) {
  if (!data || data.length === 0) {
    alert('ไม่มีข้อมูลให้ส่งออก');
    return;
  }

  // Transform data keys to Thai headers based on columnMapping
  const formattedData = data.map(item => {
    const formattedItem: any = {};
    for (const [key, value] of Object.entries(item)) {
      if (columnMapping[key]) {
        formattedItem[columnMapping[key]] = value;
      }
    }
    return formattedItem;
  });

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

  // Auto-size columns roughly
  const max_width = formattedData.reduce((w, r) => Math.max(w, Object.keys(r).length), 10);
  worksheet['!cols'] = Array(max_width).fill({ wch: 20 });

  XLSX.writeFile(workbook, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Helper function to export data to CSV with BOM (for correct Thai encoding in Excel)
 */
export function exportToCSV(data: any[], filename: string, columnMapping: Record<string, string>) {
  if (!data || data.length === 0) return;

  const formattedData = data.map(item => {
    const formattedItem: any = {};
    for (const [key, value] of Object.entries(item)) {
      if (columnMapping[key]) {
        formattedItem[columnMapping[key]] = value;
      }
    }
    return formattedItem;
  });

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const csv = XLSX.utils.sheet_to_csv(worksheet);

  // Add BOM (\uFEFF) so Excel opens UTF-8 CSV correctly
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
}
