type MarqueeRowProps = {
  items: string[];
  speed?: "fast" | "medium" | "slow";
  reverse?: boolean;
  separator?: string;
};

export function MarqueeRow({
  items,
  speed = "medium",
  reverse = false,
  separator = " · ",
}: MarqueeRowProps) {
  const segment = items.join(separator) + separator;
  const copies = 4;

  return (
    <div
      className={`marquee marquee--${speed}${reverse ? " marquee--reverse" : ""}`}
      aria-hidden="true"
    >
      <div className="marquee__viewport">
        <div className="marquee__track">
          {Array.from({ length: copies }).map((_, i) => (
            <span key={i} className="marquee__segment">
              {segment}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
