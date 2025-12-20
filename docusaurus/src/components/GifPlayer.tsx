import React, { useState, useRef, useEffect } from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import { parseGIF, decompressFrames } from 'gifuct-js';

export type GifPlayerProps = {
  gif: string;
  still?: string;
  alt?: string;
  caption?: string;
};

const GifPlayer: React.FC<GifPlayerProps> = ({ gif, still, alt, caption }) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [frames, setFrames] = useState<any[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const [gifDims, setGifDims] = useState({ width: 0, height: 0 });
  const [canvasSupported, setCanvasSupported] = useState(true);
  const gifUrl = useBaseUrl(gif);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    setCanvasSupported(!!(canvas.getContext && canvas.getContext('2d')));
  }, []);

  useEffect(() => {
    fetch(gifUrl)
      .then(resp => resp.arrayBuffer())
      .then(buff => {
        const gif = parseGIF(buff);
        const frames = decompressFrames(gif, true);
        setFrames(frames);
        if (frames.length > 0) {
          setGifDims({ width: gif.lsd.width, height: gif.lsd.height });
        }
      });
  }, [gifUrl]);

  useEffect(() => {
    if (!canvasRef.current || !gifDims.width) return;
    const canvas = canvasRef.current;
    canvas.width = gifDims.width;
    canvas.height = gifDims.height;
  }, [gifDims]);

  useEffect(() => {
    if (!frames.length || !canvasRef.current || !gifDims.width) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const frame = frames[currentFrameIndex];
    const dims = frame.dims;

    // specific cleanup for first frame or loop restart
    if (currentFrameIndex === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = dims.width;
    tempCanvas.height = dims.height;
    const tempCtx = tempCanvas.getContext('2d');

    if (tempCtx) {
      const frameImageData = tempCtx.createImageData(dims.width, dims.height);
      frameImageData.data.set(frame.patch);
      tempCtx.putImageData(frameImageData, 0, 0);
      ctx.drawImage(tempCanvas, dims.left, dims.top);
    }

    let timeoutId: number;
    if (isPlaying) {
      const delay = frame.delay || 100;
      timeoutId = window.setTimeout(() => {
        // Handle disposal before moving to next frame
        // disposalType: 2 -> Restore to background value (clear)
        // disposalType: 3 -> Restore to previous (not implemented, treating as keep)
        if (frame.disposalType === 2) {
          ctx.clearRect(dims.left, dims.top, dims.width, dims.height);
        }
        setCurrentFrameIndex((currentFrameIndex + 1) % frames.length);
      }, delay);
      animationRef.current = timeoutId;
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [frames, currentFrameIndex, isPlaying, gifDims]);

  return (
    <figure className="gif-player" style={{ margin: '1rem 0', position: 'relative' }}>
      {canvasSupported ? (
        <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
          <canvas
            ref={canvasRef}
            style={{
              maxWidth: '100%',
              height: 'auto',
              display: 'block',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          />
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              background: 'rgba(0, 0, 0, 0.7)',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {isPlaying ? '⏸' : '▶'} {isPlaying ? 'Pause' : 'Play'}
          </button>
        </div>
      ) : (
        <img
          src={gifUrl}
          alt={alt}
          style={{
            maxWidth: '100%',
            height: 'auto',
            display: 'block',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
        />
      )}
      {caption && <figcaption style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--ifm-color-emphasis-600)' }}>{caption}</figcaption>}
    </figure>
  );
};

export default GifPlayer;
