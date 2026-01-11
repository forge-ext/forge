import { describe, it, expect } from 'vitest';
import { parse, stringify, Compiler } from '../../../lib/css/index.js';

describe('CSS Parser', () => {
  describe('parse', () => {
    it('should parse simple rule', () => {
      const css = '.class { color: red; }';
      const result = parse(css);

      expect(result.type).toBe('stylesheet');
      expect(result.stylesheet.rules).toHaveLength(1);
      expect(result.stylesheet.rules[0].type).toBe('rule');
    });

    it('should parse multiple rules', () => {
      const css = '.a { color: red; } .b { color: blue; }';
      const result = parse(css);

      expect(result.stylesheet.rules).toHaveLength(2);
    });

    it('should parse declarations', () => {
      const css = '.class { color: red; background: blue; }';
      const result = parse(css);

      const declarations = result.stylesheet.rules[0].declarations;
      expect(declarations).toHaveLength(2);
      expect(declarations[0].property).toBe('color');
      expect(declarations[0].value).toBe('red');
      expect(declarations[1].property).toBe('background');
      expect(declarations[1].value).toBe('blue');
    });

    it('should parse selectors', () => {
      const css = '.class, #id, div { color: red; }';
      const result = parse(css);

      const selectors = result.stylesheet.rules[0].selectors;
      expect(selectors).toContain('.class');
      expect(selectors).toContain('#id');
      expect(selectors).toContain('div');
    });

    it('should parse comments', () => {
      const css = '/* comment */ .class { color: red; }';
      const result = parse(css);

      expect(result.stylesheet.rules[0].type).toBe('comment');
      expect(result.stylesheet.rules[0].comment).toBe(' comment ');
    });

    it('should parse media queries', () => {
      const css = '@media screen { .class { color: red; } }';
      const result = parse(css);

      expect(result.stylesheet.rules[0].type).toBe('media');
      expect(result.stylesheet.rules[0].media).toBe('screen');
      expect(result.stylesheet.rules[0].rules).toHaveLength(1);
    });

    it('should parse keyframes', () => {
      const css = '@keyframes slide { from { left: 0; } to { left: 100px; } }';
      const result = parse(css);

      expect(result.stylesheet.rules[0].type).toBe('keyframes');
      expect(result.stylesheet.rules[0].name).toBe('slide');
      expect(result.stylesheet.rules[0].keyframes).toHaveLength(2);
    });

    it('should parse imports', () => {
      const css = '@import url("styles.css");';
      const result = parse(css);

      expect(result.stylesheet.rules[0].type).toBe('import');
      expect(result.stylesheet.rules[0].import).toBe('url("styles.css")');
    });

    it('should handle empty stylesheet', () => {
      const css = '';
      const result = parse(css);

      expect(result.stylesheet.rules).toHaveLength(0);
    });

    it('should handle whitespace-only stylesheet', () => {
      const css = '   \n\n  \t  ';
      const result = parse(css);

      expect(result.stylesheet.rules).toHaveLength(0);
    });

    it('should track parsing errors when silent option is true', () => {
      const css = '.invalid { color }'; // Invalid CSS
      const result = parse(css, { silent: true });

      expect(result.stylesheet.parsingErrors.length).toBeGreaterThan(0);
    });

    it('should throw error when invalid CSS and silent is false', () => {
      const css = '.invalid { color }';

      expect(() => parse(css, { silent: false })).toThrow();
    });

    it('should include source in options', () => {
      const css = '.class { color: red; }';
      const result = parse(css, { source: 'test.css' });

      expect(result.stylesheet.source).toBe('test.css');
    });

    it('should parse nested selectors', () => {
      const css = '.parent .child { color: red; }';
      const result = parse(css);

      expect(result.stylesheet.rules[0].selectors[0]).toBe('.parent .child');
    });

    it('should parse pseudo-selectors', () => {
      const css = '.class:hover { color: red; }';
      const result = parse(css);

      expect(result.stylesheet.rules[0].selectors[0]).toBe('.class:hover');
    });

    it('should parse attribute selectors', () => {
      const css = 'input[type="text"] { border: 1px solid; }';
      const result = parse(css);

      expect(result.stylesheet.rules[0].selectors[0]).toBe('input[type="text"]');
    });

    it('should parse important declarations', () => {
      const css = '.class { color: red !important; }';
      const result = parse(css);

      expect(result.stylesheet.rules[0].declarations[0].value).toContain('!important');
    });
  });

  describe('stringify', () => {
    it('should stringify simple rule', () => {
      const ast = {
        type: 'stylesheet',
        stylesheet: {
          rules: [
            {
              type: 'rule',
              selectors: ['.class'],
              declarations: [
                { type: 'declaration', property: 'color', value: 'red' }
              ]
            }
          ]
        }
      };

      const result = stringify(ast);
      expect(result).toContain('.class');
      expect(result).toContain('color');
      expect(result).toContain('red');
    });

    it('should stringify and parse round-trip', () => {
      const css = '.class { color: red; background: blue; }';
      const ast = parse(css);
      const output = stringify(ast);
      const reparsed = parse(output);

      expect(reparsed.stylesheet.rules).toHaveLength(1);
      expect(reparsed.stylesheet.rules[0].declarations).toHaveLength(2);
    });

    it('should stringify comments', () => {
      const ast = {
        type: 'stylesheet',
        stylesheet: {
          rules: [
            { type: 'comment', comment: ' test comment ' }
          ]
        }
      };

      const result = stringify(ast);
      expect(result).toContain('/*');
      expect(result).toContain('test comment');
      expect(result).toContain('*/');
    });

    it('should stringify media queries', () => {
      const ast = {
        type: 'stylesheet',
        stylesheet: {
          rules: [
            {
              type: 'media',
              media: 'screen',
              rules: [
                {
                  type: 'rule',
                  selectors: ['.class'],
                  declarations: [
                    { type: 'declaration', property: 'color', value: 'red' }
                  ]
                }
              ]
            }
          ]
        }
      };

      const result = stringify(ast);
      expect(result).toContain('@media');
      expect(result).toContain('screen');
    });

    it('should use custom indentation', () => {
      const ast = {
        type: 'stylesheet',
        stylesheet: {
          rules: [
            {
              type: 'rule',
              selectors: ['.class'],
              declarations: [
                { type: 'declaration', property: 'color', value: 'red' }
              ]
            }
          ]
        }
      };

      const result = stringify(ast, { indent: '    ' });
      expect(result).toContain('    '); // 4 spaces
    });

    it('should stringify empty stylesheet', () => {
      const ast = {
        type: 'stylesheet',
        stylesheet: { rules: [] }
      };

      const result = stringify(ast);
      expect(result).toBe('');
    });
  });

  describe('Compiler', () => {
    it('should create compiler with default indentation', () => {
      const compiler = new Compiler();
      expect(compiler.indentation).toBe('  '); // 2 spaces default
    });

    it('should create compiler with custom indentation', () => {
      const compiler = new Compiler({ indent: '\t' });
      expect(compiler.indentation).toBe('\t');
    });

    it('should emit strings', () => {
      const compiler = new Compiler();
      const result = compiler.emit('test');
      expect(result).toBe('test');
    });

    it('should compile stylesheet', () => {
      const compiler = new Compiler();
      const ast = {
        type: 'stylesheet',
        stylesheet: {
          rules: [
            {
              type: 'rule',
              selectors: ['.test'],
              declarations: [
                { type: 'declaration', property: 'color', value: 'blue' }
              ]
            }
          ]
        }
      };

      const result = compiler.compile(ast);
      expect(result).toContain('.test');
      expect(result).toContain('color');
      expect(result).toContain('blue');
    });

    it('should visit nodes by type', () => {
      const compiler = new Compiler();
      const commentNode = { type: 'comment', comment: ' test ' };

      const result = compiler.visit(commentNode);
      expect(result).toContain('/*');
      expect(result).toContain('test');
      expect(result).toContain('*/');
    });
  });

  describe('parse and stringify integration', () => {
    it('should preserve rule structure', () => {
      const original = '.a { color: red; } .b { color: blue; }';
      const ast = parse(original);
      const output = stringify(ast);
      const reparsed = parse(output);

      expect(reparsed.stylesheet.rules).toHaveLength(2);
      expect(reparsed.stylesheet.rules[0].declarations[0].value).toBe('red');
      expect(reparsed.stylesheet.rules[1].declarations[0].value).toBe('blue');
    });

    it('should handle complex selectors', () => {
      const css = '.parent > .child:hover { color: red; }';
      const ast = parse(css);
      const output = stringify(ast);

      expect(output).toContain('.parent > .child:hover');
    });

    it('should preserve multiple declarations', () => {
      const css = '.class { color: red; background: blue; padding: 10px; }';
      const ast = parse(css);
      const output = stringify(ast);
      const reparsed = parse(output);

      expect(reparsed.stylesheet.rules[0].declarations).toHaveLength(3);
    });

    it('should handle vendor prefixes', () => {
      const css = '.class { -webkit-transform: rotate(45deg); }';
      const ast = parse(css);
      const output = stringify(ast);

      expect(output).toContain('-webkit-transform');
    });
  });
});
