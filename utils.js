// Gnome imports
const Clutter = imports.gi;

var wrapActor = function(actor) {
    if (actor) {
        Object.defineProperty(actor, 'actor', {
            value: actor instanceof Clutter.Actor ? actor : actor.actor
        });
    }
};
