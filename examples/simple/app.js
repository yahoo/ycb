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
assert.equal(8666, config.appPort);

// read "environment:prod"
config = ycb.read({ environment: 'prod' });
assert.equal(80, config.appPort);

// read "device:desktop"
config = ycb.read({ device: 'desktop' });
assert.equal(8080, config.appPort);

// read "environment:prod", "device:desktop"
config = ycb.read({ environment: 'prod', device: 'smartphone' });
assert.equal(8888, config.appPort);

