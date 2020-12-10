const Session = require('./session');
const Proxy = require('./proxy');
const { installServices, routeRequest } = require('./services');

module.exports = function({ post, all }){

    installServices(this);

    post('/login', Session.create);
    post('/logout', Session.match, Session.destroy);

    all(routeRequest, Session.match, Proxy.pass);
}
