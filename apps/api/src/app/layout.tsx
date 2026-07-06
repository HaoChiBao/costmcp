export const metadata = {
  title: "CostMCP API",
  description: "AI-native cost ledger for builders",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
