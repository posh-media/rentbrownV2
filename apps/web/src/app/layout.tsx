import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "@rentbrown/ui/styles.css";
import { Providers } from "./providers";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RentBrown — Invest",
  description: "RentBrown investor portal",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={jakarta.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
