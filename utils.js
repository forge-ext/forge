// Gnome imports
const Clutter = imports.gi;
const Gio = imports.gi.Gio;

// Gnome-shell imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

function wrapActor(actor) {
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


/**
 * getSettings:
 * @schema: (optional): the GSettings schema id
 *
 * Builds and return a GSettings schema for @schema, using schema files
 * in extensionsdir/schemas. If @schema is not provided, it is taken from
 * metadata['settings-schema'].
 *
 * Credits: 
 *  - Code from convenience.js script by Dash-To-Panel
 *  - See credits also on that file for further derivatives.
 */
function getSettings(schema) {
    let extension = ExtensionUtils.getCurrentExtension();

    schema = schema || extension.metadata['settings-schema'];

    const GioSSS = Gio.SettingsSchemaSource;

    // Check if this extension was built with "make zip-file", and thus
    // has the schema files in a subfolder
    // otherwise assume that extension has been installed in the
    // same prefix as gnome-shell (and therefore schemas are available
    // in the standard folders)
    let schemaDir = extension.dir.get_child('schemas');
    let schemaSource;
    if (schemaDir.query_exists(null))
        schemaSource = GioSSS.new_from_directory(schemaDir.get_path(),
                                                 GioSSS.get_default(),
                                                 false);
    else
        schemaSource = GioSSS.get_default();

    let schemaObj = schemaSource.lookup(schema, true);
    if (!schemaObj)
        throw new Error('Schema ' + schema + 
            ' could not be found for extension ' + extension.metadata.uuid + 
            '. Please check your installation.');

    return new Gio.Settings({
        settings_schema: schemaObj
    });
}
