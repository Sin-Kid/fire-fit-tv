import React, { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import QRCode from 'qrcode';

/** A scannable QR code drawn with react-native-svg (one path, quiet zone included). */
export function QrCode({ value, size = 220, color = '#0B0F14', background = '#FFFFFF' }: { value: string; size?: number; color?: string; background?: string }) {
  const { d, n } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
    const count = qr.modules.size;
    let path = '';
    for (let y = 0; y < count; y++) {
      for (let x = 0; x < count; x++) if (qr.modules.get(x, y)) path += `M${x + 4} ${y + 4}h1v1h-1z`;
    }
    return { d: path, n: count + 8 };
  }, [value]);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} accessibilityLabel="QR code for the phone form camera">
      <Rect x={0} y={0} width={n} height={n} fill={background} />
      <Path d={d} fill={color} />
    </Svg>
  );
}
