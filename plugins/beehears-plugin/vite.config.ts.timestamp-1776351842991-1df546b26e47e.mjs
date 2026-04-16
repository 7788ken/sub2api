// vite.config.ts
import { defineConfig } from "file:///Users/lijianqian/Work/tools/Beehears.com/coding_sub2api_beehers.com/plugins/beehears-plugin/node_modules/.pnpm/vite@5.4.21_@types+node@20.19.39/node_modules/vite/dist/node/index.js";
import react from "file:///Users/lijianqian/Work/tools/Beehears.com/coding_sub2api_beehers.com/plugins/beehears-plugin/node_modules/.pnpm/@vitejs+plugin-react@4.7.0_vite@5.4.21_@types+node@20.19.39_/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [react()],
  root: ".",
  publicDir: false,
  build: {
    outDir: "dist/frontend",
    emptyOutDir: true
  },
  server: {
    port: 3001,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvbGlqaWFucWlhbi9Xb3JrL3Rvb2xzL0JlZWhlYXJzLmNvbS9jb2Rpbmdfc3ViMmFwaV9iZWVoZXJzLmNvbS9wbHVnaW5zL2JlZWhlYXJzLXBsdWdpblwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL2xpamlhbnFpYW4vV29yay90b29scy9CZWVoZWFycy5jb20vY29kaW5nX3N1YjJhcGlfYmVlaGVycy5jb20vcGx1Z2lucy9iZWVoZWFycy1wbHVnaW4vdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL2xpamlhbnFpYW4vV29yay90b29scy9CZWVoZWFycy5jb20vY29kaW5nX3N1YjJhcGlfYmVlaGVycy5jb20vcGx1Z2lucy9iZWVoZWFycy1wbHVnaW4vdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpXSxcbiAgcm9vdDogJy4nLFxuICBwdWJsaWNEaXI6IGZhbHNlLFxuICBidWlsZDoge1xuICAgIG91dERpcjogJ2Rpc3QvZnJvbnRlbmQnLFxuICAgIGVtcHR5T3V0RGlyOiB0cnVlLFxuICB9LFxuICBzZXJ2ZXI6IHtcbiAgICBwb3J0OiAzMDAxLFxuICAgIHByb3h5OiB7XG4gICAgICAnL2FwaSc6IHtcbiAgICAgICAgdGFyZ2V0OiAnaHR0cDovL2xvY2FsaG9zdDozMDAxJyxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXNjLFNBQVMsb0JBQW9CO0FBQ25lLE9BQU8sV0FBVztBQUVsQixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDakIsTUFBTTtBQUFBLEVBQ04sV0FBVztBQUFBLEVBQ1gsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLElBQ1IsYUFBYTtBQUFBLEVBQ2Y7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxRQUNOLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxNQUNoQjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
