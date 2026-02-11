import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  useNavigation,
  Scripts,
  ScrollRestoration,
} from "react-router";

import { Toaster } from "./components/ui/sonner";
import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Work+Sans:ital,wght@0,100..900;1,100..900&family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";

  return (
    <>
      {isLoading && (
        <div className="fixed inset-x-0 top-0 z-50">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 animate-pulse" />
          <div className="flex justify-center">
            <div className="mt-3 rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200">
              로딩 중...
            </div>
          </div>
        </div>
      )}
      <Outlet />
      <Toaster position="top-center" richColors />
    </>
  );
}

import { FileQuestion, AlertCircle, Home, ShoppingBag, RefreshCcw } from "lucide-react";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./components/ui/card";
import { PageContainer } from "./components/ui/container";
import { Link } from "react-router";

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let is404 = false;

  if (isRouteErrorResponse(error)) {
    is404 = error.status === 404;
    message = is404 ? "404" : "Error";
    details = is404
      ? "The requested page could not be found."
      : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
  }

  return (
    <div className="min-h-screen bg-brand-background font-sans flex flex-col items-center justify-center p-4">
      <PageContainer size="narrow" className="w-full">
        <Card className="text-center rounded-[2rem] shadow-2xl border-none bg-gradient-to-br from-white via-white to-brand-background/30 overflow-hidden">
          <CardHeader className="space-y-6 pb-8 pt-12">
            {/* Icon container with animation */}
            <div className="mx-auto relative animate-dynamic-reveal">
              <div className="h-28 w-28 rounded-full bg-brand-primary/10 flex items-center justify-center backdrop-blur-sm">
                <div className="h-24 w-24 rounded-full bg-brand-primary/20 flex items-center justify-center">
                  {is404 ? (
                    <FileQuestion className="h-14 w-14 text-brand-primary" strokeWidth={2} />
                  ) : (
                    <AlertCircle className="h-14 w-14 text-brand-primary" strokeWidth={2} />
                  )}
                </div>
              </div>
            </div>

            {/* Error Message */}
            <div className="space-y-4">
              <div className="space-y-2">
                <span className="section-label">{is404 ? "Not Found" : "System Error"}</span>
                <CardTitle className="text-3xl md:text-4xl font-black text-brand-charcoal">
                  {is404 ? "Where are we?" : "Something went wrong"}
                </CardTitle>
                <div className="text-lg font-light text-brand-charcoal/50 space-y-1">
                  <p>{is404 ? "We couldn't find this page." : "We've encountered an unexpected issue."}</p>
                  <p className="text-sm">
                    {is404 ? "요청하신 페이지를 찾을 수 없습니다." : "알 수 없는 오류가 발생했습니다."}
                  </p>
                </div>
              </div>
              <div className="mx-auto section-divider w-16 bg-brand-primary"></div>
            </div>
          </CardHeader>

          <CardContent className="pb-8">
            <p className="text-brand-charcoal/60 leading-relaxed max-w-xs mx-auto">
              {is404
                ? "The link might be broken or the page has been moved."
                : "Our bakers are looking into it. Please try refreshing the page."}
            </p>

            {!is404 && import.meta.env.DEV && error instanceof Error && (
              <div className="mt-6 p-4 bg-red-50 rounded-xl text-left overflow-auto max-h-40">
                <p className="text-xs font-mono text-red-800 leading-tight">
                  {error.stack}
                </p>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col sm:flex-row gap-3 justify-center pb-12 px-8">
            <Button asChild variant="outline" className="w-full sm:w-auto h-14 rounded-xl border-2 border-brand-charcoal/10 hover:border-brand-primary hover:bg-brand-primary/5">
              <Link to="/">
                <Home className="mr-2 h-5 w-5" />
                <span>Go Home</span>
              </Link>
            </Button>

            {is404 ? (
              <Button asChild variant="premium" className="w-full sm:w-auto">
                <Link to="/order">
                  <ShoppingBag className="mr-2 h-5 w-5" />
                  <span>Go to Order</span>
                </Link>
              </Button>
            ) : (
              <Button
                variant="premium"
                className="w-full sm:w-auto"
                onClick={() => window.location.reload()}
              >
                <RefreshCcw className="mr-2 h-5 w-5" />
                <span>Try Again</span>
              </Button>
            )}
          </CardFooter>
        </Card>
      </PageContainer>

      {/* Footer Branding */}
      <div className="mt-8 text-center animate-dynamic-reveal [animation-delay:400ms]">
        <Link to="/" className="text-xl font-black tracking-tighter text-brand-charcoal/20 hover:text-brand-primary transition-colors">
          Seoulful<span className="text-brand-primary/20">.</span>
        </Link>
      </div>
    </div>
  );
}
