/** Minimum visible paint splash beyond glyph edge (px). */
export const MIN_PAINT_BLEED_PX = 10;

type HeroTextPaintProps = {
  children: string;
  variant?: "word" | "cost";
};

export function HeroPaintDefs() {
  return (
    <svg className="hero__paint-filter-defs" aria-hidden width="0" height="0">
      <defs>
        <filter
          id="hero-paint-filter-word"
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
          colorInterpolationFilters="sRGB"
        >
          <feMorphology
            operator="dilate"
            radius="3 3"
            in="SourceGraphic"
            result="expanded"
          />
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.07 0.05"
            numOctaves="3"
            seed="11"
            result="noise"
          />
          <feDisplacementMap
            in="expanded"
            in2="noise"
            scale="5"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <filter
          id="hero-paint-filter-cost"
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
          colorInterpolationFilters="sRGB"
        >
          <feMorphology
            operator="dilate"
            radius="5 5"
            in="SourceGraphic"
            result="expanded"
          />
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.05 0.04"
            numOctaves="4"
            seed="17"
            result="noise"
          />
          <feDisplacementMap
            in="expanded"
            in2="noise"
            scale="6"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}

export function HeroTextPaint({ children, variant = "word" }: HeroTextPaintProps) {
  return (
    <span
      className={`hero__paint-stack hero__paint-stack--${variant}`}
      aria-hidden
    >
      <span className="hero__paint-stroke hero__paint-stroke--edge">{children}</span>
      <span className="hero__paint-stroke hero__paint-stroke--core">{children}</span>
    </span>
  );
}
