export default {
  server: {
    proxy: {
      "/api": {
        target: "https://6lotteryapi.com",
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(/^\/api/, ""),
      },
    },
  },
};