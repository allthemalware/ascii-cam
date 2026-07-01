// Gradient maps (character ramps), ordered darkest/emptiest -> brightest/densest.
// The first glyph is used for the darkest cells; the browser must have the font
// coverage for block / braille / katakana glyphs (all standard on modern OSes).

export const RAMPS = {
  ascii: {
    label: 'ASCII (10)',
    chars: ' .:-=+*#%@',
  },
  asciiLong: {
    label: 'ASCII (long 70)',
    chars: " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  },
  blocksShade: {
    label: 'Gradient blocks (shade)',
    chars: ' ░▒▓█', //  ░▒▓█
  },
  blocks8: {
    label: 'Gradient blocks (1/8)',
    chars: ' ▁▂▃▄▅▆▇█', //  ▁▂▃▄▅▆▇█
  },
  braille: {
    label: 'Braille dots',
    chars: ' ⠁⠃⠇⠏⠟⠿⢿⣿', //  ⠁⠃⠇⠏⠟⠿⣿ increasing dots
  },
  katakana: {
    label: 'Katakana (half-width)',
    // Space + a couple of light marks lead into full-weight kana for the Matrix look.
    chars: ' ｡･ﾞｰｦｧｲｸｼﾀﾅﾊﾎﾑﾓﾕﾘﾜ',
  },
  hex: {
    label: 'Hexadecimal',
    chars: ' 0123456789ABCDEF',
  },
  numeric: {
    label: 'Numeric rain',
    chars: ' 1234567890',
  },
  binary: {
    label: 'Binary',
    chars: ' 01',
  },
  stipple: {
    label: 'Stipple / dots',
    chars: ' ·∶∷⁙∴※▓█', //  ·∶∷⁙∴※▓█
  },
};

export const DEFAULT_RAMP = 'ascii';
