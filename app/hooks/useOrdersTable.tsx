import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
  type VisibilityState,
  type ColumnOrderState,
  type ColumnSizingState,
  type ExpandedState,
} from "@tanstack/react-table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { type Order, type OrderTableSettings } from "@/models";
import {
  COLUMN_IDS,
  getOrderSummary,
} from "@/lib/tableUtils";

interface UseOrdersTableProps {
  orders: Order[];
  settings: OrderTableSettings;
  onSettingsChange: (updates: Partial<OrderTableSettings>) => void;
  expandedRows: ExpandedState;
  onExpandedChange: OnChangeFn<ExpandedState>;
}

import { OrderStatusBadge } from "@/components/admin/orders/OrderStatusBadge";

/**
 * Custom hook for configuring TanStack Table for orders
 *
 * Features:
 * - Column definitions with sorting, resizing, visibility control
 * - Persistent column settings (order, size, visibility, sorting)
 * - Row expansion
 * - Responsive design support
 *
 * @param props - Table configuration props
 * @returns Configured TanStack Table instance
 */
export function useOrdersTable({
  orders,
  settings,
  onSettingsChange,
  expandedRows,
  onExpandedChange,
}: UseOrdersTableProps) {
  // Define columns
  const columns = useMemo<ColumnDef<Order>[]>(
    () => [
      // Select checkbox column
      {
        id: COLUMN_IDS.SELECT,
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
            className="translate-y-[2px]"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="translate-y-[2px]"
            onClick={(e) => e.stopPropagation()}
          />
        ),
        size: 40,
        enableSorting: false,
        enableResizing: false,
        enableHiding: false,
        meta: {
          className: "px-2",
        },
      },
      // Expand button column
      {
        id: COLUMN_IDS.EXPAND,
        header: "",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              row.toggleExpanded();
            }}
            className="h-8 w-8 p-0"
          >
            {row.getIsExpanded() ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        ),
        size: 40,
        enableSorting: false,
        enableResizing: false,
        enableHiding: false,
        meta: {
          className: "",
        },
      },
      // Order number column
      {
        id: COLUMN_IDS.ORDER_NUMBER,
        accessorKey: "order_number",
        header: "주문번호",
        cell: ({ getValue }) => (
          <span className="font-mono text-sm">{getValue() as string}</span>
        ),
        size: 150,
        enableSorting: true,
        enableResizing: true,
        enableHiding: true,
        meta: {
          className: "",
        },
      },
      // Customer name column
      {
        id: COLUMN_IDS.CUSTOMER_NAME,
        accessorKey: "customer_name",
        header: "고객명",
        cell: ({ getValue }) => (
          <span className="font-medium">{getValue() as string}</span>
        ),
        size: 150,
        enableSorting: true,
        enableResizing: true,
        enableHiding: true,
        meta: {
          className: "",
        },
      },
      // Phone column
      {
        id: COLUMN_IDS.PHONE,
        accessorKey: "phone",
        header: "전화번호",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{getValue() as string}</span>
        ),
        size: 140,
        enableSorting: true,
        enableResizing: true,
        enableHiding: true,
        meta: {
          className: "",
        },
      },
      // Apartment column
      {
        id: COLUMN_IDS.APARTMENT,
        accessorFn: (row) => row.apartments?.name_ko || row.apartments?.name || "-",
        header: "아파트",
        cell: ({ getValue }) => (
          <span className="text-sm">{getValue() as string}</span>
        ),
        size: 120,
        enableSorting: true,
        enableResizing: true,
        enableHiding: true,
        meta: {
          className: "",
        },
      },
      // Unit number column (combining tower and flat_number)
      {
        id: COLUMN_IDS.UNIT_NUMBER,
        accessorFn: (row) => {
          const tower = row.tower || "";
          const flat = row.flat_number || "";
          if (!tower && !flat) return "-";
          if (!tower) return flat;
          if (!flat) return tower;
          return `${tower} ${flat}`;
        },
        header: "동호수",
        cell: ({ getValue }) => (
          <span className="text-sm font-mono">{getValue() as string}</span>
        ),
        size: 100,
        enableSorting: true,
        enableResizing: true,
        enableHiding: true,
        meta: {
          className: "",
        },
      },
      // Order summary column
      {
        id: COLUMN_IDS.ORDER_SUMMARY,
        accessorFn: (row) => getOrderSummary(row),
        header: "주문 요약",
        cell: ({ getValue }) => (
          <span className="text-sm font-medium">{getValue() as string}</span>
        ),
        size: 200,
        enableSorting: false,
        enableResizing: true,
        enableHiding: true,
        meta: {
          className: "",
        },
      },
      // Delivery date column
      {
        id: COLUMN_IDS.DELIVERY_DATE,
        accessorKey: "delivery_date",
        header: "배달일",
        cell: ({ getValue }) => {
          const dateValue = getValue() as string;
          return new Date(dateValue).toLocaleDateString("ko-KR");
        },
        size: 130,
        enableSorting: true,
        enableResizing: true,
        enableHiding: true,
        meta: {
          className: "",
        },
      },
      // Channel column
      {
        id: COLUMN_IDS.CHANNEL,
        accessorKey: "entry_channel",
        header: "채널",
        cell: ({ getValue }) => {
          const channel = getValue() as string;
          return (
            <Badge variant="outline">
              {channel === "admin_whatsapp" ? "WhatsApp" : "직접"}
            </Badge>
          );
        },
        size: 100,
        enableSorting: true,
        enableResizing: true,
        enableHiding: true,
        meta: {
          className: "",
        },
      },
      // Total amount column
      {
        id: COLUMN_IDS.TOTAL_AMOUNT,
        accessorKey: "total_amount",
        header: "총액",
        cell: ({ getValue }) => {
          const amount = getValue() as number;
          return <span className="font-medium">₹{amount}</span>;
        },
        size: 120,
        enableSorting: true,
        enableResizing: true,
        enableHiding: true,
        meta: {
          className: "text-right pr-6",
        },
      },
      // Status column
      {
        id: COLUMN_IDS.STATUS,
        accessorKey: "status",
        header: "상태",
        cell: ({ row }) => {
          const order = row.original;
          return (
            <OrderStatusBadge
              status={order.status}
              isLocked={order.is_locked}
            />
          );
        },
        size: 150,
        enableSorting: true,
        enableResizing: true,
        enableHiding: true,
        meta: {
          className: "text-center",
        },
      },
      // Actions column (will be rendered separately in the main component)
      {
        id: COLUMN_IDS.ACTIONS,
        header: "작업",
        cell: () => null, // Rendered in OrdersDataTable component
        size: 100,
        enableSorting: false,
        enableResizing: false,
        enableHiding: false,
        meta: {
          className: "text-right",
        },
      },
    ],
    []
  );

  // Create table instance
  const table = useReactTable({
    data: orders,
    columns,
    state: {
      sorting: settings.sorting,
      columnVisibility: settings.columnVisibility,
      columnOrder: settings.columnOrder,
      columnSizing: settings.columnSizing,
      expanded: expandedRows,
    },
    onSortingChange: (updater) => {
      const newSorting =
        typeof updater === "function" ? updater(settings.sorting) : updater;
      onSettingsChange({ sorting: newSorting });
    },
    onColumnVisibilityChange: (updater) => {
      const newVisibility =
        typeof updater === "function"
          ? updater(settings.columnVisibility)
          : updater;
      onSettingsChange({ columnVisibility: newVisibility });
    },
    onColumnOrderChange: (updater) => {
      const newOrder =
        typeof updater === "function" ? updater(settings.columnOrder) : updater;
      onSettingsChange({ columnOrder: newOrder });
    },
    onColumnSizingChange: (updater) => {
      const newSizing =
        typeof updater === "function"
          ? updater(settings.columnSizing)
          : updater;
      onSettingsChange({ columnSizing: newSizing });
    },
    onExpandedChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    enableSorting: true,
    enableExpanding: true,
  });

  return table;
}
