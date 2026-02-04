import { Fragment } from "react";
import { flexRender, type Table as TanStackTable } from "@tanstack/react-table";
import { Link, useSubmit, useSearchParams } from "react-router";
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Eye,
  Lock,
  Unlock,
  XCircle,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { COLUMN_IDS } from "@/lib/tableUtils";
import { type Order } from "@/models";
import { ExpandedOrderRow } from "./ExpandedOrderRow";

interface OrdersDataTableProps {
  table: TanStackTable<Order>;
  page: number;
  pageSize: number;
  totalCount: number;
}

const statusOptions = [
  { value: "received", label: "접수됨" },
  { value: "ready", label: "생산 완료" },
  { value: "delivered", label: "배달 완료" },
  { value: "paid", label: "지불 완료" },
  { value: "cancelled", label: "취소됨" },
];

export function OrdersDataTable({ table, page, pageSize, totalCount }: OrdersDataTableProps) {
  const submit = useSubmit();
  const [searchParams, setSearchParams] = useSearchParams();

  function handleAction(
    intent: string,
    orderId: string,
    additionalData?: Record<string, string>
  ) {
    const formData = new FormData();
    formData.append("intent", intent);
    formData.append("orderId", orderId);
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }
    submit(formData, { method: "post" });
  }

  function handlePageChange(newPage: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", newPage.toString());
    setSearchParams(params);
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const isSorted = header.column.getIsSorted();
                const canResize = header.column.getCanResize();
                const meta = header.column.columnDef.meta as
                  | { className?: string }
                  | undefined;

                return (
                  <TableHead
                    key={header.id}
                    className={meta?.className}
                    style={{
                      width: header.getSize(),
                      position: "relative",
                    }}
                  >
                    <div
                      className={
                        canSort
                          ? "flex items-center gap-2 cursor-pointer select-none"
                          : ""
                      }
                      onClick={
                        canSort ? header.column.getToggleSortingHandler() : undefined
                      }
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}

                      {/* Sorting indicator */}
                      {canSort && (
                        <span className="ml-auto">
                          {isSorted === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : isSorted === "desc" ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-50" />
                          )}
                        </span>
                      )}
                    </div>

                    {/* Resize handle */}
                    {canResize && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500 active:bg-blue-600"
                        style={{ userSelect: "none" }}
                      />
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={table.getAllColumns().length}
                className="text-center py-8"
              >
                <p className="text-muted-foreground">주문 내역이 없습니다.</p>
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => {
              const order = row.original;

              return (
                <Fragment key={row.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={(e) => {
                      // Don't toggle if clicking on actions column
                      const target = e.target as HTMLElement;
                      if (
                        !target.closest("[data-actions-column]") &&
                        !target.closest("button")
                      ) {
                        row.toggleExpanded();
                      }
                    }}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta as
                        | { className?: string }
                        | undefined;
                      const isActionsColumn = cell.column.id === COLUMN_IDS.ACTIONS;

                      // Render actions column separately
                      if (isActionsColumn) {
                        return (
                          <TableCell
                            key={cell.id}
                            className={`text-right ${meta?.className || ""}`}
                            data-actions-column
                            onClick={(e) => e.stopPropagation()}
                          >
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost">
                                  작업
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-[200px]">
                                <DropdownMenuLabel>주문 작업</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                  <Link to={`/admin/orders/${order.id}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    상세 보기
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleAction("toggle_lock", order.id)
                                  }
                                >
                                  {order.is_locked ? (
                                    <>
                                      <Unlock className="mr-2 h-4 w-4" />
                                      잠금 해제
                                    </>
                                  ) : (
                                    <>
                                      <Lock className="mr-2 h-4 w-4" />
                                      주문 잠금
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {order.status !== "cancelled" && (
                                  <>
                                    {statusOptions
                                      .filter((option) => option.value !== "cancelled")
                                      .filter((option) => option.value !== order.status)
                                      .map((option) => (
                                        <DropdownMenuItem
                                          key={`status-${order.id}-${option.value}`}
                                          onClick={() =>
                                            handleAction("change_status", order.id, {
                                              status: option.value,
                                            })
                                          }
                                        >
                                          {option.label}로 변경
                                        </DropdownMenuItem>
                                      ))}
                                    <DropdownMenuSeparator />
                                  </>
                                )}
                                {order.status !== "cancelled" && (
                                  <DropdownMenuItem
                                    onClick={() => handleAction("cancel", order.id)}
                                    className="text-red-600"
                                  >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    주문 취소
                                  </DropdownMenuItem>
                                )}
                                {order.status === "cancelled" && (
                                  <DropdownMenuItem
                                    onClick={() => handleAction("restore", order.id)}
                                  >
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    주문 복원
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        );
                      }

                      // Render other columns normally
                      return (
                        <TableCell key={cell.id} className={meta?.className}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>

                  {/* Expanded row */}
                  {row.getIsExpanded() && (
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={table.getAllColumns().length}>
                        <ExpandedOrderRow order={order} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between px-4 py-4 border-t bg-muted/30">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">{totalCount.toLocaleString()}</span>개 중{" "}
          <span className="font-medium">{Math.min((page - 1) * pageSize + 1, totalCount).toLocaleString()}</span>
          {" "}-{" "}
          <span className="font-medium">{Math.min(page * pageSize, totalCount).toLocaleString()}</span> 표시
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            이전
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">페이지</span>
            <span className="text-sm font-medium min-w-[60px] text-center">
              {page} / {Math.ceil(totalCount / pageSize) || 1}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= Math.ceil(totalCount / pageSize)}
            className="gap-1"
          >
            다음
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
