import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuantitySelectorProps {
    value: number;
    onChange: (value: number) => void;
    disabled?: boolean;
}

export function QuantitySelector({ value, onChange, disabled }: QuantitySelectorProps) {
    return (
        <div className="flex items-center gap-4 bg-brand-charcoal/5 p-1.5 rounded-2xl border-2 border-brand-charcoal/5">
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-xl hover:bg-white hover:shadow-sm transition-all"
                onClick={() => onChange(Math.max(0, value - 1))}
                disabled={disabled || value <= 0}
            >
                <Minus className="h-4 w-4 text-brand-charcoal/60" />
            </Button>
            <span className="text-xl font-black text-brand-charcoal w-8 text-center">{value}</span>
            <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-xl border-2 border-brand-primary/30 bg-brand-primary/5 hover:bg-brand-primary/10 transition-all font-bold"
                onClick={() => onChange(value + 1)}
                disabled={disabled}
            >
                <Plus className="h-4 w-4 text-brand-primary" />
            </Button>
        </div>
    );
}
