class ngstompProvider {

    constructor() {
        this.settings = {};
    }

    credential(login, password) {
        this.settings.login = login;
        this.settings.password = password;
        return this;
    }

    url(url) {
        this.settings.url = url;
        return this;
    }

    class(clazz) {
        this.settings.class = clazz;
        return this;
    }

    setting(settingsObject) {
        this.settings = settingsObject;
        return this;
    }

    debug(boolean) {
        this.settings.debug = boolean;
        return this;
    }

    vhost(host) {
        this.settings.vhost = host;
        return this;
    }

    /* @ngInject */
    $get($q, $log, $rootScope, Stomp, $timeout, Session) {
        return new ngStompWebSocket(this.settings, $q, $log, $rootScope, Stomp, $timeout, Session);
    }
}
class ngStompWebSocket {

    /*@ngNoInject*/
    constructor(settings, $q, $log, $rootScope, Stomp, $timeout, Session) {
        this.settings = settings;
        this.settings.RECONNECT_TIMEOUT = this.settings.RECONNECT_TIMEOUT ? this.settings.RECONNECT_TIMEOUT : 3000;
        this.$q = $q;
        this.$timeout = $timeout;
        this.Stomp = Stomp;
        this.$log = $log;
        this.$rootScope = $rootScope;
        this.connections = [];
        this.deferred = this.$q.defer();
        this.promiseResult = this.deferred.promise;
        this.subscribed = [];
        this.Session = Session;
        this.connect();
    }

    prepareUrlWithToken() {
        return this.settings.url + '?access_token=' + this.Session.getSocialBearerToken(true);
    }

    connect() {
        this.stompClient = this.settings['class'] ? this.Stomp.over(new this.settings['class'](this.prepareUrlWithToken())) : this.Stomp.client(this.prepareUrlWithToken());
        this.stompClient.debug = this.settings.debug ? this.$log.debug : function () {
        };

        this.stompClient.connect(
            {},
            () => {
                this.deferred.resolve();
                for (var j = 0, len = this.subscribed.length; j < len; j++) {
                    this.subscribed[j].subscribeFn();
                }
                this.$digestStompAction();
            },
            () => {
                console.log('fail ws');
                this.$timeout(() => {
                    this.connect();
                }, this.settings.RECONNECT_TIMEOUT);
                this.$digestStompAction();
            }
        );
        return this.promiseResult;
    }

    subscribe(url, callback, header, scope) {
        this.promiseResult.then(() => {
            let subscribeFn = () => {
                this.$stompSubscribe(url, callback, header || {});
                this.unRegisterScopeOnDestroy(scope, url);
            };
            this.subscribed.push({
                url: url,
                subscribeFn: subscribeFn
            });
            subscribeFn();
        });
        return this;
    }

    unsubscribe(url) {
        this.promiseResult.then(() => this.$stompUnSubscribe(url));
        return this;
    }

    send(queue, data, header) {
        let sendDeffered = this.$q.defer();

        this.promiseResult.then(() => {
            this.stompClient.send(queue, header || {}, JSON.stringify(data));
            sendDeffered.resolve();
        });

        return sendDeffered.promise;
    }

    disconnect() {
        let disconnectionPromise = this.$q.defer();
        this.stompClient.disconnect(() => {
            disconnectionPromise.resolve();
            this.$digestStompAction();
        });

        return disconnectionPromise.promise;
    }

    $stompSubscribe(queue, callback, header) {
        let self = this;
        let subscription = self.stompClient.subscribe(queue, function() {
            callback.apply(self.stompClient, arguments);
            self.$digestStompAction();
        }, header);
        this.connections.push({url: queue, subscription: subscription});
    }

    $stompUnSubscribe(queue) {
        let indexToRemove = false;
        for (var i = 0, len = this.connections.length; i < len; i++) {
            if (this.connections[i].url === queue) {
                indexToRemove = i;
                this.connections[i].subscription.unsubscribe();
                break;
            }
        }
        if (indexToRemove !== false) {
            this.connections.splice(indexToRemove, 1);
        }

        let subscribedIndexToRemove = false;
        for (var j = 0, len = this.subscribed.length; j < len; j++) {
            if (this.subscribed[j].url === queue) {
                subscribedIndexToRemove = j;
                break;
            }
        }
        if (subscribedIndexToRemove !== false) {
            this.subscribed.splice(subscribedIndexToRemove, 1);
        }
    }

    $digestStompAction() {
        !this.$rootScope.$$phase && this.$rootScope.$apply();
    }

    unRegisterScopeOnDestroy(scope, url) {
        if (scope !== undefined && angular.isFunction(scope.$on))
            scope.$on('$destroy', () => this.unsubscribe(url) );
    }
}
angular.module('AngularStompDK', [])
    .provider('ngstomp', ngstompProvider)
    .constant('Stomp', window.Stomp);
