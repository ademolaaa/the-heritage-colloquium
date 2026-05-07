import React, { useMemo, useState } from 'react';

type SmartImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string;
  fallbackSrc: string;
};

export const SmartImage: React.FC<SmartImageProps> = ({ src, fallbackSrc, onError, ...props }) => {
  const [failed, setFailed] = useState(false);

  const effectiveSrc = useMemo(() => {
    return failed ? fallbackSrc : src;
  }, [failed, fallbackSrc, src]);

  return (
    <img
      {...props}
      src={effectiveSrc}
      onError={(e) => {
        setFailed(true);
        onError?.(e);
      }}
    />
  );
};

