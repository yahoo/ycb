/*
 * Copyright (c) 2011-2013, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*globals describe,it*/

var deepMerge = require('../../../lib/mergeDeep');
var assert = require('assert');


describe('ycb unit tests', function () {
    describe('mergeDeep', function () {
        it('should deeply merge the full object without referencing from object', function () {
            var obj, copy;
            obj = {
                inner: {
                    string: 'value',
                    number: 1,
                    fn: function() {}
                },
                list: ['a', 'b', 'c'],
                string: 'string'
            };
            copy = deepMerge(obj, {});

            assert.deepEqual(obj, copy);
            assert.notEqual(obj, copy);
            assert.notEqual(obj.inner, copy.inner);
            assert.notEqual(obj.list, copy.list);
        });

        it('should deeply merge the full object without referencing from object', function () {
            var obj, copy, fn = function () {};
            obj = {
                inner: {
                    obj: {},
                    string: 'value',
                    number: 1,
                    fn: fn
                },
                list: ['a', 'b', 'c'],
                string: 'string'
            };

            var start = {
                inner: {
                    obj: {
                        foo: 'bar'
                    },
                    string: 'bar'
                },
                list: ['a', 'b', 'c', 'd']
            };
            copy = deepMerge(obj, start);

            var expected = {
                inner: {
                    obj: {
                        foo: 'bar'
                    },
                    string: 'value',
                    number: 1,
                    fn: fn
                },
                list: ['a', 'b', 'c'],
                string: 'string'
            };
            assert.deepEqual(expected, copy);
            assert.notEqual(obj, copy);
            assert.notEqual(obj.inner, copy.inner);
            assert.notEqual(obj.inner.obj, copy.inner.obj);
            assert.notEqual(obj.list, copy.list);
        });
    });
});
