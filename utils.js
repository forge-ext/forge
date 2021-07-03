// Gnome imports
const Clutter = imports.gi;

var wrapActor = function(actor) {
    if (actor) {
        Object.defineProperty(actor, 'actor', {
            value: actor instanceof Clutter.Actor ? actor : actor.actor
        });
    }
};

/**
 *
 * Turns an array into an immutable enum-like object
 *
 */
function createEnum(anArray) {
    const enumObj = {};
    for (const val of anArray) {
        enumObj[val] = val;
    }
    return Object.freeze(enumObj);
}
