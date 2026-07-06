export const metadata = {
  title: "CostMCP",
  description: "Organized AI cost tracking for builders",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif", background: "#0b0f14", color: "#e8edf5" }}>
        {children}
      </body>
    </html>
  );
}
