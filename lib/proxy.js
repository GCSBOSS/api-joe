const httpProxy = require('http-proxy');

module.exports = {

    pass({ req, res, log, flash, conf }){

        let target = flash.service.url + (flash.removePrefix
            ? req.url.substr(flash.service.name.length + 1)
            : req.url);

        let proxy = httpProxy.createProxyServer({
            ignorePath: true, target, proxyTimeout: 3000,
            selfHandleResponse: true
        });

        proxy.on('proxyReq', prq => {
            prq.removeHeader(conf.proxy.claimHeader);

            if(!conf.proxy.preserveCookies)
                prq.removeHeader('Cookie');

            prq.removeHeader('Accept-Encoding');

            if(flash.claim)
                prq.setHeader(conf.proxy.claimHeader, encodeURIComponent(flash.claim));
        });

        proxy.on('proxyRes', (prs, req, res) => {

            /* istanbul ignore next */
            if(prs.headers['content-type'])
                res.setHeader('Content-Type', prs.headers['content-type']);
            res.statusCode = prs.statusCode;
            prs.on('data', chunk =>  res.write(chunk));
            prs.on('end', () => res.end());
        });

        proxy.web(req, res, err => {
            res.status(503).end();
            log.error({ ...err, target, class: 'proxy' }, 'Proxyed request to %s', target);
        });
    }

}
