
const SERVICE_KEYS = { url: 1, endpoints: 1, domain: 1, secure: 1, exposed: 1 };

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
            for(spec of service.endpoints)
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
            res.notFound(!(req.method + ' /' + p.join('/') in flash.service.endpoints));
        }

        next();
    }
}
