'use client';

import React, { useState } from 'react';

export function LoadingImg({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && <span className="img-loading">loading image...</span>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        style={loaded ? undefined : { display: 'none' }}
      />
    </>
  );
}
