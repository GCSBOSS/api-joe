const Session = require('./session');
const Proxy = require('./proxy');
const { installServices, routeRequest } = require('./services');
const { onClientConnect, onClientClose } = require('./events');

module.exports = function(methods){

    if(this.conf.services)
        installServices(this);

    let { post, ws, all } = methods;


    post('/login', Session.create);
    post('/logout', Session.match, Session.destroy);
    ws('/events', { connect: onClientConnect, close: onClientClose });

    all(routeRequest, Session.match, Proxy.pass);
}
