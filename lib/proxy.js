const httpProxy = require('http-proxy');

module.exports = {

    pass({ req, res, log, flash, conf, headers }){


        let preffixSize = this.service.name.length + 1;
        let target = this.service.url + req.url.substr(preffixSize);

        let proxy = httpProxy.createProxyServer({
            ignorePath: true, target, proxyTimeout: 3000
        });

        if(flash.claim)
            proxy.on('proxyReq', prq =>
                prq.setHeader(conf.proxy.claimHeader, encodeURIComponent(flash.claim)));

        if(!conf.proxy.preserveCookies)
            proxy.on('proxyReq', prq => prq.removeHeader('Cookie'));

        if(headers.upgrade == 'websocket'){
            proxy.ws(req, req.socket, undefined);
            log.debug({ target, class: 'ws' }, 'Proxyed websocket upgrade to %s', target);
            return;
        }

        proxy.web(req, res, err => {
            res.status(503).end();
            log.error({ ...err, target, class: 'proxy' }, 'Proxyed request to %s', target);
        });
    }

}
