import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Rookery — Make chess your own",
    template: "%s · Rookery",
  },
  description:
    "Create, share, remix, and play expressive chess variants in your browser.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#171714",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
