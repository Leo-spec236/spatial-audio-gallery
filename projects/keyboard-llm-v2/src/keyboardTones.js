const families = ['unit', 'mod', 'medium', 'long', 'space'];
export const toneFiles = Object.fromEntries(families.flatMap(family =>
  [1, 2, 3].map(i => [family + i, 'tones-v2/' + family + '-' + i + '.wav'])
));

export function familyOf(key) {
  if (key.code === 'Space') return 'space';
  if (key.stabilized) return 'long';
  if (key.width >= 1.5) return 'medium';
  if (key.width > 1) return 'mod';
  return 'unit';
}

export function createToneSelector() {
  const next = new Map();
  return key => {
    const family = familyOf(key);
    const index = next.get(family) ?? 0;
    next.set(family, (index + 1) % 3);
    return family + (index + 1);
  };
}
