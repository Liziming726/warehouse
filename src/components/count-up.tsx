'use client';

import { useEffect, useRef, useState } from 'react';

type CountUpProps = {
  end: number;
  duration?: number;
};

export default function CountUp({ end, duration = 800 }: CountUpProps) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const startValueRef = useRef(0);

  useEffect(() => {
    startValueRef.current = value;
    startTimeRef.current = 0;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = Math.round(startValueRef.current + (end - startValueRef.current) * eased);
      setValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [end, duration]);

  return <>{value.toLocaleString()}</>;
}
