import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useInView } from 'framer-motion';

type CountUpProps = {
  value: number;
  suffix?: string;
  durationMs?: number;
};

export const CountUp: React.FC<CountUpProps> = ({ value, suffix = '', durationMs = 1100 }) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, margin: '-15% 0px' });
  const [current, setCurrent] = useState(0);

  const formatted = useMemo(() => {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(current);
  }, [current]);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const from = 0;
    const to = Number.isFinite(value) ? value : 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (to - from) * eased);
      setCurrent(next);
      if (t < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [durationMs, inView, value]);

  return (
    <span ref={ref} className="tabular-nums">
      {formatted}
      {suffix}
    </span>
  );
};

