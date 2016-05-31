var isA = require('./isA');

module.exports = function cloneDeep(o) {
    var newO;

    if (!o || typeof o !== 'object') {
        return o;
    }

    if (isA(o, Array)) {
        newO = [];
        for (var i = 0, j = o.length; i < j; i += 1) {
            newO[i] = cloneDeep(o[i]);
        }
        return newO;
    }

    newO = {};
    for (i in o) {
        if (o.hasOwnProperty(i)) {
            newO[i] = cloneDeep(o[i]);
        }
    }
    return newO;
};
