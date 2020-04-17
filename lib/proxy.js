const httpProxy = require('http-proxy');

module.exports = {

    pass({ req, res, log, flash, conf, headers }){


        let preffixSize = this.service.name.length + 1;
        let target = this.service.url + req.url.substr(preffixSize);

        let proxy = httpProxy.createProxyServer({
            ignorePath: true, target, proxyTimeout: 3000,
            selfHandleResponse: true
        });

        //let c1 = res.getHeader('Access-Control-Allow-Origin');
        //let c2 = res.getHeader('Access-Control-Allow-Credentials');

        proxy.on('proxyReq', prq => {
            prq.removeHeader(conf.proxy.claimHeader);

            if(!conf.proxy.preserveCookies)
                prq.removeHeader('Cookie');

            prq.removeHeader('Accept-Encoding');

            if(flash.claim)
                prq.setHeader(conf.proxy.claimHeader, encodeURIComponent(flash.claim));
        });

        proxy.on('proxyRes', (prs, req, res) => {
            //res.setHeaders(prs.getHeaders());
            //res.setHeader('Access-Control-Allow-Origin', c1);
            //res.setHeader('Access-Control-Allow-Credentials', c2);
            if(prs.headers['content-type'])
                res.setHeader('Content-Type', prs.headers['content-type']);
            res.statusCode = prs.statusCode;
            prs.on('data', chunk =>  res.write(chunk));
            prs.on('end', () => res.end());
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
