
const Session = require('./session');
const Proxy = require('./proxy');

function installEndpoint(methodFn, path, service){

    if(typeof methodFn !== 'function')
        throw Error('Invalid method name in services definition');

    methodFn(path,
        Session.match,
        Proxy.pass.bind({ service })
    );

}

const SERVICE_KEYS = { url: 1, endpoints: 1 };

function installService(methods, name, service){

    let key = '';
    let badKey = Object.keys(service).some( k => {
        key = k;
        return !(k in SERVICE_KEYS);
    });

    if(badKey)
        throw new Error(`Unsupported key '${key}' in services definition`);

    service = { ...service, name };

    if(!Array.isArray(service.endpoints) || service.endpoints.length === 0)
        throw new Error(`Service '${name}' must have at least 1 endpoint`);

    for(let spec of service.endpoints){
        let [ method, path ] = spec.split(' ');
        method = methods[method.toLowerCase()];
        installEndpoint(method, '/' + name + path, service);
    }
}

function installServices(methods, services){
    for(let name in services)
        installService(methods, name, services[name]);
}

module.exports = { installService, installServices, installEndpoint };
