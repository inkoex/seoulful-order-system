import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { PanelLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";

type SidebarContextValue = {
    open: boolean;
    setOpen: (value: boolean) => void;
    openMobile: boolean;
    setOpenMobile: (value: boolean) => void;
    isMobile: boolean;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function useSidebarContext() {
    const context = React.useContext(SidebarContext);
    if (!context) {
        throw new Error("useSidebarContext must be used within SidebarProvider");
    }
    return context;
}

function useIsMobile() {
    const [isMobile, setIsMobile] = React.useState(false);

    React.useEffect(() => {
        if (typeof window === "undefined") return;
        const mediaQuery = window.matchMedia("(max-width: 1023px)");

        const update = () => setIsMobile(mediaQuery.matches);
        update();

        mediaQuery.addEventListener("change", update);
        return () => mediaQuery.removeEventListener("change", update);
    }, []);

    return isMobile;
}

function SidebarProvider({
    defaultOpen = true,
    children,
}: {
    defaultOpen?: boolean;
    children: React.ReactNode;
}) {
    const isMobile = useIsMobile();
    const [open, setOpen] = React.useState(defaultOpen);
    const [openMobile, setOpenMobile] = React.useState(false);

    return (
        <SidebarContext.Provider value={{ open, setOpen, openMobile, setOpenMobile, isMobile }}>
            {children}
        </SidebarContext.Provider>
    );
}

const sidebarVariants = cva(
    "group/sidebar relative flex h-svh flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out",
    {
        variants: {
            collapsible: {
                none: "",
                icon: "[--sidebar-width:4rem]",
                offcanvas: "",
            },
        },
        defaultVariants: {
            collapsible: "offcanvas",
        },
    }
);

const Sidebar = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof sidebarVariants>
>(({ className, collapsible, children, ...props }, ref) => {
    const { open, setOpen, openMobile, setOpenMobile, isMobile } = useSidebarContext();

    if (isMobile) {
        return (
            <Sheet open={openMobile} onOpenChange={setOpenMobile}>
                <SheetContent side="left" className="w-64 p-0">
                    <div className="flex h-full flex-col">{children}</div>
                </SheetContent>
            </Sheet>
        );
    }

    return (
        <div
            ref={ref}
            data-state={open ? "expanded" : "collapsed"}
            className={cn(
                sidebarVariants({ collapsible }),
                "overflow-x-hidden",
                open ? "w-64" : "w-16",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
});
Sidebar.displayName = "Sidebar";

const SidebarHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn(
                "flex items-center justify-start border-b px-4 py-3 transition-all duration-300",
                className
            )}
            {...props}
        />
    )
);
SidebarHeader.displayName = "SidebarHeader";

const SidebarFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn("border-t px-4 py-3", className)} {...props} />
    )
);
SidebarFooter.displayName = "SidebarFooter";

const SidebarContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn("flex-1 overflow-y-auto", className)} {...props} />
    )
);
SidebarContent.displayName = "SidebarContent";

const SidebarGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn("space-y-2 px-4 py-3", className)} {...props} />
    )
);
SidebarGroup.displayName = "SidebarGroup";

const SidebarGroupLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => {
        const { open } = useSidebarContext();
        return (
            <div
                ref={ref}
                className={cn(
                    "text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-all duration-300 overflow-hidden whitespace-nowrap",
                    open ? "opacity-100" : "opacity-0 -translate-x-4 w-0",
                    className
                )}
                {...props}
            />
        );
    }
);
SidebarGroupLabel.displayName = "SidebarGroupLabel";

const SidebarGroupContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn("space-y-1", className)} {...props} />
    )
);
SidebarGroupContent.displayName = "SidebarGroupContent";

const SidebarMenu = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn("space-y-1", className)} {...props} />
    )
);
SidebarMenu.displayName = "SidebarMenu";

const SidebarMenuItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn("", className)} {...props} />
    )
);
SidebarMenuItem.displayName = "SidebarMenuItem";

const sidebarMenuButtonVariants = cva(
    "flex w-full items-center justify-start rounded-md px-2 py-2 text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring overflow-hidden whitespace-nowrap group-data-[state=collapsed]/sidebar:gap-0",
    {
        variants: {
            variant: {
                default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                active: "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

const SidebarMenuButton = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof sidebarMenuButtonVariants> & { asChild?: boolean }
>(({ className, variant, asChild = false, ...props }, ref) => {
    const { open } = useSidebarContext();
    const Comp = asChild ? Slot : "button";
    return (
        <Comp
            ref={ref}
            className={cn(
                sidebarMenuButtonVariants({ variant }),
                "relative flex items-center shrink-0",
                className
            )}
            {...props}
        />
    );
});
SidebarMenuButton.displayName = "SidebarMenuButton";

const SidebarRail = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
    ({ className, ...props }, ref) => (
        <button
            ref={ref}
            className={cn(
                "absolute -right-3 top-12 hidden h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition hover:text-foreground lg:inline-flex",
                className
            )}
            type="button"
            aria-label="Toggle sidebar"
            {...props}
        />
    )
);
SidebarRail.displayName = "SidebarRail";

const SidebarTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
    ({ className, ...props }, ref) => {
        const { open, setOpen, openMobile, setOpenMobile, isMobile } = useSidebarContext();
        return (
            <Button
                ref={ref}
                variant="outline"
                size="icon"
                className={className}
                type="button"
                onClick={() => (isMobile ? setOpenMobile(!openMobile) : setOpen(!open))}
                {...props}
            >
                <PanelLeft className="h-4 w-4" />
            </Button>
        );
    }
);
SidebarTrigger.displayName = "SidebarTrigger";

const SidebarInset = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn("flex min-h-svh w-full flex-1 flex-col", className)} {...props} />
    )
);
SidebarInset.displayName = "SidebarInset";

export {
    Sidebar,
    SidebarProvider,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarInset,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    SidebarTrigger,
};
