/**
 * @license Angular v8.2.12
 * (c) 2010-2019 Google LLC. https://angular.io/
 * License: MIT
 */

import { __read, __assign, __decorate } from 'tslib';
import { Location, PlatformLocation, LocationStrategy, APP_BASE_HREF, CommonModule, HashLocationStrategy, PathLocationStrategy } from '@angular/common';
import { InjectionToken, Inject, Optional, NgModule } from '@angular/core';
import { UpgradeModule } from '@angular/upgrade/static';

/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
function stripPrefix(val, prefix) {
    return val.startsWith(prefix) ? val.substring(prefix.length) : val;
}
function deepEqual(a, b) {
    if (a === b) {
        return true;
    }
    else if (!a || !b) {
        return false;
    }
    else {
        try {
            if ((a.prototype !== b.prototype) || (Array.isArray(a) && Array.isArray(b))) {
                return false;
            }
            return JSON.stringify(a) === JSON.stringify(b);
        }
        catch (e) {
            return false;
        }
    }
}
function isAnchor(el) {
    return el.href !== undefined;
}
function isPromise(obj) {
    // allow any Promise/A+ compliant thenable.
    // It's up to the caller to ensure that obj.then conforms to the spec
    return !!obj && typeof obj.then === 'function';
}

/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var PATH_MATCH = /^([^?#]*)(\?([^#]*))?(#(.*))?$/;
var DOUBLE_SLASH_REGEX = /^\s*[\\/]{2,}/;
var IGNORE_URI_REGEXP = /^\s*(javascript|mailto):/i;
var DEFAULT_PORTS = {
    'http:': 80,
    'https:': 443,
    'ftp:': 21
};
/**
 * Location service that provides a drop-in replacement for the $location service
 * provided in AngularJS.
 *
 * @see [Using the Angular Unified Location Service](guide/upgrade#using-the-unified-angular-location-service)
 *
 * @publicApi
 */
var $locationShim = /** @class */ (function () {
    function $locationShim($injector, location, platformLocation, urlCodec, locationStrategy) {
        var _this = this;
        this.location = location;
        this.platformLocation = platformLocation;
        this.urlCodec = urlCodec;
        this.locationStrategy = locationStrategy;
        this.initalizing = true;
        this.updateBrowser = false;
        this.$$absUrl = '';
        this.$$url = '';
        this.$$host = '';
        this.$$replace = false;
        this.$$path = '';
        this.$$search = '';
        this.$$hash = '';
        this.$$changeListeners = [];
        this.cachedState = null;
        this.lastBrowserUrl = '';
        // This variable should be used *only* inside the cacheState function.
        this.lastCachedState = null;
        var initialUrl = this.browserUrl();
        var parsedUrl = this.urlCodec.parse(initialUrl);
        if (typeof parsedUrl === 'string') {
            throw 'Invalid URL';
        }
        this.$$protocol = parsedUrl.protocol;
        this.$$host = parsedUrl.hostname;
        this.$$port = parseInt(parsedUrl.port) || DEFAULT_PORTS[parsedUrl.protocol] || null;
        this.$$parseLinkUrl(initialUrl, initialUrl);
        this.cacheState();
        this.$$state = this.browserState();
        if (isPromise($injector)) {
            $injector.then(function ($i) { return _this.initialize($i); });
        }
        else {
            this.initialize($injector);
        }
    }
    $locationShim.prototype.initialize = function ($injector) {
        var _this = this;
        var $rootScope = $injector.get('$rootScope');
        var $rootElement = $injector.get('$rootElement');
        $rootElement.on('click', function (event) {
            if (event.ctrlKey || event.metaKey || event.shiftKey || event.which === 2 ||
                event.button === 2) {
                return;
            }
            var elm = event.target;
            // traverse the DOM up to find first A tag
            while (elm && elm.nodeName.toLowerCase() !== 'a') {
                // ignore rewriting if no A tag (reached root element, or no parent - removed from document)
                if (elm === $rootElement[0] || !(elm = elm.parentNode)) {
                    return;
                }
            }
            if (!isAnchor(elm)) {
                return;
            }
            var absHref = elm.href;
            var relHref = elm.getAttribute('href');
            // Ignore when url is started with javascript: or mailto:
            if (IGNORE_URI_REGEXP.test(absHref)) {
                return;
            }
            if (absHref && !elm.getAttribute('target') && !event.isDefaultPrevented()) {
                if (_this.$$parseLinkUrl(absHref, relHref)) {
                    // We do a preventDefault for all urls that are part of the AngularJS application,
                    // in html5mode and also without, so that we are able to abort navigation without
                    // getting double entries in the location history.
                    event.preventDefault();
                    // update location manually
                    if (_this.absUrl() !== _this.browserUrl()) {
                        $rootScope.$apply();
                    }
                }
            }
        });
        this.location.onUrlChange(function (newUrl, newState) {
            var oldUrl = _this.absUrl();
            var oldState = _this.$$state;
            _this.$$parse(newUrl);
            newUrl = _this.absUrl();
            _this.$$state = newState;
            var defaultPrevented = $rootScope.$broadcast('$locationChangeStart', newUrl, oldUrl, newState, oldState)
                .defaultPrevented;
            // if the location was changed by a `$locationChangeStart` handler then stop
            // processing this location change
            if (_this.absUrl() !== newUrl)
                return;
            // If default was prevented, set back to old state. This is the state that was locally
            // cached in the $location service.
            if (defaultPrevented) {
                _this.$$parse(oldUrl);
                _this.state(oldState);
                _this.setBrowserUrlWithFallback(oldUrl, false, oldState);
            }
            else {
                _this.initalizing = false;
                $rootScope.$broadcast('$locationChangeSuccess', newUrl, oldUrl, newState, oldState);
                _this.resetBrowserUpdate();
            }
            if (!$rootScope.$$phase) {
                $rootScope.$digest();
            }
        });
        // update browser
        $rootScope.$watch(function () {
            if (_this.initalizing || _this.updateBrowser) {
                _this.updateBrowser = false;
                var oldUrl_1 = _this.browserUrl();
                var newUrl = _this.absUrl();
                var oldState_1 = _this.browserState();
                var currentReplace_1 = _this.$$replace;
                var urlOrStateChanged_1 = !_this.urlCodec.areEqual(oldUrl_1, newUrl) || oldState_1 !== _this.$$state;
                // Fire location changes one time to on initialization. This must be done on the
                // next tick (thus inside $evalAsync()) in order for listeners to be registered
                // before the event fires. Mimicing behavior from $locationWatch:
                // https://github.com/angular/angular.js/blob/master/src/ng/location.js#L983
                if (_this.initalizing || urlOrStateChanged_1) {
                    _this.initalizing = false;
                    $rootScope.$evalAsync(function () {
                        // Get the new URL again since it could have changed due to async update
                        var newUrl = _this.absUrl();
                        var defaultPrevented = $rootScope
                            .$broadcast('$locationChangeStart', newUrl, oldUrl_1, _this.$$state, oldState_1)
                            .defaultPrevented;
                        // if the location was changed by a `$locationChangeStart` handler then stop
                        // processing this location change
                        if (_this.absUrl() !== newUrl)
                            return;
                        if (defaultPrevented) {
                            _this.$$parse(oldUrl_1);
                            _this.$$state = oldState_1;
                        }
                        else {
                            // This block doesn't run when initalizing because it's going to perform the update to
                            // the URL which shouldn't be needed when initalizing.
                            if (urlOrStateChanged_1) {
                                _this.setBrowserUrlWithFallback(newUrl, currentReplace_1, oldState_1 === _this.$$state ? null : _this.$$state);
                                _this.$$replace = false;
                            }
                            $rootScope.$broadcast('$locationChangeSuccess', newUrl, oldUrl_1, _this.$$state, oldState_1);
                        }
                    });
                }
            }
            _this.$$replace = false;
        });
    };
    $locationShim.prototype.resetBrowserUpdate = function () {
        this.$$replace = false;
        this.$$state = this.browserState();
        this.updateBrowser = false;
        this.lastBrowserUrl = this.browserUrl();
    };
    $locationShim.prototype.browserUrl = function (url, replace, state) {
        // In modern browsers `history.state` is `null` by default; treating it separately
        // from `undefined` would cause `$browser.url('/foo')` to change `history.state`
        // to undefined via `pushState`. Instead, let's change `undefined` to `null` here.
        if (typeof state === 'undefined') {
            state = null;
        }
        // setter
        if (url) {
            var sameState = this.lastHistoryState === state;
            // Normalize the inputted URL
            url = this.urlCodec.parse(url).href;
            // Don't change anything if previous and current URLs and states match.
            if (this.lastBrowserUrl === url && sameState) {
                return this;
            }
            this.lastBrowserUrl = url;
            this.lastHistoryState = state;
            // Remove server base from URL as the Angular APIs for updating URL require
            // it to be the path+.
            url = this.stripBaseUrl(this.getServerBase(), url) || url;
            // Set the URL
            if (replace) {
                this.locationStrategy.replaceState(state, '', url, '');
            }
            else {
                this.locationStrategy.pushState(state, '', url, '');
            }
            this.cacheState();
            return this;
            // getter
        }
        else {
            return this.platformLocation.href;
        }
    };
    $locationShim.prototype.cacheState = function () {
        // This should be the only place in $browser where `history.state` is read.
        this.cachedState = this.platformLocation.getState();
        if (typeof this.cachedState === 'undefined') {
            this.cachedState = null;
        }
        // Prevent callbacks fo fire twice if both hashchange & popstate were fired.
        if (deepEqual(this.cachedState, this.lastCachedState)) {
            this.cachedState = this.lastCachedState;
        }
        this.lastCachedState = this.cachedState;
        this.lastHistoryState = this.cachedState;
    };
    /**
     * This function emulates the $browser.state() function from AngularJS. It will cause
     * history.state to be cached unless changed with deep equality check.
     */
    $locationShim.prototype.browserState = function () { return this.cachedState; };
    $locationShim.prototype.stripBaseUrl = function (base, url) {
        if (url.startsWith(base)) {
            return url.substr(base.length);
        }
        return undefined;
    };
    $locationShim.prototype.getServerBase = function () {
        var _a = this.platformLocation, protocol = _a.protocol, hostname = _a.hostname, port = _a.port;
        var baseHref = this.locationStrategy.getBaseHref();
        var url = protocol + "//" + hostname + (port ? ':' + port : '') + (baseHref || '/');
        return url.endsWith('/') ? url : url + '/';
    };
    $locationShim.prototype.parseAppUrl = function (url) {
        if (DOUBLE_SLASH_REGEX.test(url)) {
            throw new Error("Bad Path - URL cannot start with double slashes: " + url);
        }
        var prefixed = (url.charAt(0) !== '/');
        if (prefixed) {
            url = '/' + url;
        }
        var match = this.urlCodec.parse(url, this.getServerBase());
        if (typeof match === 'string') {
            throw new Error("Bad URL - Cannot parse URL: " + url);
        }
        var path = prefixed && match.pathname.charAt(0) === '/' ? match.pathname.substring(1) : match.pathname;
        this.$$path = this.urlCodec.decodePath(path);
        this.$$search = this.urlCodec.decodeSearch(match.search);
        this.$$hash = this.urlCodec.decodeHash(match.hash);
        // make sure path starts with '/';
        if (this.$$path && this.$$path.charAt(0) !== '/') {
            this.$$path = '/' + this.$$path;
        }
    };
    /**
     * Registers listeners for URL changes. This API is used to catch updates performed by the
     * AngularJS framework. These changes are a subset of the `$locationChangeStart` and
     * `$locationChangeSuccess` events which fire when AngularJS updates its internally-referenced
     * version of the browser URL.
     *
     * It's possible for `$locationChange` events to happen, but for the browser URL
     * (window.location) to remain unchanged. This `onChange` callback will fire only when AngularJS
     * actually updates the browser URL (window.location).
     *
     * @param fn The callback function that is triggered for the listener when the URL changes.
     * @param err The callback function that is triggered when an error occurs.
     */
    $locationShim.prototype.onChange = function (fn, err) {
        if (err === void 0) { err = function (e) { }; }
        this.$$changeListeners.push([fn, err]);
    };
    /** @internal */
    $locationShim.prototype.$$notifyChangeListeners = function (url, state, oldUrl, oldState) {
        if (url === void 0) { url = ''; }
        if (oldUrl === void 0) { oldUrl = ''; }
        this.$$changeListeners.forEach(function (_a) {
            var _b = __read(_a, 2), fn = _b[0], err = _b[1];
            try {
                fn(url, state, oldUrl, oldState);
            }
            catch (e) {
                err(e);
            }
        });
    };
    /**
     * Parses the provided URL, and sets the current URL to the parsed result.
     *
     * @param url The URL string.
     */
    $locationShim.prototype.$$parse = function (url) {
        var pathUrl;
        if (url.startsWith('/')) {
            pathUrl = url;
        }
        else {
            // Remove protocol & hostname if URL starts with it
            pathUrl = this.stripBaseUrl(this.getServerBase(), url);
        }
        if (typeof pathUrl === 'undefined') {
            throw new Error("Invalid url \"" + url + "\", missing path prefix \"" + this.getServerBase() + "\".");
        }
        this.parseAppUrl(pathUrl);
        if (!this.$$path) {
            this.$$path = '/';
        }
        this.composeUrls();
    };
    /**
     * Parses the provided URL and its relative URL.
     *
     * @param url The full URL string.
     * @param relHref A URL string relative to the full URL string.
     */
    $locationShim.prototype.$$parseLinkUrl = function (url, relHref) {
        // When relHref is passed, it should be a hash and is handled separately
        if (relHref && relHref[0] === '#') {
            this.hash(relHref.slice(1));
            return true;
        }
        var rewrittenUrl;
        var appUrl = this.stripBaseUrl(this.getServerBase(), url);
        if (typeof appUrl !== 'undefined') {
            rewrittenUrl = this.getServerBase() + appUrl;
        }
        else if (this.getServerBase() === url + '/') {
            rewrittenUrl = this.getServerBase();
        }
        // Set the URL
        if (rewrittenUrl) {
            this.$$parse(rewrittenUrl);
        }
        return !!rewrittenUrl;
    };
    $locationShim.prototype.setBrowserUrlWithFallback = function (url, replace, state) {
        var oldUrl = this.url();
        var oldState = this.$$state;
        try {
            this.browserUrl(url, replace, state);
            // Make sure $location.state() returns referentially identical (not just deeply equal)
            // state object; this makes possible quick checking if the state changed in the digest
            // loop. Checking deep equality would be too expensive.
            this.$$state = this.browserState();
            this.$$notifyChangeListeners(url, state, oldUrl, oldState);
        }
        catch (e) {
            // Restore old values if pushState fails
            this.url(oldUrl);
            this.$$state = oldState;
            throw e;
        }
    };
    $locationShim.prototype.composeUrls = function () {
        this.$$url = this.urlCodec.normalize(this.$$path, this.$$search, this.$$hash);
        this.$$absUrl = this.getServerBase() + this.$$url.substr(1); // remove '/' from front of URL
        this.updateBrowser = true;
    };
    /**
     * Retrieves the full URL representation with all segments encoded according to
     * rules specified in
     * [RFC 3986](http://www.ietf.org/rfc/rfc3986.txt).
     *
     *
     * ```js
     * // given URL http://example.com/#/some/path?foo=bar&baz=xoxo
     * let absUrl = $location.absUrl();
     * // => "http://example.com/#/some/path?foo=bar&baz=xoxo"
     * ```
     */
    $locationShim.prototype.absUrl = function () { return this.$$absUrl; };
    $locationShim.prototype.url = function (url) {
        if (typeof url === 'string') {
            if (!url.length) {
                url = '/';
            }
            var match = PATH_MATCH.exec(url);
            if (!match)
                return this;
            if (match[1] || url === '')
                this.path(this.urlCodec.decodePath(match[1]));
            if (match[2] || match[1] || url === '')
                this.search(match[3] || '');
            this.hash(match[5] || '');
            // Chainable method
            return this;
        }
        return this.$$url;
    };
    /**
     * Retrieves the protocol of the current URL.
     *
     * ```js
     * // given URL http://example.com/#/some/path?foo=bar&baz=xoxo
     * let protocol = $location.protocol();
     * // => "http"
     * ```
     */
    $locationShim.prototype.protocol = function () { return this.$$protocol; };
    /**
     * Retrieves the protocol of the current URL.
     *
     * In contrast to the non-AngularJS version `location.host` which returns `hostname:port`, this
     * returns the `hostname` portion only.
     *
     *
     * ```js
     * // given URL http://example.com/#/some/path?foo=bar&baz=xoxo
     * let host = $location.host();
     * // => "example.com"
     *
     * // given URL http://user:password@example.com:8080/#/some/path?foo=bar&baz=xoxo
     * host = $location.host();
     * // => "example.com"
     * host = location.host;
     * // => "example.com:8080"
     * ```
     */
    $locationShim.prototype.host = function () { return this.$$host; };
    /**
     * Retrieves the port of the current URL.
     *
     * ```js
     * // given URL http://example.com/#/some/path?foo=bar&baz=xoxo
     * let port = $location.port();
     * // => 80
     * ```
     */
    $locationShim.prototype.port = function () { return this.$$port; };
    $locationShim.prototype.path = function (path) {
        if (typeof path === 'undefined') {
            return this.$$path;
        }
        // null path converts to empty string. Prepend with "/" if needed.
        path = path !== null ? path.toString() : '';
        path = path.charAt(0) === '/' ? path : '/' + path;
        this.$$path = path;
        this.composeUrls();
        return this;
    };
    $locationShim.prototype.search = function (search, paramValue) {
        switch (arguments.length) {
            case 0:
                return this.$$search;
            case 1:
                if (typeof search === 'string' || typeof search === 'number') {
                    this.$$search = this.urlCodec.decodeSearch(search.toString());
                }
                else if (typeof search === 'object' && search !== null) {
                    // Copy the object so it's never mutated
                    search = __assign({}, search);
                    // remove object undefined or null properties
                    for (var key in search) {
                        if (search[key] == null)
                            delete search[key];
                    }
                    this.$$search = search;
                }
                else {
                    throw new Error('LocationProvider.search(): First argument must be a string or an object.');
                }
                break;
            default:
                if (typeof search === 'string') {
                    var currentSearch = this.search();
                    if (typeof paramValue === 'undefined' || paramValue === null) {
                        delete currentSearch[search];
                        return this.search(currentSearch);
                    }
                    else {
                        currentSearch[search] = paramValue;
                        return this.search(currentSearch);
                    }
                }
        }
        this.composeUrls();
        return this;
    };
    $locationShim.prototype.hash = function (hash) {
        if (typeof hash === 'undefined') {
            return this.$$hash;
        }
        this.$$hash = hash !== null ? hash.toString() : '';
        this.composeUrls();
        return this;
    };
    /**
     * Changes to `$location` during the current `$digest` will replace the current
     * history record, instead of adding a new one.
     */
    $locationShim.prototype.replace = function () {
        this.$$replace = true;
        return this;
    };
    $locationShim.prototype.state = function (state) {
        if (typeof state === 'undefined') {
            return this.$$state;
        }
        this.$$state = state;
        return this;
    };
    return $locationShim;
}());
/**
 * The factory function used to create an instance of the `$locationShim` in Angular,
 * and provides an API-compatiable `$locationProvider` for AngularJS.
 *
 * @publicApi
 */
var $locationShimProvider = /** @class */ (function () {
    function $locationShimProvider(ngUpgrade, location, platformLocation, urlCodec, locationStrategy) {
        this.ngUpgrade = ngUpgrade;
        this.location = location;
        this.platformLocation = platformLocation;
        this.urlCodec = urlCodec;
        this.locationStrategy = locationStrategy;
    }
    /**
     * Factory method that returns an instance of the $locationShim
     */
    $locationShimProvider.prototype.$get = function () {
        return new $locationShim(this.ngUpgrade.$injector, this.location, this.platformLocation, this.urlCodec, this.locationStrategy);
    };
    /**
     * Stub method used to keep API compatible with AngularJS. This setting is configured through
     * the LocationUpgradeModule's `config` method in your Angular app.
     */
    $locationShimProvider.prototype.hashPrefix = function (prefix) {
        throw new Error('Configure LocationUpgrade through LocationUpgradeModule.config method.');
    };
    /**
     * Stub method used to keep API compatible with AngularJS. This setting is configured through
     * the LocationUpgradeModule's `config` method in your Angular app.
     */
    $locationShimProvider.prototype.html5Mode = function (mode) {
        throw new Error('Configure LocationUpgrade through LocationUpgradeModule.config method.');
    };
    return $locationShimProvider;
}());

/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/**
 * A codec for encoding and decoding URL parts.
 *
 * @publicApi
 **/
var UrlCodec = /** @class */ (function () {
    function UrlCodec() {
    }
    return UrlCodec;
}());
/**
 * A `UrlCodec` that uses logic from AngularJS to serialize and parse URLs
 * and URL parameters.
 *
 * @publicApi
 */
var AngularJSUrlCodec = /** @class */ (function () {
    function AngularJSUrlCodec() {
    }
    // https://github.com/angular/angular.js/blob/864c7f0/src/ng/location.js#L15
    AngularJSUrlCodec.prototype.encodePath = function (path) {
        var segments = path.split('/');
        var i = segments.length;
        while (i--) {
            // decode forward slashes to prevent them from being double encoded
            segments[i] = encodeUriSegment(segments[i].replace(/%2F/g, '/'));
        }
        path = segments.join('/');
        return _stripIndexHtml((path && path[0] !== '/' && '/' || '') + path);
    };
    // https://github.com/angular/angular.js/blob/864c7f0/src/ng/location.js#L42
    AngularJSUrlCodec.prototype.encodeSearch = function (search) {
        if (typeof search === 'string') {
            search = parseKeyValue(search);
        }
        search = toKeyValue(search);
        return search ? '?' + search : '';
    };
    // https://github.com/angular/angular.js/blob/864c7f0/src/ng/location.js#L44
    AngularJSUrlCodec.prototype.encodeHash = function (hash) {
        hash = encodeUriSegment(hash);
        return hash ? '#' + hash : '';
    };
    // https://github.com/angular/angular.js/blob/864c7f0/src/ng/location.js#L27
    AngularJSUrlCodec.prototype.decodePath = function (path, html5Mode) {
        if (html5Mode === void 0) { html5Mode = true; }
        var segments = path.split('/');
        var i = segments.length;
        while (i--) {
            segments[i] = decodeURIComponent(segments[i]);
            if (html5Mode) {
                // encode forward slashes to prevent them from being mistaken for path separators
                segments[i] = segments[i].replace(/\//g, '%2F');
            }
        }
        return segments.join('/');
    };
    // https://github.com/angular/angular.js/blob/864c7f0/src/ng/location.js#L72
    AngularJSUrlCodec.prototype.decodeSearch = function (search) { return parseKeyValue(search); };
    // https://github.com/angular/angular.js/blob/864c7f0/src/ng/location.js#L73
    AngularJSUrlCodec.prototype.decodeHash = function (hash) {
        hash = decodeURIComponent(hash);
        return hash[0] === '#' ? hash.substring(1) : hash;
    };
    AngularJSUrlCodec.prototype.normalize = function (pathOrHref, search, hash, baseUrl) {
        if (arguments.length === 1) {
            var parsed = this.parse(pathOrHref, baseUrl);
            if (typeof parsed === 'string') {
                return parsed;
            }
            var serverUrl = parsed.protocol + "://" + parsed.hostname + (parsed.port ? ':' + parsed.port : '');
            return this.normalize(this.decodePath(parsed.pathname), this.decodeSearch(parsed.search), this.decodeHash(parsed.hash), serverUrl);
        }
        else {
            var encPath = this.encodePath(pathOrHref);
            var encSearch = search && this.encodeSearch(search) || '';
            var encHash = hash && this.encodeHash(hash) || '';
            var joinedPath = (baseUrl || '') + encPath;
            if (!joinedPath.length || joinedPath[0] !== '/') {
                joinedPath = '/' + joinedPath;
            }
            return joinedPath + encSearch + encHash;
        }
    };
    AngularJSUrlCodec.prototype.areEqual = function (valA, valB) { return this.normalize(valA) === this.normalize(valB); };
    // https://github.com/angular/angular.js/blob/864c7f0/src/ng/urlUtils.js#L60
    AngularJSUrlCodec.prototype.parse = function (url, base) {
        try {
            // Safari 12 throws an error when the URL constructor is called with an undefined base.
            var parsed = !base ? new URL(url) : new URL(url, base);
            return {
                href: parsed.href,
                protocol: parsed.protocol ? parsed.protocol.replace(/:$/, '') : '',
                host: parsed.host,
                search: parsed.search ? parsed.search.replace(/^\?/, '') : '',
                hash: parsed.hash ? parsed.hash.replace(/^#/, '') : '',
                hostname: parsed.hostname,
                port: parsed.port,
                pathname: (parsed.pathname.charAt(0) === '/') ? parsed.pathname : '/' + parsed.pathname
            };
        }
        catch (e) {
            throw new Error("Invalid URL (" + url + ") with base (" + base + ")");
        }
    };
    return AngularJSUrlCodec;
}());
function _stripIndexHtml(url) {
    return url.replace(/\/index.html$/, '');
}
/**
 * Tries to decode the URI component without throwing an exception.
 *
 * @private
 * @param str value potential URI component to check.
 * @returns {boolean} True if `value` can be decoded
 * with the decodeURIComponent function.
 */
function tryDecodeURIComponent(value) {
    try {
        return decodeURIComponent(value);
    }
    catch (e) {
        // Ignore any invalid uri component.
        return undefined;
    }
}
/**
 * Parses an escaped url query string into key-value pairs. Logic taken from
 * https://github.com/angular/angular.js/blob/864c7f0/src/Angular.js#L1382
 * @returns {Object.<string,boolean|Array>}
 */
function parseKeyValue(keyValue) {
    var obj = {};
    (keyValue || '').split('&').forEach(function (keyValue) {
        var splitPoint, key, val;
        if (keyValue) {
            key = keyValue = keyValue.replace(/\+/g, '%20');
            splitPoint = keyValue.indexOf('=');
            if (splitPoint !== -1) {
                key = keyValue.substring(0, splitPoint);
                val = keyValue.substring(splitPoint + 1);
            }
            key = tryDecodeURIComponent(key);
            if (typeof key !== 'undefined') {
                val = typeof val !== 'undefined' ? tryDecodeURIComponent(val) : true;
                if (!obj.hasOwnProperty(key)) {
                    obj[key] = val;
                }
                else if (Array.isArray(obj[key])) {
                    obj[key].push(val);
                }
                else {
                    obj[key] = [obj[key], val];
                }
            }
        }
    });
    return obj;
}
/**
 * Serializes into key-value pairs. Logic taken from
 * https://github.com/angular/angular.js/blob/864c7f0/src/Angular.js#L1409
 */
function toKeyValue(obj) {
    var parts = [];
    var _loop_1 = function (key) {
        var value = obj[key];
        if (Array.isArray(value)) {
            value.forEach(function (arrayValue) {
                parts.push(encodeUriQuery(key, true) +
                    (arrayValue === true ? '' : '=' + encodeUriQuery(arrayValue, true)));
            });
        }
        else {
            parts.push(encodeUriQuery(key, true) +
                (value === true ? '' : '=' + encodeUriQuery(value, true)));
        }
    };
    for (var key in obj) {
        _loop_1(key);
    }
    return parts.length ? parts.join('&') : '';
}
/**
 * We need our custom method because encodeURIComponent is too aggressive and doesn't follow
 * http://www.ietf.org/rfc/rfc3986.txt with regards to the character set (pchar) allowed in path
 * segments:
 *    segment       = *pchar
 *    pchar         = unreserved / pct-encoded / sub-delims / ":" / "@"
 *    pct-encoded   = "%" HEXDIG HEXDIG
 *    unreserved    = ALPHA / DIGIT / "-" / "." / "_" / "~"
 *    sub-delims    = "!" / "$" / "&" / "'" / "(" / ")"
 *                     / "*" / "+" / "," / ";" / "="
 *
 * Logic from https://github.com/angular/angular.js/blob/864c7f0/src/Angular.js#L1437
 */
function encodeUriSegment(val) {
    return encodeUriQuery(val, true)
        .replace(/%26/gi, '&')
        .replace(/%3D/gi, '=')
        .replace(/%2B/gi, '+');
}
/**
 * This method is intended for encoding *key* or *value* parts of query component. We need a custom
 * method because encodeURIComponent is too aggressive and encodes stuff that doesn't have to be
 * encoded per http://tools.ietf.org/html/rfc3986:
 *    query         = *( pchar / "/" / "?" )
 *    pchar         = unreserved / pct-encoded / sub-delims / ":" / "@"
 *    unreserved    = ALPHA / DIGIT / "-" / "." / "_" / "~"
 *    pct-encoded   = "%" HEXDIG HEXDIG
 *    sub-delims    = "!" / "$" / "&" / "'" / "(" / ")"
 *                     / "*" / "+" / "," / ";" / "="
 *
 * Logic from https://github.com/angular/angular.js/blob/864c7f0/src/Angular.js#L1456
 */
function encodeUriQuery(val, pctEncodeSpaces) {
    if (pctEncodeSpaces === void 0) { pctEncodeSpaces = false; }
    return encodeURIComponent(val)
        .replace(/%40/gi, '@')
        .replace(/%3A/gi, ':')
        .replace(/%24/g, '$')
        .replace(/%2C/gi, ',')
        .replace(/%3B/gi, ';')
        .replace(/%20/g, (pctEncodeSpaces ? '%20' : '+'));
}

/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/**
 * A provider token used to configure the location upgrade module.
 *
 * @publicApi
 */
var LOCATION_UPGRADE_CONFIGURATION = new InjectionToken('LOCATION_UPGRADE_CONFIGURATION');
var APP_BASE_HREF_RESOLVED = new InjectionToken('APP_BASE_HREF_RESOLVED');
/**
 * `NgModule` used for providing and configuring Angular's Unified Location Service for upgrading.
 *
 * @see [Using the Unified Angular Location Service](guide/upgrade#using-the-unified-angular-location-service)
 *
 * @publicApi
 */
var LocationUpgradeModule = /** @class */ (function () {
    function LocationUpgradeModule() {
    }
    LocationUpgradeModule_1 = LocationUpgradeModule;
    LocationUpgradeModule.config = function (config) {
        return {
            ngModule: LocationUpgradeModule_1,
            providers: [
                Location,
                {
                    provide: $locationShim,
                    useFactory: provide$location,
                    deps: [UpgradeModule, Location, PlatformLocation, UrlCodec, LocationStrategy]
                },
                { provide: LOCATION_UPGRADE_CONFIGURATION, useValue: config ? config : {} },
                { provide: UrlCodec, useFactory: provideUrlCodec, deps: [LOCATION_UPGRADE_CONFIGURATION] },
                {
                    provide: APP_BASE_HREF_RESOLVED,
                    useFactory: provideAppBaseHref,
                    deps: [LOCATION_UPGRADE_CONFIGURATION, [new Inject(APP_BASE_HREF), new Optional()]]
                },
                {
                    provide: LocationStrategy,
                    useFactory: provideLocationStrategy,
                    deps: [
                        PlatformLocation,
                        APP_BASE_HREF_RESOLVED,
                        LOCATION_UPGRADE_CONFIGURATION,
                    ]
                },
            ],
        };
    };
    var LocationUpgradeModule_1;
    LocationUpgradeModule = LocationUpgradeModule_1 = __decorate([
        NgModule({ imports: [CommonModule] })
    ], LocationUpgradeModule);
    return LocationUpgradeModule;
}());
function provideAppBaseHref(config, appBaseHref) {
    if (config && config.appBaseHref != null) {
        return config.appBaseHref;
    }
    else if (appBaseHref != null) {
        return appBaseHref;
    }
    return '';
}
function provideUrlCodec(config) {
    var codec = config && config.urlCodec || AngularJSUrlCodec;
    return new codec();
}
function provideLocationStrategy(platformLocation, baseHref, options) {
    if (options === void 0) { options = {}; }
    return options.useHash ? new HashLocationStrategy(platformLocation, baseHref) :
        new PathLocationStrategy(platformLocation, baseHref);
}
function provide$location(ngUpgrade, location, platformLocation, urlCodec, locationStrategy) {
    var $locationProvider = new $locationShimProvider(ngUpgrade, location, platformLocation, urlCodec, locationStrategy);
    return $locationProvider.$get();
}

/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
// This file only reexports content of the `src` folder. Keep it that way.

/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

/**
 * Generated bundle index. Do not edit.
 */

export { provide$location as ɵangular_packages_common_upgrade_upgrade_d, provideAppBaseHref as ɵangular_packages_common_upgrade_upgrade_a, provideLocationStrategy as ɵangular_packages_common_upgrade_upgrade_c, provideUrlCodec as ɵangular_packages_common_upgrade_upgrade_b, $locationShim, $locationShimProvider, LOCATION_UPGRADE_CONFIGURATION, LocationUpgradeModule, AngularJSUrlCodec, UrlCodec };
//# sourceMappingURL=upgrade.js.map
