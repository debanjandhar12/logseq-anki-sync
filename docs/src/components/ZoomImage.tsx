import React from 'react';
import Zoom from 'react-medium-image-zoom';
import 'react-medium-image-zoom/dist/styles.css';

interface ZoomImageProps {
  src: string;
  alt: string;
}

export default function ZoomImage({ src, alt }: ZoomImageProps): JSX.Element {
  return (
    <Zoom>
      <img src={src} alt={alt} style={{ cursor: 'pointer' }} />
    </Zoom>
  );
}
