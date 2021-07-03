// Gnome imports
const GObject = imports.gi.GObject;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const St = imports.gi.St;

// Gnome Shell imports
const DND = imports.ui.dnd;

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// App imports
const logger = Me.imports.logger;
const createEnum = Me.imports.utils.createEnum;

const NODE_TYPES = createEnum([
    'MONITOR',
    'NONE',
    'ROOT',
    'SPLIT',
    'WINDOW',
    'WORKSPACE',
]);

const SPLIT_ORIENTATION = createEnum([
    'HSPLIT',
    'VSPLIT',
]);


var Node = GObject.registerClass(
    class Node extends GObject.Object {
        /**
         * data: GObject.Object
         */
        _init(type, data) {
            super._init();
            this._type = type;
            this._data = data;
            this._parent = null;
            this._children = [];

            if (this._type === NODE_TYPES['WINDOW']) {
                logger.debug(`storing actor`);
                this._actor = this._data.get_compositor_private();
            }
        }
    }
);

var Tree = GObject.registerClass(
    class Tree extends GObject.Object {
        _init() {
            super._init();
            let workspaceManager = global.workspace_manager; 
            let activeWorkspace = workspaceManager.get_active_workspace();
            let currentMonitor = global.display.get_current_monitor();
            let workspaceArea = activeWorkspace.get_work_area_for_monitor(currentMonitor);

            this._rootBin = new St.Bin({style_class: 'window-clone-border'});
            global.window_group.add_child(this._rootBin);
            this._rootBin.set_position(workspaceArea.x, workspaceArea.y);
            this._rootBin.set_size(workspaceArea.width, workspaceArea.height);
            this._rootBin.show();

            this._root = new Node(NODE_TYPES['ROOT'], this._rootBin);
        }

        // Insert on the root or an existing node
        add(toData, type, data) {
            let parentNode = this.find(toData);
            let child;

            if (parentNode) {
                child = new Node(type, data);
                parentNode._children.push(child);
                child._parent = parentNode;
            }
            return child;
        }

        _contains(callback, traversal) {
            traversal.call(this, callback);
        }

        _findIndex(items, data) {
            let index;

            for (let i = 0; i < items.length; i++) {
                if (items[i]._data === data) {
                    index = i;
                }
            }

            return index;
        }

        find(data) {
            let searchNode;
            let criteriaMatchFn = (node) => {
                if (node._data === data) {
                    logger.debug(`found node ${data}`);
                    searchNode = node;
                }
            };

            this._contains(criteriaMatchFn, this._traverseDepthFirst);

            return searchNode;
        }

        findByActor(dataActor) {
            let searchNode;
            let criteriaMatchFn = (node) => {
                if (node._type === NODE_TYPES['WINDOW'] && 
                    node._actor === dataActor) {
                    logger.debug(`found actor ${dataActor}`);
                    searchNode = node;
                }
            };

            this._contains(criteriaMatchFn, this._traverseDepthFirst);

            return searchNode;
        }

        remove(fromData, data) {
            let parentNode = this.find(fromData);
            let nodeToRemove = null;
            let nodeIndex;

            if (parentNode) {
                nodeIndex = this._findIndex(parentNode._children, data);

                if (nodeIndex === undefined) {
                    // do nothing
                } else {
                    // re-adjust the children to the next sibling
                    nodeToRemove = parentNode._children[nodeIndex];
                }
            }
        }

        _traverseDepthFirst(criteriaFn) {
            (function recurse(currentNode) {
                for (let i = 0, length = currentNode._children.length; i < length; i++) {
                    recurse(currentNode._children[i]);
                }

                criteriaFn(currentNode);

            })(this._root);
        }
    }
);

var ForgeWindowManager = GObject.registerClass(
    class ForgeWindowManager extends GObject.Object {
        _init() {
            super._init();
            this._bindSignals();
            this._tree = new Tree();

            logger.info("Forge initialized");
        }

        _bindSignals() {
            const display = global.display;
            this._displaySignals = [
                display.connect("window-created", this._windowCreate.
                    bind(this)),
            ];
        }

        _removeSignals() {
            if (this._displaySignals) {
                for (const displaySignal of this._displaySignals) {
                    global.display.disconnect(displaySignal);
                }
            }
        }

        _windowCreate(_display, metaWindow) {
            if (metaWindow.get_window_type() == Meta.WindowType.NORMAL) {
                logger.debug(`window tracked: ${metaWindow.get_title()}`);

                this._tree.add(this._tree._rootBin, NODE_TYPES['WINDOW'], 
                    metaWindow);

                let windowActor = metaWindow.get_compositor_private();
                windowActor.connect("destroy", this._windowDestroy.bind(this));

                logger.debug(`root children ${this._tree._root._children.length}`);
            }
        }

        _windowDestroy(actor) {
            // Release any resources on the window
            let nodeWindow = this._tree.findByActor(actor);
            if (nodeWindow)
                logger.debug(`window destroyed ${nodeWindow._data.get_title()}`);
        }

        get windows() {
            let wsManager = global.workspace_manager;
            // TODO: make it configurable
            return global.display.get_tabs_list(Meta.TabList.NORMAL_ALL,
                wsManager.get_active_workspace());
        }

        disable() {
            logger.debug(`Disable is called`);
            this._removeSignals();
        }
    }
);


