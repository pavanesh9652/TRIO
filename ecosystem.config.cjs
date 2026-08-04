module.exports = {
  apps: [
    {
      name: "trio-cafe-web",
      script: "npm",
      args: "run preview",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: 4173
      }
    }
  ]
};
