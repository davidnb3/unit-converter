// ─── Unit conversion definitions ─────────────────────────────────────────────
// Factor-based units convert to/from a base SI unit by multiplication.
// Temperature uses explicit functions (non-linear).

function factored(units) {
  return units.map(u => ({
    ...u,
    toBase:   v => v * u.factor,
    fromBase: v => v / u.factor,
  }));
}

export const CATEGORIES = [
  {
    id: 'temperature',
    label: 'Temperature',
    units: [
      { id: 'c', symbol: '°C',  label: 'Celsius',    toBase: v => v,              fromBase: v => v            },
      { id: 'f', symbol: '°F',  label: 'Fahrenheit', toBase: v => (v - 32) / 1.8, fromBase: v => v * 1.8 + 32 },
      { id: 'k', symbol: 'K',   label: 'Kelvin',     toBase: v => v - 273.15,     fromBase: v => v + 273.15   },
    ],
  },
  {
    id: 'weight',
    label: 'Weight',
    units: factored([
      { id: 'mg', symbol: 'mg', label: 'Milligram', factor: 0.001      },
      { id: 'g',  symbol: 'g',  label: 'Gram',      factor: 1          },
      { id: 'kg', symbol: 'kg', label: 'Kilogram',  factor: 1000       },
      { id: 'oz', symbol: 'oz', label: 'Ounce',     factor: 28.3495    },
      { id: 'lb', symbol: 'lb', label: 'Pound',     factor: 453.592    },
      { id: 'st', symbol: 'st', label: 'Stone',     factor: 6350.29    },
    ]),
  },
  {
    id: 'length',
    label: 'Length',
    units: factored([
      { id: 'mm', symbol: 'mm', label: 'Millimetre', factor: 0.001     },
      { id: 'cm', symbol: 'cm', label: 'Centimetre', factor: 0.01      },
      { id: 'm',  symbol: 'm',  label: 'Metre',      factor: 1         },
      { id: 'km', symbol: 'km', label: 'Kilometre',  factor: 1000      },
      { id: 'in', symbol: 'in', label: 'Inch',       factor: 0.0254    },
      { id: 'ft', symbol: 'ft', label: 'Foot',       factor: 0.3048    },
      { id: 'mi', symbol: 'mi', label: 'Mile',       factor: 1609.344  },
    ]),
  },
  {
    id: 'speed',
    label: 'Speed',
    units: factored([
      { id: 'kmh', symbol: 'km/h', label: 'Kilometres per hour', factor: 1 / 3.6  },
      { id: 'mph', symbol: 'mph',  label: 'Miles per hour',      factor: 0.44704  },
      { id: 'ms',  symbol: 'm/s',  label: 'Metres per second',   factor: 1        },
      { id: 'kn',  symbol: 'kn',   label: 'Knots',               factor: 0.514444 },
    ]),
  },
  {
    id: 'volume',
    label: 'Volume',
    units: factored([
      { id: 'ml',   symbol: 'ml',    label: 'Millilitre',  factor: 1        },
      { id: 'l',    symbol: 'L',     label: 'Litre',       factor: 1000     },
      { id: 'tsp',  symbol: 'tsp',   label: 'Teaspoon',    factor: 4.92892  },
      { id: 'tbsp', symbol: 'tbsp',  label: 'Tablespoon',  factor: 14.7868  },
      { id: 'floz', symbol: 'fl oz', label: 'Fl oz (US)',  factor: 29.5735  },
      { id: 'cup',  symbol: 'cup',   label: 'Cup (US)',    factor: 236.588  },
      { id: 'pt',   symbol: 'pt',    label: 'Pint (US)',   factor: 473.176  },
      { id: 'gal',  symbol: 'gal',   label: 'Gallon (US)', factor: 3785.41  },
    ]),
  },
  {
    id: 'area',
    label: 'Area',
    units: factored([
      { id: 'cm2', symbol: 'cm²', label: 'Sq centimetre', factor: 0.0001   },
      { id: 'm2',  symbol: 'm²',  label: 'Sq metre',      factor: 1        },
      { id: 'km2', symbol: 'km²', label: 'Sq kilometre',  factor: 1e6      },
      { id: 'ha',  symbol: 'ha',  label: 'Hectare',       factor: 10000    },
      { id: 'ft2', symbol: 'ft²', label: 'Sq foot',       factor: 0.092903 },
      { id: 'ac',  symbol: 'ac',  label: 'Acre',          factor: 4046.86  },
    ]),
  },
  {
    id: 'data',
    label: 'Data',
    units: factored([
      { id: 'b',  symbol: 'B',  label: 'Byte',      factor: 1                   },
      { id: 'kb', symbol: 'KB', label: 'Kilobyte',  factor: 1024                },
      { id: 'mb', symbol: 'MB', label: 'Megabyte',  factor: 1048576             },
      { id: 'gb', symbol: 'GB', label: 'Gigabyte',  factor: 1073741824          },
      { id: 'tb', symbol: 'TB', label: 'Terabyte',  factor: 1099511627776       },
      { id: 'pb', symbol: 'PB', label: 'Petabyte',  factor: 1125899906842624    },
    ]),
  },
  {
    id: 'pressure',
    label: 'Pressure',
    units: factored([
      { id: 'hpa', symbol: 'hPa', label: 'Hectopascal', factor: 100    },
      { id: 'kpa', symbol: 'kPa', label: 'Kilopascal',  factor: 1000   },
      { id: 'bar', symbol: 'bar', label: 'Bar',         factor: 100000 },
      { id: 'psi', symbol: 'psi', label: 'PSI',         factor: 6894.76},
      { id: 'atm', symbol: 'atm', label: 'Atmosphere',  factor: 101325 },
    ]),
  },
];

// Each entry is one horizontal row of 4 categories shown side by side
export const ROW_GROUPS = [
  ['temperature', 'weight', 'length', 'speed'],
  ['volume', 'area', 'data', 'pressure'],
];

// Format a converted number for display — up to 7 significant figures
export function formatValue(value) {
  if (!isFinite(value) || value === null || value === undefined) return '';
  if (value === 0) return '0';
  return parseFloat(value.toPrecision(7)).toString();
}
