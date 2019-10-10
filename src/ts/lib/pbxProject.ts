import  * as util from 'util';
import { XcProjectFileEditor } from './XcProjectFileEditor';

/**
 * @deprecated Use XcProjectFileEditor directly for new code.
 * 
 * This is hacked for backwards compatibility with existing 
 * use of this library.
 * 
 * @param filename 
 */
function pbxProject(filename:string):any {
    //  The only way to use util.inherits and calling the base class constructor
    //  is to go back to ES5 as far as I know.  I.e. this fails if you switch to building ES6.
    //  I don't think this requirment should be important.
    //  Old school extending to make this backwards compatible.
    // https://nodejs.org/docs/latest/api/util.html#util_util_inherits_constructor_superconstructor

    //@ts-ignore
    if (!(this instanceof pbxProject)) {
        //@ts-ignore
        return new pbxProject(filename);
    }

    //@ts-ignore
    XcProjectFileEditor.call(this,filename);
}

util.inherits(pbxProject, XcProjectFileEditor)

module.exports = pbxProject;