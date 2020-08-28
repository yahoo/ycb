/*
 * Copyright (c) 2011-2013, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*globals describe,it*/

var util = require('util');
var libpath = require('path');
var libfs = require('fs');
var libycb = require('../../index');
var assert = require('assert');

function readFixtureFile(file){
    var path = libpath.join(__dirname, '..', 'fixtures' , file);
    var data = libfs.readFileSync(path, 'utf8');
    return JSON.parse(data);
}

function cmp(x, y, msg) {
    var i;
    if (Array.isArray(x)) {
        Array.isArray(x, msg || 'first arg should be an array');
        Array.isArray(y, msg || 'second arg should be an array');
        assert.equal(x.length, y.length, msg || 'arrays are different lengths');
        for (i = 0; i < x.length; i += 1) {
            cmp(x[i], y[i], msg);
        }
        return;
    }
    if (typeof x === 'object' && x !== null) {
        assert(typeof x === 'object', msg || 'first arg should be an object');
        assert(typeof y === 'object', msg || 'second arg should be an object');
        assert.equal(Object.keys(x).length, Object.keys(y).length, msg || 'object keys are different lengths');
        for (i in x) {
            if (x.hasOwnProperty(i)) {
                cmp(x[i], y[i], msg);
            }
        }
        return;
    }
    assert.equal(x, y, msg || 'args should be the same');
}


describe('ycb unit tests', function () {
    it('should be able to be used as a module', function() {
        assert(libycb.version === '1.0.2');
    });

    describe('_parseContext', function () {
        it('context objects should be parsed', function () {
            var bundle, ycb;
            bundle = readFixtureFile('dimensions.json')
                .concat(readFixtureFile('simple-1.json'))
                .concat(readFixtureFile('simple-3.json'));
            ycb = new libycb.Ycb(bundle);
            cmp([0,0,0], ycb._parseContext({}));
            cmp([0,4,0], ycb._parseContext({region:'fr'}));
            cmp([0,3,6], ycb._parseContext({flavor:'bt', region:'ir'}));
            cmp([1,4,5], ycb._parseContext({lang:'fr_FR', region:'fr', flavor:'att'}));
        });
        it('should handle an undefined context value', function () {
            var bundle, ycb;
            bundle = readFixtureFile('dimensions.json')
                .concat(readFixtureFile('simple-1.json'))
                .concat(readFixtureFile('simple-3.json'));
            ycb = new libycb.Ycb(bundle);
            cmp([0, 0, 0], ycb._parseContext({ region: undefined }));
        });
    });

    describe('_processRawBundle', function () {
        it('should set up settings and dimensions', function () {
            var bundle, ycb;
            bundle = readFixtureFile('dimensions.json')
                .concat(readFixtureFile('simple-1.json')[0]);
            ycb = new libycb.Ycb(bundle);

            assert.equal('YRB_YAHOO', ycb.read({}).title_key);
            assert(undefined !== ycb.dimensions[7].region.us);
        });

        it('should handle dupe error', function () {
            var bundle, ycb;
            bundle = readFixtureFile('dimensions.json')
                .concat(readFixtureFile('simple-1.json'))
                .concat(readFixtureFile('simple-2.json'));
            ycb = new libycb.Ycb(bundle);

            assert.equal('YRB_YAHOO_2nd', ycb.read({}).title_key);
            assert.equal('yahoo.png', ycb.read({}).logo1);
            assert(undefined !== ycb.dimensions[7].region.us);
        });

        it('should handle many settings', function () {
            var bundle, ycb;
            bundle = readFixtureFile('dimensions.json')
                .concat(readFixtureFile('simple-1.json'))
                .concat(readFixtureFile('simple-3.json'));
            ycb = new libycb.Ycb(bundle);

            assert.equal('YRB_YAHOO', ycb.read({}).title_key);
            assert.equal('http://fr.yahoo.com', ycb.read({region:'fr'}).links.home);
            assert.equal('yahoo_bt_FR.png', ycb.read({region:'fr', flavor:'bt'}).logo);
            assert(undefined !== ycb.dimensions[7].region.us);
        });

        it('should not break if there are bad configs', function () {
            var bundle, ycb;
            bundle = readFixtureFile('dimensions.json')
                .concat(readFixtureFile('simple-1.json'))
                .concat(readFixtureFile('bad-configs.json'))
                .concat(readFixtureFile('simple-3.json'));
            var logHistory = [];
            var oldLog = console.log;
            console.log = function(...args) {
                logHistory.push(util.format(...args));
            }
            ycb = new libycb.Ycb(bundle);
            console.log = oldLog;
            assert.equal(logHistory[0], 'WARNING: config[2] has non-object config. []','warning log should match');
            assert.equal(logHistory[1], 'WARNING: config[3] has non-object config. null', 'warning log should match');
            assert.equal(logHistory[2], 'WARNING: config[4] has non-object config. true', 'warning log should match');
            assert.equal(logHistory[3], 'WARNING: config[5] has no valid settings field. {}', 'warning log should match');
            assert.equal(logHistory[4], 'WARNING: config[6] has no valid settings field. {"foo":"bar"}', 'warning log should match');
            assert.equal(logHistory[5], 'WARNING: config[7] has empty config. ["environment:production"]', 'warning log should match');
            assert.equal(logHistory[6], 'WARNING: config[8] has no valid settings field. {"settings":null}', 'warning log should match');
            assert.equal(logHistory[7], 'WARNING: config[9] has empty settings array.', 'warning log should match');
            assert.equal(logHistory[8], 'WARNING: config[10] has master setting with additional dimensions. ["master","lang:fr"]', 'warning log should match');
            assert.equal(logHistory[9], 'WARNING: config[11] has invalid setting master. ["lang:fr","master"]', 'warning log should match');
            assert.equal(logHistory[10], 'WARNING: config[13] has invalid dimension blah. ["blah:fr"]', 'warning log should match');
            assert.equal(logHistory[11], 'WARNING: config[14] has empty config. ["master"]', 'warning log should match');
            assert.equal(logHistory[12], 'WARNING: config[14] has empty schedule. {"dimensions":["master"],"schedule":{}}', 'warning log should match');
            assert.equal(logHistory[13], 'WARNING: config[15] has empty config. ["master"]', 'warning log should match');
            assert.equal(logHistory[14], 'WARNING: config[15] has invalid start date. {"start":"bad"}', 'warning log should match');
            assert.equal(logHistory[15], 'WARNING: config[16] has empty config. ["master"]', 'warning log should match');
            assert.equal(logHistory[16], 'WARNING: config[16] has invalid end date. {"end":"bad"}', 'warning log should match');
            assert.equal(logHistory[17], 'WARNING: config[12] has invalid value barbar for dimension lang. {"dimensions":["lang:barbar"]}', 'warning log should match');

            var count = 0;
            ycb.walkSettings(function() {
                count++;
                return true;
            });
            assert.equal(count, 10, 'the valid empty config should be included');
        });

        it('should add the logging context', function () {
            var bundle, ycb;
            bundle = readFixtureFile('dimensions.json')
                .concat(readFixtureFile('simple-1.json'))
                .concat(readFixtureFile('bad-configs.json'))
                .concat(readFixtureFile('simple-3.json'));
            var logHistory = [];
            var oldLog = console.log;
            console.log = function(...args) {
                logHistory.push(util.format(...args));
            }
            ycb = new libycb.Ycb(bundle, {logContext: '/bundle-path.json'});
            console.log = oldLog;
            assert.equal(logHistory[0], 'WARNING: config[2] has non-object config. [] source=/bundle-path.json','warning log should match');
            assert.equal(logHistory[1], 'WARNING: config[3] has non-object config. null source=/bundle-path.json', 'warning log should match');
            assert.equal(logHistory[2], 'WARNING: config[4] has non-object config. true source=/bundle-path.json', 'warning log should match');
            assert.equal(logHistory[3], 'WARNING: config[5] has no valid settings field. {} source=/bundle-path.json', 'warning log should match');
            assert.equal(logHistory[4], 'WARNING: config[6] has no valid settings field. {"foo":"bar"} source=/bundle-path.json', 'warning log should match');
            assert.equal(logHistory[5], 'WARNING: config[7] has empty config. ["environment:production"] source=/bundle-path.json', 'warning log should match');
            assert.equal(logHistory[6], 'WARNING: config[8] has no valid settings field. {"settings":null} source=/bundle-path.json', 'warning log should match');
            assert.equal(logHistory[7], 'WARNING: config[9] has empty settings array. source=/bundle-path.json', 'warning log should match');
            assert.equal(logHistory[8], 'WARNING: config[10] has master setting with additional dimensions. ["master","lang:fr"] source=/bundle-path.json', 'warning log should match');
            assert.equal(logHistory[9], 'WARNING: config[11] has invalid setting master. ["lang:fr","master"] source=/bundle-path.json', 'warning log should match');
            assert.equal(logHistory[10], 'WARNING: config[13] has invalid dimension blah. ["blah:fr"] source=/bundle-path.json', 'warning log should match');
            assert.equal(logHistory[11], 'WARNING: config[14] has empty config. ["master"] source=/bundle-path.json', 'warning log should match');
            assert.equal(logHistory[12], 'WARNING: config[14] has empty schedule. {"dimensions":["master"],"schedule":{}} source=/bundle-path.json', 'warning log should match');
            assert.equal(logHistory[13], 'WARNING: config[15] has empty config. ["master"] source=/bundle-path.json', 'warning log should match');
            assert.equal(logHistory[14], 'WARNING: config[15] has invalid start date. {"start":"bad"} source=/bundle-path.json', 'warning log should match');
            assert.equal(logHistory[15], 'WARNING: config[16] has empty config. ["master"] source=/bundle-path.json', 'warning log should match');
            assert.equal(logHistory[16], 'WARNING: config[16] has invalid end date. {"end":"bad"} source=/bundle-path.json', 'warning log should match');
            assert.equal(logHistory[17], 'WARNING: config[12] has invalid value barbar for dimension lang. {"dimensions":["lang:barbar"]} source=/bundle-path.json', 'warning log should match');

            var count = 0;
            ycb.walkSettings(function() {
                count++;
                return true;
            });
            assert.equal(count, 10, 'the valid empty config should be included');
        });

        it('should not break if there are no dimensions', function () {
            var bundle, ycb;
            bundle = readFixtureFile('simple-1.json')
                .concat(readFixtureFile('simple-3.json'));
            ycb = new libycb.Ycb(bundle);

            assert.equal('http://www.yahoo.com', ycb.read({region:'fr'}).links.home);
        });
    });

    describe('_combineDeltas', function () {
        it('should not duplicate references', function () {
            var ycb = new libycb.Ycb({});
            var delta1 = ycb._buildDelta({foo:'bar'});
            var delta2 = ycb._buildDelta({a:'b'});
            var combined = ycb._combineDeltas(delta1, delta2);
            assert.equal(combined.subbed, combined.unsubbed);
        });
        it('should handle combining with scheduled config', function () {
            var ycb = new libycb.Ycb({});
            var delta = ycb._buildDelta({foo:'bar'});
            var scheduledDelta = ycb._buildDelta({'a':1}, {start:10, end:11000});
            var combined = ycb._combineDeltas(delta, scheduledDelta);
            assert.equal(scheduledDelta.schedules, combined.schedules);
            assert.equal(delta.subbed, combined.subbed);
            assert.equal(combined.subbed, combined.unsubbed);
        });
        it('should handle combining schedules', function () {
            var ycb = new libycb.Ycb({});
            var delta1 = ycb._buildDelta({'a':1}, {start:10, end:11000});
            var delta2 = ycb._buildDelta({'b':2}, {start:50, end:999});
            var combined = ycb._combineDeltas(delta1, delta2);
            cmp([10,50], combined.schedules.starts);
            cmp([11000,999], combined.schedules.ends);
            assert.equal(combined.schedules.subbed[0], combined.schedules.unsubbed[0]);
            assert.equal(undefined, combined.subbed);
        });
        it('should handle combining mixed deltas', function () {
            var ycb = new libycb.Ycb({});
            var delta1 = ycb._combineDeltas(ycb._buildDelta({'a':1}, {start:10, end:1100}),ycb._buildDelta({a:'b'}));
            var delta2 = ycb._combineDeltas(ycb._buildDelta({'a':1}, {start:5, end:2000}),ycb._buildDelta({c:'d'}));
            var combined = ycb._combineDeltas(delta1, delta2);
            assert.equal(combined.subbed, combined.unsubbed);
            cmp({a:'b',c:'d'}, combined.subbed);
            cmp([5,10], combined.schedules.starts);
            cmp([2000,1100], combined.schedules.ends);
        });
        it('should handle subs', function () {
            var ycb = new libycb.Ycb({});
            var delta1 = ycb._buildDelta({a: '!',b: '$$a$$'});
            var delta2 = ycb._buildDelta({c:'c'});
            var combined = ycb._combineDeltas(delta1, delta2);
            cmp({c:'c',a:'!',b:'!'}, combined.subbed);
            cmp({c:'c',a:'!',b:'$$a$$'}, combined.unsubbed);
            assert.equal(false, combined.subbed === combined.unsubbed);
        });
        it('should handle scheduled subs', function () {
            var ycb = new libycb.Ycb({});
            var delta1 = ycb._buildDelta({a: '!',b: '$$a$$'}, {start:10, end:1100});
            var delta2 = ycb._buildDelta({c:'c'});
            var combined = ycb._combineDeltas(delta1, delta2);
            cmp({a:'!',b:'!'}, combined.schedules.subbed[0]);
            cmp({a:'!',b:'$$a$$'}, combined.schedules.unsubbed[0]);
        });
    });

    describe('_applySubstitutions', function () {
        it('should substitute keys', function () {
            var config, ycb;
            config = readFixtureFile('substitutions.json');
            ycb = new libycb.Ycb([]);
            var subFlag = ycb._applySubstitutions(config);

            assert(subFlag);
            assert(config.key0.key4 === 'The value of key0.key2 is value2');
            assert(config.key5.key4 === 'The value of key0.key2 is value2');
            assert(config.key6.key7.key8.key4 === 'The value of key0.key2 is value2');
            assert(config.key6.key9[2] === 'The value of key0.key2 is value2');
            assert(config['$$key0.key1$$'] === '--YCB-SUBSTITUTION-ERROR--');
            assert(config.key10.key11.key4 === 'The value of key0.key2 is value2');
            assert(config.key11[4] === 'The value of key0.key2 is value2');
            assert(config.key8.key4 === 'The value of key0.key2 is value2');
        });

        it('should substitute correctly against subs-expected', function () {
            var config = require('./../fixtures/substitutions.json'),
                expected = require('./../fixtures/subs-expected.json'),
                ycb;

            ycb = new libycb.Ycb([]);
            ycb._applySubstitutions(config);
            cmp(config, expected);
        });

        it('should substitute values', function () {
            var ycb = new libycb.Ycb([]),
                config,
                expected;

            config = {
                key0: {
                    key1: 'value1',
                    key2: 'value2',
                    key3: '$$key0.key1$$',
                    key4: 'values of keys 1-3: $$key0.key1$$, $$key0.key2$$, $$key0.key3$$'
                }
            };

            expected = {
                key0: {
                    key1: 'value1',
                    key2: 'value2',
                    key3: 'value1',
                    key4: 'values of keys 1-3: value1, value2, value1'
                }
            };

            ycb._applySubstitutions(config);
            cmp(config, expected);
        });

        it('should handle empty strings', function () {
            var ycb = new libycb.Ycb([]),
                config,
                expected;

            config = {
                key0: {
                    key1: 'value1',
                    key2: '',
                    key3: '$$key0.key1$$',
                    key4: '$$key0.key2$$$$key0.key2$$',
                    key5: 'values of keys 1-4: $$key0.key1$$, $$key0.key2$$, $$key0.key3$$, $$key0.key2$$$$key0.key2$$'
                }
            };

            expected = {
                key0: {
                    key1: 'value1',
                    key2: '',
                    key3: 'value1',
                    key4: '',
                    key5: 'values of keys 1-4: value1, , value1, '
                }
            };

            ycb._applySubstitutions(config);
            cmp(config, expected);
        });
    });

    describe('read', function () {
        it('should correctly read simple config with no dimensions', function () {
            var bundle, config;
            bundle = readFixtureFile('simple-1.json');
            config = libycb.read(bundle);

            assert.equal('YRB_YAHOO', config.title_key);
            assert.equal('http://www.yahoo.com', config.links.home);
            assert.equal('http://mail.yahoo.com', config.links.mail);
            assert(undefined === config.__ycb_source__);
        });

        it('should correctly read simple config with dimensions', function () {
            var bundle, config;
            bundle = readFixtureFile('dimensions.json')
                .concat(readFixtureFile('simple-1.json'));
            config = libycb.read(bundle);

            assert.equal('YRB_YAHOO', config.title_key);
            assert.equal('http://www.yahoo.com', config.links.home);
            assert.equal('http://mail.yahoo.com', config.links.mail);
        });

        it('should correctly read simple config with dimensions and extra settings', function () {
            var bundle, config;
            bundle = readFixtureFile('dimensions.json')
                .concat(readFixtureFile('simple-1.json'))
                .concat(readFixtureFile('simple-3.json'));
            config = libycb.read(bundle);

            assert.equal('YRB_YAHOO', config.title_key);
            assert.equal('http://www.yahoo.com', config.links.home);
            assert.equal('http://mail.yahoo.com', config.links.mail);
        });

        it('should correctly read simple config with dimensions and context IR', function () {
            var bundle, context, config;
            bundle = readFixtureFile('dimensions.json')
                .concat(readFixtureFile('simple-1.json'))
                .concat(readFixtureFile('simple-3.json'));
            context = {
                'region': 'ir',
                'environment': 'preproduction',
                'lang': 'fr_FR'
            };
            config = libycb.read(bundle, context);
            assert.equal('YRB_YAHOO', config.title_key);
            assert.equal('yahoo_FR.png', config.logo);
            assert.equal('http://gb.yahoo.com', config.links.home);
            assert.equal('http://gb.mail.yahoo.com', config.links.mail);
        });

        it('should correctly read simple config with dimensions and context FR', function () {
            var bundle, context, config;
            bundle = readFixtureFile('dimensions.json')
                .concat(readFixtureFile('simple-1.json'))
                .concat(readFixtureFile('simple-3.json'));
            context = {
                'region': 'fr',
                'environment': 'preproduction',
                'lang': 'fr_FR'
            };
            config = libycb.read(bundle, context);

            assert.equal('YRB_YAHOO', config.title_key);
            assert.equal('yahoo_FR.png', config.logo);
            assert.equal('http://fr.yahoo.com', config.links.home);
            assert.equal('http://fr.mail.yahoo.com', config.links.mail);
        });

        it('should correctly read simple config with dimensions and context GB & BT', function () {
            var bundle, context, config;
            bundle = readFixtureFile('dimensions.json')
                .concat(readFixtureFile('simple-1.json'))
                .concat(readFixtureFile('simple-3.json'));
            context = {
                'region': 'gb',
                'environment': 'preproduction',
                'flavor': 'bt'
            };
            config = libycb.read(bundle, context);

            assert.equal('YRB_YAHOO', config.title_key);
            assert.equal('yahoo_bt_GB.png', config.logo);
            assert.equal('http://gb.yahoo.com', config.links.home);
            assert.equal('http://gb.mail.yahoo.com', config.links.mail);
        });

        it('should accept falsey config values', function () {
            var bundle,
                config,
                foo = {
                    settings: [ 'master' ],
                    title_key: 'YRB_YAHOO',
                    'data-url': 'http://service.yahoo.com',
                    logo: 'yahoo.png',
                    false_ok: false,
                    zero: 0,
                    undef: undefined,
                    links: { home: 'http://www.yahoo.com', mail: 'http://mail.yahoo.com' }
                };

            bundle = readFixtureFile('dimensions.json').concat([foo]);
            config = libycb.read(bundle);

            assert.equal(config['data-url'], foo['data-url']);
            assert('false_ok' in config);
            assert.equal(config.false_ok, foo.false_ok);
            assert('undef' in config);
            assert.equal(config.undef, foo.undef);
            assert('zero' in config);
            assert.equal(config.zero, foo.zero);
        });

        it('should merge matched settings', function () {
            var bundle,
                ycb;

            bundle = readFixtureFile('dimensions.json')
                .concat(readFixtureFile('simple-4.json'));
            ycb = new libycb.Ycb(bundle);
            var config = ycb.read({
                'lang': 'fr'
            });
            assert.deepEqual({
                foo: 1,
                bar: 2,
                baz: 3,
                oof: null,
                rab: 0,
                zab: false
            }, config);

            config = ycb.read({
                'lang': 'es'
            });
            assert.deepEqual({
                foo: 1,
                bar: 2,
                baz: 3,
                oof: null,
                rab: 0,
                zab: false
            }, config);

            config = ycb.read({
                'lang': ['es', 'fr']
            });
            assert.deepEqual({
                foo: 1,
                bar: 2,
                baz: 3,
                oof: null,
                rab: 0,
                zab: false
            }, config);
        });

        it('should not merge matched settings', function () {
            var bundle,
                ycb;

            bundle = readFixtureFile('dimensions.json')
                .concat(readFixtureFile('overridden-multisetting.json'));
            ycb = new libycb.Ycb(bundle);
            var config = ycb.read({
                'lang': 'fr'
            });
            assert.equal(config.foo, 1, 'fr should be 1');

            config = ycb.read({
                'lang': 'es'
            });
            assert.equal(config.foo, 3, 'es should be 3');

            config = ycb.read({
                'lang': ['es', 'fr']
            });
            assert.equal(config.foo, 3, '[es,fr] should be 3');

            config = ycb.read({
                'lang': ['fr', 'es']
            });
            assert.equal(config.foo, 1, '[fr,es] should be 1');
        });

        it('should not pollute master settings with dimension values', function () {
            var bundle,
                ycb,
                config;

            bundle = readFixtureFile('dimensions.json');
            bundle.push({
                settings: ['master'],
                appPort: 80
            });
            bundle.push({
                settings: ['environment:lkjsdflksdhlskdfs'],
                appPort: 81
            });
            ycb = new libycb.Ycb(bundle);
            config = ycb.read({});
            assert.equal(80, config.appPort);
        });

        it('should ignore unknown dimensions', function () {
            var bundle,
                ycb,
                config;

            bundle = readFixtureFile('dimensions-other.json');
            bundle.push({
                settings: ['master'],
                appPort: 80
            });
            bundle.push({
                settings: ['unknown:value'],
                appPort: 81
            });
            ycb = new libycb.Ycb(bundle);
            config = ycb.read({ environment: 'desktop'});
            assert.equal(80, config.appPort);
        });

        it('should handle wildcard settings', function () {
            var bundle,
                ycb,
                config;
            bundle = readFixtureFile('wildcard.json');
            ycb = new libycb.Ycb(bundle);
            config = ycb.read({});
            cmp(config, {val1:1, val5:1});
            config = ycb.read({region: 'fr'});
            cmp(config, {val1:1, val5:1, val2:1, val4:1});
            config = ycb.read({region: 'fr', flavor: 'att'});
            cmp(config, {val1:1, val5:1, val2:1, val4:1, val3:1});
        });

        it('should handle multi-level matching', function () {
            var bundle,
                ycb,
                config;

            bundle = readFixtureFile('dimensions-other.json');
            bundle = bundle.concat([
                {
                    'settings': [ 'master' ],
                    'appPort': 8666
                },
                {
                    'settings': [ 'environment:prod' ],
                    'appPort': 80
                },
                {
                    'settings': [ 'environment:prod', 'device:smartphone' ],
                    'appPort': 8888
                },
                {
                    'settings': [ 'environment:prod', 'device:desktop' ],
                    'appPort': 8080
                }
            ]);
            ycb = new libycb.Ycb(bundle);
            config = ycb.read({});
            assert.equal(8666, config.appPort);
            config = ycb.read({
                environment: 'prod',
                device: 'smartphone'
            });
            assert.equal(8888, config.appPort);
            config = ycb.read({
                environment: 'prod',
                device: 'desktop'
            });
            assert.equal(8080, config.appPort);
            config = ycb.read({
                environment: 'prod'
            });
            assert.equal(80, config.appPort);
        });

        it('should do substitutions by default', function () {
            var bundle, config, expected;
            bundle = readFixtureFile('substitutions.json');
            bundle.settings = ['master'];
            bundle = [bundle];
            bundle = readFixtureFile('dimensions.json').concat(bundle);

            config = (new libycb.Ycb(bundle)).read(bundle, {
                applySubstitutions: true
            });
            expected = readFixtureFile('subs-expected.json');
            cmp(config, expected);
        });

        it('should not do substitutions if applySubstitutions=false', function () {
            var bundle, config, expected;
            bundle = readFixtureFile('substitutions.json');
            bundle.settings = ['master'];
            bundle = [bundle];
            bundle = readFixtureFile('dimensions.json').concat(bundle);

            config = (new libycb.Ycb(bundle)).read(bundle, {
                applySubstitutions: false
            });
            expected = readFixtureFile('substitutions.json');

            cmp(config, expected);
        });

        it('should handle multi-value dimensions', function () {
            var ycb, bundle, config;
            bundle = readFixtureFile('buckets.json');
            bundle.settings = ['master'];
            bundle = readFixtureFile('dimensions.json').concat(bundle);
            ycb = new libycb.Ycb(bundle);

            config = ycb.read({});
            assert.deepEqual(config, {
                enableFeatureA: false,
                enableFeatureB: false
            });

            config = ycb.read({
                bucket: '101'
            });
            assert.deepEqual(config, {
                enableFeatureA: true,
                enableFeatureB: false
            });

            config = ycb.read({
                bucket: '201'
            });
            assert.deepEqual(config, {
                enableFeatureA: false,
                enableFeatureB: true
            });

            config = ycb.read({
                bucket: ['101', '201']
            });
            assert.deepEqual(config, {
                enableFeatureA: true,
                enableFeatureB: true
            });
        });
    });

    describe('getDimensions', function () {
        it('should return the bundle dimensions', function () {
            var bundle, ycb;
            bundle = readFixtureFile('dimensions.json');
            ycb = new libycb.Ycb(bundle, true);
            cmp(bundle[0].dimensions, ycb.getDimensions());
        });
    });

    describe('walkSettings', function () {
        it('should walk each setting', function () {
            var bundle, ycb;
            bundle = readFixtureFile('dimensions.json')
                .concat(readFixtureFile('simple-1.json'))
                .concat(readFixtureFile('simple-3.json'));
            ycb = new libycb.Ycb(bundle);
            var ctxs = {};
            ycb.walkSettings(function(settings, config) {
                ctxs[JSON.stringify(settings)] = config;
                return true;
            });
            bundle.forEach((config) => {
                delete config.settings;
            });
            assert.equal(9, Object.keys(ctxs).length);
            cmp(ctxs['{}'], bundle[1], 'walked config does not match');
            cmp(ctxs[JSON.stringify({lang:'fr'})], bundle[4], 'walked config does not match');
            assert(ctxs[JSON.stringify({region:'ca'})]);
            assert(ctxs[JSON.stringify({region:'gb'})]);
            assert(ctxs[JSON.stringify({region:'fr'})]);
            assert(ctxs[JSON.stringify({flavor:'att'})]);
            assert(ctxs[JSON.stringify({region:'ca',flavor:'att'})]);
            assert(ctxs[JSON.stringify({region:'gb',flavor:'bt'})]);
            assert(ctxs[JSON.stringify({region:'fr',flavor:'bt'})]);
        });
    });

    describe('getCacheKey', function () {
        function cacheKeyChecker(ycb, set) {
            var expectedKey = set.expect;
            set.contexts.forEach((context) => {
                assert.equal(expectedKey, ycb.getCacheKey(context));
            })
        }
        it('should map equivalent contexts to same key', function () {
            var bundle;
            bundle = readFixtureFile('dimensions.json')
                .concat(readFixtureFile('simple-1.json'))
                .concat(readFixtureFile('simple-3.json'));
            var ycb = new libycb.Ycb(bundle, {});
            cacheKeyChecker(ycb, {expect:'[0,0,0]', contexts: [{}, {lang:'en'}, {region:'xanadu'}, {bucket:'101'}]});
            cacheKeyChecker(ycb, {expect:'[0,4,0]', contexts: [{region:'fr'},{region:'fr', bucket:'101'}]});
            cacheKeyChecker(ycb, {expect:'[0,3,0]', contexts: [{region:'gb'}, {region: 'ir'}]});
            cacheKeyChecker(ycb, {expect:'[1,0,0]', contexts: [{lang:'fr'}, {lang:'fr_FR'}, {lang:'fr_CA'}]});
        });
    });

    describe('generatedReadTest', function () {
        it('should match old output', function () {
            var bundle, ycb;
            bundle = readFixtureFile('large-bundle.json');
            ycb = new libycb.Ycb(bundle);
            var tests = readFixtureFile('generated-reads.json');
            for(var i=0; i<tests.length; i++) {
                var test = tests[i];
                var merged = ycb.read(test.ctx, {});
                var unmerged = ycb.readNoMerge(test.ctx, {});
                cmp(merged, test.merged, 'Merged config does not match expected for config ' + i);
                cmp(unmerged, test.unmerged, 'Unmerged config does not match expected for config ' + i);
            }
        });
    });

    //get applicable intervals and next change time
    function intervalHelper(intervals, time) {
        var applicable = [];
        var next = Number.POSITIVE_INFINITY;
        for(var i=0; i<intervals.length; i++) {
            var interval = intervals[i];
            var valid = true;
            if(interval.start) {
                valid = valid && interval.start <= time;
                if(interval.start > time && interval.start < next) {
                    next = interval.start;
                }
            }
            if(interval.end) {
                valid = valid && interval.end >= time;
                if(valid && interval.end < next) {
                    next = interval.end+1;
                }
            }
            if(valid) {
                applicable.push(interval.name);
            }
        }
        next = next === Number.POSITIVE_INFINITY ? undefined : next;
        return {configs: applicable, next: next};
    }

    describe('timeReadTest', function () {
        it('scheduled configs should match timestamp', function () {
            var bundle, ycb;
            bundle = readFixtureFile('time-test.json');
            var intervals = [];
            var minTime = Number.POSITIVE_INFINITY;
            var maxTime = 0;
            bundle.forEach((config) => {
                if(config.settings) {
                    var name = config.name;
                    var interval = config.intervals[name];
                    if(interval.start || interval.end) {
                        if(interval.start && interval.start < minTime) {
                            minTime = interval.start;
                        }
                        if(interval.end && interval.end > maxTime) {
                            maxTime = interval.end;
                        }
                        interval = {start: interval.start, end: interval.end, name:name};
                        intervals.push(interval);
                    }
                }
            });
            var context = {environment: 'prod', device: 'smartphone'};
            ycb = new libycb.Ycb(bundle, {});
            for(var t=minTime-2; t<maxTime+2; t++) {
                var ret = intervalHelper(intervals, t);
                var valid = ret.configs;
                var next = ret.next;
                var config = ycb.readTimeAware(context, t, {cacheInfo:true});
                var unmerged = ycb.readNoMergeTimeAware(context, t, {cacheInfo:true});
                assert(Object.keys(config.intervals).length === valid.length, 'Number of valid configs should be equal');
                assert(unmerged.length === valid.length, 'Number of unmerged configs should be equal');
                valid.forEach((name) => {
                    assert(config.intervals[name] !== undefined, 'Config ' + name + ' should be valid');
                });
                assert(next === config[libycb.expirationKey], t + ' Config cache info should give next change time');
                if(next) {
                    assert(next === unmerged[0][libycb.expirationKey], t + ' Unmerged cache info should give next change time');
                }
            }
        });
    });
});
