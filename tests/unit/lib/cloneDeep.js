/*
 * Copyright (c) 2011-2013, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*globals describe,it*/

var deepClone = require('../../../lib/cloneDeep');
var assert = require('assert');


describe('ycb unit tests', function () {
    describe('cloneDeep', function () {
        it('should deeply clone the full object', function () {
            var obj, copy;
            obj = {
                inner: {
                    string: 'value',
                    number: 1,
                    fn: function() {}
                },
                list: ['a', 'b', 'c']
            };
            copy = deepClone(obj);

            assert.notEqual(obj, copy);

            assert.notEqual(obj.inner, copy.inner);
            assert.deepEqual(obj.inner, copy.inner);

            assert.equal(obj.inner.string, copy.inner.string);
            assert.equal(obj.inner.number, copy.inner.number);
            assert.equal(obj.inner.fn, copy.inner.fn);

            assert.notEqual(obj.list, copy.list);
            assert.deepEqual(obj.list, copy.list);
        });
    });
});
