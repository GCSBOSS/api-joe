const httpProxy = require('http-proxy');

module.exports = {

    pass({ req, res, log, flash, conf }){

        let preffixSize = this.service.name.length + 1;
        var proxy = httpProxy.createProxyServer({
            ignorePath: true,
            target: this.service.url + req.url.substr(preffixSize),
            proxyTimeout: 3000
        });

        if(flash.claim)
            proxy.on('proxyReq', prq =>
                prq.setHeader(conf.proxy.claimHeader, encodeURIComponent(flash.claim)));

        if(!conf.proxy.preserveCookies)
            proxy.on('proxyReq', prq => prq.removeHeader('Cookie'));

        proxy.web(req, res, () => {
            res.status(503).end();
            log.warn({ req: req }, 'Proxy error calling %s', this.service.url);
        });
    }

}
