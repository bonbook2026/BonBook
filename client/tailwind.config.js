/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fbf2ec',
          100: '#f5e3d6',
          200: '#ebc7b0',
          300: '#dca285',
          400: '#ca7d5c',
          500: '#b96040',
          600: '#a54d35',
          700: '#893c2b',
          800: '#713427',
          900: '#5c2c24',
        },
        gray: {
          50: '#faf8f3',
          100: '#efeae1',
          200: '#e2dacf',
          300: '#c9bfb2',
          400: '#a2978a',
          500: '#7e7267',
          600: '#67594e',
          700: '#504238',
          800: '#3c3028',
          900: '#2c241f',
        },
      },
    },
  },
  plugins: [],
};
