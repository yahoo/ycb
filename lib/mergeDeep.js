var isA = require('./isA');
var cloneDeep = require('./cloneDeep');

module.exports = function mergeDeep(from, to) {
    var key;
    for (key in from) {
        if (from.hasOwnProperty(key)) {
            // Property in destination object set; update its value.
            if (isA(from[key], Object)) {
                var mergeToObj;
                if (to.hasOwnProperty(key) && isA(to[key], Object)) {
                    mergeToObj = to[key];
                } else {
                    mergeToObj = {};
                }
                to[key] = mergeDeep(from[key], mergeToObj);
            } else if (isA(from[key], Array)) {
                to[key] = cloneDeep(from[key]);
            } else {
                // Other literals are copied
                to[key] = from[key];
            }
        }
    }
    return to;
};
