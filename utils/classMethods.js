const {toString: toStr} = {},
    hasOwn = ({}.hasOwnProperty),
    getProto = Object.getPrototypeOf,
    fnToString = hasOwn.toString;

/**
 *
 * @param {Any} v
 * @param {boolean} catchCheck
 * @returns {boolean}
 */
function isThenable (v, catchCheck) {
    return isObject(v) &&
        typeof v.then === 'function' &&
            (!catchCheck || typeof v.catch === 'function');
}

/**
 *
 * @param {Any} val
 * @returns {string}
 */
function toStringTag (val) {
    return toStr.call(val).slice(8, -1);
}

/**
 * This function is dependent on both constructors
 *   being identical so any minimization is expected of both.
 * @param {Any} a
 * @param {function} b
 * @returns {boolean}
 */
function hasConstructorOf (a, b) {
    if (!a || typeof a !== 'object') {
        return false;
    }
    const proto = getProto(a);
    if (!proto) {
        return false;
    }
    const Ctor = hasOwn.call(proto, 'constructor') && proto.constructor;
    if (typeof Ctor !== 'function') {
        return b === null;
    }
    return typeof Ctor === 'function' && b !== null &&
        fnToString.call(Ctor) === fnToString.call(b);
}

/**
 *
 * @param {Any} val
 * @returns {boolean}
 */
function isPlainObject (val) { // Mirrors jQuery's
    if (!val || toStringTag(val) !== 'Object') {
        return false;
    }

    const proto = getProto(val);
    if (!proto) { // `Object.create(null)`
        return true;
    }

    return hasConstructorOf(val, Object);
}

/**
 *
 * @param {Any} val
 * @returns {boolean}
 */
function isUserObject (val) {
    if (!val || toStringTag(val) !== 'Object') {
        return false;
    }

    const proto = getProto(val);
    if (!proto) { // `Object.create(null)`
        return true;
    }
    return hasConstructorOf(val, Object) || isUserObject(proto);
}

/**
 *
 * @param {Any} v
 * @returns {boolean}
 */
function isObject (v) {
    return v && typeof v === 'object';
}

/**
 *
 * @param {string} keyPathComponent
 * @returns {string}
 */
function escapeKeyPathComponent (keyPathComponent) {
    return keyPathComponent.replace(/~/gu, '~0').replace(/\./gu, '~1');
}

/**
 *
 * @param {string} keyPathComponent
 * @returns {string}
 */
function unescapeKeyPathComponent (keyPathComponent) {
    return keyPathComponent.replace(/~1/gu, '.').replace(/~0/gu, '~');
}

/**
 * @param {PlainObject|GenericArray} obj
 * @param {string} keyPath
 * @returns {Any}
 */
function getByKeyPath (obj, keyPath) {
    if (keyPath === '') {
        return obj;
    }
    const period = keyPath.indexOf('.');
    if (period > -1) {
        // eslint-disable-next-line standard/computed-property-even-spacing
        const innerObj = obj[
            unescapeKeyPathComponent(keyPath.substr(0, period))
        ];
        return innerObj === undefined
            ? undefined
            : getByKeyPath(innerObj, keyPath.substr(period + 1));
    }
    return obj[unescapeKeyPathComponent(keyPath)];
}

/**
 *
 * @param {PlainObject} obj
 * @param {string} keyPath
 * @param {Any} value
 * @returns {Any}
 */
function setAtKeyPath (obj, keyPath, value) {
    if (keyPath === '') {
        return value;
    }
    const period = keyPath.indexOf('.');
    if (period > -1) {
        // eslint-disable-next-line standard/computed-property-even-spacing
        const innerObj = obj[
            unescapeKeyPathComponent(keyPath.substr(0, period))
        ];
        return setAtKeyPath(innerObj, keyPath.substr(period + 1), value);
    }
    obj[unescapeKeyPathComponent(keyPath)] = value;
    return obj;
}

/**
 *
 * @param {external:JSON} value
 * @returns {"null"|"array"|"undefined"|"boolean"|"number"|"string"|
 *  "object"|"symbol"}
 */
function getJSONType (value) {
    return value === null
        ? 'null'
        : (
            Array.isArray(value)
                ? 'array'
                : typeof value);
}

export {
    isPlainObject, isObject, isUserObject,
    hasConstructorOf, isThenable, toStringTag,
    escapeKeyPathComponent, unescapeKeyPathComponent,
    getByKeyPath, setAtKeyPath,
    getJSONType
};
