module.exports = function isA(item, constructor) {
    if (constructor === Array) {
        return Array.isArray(item);
    }

    if (constructor === Object) {
        return item !== null && typeof item === 'object' && Array.isArray(item) !== true;
    }

    return item && item.constructor === constructor;
};
