var isA = require('./isA');

module.exports = function isIterable(item) {
    return isA(item, Object) || isA(item, Array);
};
