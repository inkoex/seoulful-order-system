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
  CheckSquare,
  Trash2,
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
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

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
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [isBulkCancelOpen, setIsBulkCancelOpen] = useState(false);

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
                    <div className={cn("flex items-center gap-2", meta?.className?.includes("text-center") && "justify-center", meta?.className?.includes("text-right") && "justify-end")}>
                      <div
                        className={cn(
                          "flex items-center select-none",
                          canSort && "cursor-pointer"
                        )}
                        onClick={
                          canSort ? header.column.getToggleSortingHandler() : undefined
                        }
                      >
                        {/* Hidden balance spacer for centered headers with icons */}
                        {canSort && meta?.className?.includes("text-center") && (
                          <div className="w-4 h-4 mr-1 invisible shrink-0" aria-hidden="true" />
                        )}

                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}

                        {/* Sorting indicator */}
                        {canSort && (
                          <span className="ml-1 w-4 h-4 flex items-center justify-center shrink-0">
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
                    className={cn(
                      "group border-none transition-colors hover:bg-slate-50",
                      row.getIsExpanded() && "bg-slate-50/50"
                    )}
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

                      if (isActionsColumn) {
                        const order = row.original;
                        return (
                          <TableCell key={cell.id} className="text-right py-2 pr-4" data-actions-column>
                            <div className="flex items-center justify-end gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              {/* Quick Action: Status Change */}
                              {order.status === "received" && !order.is_locked && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAction("change_status", order.id, { status: "ready" });
                                  }}
                                >
                                  생산 완료
                                </Button>
                              )}

                              {order.status === "ready" && !order.is_locked && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAction("change_status", order.id, { status: "delivered" });
                                  }}
                                >
                                  배달 완료
                                </Button>
                              )}

                              {/* Quick Action: Unlock */}
                              {order.is_locked && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 border-slate-200 text-slate-600 hover:bg-slate-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAction("toggle_lock", order.id);
                                  }}
                                >
                                  <Unlock className="h-3.5 w-3.5 mr-1" />
                                  잠금해제
                                </Button>
                              )}

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <span className="sr-only">메뉴 열기</span>
                                    <div className="flex flex-col items-center gap-0.5">
                                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                    </div>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[180px]">
                                  <DropdownMenuLabel>상세 작업</DropdownMenuLabel>
                                  <DropdownMenuItem asChild>
                                    <Link to={`/admin/orders/${order.id}`}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      주문 상세 보기
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />

                                  <DropdownMenuItem
                                    onClick={() => handleAction("toggle_lock", order.id)}
                                  >
                                    {order.is_locked ? (
                                      <Unlock className="mr-2 h-4 w-4" />
                                    ) : (
                                      <Lock className="mr-2 h-4 w-4" />
                                    )}
                                    {order.is_locked ? "주문 잠금 해제" : "주문 잠금"}
                                  </DropdownMenuItem>

                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase px-2 py-1.5">상태 변경</DropdownMenuLabel>
                                  {statusOptions.map((opt) => (
                                    <DropdownMenuItem
                                      key={opt.value}
                                      disabled={order.status === opt.value || order.is_locked}
                                      onClick={() =>
                                        handleAction("change_status", order.id, {
                                          status: opt.value,
                                        })
                                      }
                                    >
                                      {opt.label}
                                    </DropdownMenuItem>
                                  ))}

                                  <DropdownMenuSeparator />
                                  {order.status !== "cancelled" ? (
                                    <DropdownMenuItem
                                      className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                      onClick={() => setCancelOrderId(order.id)}
                                    >
                                      <XCircle className="mr-2 h-4 w-4" />
                                      주문 취소
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem
                                      onClick={() => handleAction("restore", order.id)}
                                    >
                                      <RotateCcw className="mr-2 h-4 w-4" />
                                      주문 복구
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        );
                      }

                      return (
                        <TableCell key={cell.id} className={cn("py-2 px-4 whitespace-nowrap", meta?.className)}>
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

      <AlertDialog open={!!cancelOrderId} onOpenChange={(open) => !open && setCancelOrderId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>주문을 취소하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 되돌릴 수 있지만, 고객에게 취소 알림이 갈 수 있습니다. 정말로 취소하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>돌아가기</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (cancelOrderId) {
                  handleAction("cancel", cancelOrderId);
                  setCancelOrderId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              주문 취소
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isBulkCancelOpen} onOpenChange={setIsBulkCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{table.getSelectedRowModel().rows.length}개의 주문을 취소하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              선택한 모든 주문이 취소 상태로 변경됩니다. 이 작업은 되돌리기가 번거로울 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>돌아가기</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const orderIds = table.getSelectedRowModel().rows.map(r => r.original.id);
                handleAction("bulk_cancel", "multiple", {
                  orderIds: JSON.stringify(orderIds)
                });
                table.resetRowSelection();
                setIsBulkCancelOpen(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              일괄 취소 실행
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Action Floating Bar */}
      {
        table.getSelectedRowModel().rows.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-4 px-6 py-3 bg-slate-900 text-white rounded-full shadow-2xl ring-1 ring-white/10">
              <div className="flex items-center gap-2 border-r border-white/20 pr-4 mr-2">
                <div className="bg-brand-primary h-5 w-5 rounded flex items-center justify-center text-[10px] font-bold">
                  {table.getSelectedRowModel().rows.length}
                </div>
                <span className="text-sm font-medium">개 선택됨</span>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10 h-9"
                  onClick={() => {
                    const orderIds = table.getSelectedRowModel().rows.map(r => r.original.id);
                    handleAction("bulk_change_status", "multiple", {
                      status: "ready",
                      orderIds: JSON.stringify(orderIds)
                    });
                    table.resetRowSelection();
                  }}
                >
                  <CheckSquare className="h-4 w-4 mr-2 text-amber-400" />
                  생산 완료
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10 h-9"
                  onClick={() => {
                    const orderIds = table.getSelectedRowModel().rows.map(r => r.original.id);
                    handleAction("bulk_change_status", "multiple", {
                      status: "delivered",
                      orderIds: JSON.stringify(orderIds)
                    });
                    table.resetRowSelection();
                  }}
                >
                  <CheckSquare className="h-4 w-4 mr-2 text-blue-400" />
                  배달 완료
                </Button>

                <div className="w-[1px] h-4 bg-white/20 mx-1" />

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10 h-9"
                  onClick={() => {
                    const orderIds = table.getSelectedRowModel().rows.map(r => r.original.id);
                    handleAction("bulk_toggle_lock", "multiple", {
                      orderIds: JSON.stringify(orderIds)
                    });
                    table.resetRowSelection();
                  }}
                >
                  <Lock className="h-4 w-4 mr-2 text-slate-400" />
                  일괄 잠금/해제
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-400 hover:bg-red-500/10 h-9"
                  onClick={() => setIsBulkCancelOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  일괄 취소
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => table.resetRowSelection()}
                className="text-white/50 hover:text-white ml-2"
              >
                선택 해제
              </Button>
            </div>
          </div>
        )
      }

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
