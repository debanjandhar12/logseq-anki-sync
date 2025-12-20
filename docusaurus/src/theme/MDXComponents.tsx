import React from 'react';
import MDXComponents from '@theme-original/MDXComponents';
import Zoom from 'react-medium-image-zoom';
import 'react-medium-image-zoom/dist/styles.css';
import '../css/lightbox.css';
import GifPlayer from '../components/GifPlayer';

export default {
  ...MDXComponents,
  GifPlayer,
  img: (props: any) => (
    <div className="rmiz-wrapper">
      <Zoom>
        <img {...props} style={{ cursor: 'zoom-in', ...props.style }} />
      </Zoom>
      <div className="rmiz-icon">⛶</div>
    </div>
  ),
};
