export const THEME = {
  bg: 0x080c08,
  textNormal: 0x33ff66,
  textDim: 0x1a7a33,
  textBright: 0x88ffbb,
  textError: 0xff4444,
  textWarning: 0xffaa00,
  textSystem: 0x44aaff,
  textInput: 0xeeffee,
  cursorColor: 0x33ff66,
  scanlineColor: 0x000000,
  scanlineAlpha: 0.18,
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: 15,
  lineHeight: 22,
  paddingX: 20,
  paddingTop: 14,
  paddingBottom: 36,
} as const;

export type TextColor =
  | 'normal'
  | 'dim'
  | 'bright'
  | 'error'
  | 'warning'
  | 'system'
  | 'input';

export function colorForType(type: TextColor): number {
  switch (type) {
    case 'normal':  return THEME.textNormal;
    case 'dim':     return THEME.textDim;
    case 'bright':  return THEME.textBright;
    case 'error':   return THEME.textError;
    case 'warning': return THEME.textWarning;
    case 'system':  return THEME.textSystem;
    case 'input':   return THEME.textInput;
  }
}
