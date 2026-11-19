import {toneFiles, createToneSelector} from './keyboardTones.js';
import {createSpatialSound} from './spatialSound.js';

export function attachKeyboardAudio(board, stage, controller) {
  const point = board.position.clone();
  const files = toneFiles;
  const selectTone = createToneSelector();
  const assetRoot = new URL('./audio/', document.baseURI);
  const sound = createSpatialSound(files, code => {
    const key = board.keys.get(code);
    point.set(key.x, 12, key.z); // Fixed switch housing in the assembled keyboard, mm.
    board.localToWorld(point);
    stage.camera.worldToLocal(point);
    return point.multiplyScalar(0.001);
  }, assetRoot);
  const unsubscribe = controller.subscribe(({type, code}) => {
    if (type === 'actuate' && board.keys.has(code)) {
      sound.play(code, selectTone(board.keys.get(code)));
    }
  });
  sound.ready.catch(error => {
    console.error(error);
    document.getElementById('status').textContent = '按键音效加载失败，请检查 public/audio';
  });
  window.addEventListener('pagehide', event => {
    if (!event.persisted) { unsubscribe(); sound.dispose(); }
  });
  return sound;
}
