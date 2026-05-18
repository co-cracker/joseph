import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Apple SD Gothic Neo",
          "Pretendard Variable",
          "Pretendard",
          "Malgun Gothic",
          "맑은 고딕",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
