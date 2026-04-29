import { ScanVizMemo } from '../viz/ScanViz.jsx';

export function HeroImage({
  imgPreview, imgUrl, svgUrl,
  rdEnabled, rdDispRef, imgSize,
  scanY, yMod, pat, maps, scanProg,
  phRef, phGRef,
  imgRef, imgFileRef, svgFileRef,
  onImgLoad,
}) {
  return (
    <div
      style={{
        flex: 1, position: 'relative', minHeight: 340, background: '#000',
        overflow: 'hidden', cursor: !imgPreview ? 'pointer' : 'default',
      }}
      onClick={() => !imgPreview && imgFileRef.current?.click()}
    >
      {imgPreview ? (
        <>
          {/* Original photo — shown behind RD when evolving */}
          <img
            ref={imgRef}
            src={imgPreview}
            alt=""
            style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              opacity: rdEnabled ? 0 : 1,
              position: rdEnabled ? 'absolute' : 'relative',
            }}
            onLoad={onImgLoad}
          />

          {/* WebGL RD canvas — displayed when evolving */}
          {rdEnabled && (
            <canvas
              ref={el => {
                rdDispRef.current = el;
                if (el) { el.width = imgSize.w || 800; el.height = imgSize.h || 400; }
              }}
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
              }}
            />
          )}

          {/* Illustrator SVG overlay — 30% opacity, purely visual */}
          {svgUrl && (
            <img
              src={svgUrl}
              alt="SVG overlay"
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                objectFit: 'cover', opacity: 0.30, pointerEvents: 'none',
                mixBlendMode: 'screen',
              }}
            />
          )}

          {/* Scan viz — memoized static paths + dots */}
          <ScanVizMemo
            scanY={scanY} yMod={yMod} pat={pat} maps={maps}
            W={imgSize.w} H={imgSize.h} scanProgress={scanProg}
          />

          {/* Playhead — DOM updated via ref.setAttribute only */}
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            viewBox="0 0 100 100" preserveAspectRatio="none"
          >
            <line ref={phGRef} x1="-10%" y1="0" x2="-10%" y2="100"
              stroke="#fff" strokeWidth="5" strokeOpacity="0.05" vectorEffect="non-scaling-stroke" />
            <line ref={phRef} x1="-10%" y1="0" x2="-10%" y2="100"
              stroke="#fff" strokeWidth="0.8" strokeOpacity="0.65" vectorEffect="non-scaling-stroke" />
          </svg>

          {/* CRT scanline overlay */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,.09) 3px,rgba(0,0,0,.09) 4px)',
          }} />

          {/* Swap buttons */}
          <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
            <div
              onClick={e => { e.stopPropagation(); imgFileRef.current?.click(); }}
              style={{
                fontSize: 7, color: '#ffffff44', cursor: 'pointer', padding: '3px 6px',
                background: 'rgba(0,0,0,.55)', border: '1px solid #ffffff22', letterSpacing: '.1em',
              }}
            >IMG</div>
            <div
              onClick={e => { e.stopPropagation(); svgFileRef.current?.click(); }}
              style={{
                fontSize: 7, color: '#00ff4188', cursor: 'pointer', padding: '3px 6px',
                background: 'rgba(0,0,0,.55)', border: '1px solid #00ff4133', letterSpacing: '.1em',
              }}
            >SVG</div>
          </div>
        </>
      ) : (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%', minHeight: 340, color: '#002200', gap: 10,
        }}>
          <div style={{ fontSize: 52 }}>⬡</div>
          <div style={{ fontSize: 9, letterSpacing: '.2em' }}>CLICK — LOAD IMAGE</div>
        </div>
      )}

      <input ref={imgFileRef} type="file" accept="image/*" onChange={e => {
        const file = e.target.files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => imgFileRef.current._onLoad?.(ev.target.result);
        reader.readAsDataURL(file);
      }} style={{ display: 'none' }} />
      <input ref={svgFileRef} type="file" accept=".svg,image/svg+xml" onChange={e => {
        const file = e.target.files?.[0]; if (!file) return;
        svgFileRef.current._onLoad?.(file);
      }} style={{ display: 'none' }} />
    </div>
  );
}
