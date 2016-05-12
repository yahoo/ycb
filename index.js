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
    this.dimensions = {};
    this._dimensionOrder = [];
    this.settings = {};
    this.schema = {};
    this.dimsUsed = {}; // dim name: value: true
    this._dimensionHierarchies = {};
    this._processRawBundle(cloneDeep(bundle), this.options);
}
Ycb.prototype = {


    /**
     * Returns the dimensions in the YCB file.
     * @method getDimensions
     * @return {object} the dimensions
     */
    getDimensions: function () {
        return cloneDeep(this.dimensions);
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
        var path,
            context;
        for (path in this.settings) {
            if (this.settings.hasOwnProperty(path)) {
                context = this._getContextFromLookupPath(path);
                // clone, so that no-one mutates us
                if (!callback(context, cloneDeep(this.settings[path]))) {
                    break;
                }
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
    read: function (context, options) {
        var lookupPaths,
            path,
            config = {};

        context = context || {};
        options = mergeDeep(this.options, options || {});

        lookupPaths = this._getLookupPaths(context, options);

        if (options.debug) {
            console.log(JSON.stringify(context, null, 4));
            console.log(JSON.stringify(this.dimensions, null, 4));
            console.log(JSON.stringify(this.settings, null, 4));
            console.log(JSON.stringify(this.schema, null, 4));
            console.log(JSON.stringify(lookupPaths, null, 4));
        }

        // Now we simply merge each matching settings section we find into the config
        for (path = 0; path < lookupPaths.length; path += 1) {
            if (this.settings[lookupPaths[path]]) {
                if (options.debug) {
                    console.log('----USING---- ' + lookupPaths[path]);
                    console.log(JSON.stringify(this.settings[lookupPaths[path]], null, 4));
                }
                // merge a copy so that we don't modify the source
                config = mergeDeep(this.settings[lookupPaths[path]], config);
            }
        }

        if (options.applySubstitutions !== false) {
            this._applySubstitutions(config);
        }

        if (options.validate) {
            console.log('The YCB option "validate" is not implemented yet.');
        }
        delete config.__ycb_source__;
        return config;
    },


    /**
     * Like read(), but doesn't merge the found sections.
     * Also, doesn't do substitutions.
     *
     * @method readNoMerge
     * @param context {object}
     * @param options {object}
     * @return {array of objects}
     */
    readNoMerge: function (context, options) {
        var lookupPaths,
            path,
            config = [];

        context = context || {};

        lookupPaths = this._getLookupPaths(context, options);

        if (options.debug) {
            console.log(JSON.stringify(context, null, 4));
            console.log(JSON.stringify(this.dimensions, null, 4));
            console.log(JSON.stringify(this.settings, null, 4));
            console.log(JSON.stringify(this.schema, null, 4));
            console.log(JSON.stringify(lookupPaths, null, 4));
        }

        // Now we simply merge each matching settings section we find into the config
        for (path = 0; path < lookupPaths.length; path += 1) {
            if (this.settings[lookupPaths[path]]) {
                if (options.debug) {
                    console.log('----USING---- ' + lookupPaths[path]);
                    console.log(JSON.stringify(this.settings[lookupPaths[path]], null, 4));
                }
                config.push(cloneDeep(this.settings[lookupPaths[path]]));
            }
        }
        return config;
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

        for (key in config) {
            if (config.hasOwnProperty(key)) {
                // If the value is an "Object" or an "Array" drill into it

                if (isIterable(config[key])) {
                    // parent param {ref: config, key: key} is a recursion
                    // pointer that needed only when replacing "keys"
                    this._applySubstitutions(config[key], base, {ref: config, key: key});

                } else {
                    // Test if the key is a "substitution" key
                    sub = SUBMATCH.exec(key);
                    if (sub && (sub[0] === key)) {
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
    },


    /**
     * @private
     * @method _getLookupPaths
     * @param context {object} Key/Value list
     * @param options {object} runtime options
     * @return {Array}
     */
    _getLookupPaths: function (context, options) {
        var lookupList = this._makeOrderedLookupList(context, options);
        return this._expandLookupList(lookupList, options);
    },

    /**
     * Expands a lookupList into a list of string keys
     * @private
     * @param lookupList {Object}
     * @returns {[String]}
     */
    _expandLookupList: function (lookupList) {
        var dimensions = Object.keys(lookupList),
            pos,
            current = dimensions.length - 1,
            combination = [];

        // This is our combination that we will tumble over
        for (pos = 0; pos < dimensions.length; pos += 1) {
            combination.push({
                current: 0,
                total: lookupList[dimensions[pos]].length - 1
            });
        }

        function tumble(combination, location) {
            // If the location is not found return
            if (!combination[location]) {
                return false;
            }

            // Move along to the next item
            combination[location].current += 1;

            // If the next item is not found move to the prev location
            if (combination[location].current > combination[location].total) {
                combination[location].current = 0;
                return tumble(combination, location - 1);
            }

            return true;
        }

        var paths = [];
        do {
            var path = [];
            for (pos = 0; pos < dimensions.length; pos += 1) {
                path.push(lookupList[dimensions[pos]][combination[pos].current]);
            }
            paths.push(path.join(SEPARATOR));
        } while (tumble(combination, current));

        return paths.reverse();
    },

    /**
     * Creates a settings cache that maps a lookup key to the settings section
     * @private
     * @param settings {array} The list of dimensions and values the section applies to
     * @param section {object} The configuration values for the settings
     * @param dimsUsed {object}
     * @param options {object}
     * @return {void}
     */
    _createSettingsLookups: function (settings, section, dimsUsed, options) {
        var context = {};
        for (var part = 0; part < settings.length; part += 1) {
            var kv = settings[part].split(':');
            var dim = kv[0];
            var val = kv[1] ? kv[1].split(',') : kv[1];

            if ('master' !== settings[0]) {
                // Validate dimension name
                if (!this._dimensionHierarchies.hasOwnProperty(dim)) {
                    console.log('WARNING: invalid dimension "' + dim +
                        '" in settings ' + JSON.stringify(settings));
                    return;
                }
                dimsUsed[dim] = dimsUsed[dim] || [];
                val.forEach(function (v) {
                    // Validate dimension value
                    if (!this._dimensionHierarchies[dim].hasOwnProperty(v)) {
                        console.log('WARNING: invalid value "' + v + '" for dimension "' + dim +
                            '" in settings ' + JSON.stringify(settings));
                    } else {
                        dimsUsed[dim].push(v);
                    }
                }, this);
            }
            context[dim] = val;
        }

        // Build the full context paths
        var lookupList = {};
        this._dimensionOrder.forEach(function (dim) {
            lookupList[dim] = context[dim] || DEFAULT;
        });
        var keys = this._expandLookupList(lookupList, {
            useAllDimensions: true
        }, settings);

        keys.forEach(function (key) {
            // Add the section to the settings list with it's full key
            if (!this.settings[key]) {
                this.settings[key] = section;
            } else {
                if (options && options.debug) {
                    console.log('Merging section ' + JSON.stringify(settings) + (
                            section.__ycb_source__ ? (' from ' + section.__ycb_source__) : ''
                        ) + (
                            this.settings[key] ? (' onto ' + this.settings[key].__ycb_source__) : ''
                        ));
                }
                // Clone original settings so that we don't override shared settings
                this.settings[key] = mergeDeep(section, cloneDeep(this.settings[key]));
            }
        }, this);
    },


    /**
     * @private
     * @method _processRawBundle
     * @param bundle {object}
     * @param options {object}
     * @return {nothing}
     */
    _processRawBundle: function (bundle, options) {
        var pos,
            section,
            settings,
            dimsUsed = {};

        // Extract each section from the bundle
        for (pos = 0; pos < bundle.length; pos += 1) {
            section = bundle[pos];
            if (section.dimensions) {
                this.dimensions = section.dimensions;
                this._calculateDimensionOrder();
                this._calculateHierarchies();
            } else if (section.schema) {
                this.schema = section.schema;
            } else if (section.settings) {
                settings = section.settings;
                // Remove the settings key now we are done with it
                delete section.settings;
                this._createSettingsLookups(settings, section, dimsUsed, options);
            }
        }

        this._buildUsageMap(dimsUsed);
    },

    _buildUsageMap: function (dimsUsed) {
        var i, j, k,
            value,
            name,
            hierarchy;

        // Assemble map of all dimensions used including ancestry
        this.dimsUsed = {};
        for (name in dimsUsed) {
            if (dimsUsed.hasOwnProperty(name) && this._dimensionHierarchies.hasOwnProperty(name)) {
                this.dimsUsed[name] = {};
                for (i=0; i<dimsUsed[name].length; i += 1) {
                    value = dimsUsed[name][i];
                    for (hierarchy in this._dimensionHierarchies[name]) {
                        if (this._dimensionHierarchies[name].hasOwnProperty(hierarchy)) {
                            if (-1 !== this._dimensionHierarchies[name][hierarchy].indexOf(value)) {
                                this.dimsUsed[name][hierarchy] = true;
                            }
                        }
                    }
                }
            }
        }
    },


    /**
     * @private
     * @method _getContextFromLookupPath
     * @param path {string} the path
     * @return {object} the corresponding context (really a partial context)
     */
    _getContextFromLookupPath: function (path) {
        var parts = path.split(SEPARATOR),
            p,
            part,
            dimName,
            ctx = {};
        for (p = 0; p < this._dimensionOrder.length; p += 1) {
            part = parts[p];
            if (DEFAULT !== part) {
                // Having more than one key in the dimensions structure is against
                // the YCB spec.
                dimName = Object.keys(this.dimensions[p])[0];
                ctx[dimName] = part;
            }
        }
        return ctx;
    },


    /**
     * @private
     * @method _makeOrderedLookupList
     * @param context {object} Key/Value list
     * @param options {object}
     * @return {object} list of lists
     */
    _makeOrderedLookupList: function (context, options) {
        var pos,
            name,
            chains = {};

        for (pos = 0; pos < this._dimensionOrder.length; pos += 1) {
            name = this._dimensionOrder[pos];
            var value = context[name];
            if (isA(value, Array)) {
                var lookup = [];
                value.forEach(function (val) {
                    if (options.useAllDimensions || (this.dimsUsed[name] && this.dimsUsed[name][val])) {
                        lookup = lookup.concat(this._dimensionHierarchies[name][val] || DEFAULT_LOOKUP);
                    } else {
                        lookup = lookup.concat(DEFAULT_LOOKUP);
                    }
                }, this);
                chains[name] = arrayReverseUnique(lookup);
            } else {
                if (options.useAllDimensions || (this.dimsUsed[name] && this.dimsUsed[name][value])) {
                    chains[name] = this._dimensionHierarchies[name][value] || DEFAULT_LOOKUP;
                } else {
                    chains[name] = DEFAULT_LOOKUP;
                }
            }
        }
        return chains;
    },

    _calculateDimensionOrder: function () {
        var pos, name;
        for (pos = 0; pos < this.dimensions.length; pos += 1) {
            for (name in this.dimensions[pos]) {
                if (this.dimensions[pos].hasOwnProperty(name)) {
                    this._dimensionOrder.push(name);
                }
            }
        }
    },


    /**
     * @private
     * @method _calculateHierarchy
     * @param parents {array}
     * @param dimension {object} A single YCB dimension structured object
     * @param build {string}
     * @return {object} k/v map
     */
    _calculateHierarchy: function (parents, dimension, build) {
        var key,
            newParents,
            nextDimension;

        build = build || {};
        if (typeof dimension === 'object') {
            for (key in dimension) {
                if (dimension.hasOwnProperty(key)) {
                    nextDimension = dimension[key];
                    newParents = ([key].concat(parents));
                    build[key] = newParents;
                    if (typeof nextDimension === 'object') {
                        this._calculateHierarchy(newParents, nextDimension, build);
                    }
                }
            }
        }
        return build;
    },


    /**
     * @private
     * @method _calculateHierarchies
     * @return {nothing}
     */
    _calculateHierarchies: function () {
        var pos,
            name;

        for (pos = 0; pos < this._dimensionOrder.length; pos += 1) {
            name = this._dimensionOrder[pos];
            this._dimensionHierarchies[name] = this._calculateHierarchy(DEFAULT_LOOKUP, this.dimensions[pos][name]);
        }
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
