const Session = require('./session');
const { installServices } = require('./services');
const { onClientConnect, onClientClose } = require('./events');

module.exports = function(methods){

    if(this.conf.services)
        installServices(methods, this.conf.services);

    let { post, ws } = methods;

    post('/login', Session.create);
    post('/logout', Session.match, Session.destroy);
    ws('/events', { connect: onClientConnect, close: onClientClose });
}
