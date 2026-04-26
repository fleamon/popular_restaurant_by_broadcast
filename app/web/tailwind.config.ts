import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 로고 배경에서 추출한 브랜드 파랑
        brand: {
          DEFAULT: "#2B7FFF",
          fg: "#FFFFFF",
          surface: "#F5F8FF",
          hover: "#1F6BE0",
        },
      },
      fontFamily: {
        sans: [
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "Roboto",
          "Helvetica Neue",
          "Apple SD Gothic Neo",
          "sans-serif",
        ],
        // 살짝 부드러운 헤딩용 — Apple SD Gothic Neo(둥근 자형) 우선
        soft: [
          '"Apple SD Gothic Neo"',
          '"SUIT Variable"',
          '"Pretendard Variable"',
          "Pretendard",
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
