"use client";

import "./globals.css";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import { ThemeProvider, NO_FLASH_SCRIPT } from "@/lib/theme";
import { AuthProvider } from "@/lib/AuthContext";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const authRoutes = ["/login", "/signup", "/forgot-password", "/reset-password"];
  const hideShell = authRoutes.includes(pathname);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body style={{ background: "var(--bg)", color: "var(--text-primary)" }}>
        <ThemeProvider>
          <AuthProvider>
            {hideShell ? (
              <main>{children}</main>
            ) : (
              <>
                <Sidebar />
                <Navbar />
                <main className="ml-64 mt-16 p-6 min-h-screen" style={{ background: "var(--bg)" }}>
                  {children}
                </main>
              </>
            )}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
