/** Minecraft UI 팔레트 + 스타일 헬퍼 */
export const MC = {
  panelBg: 'rgba(0, 0, 0, 0.75)',
  panelBorderLight: '#5A5A5A',
  panelBorderDark: '#2A2A2A',
  btnDefault: '#8B8B8B',
  btnDefaultLight: '#CFCFCF',
  btnDefaultDark: '#555555',
  btnGreen: '#579E45',
  btnGreenLight: '#7BC968',
  btnGreenDark: '#3D7030',
  btnRed: '#C75B5B',
  btnRedLight: '#E08080',
  btnRedDark: '#8B3030',
  textPrimary: '#FFFFFF',
  textSecondary: '#AAAAAA',
  textGold: '#FFAA00',
  textGreen: '#55FF55',
  textRed: '#FF5555',
  textYellow: '#FFFF55',
  textGray: '#888888',
  inputBg: 'rgba(0, 0, 0, 0.65)',
  inputBorder: '#666666',
  inputFocusBorder: '#AAAAAA',
  skyBg: '#87CEEB',
} as const;

/** 마크 인벤토리 스타일 3D 엠보스 보더 생성 */
export function mcBorder(light: string, dark: string, width = 2) {
  return `inset ${width}px ${width}px 0 ${light}, inset -${width}px -${width}px 0 ${dark}`;
}

/** 마크 버튼 3D 엠보스 박스 섀도 */
export function mcButtonShadow(variant: 'default' | 'green' | 'red' = 'default') {
  const colors = {
    default: { light: MC.btnDefaultLight, dark: MC.btnDefaultDark },
    green: { light: MC.btnGreenLight, dark: MC.btnGreenDark },
    red: { light: MC.btnRedLight, dark: MC.btnRedDark },
  };
  const c = colors[variant];
  return `inset 2px 2px 0 ${c.light}, inset -2px -2px 0 ${c.dark}`;
}

/** 마크 패널 박스 섀도 (엠보스 인셋 보더) */
export function mcPanelShadow() {
  return `inset 2px 2px 0 ${MC.panelBorderLight}, inset -2px -2px 0 ${MC.panelBorderDark}`;
}

/** 픽셀 폰트 스타일 (제목/버튼) */
export const pixelFont = '"Press Start 2P", monospace';

/** 본문 폰트 스타일 */
export const bodyFont = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
