// Resolution-independent sizing for TVs.
//
// Every screen is designed on a 1920×1080 canvas. Instead of drawing that canvas
// and shrinking it with a transform (which makes text and numbers soft on some TVs),
// we multiply every size by the screen's scale up front, so the TV renders text,
// borders and SVGs natively at their final pixel size: sharp on 720p, 1080p and 4K,
// and on TVs that report 960×540 dp.
import { Dimensions, PixelRatio, StyleSheet } from 'react-native';

export const DESIGN_W = 1920;
export const DESIGN_H = 1080;

const win = Dimensions.get('window');
/** Screen size ÷ design size (0.5 on a typical Android/Fire TV, 1 in a 1080p browser). */
export const SCALE = Math.min(win.width / DESIGN_W, win.height / DESIGN_H) || 1;

/** Design px → screen units, snapped to whole physical pixels so edges stay crisp. */
export const u = (n: number) => PixelRatio.roundToNearestPixel(n * SCALE);

const SIZED = new Set([
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'flexBasis',
  'top', 'left', 'right', 'bottom',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical',
  'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'paddingHorizontal', 'paddingVertical',
  'gap', 'rowGap', 'columnGap',
  'borderWidth', 'borderTopWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderRightWidth',
  'borderRadius', 'fontSize', 'lineHeight', 'letterSpacing',
]);

function scaleStyle(style: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(style)) {
    // Hairlines stay 1 physical pixel thick; 999 is "fully round".
    if (typeof v === 'number' && SIZED.has(k)) out[k] = v >= 999 ? v : k.endsWith('Width') && v <= 1 ? StyleSheet.hairlineWidth : u(v);
    else out[k] = v;
  }
  return out;
}

/** StyleSheet.create with every size given in 1920×1080 design px. */
export function tvStyles<T extends StyleSheet.NamedStyles<T>>(styles: T): T {
  const scaled: Record<string, unknown> = {};
  for (const [name, s] of Object.entries(styles)) scaled[name] = scaleStyle(s as Record<string, unknown>);
  return StyleSheet.create(scaled as T);
}
