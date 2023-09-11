# CSS module in Forge

API to work with CSS code and files and update the extension's stylesheet.css

## CSS Parser from ReworkCSS
Credits: https://github.com/reworkcss/css
Modified to work in GNOME-Shell by Forge

### Usage

```js
import {
  parse,
  stringify,
  write,
  load,
} from './css/index.js';

// Raw APIs from ReworkCSS
let obj = parse('body { font-size: 12px; }');
let code = stringify(obj);

// Convenience
write(code, "/path/to/stylesheet.css");
let ast = load("/path/to/stylesheet.css");

// ... Do something with AST ...

```

### Example

CSS:

```css
body {
  background: #eee;
  color: #888;
}
```

Parse tree:

```json
{
  "type": "stylesheet",
  "stylesheet": {
    "rules": [
      {
        "type": "rule",
        "selectors": [
          "body"
        ],
        "declarations": [
          {
            "type": "declaration",
            "property": "background",
            "value": "#eee",
            "position": {
              "start": {
                "line": 2,
                "column": 3
              },
              "end": {
                "line": 2,
                "column": 19
              }
            }
          },
          {
            "type": "declaration",
            "property": "color",
            "value": "#888",
            "position": {
              "start": {
                "line": 3,
                "column": 3
              },
              "end": {
                "line": 3,
                "column": 14
              }
            }
          }
        ],
        "position": {
          "start": {
            "line": 1,
            "column": 1
          },
          "end": {
            "line": 4,
            "column": 2
          }
        }
      }
    ]
  }
}
```
