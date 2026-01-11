import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeManagerBase, RGBAToHexA, hexAToRGBA } from '../../../lib/shared/theme.js';
import { File, Settings } from '../../mocks/gnome/Gio.js';

// Sample CSS for testing
const sampleCss = `
.tiled {
  color: rgba(255, 255, 255, 0.8);
  border-width: 3px;
  opacity: 0.8;
}

.split {
  color: rgba(200, 200, 200, 0.7);
  border-width: 2px;
  opacity: 0.7;
}

.floated {
  color: rgba(150, 150, 150, 0.6);
  border-width: 1px;
  opacity: 0.6;
}

.stacked {
  color: rgba(100, 100, 100, 0.5);
  border-width: 4px;
  opacity: 0.5;
}

.tabbed {
  color: rgba(50, 50, 50, 0.4);
  border-width: 5px;
  opacity: 0.4;
}

.window-tiled-color {
  background-color: #ff0000;
}
`;

// Create mock configMgr
function createMockConfigMgr(cssContent = sampleCss) {
  const mockFile = new File('/mock/stylesheet.css');
  mockFile.load_contents = vi.fn(() => [true, new TextEncoder().encode(cssContent), null]);
  mockFile.replace_contents = vi.fn(() => [true, null]);
  mockFile.copy = vi.fn(() => true);
  mockFile.get_parent = vi.fn(() => ({
    get_path: () => '/mock'
  }));

  return {
    stylesheetFile: mockFile,
    defaultStylesheetFile: mockFile,
    stylesheetFileName: '/mock/stylesheet.css'
  };
}

// Create mock settings
function createMockSettings() {
  const settings = new Settings();
  settings.set_uint('css-last-update', 0);
  return settings;
}

describe('Color Conversion Functions', () => {
  describe('RGBAToHexA', () => {
    it('should convert rgba with comma-separated values', () => {
      const result = RGBAToHexA('rgba(255,128,64,1)');
      expect(result).toBe('#ff8040ff');
    });

    it('should convert rgba with space-separated values', () => {
      const result = RGBAToHexA('rgba(255 128 64 1)');
      expect(result).toBe('#ff8040ff');
    });

    it('should handle rgba with 0.5 alpha', () => {
      const result = RGBAToHexA('rgba(255,255,255,0.5)');
      expect(result).toBe('#ffffff80');
    });

    it('should handle rgba with 0 alpha', () => {
      const result = RGBAToHexA('rgba(0,0,0,0)');
      expect(result).toBe('#00000000');
    });

    it('should handle percentage values', () => {
      const result = RGBAToHexA('rgba(100%,50%,0%,1)');
      expect(result).toBe('#ff8000ff');
    });

    it('should pad single-digit hex values', () => {
      const result = RGBAToHexA('rgba(0,0,0,1)');
      expect(result).toBe('#000000ff');
    });

    it('should handle space-separated with slash for alpha', () => {
      const result = RGBAToHexA('rgba(255 128 64 / 0.5)');
      expect(result).toBe('#ff804080');
    });
  });

  describe('hexAToRGBA', () => {
    it('should convert 9-character hex (with alpha)', () => {
      const result = hexAToRGBA('#ff8040ff');
      expect(result).toBe('rgba(255,128,64,1)');
    });

    it('should convert 5-character short hex (with alpha)', () => {
      const result = hexAToRGBA('#f84f');
      expect(result).toBe('rgba(255,136,68,1)');
    });

    it('should handle transparent alpha', () => {
      const result = hexAToRGBA('#00000000');
      expect(result).toBe('rgba(0,0,0,0)');
    });

    it('should handle 50% alpha', () => {
      const result = hexAToRGBA('#ffffff80');
      expect(result).toBe('rgba(255,255,255,0.502)');
    });

    it('should handle short hex with alpha', () => {
      const result = hexAToRGBA('#0000');
      expect(result).toBe('rgba(0,0,0,0)');
    });
  });

  describe('roundtrip conversions', () => {
    it('should roundtrip rgba -> hex -> rgba (approximately)', () => {
      const original = 'rgba(128,64,32,0.5)';
      const hex = RGBAToHexA(original);
      const back = hexAToRGBA(hex);
      // Note: alpha may have slight precision differences
      expect(back).toMatch(/rgba\(128,64,32,0\.5\d*\)/);
    });
  });
});

describe('ThemeManagerBase', () => {
  let themeManager;
  let mockConfigMgr;
  let mockSettings;

  beforeEach(() => {
    mockConfigMgr = createMockConfigMgr();
    mockSettings = createMockSettings();
    themeManager = new ThemeManagerBase({
      configMgr: mockConfigMgr,
      settings: mockSettings
    });
  });

  describe('constructor', () => {
    it('should initialize with configMgr and settings', () => {
      expect(themeManager.configMgr).toBe(mockConfigMgr);
      expect(themeManager.settings).toBe(mockSettings);
    });

    it('should import CSS on construction', () => {
      expect(themeManager.cssAst).toBeDefined();
      expect(themeManager.cssAst.stylesheet).toBeDefined();
      expect(themeManager.cssAst.stylesheet.rules).toBeDefined();
    });

    it('should create defaultPalette on construction', () => {
      expect(themeManager.defaultPalette).toBeDefined();
      expect(themeManager.defaultPalette.tiled).toBeDefined();
      expect(themeManager.defaultPalette.split).toBeDefined();
      expect(themeManager.defaultPalette.floated).toBeDefined();
      expect(themeManager.defaultPalette.stacked).toBeDefined();
      expect(themeManager.defaultPalette.tabbed).toBeDefined();
    });

    it('should set cssTag', () => {
      expect(themeManager.cssTag).toBe(37);
    });
  });

  describe('addPx', () => {
    it('should add px suffix to value', () => {
      expect(themeManager.addPx('10')).toBe('10px');
    });

    it('should work with numeric values', () => {
      expect(themeManager.addPx(25)).toBe('25px');
    });
  });

  describe('removePx', () => {
    it('should remove px suffix from value', () => {
      expect(themeManager.removePx('10px')).toBe('10');
    });

    it('should return value unchanged if no px suffix', () => {
      expect(themeManager.removePx('10')).toBe('10');
    });
  });

  describe('getColorSchemeBySelector', () => {
    it('should extract scheme from window-tiled-color', () => {
      expect(themeManager.getColorSchemeBySelector('window-tiled-color')).toBe('tiled');
    });

    it('should extract scheme from window-floated-border', () => {
      expect(themeManager.getColorSchemeBySelector('window-floated-border')).toBe('floated');
    });

    it('should extract scheme from window-stacked-opacity', () => {
      expect(themeManager.getColorSchemeBySelector('window-stacked-opacity')).toBe('stacked');
    });

    it('should return null for selector without dashes', () => {
      expect(themeManager.getColorSchemeBySelector('tiled')).toBeNull();
    });
  });

  describe('getCssRule', () => {
    it('should find CSS rule by selector', () => {
      const rule = themeManager.getCssRule('.tiled');
      expect(rule).toBeDefined();
      expect(rule.selectors).toContain('.tiled');
    });

    it('should return empty object for non-existent selector', () => {
      const rule = themeManager.getCssRule('.nonexistent');
      expect(rule).toEqual({});
    });

    it('should find .split rule', () => {
      const rule = themeManager.getCssRule('.split');
      expect(rule.selectors).toContain('.split');
    });

    it('should return empty object if cssAst is undefined', () => {
      themeManager.cssAst = undefined;
      const rule = themeManager.getCssRule('.tiled');
      expect(rule).toEqual({});
    });
  });

  describe('getCssProperty', () => {
    it('should get color property from .tiled', () => {
      const prop = themeManager.getCssProperty('.tiled', 'color');
      expect(prop.value).toBe('rgba(255, 255, 255, 0.8)');
    });

    it('should get border-width property from .tiled', () => {
      const prop = themeManager.getCssProperty('.tiled', 'border-width');
      expect(prop.value).toBe('3px');
    });

    it('should get opacity property from .tiled', () => {
      const prop = themeManager.getCssProperty('.tiled', 'opacity');
      expect(prop.value).toBe('0.8');
    });

    it('should return empty object for non-existent property', () => {
      const prop = themeManager.getCssProperty('.tiled', 'nonexistent');
      expect(prop).toEqual({});
    });

    it('should return empty object for non-existent selector', () => {
      // Bug #448 fix: Now properly checks for cssRule.declarations
      const prop = themeManager.getCssProperty('.nonexistent', 'color');
      expect(prop).toEqual({});
    });
  });

  describe('setCssProperty', () => {
    beforeEach(() => {
      // Mock reloadStylesheet to avoid abstract method error
      themeManager.reloadStylesheet = vi.fn();
    });

    it('should set CSS property value', () => {
      const result = themeManager.setCssProperty('.tiled', 'color', 'red');
      expect(result).toBe(true);

      const prop = themeManager.getCssProperty('.tiled', 'color');
      expect(prop.value).toBe('red');
    });

    it('should call reloadStylesheet after setting property', () => {
      themeManager.setCssProperty('.tiled', 'opacity', '0.9');
      expect(themeManager.reloadStylesheet).toHaveBeenCalled();
    });

    it('should return false for non-existent property', () => {
      // Bug #312 fix: Now properly checks for cssProperty.value !== undefined
      const result = themeManager.setCssProperty('.tiled', 'nonexistent', 'value');
      expect(result).toBe(false);
    });

    it('should write updated CSS to file', () => {
      themeManager.setCssProperty('.tiled', 'color', 'blue');
      expect(mockConfigMgr.stylesheetFile.replace_contents).toHaveBeenCalled();
    });
  });

  describe('getDefaults', () => {
    it('should return color, border-width, and opacity for tiled', () => {
      const defaults = themeManager.getDefaults('tiled');
      expect(defaults.color).toBe('rgba(255, 255, 255, 0.8)');
      expect(defaults['border-width']).toBe('3');
      expect(defaults.opacity).toBe('0.8');
    });

    it('should return defaults for split', () => {
      const defaults = themeManager.getDefaults('split');
      expect(defaults.color).toBe('rgba(200, 200, 200, 0.7)');
      expect(defaults['border-width']).toBe('2');
      expect(defaults.opacity).toBe('0.7');
    });
  });

  describe('getDefaultPalette', () => {
    it('should return palette for all color schemes', () => {
      const palette = themeManager.getDefaultPalette();
      expect(palette.tiled).toBeDefined();
      expect(palette.split).toBeDefined();
      expect(palette.floated).toBeDefined();
      expect(palette.stacked).toBeDefined();
      expect(palette.tabbed).toBeDefined();
    });

    it('should have correct values for tiled scheme', () => {
      const palette = themeManager.getDefaultPalette();
      expect(palette.tiled.color).toBe('rgba(255, 255, 255, 0.8)');
      expect(palette.tiled['border-width']).toBe('3');
      expect(palette.tiled.opacity).toBe('0.8');
    });
  });

  describe('_needUpdate', () => {
    it('should return true when css-last-update differs from cssTag', () => {
      mockSettings.set_uint('css-last-update', 0);
      expect(themeManager._needUpdate()).toBe(true);
    });

    it('should return false when css-last-update matches cssTag', () => {
      mockSettings.set_uint('css-last-update', themeManager.cssTag);
      expect(themeManager._needUpdate()).toBe(false);
    });
  });

  describe('patchCss', () => {
    it('should return false when no update needed', () => {
      mockSettings.set_uint('css-last-update', themeManager.cssTag);
      const result = themeManager.patchCss();
      expect(result).toBe(false);
    });

    it('should copy files and update setting when update needed', () => {
      mockSettings.set_uint('css-last-update', 0);
      const result = themeManager.patchCss();
      expect(result).toBe(true);
      expect(mockSettings.get_uint('css-last-update')).toBe(themeManager.cssTag);
    });

    it('should backup existing config CSS', () => {
      mockSettings.set_uint('css-last-update', 0);
      themeManager.patchCss();
      expect(mockConfigMgr.stylesheetFile.copy).toHaveBeenCalled();
    });
  });

  describe('reloadStylesheet', () => {
    it('should throw error (abstract method)', () => {
      expect(() => themeManager.reloadStylesheet()).toThrow('Must implement reloadStylesheet');
    });
  });

  describe('_importCss', () => {
    it('should parse CSS into AST', () => {
      expect(themeManager.cssAst).toBeDefined();
      expect(themeManager.cssAst.type).toBe('stylesheet');
    });

    it('should use defaultStylesheetFile when stylesheetFile is null', () => {
      const configMgr = createMockConfigMgr();
      configMgr.stylesheetFile = null;
      const tm = new ThemeManagerBase({
        configMgr,
        settings: createMockSettings()
      });
      expect(configMgr.defaultStylesheetFile.load_contents).toHaveBeenCalled();
    });
  });

  describe('_updateCss', () => {
    beforeEach(() => {
      themeManager.reloadStylesheet = vi.fn();
    });

    it('should write CSS to file', () => {
      themeManager._updateCss();
      expect(mockConfigMgr.stylesheetFile.replace_contents).toHaveBeenCalled();
    });

    it('should call reloadStylesheet on success', () => {
      themeManager._updateCss();
      expect(themeManager.reloadStylesheet).toHaveBeenCalled();
    });

    it('should do nothing if cssAst is undefined', () => {
      themeManager.cssAst = undefined;
      themeManager._updateCss();
      expect(mockConfigMgr.stylesheetFile.replace_contents).not.toHaveBeenCalled();
    });
  });
});

describe('ThemeManagerBase edge cases', () => {
  // Minimal valid CSS with all required classes
  const minimalCss = `
    .tiled { color: red; border-width: 1px; opacity: 1; }
    .split { color: red; border-width: 1px; opacity: 1; }
    .floated { color: red; border-width: 1px; opacity: 1; }
    .stacked { color: red; border-width: 1px; opacity: 1; }
    .tabbed { color: red; border-width: 1px; opacity: 1; }
  `;

  it('should return empty object for non-existent rule', () => {
    const configMgr = createMockConfigMgr(minimalCss);
    const settings = createMockSettings();
    const tm = new ThemeManagerBase({ configMgr, settings });

    expect(tm.getCssRule('.nonexistent')).toEqual({});
  });

  it('should handle CSS with multiple selectors on same rule', () => {
    const css = `
      .tiled, .extra { color: red; border-width: 1px; opacity: 1; }
      .split { color: red; border-width: 1px; opacity: 1; }
      .floated { color: red; border-width: 1px; opacity: 1; }
      .stacked { color: red; border-width: 1px; opacity: 1; }
      .tabbed { color: red; border-width: 1px; opacity: 1; }
    `;
    const configMgr = createMockConfigMgr(css);
    const settings = createMockSettings();
    const tm = new ThemeManagerBase({ configMgr, settings });

    const rule = tm.getCssRule('.tiled');
    expect(rule.selectors).toContain('.tiled');
    expect(rule.selectors).toContain('.extra');
  });

  it('should throw when rule lacks selectors property (code limitation)', () => {
    const configMgr = createMockConfigMgr(minimalCss);
    const settings = createMockSettings();
    const tm = new ThemeManagerBase({ configMgr, settings });

    // Manually add a malformed rule (like a comment node)
    tm.cssAst.stylesheet.rules.push({ type: 'comment', comment: 'test' });

    // Current code doesn't handle rules without selectors property
    expect(() => tm.getCssRule('.tiled')).toThrow();
  });
});
