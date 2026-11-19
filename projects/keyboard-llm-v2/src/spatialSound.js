// readPosition(id) returns a listener-relative point in metres; front is -Z.
export function createSpatialSound(files, readPosition, assetRoot) {
  const context = new AudioContext();
  const mix = context.createGain();
  mix.gain.value = 0.85;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 3;
  limiter.ratio.value = 16;
  mix.connect(limiter).connect(context.destination);
  const buffers = new Map();
  const voices = new Set();
  const events = new AbortController();
  const unlock = () => {
    if (context.state !== 'running') context.resume().catch(console.warn);
  };
  for (const event of ['pointerdown', 'pointerup', 'keydown']) {
    window.addEventListener(event, unlock, {capture: true, signal: events.signal});
  }
  const ready = Promise.all(Object.entries(files).map(async ([kind, filename]) => {
    const response = await fetch(new URL(filename, assetRoot));
    if (!response.ok) throw new Error('无法读取音频 ' + filename);
    buffers.set(kind, await context.decodeAudioData(await response.arrayBuffer()));
  }));

  function place(voice, smooth) {
    const point = readPosition(voice.id);
    for (const axis of ['x', 'y', 'z']) {
      const param = voice.pan['position' + axis.toUpperCase()];
      if (smooth) param.setTargetAtTime(point[axis], context.currentTime, 0.008);
      else param.value = point[axis];
    }
  }
  function play(id, kind) {
    if (context.state !== 'running' || !buffers.has(kind)) return;
    const source = context.createBufferSource();
    source.buffer = buffers.get(kind);
    const pan = context.createPanner();
    pan.panningModel = 'HRTF';
    pan.distanceModel = 'inverse';
    pan.refDistance = 0.22;
    pan.rolloffFactor = 1;
    const voice = {id, pan, source};
    place(voice, false);
    source.connect(pan).connect(mix);
    voices.add(voice);
    source.onended = () => {
      voices.delete(voice);
      source.disconnect();
      pan.disconnect();
    };
    source.start();
  }
  function dispose() {
    events.abort();
    for (const voice of voices) voice.source.stop();
    context.close().catch(console.warn);
  }
  return {ready, play, update() { for (const voice of voices) place(voice, true); }, dispose};
}
