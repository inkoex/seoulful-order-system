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

const statusStyles: Record<
  string,
  { label: string; className?: string; variant?: "default" | "secondary" | "outline" }
> = {
  received: { label: "접수됨", className: "bg-yellow-600" },
  ready: { label: "생산 완료", className: "bg-blue-600" },
  delivered: { label: "배달 완료", className: "bg-green-600" },
  paid: { label: "지불 완료", className: "bg-emerald-700" },
  cancelled: { label: "취소됨", variant: "secondary" },
};

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
          className: "text-right",
        },
      },
      // Status column
      {
        id: COLUMN_IDS.STATUS,
        accessorKey: "status",
        header: "상태",
        cell: ({ row }) => {
          const order = row.original;
          const info = statusStyles[order.status] || { label: order.status };

          return (
            <div className="flex items-center gap-1">
              {info.variant ? (
                <Badge variant={info.variant}>{info.label}</Badge>
              ) : (
                <Badge variant="default" className={info.className}>
                  {info.label}
                </Badge>
              )}
              {order.is_locked && (
                <Badge variant="outline" className="ml-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </Badge>
              )}
            </div>
          );
        },
        size: 150,
        enableSorting: true,
        enableResizing: true,
        enableHiding: true,
        meta: {
          className: "",
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
