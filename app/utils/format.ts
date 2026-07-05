import { format, parseISO } from 'date-fns';

/**
 * 날짜 객체 또는 ISO 문자열을 'yyyy-MM-dd' 형식의 문자열로 변환합니다.
 * 타임존 문제를 피하기 위해 format()을 사용합니다.
 */
export function formatToISODate(date: Date | string): string {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, 'yyyy-MM-dd');
}

/**
 * 날짜를 사용자에게 보여주기 좋은 형식으로 변환합니다. (예: 2024. 1. 20.)
 */
export function formatDisplayDate(date: Date | string): string {
    const d = typeof date === 'string' ? parseISO(date) : date;
    // 기존 toLocaleDateString('en-US') 대신 서비스의 일관된 한국 스타일 또는 공통 스타일 적용
    return format(d, 'yyyy. M. d.');
}

/**
 * 숫자를 통화 형식으로 변환합니다. (예: ₹460)
 */
export function formatCurrency(amount: number | string): string {
    const value = typeof amount === 'string' ? Number(amount) : amount;
    if (isNaN(value)) return '₹0';
    // Fixed locale so server and client render identically (no hydration mismatch).
    return `₹${value.toLocaleString('en-IN')}`;
}
