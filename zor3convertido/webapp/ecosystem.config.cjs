module.exports = {
  apps: [
    {
      name: 'zorritas',
      cwd: '/home/zorritas/app',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        MIGRATION_DB_PATH: '/home/zorritas/data/migration.db',
        RUNTIME_DB_PATH: '/home/zorritas/data/site-runtime.db',
        NEXT_PUBLIC_BASE_URL: 'https://zorritasmexicanas.com',
        ADMIN_USER: process.env.ADMIN_USER,
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
      },
      max_memory_restart: '1G',
      restart_delay: 3000,
      time: true,
    },
  ],
}
