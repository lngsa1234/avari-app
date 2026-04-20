'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import LocalVideo from './LocalVideo';
import RemoteVideo from './RemoteVideo';
import ScreenShareView from './ScreenShareView';

const TILE_ASPECT = 16 / 9;
const GAP_PX = 8;

// Pick (cols, rows) that maximize each tile's area given container dims,
// assuming a 16:9 aspect per tile. At equal area we prefer more cols
// (wider beats taller) since meeting grids read better that way.
function computeLayout(n, w, h) {
  if (n <= 0) return { cols: 1, rows: 1, tileW: 0, tileH: 0 };
  if (!w || !h) {
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    return { cols, rows, tileW: 0, tileH: 0 };
  }
  let best = { cols: 1, rows: n, tileW: 0, tileH: 0, area: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const availW = w - (cols - 1) * GAP_PX;
    const availH = h - (rows - 1) * GAP_PX;
    if (availW <= 0 || availH <= 0) continue;
    const cellW = availW / cols;
    const cellH = availH / rows;
    const tileW = Math.min(cellW, cellH * TILE_ASPECT);
    const tileH = tileW / TILE_ASPECT;
    const area = tileW * tileH;
    if (area >= best.area) {
      best = { cols, rows, tileW, tileH, area };
    }
  }
  return best;
}

/**
 * Video Grid Layout
 * Displays all participants as equal tiles.
 * Clicking a tile promotes that participant to speaker mode.
 */
export default function VideoGrid({
  // Local user
  localVideoRef,
  localVideoTrack,
  isVideoOff,
  isMuted,
  userName,
  accentColor = 'rose',

  // Remote participants
  remoteParticipants = [],
  providerType,

  // Screen share
  localScreenTrack = null,
  remoteScreenTrack = null,
  screenSharerName = '',
  onStopScreenShare,

  // Blur
  isBlurEnabled = false,
  isBlurSupported = false,
  isBlurLoading = false,
  onToggleBlur,
  blurCanvas = null,

  // Tile selection — called with 'local' or remote id/uid string
  onSelectSpeaker,
}) {
  const participantCount = remoteParticipants.length + 1; // +1 for local
  const hasScreenShare = localScreenTrack || remoteScreenTrack;
  const isLocalSharing = !!localScreenTrack;

  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { cols, rows, tileW, tileH } = useMemo(
    () => computeLayout(participantCount, dims.w, dims.h),
    [participantCount, dims.w, dims.h]
  );

  // Screen share layout: screen as main, cameras on the side (unchanged)
  if (hasScreenShare) {
    return (
      <div className="w-full h-full flex flex-col md:flex-row gap-2">
        {/* Main area: Screen share (large) */}
        <div className="flex-1 min-w-0">
          <ScreenShareView
            screenTrack={localScreenTrack || remoteScreenTrack}
            isLocal={isLocalSharing}
            providerType={providerType}
            sharerName={isLocalSharing ? userName : screenSharerName}
            onStopSharing={isLocalSharing ? onStopScreenShare : undefined}
          />
        </div>

        {/* Side panel: Camera views stacked vertically */}
        <div className="flex md:flex-col gap-2 md:w-48 lg:w-56 flex-shrink-0 overflow-x-auto md:overflow-y-auto md:overflow-x-hidden">
          {/* Local Video */}
          <div className="h-24 md:h-auto md:w-full aspect-video flex-shrink-0">
            <LocalVideo
              ref={localVideoRef}
              track={localVideoTrack}
              providerType={providerType}
              isVideoOff={isVideoOff}
              isMuted={isMuted}
              userName={userName}
              size="thumbnail"
              accentColor={accentColor}
              isBlurEnabled={isBlurEnabled}
              isBlurSupported={isBlurSupported}
              isBlurLoading={isBlurLoading}
              onToggleBlur={onToggleBlur}
              blurCanvas={blurCanvas}
            />
          </div>

          {/* Remote Videos */}
          {remoteParticipants.map((participant) => (
            <div
              key={participant.id || participant.uid}
              className="h-24 md:h-auto md:w-full aspect-video flex-shrink-0"
            >
              <RemoteVideo
                participant={participant}
                providerType={providerType}
                size="thumbnail"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Split tiles into full rows + an incomplete last row, so every tile stays
  // the same size and the last row is visually centered.
  const lastRowCount = participantCount - (rows - 1) * cols;
  const lastRowIncomplete = lastRowCount > 0 && lastRowCount < cols;
  const fullRowCount = lastRowIncomplete ? rows - 1 : rows;
  const fullRowTileCount = fullRowCount * cols;
  const ready = tileW > 0 && tileH > 0;

  const tiles = [
    {
      key: 'local',
      node: (
        <LocalVideo
          ref={localVideoRef}
          track={localVideoTrack}
          providerType={providerType}
          isVideoOff={isVideoOff}
          isMuted={isMuted}
          userName={userName}
          size="grid"
          accentColor={accentColor}
          isBlurEnabled={isBlurEnabled}
          isBlurSupported={isBlurSupported}
          isBlurLoading={isBlurLoading}
          onToggleBlur={onToggleBlur}
          blurCanvas={blurCanvas}
          onClick={onSelectSpeaker ? () => onSelectSpeaker('local') : undefined}
        />
      ),
    },
    ...remoteParticipants.map((participant) => {
      const pid = String(participant.id || participant.uid);
      return {
        key: pid,
        node: (
          <RemoteVideo
            participant={participant}
            providerType={providerType}
            size="grid"
            onClick={onSelectSpeaker ? () => onSelectSpeaker(pid) : undefined}
          />
        ),
      };
    }),
  ];

  const fullRowTiles = tiles.slice(0, fullRowTileCount);
  const lastRowTiles = lastRowIncomplete ? tiles.slice(fullRowTileCount) : [];

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col items-center justify-center"
      style={{ gap: `${GAP_PX}px` }}
    >
      {ready && fullRowCount > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, ${tileW}px)`,
            gridTemplateRows: `repeat(${fullRowCount}, ${tileH}px)`,
            gap: `${GAP_PX}px`,
          }}
        >
          {fullRowTiles.map((t) => (
            <div key={t.key} style={{ width: tileW, height: tileH }}>
              {t.node}
            </div>
          ))}
        </div>
      )}
      {ready && lastRowIncomplete && (
        <div style={{ display: 'flex', gap: `${GAP_PX}px` }}>
          {lastRowTiles.map((t) => (
            <div key={t.key} style={{ width: tileW, height: tileH }}>
              {t.node}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
