import React from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';

export type GifPlayerProps = {
  gif: string;
  still?: string;
  alt?: string;
  caption?: string;
};

const GifPlayer: React.FC<GifPlayerProps> = ({gif, still, alt, caption}) => {
  return (
    <figure className="gif-player">
      <BrowserOnly fallback={<img src={still ?? gif} alt={alt} />}>
        {() => {
          const ReactGifPlayer = require('react-gif-player').default;
          return <ReactGifPlayer gif={gif} still={still ?? gif} title={alt} />;
        }}
      </BrowserOnly>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
};

export default GifPlayer;
