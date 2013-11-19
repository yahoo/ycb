/*
 * Copyright (c) 2011-2013, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*jslint anon:true, node:true, nomen:true*/

'use strict';

var VERSION = '1.0.2',
    DEFAULT = '*',
    SEPARATOR = '/',
    SUBMATCH = /\$\$([\w.-_]+?)\$\$/,
    SUBMATCHES = /\$\$([\w.-_]+?)\$\$/g;


//---------------------------------------------------------------
// UTILITY FUNCTIONS

function isA(item, constructor) {
    /*jslint eqeq:true*/
    return (item != null) && (item.constructor === constructor);
}

function isIterable(item) {
    return isA(item, Object) || isA(item, Array);
}

function objectMerge(from, to) {
    var key;
    for (key in from) {
        if (from.hasOwnProperty(key)) {
            if (to.hasOwnProperty(key)) {
                // Property in destination object set; update its value.
                if (isA(from[key], Object)) {
                    to[key] = objectMerge(from[key], to[key]);
                } else {
                    to[key] = from[key];
                }
            } else {
                // Property in destination object not set; create it and set its value.
                to[key] = from[key];
            }
        }
    }
    return to;
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
        if (cur[keys[i]]) {
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

function Ycb(bundle, options) {
    this.options = options || {};
    this.dimensions = {};
    this.settings = {};
    this.schema = {};
    this.dimsUsed = {}; // dim name: value: true
    this._processRawBundle(bundle, this.options);
}
Ycb.prototype = {


    /**
     * Returns the dimensions in the YCB file.
     * @method getDimensions
     * @return {object} the dimensions
     */
    getDimensions: function () {
        return this._cloneObj(this.dimensions);
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
                if (!callback(context, this._cloneObj(this.settings[path]))) {
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
        options = objectMerge(this.options, options || {});

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
                config = objectMerge(this._cloneObj(this.settings[lookupPaths[path]]), config);
            }
        }

        this._applySubstitutions(config);

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
                config.push(this._cloneObj(this.settings[lookupPaths[path]]));
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
        var values = this._makeOrderedLookupList(context, options),
            lookupList = Object.keys(values),
            path = [],
            paths = [],
            pos,
            current = lookupList.length - 1,
            combination = [];

        // This is our combination that we will tumble over
        for (pos = 0; pos < lookupList.length; pos += 1) {
            combination.push({
                current: 0,
                total: values[lookupList[pos]].length - 1
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

        do {
            path = [];
            for (pos = 0; pos < lookupList.length; pos += 1) {
                path.push(values[lookupList[pos]][combination[pos].current]);
            }
            paths.push(path.join(SEPARATOR));
        } while (tumble(combination, current));

        return paths.reverse();
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
            part,
            kv,
            context,
            settings,
            key;

        // Extract each section from the bundle
        for (pos = 0; pos < bundle.length; pos += 1) {
            section = bundle[pos];
            if (section.dimensions) {
                this.dimensions = section.dimensions;
                this._flattenDimensions();
            } else if (section.schema) {
                this.schema = section.schema;
            } else if (section.settings) {
                context = {};
                for (part = 0; part < section.settings.length; part += 1) {
                    kv = section.settings[part].split(':');
                    if ('master' !== section.settings[0]) {
                        if (!this.dimsUsed[kv[0]]) {
                            this.dimsUsed[kv[0]] = {};
                        }
                        this.dimsUsed[kv[0]][kv[1]] = true;
                    }
                    context[kv[0]] = kv[1];
                }
                settings = section.settings;
                // Remove the settings key now we are done with it
                delete section.settings;

                // Build the full context path
                key = this._getLookupPath(context, options);

                // Add the section to the settings list with it's full key
                // IMY Bug 5439377 configuration does not accept neither null nor false values?
                if (!this.settings[key]) {
                    this.settings[key] = section;
                } else {
                    if (options.debug) {
                        console.log('Merging section ' + JSON.stringify(settings) + (
                            section.__ycb_source__ ? (' from ' + section.__ycb_source__) : ''
                        ) + (
                            this.settings[key] ? (' onto ' + this.settings[key].__ycb_source__) : ''
                        ));
                    }
                    objectMerge(section, this.settings[key]);
                }
            }
        }
    },


    /**
     * @private
     * @method _getContextPath
     * @param context {object} Key/Value list
     * @param options {object}
     * @return {string}
     */
    _getLookupPath: function (context, options) {
        var lookupList = this._makeOrderedLookupList(context, options),
            name,
            list,
            lookup = {},
            item,
            path = [];

        for (name in lookupList) {
            if (lookupList.hasOwnProperty(name)) {
                if (context[name]) {
                    for (list = 0; list < lookupList[name].length; list += 1) {
                        if (lookupList[name][list] === context[name]) {
                            lookup[name] = lookupList[name][list];
                        }
                    }
                }
                // If there was no match set to default
                if (!lookup[name]) {
                    lookup[name] = DEFAULT;
                }
            }
        }

        for (item in lookup) {
            if (lookup.hasOwnProperty(item)) {
                path.push(lookup[item]);
            }
        }
        return path.join(SEPARATOR);
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
        for (p = 0; p < this.dimensions.length; p += 1) {
            part = parts[p];
            if ('*' !== part) {
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
            path,
            value,
            used,
            parts,
            i,
            chains = {};

        for (pos = 0; pos < this.dimensions.length; pos += 1) {
            for (name in this.dimensions[pos]) {
                if (this.dimensions[pos].hasOwnProperty(name)) {
                    for (path in this._dimensionPaths[name]) {
                        if (this._dimensionPaths[name].hasOwnProperty(path)) {
                            value = this._dimensionPaths[name][path];
                            used = options.useAllDimensions || false;
                            if (!options.useAllDimensions && this.dimsUsed[name]) {
                                parts = path.split(SEPARATOR);
                                for (i = 0; i < parts.length; i += 1) {
                                    if (this.dimsUsed[name][parts[i]]) {
                                        used = true;
                                    }
                                }
                            }
                            if (used && value === context[name]) {
                                chains[name] = path;
                            }
                        }
                    }
                    if (chains[name]) {
                        // Convert to an ordered list
                        chains[name] = chains[name].split(SEPARATOR).reverse().concat(DEFAULT);
                    } else {
                        // If there was no match set to default
                        chains[name] = [DEFAULT];
                    }
                }
            }
        }
        return chains;
    },


    /**
     * @private
     * @method _flattenDimension
     * @param prefix {string}
     * @param dimension {object} A single YCB dimension structured object
     * @param build {string}
     * @return {object} k/v map
     */
    _flattenDimension: function (prefix, dimension, build) {
        var key,
            newPrefix,
            nextDimension;

        build = build || {};
        if (typeof dimension === 'object') {
            for (key in dimension) {
                if (dimension.hasOwnProperty(key)) {
                    nextDimension = dimension[key];
                    newPrefix = (prefix ? prefix + SEPARATOR + key : key);
                    build[newPrefix] = key;
                    if (typeof nextDimension === 'object') {
                        build = this._flattenDimension(newPrefix, nextDimension, build);
                    }
                }
            }
        }
        return build;
    },


    /**
     * @private
     * @method _flattenDimensions
     * @return {nothing}
     */
    _flattenDimensions: function () {
        var pos,
            name;
        this._dimensionPaths = {};
        for (pos = 0; pos < this.dimensions.length; pos += 1) {
            for (name in this.dimensions[pos]) {
                if (this.dimensions[pos].hasOwnProperty(name)) {
                    this._dimensionPaths[name] = this._flattenDimension('', this.dimensions[pos][name]);
                }
            }
        }
    },


    /**
     * @private
     * @method _cloneObj
     * @param {object} o object to clone
     * @return {object} a copy of the object
     */
    _cloneObj: function (o) {
        var newO,
            i;

        if (typeof o !== 'object') {
            return o;
        }
        if (!o) {
            return o;
        }

        if ('[object Array]' === Object.prototype.toString.apply(o)) {
            newO = [];
            for (i = 0; i < o.length; i += 1) {
                newO[i] = this._cloneObj(o[i]);
            }
            return newO;
        }

        newO = {};
        for (i in o) {
            if (o.hasOwnProperty(i)) {
                newO[i] = this._cloneObj(o[i]);
            }
        }
        return newO;
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
