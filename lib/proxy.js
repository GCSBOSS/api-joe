const httpProxy = require('http-proxy');

module.exports = {

    pass({ req, res, log, flash, conf, headers }){


        let preffixSize = this.service.name.length + 1;
        let target = this.service.url + req.url.substr(preffixSize);

        let proxy = httpProxy.createProxyServer({
            ignorePath: true, target, proxyTimeout: 3000
        });

        proxy.on('proxyReq', prq => {
            prq.removeHeader(conf.proxy.claimHeader);

            if(!conf.proxy.preserveCookies)
                prq.removeHeader('Cookie');

            prq.removeHeader('Accept-Encoding');

            if(flash.claim)
                prq.setHeader(conf.proxy.claimHeader, encodeURIComponent(flash.claim));
        });

        if(headers.upgrade == 'websocket'){
            delete req.headers[conf.proxy.claimHeader];

            if(flash.claim)
                req.headers[conf.proxy.claimHeader] = encodeURIComponent(flash.claim);

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
