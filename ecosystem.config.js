module.exports = {
  apps: [
    {
      name: 'dlsu-portal-be',
      script: 'dist/main.js',
      instances: 5, // Use all available CPU cores
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      exp_backoff_restart_delay: 100,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/pm2/error.log',
      out_file: 'logs/pm2/out.log',
      time: true,
      // Graceful shutdown and reload
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      // Cluster management
      increment_var: 'PORT',
      instance_var: 'INSTANCE_ID',
      // Health check endpoint
      status_endpoint: '/health',
    },
  ],
};
