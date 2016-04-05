/*
 * Copyright (c) 2011-2012, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*jslint node:true, nomen:true*/

var libfs = require('fs'),
    libpath = require('path'),
    libycb = require('../../'),
    assert = require('assert'),
    data,
    ycb,
    config;

/**
@param {string} file JSON valid file representing a configuration
@return {object} the parsed version of `file`
**/
function readFile(file) {
    var raw = libfs.readFileSync(libpath.join(__dirname, file));
    return JSON.parse(raw);
}

data = readFile('dimensions.json').concat(readFile('application.json'));

// create a new Ycb instance with `data`
ycb = new libycb.Ycb(data, {});

// read "master"
config = ycb.read({});
assert.equal(8000, config.appPort);
assert.equal(false, config.viewEngine.cacheTemplates);
assert.equal(undefined, config.selector);


// read "device:opera-mini"
config = ycb.read({ device: 'opera-mini' });
assert.equal('opera-mini', config.selector);
assert.equal(8000, config.appPort);

// read "environment:development"
config = ycb.read({ environment: 'development' });
assert.equal(false, config.yui.config.combine);
assert.equal('debug', config.yui.config.logLevel);
assert.equal(false, config.yui.config.fetchCSS);

config = ycb.readNoMerge({ environment: 'development' }, {});
assert.equal(2, config.length);
