/*! AngularStompDK v0.3.0 */
(function() {
    'use strict';
    var _createClass = function() {
        function defineProperties(target, props) {
            for (var key in props) {
                var prop = props[key];
                prop.configurable = true;
                if (prop.value)
                    prop.writable = true;
            }
            Object.defineProperties(target, props);
        }
        return function(Constructor, protoProps, staticProps) {
            if (protoProps)
                defineProperties(Constructor.prototype, protoProps);
            if (staticProps)
                defineProperties(Constructor, staticProps);
            return Constructor;
        };
    }();
    var _classCallCheck = function(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError('Cannot call a class as a function');
        }
    };
    var ngstompProvider = function() {
        function ngstompProvider() {
            _classCallCheck(this, ngstompProvider);
            this.settings = {};
        }
        _createClass(ngstompProvider, {
            credential: {
                value: function credential(login, password) {
                    this.settings.login = login;
                    this.settings.password = password;
                    return this;
                }
            },
            url: {
                value: function(_url) {
                    var _urlWrapper = function url(_x) {
                        return _url.apply(this, arguments);
                    };
                    _urlWrapper.toString = function() {
                        return _url.toString();
                    };
                    return _urlWrapper;
                }(function(url) {
                    this.settings.url = url;
                    return this;
                })
            },
            'class': {
                value: function _class(clazz) {
                    this.settings['class'] = clazz;
                    return this;
                }
            },
            setting: {
                value: function setting(settingsObject) {
                    this.settings = settingsObject;
                    return this;
                }
            },
            debug: {
                value: function debug(boolean) {
                    this.settings.debug = boolean;
                    return this;
                }
            },
            vhost: {
                value: function vhost(host) {
                    this.settings.vhost = host;
                    return this;
                }
            },
            $get: {
                /* @ngInject */
                value: ["$q", "$log", "$rootScope", "Stomp", "$timeout", "Session", function $get($q, $log, $rootScope, Stomp, $timeout, Session) {
                    return new ngStompWebSocket(this.settings, $q, $log, $rootScope, Stomp, $timeout, Session);
                }]
            }
        });
        return ngstompProvider;
    }();
    var ngStompWebSocket = function() {
        /*@ngNoInject*/
        function ngStompWebSocket(settings, $q, $log, $rootScope, Stomp, $timeout, Session) {
            _classCallCheck(this, ngStompWebSocket);
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
        }
        _createClass(ngStompWebSocket, {
            prepareUrlWithToken: {
                value: function prepareUrlWithToken() {
                    var _this = this;
                    return this.Session.getSocialBearerToken(true)
                        .then(function(result) {
                            return _this.settings.url + '?access_token=' + result;
                        });
                }
            },
            connect: {
                value: function connect() {
                    var _this = this;
                    return _this.prepareUrlWithToken()
                        .then(function(url) {
                            _this.stompClient = _this.settings['class'] ? _this.Stomp.over(new _this.settings['class'](url)) : _this.Stomp.client(url);
                            _this.stompClient.debug = _this.settings.debug ? _this.$log.debug : function() {};
                            _this.stompClient.connect({}, function() {
                                _this.deferred.resolve();
                                for (var j = 0, len = _this.subscribed.length; j < len; j++) {
                                    _this.subscribed[j].subscribeFn();
                                }
                                _this.$digestStompAction();
                            }, function() {
                                console.log('fail ws');
                                _this.$timeout(function() {
                                    _this.connect();
                                }, _this.settings.RECONNECT_TIMEOUT);
                                _this.$digestStompAction();
                            });
                            return _this.promiseResult;
                        });
                    // var url = 'http://172.16.16.32:9000/ws/chat?access_token=5e5b4232-f078-49ff-a411-4f8693c6c911';
                    // _this.stompClient = _this.settings['class'] ? _this.Stomp.over(new _this.settings['class'](url)) : _this.Stomp.client(url);
                    // _this.stompClient.debug = _this.settings.debug ? _this.$log.debug : function() {};
                    // _this.stompClient.connect({}, function() {
                    //     _this.deferred.resolve();
                    //     for (var j = 0, len = _this.subscribed.length; j < len; j++) {
                    //         _this.subscribed[j].subscribeFn();
                    //     }
                    //     _this.$digestStompAction();
                    // }, function() {
                    //     console.log('fail ws');
                    //     _this.$timeout(function() {
                    //         _this.connect();
                    //     }, _this.settings.RECONNECT_TIMEOUT);
                    //     _this.$digestStompAction();
                    // });
                }
            },
            isConnected: {
                value: function isConnected() {
                    return this.stompClient && this.stompClient.connected;
                }
            },
            subscribe: {
                value: function subscribe(url, callback, header, scope) {
                    var _this = this;
                    this.promiseResult.then(function() {
                        var subscribeFn = function() {
                            _this.$stompSubscribe(url, callback, header || {});
                            _this.unRegisterScopeOnDestroy(scope, url);
                        };
                        _this.subscribed.push({
                            url: url,
                            subscribeFn: subscribeFn
                        });
                        subscribeFn();
                    });
                    return this;
                }
            },
            unsubscribe: {
                value: function unsubscribe(url) {
                    var _this = this;
                    this.promiseResult.then(function() {
                        return _this.$stompUnSubscribe(url);
                    });
                    return this;
                }
            },
            send: {
                value: function send(queue, data, header) {
                    var _this = this;
                    var sendDeffered = this.$q.defer();
                    this.promiseResult.then(function() {
                        _this.stompClient.send(queue, header || {}, JSON.stringify(data));
                        sendDeffered.resolve();
                    });
                    return sendDeffered.promise;
                }
            },
            disconnect: {
                value: function disconnect() {
                    var _this = this;
                    var disconnectionPromise = this.$q.defer();
                    this.stompClient.disconnect(function() {
                        disconnectionPromise.resolve();
                        _this.$digestStompAction();
                    });
                    return disconnectionPromise.promise;
                }
            },
            $stompSubscribe: {
                value: function $stompSubscribe(queue, callback, header) {
                    var self = this;
                    var subscription = self.stompClient.subscribe(queue, function() {
                        callback.apply(self.stompClient, arguments);
                        self.$digestStompAction();
                    }, header);
                    this.connections.push({
                        url: queue,
                        subscription: subscription
                    });
                }
            },
            $stompUnSubscribe: {
                value: function $stompUnSubscribe(queue) {
                    var indexToRemove = false;
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
                    var subscribedIndexToRemove = false;
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
            },
            $digestStompAction: {
                value: function $digestStompAction() {
                    !this.$rootScope.$$phase && this.$rootScope.$apply();
                }
            },
            unRegisterScopeOnDestroy: {
                value: function unRegisterScopeOnDestroy(scope, url) {
                    var _this = this;
                    if (scope !== undefined && angular.isFunction(scope.$on))
                        scope.$on('$destroy', function() {
                            return _this.unsubscribe(url);
                        });
                }
            }
        });
        return ngStompWebSocket;
    }();
    angular.module('AngularStompDK', []).provider('ngstomp', ngstompProvider).constant('Stomp', window.Stomp);
}());
