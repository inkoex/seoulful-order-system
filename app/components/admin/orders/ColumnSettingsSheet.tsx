import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { type OrderTableSettings } from "@/models";
import { COLUMN_IDS, COLUMN_LABELS } from "@/lib/tableUtils";

interface ColumnSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: OrderTableSettings;
  onSettingsChange: (updates: Partial<OrderTableSettings>) => void;
  onReset: () => void;
}

interface SortableColumnItemProps {
  id: string;
  label: string;
  isVisible: boolean;
  isLocked: boolean;
  onVisibilityChange: (visible: boolean) => void;
}

function SortableColumnItem({
  id,
  label,
  isVisible,
  isLocked,
  onVisibilityChange,
}: SortableColumnItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: isLocked });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-background border rounded-md"
    >
      {/* Drag handle */}
      {!isLocked && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      {/* Checkbox */}
      <div className="flex items-center gap-2 flex-1">
        <Checkbox
          id={`column-${id}`}
          checked={isVisible}
          onCheckedChange={(checked) => onVisibilityChange(checked === true)}
          disabled={isLocked}
        />
        <Label
          htmlFor={`column-${id}`}
          className={`cursor-pointer ${isLocked ? "text-muted-foreground" : ""}`}
        >
          {label}
          {isLocked && <span className="ml-2 text-xs">(고정)</span>}
        </Label>
      </div>
    </div>
  );
}

/**
 * Settings panel for customizing table columns
 *
 * Features:
 * - Drag and drop to reorder columns
 * - Toggle column visibility with checkboxes
 * - Reset to default settings
 * - Locked columns (expand, actions) that can't be moved or hidden
 */
export function ColumnSettingsSheet({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
  onReset,
}: ColumnSettingsSheetProps) {
  const [localColumnOrder, setLocalColumnOrder] = useState<string[]>(
    settings.columnOrder
  );

  // Update local state when settings change
  useEffect(() => {
    setLocalColumnOrder(settings.columnOrder);
  }, [settings.columnOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localColumnOrder.indexOf(active.id as string);
      const newIndex = localColumnOrder.indexOf(over.id as string);

      const newOrder = arrayMove(localColumnOrder, oldIndex, newIndex);
      setLocalColumnOrder(newOrder);
      onSettingsChange({ columnOrder: newOrder });
    }
  };

  const handleVisibilityChange = (columnId: string, visible: boolean) => {
    onSettingsChange({
      columnVisibility: {
        ...settings.columnVisibility,
        [columnId]: visible,
      },
    });
  };

  // Separate locked columns (select, expand, actions) from draggable columns
  const lockedColumnIds: string[] = [
    COLUMN_IDS.SELECT,
    COLUMN_IDS.EXPAND,
    COLUMN_IDS.ACTIONS,
  ];
  const draggableColumnIds = localColumnOrder.filter(
    (id) => !lockedColumnIds.includes(id)
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>테이블 컬럼 설정</SheetTitle>
          <SheetDescription>
            컬럼을 드래그하여 순서를 변경하거나 체크박스로 표시 여부를 조정할 수 있습니다.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Fixed columns section */}
          <div>
            <h3 className="text-sm font-medium mb-3">고정 컬럼</h3>
            <div className="space-y-2">
              {lockedColumnIds.map((columnId) => (
                <SortableColumnItem
                  key={columnId}
                  id={columnId}
                  label={COLUMN_LABELS[columnId]}
                  isVisible={settings.columnVisibility[columnId]}
                  isLocked={true}
                  onVisibilityChange={(visible) =>
                    handleVisibilityChange(columnId, visible)
                  }
                />
              ))}
            </div>
          </div>

          <Separator />

          {/* Draggable columns section */}
          <div>
            <h3 className="text-sm font-medium mb-3">조정 가능한 컬럼</h3>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={draggableColumnIds}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {draggableColumnIds.map((columnId) => (
                    <SortableColumnItem
                      key={columnId}
                      id={columnId}
                      label={COLUMN_LABELS[columnId]}
                      isVisible={settings.columnVisibility[columnId]}
                      isLocked={false}
                      onVisibilityChange={(visible) =>
                        handleVisibilityChange(columnId, visible)
                      }
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <Separator />

          {/* Reset button */}
          <div className="pt-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                onReset();
                onOpenChange(false);
              }}
            >
              기본값으로 초기화
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
