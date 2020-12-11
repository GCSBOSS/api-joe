const { pathToRegexp } = require('path-to-regexp');

const SERVICE_KEYS = { url: 1, endpoints: 1, domain: 1, secure: 1, exposed: 1 };
const PRG_OPTS = { sensitive: true, strict: true };

module.exports = {

    installServices(app){
        app.global.services = {};
        app.global.domains = {};

        for(let name in app.conf.services){
            let service = app.conf.services[name];

            for(let key in service)
                if(!(key in SERVICE_KEYS))
                    throw new Error(`Unsupported key '${key}' in services definition`);

            let def = { ...service, name };

            service.endpoints = Array.isArray(service.endpoints) ? service.endpoints : [];
            def.endpoints =  {};
            def.dynamicEndpoints = [];
            for(spec of service.endpoints)
                if(spec.indexOf(':') >= 0){
                    let [ method, path ] = spec.split(' ');
                    let regexp = pathToRegexp(path, [], PRG_OPTS);
                    def.dynamicEndpoints.push({ method, regexp });
                }
                else
                    def.endpoints[spec] = 1;

            app.global.services[name] = def;

            if(service.domain)
                app.global.services[service.domain] = def;
        }
    },

    routeRequest({ flash, params, headers, services, res, next, req }){
        let [ host ] = headers.host.split(':');
        let [ prefix, ...path ] = params.path.split('/');
        host = host.toLowerCase();
        flash.service = services[host] || services[prefix];
        flash.removePrefix = !services[host];

        res.notFound(!flash.service);

        if(!flash.service.exposed){
            let p = flash.removePrefix ? path : [ prefix, ...path ];

            if(req.method + ' /' + p.join('/') in flash.service.endpoints)
                return next();

            for(let ep of flash.service.dynamicEndpoints)
                if(ep.regexp.exec('/' + p.join('/')))
                    return next();

            res.notFound(true);
        }

        next();
    }
}
