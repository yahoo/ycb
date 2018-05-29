/*
 * Copyright (c) 2011-2013, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

'use strict';

var VERSION = '1.0.2',
    DEFAULT = '*',
    SEPARATOR = '/',
    SUBMATCH = /\$\$([\w.-_]+?)\$\$/,
    SUBMATCHES = /\$\$([\w.-_]+?)\$\$/g,
    DEFAULT_LOOKUP = [DEFAULT];
var cloneDeep = require('./lib/cloneDeep');
var mergeDeep = require('./lib/mergeDeep');
var isA = require('./lib/isA');
var isIterable = require('./lib/isIterable');

//---------------------------------------------------------------
// UTILITY FUNCTIONS

function arrayReverseUnique(arr){
    var u = {}, r = [];
    for(var i = arr.length - 1; i >= 0; --i){
        if(u.hasOwnProperty(arr[i])) {
            continue;
        }
        r.unshift(arr[i]);
        u[arr[i]] = true;
    }
    return r;
}

function extract(bag, key, def) {
    var keys,
        cur  = bag,
        i;
    if (!key) {
        return bag || {};
    }
    keys = key.split('.');
    for (i = 0; i < keys.length; i += 1) {
        if (cur && cur.hasOwnProperty(keys[i])) {
            cur = cur[keys[i]];
        } else {
            return def;
        }
    }
    return cur;
}

function replacer(base) {
    return function replaceCb(match, key) {
        return extract(base, key, match);
    };
}

function omit(obj, omitKey) {
    return Object.keys(obj).reduce((result, key) => {
        if(key !== omitKey) {
            result[key] = obj[key];
        }
        return result;
    }, {});
}

//---------------------------------------------------------------
// OBJECT ORIENTED INTERFACE

/**
 * @class Ycb
 * @contructor
 * @param bundle {array} array of bundle parts
 * @param options {object}
 */
function Ycb(bundle, options) {
    this.options = options || {};
    this.dimensionsList = [];
    this.dimensionsToIndex = {};
    this.valueToNumber = {};
    this.numberToValue = ['*'];
    this.precedenceMap = [[0]];
    this.tree = {};
    this.masterDelta = undefined;
    this.dimensions = [];
    this._processRawBundle(cloneDeep(bundle), this.options);
}
Ycb.prototype = {

    /**
     * Read the file.
     * @method read
     * @param context {object}
     * @param options {object}
     * @return {object}
     */
    read: function(contextObj, options) {
        options = options ? mergeDeep(this.options, options, true) : this.options;
        let context = this._parseContext(contextObj);
        let subKey = options.applySubstitutions !== false ? 'subbed': 'unsubbed';
        let collector;
        collector = this.masterDelta ? cloneDeep(this.masterDelta[subKey]) : {};
        this._readHelper(this.tree, 0, context, collector, subKey);
        if(collector['__ycb_source__']) {
            return omit(collector, '__ycb_source__');
        }
        return collector;
    },

    /**
     * Recurse through the tree merging configs that apply to the given context.
     * @param cur {object} the current node.
     * @param depth {int} current depth in tree.
     * @param context {array} the context in internal format.
     * @param collector {object} the config we merge onto.
     * @param subKey {string} determines if substituted or non-substituted configs are used.
     * @private
     */
    _readHelper: function(cur, depth, context, collector, subKey) {
        if(depth === context.length) {
            mergeDeep(cur[subKey], collector);
            return;
        }
        let value = context[depth];
        if(value.constructor !== Array) {
            this._expand(cur, depth, context, collector, value, subKey);
        } else {
            let i = value.length;
            while(i--) {
                this._expand(cur, depth, context, collector, value[i], subKey);
            }
        }
    },

    /**
     * Recurse to all children that apply to the given context.
     * @param cur
     * @param depth
     * @param context
     * @param collector
     * @param value
     * @param subKey
     * @private
     */
    _expand: function(cur, depth, context, collector, value, subKey) {
        let keys = this.precedenceMap[value];
        let n = keys.length;
        for(let i=0; i<n; i++) {
            if(cur[keys[i]] !== undefined) {
                this._readHelper(cur[keys[i]], depth+1, context, collector, subKey);
            }
        }
    },

    /**
     * Read the file.
     * @method read
     * @param context {object}
     * @param options {object}
     * @return {object}
     */
    readNoMerge: function(contextObj, options) {
        let context = this._parseContext(contextObj);
        let subKey = options.applySubstitutions !== false ? 'subbed': 'unsubbed';
        let collector;
        collector = this.masterDelta ? this.masterDelta : [];
        this._readNoMergeHelper(this.tree, 0, context, collector, subKey);
        return cloneDeep(collector);
    },

    /**
     * Recurse through the tree collecting configs that apply to the given context.
     * @param cur {object} the current node.
     * @param depth {int} current depth in tree.
     * @param context {array} the context in internal format.
     * @param collector {object} the array we push configs to.
     * @param subKey {string} determines if substituted or non-substituted configs are used.
     * @private
     */
    _readNoMergeHelper: function(cur, depth, context, collector, subKey) {
        if(depth === context.length) {
            collector.push(cur[subKey]);
            return;
        }
        let value = context[depth];
        if(value.constructor !== Array) {
            this._expandNoMerge(cur, depth, context, collector, value, subKey);
        } else {
            let i = value.length;
            while(i--) {
                this._expandNoMerge(cur, depth, context, collector, value, subKey);
            }
        }
    },

    /**
     * Recurse to all children that apply to the given context.
     * @param cur
     * @param depth
     * @param context
     * @param collector
     * @param value
     * @param subKey
     * @private
     */
    _expandNoMerge: function(cur, depth, context, collector, value, subKey) {
        let keys = this.precedenceMap[value];
        let n = keys.length;
        for(let i=0; i<n; i++) {
            if(cur[keys[i]] !== undefined) {
                this._readNoMergeHelper(cur[keys[i]], depth+1, context, collector, subKey);
            }
        }
    },

    /**
     * Converts a context object to equivalent array of numerical values.
     *
     * @param contextObj
     * @returns {any[]}
     * @private
     */
    _parseContext: function(contextObj) {
        if(contextObj === undefined) {
            contextObj = {};
        }
        let context = new Array(this.dimensionsList.length);
        for(let i=0; i<this.dimensionsList.length; i++) {
            let dimension = this.dimensionsList[i];
            if(contextObj.hasOwnProperty(dimension)) {
                let value = contextObj[dimension];
                if(value.constructor === Array) {
                    let newValue = [];
                    for(let j=0; j<value.length; j++) {
                        let numValue = this.valueToNumber[dimension][value[j]];
                        if(numValue !== undefined) {
                            newValue.push(numValue);
                        }
                    }
                    if(newValue.length) {
                        context[i] = newValue;
                        continue;
                    }
                } else {
                    let numValue = this.valueToNumber[dimension][value];
                    if(numValue !== undefined) {
                        context[i] = numValue;
                        continue;
                    }
                }
            }
            context[i] = 0;
        }
        return context;
    },

    /**
     * Convert internal num array context to context object.
     * @param context
     * @private
     */
    _contextToObject: function(context) {
        let contextObj = {};
        for(let i=0; i<context.length; i++) {
            if(context[i] !== '0') {
                contextObj[this.dimensionsList[i]] = this.numberToValue[context[i]];
            }
        }
        return contextObj;
    },

    /**
     * @private
     * @method _processRawBundle
     * @param bundle {object}
     * @param options {object}
     * @return {nothing}
     */
    _processRawBundle: function(config, options) {
        let dimCheckResult = this._checkDimensions(config);
        let dimensionsObject = dimCheckResult[0];
        let totalDimensions = dimCheckResult[1];

        let settingsCheckResult = this._checkSettings(config, totalDimensions, dimensionsObject.length);
        let usedDimensions = settingsCheckResult[0];
        let usedValues = settingsCheckResult[1];
        let contexts = settingsCheckResult[2];

        let activeDimensions = this._parseDimensions(dimensionsObject, usedDimensions, usedValues);

        for(let configIndex=0; configIndex<config.length; configIndex++) {
            let fullContext = contexts[configIndex];
            if(fullContext !== undefined) {
                let context = this._filterContext(fullContext, activeDimensions, usedValues, config[configIndex].settings);
                if(context !== undefined) {
                    this._buildTreeHelper(this.tree, 0, context, this._buildDelta(config[configIndex]));
                }
            }
        }
    },

    /**
     * Extract dimensions object and dimension -> number map
     * @param config
     * @returns {*[]}
     * @private
     */
    _checkDimensions: function(config) {
        for(let i=0; i<config.length; i++) {
            if(config[i].dimensions) {
                let dimensions = config[i].dimensions;
                this.dimensions = dimensions;
                let allDimensions = {};
                for(let j=0; j<dimensions.length; j++) {
                    let name
                    for(name in dimensions[j]) {
                        allDimensions[name] = j;
                        break;
                    }
                }
                return [dimensions, allDimensions];
            }
        }
        return [[], {}];
    },

    /**
     * Evaluate settings and determine which dimensions and values are used. Check for unknown dimensions.
     * Set the master config if it exist.
     * @param config
     * @param allDimensions
     * @param height
     * @returns {*[]}
     * @private
     */
    _checkSettings: function(config, allDimensions, height) {
        let usedDimensions = {};
        let usedValues = {};
        let contexts = {};
        configLoop:
            for(let i=0; i<config.length; i++) {
                if (config[i].settings) {
                    let setting = config[i].settings;
                    if(setting.length === 0 ) {
                        continue;
                    }
                    if(setting[0] === 'master') {
                        if(this.masterDelta !== undefined) {
                            this.masterDelta = mergeDeep(this._buildDelta(config[i]), this.masterDelta, true);
                        } else {
                            this.masterDelta = this._buildDelta(config[i]);
                        }
                        continue;
                    }
                    let context = new Array(height);
                    for(let q=0; q<height; q++) {
                        context[q] = '*';
                    }
                    for(let j=0; j<setting.length; j++) {
                        let kv = setting[j].split(':');
                        let dim = kv[0];
                        let index = allDimensions[dim];
                        if(index === undefined) {
                            console.log('WARNING: invalid dimension "' + dim +
                                '" in settings ' + JSON.stringify(setting));
                            continue configLoop;
                        }
                        usedDimensions[dim] = 1;
                        usedValues[dim] = usedValues[dim] || {};

                        if(kv[1].indexOf(',') === -1) {
                            usedValues[dim][kv[1]] = 1;
                            context[index] = kv[1];
                        } else {
                            let vals = kv[1].split(',');
                            context[index] = vals;
                            for(let k=0; k<vals.length; k++) {
                                usedValues[dim][vals[k]] = 1;
                            }
                        }
                    }
                    contexts[i] = context;
                }
            }
        return [usedDimensions, usedValues, contexts];
    },

    /**
     * Convert config to delta.
     * @param config
     * @returns {{subbed: object, unsubbed: object}}
     * @private
     */
    _buildDelta: function(config) {
        config = omit(config, 'settings');
        let subbed = cloneDeep(config);
        let subFlag = this._applySubstitutions(subbed);
        let unsubbed = subFlag ? config : subbed;
        return {subbed:subbed, unsubbed:unsubbed};
    },

    /**
     * Evaluate dimensions and omit unused dimensions.
     * @param dimensions
     * @param usedDimensions
     * @param usedValues
     * @returns {any[]}
     * @private
     */
    _parseDimensions: function(dimensions, usedDimensions, usedValues) {
        let activeDimensions = new Array(dimensions.length);
        var valueCounter = 1;
        for(let i=0; i<dimensions.length; i++) {
            let dimensionName;
            for(dimensionName in dimensions[i]){break}
            if(usedDimensions[dimensionName] === undefined) {
                activeDimensions[i] = 0;
                continue;
            }
            activeDimensions[i] = 1;
            this.dimensionsList.push(dimensionName);
            this.dimensionsToIndex[dimensionName] = i;
            let labelCollector = {};
            valueCounter = this._dimensionWalk(dimensions[i][dimensionName], usedValues[dimensionName],
                valueCounter, [0], this.precedenceMap, labelCollector, this.numberToValue);
            this.valueToNumber[dimensionName] = labelCollector;
        }
        return activeDimensions;
    },

    /**
     * Traverse a dimension hierarchy, label dimension values, and fill the precedence map and dim <-> num maps.
     * Mark used dimension values.
     * @param dimension
     * @param used
     * @param label
     * @param path
     * @param pathCollector
     * @param valueToNumCollector
     * @param numToValueCollector
     * @returns {*}
     * @private
     */
    _dimensionWalk: function(dimension, used, label, path, pathCollector, valueToNumCollector, numToValueCollector) {
        for(var key in dimension) {
            let currentPath;
            if(used[key]) {
                used[key] = 2;
                currentPath = path.concat(label);
            } else {
                currentPath = path;
            }
            if(currentPath.length > 1) {
                pathCollector.push(currentPath);
                numToValueCollector.push(key);
                valueToNumCollector[key] = label++;
            }
            if(dimension[key] !== null) {
                label = this._dimensionWalk(dimension[key], used, label, currentPath,
                    pathCollector, valueToNumCollector, numToValueCollector);
            }
        }
        return label;
    },

    /**
     * Convert config context and omit invalid dimension values.
     * @param fullContext
     * @param activeDimensions
     * @param usedValues
     * @param setting
     * @returns {any[]}
     * @private
     */
    _filterContext: function(fullContext, activeDimensions, usedValues, setting) {
        let height = this.dimensionsList.length;
        let newContext = new Array(height);
        for(let i=0; i<height; i++) {
            newContext[i] = 0;
        }
        let activeIndex = 0;
        for(let i=0; i<fullContext.length; i++) {
            if(activeDimensions[i]) {
                let dimensionName = this.dimensionsList[activeIndex];
                let contextValue = fullContext[i];
                if(contextValue.constructor === Array) {
                    let newValue = [];
                    for(let k=0; k<contextValue.length; k++) {
                        let valueChunk = contextValue[k];
                        if(usedValues[dimensionName][valueChunk] === 2) {
                            newValue.push(this.valueToNumber[dimensionName][valueChunk]);
                        } else {
                            console.log('WARNING: invalid value "' + valueChunk + '" for dimension "' +
                                this.dimensionsList[activeIndex] +
                                '" in settings ' + JSON.stringify(setting));
                        }
                    }
                    if(newValue.length === 0) {
                        return;
                    }
                    newContext[activeIndex] = newValue;
                } else {
                    if(usedValues[dimensionName][contextValue] === 2) {
                        newContext[activeIndex] = this.valueToNumber[dimensionName][contextValue];
                    } else if(contextValue !== '*') {
                        console.log('WARNING: invalid value "' + contextValue +
                            '" in settings ' + JSON.stringify(setting));
                        return;
                    }
                }
                activeIndex++;
            }
        }
        return newContext;
    },

    /**
     * Insert the given context and delta into the tree.
     * @param root
     * @param depth
     * @param context
     * @param delta
     * @private
     */
    _buildTreeHelper: function(root, depth, context, delta) {
        let currentValue = context[depth];
        let isMulti = currentValue.constructor === Array;
        if(depth === context.length-1) {
            if(isMulti) {
                for(let i=0; i<currentValue.length; i++) {
                    let curDelta = delta;
                    if(root[currentValue[i]] !== undefined) {
                        curDelta = mergeDeep(delta, root[currentValue[i]], true);
                    }
                    root[currentValue[i]] = curDelta;
                }
            } else {
                let curDelta = delta;
                if(root[currentValue] !== undefined) {
                    curDelta = mergeDeep(delta, root[currentValue], true);
                }
                root[currentValue] = curDelta;
            }
            return;
        }
        if(isMulti){
            for(let i=0; i<currentValue.length; i++) {
                if(root[currentValue[i]] === undefined) {
                    root[currentValue[i]] = {};
                }
                this._buildTreeHelper(root[currentValue[i]], depth+1, context, delta);
            }
        } else {
            if(root[currentValue] === undefined) {
                root[currentValue] = {};
            }
            this._buildTreeHelper(root[currentValue], depth+1, context, delta);
        }
    },

    /**
     * This is a first pass at hairball of a function.
     *
     * @private
     * @method _applySubstitutions
     * @param config {object}
     * @param base {object}
     * @param parent {object}
     * @return void
     */
    _applySubstitutions: function (config, base, parent) {
        var key,
            sub,
            find,
            item;
        base = base || config;
        parent = parent || {ref: config, key: null};
        let subFlag = false;

        for (key in config) {
            if (config.hasOwnProperty(key)) {
                // If the value is an "Object" or an "Array" drill into it

                if (isIterable(config[key])) {
                    // parent param {ref: config, key: key} is a recursion
                    // pointer that needed only when replacing "keys"
                    subFlag = this._applySubstitutions(config[key], base, {ref: config, key: key}) || subFlag;

                } else {
                    // Test if the key is a "substitution" key
                    sub = SUBMATCH.exec(key);
                    if (sub && (sub[0] === key)) {
                        subFlag = true;
                        // Pull out the key to "find"
                        find = extract(base, sub[1], null);

                        if (isA(find, Object)) {
                            // Remove the "substitution" key
                            delete config[key];

                            // Add the keys founds
                            // This should be inline at the point where the "substitution" key was.
                            // Currently they will be added out of order on the end of the map.
                            for (item in find) {
                                if (find.hasOwnProperty(item)) {
                                    if (!parent.ref[parent.key]) {
                                        parent.ref[item] = find[item];
                                    } else {
                                        parent.ref[parent.key][item] = find[item];
                                    }
                                }
                            }
                        } else {
                            config[key] = '--YCB-SUBSTITUTION-ERROR--';
                        }

                    } else if (SUBMATCH.test(config[key])) {
                        subFlag = true;
                        // Test if the value is a "substitution" value
                        // We have a match so lets use it
                        sub = SUBMATCH.exec(config[key]);
                        // Pull out the key to "find"
                        find = sub[1];
                        // First see if it is the whole value
                        if (sub[0] === config[key]) {
                            // Replace the whole value with the value found by the sub string
                            find = extract(base, find, null);
                            // If we have an array in an array do it "special like"
                            if (isA(find, Array) && isA(config, Array)) {
                                // This has to be done on the parent or the reference is lost
                                // The whole {ref: config, key: key} is needed only when replacing "keys"
                                parent.ref[parent.key] = config.slice(0, parseInt(key, 10))
                                    .concat(find)
                                    .concat(config.slice(parseInt(key, 10) + 1));
                            } else {
                                config[key] = find;
                            }
                        } else {
                            // If not it's just part of the whole value
                            config[key] = config[key]
                                .replace(SUBMATCHES, replacer(base));
                        }
                    }
                }
            }
        }
        return subFlag;
    },

    /**
     * Iterates over all the setting sections in the YCB file, calling the
     * callback for each section.
     * @method walkSettings
     * @param callback {function(settings, config)}
     * @param callback.settings {object} the condition under which section will be used
     * @param callback.config {object} the configuration in the section
     * @param callback.return {boolean} if the callback returns false, then walking is stopped
     * @return {nothing} results returned via callback
     */
    walkSettings: function (callback) {
        if(this.masterDelta && !callback({}, cloneDeep(this.masterDelta))) {
            return undefined;
        }
        this._walkSettingsHelper(this.tree, 0, [], callback, [false]);
    },

    /**
     * Recursive helper for walking the config tree.
     * @param cur
     * @param depth
     * @param context
     * @param callback
     * @param stop
     * @returns {*}
     * @private
     */
    _walkSettingsHelper: function(cur, depth, context, callback, stop) {
        if(stop[0]) {
            return true;
        }
        if(depth === this.dimensionsList.length) {
            stop[0] = !callback(this._contextToObject(context), cloneDeep(cur));
            return stop[0];
        }
        let key;
        for(key in cur) {
            if(this._walkSettingsHelper(cur[key], depth+1, context.concat(key), callback, stop)) {
                return true;
            }
        }
    },

    /**
     * Return clone of the dimensions object.
     * @returns {array}
     */
    getDimensions: function() {
        return cloneDeep(this.dimensions);
    }
};



//---------------------------------------------------------------
// MODULE INTERFACE

module.exports = {

    version: VERSION,

    // object-oriented interface
    Ycb: Ycb,

    /*
     * Processes an Object representing a YCB 2.0 Bundle as defined in the spec.
     *
     * @method read
     * @param bundle {object}
     * @param context {object}
     * @param validate {boolean}
     * @param debug {boolean}
     * @return {object}
     */
    read: function (bundle, context, validate, debug) {
        var ycb = new Ycb(bundle),
            opts = {
                validate: validate,
                debug: debug
            };
        return ycb.read(context, opts);
    },

    /*
     * Like read(), but doesn't merge the found sections.
     *
     * @method readNoMerge
     * @param bundle {object}
     * @param context {object}
     * @param validate {boolean}
     * @param debug {boolean}
     * @return {array of objects}
     */
    readNoMerge: function (bundle, context, validate, debug) {
        var ycb = new Ycb(bundle),
            opts = { debug: debug };
        return ycb.readNoMerge(context, opts);
    }
};