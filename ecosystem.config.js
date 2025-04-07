module.exports = {
  apps: [
    {
      name: 'dlsu-portal-be',
      script: 'dist/main.js',
      instances: 5,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 9580,
        // Database configuration
        TYPEORM_CONNECTION_RETRIES: 5,
        TYPEORM_MAX_QUERY_EXECUTION_TIME: 60000,
        TYPEORM_ENTITIES_CACHE: true,
        TYPEORM_POOL_SIZE: 30,
        // Add Node.js specific settings
        NODE_OPTIONS:
          '--max-old-space-size=2048 --expose-gc --max-http-header-size=16384',
        // Add keep-alive settings
        KEEP_ALIVE_TIMEOUT: 65000,
        HEADERS_TIMEOUT: 66000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 9580,
        // Database configuration
        TYPEORM_CONNECTION_RETRIES: 5,
        TYPEORM_MAX_QUERY_EXECUTION_TIME: 60000,
        TYPEORM_ENTITIES_CACHE: true,
        TYPEORM_POOL_SIZE: 30,
        // Add Node.js specific settings
        NODE_OPTIONS:
          '--max-old-space-size=2048 --expose-gc --max-http-header-size=16384',
        // Add keep-alive settings
        KEEP_ALIVE_TIMEOUT: 65000,
        HEADERS_TIMEOUT: 66000,
      },
      exp_backoff_restart_delay: 100,
      merge_logs: false,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true,
      // Log configuration
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      log_rotate: true,
      log_max_size: '10M',
      log_max_files: 5,
      // Graceful shutdown and reload
      kill_timeout: 30000,
      wait_ready: true,
      listen_timeout: 30000,
      // Cluster management
      increment_var: 'PORT',
      instance_var: 'INSTANCE_ID',
      // Health check endpoint
      status_endpoint: '/health',
      // Restart settings
      max_restarts: 5,
      min_uptime: '30s',
      // Error handling
      node_args: [
        '--max-old-space-size=2048',
        '--expose-gc',
        '--max-http-header-size=16384',
      ],
      // Source map support
      source_map_support: true,
      // Restart behavior
      restart_delay: 10000,
      // Graceful reload
      force: false,
      // Add watch options
      watch: false,
      ignore_watch: ['node_modules', 'logs', '*.log'],
      // Add clustering options
      deep_monitoring: true,
    },
  ],
};
