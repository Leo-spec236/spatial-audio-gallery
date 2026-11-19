/** ANSI TKL: dimensions are millimetres, position is the switch centre. */
export const KEY_PITCH = 19.05;
const raw = [];
function key(code, label, x, z, width = 1) { raw.push({ code, label, x, z, width, height: 1, stabilized: width >= 2 }); }
function row(z, entries, start = 0) {
  let x = start;
  for (const [code, label, width = 1] of entries) { key(code, label, x + width / 2, z, width); x += width; }
}
key('Escape', 'esc', 0.5, 0);
for (let i = 1; i <= 12; i++) key(`F${i}`, `F${i}`, 2.5 + (i - 1) + Math.floor((i - 1) / 4) * 0.5, 0);
row(0, [['PrintScreen', 'prt sc'], ['ScrollLock', 'scroll'], ['Pause', 'pause']], 15.5);
row(1.35, [['Backquote', '~  `'], ...'1234567890'.split('').map(n => [`Digit${n}`, n]), ['Minus', '−'], ['Equal', '='], ['Backspace', 'backspace', 2]]);
row(1.35, [['Insert', 'insert'], ['Home', 'home'], ['PageUp', 'pg up']], 15.5);
row(2.35, [['Tab', 'tab', 1.5], ...'QWERTYUIOP'.split('').map(n => [`Key${n}`, n]), ['BracketLeft', '['], ['BracketRight', ']'], ['Backslash', '\\', 1.5]]);
row(2.35, [['Delete', 'delete'], ['End', 'end'], ['PageDown', 'pg dn']], 15.5);
row(3.35, [['CapsLock', 'caps lock', 1.75], ...'ASDFGHJKL'.split('').map(n => [`Key${n}`, n]), ['Semicolon', ';'], ['Quote', "'"], ['Enter', 'enter', 2.25]]);
row(4.35, [['ShiftLeft', 'shift', 2.25], ...'ZXCVBNM'.split('').map(n => [`Key${n}`, n]), ['Comma', ','], ['Period', '.'], ['Slash', '/'], ['ShiftRight', 'shift', 2.75]]);
key('ArrowUp', '↑', 17, 4.35);
row(5.35, [['ControlLeft', 'ctrl', 1.25], ['MetaLeft', 'win', 1.25], ['AltLeft', 'alt', 1.25], ['Space', '', 6.25], ['AltRight', 'alt', 1.25], ['MetaRight', 'win', 1.25], ['ContextMenu', 'menu', 1.25], ['ControlRight', 'ctrl', 1.25]]);
row(5.35, [['ArrowLeft', '←'], ['ArrowDown', '↓'], ['ArrowRight', '→']], 15.5);
export const KEY_LAYOUT = Object.freeze(raw.map(k => Object.freeze({ ...k, x: (k.x - 9.25) * KEY_PITCH, z: (k.z - 2.675) * KEY_PITCH })));
export const BOARD_DIMENSIONS = Object.freeze({ width: 18.5 * KEY_PITCH + 14, depth: 6.35 * KEY_PITCH + 14, height: 30, pitch: KEY_PITCH });
