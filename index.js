/*
 * Copyright (c) 2011-2013, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

'use strict';

var VERSION = '1.0.2',
    DEFAULT = '*',
    EXPIRATION_KEY = '__ycb_expires_at__',
    SENTINEL_TIME = Number.POSITIVE_INFINITY,
    SUBMATCH = /\$\$([\w.-_]+?)\$\$/,
    SUBMATCHES = /\$\$([\w.-_]+?)\$\$/g,
    DEFAULT_LOOKUP = [DEFAULT];
var cloneDeep = require('./lib/cloneDeep');
var mergeDeep = require('./lib/mergeDeep');
var isA = require('./lib/isA');
var isIterable = require('./lib/isIterable');

//---------------------------------------------------------------
// UTILITY FUNCTIONS

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
    return Object.keys(obj).reduce(function(result, key) {
        if(key !== omitKey) {
            result[key] = obj[key];
        }
        return result;
    }, {});
}

function logBundleWarning(index, message, value, context) {
    if(value === undefined) {
        console.log('WARNING: config[%d] has %s.%s', index, message, context);
    } else {
        console.log('WARNING: config[%d] has %s. %s%s', index, message, value, context);
    }
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
    this.valueToNumber = {};
    this.numberToValue = DEFAULT_LOOKUP;
    this.precedenceMap = [[0]];
    this.tree = new Map();
    this.masterDelta = undefined;
    this.dimensions = [];
    this.logContext = '';
    if(this.options.logContext !== undefined) {
        this.logContext = ' source=' + this.options.logContext;
    }
    this._processRawBundle(cloneDeep(bundle));
}
Ycb.prototype = {

    /**
     * Read the file.
     * @method read
     * @param contextObj {object}
     * @param options {object}
     * @return {object}
     */
    read: function(contextObj, options) {
        options = options ? mergeDeep(this.options, options, true) : this.options;
        var context = this._parseContext(contextObj);
        var subKey = options.applySubstitutions !== false ? 'subbed': 'unsubbed';
        var collector = this.masterDelta ? cloneDeep(this.masterDelta[subKey]) : {};
        this._readHelper(this.tree, 0, context, collector, subKey);
        if(collector.__ycb_source__) {
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
            mergeDeep(cur[subKey], collector, false);
            return;
        }
        var value = context[depth];
        if(!Array.isArray(value)) {
            var keys = this.precedenceMap[value];
            var n = keys.length;
            for(var j=0; j<n; j++) {
                if(cur.has(keys[j])) {
                    this._readHelper(cur.get(keys[j]), depth+1, context, collector, subKey);
                }
            }
        } else {
            var seen = {};
            var i = value.length;
            while(i--) {
                keys = this.precedenceMap[value[i]];
                n = keys.length;
                for(j=0; j<n; j++) {
                    if(cur.has(keys[j]) && seen[keys[j]] === undefined) {
                        this._readHelper(cur.get(keys[j]), depth+1, context, collector, subKey);
                        seen[keys[j]] = true;
                    }
                }
            }
        }
    },

    /**
     * Read the configs for the given context and time and merge them in order general to specific.
     * Scheduled configs with equivalent contexts are merged by starting time.
     * @method read
     * @param contextObj {object}
     * @param time {number} time in milliseconds
     * @param options {object}
     * @return {array}
     */
    readTimeAware: function(contextObj, time, options) {
        options = options ? mergeDeep(this.options, options, true) : this.options;
        var context = this._parseContext(contextObj);
        var subKey = options.applySubstitutions !== false ? 'subbed': 'unsubbed';
        var collector = {};
        var soonest = SENTINEL_TIME;
        if(this.masterDelta) {
            if(this.masterDelta[subKey]) {
                collector = cloneDeep(this.masterDelta[subKey]);
            }
            if(this.masterDelta.schedules) {
                soonest = this._readScheduled(this.masterDelta.schedules, time, collector, subKey);
            }
        }
        var ret = this._readTimeAwareHelper(this.tree, 0, context, time, collector, subKey);
        if(ret < soonest) {
            soonest = ret;
        }
        if(soonest !== SENTINEL_TIME && options.cacheInfo === true) {
            collector[EXPIRATION_KEY] = soonest;
        }
        return collector;
    },

    /**
     * Recurse through the tree merging configs that apply to the given context.
     * @param cur {object} the current node.
     * @param depth {number} current depth in tree.
     * @param context {array} the context in internal format.
     * @param time {number} milliseconds
     * @param collector {object} the config we build
     * @param subKey {string} determines if substituted or non-substituted configs are used.
     * @private
     */
    _readTimeAwareHelper: function(cur, depth, context, time, collector, subKey) {
        var soonest = SENTINEL_TIME;
        var ret;
        if(depth === context.length) {
            if(cur[subKey]) {
                mergeDeep(cur[subKey], collector, false);
            }
            if(cur.schedules) {
                soonest = this._readScheduled(cur.schedules, time, collector, subKey);
            }
            return soonest;
        }
        var value = context[depth];
        if(!Array.isArray(value)) {
            var keys = this.precedenceMap[value];
            var n = keys.length;
            for(var j=0; j<n; j++) {
                if(cur.has(keys[j])) {
                    ret = this._readTimeAwareHelper(cur.get(keys[j]), depth+1, context, time, collector, subKey);
                    if(ret < soonest) {
                        soonest = ret;
                    }
                }
            }
        } else {
            var seen = {};
            var i = value.length;
            while(i--) {
                keys = this.precedenceMap[value[i]];
                n = keys.length;
                for(j=0; j<n; j++) {
                    if(cur.has(keys[j]) && seen[keys[j]] === undefined) {
                        ret = this._readTimeAwareHelper(cur.get(keys[j]), depth+1, context, time, collector, subKey);
                        seen[keys[j]] = true;
                        if(ret < soonest) {
                            soonest = ret;
                        }
                    }
                }
            }
        }
        return soonest;
    },

    /**
     * Read the configs for the given context and return them in order general to specific.
     * @method read
     * @param contextObj {object}
     * @param options {object}
     * @return {array}
     */
    readNoMerge: function(contextObj, options) {
        options = options ? mergeDeep(this.options, options, true) : this.options;
        var context = this._parseContext(contextObj);
        var subKey = options.applySubstitutions !== false ? 'subbed': 'unsubbed';
        var collector = this.masterDelta ? [this.masterDelta[subKey]] : [];
        this._readNoMergeHelper(this.tree, 0, context, collector, subKey);
        return cloneDeep(collector);
    },

    /**
     * Recurse through the tree collecting configs that apply to the given context.
     * @param cur {object} the current node.
     * @param depth {number} current depth in tree.
     * @param context {array} the context in internal format.
     * @param collector {array} the array we push configs to.
     * @param subKey {string} determines if substituted or non-substituted configs are used.
     * @private
     */
    _readNoMergeHelper: function(cur, depth, context, collector, subKey) {
        if(depth === context.length) {
            collector.push(cur[subKey]);
            return;
        }
        var value = context[depth];
        if(!Array.isArray(value)) {
            var keys = this.precedenceMap[value];
            var n = keys.length;
            for(var j=0; j<n; j++) {
                if(cur.has(keys[j])) {
                    this._readNoMergeHelper(cur.get(keys[j]), depth+1, context, collector, subKey);
                }
            }
        } else {
            var seen = {};
            var i = value.length;
            while(i--) {
                keys = this.precedenceMap[value[i]];
                n = keys.length;
                for(j=0; j<n; j++) {
                    if(cur.has(keys[j]) && seen[keys[j]] === undefined) {
                        this._readNoMergeHelper(cur.get(keys[j]), depth+1, context, collector, subKey);
                        seen[keys[j]] = true;
                    }
                }
            }
        }
    },

    /**
     * Read the configs for the given context and time and return them in order general to specific.
     * Scheduled configs with equivalent contexts are ordered by starting time.
     * @method read
     * @param contextObj {object}
     * @param time {number} time in milliseconds
     * @param options {object}
     * @return {array}
     */
    readNoMergeTimeAware: function(contextObj, time, options) {
        options = options ? mergeDeep(this.options, options, true) : this.options;
        var context = this._parseContext(contextObj);
        var subKey = options.applySubstitutions !== false ? 'subbed': 'unsubbed';
        var collector = [];
        var soonest = SENTINEL_TIME;
        if(this.masterDelta) {
            if(this.masterDelta[subKey]) {
                collector = [this.masterDelta[subKey]];
            }
            if(this.masterDelta.schedules) {
                soonest = this._readScheduledNoMerge(this.masterDelta.schedules, time, collector, subKey);
            }
        }
        var ret = this._readNoMergeTimeAwareHelper(this.tree, 0, context, time, collector, subKey);
        if(ret < soonest) {
            soonest = ret;
        }
        collector = cloneDeep(collector); //clone before we may add cache info to result
        if(soonest !== SENTINEL_TIME && options.cacheInfo === true) {
            if(collector.length > 0) {
                collector[0][EXPIRATION_KEY] = soonest;
            } else {
                var o = {};
                o[EXPIRATION_KEY] = soonest;
                collector.push(o);
            }
        }
        return collector;
    },

    /**
     * Recurse through the tree collecting configs that apply to the given context.
     * @param cur {object} the current node.
     * @param depth {number} current depth in tree.
     * @param context {array} the context in internal format.
     * @param time {number} milliseconds
     * @param collector {array} the array we push configs to.
     * @param subKey {string} determines if substituted or non-substituted configs are used.
     * @private
     */
    _readNoMergeTimeAwareHelper: function(cur, depth, context, time, collector, subKey) {
        var soonest = SENTINEL_TIME;
        var ret;
        if(depth === context.length) {
            if(cur[subKey]) {
                collector.push(cur[subKey]);
            }
            if(cur.schedules) {
                soonest = this._readScheduledNoMerge(cur.schedules, time, collector, subKey);
            }
            return soonest;
        }
        var value = context[depth];
        if(!Array.isArray(value)) {
            var keys = this.precedenceMap[value];
            var n = keys.length;
            for(var j=0; j<n; j++) {
                if(cur.has(keys[j])) {
                    ret = this._readNoMergeTimeAwareHelper(cur.get(keys[j]), depth+1, context, time, collector, subKey);
                    if(ret < soonest) {
                        soonest = ret;
                    }
                }
            }
        } else {
            var seen = {};
            var i = value.length;
            while(i--) {
                keys = this.precedenceMap[value[i]];
                n = keys.length;
                for(j=0; j<n; j++) {
                    if(cur.has(keys[j]) && seen[keys[j]] === undefined) {
                        ret = this._readNoMergeTimeAwareHelper(cur.get(keys[j]), depth+1, context, time, collector, subKey);
                        seen[keys[j]] = true;
                        if(ret < soonest) {
                            soonest = ret;
                        }
                    }
                }
            }
        }
        return soonest;
    },

    /**
     * Converts a context object into a string that can be used as a cache key.
     * Two contexts may only have equal cache keys if they return the same configs when calling read.
     * @param contextObj {object}
     * @returns {string}
     * @private
     */
    getCacheKey: function(contextObj) {
        return JSON.stringify(this._parseContext(contextObj));
    },

    /**
     * Converts a context object to equivalent array of numerical values.
     *
     * @param contextObj {object}
     * @returns {array}
     * @private
     */
    _parseContext: function(contextObj) {
        if(contextObj === undefined) {
            contextObj = {};
        }
        var context = new Array(this.dimensionsList.length);
        for(var i=0; i<this.dimensionsList.length; i++) {
            var dimension = this.dimensionsList[i];
            if(contextObj.hasOwnProperty(dimension)) {
                var value = contextObj[dimension];
                if(Array.isArray(value)) {
                    var newValue = [];
                    for(var j=0; j<value.length; j++) {
                        var numValue = this.valueToNumber[dimension][value[j]];
                        if(numValue !== undefined) {
                            newValue.push(numValue);
                        }
                    }
                    if(newValue.length) {
                        context[i] = newValue;
                        continue;
                    }
                } else {
                    numValue = this.valueToNumber[dimension][value];
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
     * @param context {array}
     * @returns {object}
     * @private
     */
    _contextToObject: function(context) {
        var contextObj = {};
        for(var i=0; i<context.length; i++) {
            if(context[i] !== 0) {
                contextObj[this.dimensionsList[i]] = this.numberToValue[context[i]];
            }
        }
        return contextObj;
    },

    /**
     * @private
     * @method _processRawBundle
     * @param config {object}
     */
    _processRawBundle: function(config) {
        var dimCheckResult = this._checkDimensions(config);
        var dimensionsObject = dimCheckResult[0];
        var totalDimensions = dimCheckResult[1];

        var settingsCheckResult = this._checkSettings(config, totalDimensions, dimensionsObject.length);
        var usedDimensions = settingsCheckResult[0];
        var usedValues = settingsCheckResult[1];
        var contexts = settingsCheckResult[2];
        var intervals = settingsCheckResult[3];

        var activeDimensions = this._parseDimensions(dimensionsObject, usedDimensions, usedValues);

        for(var configIndex=0; configIndex<config.length; configIndex++) {
            var fullContext = contexts[configIndex];
            if(fullContext !== undefined) {
                var context = this._filterContext(configIndex, fullContext, activeDimensions, usedValues, config[configIndex].settings);
                if(context !== undefined) {
                    var delta = this._buildDelta(config[configIndex], intervals[configIndex]);
                    this._buildTreeHelper(this.tree, 0, context, delta);
                }
            }
        }
    },

    /**
     * Extract dimensions object and dimension -> number map
     * @param config {object}
     * @returns {array}
     * @private
     */
    _checkDimensions: function(config) {
        for(var i=0; i<config.length; i++) {
            if(config[i].dimensions) {
                var dimensions = config[i].dimensions;
                this.dimensions = dimensions;
                var allDimensions = {};
                for(var j=0; j<dimensions.length; j++) {
                    var name;
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
     * @param config {object}
     * @param allDimensions {object}
     * @param height {number}
     * @returns {array}
     * @private
     */
    _checkSettings: function(config, allDimensions, height) {
        var usedDimensions = {};
        var usedValues = {};
        var contexts = {};
        var intervals = {};
        configLoop:
        for(var i=0; i<config.length; i++) {
            var configObj = config[i];
            if(!isA(configObj, Object)) {
                logBundleWarning(i, 'non-object config', JSON.stringify(configObj), this.logContext);
                continue;
            }
            if(!configObj.settings) {
                if(!configObj.dimensions) {
                    logBundleWarning(i, 'no valid settings field', JSON.stringify(configObj), this.logContext);
                }
                continue;
            }
            if(Array.isArray(configObj.settings)) { //convert old style settings to new style
                configObj.settings = {dimensions: configObj.settings};
            }
            var setting = config[i].settings;

            var settingDimensions = setting.dimensions;
            var settingSchedule = setting.schedule;
            var interval = undefined;
            if(Object.keys(config[i]).length === 1) { //Don't skip as empty configs are valid and appear on tree walk
                logBundleWarning(i, 'empty config', JSON.stringify(settingDimensions), this.logContext);
            }
            if(!Array.isArray(settingDimensions)) {
                logBundleWarning(i, 'non-array settings', JSON.stringify(settingDimensions), this.logContext);
                continue;
            }
            if(settingDimensions.length === 0 ) {
                logBundleWarning(i, 'empty settings array', undefined, this.logContext);
                continue;
            }
            if(settingSchedule !== undefined) {
                interval = {start: 0, end: SENTINEL_TIME};
                if(settingSchedule.start === undefined && settingSchedule.end === undefined){
                    logBundleWarning(i, 'empty schedule', JSON.stringify(setting), this.logContext);
                    continue;
                }
                if(settingSchedule.start !== undefined) {
                    var startDate = new Date(settingSchedule.start);
                    if(isNaN(startDate)) {
                        logBundleWarning(i, 'invalid start date', JSON.stringify(settingSchedule), this.logContext);
                        continue;
                    }
                    interval.start = startDate.getTime();
                }
                if(settingSchedule.end !== undefined) {
                    var endDate = new Date(settingSchedule.end);
                    if(isNaN(endDate)) {
                        logBundleWarning(i, 'invalid end date', JSON.stringify(settingSchedule), this.logContext);
                        continue;
                    }
                    interval.end = endDate.getTime();
                }
                intervals[i] = interval;
            }
            if(settingDimensions[0] === 'master') {
                if(settingDimensions.length > 1) {
                    logBundleWarning(i, 'master setting with additional dimensions',
                        JSON.stringify(settingDimensions), this.logContext);
                    continue;
                }
                if(this.masterDelta !== undefined) { //if master delta has been set than combine with existing one
                    var delta = this._buildDelta(configObj, interval);
                    this.masterDelta = this._combineDeltas(delta, this.masterDelta);
                } else {
                    this.masterDelta = this._buildDelta(configObj, interval);
                }
                continue;
            }
            //initialize context array with default values to be filled with any values specified in config
            var context = new Array(height);
            for(var q=0; q<height; q++) {
                context[q] = DEFAULT;
            }
            for(var j=0; j<settingDimensions.length; j++) {
                var kv = settingDimensions[j].split(':');
                if(kv.length !== 2) {
                    logBundleWarning(i, 'invalid setting ' + settingDimensions[j],
                        JSON.stringify(settingDimensions), this.logContext);
                    continue configLoop;
                }
                var dim = kv[0];
                var index = allDimensions[dim];
                if(index === undefined) {
                    logBundleWarning(i, 'invalid dimension ' + dim,
                        JSON.stringify(settingDimensions), this.logContext);
                    continue configLoop;
                }
                usedDimensions[dim] = 1;
                usedValues[dim] = usedValues[dim] || {};

                if(kv[1].indexOf(',') === -1) {
                    usedValues[dim][kv[1]] = 1;
                    context[index] = kv[1];
                } else {
                    var vals = kv[1].split(',');
                    context[index] = vals;
                    for(var k=0; k<vals.length; k++) {
                        usedValues[dim][vals[k]] = 1;
                    }
                }
            }
            contexts[i] = context;
        }
        return [usedDimensions, usedValues, contexts, intervals];
    },

    /**
     * Convert config to delta.
     * @param config {object}
     * @returns {object}
     * @private
     */
    _buildDelta: function(config, interval) {
        config = omit(config, 'settings');
        var subbed = cloneDeep(config);
        var subFlag = this._applySubstitutions(subbed, null, null);
        var unsubbed = subFlag ? config : subbed;
        if(interval) {
            return {schedules: this._buildSchedule(subbed, unsubbed, interval)};
        }
        return {subbed:subbed, unsubbed:unsubbed};
    },

    /**
     * Build schedule object from config and interval.
     * Schedule object may contain multiple intervals after being combined later, these
     * are stored as arrays of starts/ends and configs.
     * @param subbed {object}
     * @param unsubbed {object}
     * @param interval {object}
     * @returns {object}
     * @private
     */
    _buildSchedule: function(subbed, unsubbed, interval) {
        return {starts:[interval.start], ends:[interval.end], subbed:[subbed], unsubbed:[unsubbed]};
    },

    /**
     * Combine two delta objects and return combination, top onto bottom.
     * @param top {object}
     * @param bottom {object}
     * @returns {object}
     * @private
     */
    _combineDeltas: function(top, bottom) {
        var combinedDelta = {};
        if(top.schedules || bottom.schedules) {
            if(top.schedules === undefined) {
                combinedDelta.schedules = bottom.schedules;
            } else if(bottom.schedules === undefined) {
                combinedDelta.schedules = top.schedules;
            } else {
                combinedDelta.schedules = this._combineSchedules(top.schedules, bottom.schedules);
            }
        }
        if(top.subbed || bottom.subbed) {
            if(top.subbed === undefined) {
                combinedDelta.subbed = bottom.subbed;
                combinedDelta.unsubbed = bottom.unsubbed;
            } else if(bottom.subbed === undefined) {
                combinedDelta.subbed = top.subbed;
                combinedDelta.unsubbed = top.unsubbed;
            } else if (top.subbed === top.unsubbed && bottom.subbed === bottom.unsubbed) {
                var combined = mergeDeep(top.subbed, bottom.subbed, true);
                combinedDelta.subbed = combined;
                combinedDelta.unsubbed = combined;
            } else {
                combinedDelta.subbed = mergeDeep(top.subbed, bottom.subbed, true);
                combinedDelta.unsubbed = mergeDeep(top.unsubbed, bottom.unsubbed, true);
            }
        }
        return combinedDelta;
    },

    /**
     * Combine two schedule objects and return combination.
     * @param s1 {object}
     * @param s2 {object}
     * @returns {object}
     * @private
     */
    _combineSchedules: function(s1, s2) {
        var combined = {starts:[], ends:[], subbed:[], unsubbed:[]};
        var i = 0;
        var j = 0;
        while(i<s1.starts.length && j<s2.starts.length) {
            if(s1.starts[i] <= s2.starts[j]) {
                this._pushScheduleComponents(s1, combined, i++);
            } else {
                this._pushScheduleComponents(s2, combined, j++);
            }
        }
        while(i<s1.starts.length) {
            this._pushScheduleComponents(s1, combined, i++);
        }
        while(j<s2.starts.length) {
            this._pushScheduleComponents(s2, combined, j++);
        }
        return combined;
    },

    /**
     * Add the ith interval and config from schedule "from" to schedule "to".
     * Modifies "to" schedule.
     * @param from {object}
     * @param to {object}
     * @param i {number}
     * @private
     */
    _pushScheduleComponents: function(from, to, i) {
        to.starts.push(from.starts[i]);
        to.ends.push(from.ends[i]);
        to.subbed.push(from.subbed[i]);
        to.unsubbed.push(from.unsubbed[i]);
    },

    /**
     * Apply any valid scheduled configs for time to collector.
     * @param schedules {object}
     * @param time {number}
     * @param collector {object}
     * @param subKey {string}
     * @returns {object}
     * @private
     */
    _readScheduled: function(schedules, time, collector, subKey) {
        var soonest = SENTINEL_TIME;
        var i = 0;
        var n = schedules.starts.length;
        while(i < n && schedules.starts[i] <= time){
            if(time <= schedules.ends[i]) {
                mergeDeep(schedules[subKey][i], collector, false);
                if(schedules.ends[i] < soonest) {
                    soonest = schedules.ends[i];
                }
            }
            i++;
        }
        soonest++;
        if(i < n && schedules.starts[i] < soonest) {
            soonest = schedules.starts[i];
        }
        return soonest;
    },

    /**
     * Append any valid scheduled configs for time to collector.
     * @param schedules {object}
     * @param time {number}
     * @param collector {array}
     * @param subKey {string}
     * @returns {object}
     * @private
     */
    _readScheduledNoMerge: function(schedules, time, collector, subKey) {
        var soonest = SENTINEL_TIME;
        var i = 0;
        var n = schedules.starts.length;
        while(i < n && schedules.starts[i] <= time){
            if(time <= schedules.ends[i]) {
                collector.push(schedules[subKey][i]);
                if(schedules.ends[i] < soonest) {
                    soonest = schedules.ends[i];
                }
            }
            i++;
        }
        soonest++;
        if(i < n && schedules.starts[i] < soonest) {
            soonest = schedules.starts[i];
        }
        return soonest;
    },

    /**
     * Evaluate dimensions and omit unused dimensions.
     * @param dimensions {array}
     * @param usedDimensions {object}
     * @param usedValues {object}
     * @returns {array}
     * @private
     */
    _parseDimensions: function(dimensions, usedDimensions, usedValues) {
        var activeDimensions = new Array(dimensions.length);
        var valueCounter = 1;
        for(var i=0; i<dimensions.length; i++) {
            var dimensionName;
            for(dimensionName in dimensions[i]){break}
            if(usedDimensions[dimensionName] === undefined) {
                activeDimensions[i] = 0;
                continue;
            }
            activeDimensions[i] = 1;
            this.dimensionsList.push(dimensionName);
            var labelCollector = {};
            valueCounter = this._dimensionWalk(dimensions[i][dimensionName], usedValues[dimensionName],
                valueCounter, [0], this.precedenceMap, labelCollector, this.numberToValue);
            this.valueToNumber[dimensionName] = labelCollector;
        }
        return activeDimensions;
    },

    /**
     * Traverse a dimension hierarchy, label dimension values, and fill the precedence map and dim <-> num maps.
     * Mark used dimension values.
     * @param dimension {object}
     * @param used {object}
     * @param label {number}
     * @param path {array}
     * @param pathCollector {array}
     * @param valueToNumCollector {object}
     * @param numToValueCollector {array}
     * @returns {number}
     * @private
     */
    _dimensionWalk: function(dimension, used, label, path, pathCollector, valueToNumCollector, numToValueCollector) {
        for(var key in dimension) {
            var currentPath;
            if(used[key]) {
                used[key] = 2;
                currentPath = path.concat(label);
            } else {
                currentPath = path;
            }
            if(currentPath.length > 1) {
                var ancestor = currentPath[currentPath.length-1];
                valueToNumCollector[key] = ancestor;
                if(label === ancestor) {
                    pathCollector.push(currentPath);
                    numToValueCollector.push(key);
                    label++;
                }
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
     * @param fullContext {array}
     * @param activeDimensions {array}
     * @param usedValues {object}
     * @param setting {object}
     * @returns {array}
     * @private
     */
    _filterContext: function(configIndex, fullContext, activeDimensions, usedValues, setting) {
        var height = this.dimensionsList.length;
        var newContext = new Array(height);
        for(var i=0; i<height; i++) {
            newContext[i] = 0;
        }
        var activeIndex = 0;
        for(i=0; i<fullContext.length; i++) {
            if(activeDimensions[i]) {
                var dimensionName = this.dimensionsList[activeIndex];
                var contextValue = fullContext[i];
                if(Array.isArray(contextValue)) {
                    var newValue = [];
                    for(var k=0; k<contextValue.length; k++) {
                        var valueChunk = contextValue[k];
                        if(usedValues[dimensionName][valueChunk] === 2) {
                            newValue.push(this.valueToNumber[dimensionName][valueChunk]);
                        } else if(valueChunk === DEFAULT) {
                            newValue.push(0);
                        } else {
                            logBundleWarning(configIndex, 'invalid value ' + valueChunk + ' for dimension ' + dimensionName,
                                JSON.stringify(setting), this.logContext);
                        }
                    }
                    if(newValue.length === 0) {
                        return;
                    }
                    newContext[activeIndex] = newValue;
                } else {
                    if(usedValues[dimensionName][contextValue] === 2) {
                        newContext[activeIndex] = this.valueToNumber[dimensionName][contextValue];
                    } else if(contextValue !== DEFAULT) {
                        logBundleWarning(configIndex, 'invalid value ' + contextValue + ' for dimension ' + dimensionName,
                            JSON.stringify(setting), this.logContext);
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
     * @param root {object}
     * @param depth {number}
     * @param context {array}
     * @param delta {object}
     * @private
     */
    _buildTreeHelper: function(root, depth, context, delta) {
        var i;
        var currentValue = context[depth];
        var isMulti = Array.isArray(currentValue);
        if(depth === context.length-1) {
            if(isMulti) {
                for(i=0; i<currentValue.length; i++) {
                    var curDelta = delta;
                    if(root.has(currentValue[i])) {
                        curDelta = this._combineDeltas(delta, root.get(currentValue[i]));
                    }
                    root.set(currentValue[i], curDelta);
                }
            } else {
                curDelta = delta;
                if(root.has(currentValue)) {
                    curDelta = this._combineDeltas(delta, root.get(currentValue));
                }
                root.set(currentValue, curDelta);
            }
            return;
        }
        if(isMulti){
            for(i=0; i<currentValue.length; i++) {
                if(!root.has(currentValue[i])) {
                    root.set(currentValue[i], new Map());
                }
                this._buildTreeHelper(root.get(currentValue[i]), depth+1, context, delta);
            }
        } else {
            if(!root.has(currentValue)) {
                root.set(currentValue, new Map());
            }
            this._buildTreeHelper(root.get(currentValue), depth+1, context, delta);
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
     * @return {boolean}
     */
    _applySubstitutions: function (config, base, parent) {
        var key,
            sub,
            find,
            item;
        base = base || config;
        parent = parent || {ref: config, key: null};
        var subFlag = false;

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
        if(this.masterDelta && !callback({}, cloneDeep(this.masterDelta.subbed))) {
            return undefined;
        }
        this._walkSettingsHelper(this.tree, 0, [], callback, [false]);
    },

    /**
     * Recursive helper for walking the config tree.
     * @param cur {object}
     * @param depth {number}
     * @param context {array}
     * @param callback {function}
     * @param stop {array}
     * @private
     */
    _walkSettingsHelper: function(cur, depth, context, callback, stop) {
        if(stop[0]) {
            return true;
        }
        if(depth === this.dimensionsList.length) {
            stop[0] = !callback(this._contextToObject(context), cloneDeep(cur.subbed));
            return stop[0];
        }
        for(var [key, value] of  cur) {
            if(this._walkSettingsHelper(value, depth+1, context.concat(key), callback, stop)) {
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
    expirationKey: EXPIRATION_KEY,

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
        var opts = {
            validate: validate,
            debug: debug
        };
        var ycb = new Ycb(bundle, opts);
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
        var opts = { debug: debug };
        var ycb = new Ycb(bundle, opts);
        return ycb.readNoMerge(context, opts);
    }
};