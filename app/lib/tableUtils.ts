import { z } from "zod";

// ============================================================================
// Type Definitions
// ============================================================================

import { type Order, type OrderTableSettings } from "@/models";

// ============================================================================
// Constants
// ============================================================================

export const COLUMN_IDS = {
  SELECT: "select",
  EXPAND: "expand",
  ORDER_NUMBER: "orderNumber",
  CUSTOMER_NAME: "customerName",
  PHONE: "phone",
  APARTMENT: "apartment",
  UNIT_NUMBER: "unitNumber",
  ORDER_SUMMARY: "orderSummary",
  DELIVERY_DATE: "deliveryDate",
  CHANNEL: "channel",
  TOTAL_AMOUNT: "totalAmount",
  STATUS: "status",
  ACTIONS: "actions",
} as const;

export const COLUMN_LABELS: Record<string, string> = {
  [COLUMN_IDS.SELECT]: "선택",
  [COLUMN_IDS.EXPAND]: "확장",
  [COLUMN_IDS.ORDER_NUMBER]: "주문번호",
  [COLUMN_IDS.CUSTOMER_NAME]: "고객명",
  [COLUMN_IDS.PHONE]: "전화번호",
  [COLUMN_IDS.APARTMENT]: "아파트",
  [COLUMN_IDS.UNIT_NUMBER]: "동호수",
  [COLUMN_IDS.ORDER_SUMMARY]: "주문 요약",
  [COLUMN_IDS.DELIVERY_DATE]: "배달일",
  [COLUMN_IDS.CHANNEL]: "채널",
  [COLUMN_IDS.TOTAL_AMOUNT]: "총액",
  [COLUMN_IDS.STATUS]: "상태",
  [COLUMN_IDS.ACTIONS]: "작업",
};

export const TABLE_SETTINGS_STORAGE_KEY = "admin_orders_table_settings";

export const DEFAULT_TABLE_SETTINGS: OrderTableSettings = {
  columnVisibility: {
    [COLUMN_IDS.SELECT]: true,
    [COLUMN_IDS.EXPAND]: true,
    [COLUMN_IDS.ORDER_NUMBER]: true,
    [COLUMN_IDS.CUSTOMER_NAME]: true,
    [COLUMN_IDS.PHONE]: true,
    [COLUMN_IDS.APARTMENT]: true,
    [COLUMN_IDS.UNIT_NUMBER]: true,
    [COLUMN_IDS.ORDER_SUMMARY]: true,
    [COLUMN_IDS.DELIVERY_DATE]: true,
    [COLUMN_IDS.CHANNEL]: true,
    [COLUMN_IDS.TOTAL_AMOUNT]: true,
    [COLUMN_IDS.STATUS]: true,
    [COLUMN_IDS.ACTIONS]: true,
  },
  columnOrder: [
    COLUMN_IDS.SELECT,
    COLUMN_IDS.EXPAND,
    COLUMN_IDS.ORDER_NUMBER,
    COLUMN_IDS.CUSTOMER_NAME,
    COLUMN_IDS.PHONE,
    COLUMN_IDS.APARTMENT,
    COLUMN_IDS.UNIT_NUMBER,
    COLUMN_IDS.ORDER_SUMMARY,
    COLUMN_IDS.DELIVERY_DATE,
    COLUMN_IDS.CHANNEL,
    COLUMN_IDS.TOTAL_AMOUNT,
    COLUMN_IDS.STATUS,
    COLUMN_IDS.ACTIONS,
  ],
  columnSizing: {
    [COLUMN_IDS.SELECT]: 40,
    [COLUMN_IDS.EXPAND]: 40,
    [COLUMN_IDS.ORDER_NUMBER]: 150,
    [COLUMN_IDS.CUSTOMER_NAME]: 150,
    [COLUMN_IDS.PHONE]: 140,
    [COLUMN_IDS.APARTMENT]: 120,
    [COLUMN_IDS.UNIT_NUMBER]: 100,
    [COLUMN_IDS.ORDER_SUMMARY]: 200,
    [COLUMN_IDS.DELIVERY_DATE]: 130,
    [COLUMN_IDS.CHANNEL]: 100,
    [COLUMN_IDS.TOTAL_AMOUNT]: 120,
    [COLUMN_IDS.STATUS]: 150,
    [COLUMN_IDS.ACTIONS]: 100,
  },
  sorting: [],
};

// ============================================================================
// Zod Validation Schema
// ============================================================================

const SortingStateSchema = z.array(
  z.object({
    id: z.string(),
    desc: z.boolean(),
  })
);

const ColumnVisibilitySchema = z.record(z.string(), z.boolean());
const ColumnOrderSchema = z.array(z.string());
const ColumnSizingSchema = z.record(z.string(), z.number());

export const TableSettingsSchema = z.object({
  columnVisibility: ColumnVisibilitySchema,
  columnOrder: ColumnOrderSchema,
  columnSizing: ColumnSizingSchema,
  sorting: SortingStateSchema,
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a summary string for an order's items
 * @param order - The order object containing order_items
 * @returns A formatted summary string (e.g., "김치 x 2 외 3건" or "김치 x 2")
 */
export function getOrderSummary(order: Order): string {
  const items = order.order_items || [];

  if (items.length === 0) {
    return "주문 없음";
  }

  const firstItem = items[0];
  const firstName =
    firstItem.products?.name_ko || firstItem.products?.name || "상품";

  if (items.length === 1) {
    return `${firstName} x ${firstItem.quantity}`;
  }

  return `${firstName} x ${firstItem.quantity} 외 ${items.length - 1}건`;
}

/**
 * Validate and parse table settings from localStorage
 * @param storedValue - Raw string value from localStorage
 * @returns Validated settings object or null if invalid
 */
export function parseTableSettings(
  storedValue: string
): OrderTableSettings | null {
  try {
    const parsed = JSON.parse(storedValue);
    return TableSettingsSchema.parse(parsed);
  } catch (error) {
    console.warn("Failed to parse table settings:", error);
    return null;
  }
}

/**
 * Merge partial settings with existing settings
 * @param current - Current settings
 * @param updates - Partial updates to apply
 * @returns Merged settings object
 */
export function mergeTableSettings(
  current: OrderTableSettings,
  updates: Partial<OrderTableSettings>
): OrderTableSettings {
  return {
    ...current,
    ...updates,
  };
}
