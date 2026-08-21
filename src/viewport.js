const MAX_STANDALONE_COMPENSATION = 96;

export function calculateStandaloneBottomCompensation(screenHeight, viewportHeight, safeTop = 0) {
  const values = [screenHeight, viewportHeight, safeTop].map(Number);
  if (!values.every(Number.isFinite)) return 0;

  const [screen, viewport, topInset] = values;
  return Math.min(
    MAX_STANDALONE_COMPENSATION,
    Math.max(0, Math.round(screen - viewport - Math.max(0, topInset))),
  );
}

function isIosDevice(windowRef) {
  const { navigator } = windowRef;
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone(windowRef) {
  return windowRef.navigator.standalone === true
    || windowRef.matchMedia('(display-mode: standalone)').matches;
}

export function installStandaloneViewportCompensation(windowRef = window) {
  if (!isIosDevice(windowRef) || !isStandalone(windowRef)) return;

  const { document, screen } = windowRef;
  const root = document.documentElement;
  const update = () => {
    const safeTop = Number.parseFloat(
      windowRef.getComputedStyle(root).getPropertyValue('--safe-area-top'),
    ) || 0;
    const compensation = calculateStandaloneBottomCompensation(
      screen.height,
      windowRef.innerHeight,
      safeTop,
    );
    root.style.setProperty('--standalone-bottom-compensation', `${compensation}px`);
  };

  update();
  windowRef.addEventListener('resize', update, { passive: true });
  windowRef.addEventListener('pageshow', update, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') update();
  });
}
