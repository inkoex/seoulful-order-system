import { cn } from "@/lib/utils";

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
    size?: 'narrow' | 'standard' | 'wide';
}

/**
 * A standard container for pages to ensure consistent maximum width and padding.
 * 
 * - narrow: max-w-md (approx 448px) - Best for simple forms or mobile-first views.
 * - standard: max-w-5xl (approx 1024px) - Best for typical content and smaller tables.
 * - wide: max-w-7xl (approx 1280px) - Best for dashboards and large data tables.
 */
export function PageContainer({ size = 'standard', className, ...props }: PageContainerProps) {
    const maxWidth = {
        narrow: 'max-w-md',
        standard: 'max-w-5xl',
        wide: 'max-w-7xl',
    }[size];

    return (
        <div
            className={cn("container mx-auto py-8 px-4 md:py-10", maxWidth, className)}
            {...props}
        />
    );
}
