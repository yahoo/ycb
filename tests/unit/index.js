/*
 * Copyright (c) 2011-2013, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*globals describe,it*/

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

    describe('_calculateHierarchy', function () {
        it('should generate lookup paths', function () {
            var dims = readFixtureFile('dimensions.json'),
                ycb = new libycb.Ycb(dims),
                flat = ycb._calculateHierarchy(['*'], dims[0].dimensions[6].lang);

            assert.deepEqual(['en', '*'], flat.en);
            assert.deepEqual(['en_CA', 'en', '*'], flat.en_CA);
            assert.deepEqual(['fr', '*'], flat.fr);
            assert.deepEqual(['fr_CA', 'fr_FR', 'fr', '*'], flat.fr_CA);
        });
    });

    describe('_calculateHierarchies', function () {
        it('should generate lookup paths', function () {
            var dims = readFixtureFile('dimensions.json'),
                ycb = new libycb.Ycb(dims),
                flat = ycb._dimensionHierarchies;


            assert.deepEqual(['en', '*'], flat.lang.en);
            assert.deepEqual(['en_CA', 'en', '*'], flat.lang.en_CA);
            assert.deepEqual(['fr', '*'], flat.lang.fr);
            assert.deepEqual(['fr_CA', 'fr_FR', 'fr', '*'], flat.lang.fr_CA);
        });
    });

    describe('_makeOrderedLookupList', function () {
        it('should generate the lookup list', function () {
            var dims = readFixtureFile('dimensions.json'),
                ycb = new libycb.Ycb(dims),
                context, list;
            context = {
                'region': 'ir',
                'environment': 'preproduction',
                'lang': 'fr_CA'
            };
            list = ycb._makeOrderedLookupList(context, {useAllDimensions: true});
            assert.deepEqual([
                'preproduction',
                '*'
            ], list.environment);
            assert.deepEqual([
                'fr_CA',
                'fr_FR',
                'fr',
                '*'
            ], list.lang);
            assert.deepEqual([
                'ir',
                'gb',
                '*'
            ], list.region);
        });
        it('should generate the lookup list for multi-value dimensions', function () {
            var dims = readFixtureFile('dimensions.json'),
                ycb = new libycb.Ycb(dims),
                context, list;
            context = {
                'bucket': ['101', '201']
            };
            list = ycb._makeOrderedLookupList(context, {useAllDimensions: true});
            assert.deepEqual([
                '101',
                '1xx',
                '201',
                '2xx',
                '*'
            ], list.bucket);
        });
    });

    describe('_getLookupPath', function () {
        it('should generate the look up path for the section', function () {
            var dims = readFixtureFile('dimensions.json'),
                ycb = new libycb.Ycb(dims),
                context, path;
            context = {
                'region': 'ir',
                'environment': 'preproduction',
                'lang': 'fr_FR'
            };
            path = ycb._getLookupPath(context, {useAllDimensions: true});

            assert.equal('preproduction/*/*/*/*/*/fr_FR/ir/*/*/*', path);
        });
    });

    describe('_getLookupPaths', function () {
        it('should generate the full list of lookup paths', function () {
            var dims = readFixtureFile('dimensions.json'),
                ycb = new libycb.Ycb(dims),
                context, paths, expected;
            context = {
                'region': 'ir',
                'environment': 'preproduction',
                'lang': 'fr_FR'
            };
            paths = ycb._getLookupPaths(context, {useAllDimensions: true});

            expected = [
                '*/*/*/*/*/*/*/*/*/*/*',
                '*/*/*/*/*/*/*/gb/*/*/*',
                '*/*/*/*/*/*/*/ir/*/*/*',
                '*/*/*/*/*/*/fr/*/*/*/*',
                '*/*/*/*/*/*/fr/gb/*/*/*',
                '*/*/*/*/*/*/fr/ir/*/*/*',
                '*/*/*/*/*/*/fr_FR/*/*/*/*',
                '*/*/*/*/*/*/fr_FR/gb/*/*/*',
                '*/*/*/*/*/*/fr_FR/ir/*/*/*',
                'preproduction/*/*/*/*/*/*/*/*/*/*',
                'preproduction/*/*/*/*/*/*/gb/*/*/*',
                'preproduction/*/*/*/*/*/*/ir/*/*/*',
                'preproduction/*/*/*/*/*/fr/*/*/*/*',
                'preproduction/*/*/*/*/*/fr/gb/*/*/*',
                'preproduction/*/*/*/*/*/fr/ir/*/*/*',
                'preproduction/*/*/*/*/*/fr_FR/*/*/*/*',
                'preproduction/*/*/*/*/*/fr_FR/gb/*/*/*',
                'preproduction/*/*/*/*/*/fr_FR/ir/*/*/*'
            ];
            assert.deepEqual(expected, paths);
        });

        it('should skip unused dimensions', function () {
            var bundle, ycb;
            bundle = readFixtureFile('dimensions.json')
                .concat(readFixtureFile('simple-1.json'))
                .concat(readFixtureFile('simple-3.json'));
            ycb = new libycb.Ycb(bundle);

            assert.equal(3, Object.keys(ycb.dimsUsed).length);
            assert(undefined !==  ycb.dimsUsed.region);
            assert.equal(4, Object.keys(ycb.dimsUsed.region).length);
            assert(ycb.dimsUsed.region.ca);
            assert(ycb.dimsUsed.region.gb);
            assert(ycb.dimsUsed.region.fr);
            assert(ycb.dimsUsed.region.ir);
            assert.equal(3, Object.keys(ycb.dimsUsed.lang).length);
            assert(ycb.dimsUsed.lang.fr);
            assert(ycb.dimsUsed.lang.fr_FR);
            assert(ycb.dimsUsed.lang.fr_CA);
            assert.equal(2, Object.keys(ycb.dimsUsed.flavor).length);
            assert(ycb.dimsUsed.flavor.att);
            assert(ycb.dimsUsed.flavor.bt);

            var context = {
                'region': 'ir',
                'environment': 'preproduction',
                'lang': 'fr_FR'
            };
            var paths = ycb._getLookupPaths(context, {});
            var expected = [
                '*/*/*/*/*/*/*/*/*/*/*',
                '*/*/*/*/*/*/*/gb/*/*/*',
                '*/*/*/*/*/*/*/ir/*/*/*',
                '*/*/*/*/*/*/fr/*/*/*/*',
                '*/*/*/*/*/*/fr/gb/*/*/*',
                '*/*/*/*/*/*/fr/ir/*/*/*',
                '*/*/*/*/*/*/fr_FR/*/*/*/*',
                '*/*/*/*/*/*/fr_FR/gb/*/*/*',
                '*/*/*/*/*/*/fr_FR/ir/*/*/*'
            ];
            assert.deepEqual(expected, paths);
        });
        it('should handle multi-value dimensions', function () {
            var dims = readFixtureFile('dimensions.json'),
                ycb = new libycb.Ycb(dims),
                context, paths, expected;
            context = {
                'bucket': ['101', '201']
            };
            paths = ycb._getLookupPaths(context, {useAllDimensions: true});

            expected = [
                '*/*/*/*/*/*/*/*/*/*/*',
                '*/*/*/*/*/*/*/*/*/2xx/*',
                '*/*/*/*/*/*/*/*/*/201/*',
                '*/*/*/*/*/*/*/*/*/1xx/*',
                '*/*/*/*/*/*/*/*/*/101/*'
            ];
            assert.deepEqual(expected, paths);
        });
    });

    describe('_processRawBundle', function () {
        it('should set up settings and dimensions', function () {
            var bundle, ycb;
            bundle = readFixtureFile('dimensions.json')
                .concat(readFixtureFile('simple-1.json')[0]);
            ycb = new libycb.Ycb(bundle);

            assert.equal('YRB_YAHOO', ycb.settings['*/*/*/*/*/*/*/*/*/*/*'].title_key);
            assert(undefined !== ycb.dimensions[7].region.us);
        });

        it('should handle dupe error', function () {
            var bundle, ycb;
            bundle = readFixtureFile('dimensions.json')
                .concat(readFixtureFile('simple-1.json'))
                .concat(readFixtureFile('simple-2.json'));
            ycb = new libycb.Ycb(bundle);

            assert.equal('YRB_YAHOO_2nd', ycb.settings['*/*/*/*/*/*/*/*/*/*/*'].title_key);
            assert.equal('yahoo.png', ycb.settings['*/*/*/*/*/*/*/*/*/*/*'].logo1);
            assert.equal('tests/fixtures/simple-2.json', ycb.settings['*/*/*/*/*/*/*/*/*/*/*'].__ycb_source__);
            assert(undefined !== ycb.dimensions[7].region.us);
        });

        it('should handle many settings', function () {
            var bundle, ycb;
            bundle = readFixtureFile('dimensions.json')
                .concat(readFixtureFile('simple-1.json'))
                .concat(readFixtureFile('simple-3.json'));
            ycb = new libycb.Ycb(bundle);

            assert.equal('YRB_YAHOO', ycb.settings['*/*/*/*/*/*/*/*/*/*/*'].title_key);
            assert.equal('http://fr.yahoo.com', ycb.settings['*/*/*/*/*/*/*/fr/*/*/*'].links.home);
            assert.equal('yahoo_bt_FR.png', ycb.settings['*/*/*/*/*/*/*/fr/*/*/bt'].logo);
            assert(undefined !== ycb.dimensions[7].region.us);
        });

        it('should not break if there are no dimensions', function () {
            var bundle, ycb;
            bundle = readFixtureFile('simple-1.json')
                .concat(readFixtureFile('simple-3.json'));
            ycb = new libycb.Ycb(bundle);
            assert.deepEqual({}, ycb._dimensionHierarchies);
        });
    });

    describe('_applySubstitutions', function () {
        it('should substitute keys', function () {
            var config, ycb;
            config = readFixtureFile('substitutions.json');
            ycb = new libycb.Ycb([]);
            ycb._applySubstitutions(config);

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
            var ycb, bundle, config, expected;
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
            ycb.walkSettings(function(settings) {
                ctxs[JSON.stringify(settings)] = true;
                return true;
            });
            assert.equal(9, Object.keys(ctxs).length);
            assert(ctxs['{}']);
            assert(ctxs[JSON.stringify({region:'ca'})]);
            assert(ctxs[JSON.stringify({region:'gb'})]);
            assert(ctxs[JSON.stringify({lang:'fr'})]);
            assert(ctxs[JSON.stringify({region:'fr'})]);
            assert(ctxs[JSON.stringify({flavor:'att'})]);
            assert(ctxs[JSON.stringify({region:'ca',flavor:'att'})]);
            assert(ctxs[JSON.stringify({region:'gb',flavor:'bt'})]);
            assert(ctxs[JSON.stringify({region:'fr',flavor:'bt'})]);
        });
    });
});
