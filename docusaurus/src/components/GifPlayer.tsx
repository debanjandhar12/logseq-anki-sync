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
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const gifUrl = useBaseUrl(gif);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!frames.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = x / rect.width;
    const targetFrame = Math.floor(progress * frames.length);
    setCurrentFrameIndex(Math.max(0, Math.min(targetFrame, frames.length - 1)));
  };

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
        setIsLoading(false);
      });
  }, [gifUrl]);

  useEffect(() => {
    if (!canvasRef.current || !gifDims.width) return;
    const canvas = canvasRef.current;
    canvas.width = gifDims.width;
    canvas.height = gifDims.height;
  }, [gifDims]);

  const lastRenderedIndexRef = useRef(-1);

  useEffect(() => {
    if (!frames.length || !canvasRef.current || !gifDims.width) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawFrame = (frame: any) => {
      const dims = frame.dims;
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
    };

    const disposeFrame = (frame: any) => {
      if (frame.disposalType === 2) {
        ctx.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
      }
    };

    // If we're at the same frame as last time (e.g. paused/resumed),
    // or if we just moved to the immediate next frame, we don't need to rebuild.
    // However, if we played, the previous cleanup step would have handled disposal.
    // If we just paused, we do nothing rendering-wise.
    // If we seeked (index changed non-sequentially), we must rebuild.

    // Check if sequential:
    // We treat "last + 1" as sequential. 
    // Also handling case where we might be re-running effect on same frame due to isPlaying toggle.
    const isSequential = currentFrameIndex === lastRenderedIndexRef.current + 1;
    const isSameFrame = currentFrameIndex === lastRenderedIndexRef.current;

    if (!isSequential && !isSameFrame) {
      // Seek or loop reset: rebuild from 0
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i <= currentFrameIndex; i++) {
        drawFrame(frames[i]);
        // Apply disposal for all frames leading up to current
        if (i < currentFrameIndex) {
          disposeFrame(frames[i]);
        }
      }
    } else if (isSequential) {
      // Ensure previous frame is disposed
      if (lastRenderedIndexRef.current >= 0) {
        disposeFrame(frames[lastRenderedIndexRef.current]);
      }
      // Just draw the new frame
      drawFrame(frames[currentFrameIndex]);
    }
    // if isSameFrame, we do nothing (canvas is already valid)

    lastRenderedIndexRef.current = currentFrameIndex;

    let timeoutId: number;
    if (isPlaying) {
      const frame = frames[currentFrameIndex];
      const delay = frame.delay || 100;
      timeoutId = window.setTimeout(() => {
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
        <div
          style={{ position: 'relative', display: 'inline-block', width: '100%' }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {isLoading && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '8px',
                minHeight: '200px'
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  border: '3px solid rgba(255, 255, 255, 0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}
              />
            </div>
          )}
          <canvas
            ref={canvasRef}
            onClick={() => setIsPlaying(!isPlaying)}
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
              display: isHovered ? 'flex' : 'none',
              alignItems: 'center',
              gap: '6px',
              userSelect: 'none'
            }}
          >
            {isPlaying ? '⏸' : '▶'} {isPlaying ? 'Pause' : 'Play'}
          </button>
          {isHovered && frames.length > 0 && (
            <div
              onClick={handleSeek}
              style={{
                position: 'absolute',
                bottom: '60px',
                left: '12px',
                right: '12px',
                height: '6px',
                background: 'rgba(0, 0, 0, 0.4)',
                borderRadius: '3px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
              }}
            >
              <div
                style={{
                  width: `${((currentFrameIndex + 1) / frames.length) * 100}%`,
                  height: '100%',
                  background: '#007acc',
                  borderRadius: '3px',
                  transition: 'width 0.1s ease',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)'
                }}
              />
            </div>
          )}
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
