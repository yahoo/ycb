module.exports = function isA(item, constructor) {
    return item && (item.constructor === constructor);
};
