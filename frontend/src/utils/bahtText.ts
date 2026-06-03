/**
 * Converts a numeric value to Thai Baht text representation
 * e.g., 3300.00 -> "สามพันสามร้อยบาทถ้วน"
 */
export function bahtText(amount: number | string): string {
  const numberText = amount.toString().replace(/,/g, '');
  const parsedNumber = parseFloat(numberText);

  if (isNaN(parsedNumber)) return 'ศูนย์บาทถ้วน';
  if (parsedNumber === 0) return 'ศูนย์บาทถ้วน';

  const parts = parsedNumber.toFixed(2).split('.');
  const baht = parts[0];
  const satang = parts[1];

  const result = convertToThaiText(baht) + 'บาท' + 
                 (satang === '00' ? 'ถ้วน' : convertToThaiText(satang) + 'สตางค์');
  
  return result;
}

function convertToThaiText(numberStr: string): string {
  const digits = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const positions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

  if (numberStr === '0' || numberStr === '00') return '';

  let result = '';
  let length = numberStr.length;

  for (let i = 0; i < length; i++) {
    const digit = parseInt(numberStr.charAt(i), 10);
    const position = length - i - 1;

    if (digit === 0) continue;

    // Handle "เอ็ด" (One at the end, except when it's exactly 1 or 11 handled differently)
    if (digit === 1 && position === 0 && length > 1) {
      result += 'เอ็ด';
    } 
    // Handle "ยี่สิบ"
    else if (digit === 2 && position === 1) {
      result += 'ยี่สิบ';
    } 
    // Handle "สิบ" (without "หนึ่งสิบ")
    else if (digit === 1 && position === 1) {
      result += 'สิบ';
    } 
    else {
      // General case
      result += digits[digit] + positions[position % 6];
    }

    // Handle "ล้าน" boundaries (every 6 positions)
    if (position > 0 && position % 6 === 0) {
      result += 'ล้าน';
    }
  }

  return result;
}
