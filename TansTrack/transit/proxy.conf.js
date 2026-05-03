const PROXY_CONFIG = [
  {
    context: ['/api/'],
    target: 'http://127.0.0.1:8000',
    secure: false,
    changeOrigin: true,
    logLevel: 'debug',
    timeout: 60000,
    proxyTimeout: 60000,
    headers: {
      'Connection': 'keep-alive'
    },
    onError: function (err, req, res) {
      console.log('Proxy Error:', err);
    },
    onProxyReq: function (proxyReq, req, res) {
      console.log('Proxying request to:', proxyReq.path);
    }
  }
];

module.exports = PROXY_CONFIG;