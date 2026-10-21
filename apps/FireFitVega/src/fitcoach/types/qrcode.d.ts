// Minimal types for the pure-JS qrcode package (only create() is used).
declare module 'qrcode' {
  const QRCode: {
    create(text: string, opts?: { errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H' }): { modules: { size: number; get(x: number, y: number): number | boolean } };
  };
  export default QRCode;
}
