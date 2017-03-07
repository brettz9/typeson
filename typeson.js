var JSON = require('../../test/json2-module');

var keys = Object.keys,
    isArray = Array.isArray,
    toString = ({}.toString),
    getProto = Object.getPrototypeOf,
    hasOwn = ({}.hasOwnProperty),
    fnToString = hasOwn.toString;

function _pushArr (arr, arr2) { // We avoid checking the prototype as occurs with Array push since the structured cloning algorithm does not check (and W3C tests check for this)
    arr[arr.length] = arr2;
}

function isThenable (v, catchCheck) {
    return Typeson.isObject(v) && typeof v.then === 'function' && (!catchCheck || typeof v.catch === 'function');
}

function toStringTag (val) {
    return toString.call(val).slice(8, -1);
}

function hasConstructorOf (a, b) {
    if (!a) {
        return false;
    }
    var proto = getProto(a);
    if (!proto) {
        return false;
    }
    var Ctor = hasOwn.call(proto, 'constructor') && proto.constructor;
    if (typeof Ctor !== 'function') {
        return b === null;
    }
    return typeof Ctor === 'function' && b !== null && fnToString.call(Ctor) === fnToString.call(b);
}

function isPlainObject (val) { // Mirrors jQuery's
    if (!val || toStringTag(val) !== 'Object') {
        return false;
    }

    var proto = getProto(val);
    if (!proto) { // `Object.create(null)`
        return true;
    }

    return hasConstructorOf(val, Object);
}

function isUserObject (val) {
    if (!val || toStringTag(val) !== 'Object') {
        return false;
    }

    var proto = getProto(val);
    if (!proto) { // `Object.create(null)`
        return true;
    }
    return hasConstructorOf(val, Object) || isUserObject(proto);
}

function isObject (v) {
    return v && typeof v === 'object'
}

/* Typeson - JSON with types
    * License: The MIT License (MIT)
    * Copyright (c) 2016 David Fahlander
    */

/** An instance of this class can be used to call stringify() and parse().
 * Typeson resolves cyclic references by default. Can also be extended to
 * support custom types using the register() method.
 *
 * @constructor
 * @param {{cyclic: boolean}} [options] - if cyclic (default true), cyclic references will be handled gracefully.
 */
function Typeson (options) {
    // Replacers signature: replace (value). Returns falsy if not replacing. Otherwise ['Date', value.getTime()]
    var plainObjectReplacers = [];
    var nonplainObjectReplacers = [];
    // Revivers: map {type => reviver}. Sample: {'Date': value => new Date(value)}
    var revivers = {};

    /** Types registered via register() */
    var regTypes = this.types = {};

    /** Serialize given object to Typeson.
     *
     * Arguments works identical to those of JSON.stringify().
     */
    var stringify = this.stringify = function (obj, replacer, space, opts) { // replacer here has nothing to do with our replacers.
        opts = Object.assign({}, options, opts, {stringification: true});
        var encapsulated = encapsulate(obj, null, opts);
        if (isArray(encapsulated)) {
            var ret = JSON.stringify(encapsulated[0], replacer, space);
            return ret;
        }
        return encapsulated.then(function (res) {
            return JSON.stringify(res, replacer, space);
        });
    };

    // Also sync but throws on non-sync result
    this.stringifySync = function (obj, replacer, space, opts) {
        return stringify(obj, replacer, space, Object.assign({}, {throwOnBadSyncType: true}, opts, {sync: true}));
    };
    this.stringifyAsync = function (obj, replacer, space, opts) {
        return stringify(obj, replacer, space, Object.assign({}, {throwOnBadSyncType: true}, opts, {sync: false}));
    };

    /** Parse Typeson back into an obejct.
     *
     * Arguments works identical to those of JSON.parse().
     */
    var parse = this.parse = function (text, reviver, opts) {
        opts = Object.assign({}, options, opts, {parse: true});
        return revive(JSON.parse(text, reviver), opts); // This reviver has nothing to do with our revivers.
    };

    // Also sync but throws on non-sync result
    this.parseSync = function (text, reviver, opts) {
        return parse(text, reviver, Object.assign({}, {throwOnBadSyncType: true}, opts, {sync: true})); // This reviver has nothing to do with our revivers.
    };
    this.parseAsync = function (text, reviver, opts) {
        return parse(text, reviver, Object.assign({}, {throwOnBadSyncType: true}, opts, {sync: false})); // This reviver has nothing to do with our revivers.
    };

    /** Encapsulate a complex object into a plain Object by replacing registered types with
     * plain objects representing the types data.
     *
     * This method is used internally by Typeson.stringify().
     * @param {Object} obj - Object to encapsulate.
     */
    var encapsulate = this.encapsulate = function (obj, stateObj, opts) {
        opts = Object.assign({sync: true}, options, opts);
        var sync = opts.sync;
        var types = {},
            refObjs = [], // For checking cyclic references
            refKeys = [], // For checking cyclic references
            promisesDataRoot = [];
        // Clone the object deeply while at the same time replacing any special types or cyclic reference:
        var cyclic = opts && ('cyclic' in opts) ? opts.cyclic : true;
        var ret = _encapsulate('', obj, cyclic, stateObj || {}, promisesDataRoot);
        function finish (ret) {
            // Add $types to result only if we ever bumped into a special type
            if (keys(types).length) {
                // Special if array (or primitive) was serialized because JSON would ignore custom $types prop on it.
                if (!ret || !isPlainObject(ret) || ret.$types) ret = {$:ret, $types: {$: types}};
                else ret.$types = types;
            }
            return ret;
        }
        function checkPromises (ret, promisesData) {
            return Promise.all(
                promisesData.map(function (pd) {return pd[1].p;})
            ).then(function (promResults) {
                return Promise.all(
                    promResults.map(function (promResult) {
                        var newPromisesData = [];
                        var prData = promisesData.splice(0, 1)[0];
                        // var [keypath, , cyclic, stateObj, parentObj, key] = prData;
                        var keyPath = prData[0];
                        var cyclic = prData[2];
                        var stateObj = prData[3];
                        var parentObj = prData[4];
                        var key = prData[5];
                        var encaps = _encapsulate(keyPath, promResult, cyclic, stateObj, newPromisesData);
                        var isTypesonPromise = hasConstructorOf(encaps, TypesonPromise);
                        if (keyPath && isTypesonPromise) { // Handle case where an embedded custom type itself returns a `Typeson.Promise`
                            return encaps.p.then(function (encaps2) {
                                parentObj[key] = encaps2;
                                return checkPromises(ret, newPromisesData);
                            });
                        }
                        if (keyPath) parentObj[key] = encaps;
                        else if (isTypesonPromise) { ret = encaps.p; }
                        else ret = encaps; // If this is itself a `Typeson.Promise` (because the original value supplied was a promise or because the supplied custom type value resolved to one), returning it below will be fine since a promise is expected anyways given current config (and if not a promise, it will be ready as the resolve value)
                        return checkPromises(ret, newPromisesData);
                    })
                );
            }).then(function () {
                return ret;
            });
        };
        return promisesDataRoot.length
            ? sync && opts.throwOnBadSyncType
                ? (function () {
                    throw new TypeError("Sync method requested but async result obtained");
                }())
                : Promise.resolve(checkPromises(ret, promisesDataRoot)).then(finish)
            : !sync && opts.throwOnBadSyncType
                ? (function () {
                    throw new TypeError("Async method requested but sync result obtained");
                }())
                : (opts.stringification && sync // If this is a synchronous request for stringification, yet a promise is the result, we don't want to resolve leading to an async result, so we return an array to avoid ambiguity
                    ? [finish(ret)]
                    : (sync
                        ? finish(ret)
                        : Promise.resolve(finish(ret))
                    ));

        function _encapsulate (keypath, value, cyclic, stateObj, promisesData) {
            var $typeof = typeof value;
            if ($typeof in {string: 1, boolean: 1, number: 1, undefined: 1 })
                return value === undefined || ($typeof === 'number' &&
                    (isNaN(value) || value === -Infinity || value === Infinity)) ?
                        replace(keypath, value, stateObj, promisesData) :
                        value;
            if (value === null) return value;
            if (cyclic && !stateObj.replaced) {
                // Options set to detect cyclic references and be able to rewrite them.
                var refIndex = refObjs.indexOf(value);
                if (refIndex < 0) {
                    if (cyclic === true) {
                        refObjs[refObjs.length] = value;
                        refKeys[refKeys.length] = keypath;
                    }
                } else {
                    types[keypath] = '#';
                    return '#' + refKeys[refIndex];
                }
            }
            var isPlainObj = isPlainObject(value);
            var isArr = isArray(value);
            var replaced = (
                ((isPlainObj || isArr) && (!plainObjectReplacers.length || stateObj.replaced)) ||
                stateObj.iterateIn // Running replace will cause infinite loop as will test positive again
            )
                // Optimization: if plain object and no plain-object replacers, don't try finding a replacer
                ? value
                : replace(keypath, value, stateObj, promisesData, isPlainObj || isArr);
            if (replaced !== value) return replaced;
            var clone;
            if (isArr || stateObj.iterateIn === 'array')
                clone = new Array(value.length);
            else if (isPlainObj || stateObj.iterateIn === 'object')
                clone = {};
            else if (keypath === '' && hasConstructorOf(value, TypesonPromise)) {
                _pushArr(promisesData, [keypath, value, cyclic, stateObj]);
                return value;
            }
            else return value; // Only clone vanilla objects and arrays

            // Iterate object or array
            if (stateObj.iterateIn) {
                for (var key in value) {
                    var ownKeysObj = {ownKeys: value.hasOwnProperty(key)};
                    var kp = keypath + (keypath ? '.' : '') + key;
                    var val = _encapsulate(kp, value[key], cyclic, ownKeysObj, promisesData);
                    if (hasConstructorOf(val, TypesonPromise)) {
                        _pushArr(promisesData, [kp, val, cyclic, ownKeysObj, clone, key]);
                    } else if (val !== undefined) clone[key] = val;
                }
            } else { // Note: Non-indexes on arrays won't survive stringify so somewhat wasteful for arrays, but so too is iterating all numeric indexes on sparse arrays when not wanted or filtering own keys for positive integers
                keys(value).forEach(function (key) {
                    var kp = keypath + (keypath ? '.' : '') + key;
                    var val = _encapsulate(kp, value[key], cyclic, {ownKeys: true}, promisesData);
                    if (hasConstructorOf(val, TypesonPromise)) {
                        _pushArr(promisesData, [kp, val, cyclic, {ownKeys: true}, clone, key]);
                    } else if (val !== undefined) clone[key] = val;
                });
            }
            // Iterate array for non-own numeric properties (we can't replace the prior loop though as it iterates non-integer keys)
            if (stateObj.iterateUnsetNumeric) {
                for (var i = 0, vl = value.length; i < vl; i++) {
                    if (!(i in value)) {
                        var kp = keypath + (keypath ? '.' : '') + i;
                        var val = _encapsulate(kp, undefined, cyclic, {ownKeys: false}, promisesData);
                        if (hasConstructorOf(val, TypesonPromise)) {
                            _pushArr(promisesData, [kp, val, cyclic, {ownKeys: false}, clone, i]);
                        } else if (val !== undefined) clone[i] = val;
                    }
                }
            }
            return clone;
        }

        function replace (key, value, stateObj, promisesData, plainObject) {
            // Encapsulate registered types
            var replacers = plainObject ? plainObjectReplacers : nonplainObjectReplacers;
            var i = replacers.length;
            while (i--) {
                if (replacers[i].test(value, stateObj)) {
                    var type = replacers[i].type;
                    if (revivers[type]) {
                        // Record the type only if a corresponding reviver exists.
                        // This is to support specs where only replacement is done.
                        // For example ensuring deep cloning of the object, or
                        // replacing a type to its equivalent without the need to revive it.
                        var existing = types[key];
                        // type can comprise an array of types (see test shouldSupportIntermediateTypes)
                        types[key] = existing ? [type].concat(existing) : type;
                    }
                    // Now, also traverse the result in case it contains it own types to replace
                    stateObj = Object.assign(stateObj, {replaced: true});
                    if ((sync || !replacers[i].replaceAsync) && !replacers[i].replace) {
                        return _encapsulate(key, value, cyclic && 'readonly', stateObj, promisesData);
                    }

                    var replaceMethod = sync || !replacers[i].replaceAsync ? 'replace' : 'replaceAsync';
                    return _encapsulate(key, replacers[i][replaceMethod](value, stateObj), cyclic && 'readonly', stateObj, promisesData);
                }
            }
            return value;
        }
    };

    // Also sync but throws on non-sync result
    this.encapsulateSync = function (obj, stateObj, opts) {
        return encapsulate(obj, stateObj, Object.assign({}, {throwOnBadSyncType: true}, opts, {sync: true}));
    };
    this.encapsulateAsync = function (obj, stateObj, opts) {
        return encapsulate(obj, stateObj, Object.assign({}, {throwOnBadSyncType: true}, opts, {sync: false}));
    };

    /** Revive an encapsulated object.
     * This method is used internally by JSON.parse().
     * @param {Object} obj - Object to revive. If it has $types member, the properties that are listed there
     * will be replaced with its true type instead of just plain objects.
     */
    var revive = this.revive = function (obj, opts) {
        opts = Object.assign({sync: true}, options, opts);
        var sync = opts.sync;
        var types = obj && obj.$types,
            ignore$Types = true;
        if (!types) return obj; // No type info added. Revival not needed.
        if (types.$ && isPlainObject(types.$)) {
            // Special when root object is not a trivial Object, it will be encapsulated in $.
            obj = obj.$;
            types = types.$;
            ignore$Types = false;
        }
        var ret = _revive('', obj, null, opts);
        ret = hasConstructorOf(ret, Undefined) ? undefined : ret;
        return isThenable(ret)
            ? sync && opts.throwOnBadSyncType
                ? (function () {
                    throw new TypeError("Sync method requested but async result obtained");
                }())
                : ret
            : !sync && opts.throwOnBadSyncType
                ? (function () {
                    throw new TypeError("Async method requested but sync result obtained");
                }())
                : sync
                    ? ret
                    : Promise.resolve(ret);

        function _revive (keypath, value, target, opts) {
            if (ignore$Types && keypath === '$types') return;
            var type = types[keypath];
            if (value && (isPlainObject(value) || isArray(value))) {
                var clone = isArray(value) ? new Array(value.length) : {};
                // Iterate object or array
                keys(value).forEach(function (key) {
                    var val = _revive(keypath + (keypath ? '.' : '') + key, value[key], target || clone, opts);
                    if (hasConstructorOf(val, Undefined)) clone[key] = undefined;
                    else if (val !== undefined) clone[key] = val;
                });
                value = clone;
            }
            if (!type) return value;
            if (type === '#') return getByKeyPath(target, value.substr(1));
            var sync = opts.sync;
            return [].concat(type).reduce(function (val, type) {
                var reviver = revivers[type];
                if (!reviver) throw new Error ('Unregistered type: ' + type);
                return reviver[
                    sync && reviver.revive
                        ? 'revive'
                        : !sync && reviver.reviveAsync
                            ? 'reviveAsync'
                            : 'revive'
                ](val);
            }, value);
        }
    };

    // Also sync but throws on non-sync result
    this.reviveSync = function (obj, opts) {
        return revive(obj, Object.assign({}, {throwOnBadSyncType: true}, opts, {sync: true}));
    };
    this.reviveAsync = function (obj, opts) {
        return revive(obj, Object.assign({}, {throwOnBadSyncType: true}, opts, {sync: false}));
    };

    /** Register types.
     * For examples how to use this method, see https://github.com/dfahlander/typeson-registry/tree/master/types
     * @param {Array.<Object.<string,Function[]>>} typeSpec - Types and their functions [test, encapsulate, revive];
     */
    this.register = function (typeSpecSets, opts) {
        opts = opts || {};
        [].concat(typeSpecSets).forEach(function R (typeSpec) {
            if (isArray(typeSpec)) return typeSpec.map(R); // Allow arrays of arrays of arrays...
            typeSpec && keys(typeSpec).forEach(function (typeId) {
                var spec = typeSpec[typeId];
                var replacers = spec.testPlainObjects ? plainObjectReplacers : nonplainObjectReplacers;
                var existingReplacer = replacers.filter(function(r){ return r.type === typeId; });
                if (existingReplacer.length) {
                    // Remove existing spec and replace with this one.
                    replacers.splice(replacers.indexOf(existingReplacer[0]), 1);
                    delete revivers[typeId];
                    delete regTypes[typeId];
                }
                if (spec) {
                    if (typeof spec === 'function') {
                        // Support registering just a class without replacer/reviver
                        var Class = spec;
                        spec = {
                            test: function (x) { return x.constructor === Class; },
                            replace: function (x) { return assign({}, x); },
                            revive: function (x) { return assign(Object.create(Class.prototype), x); }
                        };
                    } else if (isArray(spec)) {
                        spec = {
                            test: spec[0],
                            replace: spec[1],
                            revive: spec[2]
                        };
                    }
                    var replacerObj = {
                        type: typeId,
                        test: spec.test.bind(spec)
                    };
                    if (spec.replace) {
                        replacerObj.replace = spec.replace.bind(spec);
                    }
                    if (spec.replaceAsync) {
                        replacerObj.replaceAsync = spec.replaceAsync.bind(spec);
                    }
                    var start = typeof opts.fallback === 'number' ? opts.fallback : (opts.fallback ? 0 : Infinity);
                    if (spec.testPlainObjects) {
                        plainObjectReplacers.splice(start, 0, replacerObj);
                    } else {
                        nonplainObjectReplacers.splice(start, 0, replacerObj);
                    }
                    // Todo: We might consider a testAsync type
                    if (spec.revive || spec.reviveAsync) {
                        var reviverObj = {};
                        if (spec.revive) reviverObj.revive = spec.revive.bind(spec);
                        if (spec.reviveAsync) reviverObj.reviveAsync = spec.reviveAsync.bind(spec);
                        revivers[typeId] = reviverObj;
                    }

                    regTypes[typeId] = spec; // Record to be retrieved via public types property.
                }
            });
        });
        return this;
    };
}

function assign(t,s) {
    keys(s).map(function (k) { t[k] = s[k]; });
    return t;
}

/** getByKeyPath() utility */
function getByKeyPath (obj, keyPath) {
    if (keyPath === '') return obj;
    var period = keyPath.indexOf('.');
    if (period !== -1) {
        var innerObj = obj[keyPath.substr(0, period)];
        return innerObj === undefined ? undefined : getByKeyPath(innerObj, keyPath.substr(period + 1));
    }
    return obj[keyPath];
}

function Undefined () {}

// With ES6 classes, we may be able to simply use `class TypesonPromise extends Promise` and add a string tag for detection
function TypesonPromise (f) {
    this.p = new Promise(f);
};
TypesonPromise.prototype.then = function (onFulfilled, onRejected) {
    var that = this;
    return new TypesonPromise(function (typesonResolve, typesonReject) {
        that.p.then(function (res) {
            typesonResolve(onFulfilled ? onFulfilled(res) : res);
        }, function (r) {
            that.p['catch'](function (res) {
                return onRejected ? onRejected(res) : Promise.reject(res);
            }).then(typesonResolve, typesonReject);
        });
    });
};
TypesonPromise.prototype['catch'] = function (onRejected) {
    return this.then(null, onRejected);
};
TypesonPromise.resolve = function (v) {
    return new TypesonPromise(function (typesonResolve) {
        typesonResolve(v);
    });
};
TypesonPromise.reject = function (v) {
    return new TypesonPromise(function (typesonResolve, typesonReject) {
        typesonReject(v);
    });
};
['all', 'race'].map(function (meth) {
    TypesonPromise[meth] = function (promArr) {
        return new TypesonPromise(function (typesonResolve, typesonReject) {
            Promise[meth](promArr.map(function (prom) {return prom.p;})).then(typesonResolve, typesonReject);
        });
    };
});

// The following provide classes meant to avoid clashes with other values
Typeson.Undefined = Undefined; // To insist `undefined` should be added
Typeson.Promise = TypesonPromise; // To support async encapsulation/stringification

// Some fundamental type-checking utilities
Typeson.isThenable = isThenable;
Typeson.toStringTag = toStringTag;
Typeson.hasConstructorOf = hasConstructorOf;
Typeson.isObject = isObject;
Typeson.isPlainObject = isPlainObject;
Typeson.isUserObject = isUserObject;

module.exports = Typeson;
