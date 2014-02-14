/*
 * Copyright (c) 2011-2012, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*jslint node:true, nomen:true*/

var assert = require('assert');
var Ycb = require('../../').Ycb;
var dimensions = require('./dimensions');
var application = require('./application');

var data = dimensions.concat(application);

var ycb = new Ycb(data, {});

var config;

// read "master"
config = ycb.read({});
assert.equal(8666, config.appPort);

// read "environment:prod"
config = ycb.read({environment: 'prod'});
assert.equal(80, config.appPort);

// read "device:desktop"
config = ycb.read({device: 'desktop'});
assert.equal(8080, config.appPort);

//  read "environment:prod", "device:desktop"
config = ycb.read({environment: 'prod', device: 'smartphone'});
assert.equal(8888, config.appPort);
