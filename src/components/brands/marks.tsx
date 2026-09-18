import type { ProviderId } from "@/lib/integrations";
import type { ReactElement, SVGProps } from "react";

type MarkProps = SVGProps<SVGSVGElement>;

function Svg(props: MarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width="32"
      height="32"
      aria-hidden="true"
      {...props}
    />
  );
}

function GarminMark(props: MarkProps) {
  return (
    <Svg {...props}>
      <rect width="32" height="32" rx="8" fill="#007CC3" />
      <path fill="#fff" d="M9 22.5 16 8l7 14.5h-3.1L16 14.2l-3.9 8.3H9Z" />
    </Svg>
  );
}

function CorosMark(props: MarkProps) {
  return (
    <Svg {...props}>
      <rect width="32" height="32" rx="8" fill="#111" />
      <path
        fill="#fff"
        d="M16 7.2c-4.9 0-8.8 3.8-8.8 8.8s3.9 8.8 8.8 8.8c3.4 0 6.4-1.8 7.9-4.6l-3.3-1.7c-.8 1.6-2.5 2.6-4.6 2.6-2.8 0-5-2.2-5-5.1s2.2-5.1 5-5.1c2.1 0 3.8 1 4.6 2.6l3.3-1.7C22.4 9 19.4 7.2 16 7.2Z"
      />
    </Svg>
  );
}

function PolarMark(props: MarkProps) {
  return (
    <Svg {...props}>
      <rect width="32" height="32" rx="8" fill="#E30613" />
      <path
        fill="#fff"
        d="M7 17h3.2l1.3-3.4 1.6 7.2 2.2-9.6 1.7 6.8H19l1.1-2.8H25v-2.2h-6.2l-.8 2L16.4 7h-2.6L12.3 14 11.2 11H8.6L7 17Z"
      />
    </Svg>
  );
}

function StravaMark(props: MarkProps) {
  return (
    <Svg {...props}>
      <rect width="32" height="32" rx="8" fill="#FC4C02" />
      <path fill="#fff" d="M13.2 7 8 18.2h3.3L13.2 14l1.9 4.2H18.4L13.2 7Zm6.2 7.2-1.7 3.6h2.5L22 22.8h3.2l-5.8-8.6Z" />
    </Svg>
  );
}

function AppleMark(props: MarkProps) {
  return (
    <Svg {...props}>
      <rect width="32" height="32" rx="8" fill="#111" />
      <path
        fill="#fff"
        d="M16 22c4.2-3.1 6.2-5.6 6.2-8.1 0-2-1.5-3.4-3.4-3.4-1.2 0-2.2.6-2.8 1.6-.6-1-1.6-1.6-2.8-1.6-1.9 0-3.4 1.4-3.4 3.4 0 2.5 2 5 6.2 8.1Z"
      />
    </Svg>
  );
}

function WahooMark(props: MarkProps) {
  return (
    <Svg {...props}>
      <rect width="32" height="32" rx="8" fill="#00A3E0" />
      <path fill="#fff" d="M7 21.2 11.2 9h3.1L16 15.4 17.7 9h3.1l4.2 12.2h-3.2l-2.4-7.5-1.8 7.5h-3.2l-1.8-7.5-2.4 7.5H7Z" />
    </Svg>
  );
}

function SuuntoMark(props: MarkProps) {
  return (
    <Svg {...props}>
      <rect width="32" height="32" rx="8" fill="#C8102E" />
      <circle cx="16" cy="16" r="7.2" fill="none" stroke="#fff" strokeWidth="2.2" />
      <circle cx="16" cy="16" r="2" fill="#fff" />
    </Svg>
  );
}

function FitMark(props: MarkProps) {
  return (
    <Svg {...props}>
      <rect width="32" height="32" rx="8" fill="#2c4a3c" />
      <path
        fill="#fff"
        d="M11 8h7l5 5v11a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Zm6 1.8V14h4.2L17 9.8Z"
      />
    </Svg>
  );
}

export const BRAND_MARKS: Record<
  ProviderId,
  (props: MarkProps) => ReactElement
> = {
  garmin: GarminMark,
  coros: CorosMark,
  polar: PolarMark,
  strava: StravaMark,
  apple: AppleMark,
  wahoo: WahooMark,
  suunto: SuuntoMark,
  fit: FitMark,
};
