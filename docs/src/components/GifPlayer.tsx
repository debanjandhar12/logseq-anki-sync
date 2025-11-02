import React from 'react';
import ReactGifPlayer from 'react-gif-player';

export type GifPlayerProps = {
  gif: string;
  still?: string;
  alt?: string;
  caption?: string;
};

const GifPlayer: React.FC<GifPlayerProps> = ({gif, still, alt, caption}) => {
  return (
    <figure className="gif-player">
      <ReactGifPlayer gif={gif} still={still ?? gif} title={alt} />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
};

export default GifPlayer;
