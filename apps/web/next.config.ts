import type { NextConfig } from "next";
import path from "path";
import { createRequire } from "module";
import createNextIntlPlugin from "next-intl/plugin";

const require = createRequire(import.meta.url);
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // R3F Canvas가 StrictMode 이중 마운트로 WebGL context를 2개 생성→둘 다 lost 되는 문제 방지
  reactStrictMode: false,
  // R3F 공식 문서: Next.js에서 three를 transpilePackages에 포함해야 함
  transpilePackages: ["@agent-survivor/shared", "three", "three-globe", "@app-ingame"],

  // S40: Image optimization — WebP/AVIF auto-conversion, aggressive caching
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24, // 24h cache
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  // S40: Compression for smaller bundles
  compress: true,

  // S40: Powered-by header removal (minor security + smaller response)
  poweredByHeader: false,

  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        // S40: Cache static assets aggressively
        { key: "X-DNS-Prefetch-Control", value: "on" },
      ],
    },
    // S40: Long-term cache for static assets (JS/CSS/images)
    // dev에서는 Next.js가 자체 캐시 관리하므로, 프로덕션 빌드에서만 적용됨
    {
      source: "/_next/static/(.*)",
      headers: process.env.NODE_ENV === "production"
        ? [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }]
        : [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
    },
    // S40: Cache GeoJSON data (changes infrequently)
    {
      source: "/data/(.*).geojson",
      headers: [
        { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
      ],
    },
  ],

  webpack: (config) => {
    // Three.js 단일 인스턴스 강제 — 여러 복사본이 번들되면
    // R3F reconciler가 Canvas context를 찾지 못해 WebGL context lost 발생
    const threeEntry = require.resolve("three");
    const threePath = path.dirname(path.dirname(threeEntry)); // build/three.cjs → three/
    config.resolve.alias = {
      ...config.resolve.alias,
      // 모든 `import 'three'` / `import * as THREE from 'three'` →  단일 entry
      three$: threeEntry,
      // subpath imports도 단일 패키지에서 resolve
      "three/addons": path.join(threePath, "examples/jsm"),
      "three/tsl": path.join(threePath, "src/nodes/TSL.js"),
      // app_ingame 타이쿤 코드 접근
      "@app-ingame": path.resolve(__dirname, "../../app_ingame"),
      // app_ingame의 node_modules 대신 루트의 R3F/drei를 강제 사용
      // (app_ingame이 별도 node_modules를 가지고 있어 react-reconciler 누락 문제 발생)
      "@react-three/fiber": path.resolve(__dirname, "../../node_modules/@react-three/fiber"),
      "@react-three/drei": path.resolve(__dirname, "../../node_modules/@react-three/drei"),
      "@react-three/postprocessing": path.resolve(__dirname, "../../node_modules/@react-three/postprocessing"),
      "postprocessing": path.resolve(__dirname, "../../node_modules/postprocessing"),
    };
    return config;
  },
};

export default withNextIntl(nextConfig);
