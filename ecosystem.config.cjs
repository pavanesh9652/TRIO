module.exports = {
  apps: [
    {
      name: "trio-cafe-web",
      script: "npm",
      args: "run preview -- --host 0.0.0.0",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: 4173,
      },
    },
  ],
};
