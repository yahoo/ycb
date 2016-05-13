var isA = require('./isA');
var cloneDeep = require('./cloneDeep');

module.exports = function mergeDeep(from, to, safe) {
    var newTo = to;
    var key;
    if (safe) {
        newTo = {};
        for (key in to) {
            if (to.hasOwnProperty(key)) {
                newTo[key] = to[key];
            }
        }
    }
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
                newTo[key] = mergeDeep(from[key], mergeToObj, safe);
            } else if (isA(from[key], Array)) {
                newTo[key] = cloneDeep(from[key]);
            } else {
                // Other literals are copied
                newTo[key] = from[key];
            }
        }
    }
    return newTo;
};
