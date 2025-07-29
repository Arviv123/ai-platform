import type { Metadata, Viewport } from "next";
import { Inter, Fira_Code } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { ErrorProvider } from "@/contexts/ErrorContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import ErrorDisplay, { ErrorLoadingSpinner } from "@/components/ErrorDisplay";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Platform - Enterprise AI Management",
  description: "Advanced AI platform with MCP integration, multi-tenancy, and enterprise security",
  keywords: ["AI", "MCP", "Enterprise", "Machine Learning", "Artificial Intelligence"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${firaCode.variable} font-sans antialiased bg-background text-foreground`}
      >
        <ErrorBoundary>
          <ErrorProvider>
            <AuthProvider>
              <ToastProvider>
                <ErrorDisplay />
                <ErrorLoadingSpinner />
                {children}
              </ToastProvider>
            </AuthProvider>
          </ErrorProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
