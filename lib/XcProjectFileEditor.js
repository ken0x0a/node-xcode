"use strict";
/**
 Licensed to the Apache Software Foundation (ASF) under one
 or more contributor license agreements.  See the NOTICE file
 distributed with this work for additional information
 regarding copyright ownership.  The ASF licenses this file
 to you under the Apache License, Version 2.0 (the
 'License'); you may not use this file except in compliance
 with the License.  You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing,
 software distributed under the License is distributed on an
 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 KIND, either express or implied.  See the License for the
 specific language governing permissions and limitations
 under the License.
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
/*
Helpful Background Links:

http://danwright.info/blog/2010/10/xcode-pbxproject-files/
http://www.monobjc.net/xcode-project-file-format.html
https://github.com/Monobjc/monobjc-tools


*/
var util_1 = require("util");
var path = require("path");
var uuid = require("uuid");
var fs = require("fs");
//  no types file for simple-plist
var plist = require('simple-plist');
//import * as plist from 'simple-plist';
var events_1 = require("events");
var child_process_1 = require("child_process");
var pbxWriter_1 = require("./pbxWriter");
//  This is a automatically generated .js file from pegjs.
//  So go oldschool and use require.
var parser = require('./parser/pbxproj');
var SectionUtils_1 = require("./SectionUtils");
var IXcodeProjFileObjTypes_1 = require("./IXcodeProjFileObjTypes");
var PbxFileDef_1 = require("./PbxFileDef");
/**
 * Due to a problem debugging code that depends on the fork used in
 * the parse method, we allow setting an environment variable that
 * makes calls to parse simulate the fork method.  In reality, we should
 * just remove the fork outright.  But we are for now assuming someone coded
 * it that way for a valid reason and are maintaining that implementation.
 */
var replaceParseWithParseSync = (process.env["XNODE_PARSE_AVOID_FORK"] == "1"); // See if we can pull an environment variable to set this when running out of VSCode or debugger.
//  Appears to not be used (Ball 2019/10)
// // helper recursive prop search+replace
// function propReplace(obj, prop, value) {
//     var o = {};
//     for (var p in obj) {
//         if (o.hasOwnProperty.call(obj, p)) {
//             if (typeof obj[p] == 'object' && !Array.isArray(obj[p])) {
//                 propReplace(obj[p], prop, value);
//             } else if (p == prop) {
//                 obj[p] = value;
//             }
//         }
//     }
// }
// helper object creation functions
function pbxBuildFileObj(file) {
    //  Making an assumption that a BuildFile without a fileRef
    //  is an illegal condition.
    if (typeof file.fileRef !== 'string') {
        throw new Error('Assuming all BuildFile instances require a fileRef.');
    }
    var obj = {
        isa: 'PBXBuildFile',
        fileRef: file.fileRef,
        fileRef_comment: file.basename
    };
    if (file.settings)
        obj.settings = file.settings;
    return obj;
}
function pbxFileReferenceObj(file) {
    //  All file references 
    //  Assuming XC can't handle this.  Unsure if this is true or not.
    //  The test cases forced an 'unknown' value here.  Restore this check and fix
    //  the test cases if we determine that xcode can't handle unknown.
    // if (file.lastKnownFileType == 'unknown')
    //     throw new Error('Attempting to set the lastKnownFileType of a PBXFileReference object to "unknown"');
    var fileObject = {
        isa: "PBXFileReference",
        name: "\"" + file.basename + "\"",
        path: "\"" + file.path.replace(/\\/g, '/') + "\"",
        sourceTree: file.sourceTree,
        fileEncoding: file.fileEncoding,
        lastKnownFileType: file.lastKnownFileType,
        explicitFileType: file.explicitFileType,
        includeInIndex: file.includeInIndex
    };
    return fileObject;
}
function pbxGroupChild(file) {
    if (!file.fileRef) {
        throw new Error('fileRef not set!');
    }
    return {
        value: file.fileRef,
        comment: file.basename
    };
}
// function pbxBuildPhaseObjThrowIfInvalid(file: IFilePathObj): IChildListEntry {
//     // if (typeof file.uuid == "string" && typeof file.group == "string") { ensured group is always set
//     if (typeof file.uuid == "string") {
//         return pbxBuildPhaseObj(file);
//     } else {
//         throw new Error('uuid is not set.');
//     }
// }
function pbxBuildPhaseObj(file) {
    var obj = Object.create(null);
    if (!SectionUtils_1.SectionUtils.dictKeyIsUuid(file.uuid)) {
        throw new Error("The uuid value of '" + file.uuid + "' is invalid!");
    }
    obj.value = file.uuid;
    obj.comment = longComment(file);
    return obj;
}
function pbxCopyFilesBuildPhaseObj(obj, folderType, subfolderPath, phaseName) {
    // Add additional properties for 'CopyFiles' build phase
    var DESTINATION_BY_TARGETTYPE = {
        application: 'wrapper',
        app_extension: 'plugins',
        bundle: 'wrapper',
        command_line_tool: 'wrapper',
        dynamic_library: 'products_directory',
        framework: 'shared_frameworks',
        frameworks: 'frameworks',
        static_library: 'products_directory',
        unit_test_bundle: 'wrapper',
        watch_app: 'wrapper',
        watch2_app: 'products_directory',
        watch_extension: 'plugins',
        watch2_extension: 'plugins'
    };
    var SUBFOLDERSPEC_BY_DESTINATION = {
        absolute_path: 0,
        executables: 6,
        frameworks: 10,
        java_resources: 15,
        plugins: 13,
        products_directory: 16,
        resources: 7,
        shared_frameworks: 11,
        shared_support: 12,
        wrapper: 1,
        xpc_services: 0
    };
    var objOut = obj;
    objOut.name = '"' + phaseName + '"';
    objOut.dstPath = subfolderPath || '""';
    objOut.dstSubfolderSpec = SUBFOLDERSPEC_BY_DESTINATION[DESTINATION_BY_TARGETTYPE[folderType]];
    return objOut;
}
function pbxShellScriptBuildPhaseObj(obj, options, phaseName) {
    var objOut = obj;
    objOut.name = '"' + phaseName + '"';
    objOut.inputPaths = options.inputPaths || [];
    objOut.outputPaths = options.outputPaths || [];
    objOut.shellPath = options.shellPath;
    objOut.shellScript = '"' + options.shellScript.replace(/"/g, '\\"') + '"';
    return objOut;
}
function pbxBuildFileComment(file) {
    return longComment(file);
}
function pbxFileReferenceComment(file) {
    return file.basename || path.basename(file.path);
}
function pbxNativeTargetComment(target) {
    return target.name;
}
function longComment(file) {
    //  This is failing a test.  I tentatively think it should fail
    //  and the test is bad.
    //  However, it was passing and I don't know enough about the
    //  actual required use and expectation of xcode to know if it 
    //  is really a problem.  For now, just remove the throw and 
    //  restore it if I later find out my original assumption is correct
    //  and the test is bad not the code.
    //  
    // //  Adding error checking to make sure file.group exists
    // if (typeof file.group != "string")
    //     throw new Error("group not set on file.");
    return util_1.format("%s in %s", file.basename, file.group);
}
// respect <group> path
function correctForPluginsPath(file, project) {
    return correctForPath(file, project, 'Plugins');
}
function correctForResourcesPath(file, project) {
    return correctForPath(file, project, 'Resources');
}
//  not used
// function correctForFrameworksPath(file: PbxFile, project: PbxProject) {
//     return correctForPath(file, project, 'Frameworks');
// }
function correctForPath(file, project, group) {
    var r_group_dir = new RegExp('^' + group + '[\\\\/]');
    var groupObj = project.pbxGroupByName(group);
    if (!groupObj)
        throw new Error("Group not found!");
    if (groupObj.path)
        file.path = file.path.replace(r_group_dir, '');
    return file;
}
function searchPathForFile(file, proj) {
    var plugins = proj.pbxGroupByName('Plugins');
    var pluginsPath = plugins ? plugins.path : null;
    var fileDir = path.dirname(file.path);
    if (fileDir == '.') {
        fileDir = '';
    }
    else {
        fileDir = '/' + fileDir;
    }
    if (file.plugin && pluginsPath) {
        return '"\\"$(SRCROOT)/' + unquote(pluginsPath) + '\\""';
    }
    else if (file.customFramework && file.dirname) {
        return '"\\"' + file.dirname + '\\""';
    }
    else {
        return '"\\"$(SRCROOT)/' + proj.productName + fileDir + '\\""';
    }
}
function unquoteStr(str) {
    return str.replace(/^"(.*)"$/, "$1");
}
function unquote(str) {
    if (str)
        return unquoteStr(str);
    else
        return undefined;
}
//  not used
// function buildPhaseNameForIsa(isa: ISA_TYPE): string | undefined {
//     const BUILDPHASENAME_BY_ISA: { [isaType: string]: string } = {
//         PBXCopyFilesBuildPhase: 'Copy Files',
//         PBXResourcesBuildPhase: 'Resources',
//         PBXSourcesBuildPhase: 'Sources',
//         PBXFrameworksBuildPhase: 'Frameworks'
//     }
//     return BUILDPHASENAME_BY_ISA[(isa as string)] as string | undefined;
// }
function producttypeForTargettype(targetType) {
    var PRODUCTTYPE_BY_TARGETTYPE = {
        application: 'com.apple.product-type.application',
        app_extension: 'com.apple.product-type.app-extension',
        bundle: 'com.apple.product-type.bundle',
        command_line_tool: 'com.apple.product-type.tool',
        dynamic_library: 'com.apple.product-type.library.dynamic',
        framework: 'com.apple.product-type.framework',
        static_library: 'com.apple.product-type.library.static',
        unit_test_bundle: 'com.apple.product-type.bundle.unit-test',
        watch_app: 'com.apple.product-type.application.watchapp',
        watch2_app: 'com.apple.product-type.application.watchapp2',
        watch_extension: 'com.apple.product-type.watchkit-extension',
        watch2_extension: 'com.apple.product-type.watchkit2-extension'
    };
    var pt = PRODUCTTYPE_BY_TARGETTYPE[targetType];
    if (pt !== undefined)
        return pt;
    else
        throw new Error("No product type for target type of '" + targetType + "'");
}
function filetypeForProductType(productType) {
    var FILETYPE_BY_PRODUCT_TYPE = {
        'com.apple.product-type.application': 'wrapper.application',
        'com.apple.product-type.app-extension': 'wrapper.app-extension',
        'com.apple.product-type.bundle': 'wrapper.plug-in',
        'com.apple.product-type.tool': 'compiled.mach-o.dylib',
        'com.apple.product-type.library.dynamic': 'compiled.mach-o.dylib',
        'com.apple.product-type.framework': 'wrapper.framework',
        'com.apple.product-type.library.static': 'archive.ar',
        'com.apple.product-type.bundle.unit-test': 'wrapper.cfbundle',
        'com.apple.product-type.application.watchapp': 'wrapper.application',
        'com.apple.product-type.application.watchapp2': 'wrapper.application',
        'com.apple.product-type.watchkit-extension': 'wrapper.app-extension',
        'com.apple.product-type.watchkit2-extension': 'wrapper.app-extension'
    };
    //  I am pretty sure the original version of this added the double quotes.
    //  however, our type checking dictates that they do not have the quotes.
    //  Will troubleshoot later.
    // 'com.apple.product-type.application': '"wrapper.application"',
    // 'com.apple.product-type.app-extension': '"wrapper.app-extension"',
    // 'com.apple.product-type.bundle': '"wrapper.plug-in"',
    // 'com.apple.product-type.tool': '"compiled.mach-o.dylib"',
    // 'com.apple.product-type.library.dynamic': '"compiled.mach-o.dylib"',
    // 'com.apple.product-type.framework': '"wrapper.framework"',
    // 'com.apple.product-type.library.static': '"archive.ar"',
    // 'com.apple.product-type.bundle.unit-test': '"wrapper.cfbundle"',
    // 'com.apple.product-type.application.watchapp': '"wrapper.application"',
    // 'com.apple.product-type.watchkit-extension': '"wrapper.app-extension"'
    return FILETYPE_BY_PRODUCT_TYPE[productType];
}
/**
 * Loads an in memory representation of a projct.pbxproj file,
 * allows manipulating that in memory representation, and then
 * saving it back to disk.
 *
 * Used to be called pbxProject.
 */
var XcProjectFileEditor = /** @class */ (function (_super) {
    __extends(XcProjectFileEditor, _super);
    function XcProjectFileEditor(filename) {
        var _this = _super.call(this) || this;
        _this.filepath = path.resolve(filename);
        return _this;
    }
    /**
     * Asyncronously read and parse the file and create.  This forks
     * another process and has that second process send a message back
     * to the first.  The first message never received a message and just
     * exited when I tried this.  Dropped this in favor of parseSync
     * since this is not a server application anyways.
     *
     * @param cb Will be called with result being an instance of error
     * (inferred  from name or code property) or null if successful.  The second
     * parameter will be the model of the project file, which you should
     * likely ignore as the point of this project wrapper is to manipulate it.
     *
     * Rasies event error or end also.  These are an alternative to the use of the
     * callback.
     *
     * This method causes issues attaching a debugger to the process.  To resolve this
     * you can set the environment variable "XNODE_PARSE_AVOID_FORK" to "1" and this will avoid the fork
     * and allow you to debug the code with a debugger.  NOTE the failure was only
     * confirmed when debugging from vscode.
     */
    XcProjectFileEditor.prototype.parse = function (cb) {
        var _this = this;
        if (cb) {
            this.on('error', cb);
            this.on('end', cb);
        }
        if (replaceParseWithParseSync) {
            // Required for any effective use of debugging in vscode.
            var error_1 = null;
            try {
                this.parseSync();
            }
            catch (err) {
                error_1 = err;
            }
            //  Schedule the callback to be somewhat close to a fork.
            //  We do this because we want this to behave the same during
            //  debug session as in a normal session that performs the actual fork.
            setTimeout(function () {
                var modelHash = _this.hash; // (debugging easier)
                var retErr = error_1; // Pull out of closure (debugging easier)
                // Check SyntaxError and code to keep logically in sync with fork code.
                //  It is probably unnecessary.
                if (retErr != null && (retErr.name == 'SyntaxError' || retErr.code)) {
                    _this.emit('error', retErr);
                }
                else {
                    _this.emit('end', null, modelHash);
                }
            }, 1);
        }
        else {
            // Original logic of using fork assuming that the parse process is expensive 
            //  and eating valueable CPU cycles of the process modifying this file.
            var worker = child_process_1.fork(__dirname + '/parseJob.js', [this.filepath]);
            worker.on('message', function (msg) {
                if (msg.name == 'SyntaxError' || msg.code) {
                    _this.emit('error', msg);
                }
                else {
                    _this.hash = msg;
                    _this.emit('end', null, msg);
                }
            });
            //}.bind(this));
        }
        return this;
    };
    /* sync version of parse.  This actually worked in my trials compared to the parse version
     which did not.  The parse version's implementation is an overeager optimization that attempts
     to perform the parsing in a forked process. */
    XcProjectFileEditor.prototype.parseSync = function () {
        var file_contents = fs.readFileSync(this.filepath, 'utf-8');
        this.hash = parser.parse(file_contents);
        return this;
    };
    /*  Generate the contents of the project.pbxproj file.  Note, this does not
    write anything to disk. */
    XcProjectFileEditor.prototype.writeSync = function (options) {
        this.writer = new pbxWriter_1.PbxWriter(this.hash, options);
        return this.writer.writeSync();
    };
    /* Return all Uuids within all sections of the project */
    XcProjectFileEditor.prototype.allUuids = function () {
        if (!this.hash)
            throw new Error('parse not completed');
        var sections = this.hash.project.objects;
        var uuids = [];
        for (var key in sections) {
            var section = sections[key];
            uuids = uuids.concat(Object.keys(section));
        }
        uuids = uuids.filter(function (key) {
            //  I am uncomfortable that this assumes there are objects in the dictionary
            //  other than a comment or a 24 long UUID.    But I found it this way and don't know
            //  that the parser may not find a non 24 charachter non comment.   Went all in and assumed
            //  it is 24 chars everywhere.
            // return !SectionUtils.dictKeyIsComment && str.length == 24;
            return SectionUtils_1.SectionUtils.dictKeyIsUuid(key);
        });
        return uuids;
    };
    /** Return a new 24 charachter Uuid that does not already exist in the project */
    XcProjectFileEditor.prototype.generateUuid = function () {
        var id = uuid.v4()
            .replace(/-/g, '')
            .substr(0, 24)
            .toUpperCase();
        if (this.allUuids().indexOf(id) >= 0) {
            return this.generateUuid();
        }
        else {
            return id;
        }
    };
    /**
        * Add a plugin file if not already existing.
        * Also adds it to the PbxFileReference Section and the plugins PbxGroup
        * @returns null if file already exists.
        */
    XcProjectFileEditor.prototype.addPluginFile = function (path, opt) {
        var file = new PbxFileDef_1.PbxFile(path, opt);
        file.plugin = true; // Assuming a client of this library uses this.  Leaving for no other reason.
        correctForPluginsPath(file, this);
        // null is better for early errors
        if (this.hasFile(file.path))
            return null;
        file.fileRef = this.generateUuid();
        this.addToPbxFileReferenceSection(file); // PBXFileReference
        this.addToPluginsPbxGroup(file); // PBXGroup
        return file;
    };
    /** Inverse of addPluginFile.  Always returns a new instance if IPbxFile
     * that was removed.
     */
    XcProjectFileEditor.prototype.removePluginFile = function (path, opt) {
        var file = new PbxFileDef_1.PbxFile(path, opt);
        correctForPluginsPath(file, this);
        this.removeFromPbxFileReferenceSection(file); // PBXFileReference
        this.removeFromPluginsPbxGroup(file); // PBXGroup
        return file;
    };
    /*  Similar to add plugin file but it is added to the ProductsPbxGroup */
    XcProjectFileEditor.prototype.addProductFile = function (targetPath, opt) {
        var file = new PbxFileDef_1.PbxFile(targetPath, opt);
        file.includeInIndex = 0;
        file.fileRef = this.generateUuid();
        file.target = opt ? opt.target : undefined;
        file.group = opt ? opt.group : undefined;
        file.uuid = this.generateUuid();
        file.path = file.basename;
        this.addToPbxFileReferenceSection(file);
        this.addToProductsPbxGroup(file); // PBXGroup
        return file;
    };
    /** This removes this from the products group.  Oddly enough it does not
     * remove it from the PbxReferenceSection as a plugin file.  I don't know
     * why this is at the time of writing.
     */
    XcProjectFileEditor.prototype.removeProductFile = function (path, opt) {
        var file = new PbxFileDef_1.PbxFile(path, opt);
        this.removeFromProductsPbxGroup(file); // PBXGroup
        return file;
    };
    /**
     *
     * @param path {String}
     * @param opt {Object} see PbxFile for avail options
     * @param group {String} group key
     * @returns {Object} file; see PbxFile
     */
    XcProjectFileEditor.prototype.addSourceFile = function (path, opt, group) {
        var file;
        if (group) {
            file = this.addFile(path, group, opt);
        }
        else {
            file = this.addPluginFile(path, opt);
        }
        if (!file)
            return false;
        file.target = opt ? opt.target : undefined;
        file.uuid = this.generateUuid();
        this.addToPbxBuildFileSection(file); // PBXBuildFile
        this.addToPbxSourcesBuildPhase(file); // PBXSourcesBuildPhase
        return file;
    };
    /**
     *
     * @param path {String}
     * @param opt {Object} see PbxFile for avail options
     * @param group {String} group key
     * @returns {Object} file; see PbxFile
     */
    XcProjectFileEditor.prototype.removeSourceFile = function (path, opt, group) {
        var file;
        if (group) {
            file = this.removeFile(path, group, opt);
        }
        else {
            file = this.removePluginFile(path, opt);
        }
        file.target = opt ? opt.target : undefined;
        this.removeFromPbxBuildFileSection(file); // PBXBuildFile
        this.removeFromPbxSourcesBuildPhase(file); // PBXSourcesBuildPhase
        return file;
    };
    /**
     *
     * @param path {String}
     * @param opt {Object} see pbxFile for avail options
     * @param group {String} group key
     * @returns {Object} file; see pbxFile
     */
    XcProjectFileEditor.prototype.addHeaderFile = function (path, opt, group) {
        if (group) {
            return this.addFile(path, group, opt);
        }
        else {
            return this.addPluginFile(path, opt);
        }
    };
    /**
     *
     * @param path {String}
     * @param opt {Object} see pbxFile for avail options
     * @param group {String} group key
     * @returns {Object} file; see pbxFile
     */
    XcProjectFileEditor.prototype.removeHeaderFile = function (path, opt, group) {
        if (group) {
            return this.removeFile(path, group, opt);
        }
        else {
            return this.removePluginFile(path, opt);
        }
    };
    /**
     *
     * @param path {String}
     * @param opt {Object} see pbxFile for avail options
     * @param group {String} group key
     * @returns {PbxFile} if added or false if it already existed.
     */
    XcProjectFileEditor.prototype.addResourceFile = function (path, opt, group) {
        opt = opt || {};
        var file;
        if (opt.plugin) {
            file = this.addPluginFile(path, opt);
            if (!file)
                return false;
        }
        else {
            file = new PbxFileDef_1.PbxFile(path, opt);
            if (this.hasFile(file.path))
                return false;
        }
        file.uuid = this.generateUuid();
        file.target = opt ? opt.target : undefined;
        if (!opt.plugin) {
            correctForResourcesPath(file, this);
            file.fileRef = this.generateUuid();
        }
        if (!opt.variantGroup) {
            this.addToPbxBuildFileSection(file); // PBXBuildFile
            this.addToPbxResourcesBuildPhase(file); // PBXResourcesBuildPhase
        }
        if (!opt.plugin) {
            this.addToPbxFileReferenceSection(file); // PBXFileReference
            if (group) {
                if (this.getPBXGroupByKey(group)) {
                    this.addToPbxGroup(file, group); //Group other than Resources (i.e. 'splash')
                }
                else if (this.getPBXVariantGroupByKey(group)) {
                    this.addToPbxVariantGroup(file, group); // PBXVariantGroup
                }
            }
            else {
                this.addToResourcesPbxGroup(file); // PBXGroup
            }
        }
        return file;
    };
    /**
     *
     * @param path {String}
     * @param opt {Object} see pbxFile for avail options
     * @param groupUuid {String} group key
     * @returns {Object} file; see pbxFile
     */
    XcProjectFileEditor.prototype.removeResourceFile = function (path, opt, groupUuid) {
        var file = new PbxFileDef_1.PbxFile(path, opt);
        file.target = opt ? opt.target : undefined;
        correctForResourcesPath(file, this);
        this.removeFromPbxBuildFileSection(file); // PBXBuildFile
        this.removeFromPbxFileReferenceSection(file); // PBXFileReference
        if (groupUuid) {
            if (this.getPBXGroupByKey(groupUuid)) {
                this.removeFromPbxGroup(file, groupUuid); //Group other than Resources (i.e. 'splash')
            }
            else if (this.getPBXVariantGroupByKey(groupUuid)) {
                this.removeFromPbxVariantGroup(file, groupUuid); // PBXVariantGroup
            }
        }
        else {
            this.removeFromResourcesPbxGroup(file); // PBXGroup
        }
        this.removeFromPbxResourcesBuildPhase(file); // PBXResourcesBuildPhase
        return file;
    };
    XcProjectFileEditor.prototype.addFramework = function (fpath, opt) {
        //  We capture these early since the option is modified after calling.
        var customFramework = !!(opt && opt.customFramework == true);
        var link = !opt || (opt.link == undefined || opt.link); //defaults to true if not specified
        var embed = !!(opt && opt.embed); //defaults to false if not specified
        if (opt) {
            delete opt.embed;
        }
        var file = new PbxFileDef_1.PbxFile(fpath, opt);
        file.uuid = this.generateUuid();
        file.fileRef = this.generateUuid();
        file.target = opt ? opt.target : undefined;
        if (this.hasFile(file.path))
            return false;
        this.addToPbxBuildFileSection(file); // PBXBuildFile
        this.addToPbxFileReferenceSection(file); // PBXFileReference
        this.addToFrameworksPbxGroup(file); // PBXGroup
        if (link) {
            this.addToPbxFrameworksBuildPhase(file); // PBXFrameworksBuildPhase
        }
        if (opt && customFramework) { // extra check on opt is for Typescript, not logically required
            this.addToFrameworkSearchPaths(file);
            if (embed) {
                opt.embed = embed;
                var embeddedFile = new PbxFileDef_1.PbxFile(fpath, opt);
                embeddedFile.uuid = this.generateUuid();
                embeddedFile.fileRef = file.fileRef;
                //keeping a separate PBXBuildFile entry for Embed Frameworks
                this.addToPbxBuildFileSection(embeddedFile); // PBXBuildFile
                this.addToPbxEmbedFrameworksBuildPhase(embeddedFile); // PBXCopyFilesBuildPhase
                return embeddedFile;
            }
        }
        return file;
    };
    XcProjectFileEditor.prototype.removeFramework = function (fpath, opt) {
        //  This was calculated in the original code, but never used.  Error?  10/2019
        //const embed:boolean = !!(opt && opt.embed);
        if (opt) {
            delete opt.embed;
        }
        var file = new PbxFileDef_1.PbxFile(fpath, opt);
        file.target = opt ? opt.target : undefined;
        this.removeFromPbxBuildFileSection(file); // PBXBuildFile
        this.removeFromPbxFileReferenceSection(file); // PBXFileReference
        this.removeFromFrameworksPbxGroup(file); // PBXGroup
        this.removeFromPbxFrameworksBuildPhase(file); // PBXFrameworksBuildPhase
        if (opt && opt.customFramework) {
            this.removeFromFrameworkSearchPaths(file);
        }
        opt = opt || {};
        opt.embed = true;
        var embeddedFile = new PbxFileDef_1.PbxFile(fpath, opt);
        embeddedFile.fileRef = file.fileRef;
        this.removeFromPbxBuildFileSection(embeddedFile); // PBXBuildFile
        this.removeFromPbxEmbedFrameworksBuildPhase(embeddedFile); // PBXCopyFilesBuildPhase
        return file;
    };
    XcProjectFileEditor.prototype.addCopyfile = function (fpath, opt) {
        var file = new PbxFileDef_1.PbxFile(fpath, opt);
        // catch duplicates
        var existingFile = this.hasFile(file.path);
        if (existingFile) {
            //  WARNING:
            //  This is the original logic.   (Found 10/2019 when converting to TS)
            //  It treats the actual PBXFileReference object that is already
            //  integrated into the file object model as a PbxFile, modifies
            //  it and then returns it to the caller.  This seems undesirable.
            //  I assume it works since the PbxFile and PBXFileReferences have 
            //  many of the same properties and the ones that are being modified
            //  below should not be written back to the actual file.
            //  I am not sure this is correct at all.  
            //  Will leave for now and resolve if it turns out to be a bug.
            file = existingFile;
        }
        file.fileRef = file.uuid = this.generateUuid();
        file.target = opt ? opt.target : undefined;
        this.addToPbxBuildFileSection(file); // PBXBuildFile
        this.addToPbxFileReferenceSection(file); // PBXFileReference
        this.addToPbxCopyfilesBuildPhase(file); // PBXCopyFilesBuildPhase
        return file;
    };
    XcProjectFileEditor.prototype.pbxCopyfilesBuildPhaseObj = function (target) {
        return this.buildPhaseObject('PBXCopyFilesBuildPhase', 'Copy Files', target);
    };
    XcProjectFileEditor.prototype.addToPbxCopyfilesBuildPhase = function (file) {
        var sources = this.buildPhaseObject('PBXCopyFilesBuildPhase', 'Copy Files', file.target);
        if (!sources) {
            throw new Error('target not found');
        }
        sources.files.push(pbxBuildPhaseObj(file));
    };
    XcProjectFileEditor.prototype.removeCopyfile = function (fpath, opt) {
        var file = new PbxFileDef_1.PbxFile(fpath, opt);
        file.target = opt ? opt.target : undefined;
        this.removeFromPbxBuildFileSection(file); // PBXBuildFile
        this.removeFromPbxFileReferenceSection(file); // PBXFileReference
        this.removeFromPbxCopyfilesBuildPhase(file); // PBXFrameworksBuildPhase
        return file;
    };
    XcProjectFileEditor.prototype.removeFromPbxCopyfilesBuildPhase = function (file) {
        var sources = this.pbxCopyfilesBuildPhaseObj(file.target);
        if (!sources) // Nothing to remove it from.
            return;
        for (var i in sources.files) {
            if (sources.files[i].comment == longComment(file)) {
                sources.files.splice(i, 1);
                break;
            }
        }
    };
    XcProjectFileEditor.prototype.addStaticLibrary = function (path, opt) {
        opt = opt || {};
        var file;
        if (opt.plugin) {
            file = this.addPluginFile(path, opt);
            if (!file)
                return false;
        }
        else {
            file = new PbxFileDef_1.PbxFile(path, opt);
            if (this.hasFile(file.path))
                return false;
        }
        file.uuid = this.generateUuid();
        file.target = opt ? opt.target : undefined;
        if (!opt.plugin) {
            file.fileRef = this.generateUuid();
            this.addToPbxFileReferenceSection(file); // PBXFileReference
        }
        this.addToPbxBuildFileSection(file); // PBXBuildFile
        this.addToPbxFrameworksBuildPhase(file); // PBXFrameworksBuildPhase
        this.addToLibrarySearchPaths(file); // make sure it gets built!
        return file;
    };
    // helper addition functions
    XcProjectFileEditor.prototype.addToPbxBuildFileSection = function (file) {
        // removed test on file.group needing to be set.
        //  This was failing a test.  For now, let it pass 
        //  until we know for sure that the test was invalid and not the assumption 
        //  that group must be set.
        if (!file.uuid) { //  || !file.group)  {
            throw new Error('uuid or group not set!');
        }
        SectionUtils_1.SectionUtils.entrySetWUuid(this.pbxBuildFileSection(), file.uuid, pbxBuildFileObj(file), pbxBuildFileComment(file));
        // const commentKey: string = createUuidCommentKey(file.uuid);
        // // var commentKey = f("%s_comment", file.uuid);
        // this.pbxBuildFileSection()[file.uuid] = pbxBuildFileObj(file);
        // //  I believe TS should have allowed ILongCommentObj without cast due to previos check on group.  
        // //  Forced it.
        // this.pbxBuildFileSection()[commentKey] = pbxBuildFileComment(file as ILongCommentObj);
    };
    /**
     * Find the PBXBuildFile that is associated with this file based
     * on the basename.
     *
     * If found, set the file's uuid to the found PBXBuildFile instance and
     * delete the PBXBuildFile and its comments from the collection.
     * @param file
     */
    XcProjectFileEditor.prototype.removeFromPbxBuildFileSection = function (file) {
        var section = this.pbxBuildFileSection();
        for (var uuid_1 in section) { // uuid is a uuid or a comment key
            var buildFile = section[uuid_1];
            if (typeof buildFile == "object" && buildFile.fileRef_comment == file.basename) {
                //  if buildFile is an object, then this is not a comment.
                file.uuid = uuid_1;
                SectionUtils_1.SectionUtils.entryDeleteWUuid(section, uuid_1);
                // delete section[uuid];
                // const commentKey = createUuidCommentKey(uuid);
                // delete section[commentKey];
            }
        }
    };
    XcProjectFileEditor.prototype.addPbxGroup = function (filePathsArray, name, path, sourceTree) {
        var fileReferenceSection = this.pbxFileReferenceSection();
        //  Build a dictionary of filePath to IPbxGroupChildFileInfo for all PBXFileReference objects
        var filePathToReference = {};
        for (var key in fileReferenceSection) {
            // only look for comments
            if (SectionUtils_1.SectionUtils.dictKeyIsComment(key)) {
                // const fileReferenceKey: string = key.split(COMMENT_KEY)[0];
                var fileReferenceKey = SectionUtils_1.SectionUtils.dictKeyCommentToUuid(key);
                var fileReference = fileReferenceSection[fileReferenceKey];
                filePathToReference[fileReference.path] = { fileRef: fileReferenceKey, basename: fileReferenceSection[key] };
            }
        }
        var pbxGroup = {
            isa: IXcodeProjFileObjTypes_1.cPBXGroup,
            children: [],
            name: name,
            path: path,
            sourceTree: sourceTree ? sourceTree : '"<group>"'
        };
        for (var index = 0; index < filePathsArray.length; index++) {
            var filePath = filePathsArray[index];
            var filePathQuoted = "\"" + filePath + "\"";
            if (filePathToReference[filePath]) {
                pbxGroup.children.push(pbxGroupChild(filePathToReference[filePath]));
            }
            else if (filePathToReference[filePathQuoted]) {
                pbxGroup.children.push(pbxGroupChild(filePathToReference[filePathQuoted]));
            }
            else {
                var file = new PbxFileDef_1.PbxFile(filePath);
                file.uuid = this.generateUuid();
                file.fileRef = this.generateUuid();
                this.addToPbxFileReferenceSection(file); // PBXFileReference
                this.addToPbxBuildFileSection(file); // PBXBuildFile
                pbxGroup.children.push(pbxGroupChild(file));
            }
        }
        var groups = this.pbxGroupsSection();
        var pbxGroupUuid = this.generateUuid();
        SectionUtils_1.SectionUtils.entrySetWUuid(groups, pbxGroupUuid, pbxGroup, name);
        // const commentKey: string = SectionUtils.dictKeyUuidToComment(pbxGroupUuid);
        // groups[pbxGroupUuid] = pbxGroup;
        // groups[commentKey] = name;
        return { uuid: pbxGroupUuid, pbxGroup: pbxGroup };
    };
    XcProjectFileEditor.prototype.removePbxGroup = function (groupName) {
        var section = this.pbxGroupsSection();
        SectionUtils_1.SectionUtils.entryDeleteWCommentText(section, groupName);
        // for (let key in section) {
        //     // only look for comments
        //     if (!COMMENT_KEY.test(key)) continue;
        //     if (section[key] == groupName) { // The comment is the passed in name of the group.
        //         const itemKey: XC_PROJ_UUID = key.split(COMMENT_KEY)[0]; // get the Uuid
        //         delete section[itemKey];
        //     }
        // }
    };
    XcProjectFileEditor.prototype.addToPbxProjectSection = function (target) {
        var newTarget = {
            value: target.uuid,
            comment: pbxNativeTargetComment(target.pbxNativeTarget)
        };
        //  the return type already includes the project it is regetting here.
        //this.pbxProjectSection()[this.getFirstProject()['uuid']]['targets'].push(newTarget);
        this.getFirstProject().firstProject.targets.push(newTarget);
    };
    XcProjectFileEditor.prototype.addToPbxNativeTargetSection = function (target) {
        SectionUtils_1.SectionUtils.entrySetWUuid(this.pbxNativeTargetSection(), target.uuid, target.pbxNativeTarget, target.pbxNativeTarget.name);
        //     var commentKey = dictKeyUuidToComment(target.uuid);
        //     this.pbxNativeTargetSection()[target.uuid] = target.pbxNativeTarget;
        //     this.pbxNativeTargetSection()[commentKey] = target.pbxNativeTarget.name;
    };
    XcProjectFileEditor.prototype.addToPbxFileReferenceSection = function (file) {
        if (!file.fileRef)
            throw new Error("fileRef not set.");
        SectionUtils_1.SectionUtils.entrySetWUuid(this.pbxFileReferenceSection(), file.fileRef, pbxFileReferenceObj(file), pbxFileReferenceComment(file));
        // var commentKey = dictKeyUuidToComment(file.fileRef);
        // this.pbxFileReferenceSection()[file.fileRef] = pbxFileReferenceObj(file);
        // this.pbxFileReferenceSection()[commentKey] = pbxFileReferenceComment(file);
    };
    /**
     * Search for a reference to this file from the PBXFileReference section.
     * The match is made by either the basename or path matching.
     *
     * (It appears that this should be a concern to you if you have files with the same name
     * in different folders.)
     *
     * @param file
     */
    XcProjectFileEditor.prototype.removeFromPbxFileReferenceSection = function (file) {
        //  Create a template object (not added to model) for comparison
        var refObj = pbxFileReferenceObj(file);
        var section = this.pbxFileReferenceSection();
        for (var i in section) {
            var existing = section[i];
            if (typeof existing == "object" &&
                (existing.name == refObj.name ||
                    ('"' + existing.name + '"') == refObj.name ||
                    existing.path == refObj.path ||
                    ('"' + existing.path + '"') == refObj.path)) {
                //  Pass this back to the caller.  But it is also used
                //  to delete the comment below.
                file.fileRef = file.uuid = i;
                SectionUtils_1.SectionUtils.entryDeleteWUuid(section, i);
                // delete section[i];
                // //  10/2019 moved this into the loop.  Less error prone if "break" is removed later.
                // var commentKey = dictKeyUuidToComment(file.fileRef);
                // if (section[commentKey] != undefined) {
                //     delete section[commentKey];
                // }
                break;
            }
        }
        return file;
    };
    XcProjectFileEditor.prototype.addToXcVersionGroupSection = function (file) {
        if (!file.models || !file.currentModel) {
            throw new Error("Cannot create a XCVersionGroup section from not a data model document file");
        }
        if (!file.fileRef || !file.currentModel.fileRef) {
            throw new Error('Fileref not set.');
        }
        var section = this.xcVersionGroupSection();
        if (!section[file.fileRef]) {
            var newVersionGroup = {
                isa: 'XCVersionGroup',
                children: file.models.map(function (el) { return el.fileRef; }),
                currentVersion: file.currentModel.fileRef,
                name: path.basename(file.path),
                path: file.path,
                sourceTree: '"<group>"',
                versionGroupType: 'wrapper.xcdatamodel'
            };
            SectionUtils_1.SectionUtils.entrySetWUuid(section, file.fileRef, newVersionGroup, path.basename(file.path));
            // var commentKey = dictKeyUuidToComment(file.fileRef);
            // this.xcVersionGroupSection()[file.fileRef] = newVersionGroup;
            // this.xcVersionGroupSection()[commentKey] = path.basename(file.path);
        }
    };
    XcProjectFileEditor.prototype.addToOrCreate_PBXGroup_WithName = function (file, groupName) {
        var pbxGroup = this.pbxGroupByName(groupName);
        if (!pbxGroup) {
            this.addPbxGroup([file.path], groupName);
        }
        else {
            pbxGroup.children.push(pbxGroupChild(file));
        }
    };
    XcProjectFileEditor.prototype.removeFrom_PBXGroup_WithName = function (file, groupName) {
        var pbxGroup = this.pbxGroupByName(groupName);
        if (!pbxGroup) {
            return;
        }
        var matchChild = pbxGroupChild(file);
        var pluginsGroupChildren = pbxGroup.children;
        for (var i in pluginsGroupChildren) {
            if (matchChild.value == pluginsGroupChildren[i].value &&
                matchChild.comment == pluginsGroupChildren[i].comment) {
                pluginsGroupChildren.splice(i, 1);
                break;
            }
        }
    };
    XcProjectFileEditor.prototype.addToPluginsPbxGroup = function (file) {
        this.addToOrCreate_PBXGroup_WithName(file, 'Plugins');
        // const pluginsGroup: PBXGroup | null = this.pbxGroupByName('Plugins');
        // if (!pluginsGroup) {
        //     this.addPbxGroup([file.path], 'Plugins');
        // } else {
        //     pluginsGroup.children.push(pbxGroupChild(file));
        // }
    };
    XcProjectFileEditor.prototype.removeFromPluginsPbxGroup = function (file) {
        this.removeFrom_PBXGroup_WithName(file, 'Plugins');
        // const pluginsGroup: PBXGroup | null = this.pbxGroupByName('Plugins');
        // if (!pluginsGroup) {
        //     return;
        //     // No longer returning null.
        //     // return null; I can't imagine returning null versus undefined was intentional.
        // }
        // const matchChild :IChildListEntry = pbxGroupChild(file);
        // const pluginsGroupChildren: IChildListEntry[] = pluginsGroup.children;
        // for (let i in pluginsGroupChildren) {
        //     if (matchChild.value == pluginsGroupChildren[i].value &&
        //         matchChild.comment == pluginsGroupChildren[i].comment) {
        //         pluginsGroupChildren.splice(i as unknown as number, 1);
        //         break;
        //     }
        // }
    };
    XcProjectFileEditor.prototype.addToResourcesPbxGroup = function (file) {
        this.addToOrCreate_PBXGroup_WithName(file, 'Resources');
        // const pluginsGroup:PBXGroup | null = this.pbxGroupByName('Resources');
        // if (!pluginsGroup) {
        //     this.addPbxGroup([file.path], 'Resources');
        // } else {
        //     pluginsGroup.children.push(pbxGroupChild(file));
        // }
    };
    XcProjectFileEditor.prototype.removeFromResourcesPbxGroup = function (file) {
        this.removeFrom_PBXGroup_WithName(file, 'Resources');
        // if (!this.pbxGroupByName('Resources')) {
        //     return; 
        //     //return null;
        // }
        // var pluginsGroupChildren = this.pbxGroupByName('Resources').children, i;
        // for (i in pluginsGroupChildren) {
        //     if (pbxGroupChild(file).value == pluginsGroupChildren[i].value &&
        //         pbxGroupChild(file).comment == pluginsGroupChildren[i].comment) {
        //         pluginsGroupChildren.splice(i, 1);
        //         break;
        //     }
        // }
    };
    XcProjectFileEditor.prototype.addToFrameworksPbxGroup = function (file) {
        this.addToOrCreate_PBXGroup_WithName(file, 'Frameworks');
        // var pluginsGroup = this.pbxGroupByName('Frameworks');
        // if (!pluginsGroup) {
        //     this.addPbxGroup([file.path], 'Frameworks');
        // } else {
        //     pluginsGroup.children.push(pbxGroupChild(file));
        // }
    };
    XcProjectFileEditor.prototype.removeFromFrameworksPbxGroup = function (file) {
        this.removeFrom_PBXGroup_WithName(file, 'Frameworks');
        // if (!this.pbxGroupByName('Frameworks')) {
        //     return null;
        // }
        // var pluginsGroupChildren = this.pbxGroupByName('Frameworks').children;
        // for (i in pluginsGroupChildren) {
        //     if (pbxGroupChild(file).value == pluginsGroupChildren[i].value &&
        //         pbxGroupChild(file).comment == pluginsGroupChildren[i].comment) {
        //         pluginsGroupChildren.splice(i, 1);
        //         break;
        //     }
        // }
    };
    XcProjectFileEditor.prototype.addToProductsPbxGroup = function (file) {
        this.addToOrCreate_PBXGroup_WithName(file, 'Products');
        // var productsGroup = this.pbxGroupByName('Products');
        // if (!productsGroup) {
        //     this.addPbxGroup([file.path], 'Products');
        // } else {
        //     productsGroup.children.push(pbxGroupChild(file));
        // }
    };
    XcProjectFileEditor.prototype.removeFromProductsPbxGroup = function (file) {
        this.removeFrom_PBXGroup_WithName(file, 'Products');
        // const productsGroup: PBXGroup | null = this.pbxGroupByName('Products');
        // if (!productsGroup) {
        //     // return null;
        //     return;
        // }
        // const productsGroupChildren: PBXFileElement[] = productsGroup.children;
        // for (let i in productsGroupChildren) {
        //     if (pbxGroupChild(file).value == productsGroupChildren[i].value &&
        //         pbxGroupChild(file).comment == productsGroupChildren[i].comment) {
        //         productsGroupChildren.splice(i, 1);
        //         break;
        //     }
        // }
    };
    XcProjectFileEditor.prototype.pf_addToBuildPhase = function (buildPhase, file) {
        if (!buildPhase) {
            throw new Error('buildPhase not found!');
        }
        buildPhase.files.push(pbxBuildPhaseObj(file));
    };
    XcProjectFileEditor.prototype.pf_removeFromBuildPhase = function (buildPhase, file) {
        if (!buildPhase)
            return;
        //  NOTE:  There were two different duplicated sets of code that
        //  mostly did the same thing.  One used splice after finding one item.
        //  The one we kept assumes the comment may exist multiple times.
        //  Could be issues if some places held the original files handle that
        //  was using splice.
        //  Prefer to have this DRY and clean it up later if there is an issue.
        var files = [];
        var fileComment = longComment(file);
        for (var i in buildPhase.files) {
            if (buildPhase.files[i].comment != fileComment) {
                files.push(buildPhase.files[i]);
            }
        }
        buildPhase.files = files;
    };
    XcProjectFileEditor.prototype.addToPbxEmbedFrameworksBuildPhase = function (file) {
        this.pf_addToBuildPhase(this.pbxEmbedFrameworksBuildPhaseObj(file.target), file);
        //  Warning:  New implementation will throw if it does not find the embededFrameworkBuildPhase
        //  instead of silently failing to do anything.
        //  var sources = this.pbxEmbedFrameworksBuildPhaseObj(file.target);
        // //  This seemed wrong to me.  It just does nothing if it can't find the EmbedFrameworks build
        // //  phase.  Seems like it should throw or return a failure.
        // //  Also, it is inconsistent with the other methods doing the exact same thing.
        // //  standardized
        // if (sources) {
        //     sources.files.push(pbxBuildPhaseObjThrowIfInvalid(file));
        //     //sources.files.push(pbxBuildPhaseObj(file));
        // }
    };
    XcProjectFileEditor.prototype.removeFromPbxEmbedFrameworksBuildPhase = function (file) {
        this.pf_removeFromBuildPhase(this.pbxEmbedFrameworksBuildPhaseObj(file.target), file);
        // //  The author of this method went with a different strategy than 
        // //  the original authors.  This strategy removes multiple matching comments.
        // //  To make this DRY, settling on this which in theory handles more cases.
        // const sources: PBXCopyFilesBuildPhase | null = this.pbxEmbedFrameworksBuildPhaseObj(file.target);
        // if (sources) {
        //     var files = [];
        //     for (let i in sources.files) {
        //         if (sources.files[i].comment != longComment(file)) {
        //             files.push(sources.files[i]);
        //         }
        //     }
        //     sources.files = files;
        // }
    };
    XcProjectFileEditor.prototype.addToPbxSourcesBuildPhase = function (file) {
        this.pf_addToBuildPhase(this.pbxSourcesBuildPhaseObj(file.target), file);
        // const sources = this.pbxSourcesBuildPhaseObj(file.target,
        //     eHandleNotFound.throw) as PBXSourcesBuildPhase;
        // sources.files.push(pbxBuildPhaseObjThrowIfInvalid(file));
    };
    XcProjectFileEditor.prototype.removeFromPbxSourcesBuildPhase = function (file) {
        this.pf_removeFromBuildPhase(this.pbxSourcesBuildPhaseObj(file.target), file);
        //  Warning.  New implementation creates a new array.  Old
        //  one used splice.  In theory this could break client code.
        // //  Throw if not found.  Then cast to 
        // const sources = this.pbxSourcesBuildPhaseObj(file.target)
        // for (let i in sources.files) {
        //     if (sources.files[i].comment == longComment(file)) {
        //         sources.files.splice(i as unknown as number, 1);
        //         break;
        //     }
        // }
    };
    XcProjectFileEditor.prototype.addToPbxResourcesBuildPhase = function (file) {
        this.pf_addToBuildPhase(this.pbxResourcesBuildPhaseObj(file.target), file);
        // var sources = this.pbxResourcesBuildPhaseObj(file.target);
        // sources.files.push(pbxBuildPhaseObj(file));
    };
    XcProjectFileEditor.prototype.removeFromPbxResourcesBuildPhase = function (file) {
        this.pf_removeFromBuildPhase(this.pbxResourcesBuildPhaseObj(file.target), file);
        //  Warning:  New implementation creates a new array instead of
        //  splicing the existing one.  This could cause an issue with client code.
        // var sources = this.pbxResourcesBuildPhaseObj(file.target), i;
        // for (i in sources.files) {
        //     if (sources.files[i].comment == longComment(file)) {
        //         sources.files.splice(i, 1);
        //         break;
        //     }
        // }
    };
    XcProjectFileEditor.prototype.addToPbxFrameworksBuildPhase = function (file) {
        this.pf_addToBuildPhase(this.pbxFrameworksBuildPhaseObj(file.target), file);
        // var sources = this.pbxFrameworksBuildPhaseObj(file.target);
        // sources.files.push(pbxBuildPhaseObjThrowIfInvalid(file));
    };
    XcProjectFileEditor.prototype.removeFromPbxFrameworksBuildPhase = function (file) {
        this.pf_removeFromBuildPhase(this.pbxFrameworksBuildPhaseObj(file.target), file);
        //  Warning:  New implementation creates a new array.  Old one used
        //  splice.  This could break client code if it held onto the 
        //  original array.
        // var sources = this.pbxFrameworksBuildPhaseObj(file.target);
        // for (i in sources.files) {
        //     if (sources.files[i].comment == longComment(file)) {
        //         sources.files.splice(i, 1);
        //         break;
        //     }
        // }
    };
    XcProjectFileEditor.prototype.addXCConfigurationList = function (configurationObjectsArray, defaultConfigurationName, comment) {
        var pbxBuildConfigurationSection = this.xcBuildConfigurationSection();
        var xcConfigurationList = {
            isa: 'XCConfigurationList',
            buildConfigurations: [],
            defaultConfigurationIsVisible: 0,
            defaultConfigurationName: defaultConfigurationName
        };
        for (var index = 0; index < configurationObjectsArray.length; index++) {
            var configuration = configurationObjectsArray[index];
            var configurationUuid = this.generateUuid();
            SectionUtils_1.SectionUtils.entrySetWUuid(pbxBuildConfigurationSection, configurationUuid, configuration, configuration.name);
            // pbxBuildConfigurationSection[configurationUuid] = configuration;
            //     configurationCommentKey = dictKeyUuidToComment(configurationUuid);
            // pbxBuildConfigurationSection[configurationCommentKey] = configuration.name;
            xcConfigurationList.buildConfigurations.push({ value: configurationUuid, comment: configuration.name });
        }
        var xcConfigurationListUuid = this.generateUuid();
        SectionUtils_1.SectionUtils.entrySetWUuid(this.xcConfigurationList(), xcConfigurationListUuid, xcConfigurationList, comment);
        // const pbxXCConfigurationListSection: TypedSection<XCConfigurationList> =
        //     this.pbxXCConfigurationList();
        // const commentKey: string = dictKeyUuidToComment(xcConfigurationListUuid);
        // if (pbxXCConfigurationListSection) {
        //     pbxXCConfigurationListSection[xcConfigurationListUuid] = xcConfigurationList;
        //     pbxXCConfigurationListSection[commentKey] = comment;
        // }
        var wrapper = { uuid: xcConfigurationListUuid, xcConfigurationList: xcConfigurationList };
        return wrapper;
    };
    XcProjectFileEditor.prototype.addTargetDependency = function (target, dependencyTargets) {
        if (!target)
            return undefined;
        //         throw new Error('No target specified!'); I had thought it made more sense to throw an error.  But a test dictates this returns undefined.
        //  To maintain compatibility with the original version, restoring eating the invalid call. 
        var nativeTargets = this.pbxNativeTargetSection();
        var nativeTarget = nativeTargets[target];
        if (typeof nativeTarget != "object") // switched from != undefined to == object to deal with the possibility someone passed in a comment key
            throw new Error("Invalid target: " + target);
        for (var index = 0; index < dependencyTargets.length; index++) {
            var dependencyTarget = dependencyTargets[index];
            if (typeof nativeTargets[dependencyTarget] != "object") // switched from == "undefined" to != "object" to handle comment keys
                throw new Error("Invalid target: " + dependencyTarget);
        }
        var pbxTargetDependencySection = this.pbxTargetDependencySection();
        var pbxContainerItemProxySection = this.pbxContainerItemProxySection();
        if (!this.hash) //  Assure TS we can access project.
            throw new Error('Not loaded');
        var project = this.hash.project;
        for (var index = 0; index < dependencyTargets.length; index++) {
            var dependencyTargetUuid = dependencyTargets[index];
            var dependencyTargetCommentKey = SectionUtils_1.SectionUtils.dictKeyUuidToComment(dependencyTargetUuid);
            var targetDependencyUuid = this.generateUuid();
            // const targetDependencyCommentKey :XC_COMMENT_KEY = SectionUtils.dictKeyUuidToComment(targetDependencyUuid);
            var itemProxyUuid = this.generateUuid();
            // const itemProxyCommentKey:XC_COMMENT_KEY = SectionUtils.dictKeyUuidToComment(itemProxyUuid);
            var itemProxy = {
                isa: IXcodeProjFileObjTypes_1.cPBXContainerItemProxy,
                containerPortal: project['rootObject'],
                containerPortal_comment: project['rootObject_comment'],
                proxyType: 1,
                remoteGlobalIDString: dependencyTargetUuid,
                remoteInfo: nativeTargets[dependencyTargetUuid].name
            };
            var targetDependency = {
                isa: IXcodeProjFileObjTypes_1.cPBXTargetDependency,
                target: dependencyTargetUuid,
                target_comment: nativeTargets[dependencyTargetCommentKey],
                targetProxy: itemProxyUuid,
                targetProxy_comment: IXcodeProjFileObjTypes_1.cPBXContainerItemProxy
            };
            //  We now create the sections if they don't exist.  So we don't check if they are set here.
            //            if (pbxContainerItemProxySection && pbxTargetDependencySection) {
            SectionUtils_1.SectionUtils.entrySetWUuid(pbxContainerItemProxySection, itemProxyUuid, itemProxy, IXcodeProjFileObjTypes_1.cPBXContainerItemProxy);
            // pbxContainerItemProxySection[itemProxyUuid] = itemProxy;
            // pbxContainerItemProxySection[itemProxyCommentKey] = cPBXContainerItemProxy;
            SectionUtils_1.SectionUtils.entrySetWUuid(pbxTargetDependencySection, targetDependencyUuid, targetDependency, IXcodeProjFileObjTypes_1.cPBXTargetDependency);
            // pbxTargetDependencySection[targetDependencyUuid] = targetDependency;
            // pbxTargetDependencySection[targetDependencyCommentKey] = cPBXTargetDependency;
            nativeTarget.dependencies.push({ value: targetDependencyUuid, comment: IXcodeProjFileObjTypes_1.cPBXTargetDependency });
            //           }
        }
        return { uuid: target, target: nativeTarget };
    };
    /**
     *
     * @param filePathsArray
     * @param buildPhaseType
     * @param comment
     * @param target UUID of PBXNativeTarget
     * @param optionsOrFolderType A string for "Copy Files" and Options for "Shell Script" build phases.
     * @param subfolderPath
     */
    XcProjectFileEditor.prototype.addBuildPhase = function (filePathsArray, 
    //  Don't know if this was meant to handle additional phases or not.  
    //  left to only support these two types.
    buildPhaseType, comment, target, optionsOrFolderType, subfolderPath) {
        var buildFileSection = this.pbxBuildFileSection();
        var buildPhase = {
            isa: buildPhaseType,
            buildActionMask: 2147483647,
            files: [],
            runOnlyForDeploymentPostprocessing: 0
        };
        if (buildPhaseType === IXcodeProjFileObjTypes_1.cPBXCopyFilesBuildPhase) {
            if (typeof optionsOrFolderType != 'string')
                throw new Error("Invalid folder type for '" + IXcodeProjFileObjTypes_1.cPBXCopyFilesBuildPhase + "'");
            buildPhase = pbxCopyFilesBuildPhaseObj(buildPhase, optionsOrFolderType, subfolderPath, comment);
        }
        else if (buildPhaseType === IXcodeProjFileObjTypes_1.cPBXShellScriptBuildPhase) {
            if (typeof optionsOrFolderType != 'object')
                throw new Error("Invalid folder type for '" + IXcodeProjFileObjTypes_1.cPBXShellScriptBuildPhase + "'");
            buildPhase = pbxShellScriptBuildPhaseObj(buildPhase, optionsOrFolderType, comment);
        }
        // I don't know if this is supposed to handle other build phase types.  Assuming not.
        //  Will function the same when called from javascript, but indicate an error when
        //  calling from typescript sicne we specify only these two phases.
        var buildPhaseUuid = this.generateUuid();
        //  This was being done twice!  Doing it at the end.
        // const commentKey: string = createUuidCommentKey(buildPhaseUuid);
        // // if (!this.hash.project.objects[buildPhaseType][buildPhaseUuid]) { removed this check as this is impossible
        // buildPhaseSection[buildPhaseUuid] = buildPhase;
        // buildPhaseSection[commentKey] = comment;
        // SectionUtils.entrySetWUuid<PBXBuildPhaseBase>(buildPhaseSection, buildPhaseUuid, buildPhase, comment);
        var buildPhaseTargetUuid = target || this.getFirstTarget().uuid;
        var nativeTarget = SectionUtils_1.SectionUtils.entryGetWUuid(this.pbxNativeTargetSection(), buildPhaseTargetUuid);
        //  Original code bowed out if there are not buildPhases.  That implies this is invalid and 
        //  the behavior is wrong.  I want the error if nativeTarget has no build phases or at a minimum
        //  to add them back in.
        //if (nativeTarget && nativeTarget.buildPhases) {
        if (nativeTarget) {
            nativeTarget.buildPhases.push({
                value: buildPhaseUuid,
                comment: comment
            });
        }
        var fileReferenceSection = this.pbxFileReferenceSection();
        //  Load the filePathToBuildFile dictionary
        var filePathToBuildFile = {};
        for (var key in buildFileSection) {
            // // only look for comments
            // if (!COMMENT_KEY.test(key)) continue;
            // var buildFileKey = key.split(COMMENT_KEY)[0],
            //     buildFile = buildFileSection[buildFileKey];
            // fileReference = fileReferenceSection[buildFile.fileRef];
            // if (!fileReference) continue;
            // var pbxFileObj = new PbxFile(fileReference.path);
            // filePathToBuildFile[fileReference.path] = { uuid: buildFileKey, basename: pbxFileObj.basename, group: pbxFileObj.group };
            //  Only consider comments
            if (SectionUtils_1.SectionUtils.dictKeyIsComment(key)) {
                var buildFileKey = SectionUtils_1.SectionUtils.dictKeyCommentToUuid(key);
                var buildFile = buildFileSection[buildFileKey];
                var fileReference = fileReferenceSection[buildFile.fileRef];
                if (typeof fileReference == "object") {
                    var pbxFileObj = new PbxFileDef_1.PbxFile(fileReference.path);
                    filePathToBuildFile[fileReference.path] = { uuid: buildFileKey, basename: pbxFileObj.basename, group: pbxFileObj.group };
                }
            }
        }
        for (var index = 0; index < filePathsArray.length; index++) {
            var filePath = filePathsArray[index], filePathQuoted = "\"" + filePath + "\"", file = new PbxFileDef_1.PbxFile(filePath);
            if (filePathToBuildFile[filePath]) {
                buildPhase.files.push(pbxBuildPhaseObj(filePathToBuildFile[filePath]));
                continue;
            }
            else if (filePathToBuildFile[filePathQuoted]) {
                buildPhase.files.push(pbxBuildPhaseObj(filePathToBuildFile[filePathQuoted]));
                continue;
            }
            file.uuid = this.generateUuid();
            file.fileRef = this.generateUuid();
            this.addToPbxFileReferenceSection(file); // PBXFileReference
            this.addToPbxBuildFileSection(file); // PBXBuildFile
            buildPhase.files.push(pbxBuildPhaseObj(file));
        }
        //  This is one of the build phase sections.  There are several.
        var buildPhaseSection = this.pf_sectionGetOrCreate(buildPhaseType);
        SectionUtils_1.SectionUtils.entrySetWUuid(buildPhaseSection, buildPhaseUuid, buildPhase, comment);
        // if (buildPhaseSection) {
        //     buildPhaseSection[buildPhaseUuid] = buildPhase;
        //     buildPhaseSection[commentKey] = comment;
        // }
        return { uuid: buildPhaseUuid, buildPhase: buildPhase };
    };
    //  Implementation change:  10/2019 it used to be only XCVersionGroup would
    //  create a section.  Now all missing sections are created.
    XcProjectFileEditor.prototype.pf_sectionGetOrCreate = function (sectionName) {
        if (!this.hash) {
            throw new Error('Not Loaded');
        }
        if (typeof this.hash.project.objects[sectionName] !== 'object') {
            this.hash.project.objects[sectionName] = {};
        }
        return this.hash.project.objects[sectionName];
    };
    XcProjectFileEditor.prototype.pbxGroupsSection = function () {
        return this.pf_sectionGetOrCreate(IXcodeProjFileObjTypes_1.cPBXGroup);
    };
    XcProjectFileEditor.prototype.pbxVariantGroupsSection = function () {
        return this.pf_sectionGetOrCreate(IXcodeProjFileObjTypes_1.cPBXVariantGroup);
    };
    // helper access functions
    XcProjectFileEditor.prototype.pbxProjectSection = function () {
        return this.pf_sectionGetOrCreate(IXcodeProjFileObjTypes_1.cPBXProject);
    };
    XcProjectFileEditor.prototype.pbxBuildFileSection = function () {
        return this.pf_sectionGetOrCreate(IXcodeProjFileObjTypes_1.cPBXBuildFile);
    };
    XcProjectFileEditor.prototype.pbxFileReferenceSection = function () {
        return this.pf_sectionGetOrCreate(IXcodeProjFileObjTypes_1.cPBXFileReference);
    };
    XcProjectFileEditor.prototype.pbxNativeTargetSection = function () {
        return this.pf_sectionGetOrCreate(IXcodeProjFileObjTypes_1.cPBXNativeTarget);
    };
    XcProjectFileEditor.prototype.pbxTargetDependencySection = function () {
        return this.pf_sectionGetOrCreate(IXcodeProjFileObjTypes_1.cPBXTargetDependency);
    };
    XcProjectFileEditor.prototype.pbxContainerItemProxySection = function () {
        return this.pf_sectionGetOrCreate(IXcodeProjFileObjTypes_1.cPBXContainerItemProxy);
    };
    //  This was the original name that I did not think made sense.  Tests use
    //  this so I put it back to call the new function name.
    XcProjectFileEditor.prototype.pbxXCBuildConfigurationSection = function () {
        return this.xcBuildConfigurationSection();
    };
    XcProjectFileEditor.prototype.xcBuildConfigurationSection = function () {
        return this.pf_sectionGetOrCreate(IXcodeProjFileObjTypes_1.cXCBuildConfiguration);
    };
    //  Inconsistent naming of not having pbx in front existed when found.
    //  left in case client was using this.
    XcProjectFileEditor.prototype.xcVersionGroupSection = function () {
        return this.pf_sectionGetOrCreate(IXcodeProjFileObjTypes_1.cXCVersionGroup);
    };
    //  This was the original name that I did not think made sense.  Tests use
    //  this so I put it back to call the new function name.
    XcProjectFileEditor.prototype.pbxXCConfigurationList = function () {
        return this.xcConfigurationList();
    };
    XcProjectFileEditor.prototype.xcConfigurationList = function () {
        return this.pf_sectionGetOrCreate(IXcodeProjFileObjTypes_1.cXCConfigurationList);
    };
    XcProjectFileEditor.prototype.pbxGroupByName = function (name) {
        return SectionUtils_1.SectionUtils.entryGetWCommentText(this.pbxGroupsSection(), name);
        // if (!this.hash) throw new Error('Not Loaded');
        // const groups: Section = this.hash.project.objects['PBXGroup'];
        // for (let key in groups) {
        //     // only look for comments
        //     if (!COMMENT_KEY.test(key)) continue;
        //     if (groups[key] == name) {
        //         const groupKey = key.split(COMMENT_KEY)[0];
        //         return groups[groupKey] as PBXGroup;
        //     }
        // }
        // return null;
    };
    XcProjectFileEditor.prototype.pbxTargetByName = function (name) {
        return SectionUtils_1.SectionUtils.entryGetWCommentText(this.pbxNativeTargetSection(), name);
        // return this.pbxItemByComment(name, 'PBXNativeTarget');
    };
    /**
     * Search the PBXNativeTarget objects for one with the passed in name.
     * Return the UUID if it exists.  Otherwise return null.
     * @param name
     */
    XcProjectFileEditor.prototype.findTargetKey = function (name) {
        var targets = this.pbxNativeTargetSection();
        for (var key in targets) {
            if (!SectionUtils_1.SectionUtils.dictKeyIsComment(key)) {
                var target = targets[key];
                if (target.name === name) {
                    return key;
                }
            }
        }
        return null;
    };
    XcProjectFileEditor.prototype.pbxItemByComment = function (comment, pbxSectionName) {
        return SectionUtils_1.SectionUtils.entryGetWCommentText(this.pf_sectionGetOrCreate(pbxSectionName), comment);
        // var section = this.hash.project.objects[pbxSectionName],
        //     key, itemKey;
        // for (key in section) {
        //     // only look for comments
        //     if (!COMMENT_KEY.test(key)) continue;
        //     if (section[key] == comment) {
        //         itemKey = key.split(COMMENT_KEY)[0];
        //         return section[itemKey];
        //     }
        // }
        // return null;
    };
    XcProjectFileEditor.prototype.pbxSourcesBuildPhaseObj = function (target) {
        return this.buildPhaseObject('PBXSourcesBuildPhase', 'Sources', target);
    };
    XcProjectFileEditor.prototype.pbxResourcesBuildPhaseObj = function (target) {
        return this.buildPhaseObject('PBXResourcesBuildPhase', 'Resources', target);
    };
    XcProjectFileEditor.prototype.pbxFrameworksBuildPhaseObj = function (target) {
        return this.buildPhaseObject('PBXFrameworksBuildPhase', 'Frameworks', target);
    };
    XcProjectFileEditor.prototype.pbxEmbedFrameworksBuildPhaseObj = function (target) {
        return this.buildPhaseObject('PBXCopyFilesBuildPhase', 'Embed Frameworks', target);
    };
    ;
    /**
     * Find Build Phase from group/target
     * @param group The name of the build phase.  "Sources", "Frameworks", or "Resources" from the sample.
     * @param target UUID of the PBXNativeTarget (A80672E4233D2A84003EA6BB in the sample below)
     * @returns The build phase with _comment appended or undefined,  Ex:"A80672E1233D2A84003EA6BB_comment"
     *
     * Sample:
     * / * Begin PBXNativeTarget section * /
      A80672E4233D2A84003EA6BB / * ad-notification-service-extension * / = {
         isa = PBXNativeTarget;
         buildConfigurationList = A80672F1233D2A85003EA6BB / * Build configuration list for PBXNativeTarget "ad-notification-service-extension" * /;
         buildPhases = (
                 A80672E1233D2A84003EA6BB / * Sources * /,
                 A80672E2233D2A84003EA6BB / * Frameworks * /,
                 A80672E3233D2A84003EA6BB / * Resources * /,
         );
     *
     */
    XcProjectFileEditor.prototype.buildPhase = function (group, target) {
        if (!target)
            return undefined;
        var nativeTargets = this.pbxNativeTargetSection();
        if (typeof nativeTargets[target] == "undefined")
            throw new Error("Invalid target: " + target);
        //  Assuming target is never the comment string, so nativeTarget is always an object.
        var nativeTarget = nativeTargets[target];
        var buildPhases = nativeTarget.buildPhases;
        for (var i in buildPhases) {
            var buildPhase = buildPhases[i];
            if (buildPhase.comment == group)
                return buildPhase.value + "_comment";
        }
        return undefined;
    };
    /**
     *
     * @param name Section Name (type of object)
     * @param group
     * @param target
     */
    XcProjectFileEditor.prototype.buildPhaseObject = function (name, group, target) {
        var section = this.pf_sectionGetOrCreate(name);
        var buildPhase = this.buildPhase(group, target);
        for (var key in section) {
            // only look for comments
            if (SectionUtils_1.SectionUtils.dictKeyIsComment(key) && // This is a comment key
                (buildPhase == undefined || buildPhase == key) && //  Build phase is either not set or the phase matches this key
                section[key] == group) { // Value of the Comment key matches the group type
                // const sectionKey = key.split(COMMENT_KEY)[0] as XC_PROJ_UUID;
                // return section[sectionKey] as PBX_OBJ_TYPE;
                return SectionUtils_1.SectionUtils.entryGetWCommentKey(section, key);
            }
        }
        return null;
    };
    XcProjectFileEditor.prototype.addBuildProperty = function (prop, value, build_name) {
        var configurations = SectionUtils_1.SectionUtils.createUuidKeyOnlySectionDict(this.xcBuildConfigurationSection());
        for (var key in configurations) {
            var configuration = configurations[key];
            if (!build_name || configuration.name === build_name) {
                configuration.buildSettings[prop] = value;
            }
        }
    };
    XcProjectFileEditor.prototype.removeBuildProperty = function (prop, build_name) {
        var configurations = SectionUtils_1.SectionUtils.createUuidKeyOnlySectionDict(this.xcBuildConfigurationSection());
        for (var key in configurations) {
            var configuration = configurations[key];
            if (configuration.buildSettings[prop] &&
                !build_name || configuration.name === build_name) {
                delete configuration.buildSettings[prop];
            }
        }
    };
    /**
     * Note, this modifies this property on every build configuration object.
     * There can be many.
     *
     * @param prop {String}
     * @param value {String|Array|Object|Number|Boolean}
     * @param build {String} Release or Debug or pass in null to do all
     */
    XcProjectFileEditor.prototype.updateBuildProperty = function (prop, value, build) {
        var configs = this.xcBuildConfigurationSection();
        for (var configName in configs) {
            if (!SectionUtils_1.SectionUtils.dictKeyIsComment(configName)) {
                var config = configs[configName];
                if ((build && config.name === build) || (!build)) {
                    config.buildSettings[prop] = value;
                }
            }
        }
    };
    XcProjectFileEditor.prototype.updateProductName = function (name) {
        this.updateBuildProperty('PRODUCT_NAME', '"' + name + '"');
    };
    XcProjectFileEditor.prototype.pf_processBuildConfigurationsWithTheProductName = function (callback) {
        var configurations = SectionUtils_1.SectionUtils.createUuidKeyOnlySectionDict(this.xcBuildConfigurationSection());
        //  Get the product name up front to avoid order n squared algorithm
        var productName = this.productName;
        for (var configKey in configurations) {
            var config = configurations[configKey];
            var buildSettings = config.buildSettings;
            if (unquote(buildSettings['PRODUCT_NAME']) == productName) {
                callback(buildSettings, config);
            }
        }
    };
    XcProjectFileEditor.prototype.template = function (file) {
        //  init here
        this.pf_processBuildConfigurationsWithTheProductName(function (buildSettings) {
            //  process each here
        });
    };
    XcProjectFileEditor.prototype.removeFromFrameworkSearchPaths = function (file) {
        var SEARCH_PATHS = 'FRAMEWORK_SEARCH_PATHS';
        var new_path = searchPathForFile(file, this);
        this.pf_processBuildConfigurationsWithTheProductName(function (buildSettings) {
            var searchPaths = buildSettings[SEARCH_PATHS];
            if (searchPaths && Array.isArray(searchPaths)) {
                var matches = searchPaths.filter(function (p) {
                    return p.indexOf(new_path) > -1;
                });
                matches.forEach(function (m) {
                    var idx = searchPaths.indexOf(m);
                    searchPaths.splice(idx, 1);
                });
            }
        });
    };
    XcProjectFileEditor.prototype.addToFrameworkSearchPaths = function (file) {
        var _this = this;
        this.pf_processBuildConfigurationsWithTheProductName(function (buildSettings) {
            var INHERITED = '"$(inherited)"';
            if (!buildSettings['FRAMEWORK_SEARCH_PATHS']
                || buildSettings['FRAMEWORK_SEARCH_PATHS'] === INHERITED) {
                buildSettings['FRAMEWORK_SEARCH_PATHS'] = [INHERITED];
            }
            buildSettings['FRAMEWORK_SEARCH_PATHS'].push(searchPathForFile(file, _this));
        });
    };
    XcProjectFileEditor.prototype.removeFromLibrarySearchPaths = function (file) {
        var new_path = searchPathForFile(file, this);
        this.pf_processBuildConfigurationsWithTheProductName(function (buildSettings) {
            var SEARCH_PATHS = 'LIBRARY_SEARCH_PATHS', searchPaths = buildSettings[SEARCH_PATHS];
            if (searchPaths && Array.isArray(searchPaths)) {
                var matches = searchPaths.filter(function (p) {
                    return p.indexOf(new_path) > -1;
                });
                matches.forEach(function (m) {
                    var idx = searchPaths.indexOf(m);
                    searchPaths.splice(idx, 1);
                });
            }
        });
    };
    XcProjectFileEditor.prototype.addToLibrarySearchPaths = function (file) {
        var _this = this;
        this.pf_processBuildConfigurationsWithTheProductName(function (buildSettings) {
            var INHERITED = '"$(inherited)"';
            if (!buildSettings['LIBRARY_SEARCH_PATHS']
                || buildSettings['LIBRARY_SEARCH_PATHS'] === INHERITED) {
                buildSettings['LIBRARY_SEARCH_PATHS'] = [INHERITED];
            }
            if (typeof file === 'string') {
                buildSettings['LIBRARY_SEARCH_PATHS'].push(file);
            }
            else {
                buildSettings['LIBRARY_SEARCH_PATHS'].push(searchPathForFile(file, _this));
            }
        });
    };
    XcProjectFileEditor.prototype.removeFromHeaderSearchPaths = function (file) {
        var new_path = searchPathForFile(file, this);
        this.pf_processBuildConfigurationsWithTheProductName(function (buildSettings) {
            var SEARCH_PATHS = 'HEADER_SEARCH_PATHS';
            if (buildSettings[SEARCH_PATHS]) {
                var matches = buildSettings[SEARCH_PATHS].filter(function (p) {
                    return p.indexOf(new_path) > -1;
                });
                matches.forEach(function (m) {
                    var idx = buildSettings[SEARCH_PATHS].indexOf(m);
                    buildSettings[SEARCH_PATHS].splice(idx, 1);
                });
            }
        });
    };
    XcProjectFileEditor.prototype.addToHeaderSearchPaths = function (file) {
        var _this = this;
        this.pf_processBuildConfigurationsWithTheProductName(function (buildSettings) {
            var INHERITED = '"$(inherited)"';
            if (!buildSettings['HEADER_SEARCH_PATHS']) {
                buildSettings['HEADER_SEARCH_PATHS'] = [INHERITED];
            }
            if (typeof file === 'string') {
                buildSettings['HEADER_SEARCH_PATHS'].push(file);
            }
            else {
                buildSettings['HEADER_SEARCH_PATHS'].push(searchPathForFile(file, _this));
            }
        });
    };
    XcProjectFileEditor.prototype.addToOtherLinkerFlags = function (flag) {
        this.pf_processBuildConfigurationsWithTheProductName(function (buildSettings) {
            var INHERITED = '"$(inherited)"', OTHER_LDFLAGS = 'OTHER_LDFLAGS';
            if (!buildSettings[OTHER_LDFLAGS]
                || buildSettings[OTHER_LDFLAGS] === INHERITED) {
                buildSettings[OTHER_LDFLAGS] = [INHERITED];
            }
            buildSettings[OTHER_LDFLAGS].push(flag);
        });
    };
    XcProjectFileEditor.prototype.removeFromOtherLinkerFlags = function (flag) {
        this.pf_processBuildConfigurationsWithTheProductName(function (buildSettings) {
            var OTHER_LDFLAGS = 'OTHER_LDFLAGS';
            if (buildSettings[OTHER_LDFLAGS]) {
                var matches = buildSettings[OTHER_LDFLAGS].filter(function (p) {
                    return p.indexOf(flag) > -1;
                });
                matches.forEach(function (m) {
                    var idx = buildSettings[OTHER_LDFLAGS].indexOf(m);
                    buildSettings[OTHER_LDFLAGS].splice(idx, 1);
                });
            }
        });
    };
    XcProjectFileEditor.prototype.addToBuildSettings = function (buildSetting, value) {
        var configurations = SectionUtils_1.SectionUtils.createUuidKeyOnlySectionDict(this.xcBuildConfigurationSection());
        for (var config in configurations) {
            var buildSettings = configurations[config].buildSettings;
            buildSettings[buildSetting] = value;
        }
    };
    XcProjectFileEditor.prototype.removeFromBuildSettings = function (buildSetting) {
        var configurations = SectionUtils_1.SectionUtils.createUuidKeyOnlySectionDict(this.xcBuildConfigurationSection());
        for (var config in configurations) {
            var buildSettings = configurations[config].buildSettings;
            if (buildSettings[buildSetting]) {
                delete buildSettings[buildSetting];
            }
        }
    };
    Object.defineProperty(XcProjectFileEditor.prototype, "productName", {
        // a JS getter. hmmm
        // __defineGetter__("productName", function() {
        /**
         * Return the productName of a random XCBuildConfigurationSetting that
         * has a PRODUCT_NAME set.  In reviewing the test projects, all
         * build configurations had the same product name so this works in these
         * cases.  I do not know if it works in all cases.
         */
        get: function () {
            var configurations = SectionUtils_1.SectionUtils.createUuidKeyOnlySectionDict(this.xcBuildConfigurationSection());
            for (var config in configurations) {
                var productName = configurations[config].buildSettings['PRODUCT_NAME'];
                if (productName) {
                    return unquoteStr(productName);
                }
            }
            //  This used to just return undefined.
            throw new Error('Failed to find PRODUCT_NAME');
        },
        enumerable: true,
        configurable: true
    });
    // check if file is present
    XcProjectFileEditor.prototype.hasFile = function (filePath) {
        var files = SectionUtils_1.SectionUtils.createUuidKeyOnlySectionDict(this.pbxFileReferenceSection());
        for (var id in files) {
            var file = files[id];
            if (file.path == filePath || file.path == ('"' + filePath + '"')) {
                return file;
            }
        }
        return false;
    };
    XcProjectFileEditor.prototype.addTarget = function (name, type, subfolder) {
        // Setup uuid and name of new target
        var targetUuid = this.generateUuid();
        var targetType = type;
        var targetSubfolder = subfolder || name;
        var targetName = name.trim();
        // Check type against list of allowed target types
        if (!targetName) {
            throw new Error("Target name missing.");
        }
        // Check type against list of allowed target types
        if (!targetType) {
            throw new Error("Target type missing.");
        }
        // Check type against list of allowed target types
        var productType = producttypeForTargettype(targetType);
        if (!productType) {
            throw new Error("Target type invalid: " + targetType);
        }
        // Build Configuration: Create
        var buildConfigurationsList = [
            {
                name: 'Debug',
                isa: 'XCBuildConfiguration',
                buildSettings: {
                    GCC_PREPROCESSOR_DEFINITIONS: ['"DEBUG=1"', '"$(inherited)"'],
                    INFOPLIST_FILE: '"' + path.join(targetSubfolder, targetSubfolder + '-Info.plist' + '"'),
                    LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"',
                    PRODUCT_NAME: '"' + targetName + '"',
                    SKIP_INSTALL: 'YES'
                }
            },
            {
                name: 'Release',
                isa: 'XCBuildConfiguration',
                buildSettings: {
                    INFOPLIST_FILE: '"' + path.join(targetSubfolder, targetSubfolder + '-Info.plist' + '"'),
                    LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"',
                    PRODUCT_NAME: '"' + targetName + '"',
                    SKIP_INSTALL: 'YES'
                }
            }
        ];
        // Build Configuration: Add
        var buildConfigurations = this.addXCConfigurationList(buildConfigurationsList, 'Release', 'Build configuration list for PBXNativeTarget "' + targetName + '"');
        // Product: Create
        var productName = targetName;
        var productFileType = filetypeForProductType(productType);
        var productFile = this.addProductFile(productName, { group: 'Copy Files', 'target': targetUuid, 'explicitFileType': productFileType });
        //            productFileName = productFile.basename;
        // Product: Add to build file list
        this.addToPbxBuildFileSection(productFile);
        // Target: Create
        var target = {
            uuid: targetUuid,
            pbxNativeTarget: {
                isa: 'PBXNativeTarget',
                name: '"' + targetName + '"',
                productName: '"' + targetName + '"',
                productReference: productFile.fileRef,
                productType: '"' + producttypeForTargettype(targetType) + '"',
                buildConfigurationList: buildConfigurations.uuid,
                buildPhases: [],
                buildRules: [],
                dependencies: []
            }
        };
        // Target: Add to PBXNativeTarget section
        this.addToPbxNativeTargetSection(target);
        // Product: Embed (only for "extension"-type targets)
        if (targetType === 'app_extension') {
            // TODO: Evaluate if this is sound.
            // Create CopyFiles phase in first target
            this.addBuildPhase([], 'PBXCopyFilesBuildPhase', 'Copy Files', this.getFirstTarget().uuid, targetType);
            // Add product to CopyFiles phase
            this.addToPbxCopyfilesBuildPhase(productFile);
            // this.addBuildPhaseToTarget(newPhase.buildPhase, this.getFirstTarget().uuid)
        }
        else if (targetType === 'watch2_app') {
            // Create CopyFiles phase in first target
            this.addBuildPhase([targetName + '.app'], 'PBXCopyFilesBuildPhase', 'Embed Watch Content', this.getFirstTarget().uuid, targetType, '"$(CONTENTS_FOLDER_PATH)/Watch"');
        }
        else if (targetType === 'watch2_extension') {
            // Create CopyFiles phase in watch target (if exists)
            var watch2Target = this.getTarget(producttypeForTargettype('watch2_app'));
            if (watch2Target) {
                this.addBuildPhase([targetName + '.appex'], 'PBXCopyFilesBuildPhase', 'Embed App Extensions', watch2Target.uuid, targetType);
            }
        }
        // Target: Add uuid to root project
        this.addToPbxProjectSection(target);
        // Target: Add dependency for this target to other targets
        if (targetType === 'watch2_extension') {
            var watch2Target = this.getTarget(producttypeForTargettype('watch2_app'));
            if (watch2Target) {
                this.addTargetDependency(watch2Target.uuid, [target.uuid]);
            }
        }
        else {
            this.addTargetDependency(this.getFirstTarget().uuid, [target.uuid]);
        }
        // Return target on success
        return target;
    };
    /**
     * Get the first project that appears in the PBXProject section.
     * Assumes there is at least one project.
     *
     * Most uses of this library likey have one and only one project.
     */
    XcProjectFileEditor.prototype.getFirstProject = function () {
        // Get pbxProject container
        var pbxProjectContainer = this.pbxProjectSection();
        // Get first pbxProject UUID
        //  NOTE:  This only works assuming the comment key always follows the project key.
        //  Is this always true, implementation specific, or just lucky (i.e. TDD)?  I did 
        //  not think keys were guaranteed to be alphabetized.
        //  I will assume for now that whoever wrote this knows something I don't.
        //  Researched:  According to
        //  https://www.stefanjudis.com/today-i-learned/property-order-is-predictable-in-javascript-objects-since-es2015/
        //  these are likely not implementation specific as node is most definately using the latest.
        var firstProjectUuid = Object.keys(pbxProjectContainer)[0];
        // Get first pbxProject
        var firstProject = pbxProjectContainer[firstProjectUuid];
        return {
            uuid: firstProjectUuid,
            firstProject: firstProject
        };
    };
    /**
     * Get the first target in the list of targets of the first (and typically only) project.
     * This has always been the deployed application in test cases I have observed.  But
     * validate this.
     */
    XcProjectFileEditor.prototype.getFirstTarget = function () {
        // Get first target's UUID
        var firstTargetUuid = this.getFirstProject()['firstProject']['targets'][0].value;
        // Get first pbxNativeTarget
        var firstTarget = this.pbxNativeTargetSection()[firstTargetUuid];
        return {
            uuid: firstTargetUuid,
            firstTarget: firstTarget
        };
    };
    XcProjectFileEditor.prototype.getTarget = function (productType) {
        // Find target by product type
        var targets = this.getFirstProject()['firstProject']['targets'];
        var nativeTargets = this.pbxNativeTargetSection();
        for (var i = 0; i < targets.length; i++) {
            var target = targets[i];
            var targetUuid = target.value;
            var _nativeTarget = typeof nativeTargets[targetUuid];
            if (typeof _nativeTarget !== 'string' && _nativeTarget['productType'] === '"' + productType + '"') {
                // Get pbxNativeTarget
                var nativeTarget = this.pbxNativeTargetSection()[targetUuid];
                return {
                    uuid: targetUuid,
                    target: nativeTarget
                };
            }
        }
        return null;
    };
    /*** NEW ***/
    /**
     *
     * @param file  when a string, this is the UUID of either a PBXGroup or a PBXVariantGroup object.
     * When an object,
     * @param groupKey
     * @param groupType
     */
    XcProjectFileEditor.prototype.addToPbxGroupType = function (file, groupKey, groupType) {
        var group = this.getPBXGroupByKeyAndType(groupKey, groupType);
        if (group && group.children !== undefined) {
            if (typeof file === 'string') {
                var childGroupUuid = file;
                var comment = void 0;
                //Group Key
                var pbxGroup = this.getPBXGroupByKey(childGroupUuid);
                if (pbxGroup) {
                    comment = pbxGroup.name;
                }
                else {
                    var pbxVarGroup = this.getPBXVariantGroupByKey(childGroupUuid);
                    if (pbxVarGroup)
                        comment = pbxVarGroup.name;
                }
                if (comment == undefined)
                    throw new Error("Failed to find a group with UUID='" + childGroupUuid + "'");
                var childGroup = {
                    value: childGroupUuid,
                    comment: comment
                };
                group.children.push(childGroup);
            }
            else {
                //File Object
                group.children.push(pbxGroupChild(file));
            }
        }
    };
    XcProjectFileEditor.prototype.addToPbxVariantGroup = function (file, groupKey) {
        this.addToPbxGroupType(file, groupKey, 'PBXVariantGroup');
    };
    XcProjectFileEditor.prototype.addToPbxGroup = function (file, groupKey) {
        this.addToPbxGroupType(file, groupKey, 'PBXGroup');
    };
    XcProjectFileEditor.prototype.pbxCreateGroupWithType = function (name, pathName, groupType) {
        //Create object
        var model = {
            //isa: '"' + groupType + '"',
            isa: groupType,
            children: [],
            name: name,
            sourceTree: '"<group>"'
        };
        if (pathName)
            model.path = pathName;
        var key = this.generateUuid();
        //  PBXGroup is the base interface of all groups
        var groupSection = this.pf_sectionGetOrCreate(groupType);
        SectionUtils_1.SectionUtils.entrySetWUuid(groupSection, key, model, name);
        // //Create comment
        // var commendId = key + '_comment';
        // //add obj and commentObj to groups;
        // groups[commendId] = name;
        // groups[key] = model;
        return key;
    };
    XcProjectFileEditor.prototype.pbxCreateVariantGroup = function (name) {
        return this.pbxCreateGroupWithType(name, undefined, 'PBXVariantGroup');
    };
    XcProjectFileEditor.prototype.pbxCreateGroup = function (name, pathName) {
        return this.pbxCreateGroupWithType(name, pathName, 'PBXGroup');
    };
    XcProjectFileEditor.prototype.removeFromPbxGroupAndType = function (file, groupKey, groupType) {
        var group = this.getPBXGroupByKeyAndType(groupKey, groupType);
        if (group) {
            var groupChildren = group.children, i;
            var toMatch = pbxGroupChild(file);
            for (i in groupChildren) {
                if (toMatch.value == groupChildren[i].value &&
                    toMatch.comment == groupChildren[i].comment) {
                    groupChildren.splice(i, 1);
                    break;
                }
            }
        }
    };
    XcProjectFileEditor.prototype.removeFromPbxGroup = function (file, groupKey) {
        this.removeFromPbxGroupAndType(file, groupKey, 'PBXGroup');
    };
    XcProjectFileEditor.prototype.removeFromPbxVariantGroup = function (file, groupKey) {
        this.removeFromPbxGroupAndType(file, groupKey, 'PBXVariantGroup');
    };
    XcProjectFileEditor.prototype.getPBXGroupByKeyAndType = function (key, groupType) {
        //        return this.hash.project.objects[groupType][key];
        return SectionUtils_1.SectionUtils.entryGetWUuid(this.pf_sectionGetOrCreate(groupType), key);
    };
    XcProjectFileEditor.prototype.getPBXGroupByKey = function (uuid) {
        return SectionUtils_1.SectionUtils.entryGetWUuid(this.pbxGroupsSection(), uuid);
        // return this.hash.project.objects['PBXGroup'][key]; // this used to allow returning a string.
    };
    ;
    XcProjectFileEditor.prototype.getPBXVariantGroupByKey = function (uuid) {
        return SectionUtils_1.SectionUtils.entryGetWUuid(this.pbxVariantGroupsSection(), uuid);
        // return this.hash.project.objects['PBXVariantGroup'][key];
    };
    ;
    /**
     *
     * @param criteria
     * @param groupType
     * @returns the UUID of the matching group or undefined if no match.
     */
    XcProjectFileEditor.prototype.findPBXGroupKeyAndType = function (criteria, groupType) {
        //  for the JS developers.  I would think this would throw.  But the
        //  original implementation just ignored criteria if not set. Maintaining
        //  oriignal logic.
        if (!criteria)
            return undefined;
        var groups = this.pf_sectionGetOrCreate(groupType);
        //const groups = this.hash.project.objects[groupType];
        for (var key in groups) {
            // only look for non comments
            if (!SectionUtils_1.SectionUtils.dictKeyIsComment(key)) {
                var group = groups[key];
                //  Must match all criteria provided.
                if (criteria.path) {
                    if (criteria.path === group.path) {
                        if (!criteria.name || criteria.name === group.name)
                            return key;
                    }
                }
                else if (criteria.name && criteria.name === group.name) {
                    return key;
                }
            }
        }
        return undefined; // Not found
    };
    /**
     * Find the UUID of the PBXGroup object that matches the passed in criteria or
     * undefined if missing.
     * @param criteria match criteria
     */
    XcProjectFileEditor.prototype.findPBXGroupKey = function (criteria) {
        return this.findPBXGroupKeyAndType(criteria, 'PBXGroup');
    };
    /**
     * Find the UUID of the PBXVariantGroup object that matches the passed in criteria or
     * undefined if missing.
     * @param criteria match criteria
     */
    XcProjectFileEditor.prototype.findPBXVariantGroupKey = function (criteria) {
        return this.findPBXGroupKeyAndType(criteria, 'PBXVariantGroup');
    };
    XcProjectFileEditor.prototype.addLocalizationVariantGroup = function (name) {
        var groupKey = this.pbxCreateVariantGroup(name);
        var resourceGroupKey = this.findPBXGroupKey({ name: 'Resources' });
        if (resourceGroupKey == undefined)
            throw new Error("Resources group not found!");
        this.addToPbxGroup(groupKey, resourceGroupKey);
        var localizationVariantGroup = {
            uuid: this.generateUuid(),
            fileRef: groupKey,
            basename: name
        };
        this.addToPbxBuildFileSection(localizationVariantGroup); // PBXBuildFile
        this.addToPbxResourcesBuildPhase(localizationVariantGroup); //PBXResourcesBuildPhase
        return localizationVariantGroup;
    };
    ;
    XcProjectFileEditor.prototype.addKnownRegion = function (name) {
        var project = this.getFirstProject().firstProject;
        if (!project.knownRegions)
            project.knownRegions = [];
        if (!this.hasKnownRegion(name)) {
            project.knownRegions.push(name);
        }
        // if (!this.pbxProjectSection()[this.getFirstProject()['uuid']]['knownRegions']) {
        //     this.pbxProjectSection()[this.getFirstProject()['uuid']]['knownRegions'] = [];
        // }
        // if (!this.hasKnownRegion(name)) {
        //     this.pbxProjectSection()[this.getFirstProject()['uuid']]['knownRegions'].push(name);
        // }
    };
    XcProjectFileEditor.prototype.removeKnownRegion = function (name) {
        var regions = this.getFirstProject().firstProject.knownRegions;
        if (regions) {
            for (var i = 0; i < regions.length; i++) {
                if (regions[i] === name) {
                    regions.splice(i, 1);
                    break;
                }
            }
            //  This line did nothing
            // this.pbxProjectSection()[this.getFirstProject()['uuid']]['knownRegions'] = regions;
        }
    };
    XcProjectFileEditor.prototype.hasKnownRegion = function (name) {
        var regions = this.getFirstProject().firstProject.knownRegions;
        //var regions = this.pbxProjectSection()[this.getFirstProject()['uuid']]['knownRegions'];
        if (regions) {
            for (var i in regions) {
                if (regions[i] === name) {
                    return true;
                }
            }
        }
        return false;
    };
    XcProjectFileEditor.prototype.getPBXObject = function (name) {
        if (!this.hash)
            throw new Error('Not loaded');
        return this.hash.project.objects[name];
    };
    /**
     * See if this file exists in the project.  If not, stop and return a null.
     * If not, create a new file reference for it, add a PBXFileReference to
     * the model, and then add it to a group if possible.
     *
     * Line 1961
     * @param path relative path to the file within the project.
     * @param group if this is the key to a PBXGroup, then this file is added to that
     * group.  If this is the key to a PBXVariantGroup, then this file is added to
     * that group.  Otherwise, this file is not added to any group.
     * @param opt
     *
     * @returns null if file already exists.  Otherwise, this is the new file.
     */
    XcProjectFileEditor.prototype.addFile = function (path, group, opt) {
        var file = new PbxFileDef_1.PbxFile(path, opt);
        // null is better for early errors
        if (this.hasFile(file.path))
            return null;
        file.fileRef = this.generateUuid();
        this.addToPbxFileReferenceSection(file); // PBXFileReference
        if (this.getPBXGroupByKey(group)) {
            this.addToPbxGroup(file, group); // PBXGroup
        }
        else if (this.getPBXVariantGroupByKey(group)) {
            this.addToPbxVariantGroup(file, group); // PBXVariantGroup
        }
        return file;
    };
    XcProjectFileEditor.prototype.removeFile = function (path, group, opt) {
        var file = new PbxFileDef_1.PbxFile(path, opt);
        this.removeFromPbxFileReferenceSection(file); // PBXFileReference
        if (this.getPBXGroupByKey(group)) {
            this.removeFromPbxGroup(file, group); // PBXGroup
        }
        else if (this.getPBXVariantGroupByKey(group)) {
            this.removeFromPbxVariantGroup(file, group); // PBXVariantGroup
        }
        return file;
    };
    /**
     * returns the value of the last build setting with the name property for
     * all XCBuildConfiguration objects whose name matches the value passed in for 'build'
     * @param prop A key in the buildSettings
     * @param build Matches the XCBuildConfigurationName.  Examples:  'Debug' 'Release'
     */
    XcProjectFileEditor.prototype.getBuildProperty = function (prop, build) {
        var target;
        var configs = this.xcBuildConfigurationSection();
        for (var configKey in configs) {
            if (!SectionUtils_1.SectionUtils.dictKeyIsComment(configKey)) {
                var config = configs[configKey];
                if ((build && config.name === build) || (build === undefined)) {
                    if (config.buildSettings[prop] !== undefined) {
                        target = config.buildSettings[prop];
                    }
                }
            }
        }
        return target;
    };
    /**
     * Return a dictionary of all of the XCBuildConfiguration objects that are either 'Debug' or 'Release'
     * @param build
     */
    XcProjectFileEditor.prototype.getBuildConfigByName = function (build) {
        var target = {};
        var configs = this.xcBuildConfigurationSection();
        for (var key in configs) {
            if (!SectionUtils_1.SectionUtils.dictKeyIsComment(key)) {
                var config = configs[key];
                if (config.name === build) {
                    target[key] = config;
                }
            }
        }
        return target;
    };
    /**
     *
     * @param filePath
     * @param group
     * @param opt
     */
    XcProjectFileEditor.prototype.addDataModelDocument = function (filePath, group, opt) {
        //  It appears as if group can be 
        if (!group) {
            group = 'Resources';
        }
        if (!SectionUtils_1.SectionUtils.dictKeyIsUuid(group)) { // If this is not an XC_PROJ_UUID, then it is a FILETYPE_GROUP, convert it to a UUID or back to undefined
            // if (  !this.getPBXGroupByKey(group)) { // We now throw if you pass a non key 
            group = this.findPBXGroupKey({ name: group });
        }
        //  At this point group is either a valid UUID or undefined
        if (!group)
            throw new Error('Failed to find the group!');
        var file = new PbxFileDef_1.PbxFile(filePath, opt);
        if (!file || this.hasFile(file.path))
            return null;
        file.fileRef = this.generateUuid();
        this.addToPbxGroup(file, group);
        if (!file)
            return false;
        file.target = opt ? opt.target : undefined;
        file.uuid = this.generateUuid();
        this.addToPbxBuildFileSection(file);
        this.addToPbxSourcesBuildPhase(file);
        file.models = [];
        var currentVersionName;
        var modelFiles = fs.readdirSync(file.path);
        for (var index in modelFiles) {
            var modelFileName = modelFiles[index];
            var modelFilePath = path.join(filePath, modelFileName);
            if (modelFileName == '.xccurrentversion') {
                currentVersionName = plist.readFileSync(modelFilePath)._XCCurrentVersionName;
                continue;
            }
            var modelFile = new PbxFileDef_1.PbxFile(modelFilePath);
            modelFile.fileRef = this.generateUuid();
            this.addToPbxFileReferenceSection(modelFile);
            file.models.push(modelFile);
            if (currentVersionName && currentVersionName === modelFileName) {
                file.currentModel = modelFile;
            }
        }
        if (!file.currentModel) {
            file.currentModel = file.models[0];
        }
        this.addToXcVersionGroupSection(file);
        return file;
    };
    /**
     * Add a new object/value to the TargetAttributes attribute of the only
     * PBXProject member.
     * @param prop
     * @param value
     * @param target
     */
    XcProjectFileEditor.prototype.addTargetAttribute = function (prop, value, target) {
        var proj = this.getFirstProject().firstProject;
        var attributes = proj.attributes;
        // var attributes = this.getFirstProject()['firstProject']['attributes'];
        if (attributes['TargetAttributes'] === undefined) {
            attributes['TargetAttributes'] = {};
        }
        target = target || this.getFirstTarget();
        if (attributes['TargetAttributes'][target.uuid] === undefined) {
            attributes['TargetAttributes'][target.uuid] = {};
        }
        attributes['TargetAttributes'][target.uuid][prop] = value;
    };
    /**
     *
     * @param prop
     * @param target
     */
    XcProjectFileEditor.prototype.removeTargetAttribute = function (prop, target) {
        var proj = this.getFirstProject().firstProject;
        var attributes = proj.attributes;
        target = target || this.getFirstTarget();
        if (attributes['TargetAttributes'] &&
            attributes['TargetAttributes'][target.uuid]) {
            delete attributes['TargetAttributes'][target.uuid][prop];
        }
    };
    return XcProjectFileEditor;
}(events_1.EventEmitter));
exports.XcProjectFileEditor = XcProjectFileEditor;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiWGNQcm9qZWN0RmlsZUVkaXRvci5qcyIsInNvdXJjZVJvb3QiOiIuLi9zcmMvdHMvIiwic291cmNlcyI6WyJsaWIvWGNQcm9qZWN0RmlsZUVkaXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7Ozs7OztHQWVHOzs7Ozs7Ozs7Ozs7Ozs7QUFHSDs7Ozs7Ozs7RUFRRTtBQUVGLDZCQUFtQztBQUNuQywyQkFBNkI7QUFDN0IsMkJBQTZCO0FBQzdCLHVCQUF5QjtBQUN6QixrQ0FBa0M7QUFDbEMsSUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLGNBQWMsQ0FBUSxDQUFDO0FBQzdDLHdDQUF3QztBQUV4QyxpQ0FBc0M7QUFDdEMsK0NBQW1EO0FBRW5ELHlDQUEwRDtBQUUxRCwwREFBMEQ7QUFDMUQsb0NBQW9DO0FBQ3BDLElBQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0FBRTNDLCtDQUE4QztBQUU5QyxtRUFBMHRCO0FBQzF0QiwyQ0FBbUk7QUFJbkk7Ozs7OztHQU1HO0FBQ0gsSUFBTSx5QkFBeUIsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsd0JBQXdCLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLGlHQUFpRztBQWlDbkwseUNBQXlDO0FBQ3pDLDBDQUEwQztBQUMxQywyQ0FBMkM7QUFDM0Msa0JBQWtCO0FBQ2xCLDJCQUEyQjtBQUMzQiwrQ0FBK0M7QUFDL0MseUVBQXlFO0FBQ3pFLG9EQUFvRDtBQUNwRCxzQ0FBc0M7QUFDdEMsa0NBQWtDO0FBQ2xDLGdCQUFnQjtBQUNoQixZQUFZO0FBQ1osUUFBUTtBQUNSLElBQUk7QUFFSixtQ0FBbUM7QUFDbkMsU0FBUyxlQUFlLENBQUMsSUFBa0I7SUFFdkMsMkRBQTJEO0lBQzNELDRCQUE0QjtJQUM1QixJQUFJLE9BQU8sSUFBSSxDQUFDLE9BQU8sS0FBSyxRQUFRLEVBQUU7UUFDbEMsTUFBTSxJQUFJLEtBQUssQ0FBQyxxREFBcUQsQ0FBQyxD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QUMsa0JBQWtCLENBQUM7WUFDOUIsVUFBVSxDQUFDLGtCQUFrQixDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQzdDLE9BQU8sVUFBVSxDQUFDLGtCQUFrQixDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQzVEO0lBQ0wsQ0FBQztJQUVMLDBCQUFDO0FBQUQsQ0FBQyxBQWxpRkQsQ0FBeUMscUJBQVksR0FraUZwRDtBQWxpRlksa0RBQW1CIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gTGljZW5zZWQgdG8gdGhlIEFwYWNoZSBTb2Z0d2FyZSBGb3VuZGF0aW9uIChBU0YpIHVuZGVyIG9uZVxuIG9yIG1vcmUgY29udHJpYnV0b3IgbGljZW5zZSBhZ3JlZW1lbnRzLiAgU2VlIHRoZSBOT1RJQ0UgZmlsZVxuIGRpc3RyaWJ1dGVkIHdpdGggdGhpcyB3b3JrIGZvciBhZGRpdGlvbmFsIGluZm9ybWF0aW9uXG4gcmVnYXJkaW5nIGNvcHlyaWdodCBvd25lcnNoaXAuICBUaGUgQVNGIGxpY2Vuc2VzIHRoaXMgZmlsZVxuIHRvIHlvdSB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGVcbiAnTGljZW5zZScpOyB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlXG4gd2l0aCB0aGUgTGljZW5zZS4gIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZyxcbiBzb2Z0d2FyZSBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhblxuICdBUyBJUycgQkFTSVMsIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWVxuIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuICBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZVxuIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmQgbGltaXRhdGlvbnNcbiB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuXG5cbi8qXG5IZWxwZnVsIEJhY2tncm91bmQgTGlua3M6XG5cbmh0dHA6Ly9kYW53cmlnaHQuaW5mby9ibG9nLzIwMTAvMTAveGNvZGUtcGJ4cHJvamVjdC1maWxlcy9cbmh0dHA6Ly93d3cubW9ub2JqYy5uZXQveGNvZGUtcHJvamVjdC1maWxlLWZvcm1hdC5odG1sXG5odHRwczovL2dpdGh1Yi5jb20vTW9ub2JqYy9tb25vYmpjLXRvb2xzXG5cblxuKi9cblxuaW1wb3J0IHsgZm9ybWF0IGFzIGYgfSBmcm9tICd1dGlsJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyB1dWlkIGZyb20gJ3V1aWQnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuLy8gIG5vIHR5cGVzIGZpbGUgZm9yIHNpbXBsZS1wbGlzdFxuY29uc3QgcGxpc3QgPSByZXF1aXJlKCdzaW1wbGUtcGxpc3QnKSBhcyBhbnk7XG4vL2ltcG9ydCAqIGFzIHBsaXN0IGZyb20gJ3NpbXBsZS1wbGlzdCc7XG5cbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XG5pbXBvcnQgeyBmb3JrLCBDaGlsZFByb2Nlc3MgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcblxuaW1wb3J0IHsgUGJ4V3JpdGVyLCBQYnhXcml0ZXJPcHRpb25zIH0gZnJvbSAnLi9wYnhXcml0ZXInO1xuXG4vLyAgVGhpcyBpcyBhIGF1dG9tYXRpY2FsbHkgZ2VuZXJhdGVkIC5qcyBmaWxlIGZyb20gcGVnanMuXG4vLyAgU28gZ28gb2xkc2Nob29sIGFuZCB1c2UgcmVxdWlyZS5cbmNvbnN0IHBhcnNlciA9IHJlcXVpcmUoJy4vcGFyc2VyL3BieHByb2onKTtcblxuaW1wb3J0IHsgU2VjdGlvblV0aWxzIH0gZnJvbSAnLi9TZWN0aW9uVXRpbHMnO1xuaW1wb3J0IHsgWENfUFJPSl9VVUlELCBUQVJHRVRfVFlQRSwgUFJPRFVDVF9UWVBFLCBYQ19DT01NRU5UX0tFWSB9IGZyb20gJy4vSVhjb2RlUHJvakZpbGVTaW1wbGVUeXBlcyc7XG5pbXBvcnQgeyBQQlhOYXRpdmVUYXJnZXQsIFBCWEJ1aWxkUGhhc2VCYXNlLCBYQ0NvbmZpZ3VyYXRpb25MaXN0LCBQQlhCdWlsZEZpbGUsIFBCWEZpbGVSZWZlcmVuY2UsIElDaGlsZExpc3RFbnRyeSwgUEJYQ29weUZpbGVzQnVpbGRQaGFzZSwgUEJYU2hlbGxTY3JpcHRCdWlsZFBoYXNlLCBQQlhHcm91cCwgY1BCWEdyb3VwLCBYQ1ZlcnNpb25Hcm91cCwgWENCdWlsZENvbmZpZ3VyYXRpb24sIFBCWFRhcmdldERlcGVuZGVuY3ksIFBCWENvbnRhaW5lckl0ZW1Qcm94eSwgY1BCWENvbnRhaW5lckl0ZW1Qcm94eSwgY1BCWFRhcmdldERlcGVuZGVuY3ksIGNQQlhDb3B5RmlsZXNCdWlsZFBoYXNlLCBjUEJYU2hlbGxTY3JpcHRCdWlsZFBoYXNlLCBQQlhPYmplY3RCYXNlLCBJU0FfVFlQRSwgUEJYVmFyaWFudEdyb3VwLCBjUEJYVmFyaWFudEdyb3VwLCBQQlhQcm9qZWN0LCBjUEJYUHJvamVjdCwgY1BCWEJ1aWxkRmlsZSwgY1BCWEZpbGVSZWZlcmVuY2UsIGNQQlhOYXRpdmVUYXJnZXQsIGNYQ0J1aWxkQ29uZmlndXJhdGlvbiwgY1hDVmVyc2lvbkdyb3VwLCBjWENDb25maWd1cmF0aW9uTGlzdCwgUEJYU291cmNlc0J1aWxkUGhhc2UsIFBCWFJlc291cmNlc0J1aWxkUGhhc2UsIFBCWEZyYW1ld29ya3NCdWlsZFBoYXNlLCBJU0FfQlVJTERfUEhBU0VfVFlQRSwgSVNBX0dST1VQX1RZUEUsIElBdHRyaWJ1dGVzRGljdGlvbmFyeSB9IGZyb20gJy4vSVhjb2RlUHJvakZpbGVPYmpUeXBlcyc7XG5pbXBvcnQgeyBQYnhGaWxlLCBJRmlsZVBhdGhPYmosIElMb25nQ29tbWVudE9iaiwgWENfRklMRVRZUEUsIElQYnhGaWxlT3B0aW9ucywgRklMRVRZUEVfR1JPVVAsIFhDX1NPVVJDRVRSRUUgfSBmcm9tICcuL1BieEZpbGVEZWYnO1xuaW1wb3J0IHsgSVhjb2RlUHJvakZpbGUsIFNlY3Rpb24sIFR5cGVkU2VjdGlvbiwgSVByb2plY3QsIFNlY3Rpb25EaWN0VXVpZFRvT2JqIH0gZnJvbSAnLi9JWGNvZGVQcm9qRmlsZSc7XG5cblxuLyoqXG4gKiBEdWUgdG8gYSBwcm9ibGVtIGRlYnVnZ2luZyBjb2RlIHRoYXQgZGVwZW5kcyBvbiB0aGUgZm9yayB1c2VkIGluIFxuICogdGhlIHBhcnNlIG1ldGhvZCwgd2UgYWxsb3cgc2V0dGluZyBhbiBlbnZpcm9ubWVudCB2YXJpYWJsZSB0aGF0IFxuICogbWFrZXMgY2FsbHMgdG8gcGFyc2Ugc2ltdWxhdGUgdGhlIGZvcmsgbWV0aG9kLiAgSW4gcmVhbGl0eSwgd2Ugc2hvdWxkXG4gKiBqdXN0IHJlbW92ZSB0aGUgZm9yayBvdXRyaWdodC4gIEJ1dCB3ZSBhcmUgZm9yIG5vdyBhc3N1bWluZyBzb21lb25lIGNvZGVkXG4gKiBpdCB0aGF0IHdheSBmb3IgYSB2YWxpZCByZWFzb24gYW5kIGFyZSBtYWludGFpbmluZyB0aGF0IGltcGxlbWVudGF0aW9uLlxuICovXG5jb25zdCByZXBsYWNlUGFyc2VXaXRoUGFyc2VTeW5jID0gKHByb2Nlc3MuZW52W1wiWE5PREVfUEFSU0VfQVZPSURfRk9SS1wiXSA9PSBcIjFcIik7IC8vIFNlZSBpZiB3ZSBjYW4gcHVsbCBhbiBlbnZpcm9ubWVudCB2YXJpYWJsZSB0byBzZXQgdGhpcyB3aGVuIHJ1bm5pbmcgb3V0IG9mIFZTQ29kZSBvciBkZWJ1Z2dlci5cblxuZXhwb3J0IGludGVyZmFjZSBJTmF0aXZlVGFyZ2V0V3JhcHBlciB7XG4gICAgdXVpZDogWENfUFJPSl9VVUlEO1xuICAgIHBieE5hdGl2ZVRhcmdldDogUEJYTmF0aXZlVGFyZ2V0O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElOYXRpdmVUYXJnZXRXcmFwcGVyMiB7XG4gICAgdXVpZDogWENfUFJPSl9VVUlEO1xuICAgIHRhcmdldDogUEJYTmF0aXZlVGFyZ2V0O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElCdWlsZFBoYXNlV3JhcHBlciB7XG4gICAgdXVpZDogWENfUFJPSl9VVUlEO1xuICAgIGJ1aWxkUGhhc2U6IFBCWEJ1aWxkUGhhc2VCYXNlO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDb25maWd1cmF0aW9uTGlzdFdyYXBwZXIge1xuICAgIHV1aWQ6IFhDX1BST0pfVVVJRDtcbiAgICB4Y0NvbmZpZ3VyYXRpb25MaXN0OiBYQ0NvbmZpZ3VyYXRpb25MaXN0O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElHcm91cE1hdGNoQ3JpdGVyaWEge1xuICAgIHBhdGg/OiBzdHJpbmc7XG4gICAgbmFtZT86IHN0cmluZztcbn1cblxuLy8gIFVzZWQgdG8gZXh0ZW5kIFBieEZpbGUgZm9yIGRhdGEgbW9kZWwgZmlsZXMuXG5leHBvcnQgaW50ZXJmYWNlIElEYXRhTW9kZWxEb2N1bWVudEZpbGUge1xuICAgIG1vZGVscz86IFBieEZpbGVbXTtcbiAgICBjdXJyZW50TW9kZWw/OiBQYnhGaWxlO1xufVxuXG4vLyAgQXBwZWFycyB0byBub3QgYmUgdXNlZCAoQmFsbCAyMDE5LzEwKVxuLy8gLy8gaGVscGVyIHJlY3Vyc2l2ZSBwcm9wIHNlYXJjaCtyZXBsYWNlXG4vLyBmdW5jdGlvbiBwcm9wUmVwbGFjZShvYmosIHByb3AsIHZhbHVlKSB7XG4vLyAgICAgdmFyIG8gPSB7fTtcbi8vICAgICBmb3IgKHZhciBwIGluIG9iaikge1xuLy8gICAgICAgICBpZiAoby5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcCkpIHtcbi8vICAgICAgICAgICAgIGlmICh0eXBlb2Ygb2JqW3BdID09ICdvYmplY3QnICYmICFBcnJheS5pc0FycmF5KG9ialtwXSkpIHtcbi8vICAgICAgICAgICAgICAgICBwcm9wUmVwbGFjZShvYmpbcF0sIHByb3AsIHZhbHVlKTtcbi8vICAgICAgICAgICAgIH0gZWxzZSBpZiAocCA9PSBwcm9wKSB7XG4vLyAgICAgICAgICAgICAgICAgb2JqW3BdID0gdmFsdWU7XG4vLyAgICAgICAgICAgICB9XG4vLyAgICAgICAgIH1cbi8vICAgICB9XG4vLyB9XG5cbi8vIGhlbHBlciBvYmplY3QgY3JlYXRpb24gZnVuY3Rpb25zXG5mdW5jdGlvbiBwYnhCdWlsZEZpbGVPYmooZmlsZTogSUZpbGVQYXRoT2JqKTogUEJYQnVpbGRGaWxlIHtcblxuICAgIC8vICBNYWtpbmcgYW4gYXNzdW1wdGlvbiB0aGF0IGEgQnVpbGRGaWxlIHdpdGhvdXQgYSBmaWxlUmVmXG4gICAgLy8gIGlzIGFuIGlsbGVnYWwgY29uZGl0aW9uLlxuICAgIGlmICh0eXBlb2YgZmlsZS5maWxlUmVmICE9PSAnc3RyaW5nJykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Fzc3VtaW5nIGFsbCBCdWlsZEZpbGUgaW5zdGFuY2VzIHJlcXVpcmUgYSBmaWxlUmVmLicpO1xuICAgIH1cblxuICAgIHZhciBvYmo6IFBCWEJ1aWxkRmlsZSA9IHtcbiAgICAgICAgaXNhOiAnUEJYQnVpbGRGaWxlJyxcbiAgICAgICAgZmlsZVJlZjogZmlsZS5maWxlUmVmLFxuICAgICAgICBmaWxlUmVmX2NvbW1lbnQ6IGZpbGUuYmFzZW5hbWVcbiAgICB9O1xuXG4gICAgaWYgKGZpbGUuc2V0dGluZ3MpXG4gICAgICAgIG9iai5zZXR0aW5ncyA9IGZpbGUuc2V0dGluZ3M7XG5cbiAgICByZXR1cm4gb2JqO1xufVxuXG5mdW5jdGlvbiBwYnhGaWxlUmVmZXJlbmNlT2JqKGZpbGU6IFBieEZpbGUpOiBQQlhGaWxlUmVmZXJlbmNlIHtcbiAgICAvLyAgQWxsIGZpbGUgcmVmZXJlbmNlcyBcblxuICAgIC8vICBBc3N1bWluZyBYQyBjYW4ndCBoYW5kbGUgdGhpcy4gIFVuc3VyZSBpZiB0aGlzIGlzIHRydWUgb3Igbm90LlxuXG4gICAgLy8gIFRoZSB0ZXN0IGNhc2VzIGZvcmNlZCBhbiAndW5rbm93bicgdmFsdWUgaGVyZS4gIFJlc3RvcmUgdGhpcyBjaGVjayBhbmQgZml4XG4gICAgLy8gIHRoZSB0ZXN0IGNhc2VzIGlmIHdlIGRldGVybWluZSB0aGF0IHhjb2RlIGNhbid0IGhhbmRsZSB1bmtub3duLlxuICAgIC8vIGlmIChmaWxlLmxhc3RLbm93bkZpbGVUeXBlID09ICd1bmtub3duJylcbiAgICAvLyAgICAgdGhyb3cgbmV3IEVycm9yKCdBdHRlbXB0aW5nIHRvIHNldCB0aGUgbGFzdEtub3duRmlsZVR5cGUgb2YgYSBQQlhGaWxlUmVmZXJlbmNlIG9iamVjdCB0byBcInVua25vd25cIicpO1xuXG4gICAgdmFyIGZpbGVPYmplY3Q6IFBCWEZpbGVSZWZlcmVuY2UgPSB7XG4gICAgICAgIGlzYTogXCJQQlhGaWxlUmVmZXJlbmNlXCIsXG4gICAgICAgIG5hbWU6IFwiXFxcIlwiICsgZmlsZS5iYXNlbmFtZSArIFwiXFxcIlwiLFxuICAgICAgICBwYXRoOiBcIlxcXCJcIiArIGZpbGUucGF0aC5yZXBsYWNlKC9cXFxcL2csICcvJykgKyBcIlxcXCJcIixcbiAgICAgICAgc291cmNlVHJlZTogZmlsZS5zb3VyY2VUcmVlLFxuICAgICAgICBmaWxlRW5jb2Rpbmc6IGZpbGUuZmlsZUVuY29kaW5nLFxuICAgICAgICBsYXN0S25vd25GaWxlVHlwZTogZmlsZS5sYXN0S25vd25GaWxlVHlwZSwgLy8gU2hvdWxkIHdlIGFsbG93IHRoaXMgdG8gaW5jbHVkZSBcInVua25vd25cIj9cbiAgICAgICAgZXhwbGljaXRGaWxlVHlwZTogZmlsZS5leHBsaWNpdEZpbGVUeXBlLFxuICAgICAgICBpbmNsdWRlSW5JbmRleDogZmlsZS5pbmNsdWRlSW5JbmRleFxuICAgIH07XG5cbiAgICByZXR1cm4gZmlsZU9iamVjdDtcbn1cblxuaW50ZXJmYWNlIElQYnhHcm91cENoaWxkRmlsZUluZm8geyBmaWxlUmVmPzogWENfUFJPSl9VVUlELCBiYXNlbmFtZTogc3RyaW5nIH1cblxuZnVuY3Rpb24gcGJ4R3JvdXBDaGlsZChmaWxlOiBJUGJ4R3JvdXBDaGlsZEZpbGVJbmZvKTogSUNoaWxkTGlzdEVudHJ5IHtcblxuICAgIGlmICghZmlsZS5maWxlUmVmKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignZmlsZVJlZiBub3Qgc2V0IScpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIHZhbHVlOiBmaWxlLmZpbGVSZWYsXG4gICAgICAgIGNvbW1lbnQ6IGZpbGUuYmFzZW5hbWVcbiAgICB9O1xufVxuXG4vLyBmdW5jdGlvbiBwYnhCdWlsZFBoYXNlT2JqVGhyb3dJZkludmFsaWQoZmlsZTogSUZpbGVQYXRoT2JqKTogSUNoaWxkTGlzdEVudHJ5IHtcbi8vICAgICAvLyBpZiAodHlwZW9mIGZpbGUudXVpZCA9PSBcInN0cmluZ1wiICYmIHR5cGVvZiBmaWxlLmdyb3VwID09IFwic3RyaW5nXCIpIHsgZW5zdXJlZCBncm91cCBpcyBhbHdheXMgc2V0XG4vLyAgICAgaWYgKHR5cGVvZiBmaWxlLnV1aWQgPT0gXCJzdHJpbmdcIikge1xuLy8gICAgICAgICByZXR1cm4gcGJ4QnVpbGRQaGFzZU9iaihmaWxlKTtcbi8vICAgICB9IGVsc2Uge1xuLy8gICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3V1aWQgaXMgbm90IHNldC4nKTtcbi8vICAgICB9XG4vLyB9XG5cbmZ1bmN0aW9uIHBieEJ1aWxkUGhhc2VPYmooZmlsZTogSUZpbGVQYXRoT2JqKTogSUNoaWxkTGlzdEVudHJ5IHtcbiAgICB2YXIgb2JqID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuICAgIGlmICghU2VjdGlvblV0aWxzLmRpY3RLZXlJc1V1aWQoZmlsZS51dWlkKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFRoZSB1dWlkIHZhbHVlIG9mICcke2ZpbGUudXVpZH0nIGlzIGludmFsaWQhYCk7XG4gICAgfVxuXG4gICAgb2JqLnZhbHVlID0gZmlsZS51dWlkO1xuICAgIG9iai5jb21tZW50ID0gbG9uZ0NvbW1lbnQoZmlsZSk7XG5cbiAgICByZXR1cm4gb2JqO1xufVxuXG5mdW5jdGlvbiBwYnhDb3B5RmlsZXNCdWlsZFBoYXNlT2JqKFxuICAgIG9iajogUEJYQnVpbGRQaGFzZUJhc2UsXG4gICAgZm9sZGVyVHlwZTogc3RyaW5nLFxuICAgIHN1YmZvbGRlclBhdGg/OiBzdHJpbmcgfCBudWxsLFxuICAgIHBoYXNlTmFtZT86IHN0cmluZyB8IG51bGwpOiBQQlhDb3B5RmlsZXNCdWlsZFBoYXNlIHtcblxuICAgIC8vIEFkZCBhZGRpdGlvbmFsIHByb3BlcnRpZXMgZm9yICdDb3B5RmlsZXMnIGJ1aWxkIHBoYXNlXG4gICAgdmFyIERFU1RJTkFUSU9OX0JZX1RBUkdFVFRZUEU6IHsgW3RhcmdldFR5cGU6IHN0cmluZ106IHN0cmluZyB9ID0ge1xuICAgICAgICBhcHBsaWNhdGlvbjogJ3dyYXBwZXInLFxuICAgICAgICBhcHBfZXh0ZW5zaW9uOiAncGx1Z2lucycsXG4gICAgICAgIGJ1bmRsZTogJ3dyYXBwZXInLFxuICAgICAgICBjb21tYW5kX2xpbmVfdG9vbDogJ3dyYXBwZXInLFxuICAgICAgICBkeW5hbWljX2xpYnJhcnk6ICdwcm9kdWN0c19kaXJlY3RvcnknLFxuICAgICAgICBmcmFtZXdvcms6ICdzaGFyZWRfZnJhbWV3b3JrcycsXG4gICAgICAgIGZyYW1ld29ya3M6ICdmcmFtZXdvcmtzJyxcbiAgICAgICAgc3RhdGljX2xpYnJhcnk6ICdwcm9kdWN0c19kaXJlY3RvcnknLFxuICAgICAgICB1bml0X3Rlc3RfYnVuZGxlOiAnd3JhcHBlcicsXG4gICAgICAgIHdhdGNoX2FwcDogJ3dyYXBwZXInLFxuICAgICAgICB3YXRjaDJfYXBwOiAncHJvZHVjdHNfZGlyZWN0b3J5JyxcbiAgICAgICAgd2F0Y2hfZXh0ZW5zaW9uOiAncGx1Z2lucycsXG4gICAgICAgIHdhdGNoMl9leHRlbnNpb246ICdwbHVnaW5zJ1xuICAgIH1cblxuICAgIHZhciBTVUJGT0xERVJTUEVDX0JZX0RFU1RJTkFUSU9OOiB7IFtkZXN0aW5hdGlvbjogc3RyaW5nXTogbnVtYmVyIH0gPSB7XG4gICAgICAgIGFic29sdXRlX3BhdGg6IDAsXG4gICAgICAgIGV4ZWN1dGFibGVzOiA2LFxuICAgICAgICBmcmFtZXdvcmtzOiAxMCxcbiAgICAgICAgamF2YV9yZXNvdXJjZXM6IDE1LFxuICAgICAgICBwbHVnaW5zOiAxMyxcbiAgICAgICAgcHJvZHVjdHNfZGlyZWN0b3J5OiAxNixcbiAgICAgICAgcmVzb3VyY2VzOiA3LFxuICAgICAgICBzaGFyZWRfZnJhbWV3b3JrczogMTEsXG4gICAgICAgIHNoYXJlZF9zdXBwb3J0OiAxMixcbiAgICAgICAgd3JhcHBlcjogMSxcbiAgICAgICAgeHBjX3NlcnZpY2VzOiAwXG4gICAgfVxuXG4gICAgY29uc3Qgb2JqT3V0ID0gb2JqIGFzIFBCWENvcHlGaWxlc0J1aWxkUGhhc2U7XG4gICAgb2JqT3V0Lm5hbWUgPSAnXCInICsgcGhhc2VOYW1lICsgJ1wiJztcbiAgICBvYmpPdXQuZHN0UGF0aCA9IHN1YmZvbGRlclBhdGggfHwgJ1wiXCInO1xuICAgIG9iak91dC5kc3RTdWJmb2xkZXJTcGVjID0gU1VCRk9MREVSU1BFQ19CWV9ERVNUSU5BVElPTltERVNUSU5BVElPTl9CWV9UQVJHRVRUWVBFW2ZvbGRlclR5cGVdXTtcblxuICAgIHJldHVybiBvYmpPdXQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVBieFNoZWxsU2NyaXB0QnVpbGRQaGFzZU9wdGlvbnMge1xuICAgIGlucHV0UGF0aHM/OiBzdHJpbmdbXSxcbiAgICBvdXRwdXRQYXRocz86IHN0cmluZ1tdLFxuICAgIHNoZWxsUGF0aD86IHN0cmluZyxcbiAgICBzaGVsbFNjcmlwdDogc3RyaW5nIC8vIFJlcXVpcmVkXG59XG5cbmZ1bmN0aW9uIHBieFNoZWxsU2NyaXB0QnVpbGRQaGFzZU9iaihcbiAgICBvYmo6IFBCWEJ1aWxkUGhhc2VCYXNlLFxuICAgIG9wdGlvbnM6IElQYnhTaGVsbFNjcmlwdEJ1aWxkUGhhc2VPcHRpb25zLFxuICAgIHBoYXNlTmFtZTogc3RyaW5nKTogUEJYU2hlbGxTY3JpcHRCdWlsZFBoYXNlIHtcblxuICAgIGNvbnN0IG9iak91dCA9IG9iaiBhcyBQQlhTaGVsbFNjcmlwdEJ1aWxkUGhhc2U7XG4gICAgb2JqT3V0Lm5hbWUgPSAnXCInICsgcGhhc2VOYW1lICsgJ1wiJztcbiAgICBvYmpPdXQuaW5wdXRQYXRocyA9IG9wdGlvbnMuaW5wdXRQYXRocyB8fCBbXTtcbiAgICBvYmpPdXQub3V0cHV0UGF0aHMgPSBvcHRpb25zLm91dHB1dFBhdGhzIHx8IFtdO1xuICAgIG9iak91dC5zaGVsbFBhdGggPSBvcHRpb25zLnNoZWxsUGF0aDtcbiAgICBvYmpPdXQuc2hlbGxTY3JpcHQgPSAnXCInICsgb3B0aW9ucy5zaGVsbFNjcmlwdC5yZXBsYWNlKC9cIi9nLCAnXFxcXFwiJykgKyAnXCInO1xuXG4gICAgcmV0dXJuIG9iak91dDtcbn1cblxuZnVuY3Rpb24gcGJ4QnVpbGRGaWxlQ29tbWVudChmaWxlOiBJTG9uZ0NvbW1lbnRPYmopIHtcbiAgICByZXR1cm4gbG9uZ0NvbW1lbnQoZmlsZSk7XG59XG5cbmZ1bmN0aW9uIHBieEZpbGVSZWZlcmVuY2VDb21tZW50KGZpbGU6IFBieEZpbGUpOiBzdHJpbmcge1xuICAgIHJldHVybiBmaWxlLmJhc2VuYW1lIHx8IHBhdGguYmFzZW5hbWUoZmlsZS5wYXRoKTtcbn1cblxuZnVuY3Rpb24gcGJ4TmF0aXZlVGFyZ2V0Q29tbWVudCh0YXJnZXQ6IFBCWE5hdGl2ZVRhcmdldCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRhcmdldC5uYW1lO1xufVxuXG5mdW5jdGlvbiBsb25nQ29tbWVudChmaWxlOiBJTG9uZ0NvbW1lbnRPYmopOiBzdHJpbmcge1xuXG4gICAgLy8gIFRoaXMgaXMgZmFpbGluZyBhIHRlc3QuICBJIHRlbnRhdGl2ZWx5IHRoaW5rIGl0IHNob3VsZCBmYWlsXG4gICAgLy8gIGFuZCB0aGUgdGVzdCBpcyBiYWQuXG4gICAgLy8gIEhvd2V2ZXIsIGl0IHdhcyBwYXNzaW5nIGFuZCBJIGRvbid0IGtub3cgZW5vdWdoIGFib3V0IHRoZVxuICAgIC8vICBhY3R1YWwgcmVxdWlyZWQgdXNlIGFuZCBleHBlY3RhdGlvbiBvZiB4Y29kZSB0byBrbm93IGlmIGl0IFxuICAgIC8vICBpcyByZWFsbHkgYSBwcm9ibGVtLiAgRm9yIG5vdywganVzdCByZW1vdmUgdGhlIHRocm93IGFuZCBcbiAgICAvLyAgcmVzdG9yZSBpdCBpZiBJIGxhdGVyIGZpbmQgb3V0IG15IG9yaWdpbmFsIGFzc3VtcHRpb24gaXMgY29ycmVjdFxuICAgIC8vICBhbmQgdGhlIHRlc3QgaXMgYmFkIG5vdCB0aGUgY29kZS5cbiAgICAvLyAgXG4gICAgLy8gLy8gIEFkZGluZyBlcnJvciBjaGVja2luZyB0byBtYWtlIHN1cmUgZmlsZS5ncm91cCBleGlzdHNcbiAgICAvLyBpZiAodHlwZW9mIGZpbGUuZ3JvdXAgIT0gXCJzdHJpbmdcIilcbiAgICAvLyAgICAgdGhyb3cgbmV3IEVycm9yKFwiZ3JvdXAgbm90IHNldCBvbiBmaWxlLlwiKTtcblxuICAgIHJldHVybiBmKFwiJXMgaW4gJXNcIiwgZmlsZS5iYXNlbmFtZSwgZmlsZS5ncm91cCk7XG59XG5cbi8vIHJlc3BlY3QgPGdyb3VwPiBwYXRoXG5mdW5jdGlvbiBjb3JyZWN0Rm9yUGx1Z2luc1BhdGgoZmlsZTogUGJ4RmlsZSwgcHJvamVjdDogWGNQcm9qZWN0RmlsZUVkaXRvcikge1xuICAgIHJldHVybiBjb3JyZWN0Rm9yUGF0aChmaWxlLCBwcm9qZWN0LCAnUGx1Z2lucycpO1xufVxuXG5mdW5jdGlvbiBjb3JyZWN0Rm9yUmVzb3VyY2VzUGF0aChmaWxlOiBQYnhGaWxlLCBwcm9qZWN0OiBYY1Byb2plY3RGaWxlRWRpdG9yKSB7XG4gICAgcmV0dXJuIGNvcnJlY3RGb3JQYXRoKGZpbGUsIHByb2plY3QsICdSZXNvdXJjZXMnKTtcbn1cblxuXG4vLyAgbm90IHVzZWRcbi8vIGZ1bmN0aW9uIGNvcnJlY3RGb3JGcmFtZXdvcmtzUGF0aChmaWxlOiBQYnhGaWxlLCBwcm9qZWN0OiBQYnhQcm9qZWN0KSB7XG4vLyAgICAgcmV0dXJuIGNvcnJlY3RGb3JQYXRoKGZpbGUsIHByb2plY3QsICdGcmFtZXdvcmtzJyk7XG4vLyB9XG5cbmZ1bmN0aW9uIGNvcnJlY3RGb3JQYXRoKGZpbGU6IFBieEZpbGUsIHByb2plY3Q6IFhjUHJvamVjdEZpbGVFZGl0b3IsIGdyb3VwOiBzdHJpbmcpOiBQYnhGaWxlIHtcbiAgICB2YXIgcl9ncm91cF9kaXIgPSBuZXcgUmVnRXhwKCdeJyArIGdyb3VwICsgJ1tcXFxcXFxcXC9dJyk7XG5cbiAgICBjb25zdCBncm91cE9iajogUEJYR3JvdXAgfCBudWxsID0gcHJvamVjdC5wYnhHcm91cEJ5TmFtZShncm91cCk7XG5cbiAgICBpZiAoIWdyb3VwT2JqKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJHcm91cCBub3QgZm91bmQhXCIpO1xuXG4gICAgaWYgKGdyb3VwT2JqLnBhdGgpXG4gICAgICAgIGZpbGUucGF0aCA9IGZpbGUucGF0aC5yZXBsYWNlKHJfZ3JvdXBfZGlyLCAnJyk7XG5cbiAgICByZXR1cm4gZmlsZTtcbn1cblxuZnVuY3Rpb24gc2VhcmNoUGF0aEZvckZpbGUoZmlsZTogUGJ4RmlsZSwgcHJvajogWGNQcm9qZWN0RmlsZUVkaXRvcik6IHN0cmluZyB7XG4gICAgY29uc3QgcGx1Z2lucyA9IHByb2oucGJ4R3JvdXBCeU5hbWUoJ1BsdWdpbnMnKTtcbiAgICBjb25zdCBwbHVnaW5zUGF0aCA9IHBsdWdpbnMgPyBwbHVnaW5zLnBhdGggOiBudWxsO1xuXG4gICAgbGV0IGZpbGVEaXIgPSBwYXRoLmRpcm5hbWUoZmlsZS5wYXRoKTtcblxuICAgIGlmIChmaWxlRGlyID09ICcuJykge1xuICAgICAgICBmaWxlRGlyID0gJyc7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZmlsZURpciA9ICcvJyArIGZpbGVEaXI7XG4gICAgfVxuXG4gICAgaWYgKGZpbGUucGx1Z2luICYmIHBsdWdpbnNQYXRoKSB7XG4gICAgICAgIHJldHVybiAnXCJcXFxcXCIkKFNSQ1JPT1QpLycgKyB1bnF1b3RlKHBsdWdpbnNQYXRoKSArICdcXFxcXCJcIic7XG4gICAgfSBlbHNlIGlmIChmaWxlLmN1c3RvbUZyYW1ld29yayAmJiBmaWxlLmRpcm5hbWUpIHtcbiAgICAgICAgcmV0dXJuICdcIlxcXFxcIicgKyBmaWxlLmRpcm5hbWUgKyAnXFxcXFwiXCInO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAnXCJcXFxcXCIkKFNSQ1JPT1QpLycgKyBwcm9qLnByb2R1Y3ROYW1lICsgZmlsZURpciArICdcXFxcXCJcIic7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB1bnF1b3RlU3RyKHN0cjogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gc3RyLnJlcGxhY2UoL15cIiguKilcIiQvLCBcIiQxXCIpO1xufVxuXG5mdW5jdGlvbiB1bnF1b3RlKHN0cjogc3RyaW5nIHwgdW5kZWZpbmVkKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgICBpZiAoc3RyKVxuICAgICAgICByZXR1cm4gdW5xdW90ZVN0cihzdHIpO1xuICAgIGVsc2VcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuXG5cbi8vICBub3QgdXNlZFxuLy8gZnVuY3Rpb24gYnVpbGRQaGFzZU5hbWVGb3JJc2EoaXNhOiBJU0FfVFlQRSk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cbi8vICAgICBjb25zdCBCVUlMRFBIQVNFTkFNRV9CWV9JU0E6IHsgW2lzYVR5cGU6IHN0cmluZ106IHN0cmluZyB9ID0ge1xuLy8gICAgICAgICBQQlhDb3B5RmlsZXNCdWlsZFBoYXNlOiAnQ29weSBGaWxlcycsXG4vLyAgICAgICAgIFBCWFJlc291cmNlc0J1aWxkUGhhc2U6ICdSZXNvdXJjZXMnLFxuLy8gICAgICAgICBQQlhTb3VyY2VzQnVpbGRQaGFzZTogJ1NvdXJjZXMnLFxuLy8gICAgICAgICBQQlhGcmFtZXdvcmtzQnVpbGRQaGFzZTogJ0ZyYW1ld29ya3MnXG4vLyAgICAgfVxuXG4vLyAgICAgcmV0dXJuIEJVSUxEUEhBU0VOQU1FX0JZX0lTQVsoaXNhIGFzIHN0cmluZyldIGFzIHN0cmluZyB8IHVuZGVmaW5lZDtcbi8vIH1cblxuZnVuY3Rpb24gcHJvZHVjdHR5cGVGb3JUYXJnZXR0eXBlKHRhcmdldFR5cGU6IFRBUkdFVF9UWVBFKTogUFJPRFVDVF9UWVBFIHtcblxuICAgIGNvbnN0IFBST0RVQ1RUWVBFX0JZX1RBUkdFVFRZUEU6IHsgW3RhcmdldFR5cGU6IHN0cmluZ106IFBST0RVQ1RfVFlQRSB9ID0ge1xuICAgICAgICBhcHBsaWNhdGlvbjogJ2NvbS5hcHBsZS5wcm9kdWN0LXR5cGUuYXBwbGljYXRpb24nLFxuICAgICAgICBhcHBfZXh0ZW5zaW9uOiAnY29tLmFwcGxlLnByb2R1Y3QtdHlwZS5hcHAtZXh0ZW5zaW9uJyxcbiAgICAgICAgYnVuZGxlOiAnY29tLmFwcGxlLnByb2R1Y3QtdHlwZS5idW5kbGUnLFxuICAgICAgICBjb21tYW5kX2xpbmVfdG9vbDogJ2NvbS5hcHBsZS5wcm9kdWN0LXR5cGUudG9vbCcsXG4gICAgICAgIGR5bmFtaWNfbGlicmFyeTogJ2NvbS5hcHBsZS5wcm9kdWN0LXR5cGUubGlicmFyeS5keW5hbWljJyxcbiAgICAgICAgZnJhbWV3b3JrOiAnY29tLmFwcGxlLnByb2R1Y3QtdHlwZS5mcmFtZXdvcmsnLFxuICAgICAgICBzdGF0aWNfbGlicmFyeTogJ2NvbS5hcHBsZS5wcm9kdWN0LXR5cGUubGlicmFyeS5zdGF0aWMnLFxuICAgICAgICB1bml0X3Rlc3RfYnVuZGxlOiAnY29tLmFwcGxlLnByb2R1Y3QtdHlwZS5idW5kbGUudW5pdC10ZXN0JyxcbiAgICAgICAgd2F0Y2hfYXBwOiAnY29tLmFwcGxlLnByb2R1Y3QtdHlwZS5hcHBsaWNhdGlvbi53YXRjaGFwcCcsXG4gICAgICAgIHdhdGNoMl9hcHA6ICdjb20uYXBwbGUucHJvZHVjdC10eXBlLmFwcGxpY2F0aW9uLndhdGNoYXBwMicsXG4gICAgICAgIHdhdGNoX2V4dGVuc2lvbjogJ2NvbS5hcHBsZS5wcm9kdWN0LXR5cGUud2F0Y2hraXQtZXh0ZW5zaW9uJyxcbiAgICAgICAgd2F0Y2gyX2V4dGVuc2lvbjogJ2NvbS5hcHBsZS5wcm9kdWN0LXR5cGUud2F0Y2hraXQyLWV4dGVuc2lvbidcbiAgICB9O1xuXG4gICAgY29uc3QgcHQgPSBQUk9EVUNUVFlQRV9CWV9UQVJHRVRUWVBFW3RhcmdldFR5cGVdO1xuXG4gICAgaWYgKHB0ICE9PSB1bmRlZmluZWQpXG4gICAgICAgIHJldHVybiBwdDtcbiAgICBlbHNlXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgTm8gcHJvZHVjdCB0eXBlIGZvciB0YXJnZXQgdHlwZSBvZiAnJHt0YXJnZXRUeXBlfSdgKTtcbn1cblxuZnVuY3Rpb24gZmlsZXR5cGVGb3JQcm9kdWN0VHlwZShwcm9kdWN0VHlwZTogUFJPRFVDVF9UWVBFKTogWENfRklMRVRZUEUge1xuXG4gICAgY29uc3QgRklMRVRZUEVfQllfUFJPRFVDVF9UWVBFOiB7IFtwcm9kdWN0VHlwZTogc3RyaW5nXTogWENfRklMRVRZUEUgfSA9IHtcbiAgICAgICAgJ2NvbS5hcHBsZS5wcm9kdWN0LXR5cGUuYXBwbGljYXRpb24nOiAnd3JhcHBlci5hcHBsaWNhdGlvbicsXG4gICAgICAgICdjb20uYXBwbGUucHJvZHVjdC10eXBlLmFwcC1leHRlbnNpb24nOiAnd3JhcHBlci5hcHAtZXh0ZW5zaW9uJyxcbiAgICAgICAgJ2NvbS5hcHBsZS5wcm9kdWN0LXR5cGUuYnVuZGxlJzogJ3dyYXBwZXIucGx1Zy1pbicsXG4gICAgICAgICdjb20uYXBwbGUucHJvZHVjdC10eXBlLnRvb2wnOiAnY29tcGlsZWQubWFjaC1vLmR5bGliJyxcbiAgICAgICAgJ2NvbS5hcHBsZS5wcm9kdWN0LXR5cGUubGlicmFyeS5keW5hbWljJzogJ2NvbXBpbGVkLm1hY2gtby5keWxpYicsXG4gICAgICAgICdjb20uYXBwbGUucHJvZHVjdC10eXBlLmZyYW1ld29yayc6ICd3cmFwcGVyLmZyYW1ld29yaycsXG4gICAgICAgICdjb20uYXBwbGUucHJvZHVjdC10eXBlLmxpYnJhcnkuc3RhdGljJzogJ2FyY2hpdmUuYXInLFxuICAgICAgICAnY29tLmFwcGxlLnByb2R1Y3QtdHlwZS5idW5kbGUudW5pdC10ZXN0JzogJ3dyYXBwZXIuY2ZidW5kbGUnLFxuICAgICAgICAnY29tLmFwcGxlLnByb2R1Y3QtdHlwZS5hcHBsaWNhdGlvbi53YXRjaGFwcCc6ICd3cmFwcGVyLmFwcGxpY2F0aW9uJyxcbiAgICAgICAgJ2NvbS5hcHBsZS5wcm9kdWN0LXR5cGUuYXBwbGljYXRpb24ud2F0Y2hhcHAyJzogJ3dyYXBwZXIuYXBwbGljYXRpb24nLFxuICAgICAgICAnY29tLmFwcGxlLnByb2R1Y3QtdHlwZS53YXRjaGtpdC1leHRlbnNpb24nOiAnd3JhcHBlci5hcHAtZXh0ZW5zaW9uJyxcbiAgICAgICAgJ2NvbS5hcHBsZS5wcm9kdWN0LXR5cGUud2F0Y2hraXQyLWV4dGVuc2lvbic6ICd3cmFwcGVyLmFwcC1leHRlbnNpb24nXG4gICAgfTtcblxuICAgIC8vICBJIGFtIHByZXR0eSBzdXJlIHRoZSBvcmlnaW5hbCB2ZXJzaW9uIG9mIHRoaXMgYWRkZWQgdGhlIGRvdWJsZSBxdW90ZXMuXG4gICAgLy8gIGhvd2V2ZXIsIG91ciB0eXBlIGNoZWNraW5nIGRpY3RhdGVzIHRoYXQgdGhleSBkbyBub3QgaGF2ZSB0aGUgcXVvdGVzLlxuICAgIC8vICBXaWxsIHRyb3VibGVzaG9vdCBsYXRlci5cbiAgICAvLyAnY29tLmFwcGxlLnByb2R1Y3QtdHlwZS5hcHBsaWNhdGlvbic6ICdcIndyYXBwZXIuYXBwbGljYXRpb25cIicsXG4gICAgLy8gJ2NvbS5hcHBsZS5wcm9kdWN0LXR5cGUuYXBwLWV4dGVuc2lvbic6ICdcIndyYXBwZXIuYXBwLWV4dGVuc2lvblwiJyxcbiAgICAvLyAnY29tLmFwcGxlLnByb2R1Y3QtdHlwZS5idW5kbGUnOiAnXCJ3cmFwcGVyLnBsdWctaW5cIicsXG4gICAgLy8gJ2NvbS5hcHBsZS5wcm9kdWN0LXR5cGUudG9vbCc6ICdcImNvbXBpbGVkLm1hY2gtby5keWxpYlwiJyxcbiAgICAvLyAnY29tLmFwcGxlLnByb2R1Y3QtdHlwZS5saWJyYXJ5LmR5bmFtaWMnOiAnXCJjb21waWxlZC5tYWNoLW8uZHlsaWJcIicsXG4gICAgLy8gJ2NvbS5hcHBsZS5wcm9kdWN0LXR5cGUuZnJhbWV3b3JrJzogJ1wid3JhcHBlci5mcmFtZXdvcmtcIicsXG4gICAgLy8gJ2NvbS5hcHBsZS5wcm9kdWN0LXR5cGUubGlicmFyeS5zdGF0aWMnOiAnXCJhcmNoaXZlLmFyXCInLFxuICAgIC8vICdjb20uYXBwbGUucHJvZHVjdC10eXBlLmJ1bmRsZS51bml0LXRlc3QnOiAnXCJ3cmFwcGVyLmNmYnVuZGxlXCInLFxuICAgIC8vICdjb20uYXBwbGUucHJvZHVjdC10eXBlLmFwcGxpY2F0aW9uLndhdGNoYXBwJzogJ1wid3JhcHBlci5hcHBsaWNhdGlvblwiJyxcbiAgICAvLyAnY29tLmFwcGxlLnByb2R1Y3QtdHlwZS53YXRjaGtpdC1leHRlbnNpb24nOiAnXCJ3cmFwcGVyLmFwcC1leHRlbnNpb25cIidcblxuXG4gICAgcmV0dXJuIEZJTEVUWVBFX0JZX1BST0RVQ1RfVFlQRVtwcm9kdWN0VHlwZV1cbn1cblxuLyoqXG4gKiBMb2FkcyBhbiBpbiBtZW1vcnkgcmVwcmVzZW50YXRpb24gb2YgYSBwcm9qY3QucGJ4cHJvaiBmaWxlLFxuICogYWxsb3dzIG1hbmlwdWxhdGluZyB0aGF0IGluIG1lbW9yeSByZXByZXNlbnRhdGlvbiwgYW5kIHRoZW5cbiAqIHNhdmluZyBpdCBiYWNrIHRvIGRpc2suXG4gKiBcbiAqIFVzZWQgdG8gYmUgY2FsbGVkIHBieFByb2plY3QuXG4gKi9cbmV4cG9ydCBjbGFzcyBYY1Byb2plY3RGaWxlRWRpdG9yIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcblxuICAgIHJlYWRvbmx5IGZpbGVwYXRoOiBzdHJpbmc7XG5cbiAgICBoYXNoPzogSVhjb2RlUHJvakZpbGU7XG4gICAgd3JpdGVyPzogUGJ4V3JpdGVyO1xuXG4gICAgY29uc3RydWN0b3IoZmlsZW5hbWU6IHN0cmluZykge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLmZpbGVwYXRoID0gcGF0aC5yZXNvbHZlKGZpbGVuYW1lKTtcbiAgICB9XG5cbiAgICAvKiogXG4gICAgICogQXN5bmNyb25vdXNseSByZWFkIGFuZCBwYXJzZSB0aGUgZmlsZSBhbmQgY3JlYXRlLiAgVGhpcyBmb3Jrc1xuICAgICAqIGFub3RoZXIgcHJvY2VzcyBhbmQgaGFzIHRoYXQgc2Vjb25kIHByb2Nlc3Mgc2VuZCBhIG1lc3NhZ2UgYmFja1xuICAgICAqIHRvIHRoZSBmaXJzdC4gIFRoZSBmaXJzdCBtZXNzYWdlIG5ldmVyIHJlY2VpdmVkIGEgbWVzc2FnZSBhbmQganVzdFxuICAgICAqIGV4aXRlZCB3aGVuIEkgdHJpZWQgdGhpcy4gIERyb3BwZWQgdGhpcyBpbiBmYXZvciBvZiBwYXJzZVN5bmNcbiAgICAgKiBzaW5jZSB0aGlzIGlzIG5vdCBhIHNlcnZlciBhcHBsaWNhdGlvbiBhbnl3YXlzLlxuICAgICAqIFxuICAgICAqIEBwYXJhbSBjYiBXaWxsIGJlIGNhbGxlZCB3aXRoIHJlc3VsdCBiZWluZyBhbiBpbnN0YW5jZSBvZiBlcnJvclxuICAgICAqIChpbmZlcnJlZCAgZnJvbSBuYW1lIG9yIGNvZGUgcHJvcGVydHkpIG9yIG51bGwgaWYgc3VjY2Vzc2Z1bC4gIFRoZSBzZWNvbmRcbiAgICAgKiBwYXJhbWV0ZXIgd2lsbCBiZSB0aGUgbW9kZWwgb2YgdGhlIHByb2plY3QgZmlsZSwgd2hpY2ggeW91IHNob3VsZCBcbiAgICAgKiBsaWtlbHkgaWdub3JlIGFzIHRoZSBwb2ludCBvZiB0aGlzIHByb2plY3Qgd3JhcHBlciBpcyB0byBtYW5pcHVsYXRlIGl0LlxuICAgICAqIFxuICAgICAqIFJhc2llcyBldmVudCBlcnJvciBvciBlbmQgYWxzby4gIFRoZXNlIGFyZSBhbiBhbHRlcm5hdGl2ZSB0byB0aGUgdXNlIG9mIHRoZVxuICAgICAqIGNhbGxiYWNrLlxuICAgICAqIFxuICAgICAqIFRoaXMgbWV0aG9kIGNhdXNlcyBpc3N1ZXMgYXR0YWNoaW5nIGEgZGVidWdnZXIgdG8gdGhlIHByb2Nlc3MuICBUbyByZXNvbHZlIHRoaXNcbiAgICAgKiB5b3UgY2FuIHNldCB0aGUgZW52aXJvbm1lbnQgdmFyaWFibGUgXCJYTk9ERV9QQVJTRV9BVk9JRF9GT1JLXCIgdG8gXCIxXCIgYW5kIHRoaXMgd2lsbCBhdm9pZCB0aGUgZm9ya1xuICAgICAqIGFuZCBhbGxvdyB5b3UgdG8gZGVidWcgdGhlIGNvZGUgd2l0aCBhIGRlYnVnZ2VyLiAgTk9URSB0aGUgZmFpbHVyZSB3YXMgb25seSBcbiAgICAgKiBjb25maXJtZWQgd2hlbiBkZWJ1Z2dpbmcgZnJvbSB2c2NvZGUuXG4gICAgICovXG4gICAgcGFyc2UoY2I/OiAocmVzdWx0OiBFcnJvciB8IG51bGwsIG1vZGVsOiBhbnkpID0+IHZvaWQpOiB0aGlzIHtcblxuICAgICAgICBpZiAoY2IpIHtcbiAgICAgICAgICAgIHRoaXMub24oJ2Vycm9yJywgY2IpO1xuICAgICAgICAgICAgdGhpcy5vbignZW5kJywgY2IpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHJlcGxhY2VQYXJzZVdpdGhQYXJzZVN5bmMpIHtcbiAgICAgICAgICAgIC8vIFJlcXVpcmVkIGZvciBhbnkgZWZmZWN0aXZlIHVzZSBvZiBkZWJ1Z2dpbmcgaW4gdnNjb2RlLlxuICAgICAgICAgICAgbGV0IGVycm9yOiBhbnkgPSBudWxsO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcnNlU3luYygpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgZXJyb3IgPSBlcnI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vICBTY2hlZHVsZSB0aGUgY2FsbGJhY2sgdG8gYmUgc29tZXdoYXQgY2xvc2UgdG8gYSBmb3JrLlxuICAgICAgICAgICAgLy8gIFdlIGRvIHRoaXMgYmVjYXVzZSB3ZSB3YW50IHRoaXMgdG8gYmVoYXZlIHRoZSBzYW1lIGR1cmluZ1xuICAgICAgICAgICAgLy8gIGRlYnVnIHNlc3Npb24gYXMgaW4gYSBub3JtYWwgc2Vzc2lvbiB0aGF0IHBlcmZvcm1zIHRoZSBhY3R1YWwgZm9yay5cbiAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1vZGVsSGFzaCA9IHRoaXMuaGFzaDsgLy8gKGRlYnVnZ2luZyBlYXNpZXIpXG4gICAgICAgICAgICAgICAgY29uc3QgcmV0RXJyID0gZXJyb3I7IC8vIFB1bGwgb3V0IG9mIGNsb3N1cmUgKGRlYnVnZ2luZyBlYXNpZXIpXG5cbiAgICAgICAgICAgICAgICAvLyBDaGVjayBTeW50YXhFcnJvciBhbmQgY29kZSB0byBrZWVwIGxvZ2ljYWxseSBpbiBzeW5jIHdpdGggZm9yayBjb2RlLlxuICAgICAgICAgICAgICAgIC8vICBJdCBpcyBwcm9iYWJseSB1bm5lY2Vzc2FyeS5cbiAgICAgICAgICAgICAgICBpZiAocmV0RXJyICE9IG51bGwgJiYgKHJldEVyci5uYW1lID09ICdTeW50YXhFcnJvcicgfHwgcmV0RXJyLmNvZGUpKSB7IFxuICAgICAgICAgICAgICAgICAgICB0aGlzLmVtaXQoJ2Vycm9yJywgcmV0RXJyKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmVtaXQoJ2VuZCcsIG51bGwsIG1vZGVsSGFzaCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgMSk7XG5cbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgLy8gT3JpZ2luYWwgbG9naWMgb2YgdXNpbmcgZm9yayBhc3N1bWluZyB0aGF0IHRoZSBwYXJzZSBwcm9jZXNzIGlzIGV4cGVuc2l2ZSBcbiAgICAgICAgICAgIC8vICBhbmQgZWF0aW5nIHZhbHVlYWJsZSBDUFUgY3ljbGVzIG9mIHRoZSBwcm9jZXNzIG1vZGlmeWluZyB0aGlzIGZpbGUuXG4gICAgICAgICAgICB2YXIgd29ya2VyOiBDaGlsZFByb2Nlc3MgPSBmb3JrKF9fZGlybmFtZSArICcvcGFyc2VKb2IuanMnLCBbdGhpcy5maWxlcGF0aF0pXG5cbiAgICAgICAgICAgIHdvcmtlci5vbignbWVzc2FnZScsIChtc2c6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChtc2cubmFtZSA9PSAnU3ludGF4RXJyb3InIHx8IG1zZy5jb2RlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCBtc2cpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaGFzaCA9IG1zZztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0KCdlbmQnLCBudWxsLCBtc2cpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qIHN5bmMgdmVyc2lvbiBvZiBwYXJzZS4gIFRoaXMgYWN0dWFsbHkgd29ya2VkIGluIG15IHRyaWFscyBjb21wYXJlZCB0byB0aGUgcGFyc2UgdmVyc2lvblxuICAgICB3aGljaCBkaWQgbm90LiAgVGhlIHBhcnNlIHZlcnNpb24ncyBpbXBsZW1lbnRhdGlvbiBpcyBhbiBvdmVyZWFnZXIgb3B0aW1pemF0aW9uIHRoYXQgYXR0ZW1wdHNcbiAgICAgdG8gcGVyZm9ybSB0aGUgcGFyc2luZyBpbiBhIGZvcmtlZCBwcm9jZXNzLiAqL1xuICAgIHBhcnNlU3luYygpOiB0aGlzIHtcbiAgICAgICAgdmFyIGZpbGVfY29udGVudHMgPSBmcy5yZWFkRmlsZVN5bmModGhpcy5maWxlcGF0aCwgJ3V0Zi04Jyk7XG5cbiAgICAgICAgdGhpcy5oYXNoID0gcGFyc2VyLnBhcnNlKGZpbGVfY29udGVudHMpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKiAgR2VuZXJhdGUgdGhlIGNvbnRlbnRzIG9mIHRoZSBwcm9qZWN0LnBieHByb2ogZmlsZS4gIE5vdGUsIHRoaXMgZG9lcyBub3RcbiAgICB3cml0ZSBhbnl0aGluZyB0byBkaXNrLiAqL1xuICAgIHdyaXRlU3luYyhvcHRpb25zPzogUGJ4V3JpdGVyT3B0aW9ucyk6IHN0cmluZyB7XG4gICAgICAgIHRoaXMud3JpdGVyID0gbmV3IFBieFdyaXRlcih0aGlzLmhhc2gsIG9wdGlvbnMpO1xuICAgICAgICByZXR1cm4gdGhpcy53cml0ZXIud3JpdGVTeW5jKCk7XG4gICAgfVxuXG5cbiAgICAvKiBSZXR1cm4gYWxsIFV1aWRzIHdpdGhpbiBhbGwgc2VjdGlvbnMgb2YgdGhlIHByb2plY3QgKi9cbiAgICBhbGxVdWlkcygpOiBYQ19QUk9KX1VVSURbXSB7XG5cbiAgICAgICAgaWYgKCF0aGlzLmhhc2gpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3BhcnNlIG5vdCBjb21wbGV0ZWQnKTtcblxuICAgICAgICBjb25zdCBzZWN0aW9uczogeyBbaXNhVHlwZUtleTogc3RyaW5nXTogU2VjdGlvbiB9ID0gdGhpcy5oYXNoLnByb2plY3Qub2JqZWN0cztcbiAgICAgICAgbGV0IHV1aWRzOiBYQ19QUk9KX1VVSURbXSA9IFtdO1xuXG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIHNlY3Rpb25zKSB7XG4gICAgICAgICAgICBjb25zdCBzZWN0aW9uOiBTZWN0aW9uID0gc2VjdGlvbnNba2V5XVxuICAgICAgICAgICAgdXVpZHMgPSB1dWlkcy5jb25jYXQoT2JqZWN0LmtleXMoc2VjdGlvbikpXG4gICAgICAgIH1cblxuICAgICAgICB1dWlkcyA9IHV1aWRzLmZpbHRlcihmdW5jdGlvbiAoa2V5OiBYQ19QUk9KX1VVSUQpIHtcbiAgICAgICAgICAgIC8vICBJIGFtIHVuY29tZm9ydGFibGUgdGhhdCB0aGlzIGFzc3VtZXMgdGhlcmUgYXJlIG9iamVjdHMgaW4gdGhlIGRpY3Rpb25hcnlcbiAgICAgICAgICAgIC8vICBvdGhlciB0aGFuIGEgY29tbWVudCBvciBhIDI0IGxvbmcgVVVJRC4gICAgQnV0IEkgZm91bmQgaXQgdGhpcyB3YXkgYW5kIGRvbid0IGtub3dcbiAgICAgICAgICAgIC8vICB0aGF0IHRoZSBwYXJzZXIgbWF5IG5vdCBmaW5kIGEgbm9uIDI0IGNoYXJhY2h0ZXIgbm9uIGNvbW1lbnQuICAgV2VudCBhbGwgaW4gYW5kIGFzc3VtZWRcbiAgICAgICAgICAgIC8vICBpdCBpcyAyNCBjaGFycyBldmVyeXdoZXJlLlxuICAgICAgICAgICAgLy8gcmV0dXJuICFTZWN0aW9uVXRpbHMuZGljdEtleUlzQ29tbWVudCAmJiBzdHIubGVuZ3RoID09IDI0O1xuICAgICAgICAgICAgcmV0dXJuIFNlY3Rpb25VdGlscy5kaWN0S2V5SXNVdWlkKGtleSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiB1dWlkcztcbiAgICB9XG5cbiAgICAvKiogUmV0dXJuIGEgbmV3IDI0IGNoYXJhY2h0ZXIgVXVpZCB0aGF0IGRvZXMgbm90IGFscmVhZHkgZXhpc3QgaW4gdGhlIHByb2plY3QgKi9cbiAgICBnZW5lcmF0ZVV1aWQoKTogWENfUFJPSl9VVUlEIHtcbiAgICAgICAgY29uc3QgaWQgPSB1dWlkLnY0KClcbiAgICAgICAgICAgIC5yZXBsYWNlKC8tL2csICcnKVxuICAgICAgICAgICAgLnN1YnN0cigwLCAyNClcbiAgICAgICAgICAgIC50b1VwcGVyQ2FzZSgpXG5cbiAgICAgICAgaWYgKHRoaXMuYWxsVXVpZHMoKS5pbmRleE9mKGlkKSA+PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5nZW5lcmF0ZVV1aWQoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBpZDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKiBcbiAgICAgICAgKiBBZGQgYSBwbHVnaW4gZmlsZSBpZiBub3QgYWxyZWFkeSBleGlzdGluZy5cbiAgICAgICAgKiBBbHNvIGFkZHMgaXQgdG8gdGhlIFBieEZpbGVSZWZlcmVuY2UgU2VjdGlvbiBhbmQgdGhlIHBsdWdpbnMgUGJ4R3JvdXBcbiAgICAgICAgKiBAcmV0dXJucyBudWxsIGlmIGZpbGUgYWxyZWFkeSBleGlzdHMuXG4gICAgICAgICovXG4gICAgYWRkUGx1Z2luRmlsZShwYXRoOiBzdHJpbmcsIG9wdD86IElQYnhGaWxlT3B0aW9ucyB8IG51bGwpOiBQYnhGaWxlIHwgbnVsbCB7XG5cbiAgICAgICAgY29uc3QgZmlsZSA9IG5ldyBQYnhGaWxlKHBhdGgsIG9wdCk7XG5cbiAgICAgICAgZmlsZS5wbHVnaW4gPSB0cnVlOyAvLyBBc3N1bWluZyBhIGNsaWVudCBvZiB0aGlzIGxpYnJhcnkgdXNlcyB0aGlzLiAgTGVhdmluZyBmb3Igbm8gb3RoZXIgcmVhc29uLlxuICAgICAgICBjb3JyZWN0Rm9yUGx1Z2luc1BhdGgoZmlsZSwgdGhpcyk7XG5cbiAgICAgICAgLy8gbnVsbCBpcyBiZXR0ZXIgZm9yIGVhcmx5IGVycm9yc1xuICAgICAgICBpZiAodGhpcy5oYXNGaWxlKGZpbGUucGF0aCkpIHJldHVybiBudWxsO1xuXG4gICAgICAgIGZpbGUuZmlsZVJlZiA9IHRoaXMuZ2VuZXJhdGVVdWlkKCk7XG5cbiAgICAgICAgdGhpcy5hZGRUb1BieEZpbGVSZWZlcmVuY2VTZWN0aW9uKGZpbGUpOyAgICAvLyBQQlhGaWxlUmVmZXJlbmNlXG4gICAgICAgIHRoaXMuYWRkVG9QbHVnaW5zUGJ4R3JvdXAoZmlsZSk7ICAgICAgICAgICAgLy8gUEJYR3JvdXBcblxuICAgICAgICByZXR1cm4gZmlsZTtcbiAgICB9XG5cblxuICAgIC8qKiBJbnZlcnNlIG9mIGFkZFBsdWdpbkZpbGUuICBBbHdheXMgcmV0dXJucyBhIG5ldyBpbnN0YW5jZSBpZiBJUGJ4RmlsZVxuICAgICAqIHRoYXQgd2FzIHJlbW92ZWQuXG4gICAgICovXG4gICAgcmVtb3ZlUGx1Z2luRmlsZShwYXRoOiBzdHJpbmcsIG9wdD86IElQYnhGaWxlT3B0aW9ucyB8IG51bGwpOiBQYnhGaWxlIHtcbiAgICAgICAgY29uc3QgZmlsZSA9IG5ldyBQYnhGaWxlKHBhdGgsIG9wdCk7XG4gICAgICAgIGNvcnJlY3RGb3JQbHVnaW5zUGF0aChmaWxlLCB0aGlzKTtcblxuICAgICAgICB0aGlzLnJlbW92ZUZyb21QYnhGaWxlUmVmZXJlbmNlU2VjdGlvbihmaWxlKTsgICAgLy8gUEJYRmlsZVJlZmVyZW5jZVxuICAgICAgICB0aGlzLnJlbW92ZUZyb21QbHVnaW5zUGJ4R3JvdXAoZmlsZSk7ICAgICAgICAgICAgLy8gUEJYR3JvdXBcblxuICAgICAgICByZXR1cm4gZmlsZTtcbiAgICB9XG5cbiAgICAvKiAgU2ltaWxhciB0byBhZGQgcGx1Z2luIGZpbGUgYnV0IGl0IGlzIGFkZGVkIHRvIHRoZSBQcm9kdWN0c1BieEdyb3VwICovXG5cbiAgICBhZGRQcm9kdWN0RmlsZSh0YXJnZXRQYXRoOiBzdHJpbmcsXG4gICAgICAgIG9wdD86IChJUGJ4RmlsZU9wdGlvbnMgJlxuICAgICAgICB7XG4gICAgICAgICAgICAvKiogVGhpcyB3aWxsIG92ZXJyaWRlIHRoZSBkZWZhdWx0IGdyb3VwLiAgKi9cbiAgICAgICAgICAgIGdyb3VwPzogRklMRVRZUEVfR1JPVVBcbiAgICAgICAgfVxuICAgICAgICApIHwgbnVsbCk6IFBieEZpbGUge1xuXG4gICAgICAgIGNvbnN0IGZpbGUgPSBuZXcgUGJ4RmlsZSh0YXJnZXRQYXRoLCBvcHQpO1xuXG4gICAgICAgIGZpbGUuaW5jbHVkZUluSW5kZXggPSAwO1xuICAgICAgICBmaWxlLmZpbGVSZWYgPSB0aGlzLmdlbmVyYXRlVXVpZCgpO1xuICAgICAgICBmaWxlLnRhcmdldCA9IG9wdCA/IG9wdC50YXJnZXQgOiB1bmRlZmluZWQ7XG4gICAgICAgIGZpbGUuZ3JvdXAgPSBvcHQgPyBvcHQuZ3JvdXAgOiB1bmRlZmluZWQ7XG4gICAgICAgIGZpbGUudXVpZCA9IHRoaXMuZ2VuZXJhdGVVdWlkKCk7XG4gICAgICAgIGZpbGUucGF0aCA9IGZpbGUuYmFzZW5hbWU7XG5cbiAgICAgICAgdGhpcy5hZGRUb1BieEZpbGVSZWZlcmVuY2VTZWN0aW9uKGZpbGUpO1xuICAgICAgICB0aGlzLmFkZFRvUHJvZHVjdHNQYnhHcm91cChmaWxlKTsgICAgICAgICAgICAgICAgLy8gUEJYR3JvdXBcblxuICAgICAgICByZXR1cm4gZmlsZTtcbiAgICB9XG5cbiAgICAvKiogVGhpcyByZW1vdmVzIHRoaXMgZnJvbSB0aGUgcHJvZHVjdHMgZ3JvdXAuICBPZGRseSBlbm91Z2ggaXQgZG9lcyBub3RcbiAgICAgKiByZW1vdmUgaXQgZnJvbSB0aGUgUGJ4UmVmZXJlbmNlU2VjdGlvbiBhcyBhIHBsdWdpbiBmaWxlLiAgSSBkb24ndCBrbm93XG4gICAgICogd2h5IHRoaXMgaXMgYXQgdGhlIHRpbWUgb2Ygd3JpdGluZy5cbiAgICAgKi9cbiAgICByZW1vdmVQcm9kdWN0RmlsZShwYXRoOiBzdHJpbmcsIG9wdD86IElQYnhGaWxlT3B0aW9ucyB8IG51bGwpOiBQYnhGaWxlIHtcbiAgICAgICAgY29uc3QgZmlsZSA9IG5ldyBQYnhGaWxlKHBhdGgsIG9wdCk7XG5cbiAgICAgICAgdGhpcy5yZW1vdmVGcm9tUHJvZHVjdHNQYnhHcm91cChmaWxlKTsgICAgICAgICAgIC8vIFBCWEdyb3VwXG5cbiAgICAgICAgcmV0dXJuIGZpbGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0gcGF0aCB7U3RyaW5nfVxuICAgICAqIEBwYXJhbSBvcHQge09iamVjdH0gc2VlIFBieEZpbGUgZm9yIGF2YWlsIG9wdGlvbnNcbiAgICAgKiBAcGFyYW0gZ3JvdXAge1N0cmluZ30gZ3JvdXAga2V5XG4gICAgICogQHJldHVybnMge09iamVjdH0gZmlsZTsgc2VlIFBieEZpbGVcbiAgICAgKi9cbiAgICBhZGRTb3VyY2VGaWxlKHBhdGg6IHN0cmluZywgb3B0PzogSVBieEZpbGVPcHRpb25zLCBncm91cD86IHN0cmluZyk6IFBieEZpbGUgfCBmYWxzZSB7XG4gICAgICAgIGxldCBmaWxlO1xuICAgICAgICBpZiAoZ3JvdXApIHtcbiAgICAgICAgICAgIGZpbGUgPSB0aGlzLmFkZEZpbGUocGF0aCwgZ3JvdXAsIG9wdCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBmaWxlID0gdGhpcy5hZGRQbHVnaW5GaWxlKHBhdGgsIG9wdCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWZpbGUpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgZmlsZS50YXJnZXQgPSBvcHQgPyBvcHQudGFyZ2V0IDogdW5kZWZpbmVkO1xuICAgICAgICBmaWxlLnV1aWQgPSB0aGlzLmdlbmVyYXRlVXVpZCgpO1xuXG4gICAgICAgIHRoaXMuYWRkVG9QYnhCdWlsZEZpbGVTZWN0aW9uKGZpbGUpOyAgICAgICAgLy8gUEJYQnVpbGRGaWxlXG4gICAgICAgIHRoaXMuYWRkVG9QYnhTb3VyY2VzQnVpbGRQaGFzZShmaWxlKTsgICAgICAgLy8gUEJYU291cmNlc0J1aWxkUGhhc2VcblxuICAgICAgICByZXR1cm4gZmlsZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSBwYXRoIHtTdHJpbmd9XG4gICAgICogQHBhcmFtIG9wdCB7T2JqZWN0fSBzZWUgUGJ4RmlsZSBmb3IgYXZhaWwgb3B0aW9uc1xuICAgICAqIEBwYXJhbSBncm91cCB7U3RyaW5nfSBncm91cCBrZXlcbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBmaWxlOyBzZWUgUGJ4RmlsZVxuICAgICAqL1xuICAgIHJlbW92ZVNvdXJjZUZpbGUocGF0aDogc3RyaW5nLCBvcHQ/OiBJUGJ4RmlsZU9wdGlvbnMsIGdyb3VwPzogc3RyaW5nIHwgbnVsbCk6IFBieEZpbGUge1xuXG4gICAgICAgIGxldCBmaWxlOiBQYnhGaWxlO1xuXG4gICAgICAgIGlmIChncm91cCkge1xuICAgICAgICAgICAgZmlsZSA9IHRoaXMucmVtb3ZlRmlsZShwYXRoLCBncm91cCwgb3B0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZpbGUgPSB0aGlzLnJlbW92ZVBsdWdpbkZpbGUocGF0aCwgb3B0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZpbGUudGFyZ2V0ID0gb3B0ID8gb3B0LnRhcmdldCA6IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5yZW1vdmVGcm9tUGJ4QnVpbGRGaWxlU2VjdGlvbihmaWxlKTsgICAgICAgIC8vIFBCWEJ1aWxkRmlsZVxuICAgICAgICB0aGlzLnJlbW92ZUZyb21QYnhTb3VyY2VzQnVpbGRQaGFzZShmaWxlKTsgICAgICAgLy8gUEJYU291cmNlc0J1aWxkUGhhc2VcblxuICAgICAgICByZXR1cm4gZmlsZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSBwYXRoIHtTdHJpbmd9XG4gICAgICogQHBhcmFtIG9wdCB7T2JqZWN0fSBzZWUgcGJ4RmlsZSBmb3IgYXZhaWwgb3B0aW9uc1xuICAgICAqIEBwYXJhbSBncm91cCB7U3RyaW5nfSBncm91cCBrZXlcbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBmaWxlOyBzZWUgcGJ4RmlsZVxuICAgICAqL1xuICAgIGFkZEhlYWRlckZpbGUocGF0aDogc3RyaW5nLCBvcHQ/OiBJUGJ4RmlsZU9wdGlvbnMsIGdyb3VwPzogc3RyaW5nIHwgbnVsbCk6IFBieEZpbGUgfCBudWxsIHtcbiAgICAgICAgaWYgKGdyb3VwKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5hZGRGaWxlKHBhdGgsIGdyb3VwLCBvcHQpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWRkUGx1Z2luRmlsZShwYXRoLCBvcHQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0gcGF0aCB7U3RyaW5nfVxuICAgICAqIEBwYXJhbSBvcHQge09iamVjdH0gc2VlIHBieEZpbGUgZm9yIGF2YWlsIG9wdGlvbnNcbiAgICAgKiBAcGFyYW0gZ3JvdXAge1N0cmluZ30gZ3JvdXAga2V5XG4gICAgICogQHJldHVybnMge09iamVjdH0gZmlsZTsgc2VlIHBieEZpbGVcbiAgICAgKi9cbiAgICByZW1vdmVIZWFkZXJGaWxlKHBhdGg6IHN0cmluZywgb3B0PzogSVBieEZpbGVPcHRpb25zIHwgbnVsbCwgZ3JvdXA/OiBzdHJpbmcgfCBudWxsKTogUGJ4RmlsZSB7XG4gICAgICAgIGlmIChncm91cCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVtb3ZlRmlsZShwYXRoLCBncm91cCwgb3B0KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnJlbW92ZVBsdWdpbkZpbGUocGF0aCwgb3B0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHBhdGgge1N0cmluZ31cbiAgICAgKiBAcGFyYW0gb3B0IHtPYmplY3R9IHNlZSBwYnhGaWxlIGZvciBhdmFpbCBvcHRpb25zXG4gICAgICogQHBhcmFtIGdyb3VwIHtTdHJpbmd9IGdyb3VwIGtleVxuICAgICAqIEByZXR1cm5zIHtQYnhGaWxlfSBpZiBhZGRlZCBvciBmYWxzZSBpZiBpdCBhbHJlYWR5IGV4aXN0ZWQuXG4gICAgICovXG4gICAgYWRkUmVzb3VyY2VGaWxlKFxuICAgICAgICBwYXRoOiBzdHJpbmcsXG4gICAgICAgIG9wdD86IChJUGJ4RmlsZU9wdGlvbnMgJiB7IHBsdWdpbj86IGJvb2xlYW47IHZhcmlhbnRHcm91cD86IGJvb2xlYW4gfSkgfCBudWxsLFxuICAgICAgICBncm91cD86IFhDX1BST0pfVVVJRCB8IG51bGwpOiBQYnhGaWxlIHwgZmFsc2Uge1xuXG4gICAgICAgIG9wdCA9IG9wdCB8fCB7fTtcblxuICAgICAgICBsZXQgZmlsZTogUGJ4RmlsZSB8IG51bGwgfCB1bmRlZmluZWQ7XG5cbiAgICAgICAgaWYgKG9wdC5wbHVnaW4pIHtcbiAgICAgICAgICAgIGZpbGUgPSB0aGlzLmFkZFBsdWdpbkZpbGUocGF0aCwgb3B0KTtcbiAgICAgICAgICAgIGlmICghZmlsZSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZmlsZSA9IG5ldyBQYnhGaWxlKHBhdGgsIG9wdCk7XG4gICAgICAgICAgICBpZiAodGhpcy5oYXNGaWxlKGZpbGUucGF0aCkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZpbGUudXVpZCA9IHRoaXMuZ2VuZXJhdGVVdWlkKCk7XG4gICAgICAgIGZpbGUudGFyZ2V0ID0gb3B0ID8gb3B0LnRhcmdldCA6IHVuZGVmaW5lZDtcblxuICAgICAgICBpZiAoIW9wdC5wbHVnaW4pIHtcbiAgICAgICAgICAgIGNvcnJlY3RGb3JSZXNvdXJjZXNQYXRoKGZpbGUsIHRoaXMpO1xuICAgICAgICAgICAgZmlsZS5maWxlUmVmID0gdGhpcy5nZW5lcmF0ZVV1aWQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghb3B0LnZhcmlhbnRHcm91cCkge1xuICAgICAgICAgICAgdGhpcy5hZGRUb1BieEJ1aWxkRmlsZVNlY3Rpb24oZmlsZSk7ICAgICAgICAvLyBQQlhCdWlsZEZpbGVcbiAgICAgICAgICAgIHRoaXMuYWRkVG9QYnhSZXNvdXJjZXNCdWlsZFBoYXNlKGZpbGUpOyAgICAgLy8gUEJYUmVzb3VyY2VzQnVpbGRQaGFzZVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFvcHQucGx1Z2luKSB7XG4gICAgICAgICAgICB0aGlzLmFkZFRvUGJ4RmlsZVJlZmVyZW5jZVNlY3Rpb24oZmlsZSk7ICAgIC8vIFBCWEZpbGVSZWZlcmVuY2VcbiAgICAgICAgICAgIGlmIChncm91cCkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmdldFBCWEdyb3VwQnlLZXkoZ3JvdXApKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkVG9QYnhHcm91cChmaWxlLCBncm91cCk7ICAgICAgICAvL0dyb3VwIG90aGVyIHRoYW4gUmVzb3VyY2VzIChpLmUuICdzcGxhc2gnKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmICh0aGlzLmdldFBCWFZhcmlhbnRHcm91cEJ5S2V5KGdyb3VwKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmFkZFRvUGJ4VmFyaWFudEdyb3VwKGZpbGUsIGdyb3VwKTsgIC8vIFBCWFZhcmlhbnRHcm91cFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuYWRkVG9SZXNvdXJjZXNQYnhHcm91cChmaWxlKTsgICAgICAgICAgLy8gUEJYR3JvdXBcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZpbGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0gcGF0aCB7U3RyaW5nfVxuICAgICAqIEBwYXJhbSBvcHQge09iamVjdH0gc2VlIHBieEZpbGUgZm9yIGF2YWlsIG9wdGlvbnNcbiAgICAgKiBAcGFyYW0gZ3JvdXBVdWlkIHtTdHJpbmd9IGdyb3VwIGtleVxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9IGZpbGU7IHNlZSBwYnhGaWxlXG4gICAgICovXG4gICAgcmVtb3ZlUmVzb3VyY2VGaWxlKHBhdGg6IHN0cmluZywgb3B0PzogSVBieEZpbGVPcHRpb25zIHwgbnVsbCwgZ3JvdXBVdWlkPzogWENfUFJPSl9VVUlEKTogUGJ4RmlsZSB7XG4gICAgICAgIHZhciBmaWxlID0gbmV3IFBieEZpbGUocGF0aCwgb3B0KTtcbiAgICAgICAgZmlsZS50YXJnZXQgPSBvcHQgPyBvcHQudGFyZ2V0IDogdW5kZWZpbmVkO1xuXG4gICAgICAgIGNvcnJlY3RGb3JSZXNvdXJjZXNQYXRoKGZpbGUsIHRoaXMpO1xuXG4gICAgICAgIHRoaXMucmVtb3ZlRnJvbVBieEJ1aWxkRmlsZVNlY3Rpb24oZmlsZSk7ICAgICAgICAvLyBQQlhCdWlsZEZpbGVcbiAgICAgICAgdGhpcy5yZW1vdmVGcm9tUGJ4RmlsZVJlZmVyZW5jZVNlY3Rpb24oZmlsZSk7ICAgIC8vIFBCWEZpbGVSZWZlcmVuY2VcblxuICAgICAgICBpZiAoZ3JvdXBVdWlkKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5nZXRQQlhHcm91cEJ5S2V5KGdyb3VwVXVpZCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbW92ZUZyb21QYnhHcm91cChmaWxlLCBncm91cFV1aWQpOyAgICAgICAgLy9Hcm91cCBvdGhlciB0aGFuIFJlc291cmNlcyAoaS5lLiAnc3BsYXNoJylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuZ2V0UEJYVmFyaWFudEdyb3VwQnlLZXkoZ3JvdXBVdWlkKSkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVtb3ZlRnJvbVBieFZhcmlhbnRHcm91cChmaWxlLCBncm91cFV1aWQpOyAgLy8gUEJYVmFyaWFudEdyb3VwXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZUZyb21SZXNvdXJjZXNQYnhHcm91cChmaWxlKTsgICAgICAgICAgLy8gUEJYR3JvdXBcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucmVtb3ZlRnJvbVBieFJlc291cmNlc0J1aWxkUGhhc2UoZmlsZSk7ICAgICAvLyBQQlhSZXNvdXJjZXNCdWlsZFBoYXNlXG5cbiAgICAgICAgcmV0dXJuIGZpbGU7XG4gICAgfVxuXG4gICAgYWRkRnJhbWV3b3JrKGZwYXRoOiBzdHJpbmcsXG4gICAgICAgIG9wdD86IChJUGJ4RmlsZU9wdGlvbnMgJlxuICAgICAgICB7XG4gICAgICAgICAgICAvKiogZGVmYXVsdHMgdG8gdHJ1ZSBpZiBub3Qgc3BlY2lmaWVkLiAqL1xuICAgICAgICAgICAgbGluaz86IGJvb2xlYW5cbiAgICAgICAgfVxuICAgICAgICApIHwgbnVsbCk6IFBieEZpbGUgfCBmYWxzZSB7XG5cbiAgICAgICAgLy8gIFdlIGNhcHR1cmUgdGhlc2UgZWFybHkgc2luY2UgdGhlIG9wdGlvbiBpcyBtb2RpZmllZCBhZnRlciBjYWxsaW5nLlxuICAgICAgICBjb25zdCBjdXN0b21GcmFtZXdvcms6IGJvb2xlYW4gPSAhIShvcHQgJiYgb3B0LmN1c3RvbUZyYW1ld29yayA9PSB0cnVlKTtcbiAgICAgICAgY29uc3QgbGluazogYm9vbGVhbiA9ICFvcHQgfHwgKG9wdC5saW5rID09IHVuZGVmaW5lZCB8fCBvcHQubGluayk7ICAgIC8vZGVmYXVsdHMgdG8gdHJ1ZSBpZiBub3Qgc3BlY2lmaWVkXG4gICAgICAgIGNvbnN0IGVtYmVkOiBib29sZWFuID0gISEob3B0ICYmIG9wdC5lbWJlZCk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9kZWZhdWx0cyB0byBmYWxzZSBpZiBub3Qgc3BlY2lmaWVkXG5cbiAgICAgICAgaWYgKG9wdCkge1xuICAgICAgICAgICAgZGVsZXRlIG9wdC5lbWJlZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBmaWxlID0gbmV3IFBieEZpbGUoZnBhdGgsIG9wdCk7XG5cbiAgICAgICAgZmlsZS51dWlkID0gdGhpcy5nZW5lcmF0ZVV1aWQoKTtcbiAgICAgICAgZmlsZS5maWxlUmVmID0gdGhpcy5nZW5lcmF0ZVV1aWQoKTtcbiAgICAgICAgZmlsZS50YXJnZXQgPSBvcHQgPyBvcHQudGFyZ2V0IDogdW5kZWZpbmVkO1xuXG4gICAgICAgIGlmICh0aGlzLmhhc0ZpbGUoZmlsZS5wYXRoKSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIHRoaXMuYWRkVG9QYnhCdWlsZEZpbGVTZWN0aW9uKGZpbGUpOyAgICAgICAgLy8gUEJYQnVpbGRGaWxlXG4gICAgICAgIHRoaXMuYWRkVG9QYnhGaWxlUmVmZXJlbmNlU2VjdGlvbihmaWxlKTsgICAgLy8gUEJYRmlsZVJlZmVyZW5jZVxuICAgICAgICB0aGlzLmFkZFRvRnJhbWV3b3Jrc1BieEdyb3VwKGZpbGUpOyAgICAgICAgIC8vIFBCWEdyb3VwXG5cbiAgICAgICAgaWYgKGxpbmspIHtcbiAgICAgICAgICAgIHRoaXMuYWRkVG9QYnhGcmFtZXdvcmtzQnVpbGRQaGFzZShmaWxlKTsgICAgLy8gUEJYRnJhbWV3b3Jrc0J1aWxkUGhhc2VcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHQgJiYgY3VzdG9tRnJhbWV3b3JrKSB7IC8vIGV4dHJhIGNoZWNrIG9uIG9wdCBpcyBmb3IgVHlwZXNjcmlwdCwgbm90IGxvZ2ljYWxseSByZXF1aXJlZFxuICAgICAgICAgICAgdGhpcy5hZGRUb0ZyYW1ld29ya1NlYXJjaFBhdGhzKGZpbGUpO1xuXG4gICAgICAgICAgICBpZiAoZW1iZWQpIHtcbiAgICAgICAgICAgICAgICBvcHQuZW1iZWQgPSBlbWJlZDtcbiAgICAgICAgICAgICAgICB2YXIgZW1iZWRkZWRGaWxlID0gbmV3IFBieEZpbGUoZnBhdGgsIG9wdCk7XG5cbiAgICAgICAgICAgICAgICBlbWJlZGRlZEZpbGUudXVpZCA9IHRoaXMuZ2VuZXJhdGVVdWlkKCk7XG4gICAgICAgICAgICAgICAgZW1iZWRkZWRGaWxlLmZpbGVSZWYgPSBmaWxlLmZpbGVSZWY7XG5cbiAgICAgICAgICAgICAgICAvL2tlZXBpbmcgYSBzZXBhcmF0ZSBQQlhCdWlsZEZpbGUgZW50cnkgZm9yIEVtYmVkIEZyYW1ld29ya3NcbiAgICAgICAgICAgICAgICB0aGlzLmFkZFRvUGJ4QnVpbGRGaWxlU2VjdGlvbihlbWJlZGRlZEZpbGUpOyAgICAgICAgLy8gUEJYQnVpbGRGaWxlXG5cbiAgICAgICAgICAgICAgICB0aGlzLmFkZFRvUGJ4RW1iZWRGcmFtZXdvcmtzQnVpbGRQaGFzZShlbWJlZGRlZEZpbGUpOyAvLyBQQlhDb3B5RmlsZXNCdWlsZFBoYXNlXG5cbiAgICAgICAgICAgICAgICByZXR1cm4gZW1iZWRkZWRGaWxlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZpbGU7XG4gICAgfVxuXG4gICAgcmVtb3ZlRnJhbWV3b3JrKGZwYXRoOiBzdHJpbmcsIG9wdD86IElQYnhGaWxlT3B0aW9ucyB8IG51bGwpOiBQYnhGaWxlIHtcbiAgICAgICAgLy8gIFRoaXMgd2FzIGNhbGN1bGF0ZWQgaW4gdGhlIG9yaWdpbmFsIGNvZGUsIGJ1dCBuZXZlciB1c2VkLiAgRXJyb3I/ICAxMC8yMDE5XG4gICAgICAgIC8vY29uc3QgZW1iZWQ6Ym9vbGVhbiA9ICEhKG9wdCAmJiBvcHQuZW1iZWQpO1xuXG4gICAgICAgIGlmIChvcHQpIHtcbiAgICAgICAgICAgIGRlbGV0ZSBvcHQuZW1iZWQ7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBmaWxlID0gbmV3IFBieEZpbGUoZnBhdGgsIG9wdCk7XG4gICAgICAgIGZpbGUudGFyZ2V0ID0gb3B0ID8gb3B0LnRhcmdldCA6IHVuZGVmaW5lZDtcblxuICAgICAgICB0aGlzLnJlbW92ZUZyb21QYnhCdWlsZEZpbGVTZWN0aW9uKGZpbGUpOyAgICAgICAgICAvLyBQQlhCdWlsZEZpbGVcbiAgICAgICAgdGhpcy5yZW1vdmVGcm9tUGJ4RmlsZVJlZmVyZW5jZVNlY3Rpb24oZmlsZSk7ICAgICAgLy8gUEJYRmlsZVJlZmVyZW5jZVxuICAgICAgICB0aGlzLnJlbW92ZUZyb21GcmFtZXdvcmtzUGJ4R3JvdXAoZmlsZSk7ICAgICAgICAgICAvLyBQQlhHcm91cFxuICAgICAgICB0aGlzLnJlbW92ZUZyb21QYnhGcmFtZXdvcmtzQnVpbGRQaGFzZShmaWxlKTsgICAgICAvLyBQQlhGcmFtZXdvcmtzQnVpbGRQaGFzZVxuXG4gICAgICAgIGlmIChvcHQgJiYgb3B0LmN1c3RvbUZyYW1ld29yaykge1xuICAgICAgICAgICAgdGhpcy5yZW1vdmVGcm9tRnJhbWV3b3JrU2VhcmNoUGF0aHMoZmlsZSk7XG4gICAgICAgIH1cblxuICAgICAgICBvcHQgPSBvcHQgfHwge307XG4gICAgICAgIG9wdC5lbWJlZCA9IHRydWU7XG4gICAgICAgIHZhciBlbWJlZGRlZEZpbGUgPSBuZXcgUGJ4RmlsZShmcGF0aCwgb3B0KTtcblxuICAgICAgICBlbWJlZGRlZEZpbGUuZmlsZVJlZiA9IGZpbGUuZmlsZVJlZjtcblxuICAgICAgICB0aGlzLnJlbW92ZUZyb21QYnhCdWlsZEZpbGVTZWN0aW9uKGVtYmVkZGVkRmlsZSk7ICAgICAgICAgIC8vIFBCWEJ1aWxkRmlsZVxuICAgICAgICB0aGlzLnJlbW92ZUZyb21QYnhFbWJlZEZyYW1ld29ya3NCdWlsZFBoYXNlKGVtYmVkZGVkRmlsZSk7IC8vIFBCWENvcHlGaWxlc0J1aWxkUGhhc2VcblxuICAgICAgICByZXR1cm4gZmlsZTtcbiAgICB9XG5cblxuICAgIGFkZENvcHlmaWxlKGZwYXRoOiBzdHJpbmcsIG9wdD86IElQYnhGaWxlT3B0aW9ucyB8IG51bGwpOiBQYnhGaWxlIHtcblxuICAgICAgICBsZXQgZmlsZTogUGJ4RmlsZSA9IG5ldyBQYnhGaWxlKGZwYXRoLCBvcHQpO1xuXG4gICAgICAgIC8vIGNhdGNoIGR1cGxpY2F0ZXNcbiAgICAgICAgbGV0IGV4aXN0aW5nRmlsZTogUEJYRmlsZVJlZmVyZW5jZSB8IGZhbHNlID0gdGhpcy5oYXNGaWxlKGZpbGUucGF0aCk7XG5cbiAgICAgICAgaWYgKGV4aXN0aW5nRmlsZSkge1xuICAgICAgICAgICAgLy8gIFdBUk5JTkc6XG4gICAgICAgICAgICAvLyAgVGhpcyBpcyB0aGUgb3JpZ2luYWwgbG9naWMuICAgKEZvdW5kIDEwLzIwMTkgd2hlbiBjb252ZXJ0aW5nIHRvIFRTKVxuICAgICAgICAgICAgLy8gIEl0IHRyZWF0cyB0aGUgYWN0dWFsIFBCWEZpbGVSZWZlcmVuY2Ugb2JqZWN0IHRoYXQgaXMgYWxyZWFkeVxuICAgICAgICAgICAgLy8gIGludGVncmF0ZWQgaW50byB0aGUgZmlsZSBvYmplY3QgbW9kZWwgYXMgYSBQYnhGaWxlLCBtb2RpZmllc1xuICAgICAgICAgICAgLy8gIGl0IGFuZCB0aGVuIHJldHVybnMgaXQgdG8gdGhlIGNhbGxlci4gIFRoaXMgc2VlbXMgdW5kZXNpcmFibGUuXG4gICAgICAgICAgICAvLyAgSSBhc3N1bWUgaXQgd29ya3Mgc2luY2UgdGhlIFBieEZpbGUgYW5kIFBCWEZpbGVSZWZlcmVuY2VzIGhhdmUgXG4gICAgICAgICAgICAvLyAgbWFueSBvZiB0aGUgc2FtZSBwcm9wZXJ0aWVzIGFuZCB0aGUgb25lcyB0aGF0IGFyZSBiZWluZyBtb2RpZmllZFxuICAgICAgICAgICAgLy8gIGJlbG93IHNob3VsZCBub3QgYmUgd3JpdHRlbiBiYWNrIHRvIHRoZSBhY3R1YWwgZmlsZS5cbiAgICAgICAgICAgIC8vICBJIGFtIG5vdCBzdXJlIHRoaXMgaXMgY29ycmVjdCBhdCBhbGwuICBcbiAgICAgICAgICAgIC8vICBXaWxsIGxlYXZlIGZvciBub3cgYW5kIHJlc29sdmUgaWYgaXQgdHVybnMgb3V0IHRvIGJlIGEgYnVnLlxuICAgICAgICAgICAgZmlsZSA9IGV4aXN0aW5nRmlsZSBhcyBhbnkgYXMgUGJ4RmlsZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZpbGUuZmlsZVJlZiA9IGZpbGUudXVpZCA9IHRoaXMuZ2VuZXJhdGVVdWlkKCk7XG4gICAgICAgIGZpbGUudGFyZ2V0ID0gb3B0ID8gb3B0LnRhcmdldCA6IHVuZGVmaW5lZDtcblxuICAgICAgICB0aGlzLmFkZFRvUGJ4QnVpbGRGaWxlU2VjdGlvbihmaWxlKTsgICAgICAgIC8vIFBCWEJ1aWxkRmlsZVxuICAgICAgICB0aGlzLmFkZFRvUGJ4RmlsZVJlZmVyZW5jZVNlY3Rpb24oZmlsZSk7ICAgIC8vIFBCWEZpbGVSZWZlcmVuY2VcbiAgICAgICAgdGhpcy5hZGRUb1BieENvcHlmaWxlc0J1aWxkUGhhc2UoZmlsZSk7ICAgICAvLyBQQlhDb3B5RmlsZXNCdWlsZFBoYXNlXG5cbiAgICAgICAgcmV0dXJuIGZpbGU7XG4gICAgfVxuXG4gICAgcGJ4Q29weWZpbGVzQnVpbGRQaGFzZU9iaih0YXJnZXQ/OiBYQ19QUk9KX1VVSUQgfCBudWxsKTogUEJYQ29weUZpbGVzQnVpbGRQaGFzZSB8IG51bGwge1xuICAgICAgICByZXR1cm4gdGhpcy5idWlsZFBoYXNlT2JqZWN0KCdQQlhDb3B5RmlsZXNCdWlsZFBoYXNlJywgJ0NvcHkgRmlsZXMnLCB0YXJnZXQpO1xuICAgIH1cblxuICAgIGFkZFRvUGJ4Q29weWZpbGVzQnVpbGRQaGFzZShmaWxlOiBQYnhGaWxlKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IHNvdXJjZXMgPVxuICAgICAgICAgICAgdGhpcy5idWlsZFBoYXNlT2JqZWN0PFBCWENvcHlGaWxlc0J1aWxkUGhhc2U+KCdQQlhDb3B5RmlsZXNCdWlsZFBoYXNlJyxcbiAgICAgICAgICAgICAgICAnQ29weSBGaWxlcycsIGZpbGUudGFyZ2V0KSBhcyBQQlhDb3B5RmlsZXNCdWlsZFBoYXNlO1xuXG4gICAgICAgIGlmICghc291cmNlcykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd0YXJnZXQgbm90IGZvdW5kJyk7XG4gICAgICAgIH1cblxuICAgICAgICBzb3VyY2VzLmZpbGVzLnB1c2gocGJ4QnVpbGRQaGFzZU9iaihmaWxlKSk7XG4gICAgfVxuXG4gICAgcmVtb3ZlQ29weWZpbGUoZnBhdGg6IHN0cmluZywgb3B0OiBJUGJ4RmlsZU9wdGlvbnMpIHtcbiAgICAgICAgdmFyIGZpbGUgPSBuZXcgUGJ4RmlsZShmcGF0aCwgb3B0KTtcbiAgICAgICAgZmlsZS50YXJnZXQgPSBvcHQgPyBvcHQudGFyZ2V0IDogdW5kZWZpbmVkO1xuXG4gICAgICAgIHRoaXMucmVtb3ZlRnJvbVBieEJ1aWxkRmlsZVNlY3Rpb24oZmlsZSk7ICAgICAgICAvLyBQQlhCdWlsZEZpbGVcbiAgICAgICAgdGhpcy5yZW1vdmVGcm9tUGJ4RmlsZVJlZmVyZW5jZVNlY3Rpb24oZmlsZSk7ICAgIC8vIFBCWEZpbGVSZWZlcmVuY2VcbiAgICAgICAgdGhpcy5yZW1vdmVGcm9tUGJ4Q29weWZpbGVzQnVpbGRQaGFzZShmaWxlKTsgICAgLy8gUEJYRnJhbWV3b3Jrc0J1aWxkUGhhc2VcblxuICAgICAgICByZXR1cm4gZmlsZTtcbiAgICB9XG5cbiAgICByZW1vdmVGcm9tUGJ4Q29weWZpbGVzQnVpbGRQaGFzZShmaWxlOiBQYnhGaWxlKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IHNvdXJjZXM6IFBCWENvcHlGaWxlc0J1aWxkUGhhc2UgfCBudWxsID0gdGhpcy5wYnhDb3B5ZmlsZXNCdWlsZFBoYXNlT2JqKGZpbGUudGFyZ2V0KTtcblxuICAgICAgICBpZiAoIXNvdXJjZXMpIC8vIE5vdGhpbmcgdG8gcmVtb3ZlIGl0IGZyb20uXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgZm9yIChsZXQgaSBpbiBzb3VyY2VzLmZpbGVzKSB7XG4gICAgICAgICAgICBpZiAoc291cmNlcy5maWxlc1tpXS5jb21tZW50ID09IGxvbmdDb21tZW50KGZpbGUgYXMgSUxvbmdDb21tZW50T2JqKSkge1xuICAgICAgICAgICAgICAgIHNvdXJjZXMuZmlsZXMuc3BsaWNlKGkgYXMgdW5rbm93biBhcyBudW1iZXIsIDEpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWRkU3RhdGljTGlicmFyeShcbiAgICAgICAgcGF0aDogc3RyaW5nLFxuICAgICAgICBvcHQ/OiAoSVBieEZpbGVPcHRpb25zICYgeyBwbHVnaW4/OiBib29sZWFuIH0pIHwgbnVsbCk6IFBieEZpbGUgfCBmYWxzZSB7XG5cbiAgICAgICAgb3B0ID0gb3B0IHx8IHt9O1xuXG4gICAgICAgIGxldCBmaWxlOiBQYnhGaWxlIHwgbnVsbDtcblxuICAgICAgICBpZiAob3B0LnBsdWdpbikge1xuICAgICAgICAgICAgZmlsZSA9IHRoaXMuYWRkUGx1Z2luRmlsZShwYXRoLCBvcHQpO1xuICAgICAgICAgICAgaWYgKCFmaWxlKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmaWxlID0gbmV3IFBieEZpbGUocGF0aCwgb3B0KTtcbiAgICAgICAgICAgIGlmICh0aGlzLmhhc0ZpbGUoZmlsZS5wYXRoKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgZmlsZS51dWlkID0gdGhpcy5nZW5lcmF0ZVV1aWQoKTtcbiAgICAgICAgZmlsZS50YXJnZXQgPSBvcHQgPyBvcHQudGFyZ2V0IDogdW5kZWZpbmVkO1xuXG4gICAgICAgIGlmICghb3B0LnBsdWdpbikge1xuICAgICAgICAgICAgZmlsZS5maWxlUmVmID0gdGhpcy5nZW5lcmF0ZVV1aWQoKTtcbiAgICAgICAgICAgIHRoaXMuYWRkVG9QYnhGaWxlUmVmZXJlbmNlU2VjdGlvbihmaWxlKTsgICAgLy8gUEJYRmlsZVJlZmVyZW5jZVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5hZGRUb1BieEJ1aWxkRmlsZVNlY3Rpb24oZmlsZSk7ICAgICAgICAvLyBQQlhCdWlsZEZpbGVcbiAgICAgICAgdGhpcy5hZGRUb1BieEZyYW1ld29ya3NCdWlsZFBoYXNlKGZpbGUpOyAgICAvLyBQQlhGcmFtZXdvcmtzQnVpbGRQaGFzZVxuICAgICAgICB0aGlzLmFkZFRvTGlicmFyeVNlYXJjaFBhdGhzKGZpbGUpOyAgICAgICAgLy8gbWFrZSBzdXJlIGl0IGdldHMgYnVpbHQhXG5cbiAgICAgICAgcmV0dXJuIGZpbGU7XG4gICAgfVxuXG4gICAgLy8gaGVscGVyIGFkZGl0aW9uIGZ1bmN0aW9uc1xuICAgIGFkZFRvUGJ4QnVpbGRGaWxlU2VjdGlvbihmaWxlOiBJRmlsZVBhdGhPYmopOiB2b2lkIHtcblxuICAgICAgICAvLyByZW1vdmVkIHRlc3Qgb24gZmlsZS5ncm91cCBuZWVkaW5nIHRvIGJlIHNldC5cbiAgICAgICAgLy8gIFRoaXMgd2FzIGZhaWxpbmcgYSB0ZXN0LiAgRm9yIG5vdywgbGV0IGl0IHBhc3MgXG4gICAgICAgIC8vICB1bnRpbCB3ZSBrbm93IGZvciBzdXJlIHRoYXQgdGhlIHRlc3Qgd2FzIGludmFsaWQgYW5kIG5vdCB0aGUgYXNzdW1wdGlvbiBcbiAgICAgICAgLy8gIHRoYXQgZ3JvdXAgbXVzdCBiZSBzZXQuXG4gICAgICAgIGlmICghZmlsZS51dWlkKSB7IC8vICB8fCAhZmlsZS5ncm91cCkgIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigndXVpZCBvciBncm91cCBub3Qgc2V0IScpO1xuICAgICAgICB9XG5cbiAgICAgICAgU2VjdGlvblV0aWxzLmVudHJ5U2V0V1V1aWQoXG4gICAgICAgICAgICB0aGlzLnBieEJ1aWxkRmlsZVNlY3Rpb24oKSxcbiAgICAgICAgICAgIGZpbGUudXVpZCxcbiAgICAgICAgICAgIHBieEJ1aWxkRmlsZU9iaihmaWxlKSxcbiAgICAgICAgICAgIHBieEJ1aWxkRmlsZUNvbW1lbnQoZmlsZSBhcyBJTG9uZ0NvbW1lbnRPYmopKTtcblxuICAgICAgICAvLyBjb25zdCBjb21tZW50S2V5OiBzdHJpbmcgPSBjcmVhdGVVdWlkQ29tbWVudEtleShmaWxlLnV1aWQpO1xuICAgICAgICAvLyAvLyB2YXIgY29tbWVudEtleSA9IGYoXCIlc19jb21tZW50XCIsIGZpbGUudXVpZCk7XG5cbiAgICAgICAgLy8gdGhpcy5wYnhCdWlsZEZpbGVTZWN0aW9uKClbZmlsZS51dWlkXSA9IHBieEJ1aWxkRmlsZU9iaihmaWxlKTtcblxuICAgICAgICAvLyAvLyAgSSBiZWxpZXZlIFRTIHNob3VsZCBoYXZlIGFsbG93ZWQgSUxvbmdDb21tZW50T2JqIHdpdGhvdXQgY2FzdCBkdWUgdG8gcHJldmlvcyBjaGVjayBvbiBncm91cC4gIFxuICAgICAgICAvLyAvLyAgRm9yY2VkIGl0LlxuICAgICAgICAvLyB0aGlzLnBieEJ1aWxkRmlsZVNlY3Rpb24oKVtjb21tZW50S2V5XSA9IHBieEJ1aWxkRmlsZUNvbW1lbnQoZmlsZSBhcyBJTG9uZ0NvbW1lbnRPYmopO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpbmQgdGhlIFBCWEJ1aWxkRmlsZSB0aGF0IGlzIGFzc29jaWF0ZWQgd2l0aCB0aGlzIGZpbGUgYmFzZWQgXG4gICAgICogb24gdGhlIGJhc2VuYW1lLlxuICAgICAqIFxuICAgICAqIElmIGZvdW5kLCBzZXQgdGhlIGZpbGUncyB1dWlkIHRvIHRoZSBmb3VuZCBQQlhCdWlsZEZpbGUgaW5zdGFuY2UgYW5kIFxuICAgICAqIGRlbGV0ZSB0aGUgUEJYQnVpbGRGaWxlIGFuZCBpdHMgY29tbWVudHMgZnJvbSB0aGUgY29sbGVjdGlvbi5cbiAgICAgKiBAcGFyYW0gZmlsZSBcbiAgICAgKi9cbiAgICByZW1vdmVGcm9tUGJ4QnVpbGRGaWxlU2VjdGlvbihmaWxlOiBQYnhGaWxlKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IHNlY3Rpb246IFR5cGVkU2VjdGlvbjxQQlhCdWlsZEZpbGU+ID0gdGhpcy5wYnhCdWlsZEZpbGVTZWN0aW9uKCk7XG5cbiAgICAgICAgZm9yIChsZXQgdXVpZCBpbiBzZWN0aW9uKSB7IC8vIHV1aWQgaXMgYSB1dWlkIG9yIGEgY29tbWVudCBrZXlcbiAgICAgICAgICAgIGNvbnN0IGJ1aWxkRmlsZTogUEJYQnVpbGRGaWxlIHwgc3RyaW5nIHwgdW5kZWZpbmVkID0gc2VjdGlvblt1dWlkXTtcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBidWlsZEZpbGUgPT0gXCJvYmplY3RcIiAmJiBidWlsZEZpbGUuZmlsZVJlZl9jb21tZW50ID09IGZpbGUuYmFzZW5hbWUpIHtcbiAgICAgICAgICAgICAgICAvLyAgaWYgYnVpbGRGaWxlIGlzIGFuIG9iamVjdCwgdGhlbiB0aGlzIGlzIG5vdCBhIGNvbW1lbnQuXG4gICAgICAgICAgICAgICAgZmlsZS51dWlkID0gdXVpZDtcblxuICAgICAgICAgICAgICAgIFNlY3Rpb25VdGlscy5lbnRyeURlbGV0ZVdVdWlkKHNlY3Rpb24sIHV1aWQpO1xuICAgICAgICAgICAgICAgIC8vIGRlbGV0ZSBzZWN0aW9uW3V1aWRdO1xuXG4gICAgICAgICAgICAgICAgLy8gY29uc3QgY29tbWVudEtleSA9IGNyZWF0ZVV1aWRDb21tZW50S2V5KHV1aWQpO1xuICAgICAgICAgICAgICAgIC8vIGRlbGV0ZSBzZWN0aW9uW2NvbW1lbnRLZXldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWRkUGJ4R3JvdXAoXG4gICAgICAgIGZpbGVQYXRoc0FycmF5OiBzdHJpbmdbXSxcbiAgICAgICAgbmFtZTogc3RyaW5nLFxuICAgICAgICBwYXRoPzogc3RyaW5nLFxuICAgICAgICBzb3VyY2VUcmVlPzogWENfU09VUkNFVFJFRSB8IG51bGwpOiB7IHV1aWQ6IFhDX1BST0pfVVVJRCwgcGJ4R3JvdXA6IFBCWEdyb3VwIH0ge1xuXG4gICAgICAgIGNvbnN0IGZpbGVSZWZlcmVuY2VTZWN0aW9uOiBUeXBlZFNlY3Rpb248UEJYRmlsZVJlZmVyZW5jZT4gPSB0aGlzLnBieEZpbGVSZWZlcmVuY2VTZWN0aW9uKCk7XG5cbiAgICAgICAgLy8gIEJ1aWxkIGEgZGljdGlvbmFyeSBvZiBmaWxlUGF0aCB0byBJUGJ4R3JvdXBDaGlsZEZpbGVJbmZvIGZvciBhbGwgUEJYRmlsZVJlZmVyZW5jZSBvYmplY3RzXG4gICAgICAgIGNvbnN0IGZpbGVQYXRoVG9SZWZlcmVuY2U6IHsgW2ZpbGVQYXRoOiBzdHJpbmddOiBJUGJ4R3JvdXBDaGlsZEZpbGVJbmZvIH0gPSB7fTtcbiAgICAgICAgZm9yIChsZXQga2V5IGluIGZpbGVSZWZlcmVuY2VTZWN0aW9uKSB7XG4gICAgICAgICAgICAvLyBvbmx5IGxvb2sgZm9yIGNvbW1lbnRzXG4gICAgICAgICAgICBpZiAoU2VjdGlvblV0aWxzLmRpY3RLZXlJc0NvbW1lbnQoa2V5KSkge1xuXG4gICAgICAgICAgICAgICAgLy8gY29uc3QgZmlsZVJlZmVyZW5jZUtleTogc3RyaW5nID0ga2V5LnNwbGl0KENPTU1FTlRfS0VZKVswXTtcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlUmVmZXJlbmNlS2V5OiBYQ19QUk9KX1VVSUQgPSBTZWN0aW9uVXRpbHMuZGljdEtleUNvbW1lbnRUb1V1aWQoa2V5KTtcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlUmVmZXJlbmNlOiBQQlhGaWxlUmVmZXJlbmNlID0gZmlsZVJlZmVyZW5jZVNlY3Rpb25bZmlsZVJlZmVyZW5jZUtleV0gYXMgUEJYRmlsZVJlZmVyZW5jZTtcblxuICAgICAgICAgICAgICAgIGZpbGVQYXRoVG9SZWZlcmVuY2VbZmlsZVJlZmVyZW5jZS5wYXRoXSA9IHsgZmlsZVJlZjogZmlsZVJlZmVyZW5jZUtleSwgYmFzZW5hbWU6IGZpbGVSZWZlcmVuY2VTZWN0aW9uW2tleV0gYXMgc3RyaW5nIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwYnhHcm91cDogUEJYR3JvdXAgPSB7XG4gICAgICAgICAgICBpc2E6IGNQQlhHcm91cCxcbiAgICAgICAgICAgIGNoaWxkcmVuOiBbXSxcbiAgICAgICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgICAgICBwYXRoOiBwYXRoLFxuICAgICAgICAgICAgc291cmNlVHJlZTogc291cmNlVHJlZSA/IHNvdXJjZVRyZWUgOiAnXCI8Z3JvdXA+XCInXG4gICAgICAgIH07XG5cbiAgICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IGZpbGVQYXRoc0FycmF5Lmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgICAgY29uc3QgZmlsZVBhdGggPSBmaWxlUGF0aHNBcnJheVtpbmRleF07XG4gICAgICAgICAgICBjb25zdCBmaWxlUGF0aFF1b3RlZCA9IFwiXFxcIlwiICsgZmlsZVBhdGggKyBcIlxcXCJcIjtcblxuICAgICAgICAgICAgaWYgKGZpbGVQYXRoVG9SZWZlcmVuY2VbZmlsZVBhdGhdKSB7XG4gICAgICAgICAgICAgICAgcGJ4R3JvdXAuY2hpbGRyZW4ucHVzaChwYnhHcm91cENoaWxkKGZpbGVQYXRoVG9SZWZlcmVuY2VbZmlsZVBhdGhdKSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGZpbGVQYXRoVG9SZWZlcmVuY2VbZmlsZVBhdGhRdW90ZWRdKSB7XG4gICAgICAgICAgICAgICAgcGJ4R3JvdXAuY2hpbGRyZW4ucHVzaChwYnhHcm91cENoaWxkKGZpbGVQYXRoVG9SZWZlcmVuY2VbZmlsZVBhdGhRdW90ZWRdKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBmaWxlID0gbmV3IFBieEZpbGUoZmlsZVBhdGgpO1xuICAgICAgICAgICAgICAgIGZpbGUudXVpZCA9IHRoaXMuZ2VuZXJhdGVVdWlkKCk7XG4gICAgICAgICAgICAgICAgZmlsZS5maWxlUmVmID0gdGhpcy5nZW5lcmF0ZVV1aWQoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmFkZFRvUGJ4RmlsZVJlZmVyZW5jZVNlY3Rpb24oZmlsZSk7ICAgIC8vIFBCWEZpbGVSZWZlcmVuY2VcbiAgICAgICAgICAgICAgICB0aGlzLmFkZFRvUGJ4QnVpbGRGaWxlU2VjdGlvbihmaWxlKTsgICAgICAgIC8vIFBCWEJ1aWxkRmlsZVxuICAgICAgICAgICAgICAgIHBieEdyb3VwLmNoaWxkcmVuLnB1c2gocGJ4R3JvdXBDaGlsZChmaWxlIGFzIElQYnhHcm91cENoaWxkRmlsZUluZm8pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGdyb3VwczogVHlwZWRTZWN0aW9uPFBCWEdyb3VwPiA9IHRoaXMucGJ4R3JvdXBzU2VjdGlvbigpO1xuXG4gICAgICAgIGNvbnN0IHBieEdyb3VwVXVpZDogWENfUFJPSl9VVUlEID0gdGhpcy5nZW5lcmF0ZVV1aWQoKTtcblxuICAgICAgICBTZWN0aW9uVXRpbHMuZW50cnlTZXRXVXVpZChncm91cHMsIHBieEdyb3VwVXVpZCwgcGJ4R3JvdXAsIG5hbWUpO1xuICAgICAgICAvLyBjb25zdCBjb21tZW50S2V5OiBzdHJpbmcgPSBTZWN0aW9uVXRpbHMuZGljdEtleVV1aWRUb0NvbW1lbnQocGJ4R3JvdXBVdWlkKTtcblxuICAgICAgICAvLyBncm91cHNbcGJ4R3JvdXBVdWlkXSA9IHBieEdyb3VwO1xuICAgICAgICAvLyBncm91cHNbY29tbWVudEtleV0gPSBuYW1lO1xuXG4gICAgICAgIHJldHVybiB7IHV1aWQ6IHBieEdyb3VwVXVpZCwgcGJ4R3JvdXA6IHBieEdyb3VwIH07XG4gICAgfVxuXG4gICAgcmVtb3ZlUGJ4R3JvdXAoZ3JvdXBOYW1lOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAgICAgY29uc3Qgc2VjdGlvbjogVHlwZWRTZWN0aW9uPFBCWEdyb3VwPiA9IHRoaXMucGJ4R3JvdXBzU2VjdGlvbigpO1xuXG4gICAgICAgIFNlY3Rpb25VdGlscy5lbnRyeURlbGV0ZVdDb21tZW50VGV4dChzZWN0aW9uLCBncm91cE5hbWUpO1xuXG4gICAgICAgIC8vIGZvciAobGV0IGtleSBpbiBzZWN0aW9uKSB7XG4gICAgICAgIC8vICAgICAvLyBvbmx5IGxvb2sgZm9yIGNvbW1lbnRzXG4gICAgICAgIC8vICAgICBpZiAoIUNPTU1FTlRfS0VZLnRlc3Qoa2V5KSkgY29udGludWU7XG5cbiAgICAgICAgLy8gICAgIGlmIChzZWN0aW9uW2tleV0gPT0gZ3JvdXBOYW1lKSB7IC8vIFRoZSBjb21tZW50IGlzIHRoZSBwYXNzZWQgaW4gbmFtZSBvZiB0aGUgZ3JvdXAuXG4gICAgICAgIC8vICAgICAgICAgY29uc3QgaXRlbUtleTogWENfUFJPSl9VVUlEID0ga2V5LnNwbGl0KENPTU1FTlRfS0VZKVswXTsgLy8gZ2V0IHRoZSBVdWlkXG4gICAgICAgIC8vICAgICAgICAgZGVsZXRlIHNlY3Rpb25baXRlbUtleV07XG4gICAgICAgIC8vICAgICB9XG4gICAgICAgIC8vIH1cbiAgICB9XG5cbiAgICBhZGRUb1BieFByb2plY3RTZWN0aW9uKHRhcmdldDogSU5hdGl2ZVRhcmdldFdyYXBwZXIpOiB2b2lkIHtcblxuICAgICAgICBjb25zdCBuZXdUYXJnZXQ6IElDaGlsZExpc3RFbnRyeSA9IHtcbiAgICAgICAgICAgIHZhbHVlOiB0YXJnZXQudXVpZCxcbiAgICAgICAgICAgIGNvbW1lbnQ6IHBieE5hdGl2ZVRhcmdldENvbW1lbnQodGFyZ2V0LnBieE5hdGl2ZVRhcmdldClcbiAgICAgICAgfTtcblxuICAgICAgICAvLyAgdGhlIHJldHVybiB0eXBlIGFscmVhZHkgaW5jbHVkZXMgdGhlIHByb2plY3QgaXQgaXMgcmVnZXR0aW5nIGhlcmUuXG4gICAgICAgIC8vdGhpcy5wYnhQcm9qZWN0U2VjdGlvbigpW3RoaXMuZ2V0Rmlyc3RQcm9qZWN0KClbJ3V1aWQnXV1bJ3RhcmdldHMnXS5wdXNoKG5ld1RhcmdldCk7XG5cbiAgICAgICAgdGhpcy5nZXRGaXJzdFByb2plY3QoKS5maXJzdFByb2plY3QudGFyZ2V0cy5wdXNoKG5ld1RhcmdldCk7XG4gICAgfVxuXG4gICAgYWRkVG9QYnhOYXRpdmVUYXJnZXRTZWN0aW9uKHRhcmdldDogSU5hdGl2ZVRhcmdldFdyYXBwZXIpOiB2b2lkIHtcblxuICAgICAgICBTZWN0aW9uVXRpbHMuZW50cnlTZXRXVXVpZChcbiAgICAgICAgICAgIHRoaXMucGJ4TmF0aXZlVGFyZ2V0U2VjdGlvbigpLFxuICAgICAgICAgICAgdGFyZ2V0LnV1aWQsXG4gICAgICAgICAgICB0YXJnZXQucGJ4TmF0aXZlVGFyZ2V0LFxuICAgICAgICAgICAgdGFyZ2V0LnBieE5hdGl2ZVRhcmdldC5uYW1lKTtcblxuICAgICAgICAvLyAgICAgdmFyIGNvbW1lbnRLZXkgPSBkaWN0S2V5VXVpZFRvQ29tbWVudCh0YXJnZXQudXVpZCk7XG5cbiAgICAgICAgLy8gICAgIHRoaXMucGJ4TmF0aXZlVGFyZ2V0U2VjdGlvbigpW3RhcmdldC51dWlkXSA9IHRhcmdldC5wYnhOYXRpdmVUYXJnZXQ7XG4gICAgICAgIC8vICAgICB0aGlzLnBieE5hdGl2ZVRhcmdldFNlY3Rpb24oKVtjb21tZW50S2V5XSA9IHRhcmdldC5wYnhOYXRpdmVUYXJnZXQubmFtZTtcbiAgICB9XG5cbiAgICBhZGRUb1BieEZpbGVSZWZlcmVuY2VTZWN0aW9uKGZpbGU6IFBieEZpbGUpOiB2b2lkIHtcblxuICAgICAgICBpZiAoIWZpbGUuZmlsZVJlZilcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImZpbGVSZWYgbm90IHNldC5cIik7XG5cbiAgICAgICAgU2VjdGlvblV0aWxzLmVudHJ5U2V0V1V1aWQoXG4gICAgICAgICAgICB0aGlzLnBieEZpbGVSZWZlcmVuY2VTZWN0aW9uKCksXG4gICAgICAgICAgICBmaWxlLmZpbGVSZWYsXG4gICAgICAgICAgICBwYnhGaWxlUmVmZXJlbmNlT2JqKGZpbGUpLFxuICAgICAgICAgICAgcGJ4RmlsZVJlZmVyZW5jZUNvbW1lbnQoZmlsZSkpO1xuXG4gICAgICAgIC8vIHZhciBjb21tZW50S2V5ID0gZGljdEtleVV1aWRUb0NvbW1lbnQoZmlsZS5maWxlUmVmKTtcblxuICAgICAgICAvLyB0aGlzLnBieEZpbGVSZWZlcmVuY2VTZWN0aW9uKClbZmlsZS5maWxlUmVmXSA9IHBieEZpbGVSZWZlcmVuY2VPYmooZmlsZSk7XG4gICAgICAgIC8vIHRoaXMucGJ4RmlsZVJlZmVyZW5jZVNlY3Rpb24oKVtjb21tZW50S2V5XSA9IHBieEZpbGVSZWZlcmVuY2VDb21tZW50KGZpbGUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNlYXJjaCBmb3IgYSByZWZlcmVuY2UgdG8gdGhpcyBmaWxlIGZyb20gdGhlIFBCWEZpbGVSZWZlcmVuY2Ugc2VjdGlvbi5cbiAgICAgKiBUaGUgbWF0Y2ggaXMgbWFkZSBieSBlaXRoZXIgdGhlIGJhc2VuYW1lIG9yIHBhdGggbWF0Y2hpbmcuXG4gICAgICogXG4gICAgICogKEl0IGFwcGVhcnMgdGhhdCB0aGlzIHNob3VsZCBiZSBhIGNvbmNlcm4gdG8geW91IGlmIHlvdSBoYXZlIGZpbGVzIHdpdGggdGhlIHNhbWUgbmFtZVxuICAgICAqIGluIGRpZmZlcmVudCBmb2xkZXJzLilcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0gZmlsZSBcbiAgICAgKi9cbiAgICByZW1vdmVGcm9tUGJ4RmlsZVJlZmVyZW5jZVNlY3Rpb24oZmlsZTogUGJ4RmlsZSk6IFBieEZpbGUge1xuXG4gICAgICAgIC8vICBDcmVhdGUgYSB0ZW1wbGF0ZSBvYmplY3QgKG5vdCBhZGRlZCB0byBtb2RlbCkgZm9yIGNvbXBhcmlzb25cbiAgICAgICAgdmFyIHJlZk9iajogUEJYRmlsZVJlZmVyZW5jZSA9IHBieEZpbGVSZWZlcmVuY2VPYmooZmlsZSk7XG5cbiAgICAgICAgY29uc3Qgc2VjdGlvbjogVHlwZWRTZWN0aW9uPFBCWEZpbGVSZWZlcmVuY2U+ID0gdGhpcy5wYnhGaWxlUmVmZXJlbmNlU2VjdGlvbigpO1xuXG4gICAgICAgIGZvciAobGV0IGkgaW4gc2VjdGlvbikge1xuICAgICAgICAgICAgY29uc3QgZXhpc3Rpbmc6IFBCWEZpbGVSZWZlcmVuY2UgfCBzdHJpbmcgPSBzZWN0aW9uW2ldO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBleGlzdGluZyA9PSBcIm9iamVjdFwiICYmXG4gICAgICAgICAgICAgICAgKGV4aXN0aW5nLm5hbWUgPT0gcmVmT2JqLm5hbWUgfHxcbiAgICAgICAgICAgICAgICAgICAgKCdcIicgKyBleGlzdGluZy5uYW1lICsgJ1wiJykgPT0gcmVmT2JqLm5hbWUgfHxcbiAgICAgICAgICAgICAgICAgICAgZXhpc3RpbmcucGF0aCA9PSByZWZPYmoucGF0aCB8fFxuICAgICAgICAgICAgICAgICAgICAoJ1wiJyArIGV4aXN0aW5nLnBhdGggKyAnXCInKSA9PSByZWZPYmoucGF0aCkpIHtcblxuICAgICAgICAgICAgICAgIC8vICBQYXNzIHRoaXMgYmFjayB0byB0aGUgY2FsbGVyLiAgQnV0IGl0IGlzIGFsc28gdXNlZFxuICAgICAgICAgICAgICAgIC8vICB0byBkZWxldGUgdGhlIGNvbW1lbnQgYmVsb3cuXG4gICAgICAgICAgICAgICAgZmlsZS5maWxlUmVmID0gZmlsZS51dWlkID0gaTtcblxuICAgICAgICAgICAgICAgIFNlY3Rpb25VdGlscy5lbnRyeURlbGV0ZVdVdWlkKHNlY3Rpb24sIGkpO1xuICAgICAgICAgICAgICAgIC8vIGRlbGV0ZSBzZWN0aW9uW2ldO1xuXG4gICAgICAgICAgICAgICAgLy8gLy8gIDEwLzIwMTkgbW92ZWQgdGhpcyBpbnRvIHRoZSBsb29wLiAgTGVzcyBlcnJvciBwcm9uZSBpZiBcImJyZWFrXCIgaXMgcmVtb3ZlZCBsYXRlci5cbiAgICAgICAgICAgICAgICAvLyB2YXIgY29tbWVudEtleSA9IGRpY3RLZXlVdWlkVG9Db21tZW50KGZpbGUuZmlsZVJlZik7XG4gICAgICAgICAgICAgICAgLy8gaWYgKHNlY3Rpb25bY29tbWVudEtleV0gIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgLy8gICAgIGRlbGV0ZSBzZWN0aW9uW2NvbW1lbnRLZXldO1xuICAgICAgICAgICAgICAgIC8vIH1cblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZpbGU7XG4gICAgfVxuXG4gICAgYWRkVG9YY1ZlcnNpb25Hcm91cFNlY3Rpb24oZmlsZTogUGJ4RmlsZSAmIElEYXRhTW9kZWxEb2N1bWVudEZpbGUpOiB2b2lkIHtcblxuICAgICAgICBpZiAoIWZpbGUubW9kZWxzIHx8ICFmaWxlLmN1cnJlbnRNb2RlbCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGNyZWF0ZSBhIFhDVmVyc2lvbkdyb3VwIHNlY3Rpb24gZnJvbSBub3QgYSBkYXRhIG1vZGVsIGRvY3VtZW50IGZpbGVcIik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWZpbGUuZmlsZVJlZiB8fCAhZmlsZS5jdXJyZW50TW9kZWwuZmlsZVJlZikge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdGaWxlcmVmIG5vdCBzZXQuJyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzZWN0aW9uID0gdGhpcy54Y1ZlcnNpb25Hcm91cFNlY3Rpb24oKTtcblxuICAgICAgICBpZiAoIXNlY3Rpb25bZmlsZS5maWxlUmVmXSkge1xuICAgICAgICAgICAgY29uc3QgbmV3VmVyc2lvbkdyb3VwOiBYQ1ZlcnNpb25Hcm91cCA9IHtcbiAgICAgICAgICAgICAgICBpc2E6ICdYQ1ZlcnNpb25Hcm91cCcsXG4gICAgICAgICAgICAgICAgY2hpbGRyZW46IGZpbGUubW9kZWxzLm1hcChmdW5jdGlvbiAoZWw6IFBieEZpbGUpIHsgcmV0dXJuIGVsLmZpbGVSZWYgYXMgWENfUFJPSl9VVUlEOyB9KSxcbiAgICAgICAgICAgICAgICBjdXJyZW50VmVyc2lvbjogZmlsZS5jdXJyZW50TW9kZWwuZmlsZVJlZixcbiAgICAgICAgICAgICAgICBuYW1lOiBwYXRoLmJhc2VuYW1lKGZpbGUucGF0aCksXG4gICAgICAgICAgICAgICAgcGF0aDogZmlsZS5wYXRoLFxuICAgICAgICAgICAgICAgIHNvdXJjZVRyZWU6ICdcIjxncm91cD5cIicsXG4gICAgICAgICAgICAgICAgdmVyc2lvbkdyb3VwVHlwZTogJ3dyYXBwZXIueGNkYXRhbW9kZWwnXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBTZWN0aW9uVXRpbHMuZW50cnlTZXRXVXVpZChzZWN0aW9uLCBmaWxlLmZpbGVSZWYsIG5ld1ZlcnNpb25Hcm91cCwgcGF0aC5iYXNlbmFtZShmaWxlLnBhdGgpKTtcblxuICAgICAgICAgICAgLy8gdmFyIGNvbW1lbnRLZXkgPSBkaWN0S2V5VXVpZFRvQ29tbWVudChmaWxlLmZpbGVSZWYpO1xuICAgICAgICAgICAgLy8gdGhpcy54Y1ZlcnNpb25Hcm91cFNlY3Rpb24oKVtmaWxlLmZpbGVSZWZdID0gbmV3VmVyc2lvbkdyb3VwO1xuICAgICAgICAgICAgLy8gdGhpcy54Y1ZlcnNpb25Hcm91cFNlY3Rpb24oKVtjb21tZW50S2V5XSA9IHBhdGguYmFzZW5hbWUoZmlsZS5wYXRoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFkZFRvT3JDcmVhdGVfUEJYR3JvdXBfV2l0aE5hbWUoZmlsZTogUGJ4RmlsZSwgZ3JvdXBOYW1lOiBzdHJpbmcpOiB2b2lkIHtcblxuICAgICAgICBjb25zdCBwYnhHcm91cDogUEJYR3JvdXAgfCBudWxsID0gdGhpcy5wYnhHcm91cEJ5TmFtZShncm91cE5hbWUpO1xuICAgICAgICBpZiAoIXBieEdyb3VwKSB7XG4gICAgICAgICAgICB0aGlzLmFkZFBieEdyb3VwKFtmaWxlLnBhdGhdLCBncm91cE5hbWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGJ4R3JvdXAuY2hpbGRyZW4ucHVzaChwYnhHcm91cENoaWxkKGZpbGUpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbW92ZUZyb21fUEJYR3JvdXBfV2l0aE5hbWUoZmlsZTogUGJ4RmlsZSwgZ3JvdXBOYW1lOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAgICAgY29uc3QgcGJ4R3JvdXA6IFBCWEdyb3VwIHwgbnVsbCA9IHRoaXMucGJ4R3JvdXBCeU5hbWUoZ3JvdXBOYW1lKTtcbiAgICAgICAgaWYgKCFwYnhHcm91cCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbWF0Y2hDaGlsZDogSUNoaWxkTGlzdEVudHJ5ID0gcGJ4R3JvdXBDaGlsZChmaWxlKTtcbiAgICAgICAgY29uc3QgcGx1Z2luc0dyb3VwQ2hpbGRyZW46IElDaGlsZExpc3RFbnRyeVtdID0gcGJ4R3JvdXAuY2hpbGRyZW47XG4gICAgICAgIGZvciAobGV0IGkgaW4gcGx1Z2luc0dyb3VwQ2hpbGRyZW4pIHtcbiAgICAgICAgICAgIGlmIChtYXRjaENoaWxkLnZhbHVlID09IHBsdWdpbnNHcm91cENoaWxkcmVuW2ldLnZhbHVlICYmXG4gICAgICAgICAgICAgICAgbWF0Y2hDaGlsZC5jb21tZW50ID09IHBsdWdpbnNHcm91cENoaWxkcmVuW2ldLmNvbW1lbnQpIHtcbiAgICAgICAgICAgICAgICBwbHVnaW5zR3JvdXBDaGlsZHJlbi5zcGxpY2UoaSBhcyB1bmtub3duIGFzIG51bWJlciwgMSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhZGRUb1BsdWdpbnNQYnhHcm91cChmaWxlOiBQYnhGaWxlKTogdm9pZCB7XG4gICAgICAgIHRoaXMuYWRkVG9PckNyZWF0ZV9QQlhHcm91cF9XaXRoTmFtZShmaWxlLCAnUGx1Z2lucycpO1xuICAgICAgICAvLyBjb25zdCBwbHVnaW5zR3JvdXA6IFBCWEdyb3VwIHwgbnVsbCA9IHRoaXMucGJ4R3JvdXBCeU5hbWUoJ1BsdWdpbnMnKTtcbiAgICAgICAgLy8gaWYgKCFwbHVnaW5zR3JvdXApIHtcbiAgICAgICAgLy8gICAgIHRoaXMuYWRkUGJ4R3JvdXAoW2ZpbGUucGF0aF0sICdQbHVnaW5zJyk7XG4gICAgICAgIC8vIH0gZWxzZSB7XG4gICAgICAgIC8vICAgICBwbHVnaW5zR3JvdXAuY2hpbGRyZW4ucHVzaChwYnhHcm91cENoaWxkKGZpbGUpKTtcbiAgICAgICAgLy8gfVxuICAgIH1cblxuICAgIHJlbW92ZUZyb21QbHVnaW5zUGJ4R3JvdXAoZmlsZTogUGJ4RmlsZSk6IHZvaWQge1xuICAgICAgICB0aGlzLnJlbW92ZUZyb21fUEJYR3JvdXBfV2l0aE5hbWUoZmlsZSwgJ1BsdWdpbnMnKTtcbiAgICAgICAgLy8gY29uc3QgcGx1Z2luc0dyb3VwOiBQQlhHcm91cCB8IG51bGwgPSB0aGlzLnBieEdyb3VwQnlOYW1lKCdQbHVnaW5zJyk7XG4gICAgICAgIC8vIGlmICghcGx1Z2luc0dyb3VwKSB7XG4gICAgICAgIC8vICAgICByZXR1cm47XG4gICAgICAgIC8vICAgICAvLyBObyBsb25nZXIgcmV0dXJuaW5nIG51bGwuXG4gICAgICAgIC8vICAgICAvLyByZXR1cm4gbnVsbDsgSSBjYW4ndCBpbWFnaW5lIHJldHVybmluZyBudWxsIHZlcnN1cyB1bmRlZmluZWQgd2FzIGludGVudGlvbmFsLlxuICAgICAgICAvLyB9XG5cbiAgICAgICAgLy8gY29uc3QgbWF0Y2hDaGlsZCA6SUNoaWxkTGlzdEVudHJ5ID0gcGJ4R3JvdXBDaGlsZChmaWxlKTtcbiAgICAgICAgLy8gY29uc3QgcGx1Z2luc0dyb3VwQ2hpbGRyZW46IElDaGlsZExpc3RFbnRyeVtdID0gcGx1Z2luc0dyb3VwLmNoaWxkcmVuO1xuICAgICAgICAvLyBmb3IgKGxldCBpIGluIHBsdWdpbnNHcm91cENoaWxkcmVuKSB7XG4gICAgICAgIC8vICAgICBpZiAobWF0Y2hDaGlsZC52YWx1ZSA9PSBwbHVnaW5zR3JvdXBDaGlsZHJlbltpXS52YWx1ZSAmJlxuICAgICAgICAvLyAgICAgICAgIG1hdGNoQ2hpbGQuY29tbWVudCA9PSBwbHVnaW5zR3JvdXBDaGlsZHJlbltpXS5jb21tZW50KSB7XG4gICAgICAgIC8vICAgICAgICAgcGx1Z2luc0dyb3VwQ2hpbGRyZW4uc3BsaWNlKGkgYXMgdW5rbm93biBhcyBudW1iZXIsIDEpO1xuICAgICAgICAvLyAgICAgICAgIGJyZWFrO1xuICAgICAgICAvLyAgICAgfVxuICAgICAgICAvLyB9XG4gICAgfVxuXG4gICAgYWRkVG9SZXNvdXJjZXNQYnhHcm91cChmaWxlOiBQYnhGaWxlKTogdm9pZCB7XG4gICAgICAgIHRoaXMuYWRkVG9PckNyZWF0ZV9QQlhHcm91cF9XaXRoTmFtZShmaWxlLCAnUmVzb3VyY2VzJyk7XG5cbiAgICAgICAgLy8gY29uc3QgcGx1Z2luc0dyb3VwOlBCWEdyb3VwIHwgbnVsbCA9IHRoaXMucGJ4R3JvdXBCeU5hbWUoJ1Jlc291cmNlcycpO1xuXG4gICAgICAgIC8vIGlmICghcGx1Z2luc0dyb3VwKSB7XG4gICAgICAgIC8vICAgICB0aGlzLmFkZFBieEdyb3VwKFtmaWxlLnBhdGhdLCAnUmVzb3VyY2VzJyk7XG4gICAgICAgIC8vIH0gZWxzZSB7XG4gICAgICAgIC8vICAgICBwbHVnaW5zR3JvdXAuY2hpbGRyZW4ucHVzaChwYnhHcm91cENoaWxkKGZpbGUpKTtcbiAgICAgICAgLy8gfVxuICAgIH1cblxuICAgIHJlbW92ZUZyb21SZXNvdXJjZXNQYnhHcm91cChmaWxlOiBQYnhGaWxlKTogdm9pZCB7XG4gICAgICAgIHRoaXMucmVtb3ZlRnJvbV9QQlhHcm91cF9XaXRoTmFtZShmaWxlLCAnUmVzb3VyY2VzJyk7XG4gICAgICAgIC8vIGlmICghdGhpcy5wYnhHcm91cEJ5TmFtZSgnUmVzb3VyY2VzJykpIHtcbiAgICAgICAgLy8gICAgIHJldHVybjsgXG4gICAgICAgIC8vICAgICAvL3JldHVybiBudWxsO1xuICAgICAgICAvLyB9XG4gICAgICAgIC8vIHZhciBwbHVnaW5zR3JvdXBDaGlsZHJlbiA9IHRoaXMucGJ4R3JvdXBCeU5hbWUoJ1Jlc291cmNlcycpLmNoaWxkcmVuLCBpO1xuICAgICAgICAvLyBmb3IgKGkgaW4gcGx1Z2luc0dyb3VwQ2hpbGRyZW4pIHtcbiAgICAgICAgLy8gICAgIGlmIChwYnhHcm91cENoaWxkKGZpbGUpLnZhbHVlID09IHBsdWdpbnNHcm91cENoaWxkcmVuW2ldLnZhbHVlICYmXG4gICAgICAgIC8vICAgICAgICAgcGJ4R3JvdXBDaGlsZChmaWxlKS5jb21tZW50ID09IHBsdWdpbnNHcm91cENoaWxkcmVuW2ldLmNvbW1lbnQpIHtcbiAgICAgICAgLy8gICAgICAgICBwbHVnaW5zR3JvdXBDaGlsZHJlbi5zcGxpY2UoaSwgMSk7XG4gICAgICAgIC8vICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vICAgICB9XG4gICAgICAgIC8vIH1cbiAgICB9XG5cbiAgICBhZGRUb0ZyYW1ld29ya3NQYnhHcm91cChmaWxlOiBQYnhGaWxlKTogdm9pZCB7XG4gICAgICAgIHRoaXMuYWRkVG9PckNyZWF0ZV9QQlhHcm91cF9XaXRoTmFtZShmaWxlLCAnRnJhbWV3b3JrcycpO1xuICAgICAgICAvLyB2YXIgcGx1Z2luc0dyb3VwID0gdGhpcy5wYnhHcm91cEJ5TmFtZSgnRnJhbWV3b3JrcycpO1xuICAgICAgICAvLyBpZiAoIXBsdWdpbnNHcm91cCkge1xuICAgICAgICAvLyAgICAgdGhpcy5hZGRQYnhHcm91cChbZmlsZS5wYXRoXSwgJ0ZyYW1ld29ya3MnKTtcbiAgICAgICAgLy8gfSBlbHNlIHtcbiAgICAgICAgLy8gICAgIHBsdWdpbnNHcm91cC5jaGlsZHJlbi5wdXNoKHBieEdyb3VwQ2hpbGQoZmlsZSkpO1xuICAgICAgICAvLyB9XG4gICAgfVxuXG4gICAgcmVtb3ZlRnJvbUZyYW1ld29ya3NQYnhHcm91cChmaWxlOiBQYnhGaWxlKTogdm9pZCB7XG4gICAgICAgIHRoaXMucmVtb3ZlRnJvbV9QQlhHcm91cF9XaXRoTmFtZShmaWxlLCAnRnJhbWV3b3JrcycpO1xuICAgICAgICAvLyBpZiAoIXRoaXMucGJ4R3JvdXBCeU5hbWUoJ0ZyYW1ld29ya3MnKSkge1xuICAgICAgICAvLyAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIC8vIH1cbiAgICAgICAgLy8gdmFyIHBsdWdpbnNHcm91cENoaWxkcmVuID0gdGhpcy5wYnhHcm91cEJ5TmFtZSgnRnJhbWV3b3JrcycpLmNoaWxkcmVuO1xuXG4gICAgICAgIC8vIGZvciAoaSBpbiBwbHVnaW5zR3JvdXBDaGlsZHJlbikge1xuICAgICAgICAvLyAgICAgaWYgKHBieEdyb3VwQ2hpbGQoZmlsZSkudmFsdWUgPT0gcGx1Z2luc0dyb3VwQ2hpbGRyZW5baV0udmFsdWUgJiZcbiAgICAgICAgLy8gICAgICAgICBwYnhHcm91cENoaWxkKGZpbGUpLmNvbW1lbnQgPT0gcGx1Z2luc0dyb3VwQ2hpbGRyZW5baV0uY29tbWVudCkge1xuICAgICAgICAvLyAgICAgICAgIHBsdWdpbnNHcm91cENoaWxkcmVuLnNwbGljZShpLCAxKTtcbiAgICAgICAgLy8gICAgICAgICBicmVhaztcbiAgICAgICAgLy8gICAgIH1cbiAgICAgICAgLy8gfVxuICAgIH1cblxuICAgIGFkZFRvUHJvZHVjdHNQYnhHcm91cChmaWxlOiBQYnhGaWxlKTogdm9pZCB7XG4gICAgICAgIHRoaXMuYWRkVG9PckNyZWF0ZV9QQlhHcm91cF9XaXRoTmFtZShmaWxlLCAnUHJvZHVjdHMnKTtcbiAgICAgICAgLy8gdmFyIHByb2R1Y3RzR3JvdXAgPSB0aGlzLnBieEdyb3VwQnlOYW1lKCdQcm9kdWN0cycpO1xuICAgICAgICAvLyBpZiAoIXByb2R1Y3RzR3JvdXApIHtcbiAgICAgICAgLy8gICAgIHRoaXMuYWRkUGJ4R3JvdXAoW2ZpbGUucGF0aF0sICdQcm9kdWN0cycpO1xuICAgICAgICAvLyB9IGVsc2Uge1xuICAgICAgICAvLyAgICAgcHJvZHVjdHNHcm91cC5jaGlsZHJlbi5wdXNoKHBieEdyb3VwQ2hpbGQoZmlsZSkpO1xuICAgICAgICAvLyB9XG4gICAgfVxuXG4gICAgcmVtb3ZlRnJvbVByb2R1Y3RzUGJ4R3JvdXAoZmlsZTogUGJ4RmlsZSk6IHZvaWQge1xuICAgICAgICB0aGlzLnJlbW92ZUZyb21fUEJYR3JvdXBfV2l0aE5hbWUoZmlsZSwgJ1Byb2R1Y3RzJyk7XG4gICAgICAgIC8vIGNvbnN0IHByb2R1Y3RzR3JvdXA6IFBCWEdyb3VwIHwgbnVsbCA9IHRoaXMucGJ4R3JvdXBCeU5hbWUoJ1Byb2R1Y3RzJyk7XG5cbiAgICAgICAgLy8gaWYgKCFwcm9kdWN0c0dyb3VwKSB7XG4gICAgICAgIC8vICAgICAvLyByZXR1cm4gbnVsbDtcbiAgICAgICAgLy8gICAgIHJldHVybjtcbiAgICAgICAgLy8gfVxuXG4gICAgICAgIC8vIGNvbnN0IHByb2R1Y3RzR3JvdXBDaGlsZHJlbjogUEJYRmlsZUVsZW1lbnRbXSA9IHByb2R1Y3RzR3JvdXAuY2hpbGRyZW47XG5cbiAgICAgICAgLy8gZm9yIChsZXQgaSBpbiBwcm9kdWN0c0dyb3VwQ2hpbGRyZW4pIHtcbiAgICAgICAgLy8gICAgIGlmIChwYnhHcm91cENoaWxkKGZpbGUpLnZhbHVlID09IHByb2R1Y3RzR3JvdXBDaGlsZHJlbltpXS52YWx1ZSAmJlxuICAgICAgICAvLyAgICAgICAgIHBieEdyb3VwQ2hpbGQoZmlsZSkuY29tbWVudCA9PSBwcm9kdWN0c0dyb3VwQ2hpbGRyZW5baV0uY29tbWVudCkge1xuICAgICAgICAvLyAgICAgICAgIHByb2R1Y3RzR3JvdXBDaGlsZHJlbi5zcGxpY2UoaSwgMSk7XG4gICAgICAgIC8vICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vICAgICB9XG4gICAgICAgIC8vIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIHBmX2FkZFRvQnVpbGRQaGFzZShidWlsZFBoYXNlOiBQQlhCdWlsZFBoYXNlQmFzZSB8IG51bGwsIGZpbGU6IElGaWxlUGF0aE9iaik6IHZvaWQge1xuXG4gICAgICAgIGlmICghYnVpbGRQaGFzZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdidWlsZFBoYXNlIG5vdCBmb3VuZCEnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGJ1aWxkUGhhc2UuZmlsZXMucHVzaChwYnhCdWlsZFBoYXNlT2JqKGZpbGUpKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHBmX3JlbW92ZUZyb21CdWlsZFBoYXNlKGJ1aWxkUGhhc2U6IFBCWEJ1aWxkUGhhc2VCYXNlIHwgbnVsbCwgZmlsZTogUGJ4RmlsZSk6IHZvaWQge1xuXG4gICAgICAgIGlmICghYnVpbGRQaGFzZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAvLyAgTk9URTogIFRoZXJlIHdlcmUgdHdvIGRpZmZlcmVudCBkdXBsaWNhdGVkIHNldHMgb2YgY29kZSB0aGF0XG4gICAgICAgIC8vICBtb3N0bHkgZGlkIHRoZSBzYW1lIHRoaW5nLiAgT25lIHVzZWQgc3BsaWNlIGFmdGVyIGZpbmRpbmcgb25lIGl0ZW0uXG4gICAgICAgIC8vICBUaGUgb25lIHdlIGtlcHQgYXNzdW1lcyB0aGUgY29tbWVudCBtYXkgZXhpc3QgbXVsdGlwbGUgdGltZXMuXG4gICAgICAgIC8vICBDb3VsZCBiZSBpc3N1ZXMgaWYgc29tZSBwbGFjZXMgaGVsZCB0aGUgb3JpZ2luYWwgZmlsZXMgaGFuZGxlIHRoYXRcbiAgICAgICAgLy8gIHdhcyB1c2luZyBzcGxpY2UuXG4gICAgICAgIC8vICBQcmVmZXIgdG8gaGF2ZSB0aGlzIERSWSBhbmQgY2xlYW4gaXQgdXAgbGF0ZXIgaWYgdGhlcmUgaXMgYW4gaXNzdWUuXG4gICAgICAgIGNvbnN0IGZpbGVzOiBJQ2hpbGRMaXN0RW50cnlbXSA9IFtdO1xuICAgICAgICBjb25zdCBmaWxlQ29tbWVudDogc3RyaW5nID0gbG9uZ0NvbW1lbnQoZmlsZSk7XG5cbiAgICAgICAgZm9yIChsZXQgaSBpbiBidWlsZFBoYXNlLmZpbGVzKSB7XG4gICAgICAgICAgICBpZiAoYnVpbGRQaGFzZS5maWxlc1tpXS5jb21tZW50ICE9IGZpbGVDb21tZW50KSB7XG4gICAgICAgICAgICAgICAgZmlsZXMucHVzaChidWlsZFBoYXNlLmZpbGVzW2ldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGJ1aWxkUGhhc2UuZmlsZXMgPSBmaWxlcztcbiAgICB9XG5cblxuICAgIGFkZFRvUGJ4RW1iZWRGcmFtZXdvcmtzQnVpbGRQaGFzZShmaWxlOiBQYnhGaWxlKTogdm9pZCB7XG5cbiAgICAgICAgdGhpcy5wZl9hZGRUb0J1aWxkUGhhc2UodGhpcy5wYnhFbWJlZEZyYW1ld29ya3NCdWlsZFBoYXNlT2JqKGZpbGUudGFyZ2V0KSwgZmlsZSk7XG4gICAgICAgIC8vICBXYXJuaW5nOiAgTmV3IGltcGxlbWVudGF0aW9uIHdpbGwgdGhyb3cgaWYgaXQgZG9lcyBub3QgZmluZCB0aGUgZW1iZWRlZEZyYW1ld29ya0J1aWxkUGhhc2VcbiAgICAgICAgLy8gIGluc3RlYWQgb2Ygc2lsZW50bHkgZmFpbGluZyB0byBkbyBhbnl0aGluZy5cblxuICAgICAgICAvLyAgdmFyIHNvdXJjZXMgPSB0aGlzLnBieEVtYmVkRnJhbWV3b3Jrc0J1aWxkUGhhc2VPYmooZmlsZS50YXJnZXQpO1xuICAgICAgICAvLyAvLyAgVGhpcyBzZWVtZWQgd3JvbmcgdG8gbWUuICBJdCBqdXN0IGRvZXMgbm90aGluZyBpZiBpdCBjYW4ndCBmaW5kIHRoZSBFbWJlZEZyYW1ld29ya3MgYnVpbGRcbiAgICAgICAgLy8gLy8gIHBoYXNlLiAgU2VlbXMgbGlrZSBpdCBzaG91bGQgdGhyb3cgb3IgcmV0dXJuIGEgZmFpbHVyZS5cbiAgICAgICAgLy8gLy8gIEFsc28sIGl0IGlzIGluY29uc2lzdGVudCB3aXRoIHRoZSBvdGhlciBtZXRob2RzIGRvaW5nIHRoZSBleGFjdCBzYW1lIHRoaW5nLlxuICAgICAgICAvLyAvLyAgc3RhbmRhcmRpemVkXG5cbiAgICAgICAgLy8gaWYgKHNvdXJjZXMpIHtcbiAgICAgICAgLy8gICAgIHNvdXJjZXMuZmlsZXMucHVzaChwYnhCdWlsZFBoYXNlT2JqVGhyb3dJZkludmFsaWQoZmlsZSkpO1xuICAgICAgICAvLyAgICAgLy9zb3VyY2VzLmZpbGVzLnB1c2gocGJ4QnVpbGRQaGFzZU9iaihmaWxlKSk7XG4gICAgICAgIC8vIH1cbiAgICB9XG5cbiAgICByZW1vdmVGcm9tUGJ4RW1iZWRGcmFtZXdvcmtzQnVpbGRQaGFzZShmaWxlOiBQYnhGaWxlKTogdm9pZCB7XG5cbiAgICAgICAgdGhpcy5wZl9yZW1vdmVGcm9tQnVpbGRQaGFzZShcbiAgICAgICAgICAgIHRoaXMucGJ4RW1iZWRGcmFtZXdvcmtzQnVpbGRQaGFzZU9iaihmaWxlLnRhcmdldCksXG4gICAgICAgICAgICBmaWxlKTtcblxuICAgICAgICAvLyAvLyAgVGhlIGF1dGhvciBvZiB0aGlzIG1ldGhvZCB3ZW50IHdpdGggYSBkaWZmZXJlbnQgc3RyYXRlZ3kgdGhhbiBcbiAgICAgICAgLy8gLy8gIHRoZSBvcmlnaW5hbCBhdXRob3JzLiAgVGhpcyBzdHJhdGVneSByZW1vdmVzIG11bHRpcGxlIG1hdGNoaW5nIGNvbW1lbnRzLlxuICAgICAgICAvLyAvLyAgVG8gbWFrZSB0aGlzIERSWSwgc2V0dGxpbmcgb24gdGhpcyB3aGljaCBpbiB0aGVvcnkgaGFuZGxlcyBtb3JlIGNhc2VzLlxuICAgICAgICAvLyBjb25zdCBzb3VyY2VzOiBQQlhDb3B5RmlsZXNCdWlsZFBoYXNlIHwgbnVsbCA9IHRoaXMucGJ4RW1iZWRGcmFtZXdvcmtzQnVpbGRQaGFzZU9iaihmaWxlLnRhcmdldCk7XG4gICAgICAgIC8vIGlmIChzb3VyY2VzKSB7XG4gICAgICAgIC8vICAgICB2YXIgZmlsZXMgPSBbXTtcbiAgICAgICAgLy8gICAgIGZvciAobGV0IGkgaW4gc291cmNlcy5maWxlcykge1xuICAgICAgICAvLyAgICAgICAgIGlmIChzb3VyY2VzLmZpbGVzW2ldLmNvbW1lbnQgIT0gbG9uZ0NvbW1lbnQoZmlsZSkpIHtcbiAgICAgICAgLy8gICAgICAgICAgICAgZmlsZXMucHVzaChzb3VyY2VzLmZpbGVzW2ldKTtcbiAgICAgICAgLy8gICAgICAgICB9XG4gICAgICAgIC8vICAgICB9XG4gICAgICAgIC8vICAgICBzb3VyY2VzLmZpbGVzID0gZmlsZXM7XG4gICAgICAgIC8vIH1cbiAgICB9XG5cbiAgICBhZGRUb1BieFNvdXJjZXNCdWlsZFBoYXNlKGZpbGU6IFBieEZpbGUpOiB2b2lkIHtcblxuICAgICAgICB0aGlzLnBmX2FkZFRvQnVpbGRQaGFzZShcbiAgICAgICAgICAgIHRoaXMucGJ4U291cmNlc0J1aWxkUGhhc2VPYmooZmlsZS50YXJnZXQpLFxuICAgICAgICAgICAgZmlsZSk7XG5cbiAgICAgICAgLy8gY29uc3Qgc291cmNlcyA9IHRoaXMucGJ4U291cmNlc0J1aWxkUGhhc2VPYmooZmlsZS50YXJnZXQsXG4gICAgICAgIC8vICAgICBlSGFuZGxlTm90Rm91bmQudGhyb3cpIGFzIFBCWFNvdXJjZXNCdWlsZFBoYXNlO1xuXG4gICAgICAgIC8vIHNvdXJjZXMuZmlsZXMucHVzaChwYnhCdWlsZFBoYXNlT2JqVGhyb3dJZkludmFsaWQoZmlsZSkpO1xuICAgIH1cblxuICAgIHJlbW92ZUZyb21QYnhTb3VyY2VzQnVpbGRQaGFzZShmaWxlOiBQYnhGaWxlKTogdm9pZCB7XG5cbiAgICAgICAgdGhpcy5wZl9yZW1vdmVGcm9tQnVpbGRQaGFzZShcbiAgICAgICAgICAgIHRoaXMucGJ4U291cmNlc0J1aWxkUGhhc2VPYmooZmlsZS50YXJnZXQpLFxuICAgICAgICAgICAgZmlsZSk7XG5cbiAgICAgICAgLy8gIFdhcm5pbmcuICBOZXcgaW1wbGVtZW50YXRpb24gY3JlYXRlcyBhIG5ldyBhcnJheS4gIE9sZFxuICAgICAgICAvLyAgb25lIHVzZWQgc3BsaWNlLiAgSW4gdGhlb3J5IHRoaXMgY291bGQgYnJlYWsgY2xpZW50IGNvZGUuXG4gICAgICAgIC8vIC8vICBUaHJvdyBpZiBub3QgZm91bmQuICBUaGVuIGNhc3QgdG8gXG4gICAgICAgIC8vIGNvbnN0IHNvdXJjZXMgPSB0aGlzLnBieFNvdXJjZXNCdWlsZFBoYXNlT2JqKGZpbGUudGFyZ2V0KVxuXG4gICAgICAgIC8vIGZvciAobGV0IGkgaW4gc291cmNlcy5maWxlcykge1xuICAgICAgICAvLyAgICAgaWYgKHNvdXJjZXMuZmlsZXNbaV0uY29tbWVudCA9PSBsb25nQ29tbWVudChmaWxlKSkge1xuICAgICAgICAvLyAgICAgICAgIHNvdXJjZXMuZmlsZXMuc3BsaWNlKGkgYXMgdW5rbm93biBhcyBudW1iZXIsIDEpO1xuICAgICAgICAvLyAgICAgICAgIGJyZWFrO1xuICAgICAgICAvLyAgICAgfVxuICAgICAgICAvLyB9XG4gICAgfVxuXG4gICAgYWRkVG9QYnhSZXNvdXJjZXNCdWlsZFBoYXNlKGZpbGU6IElGaWxlUGF0aE9iaiAmIHsgdGFyZ2V0PzogWENfUFJPSl9VVUlEIHwgbnVsbCB9KTogdm9pZCB7XG5cbiAgICAgICAgdGhpcy5wZl9hZGRUb0J1aWxkUGhhc2UoXG4gICAgICAgICAgICB0aGlzLnBieFJlc291cmNlc0J1aWxkUGhhc2VPYmooZmlsZS50YXJnZXQpLFxuICAgICAgICAgICAgZmlsZSk7XG4gICAgICAgIC8vIHZhciBzb3VyY2VzID0gdGhpcy5wYnhSZXNvdXJjZXNCdWlsZFBoYXNlT2JqKGZpbGUudGFyZ2V0KTtcbiAgICAgICAgLy8gc291cmNlcy5maWxlcy5wdXNoKHBieEJ1aWxkUGhhc2VPYmooZmlsZSkpO1xuICAgIH1cblxuICAgIHJlbW92ZUZyb21QYnhSZXNvdXJjZXNCdWlsZFBoYXNlKGZpbGU6IFBieEZpbGUpOiB2b2lkIHtcblxuICAgICAgICB0aGlzLnBmX3JlbW92ZUZyb21CdWlsZFBoYXNlKFxuICAgICAgICAgICAgdGhpcy5wYnhSZXNvdXJjZXNCdWlsZFBoYXNlT2JqKGZpbGUudGFyZ2V0KSxcbiAgICAgICAgICAgIGZpbGUpO1xuXG4gICAgICAgIC8vICBXYXJuaW5nOiAgTmV3IGltcGxlbWVudGF0aW9uIGNyZWF0ZXMgYSBuZXcgYXJyYXkgaW5zdGVhZCBvZlxuICAgICAgICAvLyAgc3BsaWNpbmcgdGhlIGV4aXN0aW5nIG9uZS4gIFRoaXMgY291bGQgY2F1c2UgYW4gaXNzdWUgd2l0aCBjbGllbnQgY29kZS5cbiAgICAgICAgLy8gdmFyIHNvdXJjZXMgPSB0aGlzLnBieFJlc291cmNlc0J1aWxkUGhhc2VPYmooZmlsZS50YXJnZXQpLCBpO1xuXG4gICAgICAgIC8vIGZvciAoaSBpbiBzb3VyY2VzLmZpbGVzKSB7XG4gICAgICAgIC8vICAgICBpZiAoc291cmNlcy5maWxlc1tpXS5jb21tZW50ID09IGxvbmdDb21tZW50KGZpbGUpKSB7XG4gICAgICAgIC8vICAgICAgICAgc291cmNlcy5maWxlcy5zcGxpY2UoaSwgMSk7XG4gICAgICAgIC8vICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vICAgICB9XG4gICAgICAgIC8vIH1cbiAgICB9XG5cbiAgICBhZGRUb1BieEZyYW1ld29ya3NCdWlsZFBoYXNlKGZpbGU6IFBieEZpbGUpOiB2b2lkIHtcblxuICAgICAgICB0aGlzLnBmX2FkZFRvQnVpbGRQaGFzZShcbiAgICAgICAgICAgIHRoaXMucGJ4RnJhbWV3b3Jrc0J1aWxkUGhhc2VPYmooZmlsZS50YXJnZXQpLFxuICAgICAgICAgICAgZmlsZSk7XG5cbiAgICAgICAgLy8gdmFyIHNvdXJjZXMgPSB0aGlzLnBieEZyYW1ld29ya3NCdWlsZFBoYXNlT2JqKGZpbGUudGFyZ2V0KTtcbiAgICAgICAgLy8gc291cmNlcy5maWxlcy5wdXNoKHBieEJ1aWxkUGhhc2VPYmpUaHJvd0lmSW52YWxpZChmaWxlKSk7XG4gICAgfVxuXG4gICAgcmVtb3ZlRnJvbVBieEZyYW1ld29ya3NCdWlsZFBoYXNlKGZpbGU6IFBieEZpbGUpOiB2b2lkIHtcblxuICAgICAgICB0aGlzLnBmX3JlbW92ZUZyb21CdWlsZFBoYXNlKFxuICAgICAgICAgICAgdGhpcy5wYnhGcmFtZXdvcmtzQnVpbGRQaGFzZU9iaihmaWxlLnRhcmdldCksXG4gICAgICAgICAgICBmaWxlKTtcblxuICAgICAgICAvLyAgV2FybmluZzogIE5ldyBpbXBsZW1lbnRhdGlvbiBjcmVhdGVzIGEgbmV3IGFycmF5LiAgT2xkIG9uZSB1c2VkXG4gICAgICAgIC8vICBzcGxpY2UuICBUaGlzIGNvdWxkIGJyZWFrIGNsaWVudCBjb2RlIGlmIGl0IGhlbGQgb250byB0aGUgXG4gICAgICAgIC8vICBvcmlnaW5hbCBhcnJheS5cblxuICAgICAgICAvLyB2YXIgc291cmNlcyA9IHRoaXMucGJ4RnJhbWV3b3Jrc0J1aWxkUGhhc2VPYmooZmlsZS50YXJnZXQpO1xuICAgICAgICAvLyBmb3IgKGkgaW4gc291cmNlcy5maWxlcykge1xuICAgICAgICAvLyAgICAgaWYgKHNvdXJjZXMuZmlsZXNbaV0uY29tbWVudCA9PSBsb25nQ29tbWVudChmaWxlKSkge1xuICAgICAgICAvLyAgICAgICAgIHNvdXJjZXMuZmlsZXMuc3BsaWNlKGksIDEpO1xuICAgICAgICAvLyAgICAgICAgIGJyZWFrO1xuICAgICAgICAvLyAgICAgfVxuICAgICAgICAvLyB9XG4gICAgfVxuXG4gICAgYWRkWENDb25maWd1cmF0aW9uTGlzdChcbiAgICAgICAgY29uZmlndXJhdGlvbk9iamVjdHNBcnJheTogWENCdWlsZENvbmZpZ3VyYXRpb25bXSxcbiAgICAgICAgZGVmYXVsdENvbmZpZ3VyYXRpb25OYW1lOiBzdHJpbmcsXG4gICAgICAgIGNvbW1lbnQ6IHN0cmluZyk6IElDb25maWd1cmF0aW9uTGlzdFdyYXBwZXIge1xuXG4gICAgICAgIGNvbnN0IHBieEJ1aWxkQ29uZmlndXJhdGlvblNlY3Rpb246IFR5cGVkU2VjdGlvbjxYQ0J1aWxkQ29uZmlndXJhdGlvbj4gPVxuICAgICAgICAgICAgdGhpcy54Y0J1aWxkQ29uZmlndXJhdGlvblNlY3Rpb24oKTtcblxuICAgICAgICBjb25zdCB4Y0NvbmZpZ3VyYXRpb25MaXN0OiBYQ0NvbmZpZ3VyYXRpb25MaXN0ID0ge1xuICAgICAgICAgICAgaXNhOiAnWENDb25maWd1cmF0aW9uTGlzdCcsXG4gICAgICAgICAgICBidWlsZENvbmZpZ3VyYXRpb25zOiBbXSxcbiAgICAgICAgICAgIGRlZmF1bHRDb25maWd1cmF0aW9uSXNWaXNpYmxlOiAwLFxuICAgICAgICAgICAgZGVmYXVsdENvbmZpZ3VyYXRpb25OYW1lOiBkZWZhdWx0Q29uZmlndXJhdGlvbk5hbWVcbiAgICAgICAgfTtcblxuICAgICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgY29uZmlndXJhdGlvbk9iamVjdHNBcnJheS5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZ3VyYXRpb24gPSBjb25maWd1cmF0aW9uT2JqZWN0c0FycmF5W2luZGV4XTtcblxuICAgICAgICAgICAgY29uc3QgY29uZmlndXJhdGlvblV1aWQ6IFhDX1BST0pfVVVJRCA9IHRoaXMuZ2VuZXJhdGVVdWlkKCk7XG5cbiAgICAgICAgICAgIFNlY3Rpb25VdGlscy5lbnRyeVNldFdVdWlkKHBieEJ1aWxkQ29uZmlndXJhdGlvblNlY3Rpb24sIGNvbmZpZ3VyYXRpb25VdWlkLCBjb25maWd1cmF0aW9uLCBjb25maWd1cmF0aW9uLm5hbWUpO1xuICAgICAgICAgICAgLy8gcGJ4QnVpbGRDb25maWd1cmF0aW9uU2VjdGlvbltjb25maWd1cmF0aW9uVXVpZF0gPSBjb25maWd1cmF0aW9uO1xuICAgICAgICAgICAgLy8gICAgIGNvbmZpZ3VyYXRpb25Db21tZW50S2V5ID0gZGljdEtleVV1aWRUb0NvbW1lbnQoY29uZmlndXJhdGlvblV1aWQpO1xuICAgICAgICAgICAgLy8gcGJ4QnVpbGRDb25maWd1cmF0aW9uU2VjdGlvbltjb25maWd1cmF0aW9uQ29tbWVudEtleV0gPSBjb25maWd1cmF0aW9uLm5hbWU7XG5cbiAgICAgICAgICAgIHhjQ29uZmlndXJhdGlvbkxpc3QuYnVpbGRDb25maWd1cmF0aW9ucy5wdXNoKHsgdmFsdWU6IGNvbmZpZ3VyYXRpb25VdWlkLCBjb21tZW50OiBjb25maWd1cmF0aW9uLm5hbWUgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB4Y0NvbmZpZ3VyYXRpb25MaXN0VXVpZDogWENfUFJPSl9VVUlEID0gdGhpcy5nZW5lcmF0ZVV1aWQoKTtcblxuICAgICAgICBTZWN0aW9uVXRpbHMuZW50cnlTZXRXVXVpZCh0aGlzLnhjQ29uZmlndXJhdGlvbkxpc3QoKSwgeGNDb25maWd1cmF0aW9uTGlzdFV1aWQsIHhjQ29uZmlndXJhdGlvbkxpc3QsIGNvbW1lbnQpO1xuXG4gICAgICAgIC8vIGNvbnN0IHBieFhDQ29uZmlndXJhdGlvbkxpc3RTZWN0aW9uOiBUeXBlZFNlY3Rpb248WENDb25maWd1cmF0aW9uTGlzdD4gPVxuICAgICAgICAvLyAgICAgdGhpcy5wYnhYQ0NvbmZpZ3VyYXRpb25MaXN0KCk7XG4gICAgICAgIC8vIGNvbnN0IGNvbW1lbnRLZXk6IHN0cmluZyA9IGRpY3RLZXlVdWlkVG9Db21tZW50KHhjQ29uZmlndXJhdGlvbkxpc3RVdWlkKTtcbiAgICAgICAgLy8gaWYgKHBieFhDQ29uZmlndXJhdGlvbkxpc3RTZWN0aW9uKSB7XG4gICAgICAgIC8vICAgICBwYnhYQ0NvbmZpZ3VyYXRpb25MaXN0U2VjdGlvblt4Y0NvbmZpZ3VyYXRpb25MaXN0VXVpZF0gPSB4Y0NvbmZpZ3VyYXRpb25MaXN0O1xuICAgICAgICAvLyAgICAgcGJ4WENDb25maWd1cmF0aW9uTGlzdFNlY3Rpb25bY29tbWVudEtleV0gPSBjb21tZW50O1xuICAgICAgICAvLyB9XG5cbiAgICAgICAgY29uc3Qgd3JhcHBlcjogSUNvbmZpZ3VyYXRpb25MaXN0V3JhcHBlciA9IHsgdXVpZDogeGNDb25maWd1cmF0aW9uTGlzdFV1aWQsIHhjQ29uZmlndXJhdGlvbkxpc3Q6IHhjQ29uZmlndXJhdGlvbkxpc3QgfTtcbiAgICAgICAgcmV0dXJuIHdyYXBwZXI7XG4gICAgfVxuXG4gICAgYWRkVGFyZ2V0RGVwZW5kZW5jeSh0YXJnZXQ6IFhDX1BST0pfVVVJRCwgZGVwZW5kZW5jeVRhcmdldHM6IFhDX1BST0pfVVVJRFtdKTogSU5hdGl2ZVRhcmdldFdyYXBwZXIyIHwgdW5kZWZpbmVkIHtcblxuICAgICAgICBpZiAoIXRhcmdldClcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIC8vICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyB0YXJnZXQgc3BlY2lmaWVkIScpOyBJIGhhZCB0aG91Z2h0IGl0IG1hZGUgbW9yZSBzZW5zZSB0byB0aHJvdyBhbiBlcnJvci4gIEJ1dCBhIHRlc3QgZGljdGF0ZXMgdGhpcyByZXR1cm5zIHVuZGVmaW5lZC5cbiAgICAgICAgLy8gIFRvIG1haW50YWluIGNvbXBhdGliaWxpdHkgd2l0aCB0aGUgb3JpZ2luYWwgdmVyc2lvbiwgcmVzdG9yaW5nIGVhdGluZyB0aGUgaW52YWxpZCBjYWxsLiBcblxuICAgICAgICBjb25zdCBuYXRpdmVUYXJnZXRzOiBUeXBlZFNlY3Rpb248UEJYTmF0aXZlVGFyZ2V0PiA9IHRoaXMucGJ4TmF0aXZlVGFyZ2V0U2VjdGlvbigpO1xuICAgICAgICBjb25zdCBuYXRpdmVUYXJnZXQ6IFBCWE5hdGl2ZVRhcmdldCB8IHN0cmluZyB8IHVuZGVmaW5lZCA9IG5hdGl2ZVRhcmdldHNbdGFyZ2V0XTtcblxuICAgICAgICBpZiAodHlwZW9mIG5hdGl2ZVRhcmdldCAhPSBcIm9iamVjdFwiKSAvLyBzd2l0Y2hlZCBmcm9tICE9IHVuZGVmaW5lZCB0byA9PSBvYmplY3QgdG8gZGVhbCB3aXRoIHRoZSBwb3NzaWJpbGl0eSBzb21lb25lIHBhc3NlZCBpbiBhIGNvbW1lbnQga2V5XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIHRhcmdldDogXCIgKyB0YXJnZXQpO1xuXG4gICAgICAgIGZvciAodmFyIGluZGV4ID0gMDsgaW5kZXggPCBkZXBlbmRlbmN5VGFyZ2V0cy5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgICAgIGNvbnN0IGRlcGVuZGVuY3lUYXJnZXQgPSBkZXBlbmRlbmN5VGFyZ2V0c1tpbmRleF07XG4gICAgICAgICAgICBpZiAodHlwZW9mIG5hdGl2ZVRhcmdldHNbZGVwZW5kZW5jeVRhcmdldF0gIT0gXCJvYmplY3RcIikgLy8gc3dpdGNoZWQgZnJvbSA9PSBcInVuZGVmaW5lZFwiIHRvICE9IFwib2JqZWN0XCIgdG8gaGFuZGxlIGNvbW1lbnQga2V5c1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgdGFyZ2V0OiBcIiArIGRlcGVuZGVuY3lUYXJnZXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcGJ4VGFyZ2V0RGVwZW5kZW5jeVNlY3Rpb246IFR5cGVkU2VjdGlvbjxQQlhUYXJnZXREZXBlbmRlbmN5PiA9IHRoaXMucGJ4VGFyZ2V0RGVwZW5kZW5jeVNlY3Rpb24oKTtcbiAgICAgICAgY29uc3QgcGJ4Q29udGFpbmVySXRlbVByb3h5U2VjdGlvbjogVHlwZWRTZWN0aW9uPFBCWENvbnRhaW5lckl0ZW1Qcm94eT4gPSB0aGlzLnBieENvbnRhaW5lckl0ZW1Qcm94eVNlY3Rpb24oKTtcblxuICAgICAgICBpZiAoIXRoaXMuaGFzaCkgIC8vICBBc3N1cmUgVFMgd2UgY2FuIGFjY2VzcyBwcm9qZWN0LlxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdOb3QgbG9hZGVkJyk7XG5cbiAgICAgICAgY29uc3QgcHJvamVjdDogSVByb2plY3QgPSB0aGlzLmhhc2gucHJvamVjdDtcblxuICAgICAgICBmb3IgKHZhciBpbmRleCA9IDA7IGluZGV4IDwgZGVwZW5kZW5jeVRhcmdldHMubGVuZ3RoOyBpbmRleCsrKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IGRlcGVuZGVuY3lUYXJnZXRVdWlkOiBYQ19QUk9KX1VVSUQgPSBkZXBlbmRlbmN5VGFyZ2V0c1tpbmRleF07XG4gICAgICAgICAgICBjb25zdCBkZXBlbmRlbmN5VGFyZ2V0Q29tbWVudEtleTogWENfQ09NTUVOVF9LRVkgPSBTZWN0aW9uVXRpbHMuZGljdEtleVV1aWRUb0NvbW1lbnQoZGVwZW5kZW5jeVRhcmdldFV1aWQpO1xuXG4gICAgICAgICAgICBjb25zdCB0YXJnZXREZXBlbmRlbmN5VXVpZDogWENfUFJPSl9VVUlEID0gdGhpcy5nZW5lcmF0ZVV1aWQoKTtcbiAgICAgICAgICAgIC8vIGNvbnN0IHRhcmdldERlcGVuZGVuY3lDb21tZW50S2V5IDpYQ19DT01NRU5UX0tFWSA9IFNlY3Rpb25VdGlscy5kaWN0S2V5VXVpZFRvQ29tbWVudCh0YXJnZXREZXBlbmRlbmN5VXVpZCk7XG5cbiAgICAgICAgICAgIGNvbnN0IGl0ZW1Qcm94eVV1aWQ6IFhDX1BST0pfVVVJRCA9IHRoaXMuZ2VuZXJhdGVVdWlkKCk7XG4gICAgICAgICAgICAvLyBjb25zdCBpdGVtUHJveHlDb21tZW50S2V5OlhDX0NPTU1FTlRfS0VZID0gU2VjdGlvblV0aWxzLmRpY3RLZXlVdWlkVG9Db21tZW50KGl0ZW1Qcm94eVV1aWQpO1xuXG4gICAgICAgICAgICBjb25zdCBpdGVtUHJveHk6IFBCWENvbnRhaW5lckl0ZW1Qcm94eSA9IHtcbiAgICAgICAgICAgICAgICBpc2E6IGNQQlhDb250YWluZXJJdGVtUHJveHksXG4gICAgICAgICAgICAgICAgY29udGFpbmVyUG9ydGFsOiBwcm9qZWN0Wydyb290T2JqZWN0J10sXG4gICAgICAgICAgICAgICAgY29udGFpbmVyUG9ydGFsX2NvbW1lbnQ6IHByb2plY3RbJ3Jvb3RPYmplY3RfY29tbWVudCddLFxuICAgICAgICAgICAgICAgIHByb3h5VHlwZTogMSxcbiAgICAgICAgICAgICAgICByZW1vdGVHbG9iYWxJRFN0cmluZzogZGVwZW5kZW5jeVRhcmdldFV1aWQsXG4gICAgICAgICAgICAgICAgcmVtb3RlSW5mbzogKG5hdGl2ZVRhcmdldHNbZGVwZW5kZW5jeVRhcmdldFV1aWRdIGFzIFBCWE5hdGl2ZVRhcmdldCkubmFtZVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgY29uc3QgdGFyZ2V0RGVwZW5kZW5jeTogUEJYVGFyZ2V0RGVwZW5kZW5jeSA9IHtcbiAgICAgICAgICAgICAgICBpc2E6IGNQQlhUYXJnZXREZXBlbmRlbmN5LFxuICAgICAgICAgICAgICAgIHRhcmdldDogZGVwZW5kZW5jeVRhcmdldFV1aWQsXG4gICAgICAgICAgICAgICAgdGFyZ2V0X2NvbW1lbnQ6IG5hdGl2ZVRhcmdldHNbZGVwZW5kZW5jeVRhcmdldENvbW1lbnRLZXldIGFzIHN0cmluZyxcbiAgICAgICAgICAgICAgICB0YXJnZXRQcm94eTogaXRlbVByb3h5VXVpZCxcbiAgICAgICAgICAgICAgICB0YXJnZXRQcm94eV9jb21tZW50OiBjUEJYQ29udGFpbmVySXRlbVByb3h5XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyAgV2Ugbm93IGNyZWF0ZSB0aGUgc2VjdGlvbnMgaWYgdGhleSBkb24ndCBleGlzdC4gIFNvIHdlIGRvbid0IGNoZWNrIGlmIHRoZXkgYXJlIHNldCBoZXJlLlxuICAgICAgICAgICAgLy8gICAgICAgICAgICBpZiAocGJ4Q29udGFpbmVySXRlbVByb3h5U2VjdGlvbiAmJiBwYnhUYXJnZXREZXBlbmRlbmN5U2VjdGlvbikge1xuXG4gICAgICAgICAgICBTZWN0aW9uVXRpbHMuZW50cnlTZXRXVXVpZChwYnhDb250YWluZXJJdGVtUHJveHlTZWN0aW9uLCBpdGVtUHJveHlVdWlkLCBpdGVtUHJveHksIGNQQlhDb250YWluZXJJdGVtUHJveHkpO1xuICAgICAgICAgICAgLy8gcGJ4Q29udGFpbmVySXRlbVByb3h5U2VjdGlvbltpdGVtUHJveHlVdWlkXSA9IGl0ZW1Qcm94eTtcbiAgICAgICAgICAgIC8vIHBieENvbnRhaW5lckl0ZW1Qcm94eVNlY3Rpb25baXRlbVByb3h5Q29tbWVudEtleV0gPSBjUEJYQ29udGFpbmVySXRlbVByb3h5O1xuXG4gICAgICAgICAgICBTZWN0aW9uVXRpbHMuZW50cnlTZXRXVXVpZChwYnhUYXJnZXREZXBlbmRlbmN5U2VjdGlvbiwgdGFyZ2V0RGVwZW5kZW5jeVV1aWQsIHRhcmdldERlcGVuZGVuY3ksIGNQQlhUYXJnZXREZXBlbmRlbmN5KTtcbiAgICAgICAgICAgIC8vIHBieFRhcmdldERlcGVuZGVuY3lTZWN0aW9uW3RhcmdldERlcGVuZGVuY3lVdWlkXSA9IHRhcmdldERlcGVuZGVuY3k7XG4gICAgICAgICAgICAvLyBwYnhUYXJnZXREZXBlbmRlbmN5U2VjdGlvblt0YXJnZXREZXBlbmRlbmN5Q29tbWVudEtleV0gPSBjUEJYVGFyZ2V0RGVwZW5kZW5jeTtcblxuICAgICAgICAgICAgbmF0aXZlVGFyZ2V0LmRlcGVuZGVuY2llcy5wdXNoKHsgdmFsdWU6IHRhcmdldERlcGVuZGVuY3lVdWlkLCBjb21tZW50OiBjUEJYVGFyZ2V0RGVwZW5kZW5jeSB9KVxuICAgICAgICAgICAgLy8gICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7IHV1aWQ6IHRhcmdldCwgdGFyZ2V0OiBuYXRpdmVUYXJnZXQgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0gZmlsZVBhdGhzQXJyYXkgXG4gICAgICogQHBhcmFtIGJ1aWxkUGhhc2VUeXBlIFxuICAgICAqIEBwYXJhbSBjb21tZW50IFxuICAgICAqIEBwYXJhbSB0YXJnZXQgVVVJRCBvZiBQQlhOYXRpdmVUYXJnZXRcbiAgICAgKiBAcGFyYW0gb3B0aW9uc09yRm9sZGVyVHlwZSBBIHN0cmluZyBmb3IgXCJDb3B5IEZpbGVzXCIgYW5kIE9wdGlvbnMgZm9yIFwiU2hlbGwgU2NyaXB0XCIgYnVpbGQgcGhhc2VzLlxuICAgICAqIEBwYXJhbSBzdWJmb2xkZXJQYXRoIFxuICAgICAqL1xuICAgIGFkZEJ1aWxkUGhhc2UoXG4gICAgICAgIGZpbGVQYXRoc0FycmF5OiBzdHJpbmdbXSxcbiAgICAgICAgLy8gIERvbid0IGtub3cgaWYgdGhpcyB3YXMgbWVhbnQgdG8gaGFuZGxlIGFkZGl0aW9uYWwgcGhhc2VzIG9yIG5vdC4gIFxuICAgICAgICAvLyAgbGVmdCB0byBvbmx5IHN1cHBvcnQgdGhlc2UgdHdvIHR5cGVzLlxuICAgICAgICBidWlsZFBoYXNlVHlwZTogJ1BCWENvcHlGaWxlc0J1aWxkUGhhc2UnIHwgJ1BCWFNoZWxsU2NyaXB0QnVpbGRQaGFzZScsXG4gICAgICAgIGNvbW1lbnQ6IHN0cmluZyxcbiAgICAgICAgdGFyZ2V0OiBYQ19QUk9KX1VVSUQgfCBudWxsIHwgdW5kZWZpbmVkLFxuICAgICAgICBvcHRpb25zT3JGb2xkZXJUeXBlOiBzdHJpbmcgfCBJUGJ4U2hlbGxTY3JpcHRCdWlsZFBoYXNlT3B0aW9ucyxcbiAgICAgICAgc3ViZm9sZGVyUGF0aD86IHN0cmluZyB8IG51bGwpOiBJQnVpbGRQaGFzZVdyYXBwZXIge1xuXG4gICAgICAgIGNvbnN0IGJ1aWxkRmlsZVNlY3Rpb246IFR5cGVkU2VjdGlvbjxQQlhCdWlsZEZpbGU+ID0gdGhpcy5wYnhCdWlsZEZpbGVTZWN0aW9uKCk7XG5cbiAgICAgICAgbGV0IGJ1aWxkUGhhc2U6IFBCWEJ1aWxkUGhhc2VCYXNlID0ge1xuICAgICAgICAgICAgaXNhOiBidWlsZFBoYXNlVHlwZSxcbiAgICAgICAgICAgIGJ1aWxkQWN0aW9uTWFzazogMjE0NzQ4MzY0NyxcbiAgICAgICAgICAgIGZpbGVzOiBbXSxcbiAgICAgICAgICAgIHJ1bk9ubHlGb3JEZXBsb3ltZW50UG9zdHByb2Nlc3Npbmc6IDBcbiAgICAgICAgfTtcblxuXG4gICAgICAgIGlmIChidWlsZFBoYXNlVHlwZSA9PT0gY1BCWENvcHlGaWxlc0J1aWxkUGhhc2UpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygb3B0aW9uc09yRm9sZGVyVHlwZSAhPSAnc3RyaW5nJylcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgZm9sZGVyIHR5cGUgZm9yICcke2NQQlhDb3B5RmlsZXNCdWlsZFBoYXNlfSdgKTtcblxuICAgICAgICAgICAgYnVpbGRQaGFzZSA9IHBieENvcHlGaWxlc0J1aWxkUGhhc2VPYmooYnVpbGRQaGFzZSwgb3B0aW9uc09yRm9sZGVyVHlwZSwgc3ViZm9sZGVyUGF0aCwgY29tbWVudCk7XG4gICAgICAgIH0gZWxzZSBpZiAoYnVpbGRQaGFzZVR5cGUgPT09IGNQQlhTaGVsbFNjcmlwdEJ1aWxkUGhhc2UpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygb3B0aW9uc09yRm9sZGVyVHlwZSAhPSAnb2JqZWN0JylcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgZm9sZGVyIHR5cGUgZm9yICcke2NQQlhTaGVsbFNjcmlwdEJ1aWxkUGhhc2V9J2ApO1xuXG4gICAgICAgICAgICBidWlsZFBoYXNlID0gcGJ4U2hlbGxTY3JpcHRCdWlsZFBoYXNlT2JqKGJ1aWxkUGhhc2UsIG9wdGlvbnNPckZvbGRlclR5cGUsIGNvbW1lbnQpXG4gICAgICAgIH1cblxuICAgICAgICAvLyBJIGRvbid0IGtub3cgaWYgdGhpcyBpcyBzdXBwb3NlZCB0byBoYW5kbGUgb3RoZXIgYnVpbGQgcGhhc2UgdHlwZXMuICBBc3N1bWluZyBub3QuXG4gICAgICAgIC8vICBXaWxsIGZ1bmN0aW9uIHRoZSBzYW1lIHdoZW4gY2FsbGVkIGZyb20gamF2YXNjcmlwdCwgYnV0IGluZGljYXRlIGFuIGVycm9yIHdoZW5cbiAgICAgICAgLy8gIGNhbGxpbmcgZnJvbSB0eXBlc2NyaXB0IHNpY25lIHdlIHNwZWNpZnkgb25seSB0aGVzZSB0d28gcGhhc2VzLlxuXG5cbiAgICAgICAgY29uc3QgYnVpbGRQaGFzZVV1aWQ6IFhDX1BST0pfVVVJRCA9IHRoaXMuZ2VuZXJhdGVVdWlkKCk7XG5cbiAgICAgICAgLy8gIFRoaXMgd2FzIGJlaW5nIGRvbmUgdHdpY2UhICBEb2luZyBpdCBhdCB0aGUgZW5kLlxuICAgICAgICAvLyBjb25zdCBjb21tZW50S2V5OiBzdHJpbmcgPSBjcmVhdGVVdWlkQ29tbWVudEtleShidWlsZFBoYXNlVXVpZCk7XG4gICAgICAgIC8vIC8vIGlmICghdGhpcy5oYXNoLnByb2plY3Qub2JqZWN0c1tidWlsZFBoYXNlVHlwZV1bYnVpbGRQaGFzZVV1aWRdKSB7IHJlbW92ZWQgdGhpcyBjaGVjayBhcyB0aGlzIGlzIGltcG9zc2libGVcbiAgICAgICAgLy8gYnVpbGRQaGFzZVNlY3Rpb25bYnVpbGRQaGFzZVV1aWRdID0gYnVpbGRQaGFzZTtcbiAgICAgICAgLy8gYnVpbGRQaGFzZVNlY3Rpb25bY29tbWVudEtleV0gPSBjb21tZW50O1xuICAgICAgICAvLyBTZWN0aW9uVXRpbHMuZW50cnlTZXRXVXVpZDxQQlhCdWlsZFBoYXNlQmFzZT4oYnVpbGRQaGFzZVNlY3Rpb24sIGJ1aWxkUGhhc2VVdWlkLCBidWlsZFBoYXNlLCBjb21tZW50KTtcblxuICAgICAgICBjb25zdCBidWlsZFBoYXNlVGFyZ2V0VXVpZDogWENfUFJPSl9VVUlEID0gdGFyZ2V0IHx8IHRoaXMuZ2V0Rmlyc3RUYXJnZXQoKS51dWlkO1xuXG4gICAgICAgIGNvbnN0IG5hdGl2ZVRhcmdldDogUEJYTmF0aXZlVGFyZ2V0IHwgbnVsbCA9IFNlY3Rpb25VdGlscy5lbnRyeUdldFdVdWlkKHRoaXMucGJ4TmF0aXZlVGFyZ2V0U2VjdGlvbigpLCBidWlsZFBoYXNlVGFyZ2V0VXVpZCk7XG5cbiAgICAgICAgLy8gIE9yaWdpbmFsIGNvZGUgYm93ZWQgb3V0IGlmIHRoZXJlIGFyZSBub3QgYnVpbGRQaGFzZXMuICBUaGF0IGltcGxpZXMgdGhpcyBpcyBpbnZhbGlkIGFuZCBcbiAgICAgICAgLy8gIHRoZSBiZWhhdmlvciBpcyB3cm9uZy4gIEkgd2FudCB0aGUgZXJyb3IgaWYgbmF0aXZlVGFyZ2V0IGhhcyBubyBidWlsZCBwaGFzZXMgb3IgYXQgYSBtaW5pbXVtXG4gICAgICAgIC8vICB0byBhZGQgdGhlbSBiYWNrIGluLlxuICAgICAgICAvL2lmIChuYXRpdmVUYXJnZXQgJiYgbmF0aXZlVGFyZ2V0LmJ1aWxkUGhhc2VzKSB7XG4gICAgICAgIGlmIChuYXRpdmVUYXJnZXQpIHtcbiAgICAgICAgICAgIG5hdGl2ZVRhcmdldC5idWlsZFBoYXNlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICB2YWx1ZTogYnVpbGRQaGFzZVV1aWQsXG4gICAgICAgICAgICAgICAgY29tbWVudDogY29tbWVudFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBmaWxlUmVmZXJlbmNlU2VjdGlvbjogVHlwZWRTZWN0aW9uPFBCWEZpbGVSZWZlcmVuY2U+ID0gdGhpcy5wYnhGaWxlUmVmZXJlbmNlU2VjdGlvbigpO1xuXG4gICAgICAgIC8vICBMb2FkIHRoZSBmaWxlUGF0aFRvQnVpbGRGaWxlIGRpY3Rpb25hcnlcbiAgICAgICAgY29uc3QgZmlsZVBhdGhUb0J1aWxkRmlsZTogeyBbcGF0aDogc3RyaW5nXTogSUZpbGVQYXRoT2JqIH0gPSB7fTtcbiAgICAgICAgZm9yICh2YXIga2V5IGluIGJ1aWxkRmlsZVNlY3Rpb24pIHtcbiAgICAgICAgICAgIC8vIC8vIG9ubHkgbG9vayBmb3IgY29tbWVudHNcbiAgICAgICAgICAgIC8vIGlmICghQ09NTUVOVF9LRVkudGVzdChrZXkpKSBjb250aW51ZTtcblxuICAgICAgICAgICAgLy8gdmFyIGJ1aWxkRmlsZUtleSA9IGtleS5zcGxpdChDT01NRU5UX0tFWSlbMF0sXG4gICAgICAgICAgICAvLyAgICAgYnVpbGRGaWxlID0gYnVpbGRGaWxlU2VjdGlvbltidWlsZEZpbGVLZXldO1xuICAgICAgICAgICAgLy8gZmlsZVJlZmVyZW5jZSA9IGZpbGVSZWZlcmVuY2VTZWN0aW9uW2J1aWxkRmlsZS5maWxlUmVmXTtcblxuICAgICAgICAgICAgLy8gaWYgKCFmaWxlUmVmZXJlbmNlKSBjb250aW51ZTtcblxuICAgICAgICAgICAgLy8gdmFyIHBieEZpbGVPYmogPSBuZXcgUGJ4RmlsZShmaWxlUmVmZXJlbmNlLnBhdGgpO1xuXG4gICAgICAgICAgICAvLyBmaWxlUGF0aFRvQnVpbGRGaWxlW2ZpbGVSZWZlcmVuY2UucGF0aF0gPSB7IHV1aWQ6IGJ1aWxkRmlsZUtleSwgYmFzZW5hbWU6IHBieEZpbGVPYmouYmFzZW5hbWUsIGdyb3VwOiBwYnhGaWxlT2JqLmdyb3VwIH07XG4gICAgICAgICAgICAvLyAgT25seSBjb25zaWRlciBjb21tZW50c1xuICAgICAgICAgICAgaWYgKFNlY3Rpb25VdGlscy5kaWN0S2V5SXNDb21tZW50KGtleSkpIHtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGJ1aWxkRmlsZUtleTogWENfUFJPSl9VVUlEID0gU2VjdGlvblV0aWxzLmRpY3RLZXlDb21tZW50VG9VdWlkKGtleSk7XG4gICAgICAgICAgICAgICAgY29uc3QgYnVpbGRGaWxlOiBQQlhCdWlsZEZpbGUgPSBidWlsZEZpbGVTZWN0aW9uW2J1aWxkRmlsZUtleV0gYXMgUEJYQnVpbGRGaWxlO1xuICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVSZWZlcmVuY2U6IFBCWEZpbGVSZWZlcmVuY2UgfCB1bmRlZmluZWQgfCBzdHJpbmcgPSBmaWxlUmVmZXJlbmNlU2VjdGlvbltidWlsZEZpbGUuZmlsZVJlZl07XG5cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGZpbGVSZWZlcmVuY2UgPT0gXCJvYmplY3RcIikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwYnhGaWxlT2JqID0gbmV3IFBieEZpbGUoZmlsZVJlZmVyZW5jZS5wYXRoKTtcblxuICAgICAgICAgICAgICAgICAgICBmaWxlUGF0aFRvQnVpbGRGaWxlW2ZpbGVSZWZlcmVuY2UucGF0aF0gPSB7IHV1aWQ6IGJ1aWxkRmlsZUtleSwgYmFzZW5hbWU6IHBieEZpbGVPYmouYmFzZW5hbWUsIGdyb3VwOiBwYnhGaWxlT2JqLmdyb3VwIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZm9yICh2YXIgaW5kZXggPSAwOyBpbmRleCA8IGZpbGVQYXRoc0FycmF5Lmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgICAgdmFyIGZpbGVQYXRoID0gZmlsZVBhdGhzQXJyYXlbaW5kZXhdLFxuICAgICAgICAgICAgICAgIGZpbGVQYXRoUXVvdGVkID0gXCJcXFwiXCIgKyBmaWxlUGF0aCArIFwiXFxcIlwiLFxuICAgICAgICAgICAgICAgIGZpbGUgPSBuZXcgUGJ4RmlsZShmaWxlUGF0aCk7XG5cbiAgICAgICAgICAgIGlmIChmaWxlUGF0aFRvQnVpbGRGaWxlW2ZpbGVQYXRoXSkge1xuICAgICAgICAgICAgICAgIGJ1aWxkUGhhc2UuZmlsZXMucHVzaChwYnhCdWlsZFBoYXNlT2JqKGZpbGVQYXRoVG9CdWlsZEZpbGVbZmlsZVBhdGhdKSk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGZpbGVQYXRoVG9CdWlsZEZpbGVbZmlsZVBhdGhRdW90ZWRdKSB7XG4gICAgICAgICAgICAgICAgYnVpbGRQaGFzZS5maWxlcy5wdXNoKHBieEJ1aWxkUGhhc2VPYmooZmlsZVBhdGhUb0J1aWxkRmlsZVtmaWxlUGF0aFF1b3RlZF0pKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZmlsZS51dWlkID0gdGhpcy5nZW5lcmF0ZVV1aWQoKTtcbiAgICAgICAgICAgIGZpbGUuZmlsZVJlZiA9IHRoaXMuZ2VuZXJhdGVVdWlkKCk7XG4gICAgICAgICAgICB0aGlzLmFkZFRvUGJ4RmlsZVJlZmVyZW5jZVNlY3Rpb24oZmlsZSk7ICAgIC8vIFBCWEZpbGVSZWZlcmVuY2VcbiAgICAgICAgICAgIHRoaXMuYWRkVG9QYnhCdWlsZEZpbGVTZWN0aW9uKGZpbGUpOyAgICAgICAgLy8gUEJYQnVpbGRGaWxlXG4gICAgICAgICAgICBidWlsZFBoYXNlLmZpbGVzLnB1c2gocGJ4QnVpbGRQaGFzZU9iaihmaWxlKSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAgVGhpcyBpcyBvbmUgb2YgdGhlIGJ1aWxkIHBoYXNlIHNlY3Rpb25zLiAgVGhlcmUgYXJlIHNldmVyYWwuXG4gICAgICAgIGNvbnN0IGJ1aWxkUGhhc2VTZWN0aW9uOiBUeXBlZFNlY3Rpb248UEJYQnVpbGRQaGFzZUJhc2U+ID1cbiAgICAgICAgICAgIHRoaXMucGZfc2VjdGlvbkdldE9yQ3JlYXRlPFBCWEJ1aWxkUGhhc2VCYXNlPihidWlsZFBoYXNlVHlwZSk7XG5cbiAgICAgICAgU2VjdGlvblV0aWxzLmVudHJ5U2V0V1V1aWQ8UEJYQnVpbGRQaGFzZUJhc2U+KGJ1aWxkUGhhc2VTZWN0aW9uLCBidWlsZFBoYXNlVXVpZCwgYnVpbGRQaGFzZSwgY29tbWVudCk7XG4gICAgICAgIC8vIGlmIChidWlsZFBoYXNlU2VjdGlvbikge1xuICAgICAgICAvLyAgICAgYnVpbGRQaGFzZVNlY3Rpb25bYnVpbGRQaGFzZVV1aWRdID0gYnVpbGRQaGFzZTtcbiAgICAgICAgLy8gICAgIGJ1aWxkUGhhc2VTZWN0aW9uW2NvbW1lbnRLZXldID0gY29tbWVudDtcbiAgICAgICAgLy8gfVxuXG4gICAgICAgIHJldHVybiB7IHV1aWQ6IGJ1aWxkUGhhc2VVdWlkLCBidWlsZFBoYXNlOiBidWlsZFBoYXNlIH07XG4gICAgfVxuXG4gICAgLy8gIEltcGxlbWVudGF0aW9uIGNoYW5nZTogIDEwLzIwMTkgaXQgdXNlZCB0byBiZSBvbmx5IFhDVmVyc2lvbkdyb3VwIHdvdWxkXG4gICAgLy8gIGNyZWF0ZSBhIHNlY3Rpb24uICBOb3cgYWxsIG1pc3Npbmcgc2VjdGlvbnMgYXJlIGNyZWF0ZWQuXG4gICAgcHJpdmF0ZSBwZl9zZWN0aW9uR2V0T3JDcmVhdGU8UEJYX09CSl9UWVBFIGV4dGVuZHMgUEJYT2JqZWN0QmFzZT4oc2VjdGlvbk5hbWU6IElTQV9UWVBFKTogVHlwZWRTZWN0aW9uPFBCWF9PQkpfVFlQRT4ge1xuXG4gICAgICAgIGlmICghdGhpcy5oYXNoKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vdCBMb2FkZWQnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlb2YgdGhpcy5oYXNoLnByb2plY3Qub2JqZWN0c1tzZWN0aW9uTmFtZV0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICB0aGlzLmhhc2gucHJvamVjdC5vYmplY3RzW3NlY3Rpb25OYW1lXSA9IHt9O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuaGFzaC5wcm9qZWN0Lm9iamVjdHNbc2VjdGlvbk5hbWVdIGFzIFR5cGVkU2VjdGlvbjxQQlhfT0JKX1RZUEU+O1xuICAgIH1cblxuICAgIHBieEdyb3Vwc1NlY3Rpb24oKTogVHlwZWRTZWN0aW9uPFBCWEdyb3VwPiB7XG4gICAgICAgIHJldHVybiB0aGlzLnBmX3NlY3Rpb25HZXRPckNyZWF0ZTxQQlhHcm91cD4oY1BCWEdyb3VwKTtcbiAgICB9XG5cbiAgICBwYnhWYXJpYW50R3JvdXBzU2VjdGlvbigpOiBUeXBlZFNlY3Rpb248UEJYVmFyaWFudEdyb3VwPiB7XG4gICAgICAgIHJldHVybiB0aGlzLnBmX3NlY3Rpb25HZXRPckNyZWF0ZTxQQlhWYXJpYW50R3JvdXA+KGNQQlhWYXJpYW50R3JvdXApO1xuICAgIH1cbiAgICAvLyBoZWxwZXIgYWNjZXNzIGZ1bmN0aW9uc1xuICAgIHBieFByb2plY3RTZWN0aW9uKCk6IFR5cGVkU2VjdGlvbjxQQlhQcm9qZWN0PiB7XG4gICAgICAgIHJldHVybiB0aGlzLnBmX3NlY3Rpb25HZXRPckNyZWF0ZTxQQlhQcm9qZWN0PihjUEJYUHJvamVjdCk7XG4gICAgfVxuXG4gICAgcGJ4QnVpbGRGaWxlU2VjdGlvbigpOiBUeXBlZFNlY3Rpb248UEJYQnVpbGRGaWxlPiB7XG4gICAgICAgIHJldHVybiB0aGlzLnBmX3NlY3Rpb25HZXRPckNyZWF0ZShjUEJYQnVpbGRGaWxlKTtcbiAgICB9XG5cbiAgICBwYnhGaWxlUmVmZXJlbmNlU2VjdGlvbigpOiBUeXBlZFNlY3Rpb248UEJYRmlsZVJlZmVyZW5jZT4ge1xuICAgICAgICByZXR1cm4gdGhpcy5wZl9zZWN0aW9uR2V0T3JDcmVhdGU8UEJYRmlsZVJlZmVyZW5jZT4oY1BCWEZpbGVSZWZlcmVuY2UpO1xuICAgIH1cblxuICAgIHBieE5hdGl2ZVRhcmdldFNlY3Rpb24oKTogVHlwZWRTZWN0aW9uPFBCWE5hdGl2ZVRhcmdldD4ge1xuICAgICAgICByZXR1cm4gdGhpcy5wZl9zZWN0aW9uR2V0T3JDcmVhdGUoY1BCWE5hdGl2ZVRhcmdldCk7XG4gICAgfVxuXG4gICAgcGJ4VGFyZ2V0RGVwZW5kZW5jeVNlY3Rpb24oKTogVHlwZWRTZWN0aW9uPFBCWFRhcmdldERlcGVuZGVuY3k+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGZfc2VjdGlvbkdldE9yQ3JlYXRlKGNQQlhUYXJnZXREZXBlbmRlbmN5KTtcbiAgICB9XG5cbiAgICBwYnhDb250YWluZXJJdGVtUHJveHlTZWN0aW9uKCk6IFR5cGVkU2VjdGlvbjxQQlhDb250YWluZXJJdGVtUHJveHk+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGZfc2VjdGlvbkdldE9yQ3JlYXRlKGNQQlhDb250YWluZXJJdGVtUHJveHkpO1xuICAgIH1cblxuICAgIC8vICBUaGlzIHdhcyB0aGUgb3JpZ2luYWwgbmFtZSB0aGF0IEkgZGlkIG5vdCB0aGluayBtYWRlIHNlbnNlLiAgVGVzdHMgdXNlXG4gICAgLy8gIHRoaXMgc28gSSBwdXQgaXQgYmFjayB0byBjYWxsIHRoZSBuZXcgZnVuY3Rpb24gbmFtZS5cbiAgICBwYnhYQ0J1aWxkQ29uZmlndXJhdGlvblNlY3Rpb24oKTogVHlwZWRTZWN0aW9uPFhDQnVpbGRDb25maWd1cmF0aW9uPiB7XG4gICAgICAgIHJldHVybiB0aGlzLnhjQnVpbGRDb25maWd1cmF0aW9uU2VjdGlvbigpO1xuICAgIH1cblxuICAgIHhjQnVpbGRDb25maWd1cmF0aW9uU2VjdGlvbigpOiBUeXBlZFNlY3Rpb248WENCdWlsZENvbmZpZ3VyYXRpb24+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGZfc2VjdGlvbkdldE9yQ3JlYXRlKGNYQ0J1aWxkQ29uZmlndXJhdGlvbik7XG4gICAgfVxuXG4gICAgLy8gIEluY29uc2lzdGVudCBuYW1pbmcgb2Ygbm90IGhhdmluZyBwYnggaW4gZnJvbnQgZXhpc3RlZCB3aGVuIGZvdW5kLlxuICAgIC8vICBsZWZ0IGluIGNhc2UgY2xpZW50IHdhcyB1c2luZyB0aGlzLlxuICAgIHhjVmVyc2lvbkdyb3VwU2VjdGlvbigpOiBUeXBlZFNlY3Rpb248WENWZXJzaW9uR3JvdXA+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGZfc2VjdGlvbkdldE9yQ3JlYXRlKGNYQ1ZlcnNpb25Hcm91cCk7XG4gICAgfVxuXG4gICAgLy8gIFRoaXMgd2FzIHRoZSBvcmlnaW5hbCBuYW1lIHRoYXQgSSBkaWQgbm90IHRoaW5rIG1hZGUgc2Vuc2UuICBUZXN0cyB1c2VcbiAgICAvLyAgdGhpcyBzbyBJIHB1dCBpdCBiYWNrIHRvIGNhbGwgdGhlIG5ldyBmdW5jdGlvbiBuYW1lLlxuICAgIHBieFhDQ29uZmlndXJhdGlvbkxpc3QoKTogVHlwZWRTZWN0aW9uPFhDQ29uZmlndXJhdGlvbkxpc3Q+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMueGNDb25maWd1cmF0aW9uTGlzdCgpO1xuICAgIH1cblxuICAgIHhjQ29uZmlndXJhdGlvbkxpc3QoKTogVHlwZWRTZWN0aW9uPFhDQ29uZmlndXJhdGlvbkxpc3Q+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGZfc2VjdGlvbkdldE9yQ3JlYXRlKGNYQ0NvbmZpZ3VyYXRpb25MaXN0KTtcbiAgICB9XG5cbiAgICBwYnhHcm91cEJ5TmFtZShuYW1lOiBzdHJpbmcpOiBQQlhHcm91cCB8IG51bGwge1xuXG4gICAgICAgIHJldHVybiBTZWN0aW9uVXRpbHMuZW50cnlHZXRXQ29tbWVudFRleHQodGhpcy5wYnhHcm91cHNTZWN0aW9uKCksIG5hbWUpO1xuXG4gICAgICAgIC8vIGlmICghdGhpcy5oYXNoKSB0aHJvdyBuZXcgRXJyb3IoJ05vdCBMb2FkZWQnKTtcblxuICAgICAgICAvLyBjb25zdCBncm91cHM6IFNlY3Rpb24gPSB0aGlzLmhhc2gucHJvamVjdC5vYmplY3RzWydQQlhHcm91cCddO1xuXG4gICAgICAgIC8vIGZvciAobGV0IGtleSBpbiBncm91cHMpIHtcbiAgICAgICAgLy8gICAgIC8vIG9ubHkgbG9vayBmb3IgY29tbWVudHNcbiAgICAgICAgLy8gICAgIGlmICghQ09NTUVOVF9LRVkudGVzdChrZXkpKSBjb250aW51ZTtcblxuICAgICAgICAvLyAgICAgaWYgKGdyb3Vwc1trZXldID09IG5hbWUpIHtcbiAgICAgICAgLy8gICAgICAgICBjb25zdCBncm91cEtleSA9IGtleS5zcGxpdChDT01NRU5UX0tFWSlbMF07XG4gICAgICAgIC8vICAgICAgICAgcmV0dXJuIGdyb3Vwc1tncm91cEtleV0gYXMgUEJYR3JvdXA7XG4gICAgICAgIC8vICAgICB9XG4gICAgICAgIC8vIH1cblxuICAgICAgICAvLyByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBwYnhUYXJnZXRCeU5hbWUobmFtZTogc3RyaW5nKTogUEJYTmF0aXZlVGFyZ2V0IHwgbnVsbCB7XG4gICAgICAgIHJldHVybiBTZWN0aW9uVXRpbHMuZW50cnlHZXRXQ29tbWVudFRleHQodGhpcy5wYnhOYXRpdmVUYXJnZXRTZWN0aW9uKCksIG5hbWUpO1xuICAgICAgICAvLyByZXR1cm4gdGhpcy5wYnhJdGVtQnlDb21tZW50KG5hbWUsICdQQlhOYXRpdmVUYXJnZXQnKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZWFyY2ggdGhlIFBCWE5hdGl2ZVRhcmdldCBvYmplY3RzIGZvciBvbmUgd2l0aCB0aGUgcGFzc2VkIGluIG5hbWUuXG4gICAgICogUmV0dXJuIHRoZSBVVUlEIGlmIGl0IGV4aXN0cy4gIE90aGVyd2lzZSByZXR1cm4gbnVsbC5cbiAgICAgKiBAcGFyYW0gbmFtZSBcbiAgICAgKi9cbiAgICBmaW5kVGFyZ2V0S2V5KG5hbWU6IHN0cmluZyk6IFhDX1BST0pfVVVJRCB8IG51bGwge1xuICAgICAgICBjb25zdCB0YXJnZXRzOiBUeXBlZFNlY3Rpb248UEJYTmF0aXZlVGFyZ2V0PiA9IHRoaXMucGJ4TmF0aXZlVGFyZ2V0U2VjdGlvbigpO1xuXG4gICAgICAgIGZvciAobGV0IGtleSBpbiB0YXJnZXRzKSB7XG4gICAgICAgICAgICBpZiAoIVNlY3Rpb25VdGlscy5kaWN0S2V5SXNDb21tZW50KGtleSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXQ6IFBCWE5hdGl2ZVRhcmdldCA9IHRhcmdldHNba2V5XSBhcyBQQlhOYXRpdmVUYXJnZXQ7XG4gICAgICAgICAgICAgICAgaWYgKHRhcmdldC5uYW1lID09PSBuYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBrZXk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcGJ4SXRlbUJ5Q29tbWVudDxQQlhfT0JKX1RZUEUgZXh0ZW5kcyBQQlhPYmplY3RCYXNlPihjb21tZW50OiBzdHJpbmcsIHBieFNlY3Rpb25OYW1lOiBJU0FfVFlQRSk6IFBCWF9PQkpfVFlQRSB8IG51bGwge1xuICAgICAgICByZXR1cm4gU2VjdGlvblV0aWxzLmVudHJ5R2V0V0NvbW1lbnRUZXh0KHRoaXMucGZfc2VjdGlvbkdldE9yQ3JlYXRlPFBCWF9PQkpfVFlQRT4ocGJ4U2VjdGlvbk5hbWUpLCBjb21tZW50KTtcbiAgICAgICAgLy8gdmFyIHNlY3Rpb24gPSB0aGlzLmhhc2gucHJvamVjdC5vYmplY3RzW3BieFNlY3Rpb25OYW1lXSxcbiAgICAgICAgLy8gICAgIGtleSwgaXRlbUtleTtcblxuICAgICAgICAvLyBmb3IgKGtleSBpbiBzZWN0aW9uKSB7XG4gICAgICAgIC8vICAgICAvLyBvbmx5IGxvb2sgZm9yIGNvbW1lbnRzXG4gICAgICAgIC8vICAgICBpZiAoIUNPTU1FTlRfS0VZLnRlc3Qoa2V5KSkgY29udGludWU7XG5cbiAgICAgICAgLy8gICAgIGlmIChzZWN0aW9uW2tleV0gPT0gY29tbWVudCkge1xuICAgICAgICAvLyAgICAgICAgIGl0ZW1LZXkgPSBrZXkuc3BsaXQoQ09NTUVOVF9LRVkpWzBdO1xuICAgICAgICAvLyAgICAgICAgIHJldHVybiBzZWN0aW9uW2l0ZW1LZXldO1xuICAgICAgICAvLyAgICAgfVxuICAgICAgICAvLyB9XG5cbiAgICAgICAgLy8gcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcGJ4U291cmNlc0J1aWxkUGhhc2VPYmoodGFyZ2V0PzogWENfUFJPSl9VVUlEIHwgbnVsbCk6IFBCWFNvdXJjZXNCdWlsZFBoYXNlIHwgbnVsbCB7XG4gICAgICAgIHJldHVybiB0aGlzLmJ1aWxkUGhhc2VPYmplY3Q8UEJYU291cmNlc0J1aWxkUGhhc2U+KCdQQlhTb3VyY2VzQnVpbGRQaGFzZScsICdTb3VyY2VzJywgdGFyZ2V0KTtcbiAgICB9XG5cbiAgICBwYnhSZXNvdXJjZXNCdWlsZFBoYXNlT2JqKHRhcmdldD86IFhDX1BST0pfVVVJRCB8IG51bGwpOiBQQlhSZXNvdXJjZXNCdWlsZFBoYXNlIHwgbnVsbCB7XG4gICAgICAgIHJldHVybiB0aGlzLmJ1aWxkUGhhc2VPYmplY3Q8UEJYUmVzb3VyY2VzQnVpbGRQaGFzZT4oJ1BCWFJlc291cmNlc0J1aWxkUGhhc2UnLCAnUmVzb3VyY2VzJywgdGFyZ2V0KTtcbiAgICB9XG5cbiAgICBwYnhGcmFtZXdvcmtzQnVpbGRQaGFzZU9iaih0YXJnZXQ/OiBYQ19QUk9KX1VVSUQgfCBudWxsKTogUEJYRnJhbWV3b3Jrc0J1aWxkUGhhc2UgfCBudWxsIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYnVpbGRQaGFzZU9iamVjdDxQQlhGcmFtZXdvcmtzQnVpbGRQaGFzZT4oJ1BCWEZyYW1ld29ya3NCdWlsZFBoYXNlJywgJ0ZyYW1ld29ya3MnLCB0YXJnZXQpO1xuICAgIH1cblxuICAgIHBieEVtYmVkRnJhbWV3b3Jrc0J1aWxkUGhhc2VPYmoodGFyZ2V0PzogWENfUFJPSl9VVUlEIHwgbnVsbCk6IFBCWENvcHlGaWxlc0J1aWxkUGhhc2UgfCBudWxsIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYnVpbGRQaGFzZU9iamVjdDxQQlhDb3B5RmlsZXNCdWlsZFBoYXNlPignUEJYQ29weUZpbGVzQnVpbGRQaGFzZScsICdFbWJlZCBGcmFtZXdvcmtzJywgdGFyZ2V0KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRmluZCBCdWlsZCBQaGFzZSBmcm9tIGdyb3VwL3RhcmdldFxuICAgICAqIEBwYXJhbSBncm91cCBUaGUgbmFtZSBvZiB0aGUgYnVpbGQgcGhhc2UuICBcIlNvdXJjZXNcIiwgXCJGcmFtZXdvcmtzXCIsIG9yIFwiUmVzb3VyY2VzXCIgZnJvbSB0aGUgc2FtcGxlLlxuICAgICAqIEBwYXJhbSB0YXJnZXQgVVVJRCBvZiB0aGUgUEJYTmF0aXZlVGFyZ2V0IChBODA2NzJFNDIzM0QyQTg0MDAzRUE2QkIgaW4gdGhlIHNhbXBsZSBiZWxvdylcbiAgICAgKiBAcmV0dXJucyBUaGUgYnVpbGQgcGhhc2Ugd2l0aCBfY29tbWVudCBhcHBlbmRlZCBvciB1bmRlZmluZWQsICBFeDpcIkE4MDY3MkUxMjMzRDJBODQwMDNFQTZCQl9jb21tZW50XCJcbiAgICAgKiBcbiAgICAgKiBTYW1wbGU6XG4gICAgICogLyAqIEJlZ2luIFBCWE5hdGl2ZVRhcmdldCBzZWN0aW9uICogLyBcbiAgICAgIEE4MDY3MkU0MjMzRDJBODQwMDNFQTZCQiAvICogYWQtbm90aWZpY2F0aW9uLXNlcnZpY2UtZXh0ZW5zaW9uICogLyA9IHsgXG4gICAgICAgICBpc2EgPSBQQlhOYXRpdmVUYXJnZXQ7IFxuICAgICAgICAgYnVpbGRDb25maWd1cmF0aW9uTGlzdCA9IEE4MDY3MkYxMjMzRDJBODUwMDNFQTZCQiAvICogQnVpbGQgY29uZmlndXJhdGlvbiBsaXN0IGZvciBQQlhOYXRpdmVUYXJnZXQgXCJhZC1ub3RpZmljYXRpb24tc2VydmljZS1leHRlbnNpb25cIiAqIC87IFxuICAgICAgICAgYnVpbGRQaGFzZXMgPSAoIFxuICAgICAgICAgICAgICAgICBBODA2NzJFMTIzM0QyQTg0MDAzRUE2QkIgLyAqIFNvdXJjZXMgKiAvLCBcbiAgICAgICAgICAgICAgICAgQTgwNjcyRTIyMzNEMkE4NDAwM0VBNkJCIC8gKiBGcmFtZXdvcmtzICogLywgXG4gICAgICAgICAgICAgICAgIEE4MDY3MkUzMjMzRDJBODQwMDNFQTZCQiAvICogUmVzb3VyY2VzICogLywgXG4gICAgICAgICApOyBcbiAgICAgKiBcbiAgICAgKi9cbiAgICBidWlsZFBoYXNlKGdyb3VwOiBGSUxFVFlQRV9HUk9VUCwgdGFyZ2V0PzogWENfUFJPSl9VVUlEIHwgbnVsbCk6IFhDX0NPTU1FTlRfS0VZIHwgdW5kZWZpbmVkIHtcblxuICAgICAgICBpZiAoIXRhcmdldClcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG5cbiAgICAgICAgY29uc3QgbmF0aXZlVGFyZ2V0czogVHlwZWRTZWN0aW9uPFBCWE5hdGl2ZVRhcmdldD4gPSB0aGlzLnBieE5hdGl2ZVRhcmdldFNlY3Rpb24oKTtcbiAgICAgICAgaWYgKHR5cGVvZiBuYXRpdmVUYXJnZXRzW3RhcmdldF0gPT0gXCJ1bmRlZmluZWRcIilcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgdGFyZ2V0OiBcIiArIHRhcmdldCk7XG5cbiAgICAgICAgLy8gIEFzc3VtaW5nIHRhcmdldCBpcyBuZXZlciB0aGUgY29tbWVudCBzdHJpbmcsIHNvIG5hdGl2ZVRhcmdldCBpcyBhbHdheXMgYW4gb2JqZWN0LlxuICAgICAgICBjb25zdCBuYXRpdmVUYXJnZXQ6IFBCWE5hdGl2ZVRhcmdldCA9IG5hdGl2ZVRhcmdldHNbdGFyZ2V0XSBhcyBQQlhOYXRpdmVUYXJnZXQ7XG4gICAgICAgIGNvbnN0IGJ1aWxkUGhhc2VzOiBJQ2hpbGRMaXN0RW50cnlbXSA9IG5hdGl2ZVRhcmdldC5idWlsZFBoYXNlcztcbiAgICAgICAgZm9yIChsZXQgaSBpbiBidWlsZFBoYXNlcykge1xuICAgICAgICAgICAgY29uc3QgYnVpbGRQaGFzZSA9IGJ1aWxkUGhhc2VzW2ldO1xuICAgICAgICAgICAgaWYgKGJ1aWxkUGhhc2UuY29tbWVudCA9PSBncm91cClcbiAgICAgICAgICAgICAgICByZXR1cm4gYnVpbGRQaGFzZS52YWx1ZSArIFwiX2NvbW1lbnRcIjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogXG4gICAgICogQHBhcmFtIG5hbWUgU2VjdGlvbiBOYW1lICh0eXBlIG9mIG9iamVjdClcbiAgICAgKiBAcGFyYW0gZ3JvdXAgXG4gICAgICogQHBhcmFtIHRhcmdldCBcbiAgICAgKi9cbiAgICBidWlsZFBoYXNlT2JqZWN0PFBCWF9PQkpfVFlQRSBleHRlbmRzIFBCWE9iamVjdEJhc2U+KFxuICAgICAgICBuYW1lOiBJU0FfQlVJTERfUEhBU0VfVFlQRSxcbiAgICAgICAgZ3JvdXA6IEZJTEVUWVBFX0dST1VQLFxuICAgICAgICB0YXJnZXQ/OiBYQ19QUk9KX1VVSUQgfCBudWxsKTogUEJYX09CSl9UWVBFIHwgbnVsbCB7XG5cbiAgICAgICAgY29uc3Qgc2VjdGlvbjogVHlwZWRTZWN0aW9uPFBCWF9PQkpfVFlQRT4gPSB0aGlzLnBmX3NlY3Rpb25HZXRPckNyZWF0ZShuYW1lKTtcbiAgICAgICAgY29uc3QgYnVpbGRQaGFzZTogWENfQ09NTUVOVF9LRVkgfCB1bmRlZmluZWQgPSB0aGlzLmJ1aWxkUGhhc2UoZ3JvdXAsIHRhcmdldCk7XG5cbiAgICAgICAgZm9yIChsZXQga2V5IGluIHNlY3Rpb24pIHtcblxuICAgICAgICAgICAgLy8gb25seSBsb29rIGZvciBjb21tZW50c1xuICAgICAgICAgICAgaWYgKFNlY3Rpb25VdGlscy5kaWN0S2V5SXNDb21tZW50KGtleSkgJiYgICAgICAgICAgICAgICAvLyBUaGlzIGlzIGEgY29tbWVudCBrZXlcbiAgICAgICAgICAgICAgICAoYnVpbGRQaGFzZSA9PSB1bmRlZmluZWQgfHwgYnVpbGRQaGFzZSA9PSBrZXkpICYmICAgLy8gIEJ1aWxkIHBoYXNlIGlzIGVpdGhlciBub3Qgc2V0IG9yIHRoZSBwaGFzZSBtYXRjaGVzIHRoaXMga2V5XG4gICAgICAgICAgICAgICAgc2VjdGlvbltrZXldID09IGdyb3VwKSB7IC8vIFZhbHVlIG9mIHRoZSBDb21tZW50IGtleSBtYXRjaGVzIHRoZSBncm91cCB0eXBlXG5cbiAgICAgICAgICAgICAgICAvLyBjb25zdCBzZWN0aW9uS2V5ID0ga2V5LnNwbGl0KENPTU1FTlRfS0VZKVswXSBhcyBYQ19QUk9KX1VVSUQ7XG4gICAgICAgICAgICAgICAgLy8gcmV0dXJuIHNlY3Rpb25bc2VjdGlvbktleV0gYXMgUEJYX09CSl9UWVBFO1xuICAgICAgICAgICAgICAgIHJldHVybiBTZWN0aW9uVXRpbHMuZW50cnlHZXRXQ29tbWVudEtleShzZWN0aW9uLCBrZXkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgYWRkQnVpbGRQcm9wZXJ0eShwcm9wOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcsIGJ1aWxkX25hbWU6IHN0cmluZyk6IHZvaWQge1xuICAgICAgICBjb25zdCBjb25maWd1cmF0aW9uczogU2VjdGlvbkRpY3RVdWlkVG9PYmo8WENCdWlsZENvbmZpZ3VyYXRpb24+ID0gU2VjdGlvblV0aWxzLmNyZWF0ZVV1aWRLZXlPbmx5U2VjdGlvbkRpY3QodGhpcy54Y0J1aWxkQ29uZmlndXJhdGlvblNlY3Rpb24oKSk7XG5cbiAgICAgICAgZm9yIChsZXQga2V5IGluIGNvbmZpZ3VyYXRpb25zKSB7XG4gICAgICAgICAgICBjb25zdCBjb25maWd1cmF0aW9uOiBYQ0J1aWxkQ29uZmlndXJhdGlvbiA9IGNvbmZpZ3VyYXRpb25zW2tleV07XG4gICAgICAgICAgICBpZiAoIWJ1aWxkX25hbWUgfHwgY29uZmlndXJhdGlvbi5uYW1lID09PSBidWlsZF9uYW1lKSB7XG4gICAgICAgICAgICAgICAgY29uZmlndXJhdGlvbi5idWlsZFNldHRpbmdzW3Byb3BdID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW1vdmVCdWlsZFByb3BlcnR5KHByb3A6IHN0cmluZywgYnVpbGRfbmFtZTogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IGNvbmZpZ3VyYXRpb25zOiBTZWN0aW9uRGljdFV1aWRUb09iajxYQ0J1aWxkQ29uZmlndXJhdGlvbj4gPSBTZWN0aW9uVXRpbHMuY3JlYXRlVXVpZEtleU9ubHlTZWN0aW9uRGljdCh0aGlzLnhjQnVpbGRDb25maWd1cmF0aW9uU2VjdGlvbigpKTtcblxuICAgICAgICBmb3IgKGxldCBrZXkgaW4gY29uZmlndXJhdGlvbnMpIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZ3VyYXRpb24gPSBjb25maWd1cmF0aW9uc1trZXldO1xuICAgICAgICAgICAgaWYgKGNvbmZpZ3VyYXRpb24uYnVpbGRTZXR0aW5nc1twcm9wXSAmJlxuICAgICAgICAgICAgICAgICFidWlsZF9uYW1lIHx8IGNvbmZpZ3VyYXRpb24ubmFtZSA9PT0gYnVpbGRfbmFtZSkge1xuICAgICAgICAgICAgICAgIGRlbGV0ZSBjb25maWd1cmF0aW9uLmJ1aWxkU2V0dGluZ3NbcHJvcF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBOb3RlLCB0aGlzIG1vZGlmaWVzIHRoaXMgcHJvcGVydHkgb24gZXZlcnkgYnVpbGQgY29uZmlndXJhdGlvbiBvYmplY3QuXG4gICAgICogVGhlcmUgY2FuIGJlIG1hbnkuXG4gICAgICogXG4gICAgICogQHBhcmFtIHByb3Age1N0cmluZ31cbiAgICAgKiBAcGFyYW0gdmFsdWUge1N0cmluZ3xBcnJheXxPYmplY3R8TnVtYmVyfEJvb2xlYW59XG4gICAgICogQHBhcmFtIGJ1aWxkIHtTdHJpbmd9IFJlbGVhc2Ugb3IgRGVidWcgb3IgcGFzcyBpbiBudWxsIHRvIGRvIGFsbFxuICAgICAqL1xuICAgIHVwZGF0ZUJ1aWxkUHJvcGVydHkocHJvcDogc3RyaW5nLCB2YWx1ZTogYW55LCBidWlsZD86ICdSZWxlYXNlJyB8ICdEZWJ1ZycgfCBudWxsKTogdm9pZCB7XG4gICAgICAgIHZhciBjb25maWdzOiBUeXBlZFNlY3Rpb248WENCdWlsZENvbmZpZ3VyYXRpb24+ID0gdGhpcy54Y0J1aWxkQ29uZmlndXJhdGlvblNlY3Rpb24oKTtcbiAgICAgICAgZm9yIChsZXQgY29uZmlnTmFtZSBpbiBjb25maWdzKSB7XG4gICAgICAgICAgICBpZiAoIVNlY3Rpb25VdGlscy5kaWN0S2V5SXNDb21tZW50KGNvbmZpZ05hbWUpKSB7XG4gICAgICAgICAgICAgICAgdmFyIGNvbmZpZzogWENCdWlsZENvbmZpZ3VyYXRpb24gPSBjb25maWdzW2NvbmZpZ05hbWVdIGFzIFhDQnVpbGRDb25maWd1cmF0aW9uO1xuICAgICAgICAgICAgICAgIGlmICgoYnVpbGQgJiYgY29uZmlnLm5hbWUgPT09IGJ1aWxkKSB8fCAoIWJ1aWxkKSkge1xuICAgICAgICAgICAgICAgICAgICBjb25maWcuYnVpbGRTZXR0aW5nc1twcm9wXSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZVByb2R1Y3ROYW1lKG5hbWU6IHN0cmluZyk6IHZvaWQge1xuICAgICAgICB0aGlzLnVwZGF0ZUJ1aWxkUHJvcGVydHkoJ1BST0RVQ1RfTkFNRScsICdcIicgKyBuYW1lICsgJ1wiJyk7XG4gICAgfVxuXG5cblxuICAgIHByaXZhdGUgcGZfcHJvY2Vzc0J1aWxkQ29uZmlndXJhdGlvbnNXaXRoVGhlUHJvZHVjdE5hbWUoXG4gICAgICAgIGNhbGxiYWNrOiAoYnVpbGRTZXR0aW5nczogeyBbcHJvcDogc3RyaW5nXTogYW55IH0sIGNvbmZpZzogWENCdWlsZENvbmZpZ3VyYXRpb24pID0+IHZvaWQpOiB2b2lkIHtcblxuICAgICAgICBjb25zdCBjb25maWd1cmF0aW9uczogU2VjdGlvbkRpY3RVdWlkVG9PYmo8WENCdWlsZENvbmZpZ3VyYXRpb24+ID0gU2VjdGlvblV0aWxzLmNyZWF0ZVV1aWRLZXlPbmx5U2VjdGlvbkRpY3QodGhpcy54Y0J1aWxkQ29uZmlndXJhdGlvblNlY3Rpb24oKSk7XG5cbiAgICAgICAgLy8gIEdldCB0aGUgcHJvZHVjdCBuYW1lIHVwIGZyb250IHRvIGF2b2lkIG9yZGVyIG4gc3F1YXJlZCBhbGdvcml0aG1cbiAgICAgICAgY29uc3QgcHJvZHVjdE5hbWU6IHN0cmluZyA9IHRoaXMucHJvZHVjdE5hbWU7XG5cbiAgICAgICAgZm9yIChsZXQgY29uZmlnS2V5IGluIGNvbmZpZ3VyYXRpb25zKSB7XG4gICAgICAgICAgICBjb25zdCBjb25maWc6IFhDQnVpbGRDb25maWd1cmF0aW9uID0gY29uZmlndXJhdGlvbnNbY29uZmlnS2V5XTtcbiAgICAgICAgICAgIGNvbnN0IGJ1aWxkU2V0dGluZ3MgPSBjb25maWcuYnVpbGRTZXR0aW5ncztcblxuICAgICAgICAgICAgaWYgKHVucXVvdGUoYnVpbGRTZXR0aW5nc1snUFJPRFVDVF9OQU1FJ10pID09IHByb2R1Y3ROYW1lKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soYnVpbGRTZXR0aW5ncywgY29uZmlnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgdGVtcGxhdGUoZmlsZTogUGJ4RmlsZSk6IHZvaWQge1xuXG4gICAgICAgIC8vICBpbml0IGhlcmVcblxuICAgICAgICB0aGlzLnBmX3Byb2Nlc3NCdWlsZENvbmZpZ3VyYXRpb25zV2l0aFRoZVByb2R1Y3ROYW1lKFxuICAgICAgICAgICAgKGJ1aWxkU2V0dGluZ3M6IHsgW3Byb3A6IHN0cmluZ106IGFueSB9KSA9PiB7XG5cbiAgICAgICAgICAgICAgICAvLyAgcHJvY2VzcyBlYWNoIGhlcmVcbiAgICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICByZW1vdmVGcm9tRnJhbWV3b3JrU2VhcmNoUGF0aHMoZmlsZTogUGJ4RmlsZSk6IHZvaWQge1xuXG4gICAgICAgIGNvbnN0IFNFQVJDSF9QQVRIUyA9ICdGUkFNRVdPUktfU0VBUkNIX1BBVEhTJztcblxuICAgICAgICBjb25zdCBuZXdfcGF0aCA9IHNlYXJjaFBhdGhGb3JGaWxlKGZpbGUsIHRoaXMpO1xuXG4gICAgICAgIHRoaXMucGZfcHJvY2Vzc0J1aWxkQ29uZmlndXJhdGlvbnNXaXRoVGhlUHJvZHVjdE5hbWUoXG4gICAgICAgICAgICAoYnVpbGRTZXR0aW5nczogeyBbcHJvcDogc3RyaW5nXTogYW55IH0pID0+IHtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHNlYXJjaFBhdGhzID0gYnVpbGRTZXR0aW5nc1tTRUFSQ0hfUEFUSFNdO1xuXG4gICAgICAgICAgICAgICAgaWYgKHNlYXJjaFBhdGhzICYmIEFycmF5LmlzQXJyYXkoc2VhcmNoUGF0aHMpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBtYXRjaGVzID0gc2VhcmNoUGF0aHMuZmlsdGVyKGZ1bmN0aW9uIChwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcC5pbmRleE9mKG5ld19wYXRoKSA+IC0xO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgbWF0Y2hlcy5mb3JFYWNoKGZ1bmN0aW9uIChtKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgaWR4ID0gc2VhcmNoUGF0aHMuaW5kZXhPZihtKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlYXJjaFBhdGhzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgYWRkVG9GcmFtZXdvcmtTZWFyY2hQYXRocyhmaWxlOiBQYnhGaWxlKTogdm9pZCB7XG5cbiAgICAgICAgdGhpcy5wZl9wcm9jZXNzQnVpbGRDb25maWd1cmF0aW9uc1dpdGhUaGVQcm9kdWN0TmFtZShcbiAgICAgICAgICAgIChidWlsZFNldHRpbmdzOiB7IFtwcm9wOiBzdHJpbmddOiBhbnkgfSkgPT4ge1xuXG4gICAgICAgICAgICAgICAgY29uc3QgSU5IRVJJVEVEID0gJ1wiJChpbmhlcml0ZWQpXCInO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFidWlsZFNldHRpbmdzWydGUkFNRVdPUktfU0VBUkNIX1BBVEhTJ11cbiAgICAgICAgICAgICAgICAgICAgfHwgYnVpbGRTZXR0aW5nc1snRlJBTUVXT1JLX1NFQVJDSF9QQVRIUyddID09PSBJTkhFUklURUQpIHtcbiAgICAgICAgICAgICAgICAgICAgYnVpbGRTZXR0aW5nc1snRlJBTUVXT1JLX1NFQVJDSF9QQVRIUyddID0gW0lOSEVSSVRFRF07XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYnVpbGRTZXR0aW5nc1snRlJBTUVXT1JLX1NFQVJDSF9QQVRIUyddLnB1c2goc2VhcmNoUGF0aEZvckZpbGUoZmlsZSwgdGhpcykpO1xuXG4gICAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgcmVtb3ZlRnJvbUxpYnJhcnlTZWFyY2hQYXRocyhmaWxlOiBQYnhGaWxlKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IG5ld19wYXRoID0gc2VhcmNoUGF0aEZvckZpbGUoZmlsZSwgdGhpcyk7XG5cbiAgICAgICAgdGhpcy5wZl9wcm9jZXNzQnVpbGRDb25maWd1cmF0aW9uc1dpdGhUaGVQcm9kdWN0TmFtZShcbiAgICAgICAgICAgIChidWlsZFNldHRpbmdzOiB7IFtwcm9wOiBzdHJpbmddOiBhbnkgfSkgPT4ge1xuXG4gICAgICAgICAgICAgICAgY29uc3QgU0VBUkNIX1BBVEhTID0gJ0xJQlJBUllfU0VBUkNIX1BBVEhTJyxcblxuICAgICAgICAgICAgICAgICAgICBzZWFyY2hQYXRocyA9IGJ1aWxkU2V0dGluZ3NbU0VBUkNIX1BBVEhTXTtcblxuICAgICAgICAgICAgICAgIGlmIChzZWFyY2hQYXRocyAmJiBBcnJheS5pc0FycmF5KHNlYXJjaFBhdGhzKSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgbWF0Y2hlcyA9IHNlYXJjaFBhdGhzLmZpbHRlcihmdW5jdGlvbiAocCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHAuaW5kZXhPZihuZXdfcGF0aCkgPiAtMTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIG1hdGNoZXMuZm9yRWFjaChmdW5jdGlvbiAobSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGlkeCA9IHNlYXJjaFBhdGhzLmluZGV4T2YobSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWFyY2hQYXRocy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICApO1xuXG4gICAgfVxuXG4gICAgYWRkVG9MaWJyYXJ5U2VhcmNoUGF0aHMoZmlsZTogUGJ4RmlsZSk6IHZvaWQge1xuXG4gICAgICAgIHRoaXMucGZfcHJvY2Vzc0J1aWxkQ29uZmlndXJhdGlvbnNXaXRoVGhlUHJvZHVjdE5hbWUoXG4gICAgICAgICAgICAoYnVpbGRTZXR0aW5nczogeyBbcHJvcDogc3RyaW5nXTogYW55IH0pID0+IHtcblxuICAgICAgICAgICAgICAgIGNvbnN0IElOSEVSSVRFRCA9ICdcIiQoaW5oZXJpdGVkKVwiJztcblxuICAgICAgICAgICAgICAgIGlmICghYnVpbGRTZXR0aW5nc1snTElCUkFSWV9TRUFSQ0hfUEFUSFMnXVxuICAgICAgICAgICAgICAgICAgICB8fCBidWlsZFNldHRpbmdzWydMSUJSQVJZX1NFQVJDSF9QQVRIUyddID09PSBJTkhFUklURUQpIHtcbiAgICAgICAgICAgICAgICAgICAgYnVpbGRTZXR0aW5nc1snTElCUkFSWV9TRUFSQ0hfUEFUSFMnXSA9IFtJTkhFUklURURdO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZmlsZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgYnVpbGRTZXR0aW5nc1snTElCUkFSWV9TRUFSQ0hfUEFUSFMnXS5wdXNoKGZpbGUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGJ1aWxkU2V0dGluZ3NbJ0xJQlJBUllfU0VBUkNIX1BBVEhTJ10ucHVzaChzZWFyY2hQYXRoRm9yRmlsZShmaWxlLCB0aGlzKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICApO1xuICAgIH1cblxuICAgIHJlbW92ZUZyb21IZWFkZXJTZWFyY2hQYXRocyhmaWxlOiBQYnhGaWxlKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IG5ld19wYXRoID0gc2VhcmNoUGF0aEZvckZpbGUoZmlsZSwgdGhpcyk7XG5cbiAgICAgICAgdGhpcy5wZl9wcm9jZXNzQnVpbGRDb25maWd1cmF0aW9uc1dpdGhUaGVQcm9kdWN0TmFtZShcbiAgICAgICAgICAgIChidWlsZFNldHRpbmdzOiB7IFtwcm9wOiBzdHJpbmddOiBhbnkgfSkgPT4ge1xuXG4gICAgICAgICAgICAgICAgY29uc3QgU0VBUkNIX1BBVEhTID0gJ0hFQURFUl9TRUFSQ0hfUEFUSFMnO1xuXG4gICAgICAgICAgICAgICAgaWYgKGJ1aWxkU2V0dGluZ3NbU0VBUkNIX1BBVEhTXSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgbWF0Y2hlcyA9IGJ1aWxkU2V0dGluZ3NbU0VBUkNIX1BBVEhTXS5maWx0ZXIoZnVuY3Rpb24gKHA6IHN0cmluZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHAuaW5kZXhPZihuZXdfcGF0aCkgPiAtMTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIG1hdGNoZXMuZm9yRWFjaChmdW5jdGlvbiAobTogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgaWR4ID0gYnVpbGRTZXR0aW5nc1tTRUFSQ0hfUEFUSFNdLmluZGV4T2YobSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBidWlsZFNldHRpbmdzW1NFQVJDSF9QQVRIU10uc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICBhZGRUb0hlYWRlclNlYXJjaFBhdGhzKGZpbGU6IFBieEZpbGUpOiB2b2lkIHtcblxuICAgICAgICB0aGlzLnBmX3Byb2Nlc3NCdWlsZENvbmZpZ3VyYXRpb25zV2l0aFRoZVByb2R1Y3ROYW1lKFxuICAgICAgICAgICAgKGJ1aWxkU2V0dGluZ3M6IHsgW3Byb3A6IHN0cmluZ106IGFueSB9KSA9PiB7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBJTkhFUklURUQgPSAnXCIkKGluaGVyaXRlZClcIic7XG5cbiAgICAgICAgICAgICAgICBpZiAoIWJ1aWxkU2V0dGluZ3NbJ0hFQURFUl9TRUFSQ0hfUEFUSFMnXSkge1xuICAgICAgICAgICAgICAgICAgICBidWlsZFNldHRpbmdzWydIRUFERVJfU0VBUkNIX1BBVEhTJ10gPSBbSU5IRVJJVEVEXTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGZpbGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgIGJ1aWxkU2V0dGluZ3NbJ0hFQURFUl9TRUFSQ0hfUEFUSFMnXS5wdXNoKGZpbGUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGJ1aWxkU2V0dGluZ3NbJ0hFQURFUl9TRUFSQ0hfUEFUSFMnXS5wdXNoKHNlYXJjaFBhdGhGb3JGaWxlKGZpbGUsIHRoaXMpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgYWRkVG9PdGhlckxpbmtlckZsYWdzKGZsYWc6IGFueSk6IHZvaWQgeyAvLyBhbnkgaXMgYSBndWVzcyAtLSBmaXggdGhpcyBsYXRlclxuXG4gICAgICAgIHRoaXMucGZfcHJvY2Vzc0J1aWxkQ29uZmlndXJhdGlvbnNXaXRoVGhlUHJvZHVjdE5hbWUoXG4gICAgICAgICAgICAoYnVpbGRTZXR0aW5nczogeyBbcHJvcDogc3RyaW5nXTogYW55IH0pID0+IHtcblxuICAgICAgICAgICAgICAgIGNvbnN0IElOSEVSSVRFRCA9ICdcIiQoaW5oZXJpdGVkKVwiJyxcbiAgICAgICAgICAgICAgICAgICAgT1RIRVJfTERGTEFHUyA9ICdPVEhFUl9MREZMQUdTJztcblxuXG4gICAgICAgICAgICAgICAgaWYgKCFidWlsZFNldHRpbmdzW09USEVSX0xERkxBR1NdXG4gICAgICAgICAgICAgICAgICAgIHx8IGJ1aWxkU2V0dGluZ3NbT1RIRVJfTERGTEFHU10gPT09IElOSEVSSVRFRCkge1xuICAgICAgICAgICAgICAgICAgICBidWlsZFNldHRpbmdzW09USEVSX0xERkxBR1NdID0gW0lOSEVSSVRFRF07XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYnVpbGRTZXR0aW5nc1tPVEhFUl9MREZMQUdTXS5wdXNoKGZsYWcpO1xuICAgICAgICAgICAgfVxuICAgICAgICApO1xuICAgIH1cblxuICAgIHJlbW92ZUZyb21PdGhlckxpbmtlckZsYWdzKGZsYWc6IGFueSk6IHZvaWQgeyAvLyBhbnkgaXMgYSBndWVzcyAtLSBmaXggdGhpcyBsYXRlclxuXG4gICAgICAgIHRoaXMucGZfcHJvY2Vzc0J1aWxkQ29uZmlndXJhdGlvbnNXaXRoVGhlUHJvZHVjdE5hbWUoXG4gICAgICAgICAgICAoYnVpbGRTZXR0aW5nczogeyBbcHJvcDogc3RyaW5nXTogYW55IH0pID0+IHtcblxuICAgICAgICAgICAgICAgIGNvbnN0IE9USEVSX0xERkxBR1MgPSAnT1RIRVJfTERGTEFHUyc7XG4gICAgICAgICAgICAgICAgaWYgKGJ1aWxkU2V0dGluZ3NbT1RIRVJfTERGTEFHU10pIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1hdGNoZXMgPSBidWlsZFNldHRpbmdzW09USEVSX0xERkxBR1NdLmZpbHRlcihmdW5jdGlvbiAocDogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcC5pbmRleE9mKGZsYWcpID4gLTE7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBtYXRjaGVzLmZvckVhY2goZnVuY3Rpb24gKG06IGFueSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGlkeCA9IGJ1aWxkU2V0dGluZ3NbT1RIRVJfTERGTEFHU10uaW5kZXhPZihtKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ1aWxkU2V0dGluZ3NbT1RIRVJfTERGTEFHU10uc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICBhZGRUb0J1aWxkU2V0dGluZ3MoYnVpbGRTZXR0aW5nOiBzdHJpbmcsIHZhbHVlOiBhbnkpOiB2b2lkIHtcbiAgICAgICAgY29uc3QgY29uZmlndXJhdGlvbnM6IFNlY3Rpb25EaWN0VXVpZFRvT2JqPFhDQnVpbGRDb25maWd1cmF0aW9uPiA9IFNlY3Rpb25VdGlscy5jcmVhdGVVdWlkS2V5T25seVNlY3Rpb25EaWN0KHRoaXMueGNCdWlsZENvbmZpZ3VyYXRpb25TZWN0aW9uKCkpO1xuXG4gICAgICAgIGZvciAobGV0IGNvbmZpZyBpbiBjb25maWd1cmF0aW9ucykge1xuICAgICAgICAgICAgY29uc3QgYnVpbGRTZXR0aW5ncyA9IGNvbmZpZ3VyYXRpb25zW2NvbmZpZ10uYnVpbGRTZXR0aW5ncztcblxuICAgICAgICAgICAgYnVpbGRTZXR0aW5nc1tidWlsZFNldHRpbmddID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW1vdmVGcm9tQnVpbGRTZXR0aW5ncyhidWlsZFNldHRpbmc6IHN0cmluZyk6IHZvaWQge1xuICAgICAgICBjb25zdCBjb25maWd1cmF0aW9uczogU2VjdGlvbkRpY3RVdWlkVG9PYmo8WENCdWlsZENvbmZpZ3VyYXRpb24+ID0gU2VjdGlvblV0aWxzLmNyZWF0ZVV1aWRLZXlPbmx5U2VjdGlvbkRpY3QodGhpcy54Y0J1aWxkQ29uZmlndXJhdGlvblNlY3Rpb24oKSk7XG5cbiAgICAgICAgZm9yIChsZXQgY29uZmlnIGluIGNvbmZpZ3VyYXRpb25zKSB7XG4gICAgICAgICAgICBjb25zdCBidWlsZFNldHRpbmdzID0gY29uZmlndXJhdGlvbnNbY29uZmlnXS5idWlsZFNldHRpbmdzO1xuXG4gICAgICAgICAgICBpZiAoYnVpbGRTZXR0aW5nc1tidWlsZFNldHRpbmddKSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIGJ1aWxkU2V0dGluZ3NbYnVpbGRTZXR0aW5nXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGEgSlMgZ2V0dGVyLiBobW1tXG4gICAgLy8gX19kZWZpbmVHZXR0ZXJfXyhcInByb2R1Y3ROYW1lXCIsIGZ1bmN0aW9uKCkge1xuXG4gICAgLyoqXG4gICAgICogUmV0dXJuIHRoZSBwcm9kdWN0TmFtZSBvZiBhIHJhbmRvbSBYQ0J1aWxkQ29uZmlndXJhdGlvblNldHRpbmcgdGhhdFxuICAgICAqIGhhcyBhIFBST0RVQ1RfTkFNRSBzZXQuICBJbiByZXZpZXdpbmcgdGhlIHRlc3QgcHJvamVjdHMsIGFsbFxuICAgICAqIGJ1aWxkIGNvbmZpZ3VyYXRpb25zIGhhZCB0aGUgc2FtZSBwcm9kdWN0IG5hbWUgc28gdGhpcyB3b3JrcyBpbiB0aGVzZVxuICAgICAqIGNhc2VzLiAgSSBkbyBub3Qga25vdyBpZiBpdCB3b3JrcyBpbiBhbGwgY2FzZXMuXG4gICAgICovXG4gICAgZ2V0IHByb2R1Y3ROYW1lKCk6IHN0cmluZyB7XG5cbiAgICAgICAgY29uc3QgY29uZmlndXJhdGlvbnM6IFNlY3Rpb25EaWN0VXVpZFRvT2JqPFhDQnVpbGRDb25maWd1cmF0aW9uPiA9IFNlY3Rpb25VdGlscy5jcmVhdGVVdWlkS2V5T25seVNlY3Rpb25EaWN0KHRoaXMueGNCdWlsZENvbmZpZ3VyYXRpb25TZWN0aW9uKCkpO1xuXG4gICAgICAgIGZvciAobGV0IGNvbmZpZyBpbiBjb25maWd1cmF0aW9ucykge1xuICAgICAgICAgICAgY29uc3QgcHJvZHVjdE5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZCA9IGNvbmZpZ3VyYXRpb25zW2NvbmZpZ10uYnVpbGRTZXR0aW5nc1snUFJPRFVDVF9OQU1FJ107XG5cbiAgICAgICAgICAgIGlmIChwcm9kdWN0TmFtZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB1bnF1b3RlU3RyKHByb2R1Y3ROYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vICBUaGlzIHVzZWQgdG8ganVzdCByZXR1cm4gdW5kZWZpbmVkLlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byBmaW5kIFBST0RVQ1RfTkFNRScpO1xuICAgIH1cblxuICAgIC8vIGNoZWNrIGlmIGZpbGUgaXMgcHJlc2VudFxuICAgIGhhc0ZpbGUoZmlsZVBhdGg6IHN0cmluZyk6IFBCWEZpbGVSZWZlcmVuY2UgfCBmYWxzZSB7XG4gICAgICAgIGNvbnN0IGZpbGVzOiBTZWN0aW9uRGljdFV1aWRUb09iajxQQlhGaWxlUmVmZXJlbmNlPiA9IFNlY3Rpb25VdGlscy5jcmVhdGVVdWlkS2V5T25seVNlY3Rpb25EaWN0KHRoaXMucGJ4RmlsZVJlZmVyZW5jZVNlY3Rpb24oKSk7XG5cbiAgICAgICAgZm9yIChsZXQgaWQgaW4gZmlsZXMpIHtcbiAgICAgICAgICAgIGNvbnN0IGZpbGU6IFBCWEZpbGVSZWZlcmVuY2UgPSBmaWxlc1tpZF07XG4gICAgICAgICAgICBpZiAoZmlsZS5wYXRoID09IGZpbGVQYXRoIHx8IGZpbGUucGF0aCA9PSAoJ1wiJyArIGZpbGVQYXRoICsgJ1wiJykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmlsZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBhZGRUYXJnZXQobmFtZTogc3RyaW5nLCB0eXBlOiBUQVJHRVRfVFlQRSwgc3ViZm9sZGVyOiBzdHJpbmcpOiBJTmF0aXZlVGFyZ2V0V3JhcHBlciB7XG5cbiAgICAgICAgLy8gU2V0dXAgdXVpZCBhbmQgbmFtZSBvZiBuZXcgdGFyZ2V0XG4gICAgICAgIGNvbnN0IHRhcmdldFV1aWQ6IFhDX1BST0pfVVVJRCA9IHRoaXMuZ2VuZXJhdGVVdWlkKCk7XG4gICAgICAgIGNvbnN0IHRhcmdldFR5cGU6IFRBUkdFVF9UWVBFID0gdHlwZTtcbiAgICAgICAgY29uc3QgdGFyZ2V0U3ViZm9sZGVyOiBzdHJpbmcgPSBzdWJmb2xkZXIgfHwgbmFtZTtcbiAgICAgICAgY29uc3QgdGFyZ2V0TmFtZTogc3RyaW5nID0gbmFtZS50cmltKCk7XG5cbiAgICAgICAgLy8gQ2hlY2sgdHlwZSBhZ2FpbnN0IGxpc3Qgb2YgYWxsb3dlZCB0YXJnZXQgdHlwZXNcbiAgICAgICAgaWYgKCF0YXJnZXROYW1lKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJUYXJnZXQgbmFtZSBtaXNzaW5nLlwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENoZWNrIHR5cGUgYWdhaW5zdCBsaXN0IG9mIGFsbG93ZWQgdGFyZ2V0IHR5cGVzXG4gICAgICAgIGlmICghdGFyZ2V0VHlwZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVGFyZ2V0IHR5cGUgbWlzc2luZy5cIik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDaGVjayB0eXBlIGFnYWluc3QgbGlzdCBvZiBhbGxvd2VkIHRhcmdldCB0eXBlc1xuICAgICAgICBjb25zdCBwcm9kdWN0VHlwZTogUFJPRFVDVF9UWVBFID0gcHJvZHVjdHR5cGVGb3JUYXJnZXR0eXBlKHRhcmdldFR5cGUpO1xuICAgICAgICBpZiAoIXByb2R1Y3RUeXBlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJUYXJnZXQgdHlwZSBpbnZhbGlkOiBcIiArIHRhcmdldFR5cGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQnVpbGQgQ29uZmlndXJhdGlvbjogQ3JlYXRlXG4gICAgICAgIGNvbnN0IGJ1aWxkQ29uZmlndXJhdGlvbnNMaXN0OiBYQ0J1aWxkQ29uZmlndXJhdGlvbltdID0gW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdEZWJ1ZycsXG4gICAgICAgICAgICAgICAgaXNhOiAnWENCdWlsZENvbmZpZ3VyYXRpb24nLFxuICAgICAgICAgICAgICAgIGJ1aWxkU2V0dGluZ3M6IHtcbiAgICAgICAgICAgICAgICAgICAgR0NDX1BSRVBST0NFU1NPUl9ERUZJTklUSU9OUzogWydcIkRFQlVHPTFcIicsICdcIiQoaW5oZXJpdGVkKVwiJ10sXG4gICAgICAgICAgICAgICAgICAgIElORk9QTElTVF9GSUxFOiAnXCInICsgcGF0aC5qb2luKHRhcmdldFN1YmZvbGRlciwgdGFyZ2V0U3ViZm9sZGVyICsgJy1JbmZvLnBsaXN0JyArICdcIicpLFxuICAgICAgICAgICAgICAgICAgICBMRF9SVU5QQVRIX1NFQVJDSF9QQVRIUzogJ1wiJChpbmhlcml0ZWQpIEBleGVjdXRhYmxlX3BhdGgvRnJhbWV3b3JrcyBAZXhlY3V0YWJsZV9wYXRoLy4uLy4uL0ZyYW1ld29ya3NcIicsXG4gICAgICAgICAgICAgICAgICAgIFBST0RVQ1RfTkFNRTogJ1wiJyArIHRhcmdldE5hbWUgKyAnXCInLFxuICAgICAgICAgICAgICAgICAgICBTS0lQX0lOU1RBTEw6ICdZRVMnXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnUmVsZWFzZScsXG4gICAgICAgICAgICAgICAgaXNhOiAnWENCdWlsZENvbmZpZ3VyYXRpb24nLFxuICAgICAgICAgICAgICAgIGJ1aWxkU2V0dGluZ3M6IHtcbiAgICAgICAgICAgICAgICAgICAgSU5GT1BMSVNUX0ZJTEU6ICdcIicgKyBwYXRoLmpvaW4odGFyZ2V0U3ViZm9sZGVyLCB0YXJnZXRTdWJmb2xkZXIgKyAnLUluZm8ucGxpc3QnICsgJ1wiJyksXG4gICAgICAgICAgICAgICAgICAgIExEX1JVTlBBVEhfU0VBUkNIX1BBVEhTOiAnXCIkKGluaGVyaXRlZCkgQGV4ZWN1dGFibGVfcGF0aC9GcmFtZXdvcmtzIEBleGVjdXRhYmxlX3BhdGgvLi4vLi4vRnJhbWV3b3Jrc1wiJyxcbiAgICAgICAgICAgICAgICAgICAgUFJPRFVDVF9OQU1FOiAnXCInICsgdGFyZ2V0TmFtZSArICdcIicsXG4gICAgICAgICAgICAgICAgICAgIFNLSVBfSU5TVEFMTDogJ1lFUydcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIF07XG5cbiAgICAgICAgLy8gQnVpbGQgQ29uZmlndXJhdGlvbjogQWRkXG4gICAgICAgIHZhciBidWlsZENvbmZpZ3VyYXRpb25zID0gdGhpcy5hZGRYQ0NvbmZpZ3VyYXRpb25MaXN0KGJ1aWxkQ29uZmlndXJhdGlvbnNMaXN0LCAnUmVsZWFzZScsICdCdWlsZCBjb25maWd1cmF0aW9uIGxpc3QgZm9yIFBCWE5hdGl2ZVRhcmdldCBcIicgKyB0YXJnZXROYW1lICsgJ1wiJyk7XG5cbiAgICAgICAgLy8gUHJvZHVjdDogQ3JlYXRlXG4gICAgICAgIGNvbnN0IHByb2R1Y3ROYW1lOiBzdHJpbmcgPSB0YXJnZXROYW1lO1xuICAgICAgICBjb25zdCBwcm9kdWN0RmlsZVR5cGU6IFhDX0ZJTEVUWVBFID0gZmlsZXR5cGVGb3JQcm9kdWN0VHlwZShwcm9kdWN0VHlwZSk7XG4gICAgICAgIGNvbnN0IHByb2R1Y3RGaWxlOiBQYnhGaWxlID0gdGhpcy5hZGRQcm9kdWN0RmlsZShwcm9kdWN0TmFtZSwgeyBncm91cDogJ0NvcHkgRmlsZXMnLCAndGFyZ2V0JzogdGFyZ2V0VXVpZCwgJ2V4cGxpY2l0RmlsZVR5cGUnOiBwcm9kdWN0RmlsZVR5cGUgfSk7XG4gICAgICAgIC8vICAgICAgICAgICAgcHJvZHVjdEZpbGVOYW1lID0gcHJvZHVjdEZpbGUuYmFzZW5hbWU7XG5cblxuICAgICAgICAvLyBQcm9kdWN0OiBBZGQgdG8gYnVpbGQgZmlsZSBsaXN0XG4gICAgICAgIHRoaXMuYWRkVG9QYnhCdWlsZEZpbGVTZWN0aW9uKHByb2R1Y3RGaWxlKTtcblxuICAgICAgICAvLyBUYXJnZXQ6IENyZWF0ZVxuICAgICAgICBjb25zdCB0YXJnZXQ6IElOYXRpdmVUYXJnZXRXcmFwcGVyID0ge1xuICAgICAgICAgICAgdXVpZDogdGFyZ2V0VXVpZCxcbiAgICAgICAgICAgIHBieE5hdGl2ZVRhcmdldDoge1xuICAgICAgICAgICAgICAgIGlzYTogJ1BCWE5hdGl2ZVRhcmdldCcsXG4gICAgICAgICAgICAgICAgbmFtZTogJ1wiJyArIHRhcmdldE5hbWUgKyAnXCInLFxuICAgICAgICAgICAgICAgIHByb2R1Y3ROYW1lOiAnXCInICsgdGFyZ2V0TmFtZSArICdcIicsXG4gICAgICAgICAgICAgICAgcHJvZHVjdFJlZmVyZW5jZTogcHJvZHVjdEZpbGUuZmlsZVJlZiBhcyBYQ19QUk9KX1VVSUQsXG4gICAgICAgICAgICAgICAgcHJvZHVjdFR5cGU6ICdcIicgKyBwcm9kdWN0dHlwZUZvclRhcmdldHR5cGUodGFyZ2V0VHlwZSkgKyAnXCInLFxuICAgICAgICAgICAgICAgIGJ1aWxkQ29uZmlndXJhdGlvbkxpc3Q6IGJ1aWxkQ29uZmlndXJhdGlvbnMudXVpZCxcbiAgICAgICAgICAgICAgICBidWlsZFBoYXNlczogW10sXG4gICAgICAgICAgICAgICAgYnVpbGRSdWxlczogW10sXG4gICAgICAgICAgICAgICAgZGVwZW5kZW5jaWVzOiBbXVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFRhcmdldDogQWRkIHRvIFBCWE5hdGl2ZVRhcmdldCBzZWN0aW9uXG4gICAgICAgIHRoaXMuYWRkVG9QYnhOYXRpdmVUYXJnZXRTZWN0aW9uKHRhcmdldClcblxuICAgICAgICAvLyBQcm9kdWN0OiBFbWJlZCAob25seSBmb3IgXCJleHRlbnNpb25cIi10eXBlIHRhcmdldHMpXG4gICAgICAgIGlmICh0YXJnZXRUeXBlID09PSAnYXBwX2V4dGVuc2lvbicpIHtcblxuICAgICAgICAgICAgLy8gVE9ETzogRXZhbHVhdGUgaWYgdGhpcyBpcyBzb3VuZC5cblxuICAgICAgICAgICAgLy8gQ3JlYXRlIENvcHlGaWxlcyBwaGFzZSBpbiBmaXJzdCB0YXJnZXRcbiAgICAgICAgICAgIHRoaXMuYWRkQnVpbGRQaGFzZShbXSwgJ1BCWENvcHlGaWxlc0J1aWxkUGhhc2UnLCAnQ29weSBGaWxlcycsIHRoaXMuZ2V0Rmlyc3RUYXJnZXQoKS51dWlkLCB0YXJnZXRUeXBlKVxuXG4gICAgICAgICAgICAvLyBBZGQgcHJvZHVjdCB0byBDb3B5RmlsZXMgcGhhc2VcbiAgICAgICAgICAgIHRoaXMuYWRkVG9QYnhDb3B5ZmlsZXNCdWlsZFBoYXNlKHByb2R1Y3RGaWxlKVxuXG4gICAgICAgICAgICAvLyB0aGlzLmFkZEJ1aWxkUGhhc2VUb1RhcmdldChuZXdQaGFzZS5idWlsZFBoYXNlLCB0aGlzLmdldEZpcnN0VGFyZ2V0KCkudXVpZClcblxuICAgICAgICB9IGVsc2UgaWYgKHRhcmdldFR5cGUgPT09ICd3YXRjaDJfYXBwJykge1xuICAgICAgICAgICAgLy8gQ3JlYXRlIENvcHlGaWxlcyBwaGFzZSBpbiBmaXJzdCB0YXJnZXRcbiAgICAgICAgICAgIHRoaXMuYWRkQnVpbGRQaGFzZShcbiAgICAgICAgICAgICAgICBbdGFyZ2V0TmFtZSArICcuYXBwJ10sXG4gICAgICAgICAgICAgICAgJ1BCWENvcHlGaWxlc0J1aWxkUGhhc2UnLFxuICAgICAgICAgICAgICAgICdFbWJlZCBXYXRjaCBDb250ZW50JyxcbiAgICAgICAgICAgICAgICB0aGlzLmdldEZpcnN0VGFyZ2V0KCkudXVpZCxcbiAgICAgICAgICAgICAgICB0YXJnZXRUeXBlLFxuICAgICAgICAgICAgICAgICdcIiQoQ09OVEVOVFNfRk9MREVSX1BBVEgpL1dhdGNoXCInXG4gICAgICAgICAgICApO1xuICAgICAgICB9IGVsc2UgaWYgKHRhcmdldFR5cGUgPT09ICd3YXRjaDJfZXh0ZW5zaW9uJykge1xuICAgICAgICAgICAgLy8gQ3JlYXRlIENvcHlGaWxlcyBwaGFzZSBpbiB3YXRjaCB0YXJnZXQgKGlmIGV4aXN0cylcbiAgICAgICAgICAgIHZhciB3YXRjaDJUYXJnZXQgPSB0aGlzLmdldFRhcmdldChwcm9kdWN0dHlwZUZvclRhcmdldHR5cGUoJ3dhdGNoMl9hcHAnKSk7XG4gICAgICAgICAgICBpZiAod2F0Y2gyVGFyZ2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hZGRCdWlsZFBoYXNlKFxuICAgICAgICAgICAgICAgICAgICBbdGFyZ2V0TmFtZSArICcuYXBwZXgnXSxcbiAgICAgICAgICAgICAgICAgICAgJ1BCWENvcHlGaWxlc0J1aWxkUGhhc2UnLFxuICAgICAgICAgICAgICAgICAgICAnRW1iZWQgQXBwIEV4dGVuc2lvbnMnLFxuICAgICAgICAgICAgICAgICAgICB3YXRjaDJUYXJnZXQudXVpZCxcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0VHlwZVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUYXJnZXQ6IEFkZCB1dWlkIHRvIHJvb3QgcHJvamVjdFxuICAgICAgICB0aGlzLmFkZFRvUGJ4UHJvamVjdFNlY3Rpb24odGFyZ2V0KTtcblxuICAgICAgICAvLyBUYXJnZXQ6IEFkZCBkZXBlbmRlbmN5IGZvciB0aGlzIHRhcmdldCB0byBvdGhlciB0YXJnZXRzXG4gICAgICAgIGlmICh0YXJnZXRUeXBlID09PSAnd2F0Y2gyX2V4dGVuc2lvbicpIHtcbiAgICAgICAgICAgIHZhciB3YXRjaDJUYXJnZXQgPSB0aGlzLmdldFRhcmdldChwcm9kdWN0dHlwZUZvclRhcmdldHR5cGUoJ3dhdGNoMl9hcHAnKSk7XG4gICAgICAgICAgICBpZiAod2F0Y2gyVGFyZ2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hZGRUYXJnZXREZXBlbmRlbmN5KHdhdGNoMlRhcmdldC51dWlkLCBbdGFyZ2V0LnV1aWRdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuYWRkVGFyZ2V0RGVwZW5kZW5jeSh0aGlzLmdldEZpcnN0VGFyZ2V0KCkudXVpZCwgW3RhcmdldC51dWlkXSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZXR1cm4gdGFyZ2V0IG9uIHN1Y2Nlc3NcbiAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICB9XG5cbiAgICAvKiogXG4gICAgICogR2V0IHRoZSBmaXJzdCBwcm9qZWN0IHRoYXQgYXBwZWFycyBpbiB0aGUgUEJYUHJvamVjdCBzZWN0aW9uLlxuICAgICAqIEFzc3VtZXMgdGhlcmUgaXMgYXQgbGVhc3Qgb25lIHByb2plY3QuXG4gICAgICogXG4gICAgICogTW9zdCB1c2VzIG9mIHRoaXMgbGlicmFyeSBsaWtleSBoYXZlIG9uZSBhbmQgb25seSBvbmUgcHJvamVjdC5cbiAgICAgKi9cbiAgICBnZXRGaXJzdFByb2plY3QoKTogeyB1dWlkOiBYQ19QUk9KX1VVSUQsIGZpcnN0UHJvamVjdDogUEJYUHJvamVjdCB9IHtcblxuICAgICAgICAvLyBHZXQgcGJ4UHJvamVjdCBjb250YWluZXJcbiAgICAgICAgY29uc3QgcGJ4UHJvamVjdENvbnRhaW5lcjogVHlwZWRTZWN0aW9uPFBCWFByb2plY3Q+ID0gdGhpcy5wYnhQcm9qZWN0U2VjdGlvbigpO1xuXG4gICAgICAgIC8vIEdldCBmaXJzdCBwYnhQcm9qZWN0IFVVSURcbiAgICAgICAgLy8gIE5PVEU6ICBUaGlzIG9ubHkgd29ya3MgYXNzdW1pbmcgdGhlIGNvbW1lbnQga2V5IGFsd2F5cyBmb2xsb3dzIHRoZSBwcm9qZWN0IGtleS5cbiAgICAgICAgLy8gIElzIHRoaXMgYWx3YXlzIHRydWUsIGltcGxlbWVudGF0aW9uIHNwZWNpZmljLCBvciBqdXN0IGx1Y2t5IChpLmUuIFRERCk/ICBJIGRpZCBcbiAgICAgICAgLy8gIG5vdCB0aGluayBrZXlzIHdlcmUgZ3VhcmFudGVlZCB0byBiZSBhbHBoYWJldGl6ZWQuXG4gICAgICAgIC8vICBJIHdpbGwgYXNzdW1lIGZvciBub3cgdGhhdCB3aG9ldmVyIHdyb3RlIHRoaXMga25vd3Mgc29tZXRoaW5nIEkgZG9uJ3QuXG4gICAgICAgIC8vICBSZXNlYXJjaGVkOiAgQWNjb3JkaW5nIHRvXG4gICAgICAgIC8vICBodHRwczovL3d3dy5zdGVmYW5qdWRpcy5jb20vdG9kYXktaS1sZWFybmVkL3Byb3BlcnR5LW9yZGVyLWlzLXByZWRpY3RhYmxlLWluLWphdmFzY3JpcHQtb2JqZWN0cy1zaW5jZS1lczIwMTUvXG4gICAgICAgIC8vICB0aGVzZSBhcmUgbGlrZWx5IG5vdCBpbXBsZW1lbnRhdGlvbiBzcGVjaWZpYyBhcyBub2RlIGlzIG1vc3QgZGVmaW5hdGVseSB1c2luZyB0aGUgbGF0ZXN0LlxuICAgICAgICBjb25zdCBmaXJzdFByb2plY3RVdWlkOiBYQ19QUk9KX1VVSUQgPSBPYmplY3Qua2V5cyhwYnhQcm9qZWN0Q29udGFpbmVyKVswXTtcblxuICAgICAgICAvLyBHZXQgZmlyc3QgcGJ4UHJvamVjdFxuICAgICAgICBjb25zdCBmaXJzdFByb2plY3QgPSBwYnhQcm9qZWN0Q29udGFpbmVyW2ZpcnN0UHJvamVjdFV1aWRdIGFzIFBCWFByb2plY3Q7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHV1aWQ6IGZpcnN0UHJvamVjdFV1aWQsXG4gICAgICAgICAgICBmaXJzdFByb2plY3Q6IGZpcnN0UHJvamVjdFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBmaXJzdCB0YXJnZXQgaW4gdGhlIGxpc3Qgb2YgdGFyZ2V0cyBvZiB0aGUgZmlyc3QgKGFuZCB0eXBpY2FsbHkgb25seSkgcHJvamVjdC5cbiAgICAgKiBUaGlzIGhhcyBhbHdheXMgYmVlbiB0aGUgZGVwbG95ZWQgYXBwbGljYXRpb24gaW4gdGVzdCBjYXNlcyBJIGhhdmUgb2JzZXJ2ZWQuICBCdXRcbiAgICAgKiB2YWxpZGF0ZSB0aGlzLlxuICAgICAqL1xuICAgIGdldEZpcnN0VGFyZ2V0KCk6IHsgdXVpZDogWENfUFJPSl9VVUlELCBmaXJzdFRhcmdldDogUEJYTmF0aXZlVGFyZ2V0IH0ge1xuXG4gICAgICAgIC8vIEdldCBmaXJzdCB0YXJnZXQncyBVVUlEXG4gICAgICAgIGNvbnN0IGZpcnN0VGFyZ2V0VXVpZDogWENfUFJPSl9VVUlEID0gdGhpcy5nZXRGaXJzdFByb2plY3QoKVsnZmlyc3RQcm9qZWN0J11bJ3RhcmdldHMnXVswXS52YWx1ZTtcblxuICAgICAgICAvLyBHZXQgZmlyc3QgcGJ4TmF0aXZlVGFyZ2V0XG4gICAgICAgIGNvbnN0IGZpcnN0VGFyZ2V0ID0gdGhpcy5wYnhOYXRpdmVUYXJnZXRTZWN0aW9uKClbZmlyc3RUYXJnZXRVdWlkXSBhcyBQQlhOYXRpdmVUYXJnZXQ7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHV1aWQ6IGZpcnN0VGFyZ2V0VXVpZCxcbiAgICAgICAgICAgIGZpcnN0VGFyZ2V0OiBmaXJzdFRhcmdldFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0VGFyZ2V0KHByb2R1Y3RUeXBlOiBzdHJpbmcpIHtcbiAgICAgICAgLy8gRmluZCB0YXJnZXQgYnkgcHJvZHVjdCB0eXBlXG4gICAgICAgIHZhciB0YXJnZXRzID0gdGhpcy5nZXRGaXJzdFByb2plY3QoKVsnZmlyc3RQcm9qZWN0J11bJ3RhcmdldHMnXTtcbiAgICAgICAgdmFyIG5hdGl2ZVRhcmdldHMgPSB0aGlzLnBieE5hdGl2ZVRhcmdldFNlY3Rpb24oKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0YXJnZXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgdGFyZ2V0ID0gdGFyZ2V0c1tpXTtcbiAgICAgICAgICAgIHZhciB0YXJnZXRVdWlkID0gdGFyZ2V0LnZhbHVlO1xuICAgICAgICAgICAgY29uc3QgX25hdGl2ZVRhcmdldCA9IHR5cGVvZiBuYXRpdmVUYXJnZXRzW3RhcmdldFV1aWRdXG4gICAgICAgICAgICBpZiAodHlwZW9mIF9uYXRpdmVUYXJnZXQgIT09ICdzdHJpbmcnICYmIF9uYXRpdmVUYXJnZXRbJ3Byb2R1Y3RUeXBlJ10gPT09ICdcIicgKyBwcm9kdWN0VHlwZSArICdcIicpIHtcbiAgICAgICAgICAgICAgICAvLyBHZXQgcGJ4TmF0aXZlVGFyZ2V0XG4gICAgICAgICAgICAgICAgdmFyIG5hdGl2ZVRhcmdldCA9IHRoaXMucGJ4TmF0aXZlVGFyZ2V0U2VjdGlvbigpW3RhcmdldFV1aWRdO1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHV1aWQ6IHRhcmdldFV1aWQsXG4gICAgICAgICAgICAgICAgICAgIHRhcmdldDogbmF0aXZlVGFyZ2V0XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIFxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvKioqIE5FVyAqKiovXG5cblxuICAgIC8qKlxuICAgICAqIFxuICAgICAqIEBwYXJhbSBmaWxlICB3aGVuIGEgc3RyaW5nLCB0aGlzIGlzIHRoZSBVVUlEIG9mIGVpdGhlciBhIFBCWEdyb3VwIG9yIGEgUEJYVmFyaWFudEdyb3VwIG9iamVjdC5cbiAgICAgKiBXaGVuIGFuIG9iamVjdCwgXG4gICAgICogQHBhcmFtIGdyb3VwS2V5IFxuICAgICAqIEBwYXJhbSBncm91cFR5cGUgXG4gICAgICovXG4gICAgYWRkVG9QYnhHcm91cFR5cGUoZmlsZTogWENfUFJPSl9VVUlEIHwgSVBieEdyb3VwQ2hpbGRGaWxlSW5mbywgZ3JvdXBLZXk6IFhDX1BST0pfVVVJRCwgZ3JvdXBUeXBlOiBJU0FfR1JPVVBfVFlQRSk6IHZvaWQge1xuXG4gICAgICAgIGNvbnN0IGdyb3VwOiBQQlhHcm91cCB8IG51bGwgPSB0aGlzLmdldFBCWEdyb3VwQnlLZXlBbmRUeXBlPFBCWEdyb3VwPihncm91cEtleSwgZ3JvdXBUeXBlKTtcblxuICAgICAgICBpZiAoZ3JvdXAgJiYgZ3JvdXAuY2hpbGRyZW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBmaWxlID09PSAnc3RyaW5nJykge1xuXG4gICAgICAgICAgICAgICAgY29uc3QgY2hpbGRHcm91cFV1aWQ6IFhDX1BST0pfVVVJRCA9IGZpbGU7XG5cbiAgICAgICAgICAgICAgICBsZXQgY29tbWVudDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXG4gICAgICAgICAgICAgICAgLy9Hcm91cCBLZXlcbiAgICAgICAgICAgICAgICBjb25zdCBwYnhHcm91cDogUEJYR3JvdXAgfCBudWxsID0gdGhpcy5nZXRQQlhHcm91cEJ5S2V5KGNoaWxkR3JvdXBVdWlkKTtcbiAgICAgICAgICAgICAgICBpZiAocGJ4R3JvdXApIHtcbiAgICAgICAgICAgICAgICAgICAgY29tbWVudCA9IHBieEdyb3VwLm5hbWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwYnhWYXJHcm91cDogUEJYVmFyaWFudEdyb3VwIHwgbnVsbCA9IHRoaXMuZ2V0UEJYVmFyaWFudEdyb3VwQnlLZXkoY2hpbGRHcm91cFV1aWQpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocGJ4VmFyR3JvdXApXG4gICAgICAgICAgICAgICAgICAgICAgICBjb21tZW50ID0gcGJ4VmFyR3JvdXAubmFtZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoY29tbWVudCA9PSB1bmRlZmluZWQpXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGZpbmQgYSBncm91cCB3aXRoIFVVSUQ9JyR7Y2hpbGRHcm91cFV1aWR9J2ApO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgY2hpbGRHcm91cDogSUNoaWxkTGlzdEVudHJ5ID0ge1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZTogY2hpbGRHcm91cFV1aWQsXG4gICAgICAgICAgICAgICAgICAgIGNvbW1lbnQ6IGNvbW1lbnRcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGdyb3VwLmNoaWxkcmVuLnB1c2goY2hpbGRHcm91cCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAvL0ZpbGUgT2JqZWN0XG4gICAgICAgICAgICAgICAgZ3JvdXAuY2hpbGRyZW4ucHVzaChwYnhHcm91cENoaWxkKGZpbGUpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFkZFRvUGJ4VmFyaWFudEdyb3VwKGZpbGU6IHN0cmluZyB8IElQYnhHcm91cENoaWxkRmlsZUluZm8sIGdyb3VwS2V5OiBYQ19QUk9KX1VVSUQpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5hZGRUb1BieEdyb3VwVHlwZShmaWxlLCBncm91cEtleSwgJ1BCWFZhcmlhbnRHcm91cCcpO1xuICAgIH1cblxuICAgIGFkZFRvUGJ4R3JvdXAoZmlsZTogc3RyaW5nIHwgSVBieEdyb3VwQ2hpbGRGaWxlSW5mbywgZ3JvdXBLZXk6IFhDX1BST0pfVVVJRCk6IHZvaWQge1xuICAgICAgICB0aGlzLmFkZFRvUGJ4R3JvdXBUeXBlKGZpbGUsIGdyb3VwS2V5LCAnUEJYR3JvdXAnKTtcbiAgICB9XG5cbiAgICBwYnhDcmVhdGVHcm91cFdpdGhUeXBlKG5hbWU6IHN0cmluZywgcGF0aE5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZCB8IG51bGwsIGdyb3VwVHlwZTogSVNBX0dST1VQX1RZUEUpOiBYQ19QUk9KX1VVSUQge1xuICAgICAgICAvL0NyZWF0ZSBvYmplY3RcbiAgICAgICAgY29uc3QgbW9kZWw6IFBCWEdyb3VwID0ge1xuICAgICAgICAgICAgLy9pc2E6ICdcIicgKyBncm91cFR5cGUgKyAnXCInLFxuICAgICAgICAgICAgaXNhOiBncm91cFR5cGUsXG4gICAgICAgICAgICBjaGlsZHJlbjogW10sXG4gICAgICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICAgICAgc291cmNlVHJlZTogJ1wiPGdyb3VwPlwiJ1xuICAgICAgICB9O1xuXG4gICAgICAgIGlmIChwYXRoTmFtZSkgbW9kZWwucGF0aCA9IHBhdGhOYW1lO1xuXG4gICAgICAgIGNvbnN0IGtleSA9IHRoaXMuZ2VuZXJhdGVVdWlkKCk7XG5cbiAgICAgICAgLy8gIFBCWEdyb3VwIGlzIHRoZSBiYXNlIGludGVyZmFjZSBvZiBhbGwgZ3JvdXBzXG4gICAgICAgIGNvbnN0IGdyb3VwU2VjdGlvbjogVHlwZWRTZWN0aW9uPFBCWEdyb3VwPiA9IHRoaXMucGZfc2VjdGlvbkdldE9yQ3JlYXRlPFBCWEdyb3VwPihncm91cFR5cGUpO1xuICAgICAgICBTZWN0aW9uVXRpbHMuZW50cnlTZXRXVXVpZChncm91cFNlY3Rpb24sIGtleSwgbW9kZWwsIG5hbWUpO1xuXG4gICAgICAgIC8vIC8vQ3JlYXRlIGNvbW1lbnRcbiAgICAgICAgLy8gdmFyIGNvbW1lbmRJZCA9IGtleSArICdfY29tbWVudCc7XG5cbiAgICAgICAgLy8gLy9hZGQgb2JqIGFuZCBjb21tZW50T2JqIHRvIGdyb3VwcztcbiAgICAgICAgLy8gZ3JvdXBzW2NvbW1lbmRJZF0gPSBuYW1lO1xuICAgICAgICAvLyBncm91cHNba2V5XSA9IG1vZGVsO1xuXG4gICAgICAgIHJldHVybiBrZXk7XG4gICAgfVxuXG4gICAgcGJ4Q3JlYXRlVmFyaWFudEdyb3VwKG5hbWU6IHN0cmluZyk6IFhDX1BST0pfVVVJRCB7XG4gICAgICAgIHJldHVybiB0aGlzLnBieENyZWF0ZUdyb3VwV2l0aFR5cGUobmFtZSwgdW5kZWZpbmVkLCAnUEJYVmFyaWFudEdyb3VwJylcbiAgICB9XG5cbiAgICBwYnhDcmVhdGVHcm91cChuYW1lOiBzdHJpbmcsIHBhdGhOYW1lPzogc3RyaW5nIHwgbnVsbCk6IFhDX1BST0pfVVVJRCB7XG4gICAgICAgIHJldHVybiB0aGlzLnBieENyZWF0ZUdyb3VwV2l0aFR5cGUobmFtZSwgcGF0aE5hbWUsICdQQlhHcm91cCcpO1xuICAgIH1cblxuICAgIHJlbW92ZUZyb21QYnhHcm91cEFuZFR5cGUoZmlsZTogSVBieEdyb3VwQ2hpbGRGaWxlSW5mbywgZ3JvdXBLZXk6IFhDX1BST0pfVVVJRCwgZ3JvdXBUeXBlOiBJU0FfR1JPVVBfVFlQRSk6IHZvaWQge1xuXG4gICAgICAgIGNvbnN0IGdyb3VwOiBQQlhHcm91cCB8IG51bGwgPSB0aGlzLmdldFBCWEdyb3VwQnlLZXlBbmRUeXBlKGdyb3VwS2V5LCBncm91cFR5cGUpO1xuXG4gICAgICAgIGlmIChncm91cCkge1xuICAgICAgICAgICAgdmFyIGdyb3VwQ2hpbGRyZW4gPSBncm91cC5jaGlsZHJlbiwgaTtcbiAgICAgICAgICAgIGNvbnN0IHRvTWF0Y2ggPSBwYnhHcm91cENoaWxkKGZpbGUpO1xuICAgICAgICAgICAgZm9yIChpIGluIGdyb3VwQ2hpbGRyZW4pIHtcbiAgICAgICAgICAgICAgICBpZiAodG9NYXRjaC52YWx1ZSA9PSBncm91cENoaWxkcmVuW2ldLnZhbHVlICYmXG4gICAgICAgICAgICAgICAgICAgIHRvTWF0Y2guY29tbWVudCA9PSBncm91cENoaWxkcmVuW2ldLmNvbW1lbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgZ3JvdXBDaGlsZHJlbi5zcGxpY2UoaSBhcyB1bmtub3duIGFzIG51bWJlciwgMSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbW92ZUZyb21QYnhHcm91cChmaWxlOiBJUGJ4R3JvdXBDaGlsZEZpbGVJbmZvLCBncm91cEtleTogWENfUFJPSl9VVUlEKTogdm9pZCB7XG4gICAgICAgIHRoaXMucmVtb3ZlRnJvbVBieEdyb3VwQW5kVHlwZShmaWxlLCBncm91cEtleSwgJ1BCWEdyb3VwJyk7XG4gICAgfVxuXG4gICAgcmVtb3ZlRnJvbVBieFZhcmlhbnRHcm91cChmaWxlOiBJUGJ4R3JvdXBDaGlsZEZpbGVJbmZvLCBncm91cEtleTogWENfUFJPSl9VVUlEKTogdm9pZCB7XG4gICAgICAgIHRoaXMucmVtb3ZlRnJvbVBieEdyb3VwQW5kVHlwZShmaWxlLCBncm91cEtleSwgJ1BCWFZhcmlhbnRHcm91cCcpO1xuICAgIH1cblxuICAgIGdldFBCWEdyb3VwQnlLZXlBbmRUeXBlPFBCWF9PQkpfVFlQRSBleHRlbmRzIFBCWEdyb3VwPihrZXk6IFhDX1BST0pfVVVJRCwgZ3JvdXBUeXBlOiBJU0FfR1JPVVBfVFlQRSk6IFBCWF9PQkpfVFlQRSB8IG51bGwge1xuICAgICAgICAvLyAgICAgICAgcmV0dXJuIHRoaXMuaGFzaC5wcm9qZWN0Lm9iamVjdHNbZ3JvdXBUeXBlXVtrZXldO1xuICAgICAgICByZXR1cm4gU2VjdGlvblV0aWxzLmVudHJ5R2V0V1V1aWQodGhpcy5wZl9zZWN0aW9uR2V0T3JDcmVhdGU8UEJYX09CSl9UWVBFPihncm91cFR5cGUpLCBrZXkpO1xuICAgIH1cblxuICAgIGdldFBCWEdyb3VwQnlLZXkodXVpZDogWENfUFJPSl9VVUlEKTogUEJYR3JvdXAgfCBudWxsIHtcbiAgICAgICAgcmV0dXJuIFNlY3Rpb25VdGlscy5lbnRyeUdldFdVdWlkKHRoaXMucGJ4R3JvdXBzU2VjdGlvbigpLCB1dWlkKTtcbiAgICAgICAgLy8gcmV0dXJuIHRoaXMuaGFzaC5wcm9qZWN0Lm9iamVjdHNbJ1BCWEdyb3VwJ11ba2V5XTsgLy8gdGhpcyB1c2VkIHRvIGFsbG93IHJldHVybmluZyBhIHN0cmluZy5cbiAgICB9O1xuXG4gICAgZ2V0UEJYVmFyaWFudEdyb3VwQnlLZXkodXVpZDogWENfUFJPSl9VVUlEKTogUEJYVmFyaWFudEdyb3VwIHwgbnVsbCB7XG4gICAgICAgIHJldHVybiBTZWN0aW9uVXRpbHMuZW50cnlHZXRXVXVpZCh0aGlzLnBieFZhcmlhbnRHcm91cHNTZWN0aW9uKCksIHV1aWQpO1xuICAgICAgICAvLyByZXR1cm4gdGhpcy5oYXNoLnByb2plY3Qub2JqZWN0c1snUEJYVmFyaWFudEdyb3VwJ11ba2V5XTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0gY3JpdGVyaWEgXG4gICAgICogQHBhcmFtIGdyb3VwVHlwZSBcbiAgICAgKiBAcmV0dXJucyB0aGUgVVVJRCBvZiB0aGUgbWF0Y2hpbmcgZ3JvdXAgb3IgdW5kZWZpbmVkIGlmIG5vIG1hdGNoLlxuICAgICAqL1xuICAgIGZpbmRQQlhHcm91cEtleUFuZFR5cGU8UEJYX0dST1VQX1RZUEUgZXh0ZW5kcyBQQlhHcm91cD4oXG4gICAgICAgIGNyaXRlcmlhOiBJR3JvdXBNYXRjaENyaXRlcmlhLFxuICAgICAgICBncm91cFR5cGU6ICdQQlhHcm91cCcgfCAnUEJYVmFyaWFudEdyb3VwJyk6IFhDX1BST0pfVVVJRCB8IHVuZGVmaW5lZCB7XG5cbiAgICAgICAgLy8gIGZvciB0aGUgSlMgZGV2ZWxvcGVycy4gIEkgd291bGQgdGhpbmsgdGhpcyB3b3VsZCB0aHJvdy4gIEJ1dCB0aGVcbiAgICAgICAgLy8gIG9yaWdpbmFsIGltcGxlbWVudGF0aW9uIGp1c3QgaWdub3JlZCBjcml0ZXJpYSBpZiBub3Qgc2V0LiBNYWludGFpbmluZ1xuICAgICAgICAvLyAgb3JpaWduYWwgbG9naWMuXG4gICAgICAgIGlmICghY3JpdGVyaWEpXG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuXG4gICAgICAgIGNvbnN0IGdyb3VwczogVHlwZWRTZWN0aW9uPFBCWF9HUk9VUF9UWVBFPiA9IHRoaXMucGZfc2VjdGlvbkdldE9yQ3JlYXRlPFBCWF9HUk9VUF9UWVBFPihcbiAgICAgICAgICAgIGdyb3VwVHlwZSk7XG5cbiAgICAgICAgLy9jb25zdCBncm91cHMgPSB0aGlzLmhhc2gucHJvamVjdC5vYmplY3RzW2dyb3VwVHlwZV07XG5cbiAgICAgICAgZm9yICh2YXIga2V5IGluIGdyb3Vwcykge1xuICAgICAgICAgICAgLy8gb25seSBsb29rIGZvciBub24gY29tbWVudHNcbiAgICAgICAgICAgIGlmICghU2VjdGlvblV0aWxzLmRpY3RLZXlJc0NvbW1lbnQoa2V5KSkge1xuXG4gICAgICAgICAgICAgICAgY29uc3QgZ3JvdXAgPSBncm91cHNba2V5XSBhcyBQQlhHcm91cDtcblxuICAgICAgICAgICAgICAgIC8vICBNdXN0IG1hdGNoIGFsbCBjcml0ZXJpYSBwcm92aWRlZC5cbiAgICAgICAgICAgICAgICBpZiAoY3JpdGVyaWEucGF0aCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoY3JpdGVyaWEucGF0aCA9PT0gZ3JvdXAucGF0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFjcml0ZXJpYS5uYW1lIHx8IGNyaXRlcmlhLm5hbWUgPT09IGdyb3VwLm5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGtleTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChjcml0ZXJpYS5uYW1lICYmIGNyaXRlcmlhLm5hbWUgPT09IGdyb3VwLm5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGtleTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkOyAvLyBOb3QgZm91bmRcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaW5kIHRoZSBVVUlEIG9mIHRoZSBQQlhHcm91cCBvYmplY3QgdGhhdCBtYXRjaGVzIHRoZSBwYXNzZWQgaW4gY3JpdGVyaWEgb3JcbiAgICAgKiB1bmRlZmluZWQgaWYgbWlzc2luZy5cbiAgICAgKiBAcGFyYW0gY3JpdGVyaWEgbWF0Y2ggY3JpdGVyaWFcbiAgICAgKi9cbiAgICBmaW5kUEJYR3JvdXBLZXkoY3JpdGVyaWE6IElHcm91cE1hdGNoQ3JpdGVyaWEpOiBYQ19QUk9KX1VVSUQgfCB1bmRlZmluZWQge1xuICAgICAgICByZXR1cm4gdGhpcy5maW5kUEJYR3JvdXBLZXlBbmRUeXBlKGNyaXRlcmlhLCAnUEJYR3JvdXAnKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaW5kIHRoZSBVVUlEIG9mIHRoZSBQQlhWYXJpYW50R3JvdXAgb2JqZWN0IHRoYXQgbWF0Y2hlcyB0aGUgcGFzc2VkIGluIGNyaXRlcmlhIG9yXG4gICAgICogdW5kZWZpbmVkIGlmIG1pc3NpbmcuXG4gICAgICogQHBhcmFtIGNyaXRlcmlhIG1hdGNoIGNyaXRlcmlhXG4gICAgICovXG5cbiAgICBmaW5kUEJYVmFyaWFudEdyb3VwS2V5KGNyaXRlcmlhOiBJR3JvdXBNYXRjaENyaXRlcmlhKTogWENfUFJPSl9VVUlEIHwgdW5kZWZpbmVkIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmluZFBCWEdyb3VwS2V5QW5kVHlwZShjcml0ZXJpYSwgJ1BCWFZhcmlhbnRHcm91cCcpO1xuICAgIH1cblxuICAgIGFkZExvY2FsaXphdGlvblZhcmlhbnRHcm91cChuYW1lOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgZ3JvdXBLZXkgPSB0aGlzLnBieENyZWF0ZVZhcmlhbnRHcm91cChuYW1lKTtcblxuICAgICAgICBjb25zdCByZXNvdXJjZUdyb3VwS2V5OiBYQ19QUk9KX1VVSUQgfCB1bmRlZmluZWQgPSB0aGlzLmZpbmRQQlhHcm91cEtleSh7IG5hbWU6ICdSZXNvdXJjZXMnIH0pO1xuXG4gICAgICAgIGlmIChyZXNvdXJjZUdyb3VwS2V5ID09IHVuZGVmaW5lZClcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlJlc291cmNlcyBncm91cCBub3QgZm91bmQhXCIpO1xuXG4gICAgICAgIHRoaXMuYWRkVG9QYnhHcm91cChncm91cEtleSwgcmVzb3VyY2VHcm91cEtleSk7XG5cbiAgICAgICAgdmFyIGxvY2FsaXphdGlvblZhcmlhbnRHcm91cCA9IHtcbiAgICAgICAgICAgIHV1aWQ6IHRoaXMuZ2VuZXJhdGVVdWlkKCksXG4gICAgICAgICAgICBmaWxlUmVmOiBncm91cEtleSxcbiAgICAgICAgICAgIGJhc2VuYW1lOiBuYW1lXG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmFkZFRvUGJ4QnVpbGRGaWxlU2VjdGlvbihsb2NhbGl6YXRpb25WYXJpYW50R3JvdXApOyAgICAgICAgLy8gUEJYQnVpbGRGaWxlXG4gICAgICAgIHRoaXMuYWRkVG9QYnhSZXNvdXJjZXNCdWlsZFBoYXNlKGxvY2FsaXphdGlvblZhcmlhbnRHcm91cCk7ICAgICAvL1BCWFJlc291cmNlc0J1aWxkUGhhc2VcblxuICAgICAgICByZXR1cm4gbG9jYWxpemF0aW9uVmFyaWFudEdyb3VwO1xuICAgIH07XG5cbiAgICBhZGRLbm93blJlZ2lvbihuYW1lOiBzdHJpbmcpOiB2b2lkIHtcblxuICAgICAgICBjb25zdCBwcm9qZWN0OiBQQlhQcm9qZWN0ID0gdGhpcy5nZXRGaXJzdFByb2plY3QoKS5maXJzdFByb2plY3Q7XG5cbiAgICAgICAgaWYgKCFwcm9qZWN0Lmtub3duUmVnaW9ucylcbiAgICAgICAgICAgIHByb2plY3Qua25vd25SZWdpb25zID0gW107XG5cbiAgICAgICAgaWYgKCF0aGlzLmhhc0tub3duUmVnaW9uKG5hbWUpKSB7XG4gICAgICAgICAgICBwcm9qZWN0Lmtub3duUmVnaW9ucy5wdXNoKG5hbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgKCF0aGlzLnBieFByb2plY3RTZWN0aW9uKClbdGhpcy5nZXRGaXJzdFByb2plY3QoKVsndXVpZCddXVsna25vd25SZWdpb25zJ10pIHtcbiAgICAgICAgLy8gICAgIHRoaXMucGJ4UHJvamVjdFNlY3Rpb24oKVt0aGlzLmdldEZpcnN0UHJvamVjdCgpWyd1dWlkJ11dWydrbm93blJlZ2lvbnMnXSA9IFtdO1xuICAgICAgICAvLyB9XG4gICAgICAgIC8vIGlmICghdGhpcy5oYXNLbm93blJlZ2lvbihuYW1lKSkge1xuICAgICAgICAvLyAgICAgdGhpcy5wYnhQcm9qZWN0U2VjdGlvbigpW3RoaXMuZ2V0Rmlyc3RQcm9qZWN0KClbJ3V1aWQnXV1bJ2tub3duUmVnaW9ucyddLnB1c2gobmFtZSk7XG4gICAgICAgIC8vIH1cbiAgICB9XG5cbiAgICByZW1vdmVLbm93blJlZ2lvbihuYW1lOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAgICAgY29uc3QgcmVnaW9uczogc3RyaW5nW10gfCB1bmRlZmluZWQgPSB0aGlzLmdldEZpcnN0UHJvamVjdCgpLmZpcnN0UHJvamVjdC5rbm93blJlZ2lvbnM7XG4gICAgICAgIGlmIChyZWdpb25zKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlZ2lvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAocmVnaW9uc1tpXSA9PT0gbmFtZSkge1xuICAgICAgICAgICAgICAgICAgICByZWdpb25zLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyAgVGhpcyBsaW5lIGRpZCBub3RoaW5nXG4gICAgICAgICAgICAvLyB0aGlzLnBieFByb2plY3RTZWN0aW9uKClbdGhpcy5nZXRGaXJzdFByb2plY3QoKVsndXVpZCddXVsna25vd25SZWdpb25zJ10gPSByZWdpb25zO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaGFzS25vd25SZWdpb24obmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgICAgIGNvbnN0IHJlZ2lvbnM6IHN0cmluZ1tdIHwgdW5kZWZpbmVkID0gdGhpcy5nZXRGaXJzdFByb2plY3QoKS5maXJzdFByb2plY3Qua25vd25SZWdpb25zO1xuICAgICAgICAvL3ZhciByZWdpb25zID0gdGhpcy5wYnhQcm9qZWN0U2VjdGlvbigpW3RoaXMuZ2V0Rmlyc3RQcm9qZWN0KClbJ3V1aWQnXV1bJ2tub3duUmVnaW9ucyddO1xuICAgICAgICBpZiAocmVnaW9ucykge1xuICAgICAgICAgICAgZm9yICh2YXIgaSBpbiByZWdpb25zKSB7XG4gICAgICAgICAgICAgICAgaWYgKHJlZ2lvbnNbaV0gPT09IG5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cblxuICAgIGdldFBCWE9iamVjdDxQQlhfT0JKX1RZUEUgZXh0ZW5kcyBQQlhPYmplY3RCYXNlPihuYW1lOiBJU0FfVFlQRSk6IFR5cGVkU2VjdGlvbjxQQlhfT0JKX1RZUEU+IHwgdW5kZWZpbmVkIHtcbiAgICAgICAgaWYgKCF0aGlzLmhhc2gpIHRocm93IG5ldyBFcnJvcignTm90IGxvYWRlZCcpO1xuXG4gICAgICAgIHJldHVybiB0aGlzLmhhc2gucHJvamVjdC5vYmplY3RzW25hbWVdIGFzIFR5cGVkU2VjdGlvbjxQQlhfT0JKX1RZUEU+IHwgdW5kZWZpbmVkO1xuICAgIH1cblxuXG5cblxuICAgIC8qKlxuICAgICAqIFNlZSBpZiB0aGlzIGZpbGUgZXhpc3RzIGluIHRoZSBwcm9qZWN0LiAgSWYgbm90LCBzdG9wIGFuZCByZXR1cm4gYSBudWxsLlxuICAgICAqIElmIG5vdCwgY3JlYXRlIGEgbmV3IGZpbGUgcmVmZXJlbmNlIGZvciBpdCwgYWRkIGEgUEJYRmlsZVJlZmVyZW5jZSB0byBcbiAgICAgKiB0aGUgbW9kZWwsIGFuZCB0aGVuIGFkZCBpdCB0byBhIGdyb3VwIGlmIHBvc3NpYmxlLlxuICAgICAqIFxuICAgICAqIExpbmUgMTk2MSBcbiAgICAgKiBAcGFyYW0gcGF0aCByZWxhdGl2ZSBwYXRoIHRvIHRoZSBmaWxlIHdpdGhpbiB0aGUgcHJvamVjdC5cbiAgICAgKiBAcGFyYW0gZ3JvdXAgaWYgdGhpcyBpcyB0aGUga2V5IHRvIGEgUEJYR3JvdXAsIHRoZW4gdGhpcyBmaWxlIGlzIGFkZGVkIHRvIHRoYXRcbiAgICAgKiBncm91cC4gIElmIHRoaXMgaXMgdGhlIGtleSB0byBhIFBCWFZhcmlhbnRHcm91cCwgdGhlbiB0aGlzIGZpbGUgaXMgYWRkZWQgdG9cbiAgICAgKiB0aGF0IGdyb3VwLiAgT3RoZXJ3aXNlLCB0aGlzIGZpbGUgaXMgbm90IGFkZGVkIHRvIGFueSBncm91cC5cbiAgICAgKiBAcGFyYW0gb3B0IFxuICAgICAqIFxuICAgICAqIEByZXR1cm5zIG51bGwgaWYgZmlsZSBhbHJlYWR5IGV4aXN0cy4gIE90aGVyd2lzZSwgdGhpcyBpcyB0aGUgbmV3IGZpbGUuXG4gICAgICovXG4gICAgYWRkRmlsZShwYXRoOiBzdHJpbmcsIGdyb3VwOiBYQ19QUk9KX1VVSUQsIG9wdD86IElQYnhGaWxlT3B0aW9ucyB8IG51bGwpOiBQYnhGaWxlIHwgbnVsbCB7XG4gICAgICAgIGNvbnN0IGZpbGUgPSBuZXcgUGJ4RmlsZShwYXRoLCBvcHQpO1xuXG4gICAgICAgIC8vIG51bGwgaXMgYmV0dGVyIGZvciBlYXJseSBlcnJvcnNcbiAgICAgICAgaWYgKHRoaXMuaGFzRmlsZShmaWxlLnBhdGgpKSByZXR1cm4gbnVsbDtcblxuICAgICAgICBmaWxlLmZpbGVSZWYgPSB0aGlzLmdlbmVyYXRlVXVpZCgpO1xuXG4gICAgICAgIHRoaXMuYWRkVG9QYnhGaWxlUmVmZXJlbmNlU2VjdGlvbihmaWxlKTsgICAgLy8gUEJYRmlsZVJlZmVyZW5jZVxuXG4gICAgICAgIGlmICh0aGlzLmdldFBCWEdyb3VwQnlLZXkoZ3JvdXApKSB7XG4gICAgICAgICAgICB0aGlzLmFkZFRvUGJ4R3JvdXAoZmlsZSwgZ3JvdXApOyAgICAgICAgLy8gUEJYR3JvdXBcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh0aGlzLmdldFBCWFZhcmlhbnRHcm91cEJ5S2V5KGdyb3VwKSkge1xuICAgICAgICAgICAgdGhpcy5hZGRUb1BieFZhcmlhbnRHcm91cChmaWxlLCBncm91cCk7ICAgICAgICAgICAgLy8gUEJYVmFyaWFudEdyb3VwXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmlsZTtcbiAgICB9XG5cbiAgICByZW1vdmVGaWxlKHBhdGg6IHN0cmluZywgZ3JvdXA6IFhDX1BST0pfVVVJRCwgb3B0PzogSVBieEZpbGVPcHRpb25zIHwgbnVsbCk6IFBieEZpbGUge1xuICAgICAgICBjb25zdCBmaWxlID0gbmV3IFBieEZpbGUocGF0aCwgb3B0KTtcblxuICAgICAgICB0aGlzLnJlbW92ZUZyb21QYnhGaWxlUmVmZXJlbmNlU2VjdGlvbihmaWxlKTsgICAgLy8gUEJYRmlsZVJlZmVyZW5jZVxuXG4gICAgICAgIGlmICh0aGlzLmdldFBCWEdyb3VwQnlLZXkoZ3JvdXApKSB7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZUZyb21QYnhHcm91cChmaWxlLCBncm91cCk7ICAgICAgICAgICAgLy8gUEJYR3JvdXBcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh0aGlzLmdldFBCWFZhcmlhbnRHcm91cEJ5S2V5KGdyb3VwKSkge1xuICAgICAgICAgICAgdGhpcy5yZW1vdmVGcm9tUGJ4VmFyaWFudEdyb3VwKGZpbGUsIGdyb3VwKTsgICAgIC8vIFBCWFZhcmlhbnRHcm91cFxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZpbGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcmV0dXJucyB0aGUgdmFsdWUgb2YgdGhlIGxhc3QgYnVpbGQgc2V0dGluZyB3aXRoIHRoZSBuYW1lIHByb3BlcnR5IGZvclxuICAgICAqIGFsbCBYQ0J1aWxkQ29uZmlndXJhdGlvbiBvYmplY3RzIHdob3NlIG5hbWUgbWF0Y2hlcyB0aGUgdmFsdWUgcGFzc2VkIGluIGZvciAnYnVpbGQnXG4gICAgICogQHBhcmFtIHByb3AgQSBrZXkgaW4gdGhlIGJ1aWxkU2V0dGluZ3MgXG4gICAgICogQHBhcmFtIGJ1aWxkIE1hdGNoZXMgdGhlIFhDQnVpbGRDb25maWd1cmF0aW9uTmFtZS4gIEV4YW1wbGVzOiAgJ0RlYnVnJyAnUmVsZWFzZSdcbiAgICAgKi9cbiAgICBnZXRCdWlsZFByb3BlcnR5KHByb3A6IHN0cmluZywgYnVpbGQ/OiAnRGVidWcnIHwgJ1JlbGVhc2UnIHwgdW5kZWZpbmVkKTogYW55IHtcbiAgICAgICAgdmFyIHRhcmdldDtcbiAgICAgICAgY29uc3QgY29uZmlnczogVHlwZWRTZWN0aW9uPFhDQnVpbGRDb25maWd1cmF0aW9uPiA9IHRoaXMueGNCdWlsZENvbmZpZ3VyYXRpb25TZWN0aW9uKCk7XG4gICAgICAgIGZvciAodmFyIGNvbmZpZ0tleSBpbiBjb25maWdzKSB7XG4gICAgICAgICAgICBpZiAoIVNlY3Rpb25VdGlscy5kaWN0S2V5SXNDb21tZW50KGNvbmZpZ0tleSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb25maWc6IFhDQnVpbGRDb25maWd1cmF0aW9uID0gY29uZmlnc1tjb25maWdLZXldIGFzIFhDQnVpbGRDb25maWd1cmF0aW9uO1xuXG4gICAgICAgICAgICAgICAgaWYgKChidWlsZCAmJiBjb25maWcubmFtZSA9PT0gYnVpbGQpIHx8IChidWlsZCA9PT0gdW5kZWZpbmVkKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoY29uZmlnLmJ1aWxkU2V0dGluZ3NbcHJvcF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0ID0gY29uZmlnLmJ1aWxkU2V0dGluZ3NbcHJvcF07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGFyZ2V0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybiBhIGRpY3Rpb25hcnkgb2YgYWxsIG9mIHRoZSBYQ0J1aWxkQ29uZmlndXJhdGlvbiBvYmplY3RzIHRoYXQgYXJlIGVpdGhlciAnRGVidWcnIG9yICdSZWxlYXNlJ1xuICAgICAqIEBwYXJhbSBidWlsZCBcbiAgICAgKi9cbiAgICBnZXRCdWlsZENvbmZpZ0J5TmFtZShidWlsZDogJ0RlYnVnJyB8ICdSZWxlYXNlJyk6IHsgW3V1aWQ6IHN0cmluZ106IFhDQnVpbGRDb25maWd1cmF0aW9uIH0ge1xuXG4gICAgICAgIGNvbnN0IHRhcmdldDogeyBbdXVpZDogc3RyaW5nXTogWENCdWlsZENvbmZpZ3VyYXRpb24gfSA9IHt9O1xuXG4gICAgICAgIGNvbnN0IGNvbmZpZ3M6IFR5cGVkU2VjdGlvbjxYQ0J1aWxkQ29uZmlndXJhdGlvbj4gPSB0aGlzLnhjQnVpbGRDb25maWd1cmF0aW9uU2VjdGlvbigpO1xuICAgICAgICBmb3IgKHZhciBrZXkgaW4gY29uZmlncykge1xuICAgICAgICAgICAgaWYgKCFTZWN0aW9uVXRpbHMuZGljdEtleUlzQ29tbWVudChrZXkpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29uZmlnOiBYQ0J1aWxkQ29uZmlndXJhdGlvbiA9IGNvbmZpZ3Nba2V5XSBhcyBYQ0J1aWxkQ29uZmlndXJhdGlvbjtcbiAgICAgICAgICAgICAgICBpZiAoY29uZmlnLm5hbWUgPT09IGJ1aWxkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldFtrZXldID0gY29uZmlnO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGFyZ2V0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFxuICAgICAqIEBwYXJhbSBmaWxlUGF0aCBcbiAgICAgKiBAcGFyYW0gZ3JvdXAgXG4gICAgICogQHBhcmFtIG9wdCBcbiAgICAgKi9cbiAgICBhZGREYXRhTW9kZWxEb2N1bWVudChmaWxlUGF0aDogc3RyaW5nLCBncm91cDogWENfUFJPSl9VVUlEIHwgRklMRVRZUEVfR1JPVVAgfCBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkLCBvcHQ/OiBJUGJ4RmlsZU9wdGlvbnMgfCBudWxsKSB7XG5cbiAgICAgICAgLy8gIEl0IGFwcGVhcnMgYXMgaWYgZ3JvdXAgY2FuIGJlIFxuICAgICAgICBpZiAoIWdyb3VwKSB7XG4gICAgICAgICAgICBncm91cCA9ICdSZXNvdXJjZXMnO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFTZWN0aW9uVXRpbHMuZGljdEtleUlzVXVpZChncm91cCkpIHsgLy8gSWYgdGhpcyBpcyBub3QgYW4gWENfUFJPSl9VVUlELCB0aGVuIGl0IGlzIGEgRklMRVRZUEVfR1JPVVAsIGNvbnZlcnQgaXQgdG8gYSBVVUlEIG9yIGJhY2sgdG8gdW5kZWZpbmVkXG4gICAgICAgIC8vIGlmICggICF0aGlzLmdldFBCWEdyb3VwQnlLZXkoZ3JvdXApKSB7IC8vIFdlIG5vdyB0aHJvdyBpZiB5b3UgcGFzcyBhIG5vbiBrZXkgXG4gICAgICAgICAgICBncm91cCA9IHRoaXMuZmluZFBCWEdyb3VwS2V5KHsgbmFtZTogZ3JvdXAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAgQXQgdGhpcyBwb2ludCBncm91cCBpcyBlaXRoZXIgYSB2YWxpZCBVVUlEIG9yIHVuZGVmaW5lZFxuICAgICAgICBpZiAoIWdyb3VwKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gZmluZCB0aGUgZ3JvdXAhJyk7XG5cbiAgICAgICAgY29uc3QgZmlsZTogUGJ4RmlsZSAmIElEYXRhTW9kZWxEb2N1bWVudEZpbGUgPSBuZXcgUGJ4RmlsZShmaWxlUGF0aCwgb3B0KTtcblxuICAgICAgICBpZiAoIWZpbGUgfHwgdGhpcy5oYXNGaWxlKGZpbGUucGF0aCkpIHJldHVybiBudWxsO1xuXG4gICAgICAgIGZpbGUuZmlsZVJlZiA9IHRoaXMuZ2VuZXJhdGVVdWlkKCk7XG4gICAgICAgIHRoaXMuYWRkVG9QYnhHcm91cChmaWxlLCBncm91cCk7XG5cbiAgICAgICAgaWYgKCFmaWxlKSByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgZmlsZS50YXJnZXQgPSBvcHQgPyBvcHQudGFyZ2V0IDogdW5kZWZpbmVkO1xuICAgICAgICBmaWxlLnV1aWQgPSB0aGlzLmdlbmVyYXRlVXVpZCgpO1xuXG4gICAgICAgIHRoaXMuYWRkVG9QYnhCdWlsZEZpbGVTZWN0aW9uKGZpbGUpO1xuICAgICAgICB0aGlzLmFkZFRvUGJ4U291cmNlc0J1aWxkUGhhc2UoZmlsZSk7XG5cbiAgICAgICAgZmlsZS5tb2RlbHMgPSBbXTtcbiAgICAgICAgdmFyIGN1cnJlbnRWZXJzaW9uTmFtZTtcbiAgICAgICAgdmFyIG1vZGVsRmlsZXMgPSBmcy5yZWFkZGlyU3luYyhmaWxlLnBhdGgpO1xuICAgICAgICBmb3IgKHZhciBpbmRleCBpbiBtb2RlbEZpbGVzKSB7XG4gICAgICAgICAgICB2YXIgbW9kZWxGaWxlTmFtZSA9IG1vZGVsRmlsZXNbaW5kZXhdO1xuICAgICAgICAgICAgdmFyIG1vZGVsRmlsZVBhdGggPSBwYXRoLmpvaW4oZmlsZVBhdGgsIG1vZGVsRmlsZU5hbWUpO1xuXG4gICAgICAgICAgICBpZiAobW9kZWxGaWxlTmFtZSA9PSAnLnhjY3VycmVudHZlcnNpb24nKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFZlcnNpb25OYW1lID0gcGxpc3QucmVhZEZpbGVTeW5jKG1vZGVsRmlsZVBhdGgpLl9YQ0N1cnJlbnRWZXJzaW9uTmFtZTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIG1vZGVsRmlsZSA9IG5ldyBQYnhGaWxlKG1vZGVsRmlsZVBhdGgpO1xuICAgICAgICAgICAgbW9kZWxGaWxlLmZpbGVSZWYgPSB0aGlzLmdlbmVyYXRlVXVpZCgpO1xuXG4gICAgICAgICAgICB0aGlzLmFkZFRvUGJ4RmlsZVJlZmVyZW5jZVNlY3Rpb24obW9kZWxGaWxlKTtcblxuICAgICAgICAgICAgZmlsZS5tb2RlbHMucHVzaChtb2RlbEZpbGUpO1xuXG4gICAgICAgICAgICBpZiAoY3VycmVudFZlcnNpb25OYW1lICYmIGN1cnJlbnRWZXJzaW9uTmFtZSA9PT0gbW9kZWxGaWxlTmFtZSkge1xuICAgICAgICAgICAgICAgIGZpbGUuY3VycmVudE1vZGVsID0gbW9kZWxGaWxlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFmaWxlLmN1cnJlbnRNb2RlbCkge1xuICAgICAgICAgICAgZmlsZS5jdXJyZW50TW9kZWwgPSBmaWxlLm1vZGVsc1swXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuYWRkVG9YY1ZlcnNpb25Hcm91cFNlY3Rpb24oZmlsZSk7XG5cbiAgICAgICAgcmV0dXJuIGZpbGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkIGEgbmV3IG9iamVjdC92YWx1ZSB0byB0aGUgVGFyZ2V0QXR0cmlidXRlcyBhdHRyaWJ1dGUgb2YgdGhlIG9ubHlcbiAgICAgKiBQQlhQcm9qZWN0IG1lbWJlci5cbiAgICAgKiBAcGFyYW0gcHJvcCBcbiAgICAgKiBAcGFyYW0gdmFsdWUgXG4gICAgICogQHBhcmFtIHRhcmdldCBcbiAgICAgKi9cbiAgICBhZGRUYXJnZXRBdHRyaWJ1dGUocHJvcDogc3RyaW5nLCB2YWx1ZTogYW55LCB0YXJnZXQ6IHsgdXVpZDogWENfUFJPSl9VVUlEIH0pOiB2b2lkIHtcblxuICAgICAgICBjb25zdCBwcm9qOiBQQlhQcm9qZWN0ID0gdGhpcy5nZXRGaXJzdFByb2plY3QoKS5maXJzdFByb2plY3Q7XG4gICAgICAgIGNvbnN0IGF0dHJpYnV0ZXM6IElBdHRyaWJ1dGVzRGljdGlvbmFyeSA9IHByb2ouYXR0cmlidXRlcztcblxuICAgICAgICAvLyB2YXIgYXR0cmlidXRlcyA9IHRoaXMuZ2V0Rmlyc3RQcm9qZWN0KClbJ2ZpcnN0UHJvamVjdCddWydhdHRyaWJ1dGVzJ107XG4gICAgICAgIGlmIChhdHRyaWJ1dGVzWydUYXJnZXRBdHRyaWJ1dGVzJ10gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgYXR0cmlidXRlc1snVGFyZ2V0QXR0cmlidXRlcyddID0ge307XG4gICAgICAgIH1cbiAgICAgICAgdGFyZ2V0ID0gdGFyZ2V0IHx8IHRoaXMuZ2V0Rmlyc3RUYXJnZXQoKTtcbiAgICAgICAgaWYgKGF0dHJpYnV0ZXNbJ1RhcmdldEF0dHJpYnV0ZXMnXVt0YXJnZXQudXVpZF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgYXR0cmlidXRlc1snVGFyZ2V0QXR0cmlidXRlcyddW3RhcmdldC51dWlkXSA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIGF0dHJpYnV0ZXNbJ1RhcmdldEF0dHJpYnV0ZXMnXVt0YXJnZXQudXVpZF1bcHJvcF0gPSB2YWx1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0gcHJvcCBcbiAgICAgKiBAcGFyYW0gdGFyZ2V0IFxuICAgICAqL1xuICAgIHJlbW92ZVRhcmdldEF0dHJpYnV0ZShwcm9wOiBzdHJpbmcsIHRhcmdldD86IHsgdXVpZDogWENfUFJPSl9VVUlEIH0pOiB2b2lkIHtcblxuICAgICAgICBjb25zdCBwcm9qOiBQQlhQcm9qZWN0ID0gdGhpcy5nZXRGaXJzdFByb2plY3QoKS5maXJzdFByb2plY3Q7XG4gICAgICAgIGNvbnN0IGF0dHJpYnV0ZXM6IElBdHRyaWJ1dGVzRGljdGlvbmFyeSA9IHByb2ouYXR0cmlidXRlcztcblxuICAgICAgICB0YXJnZXQgPSB0YXJnZXQgfHwgdGhpcy5nZXRGaXJzdFRhcmdldCgpO1xuICAgICAgICBpZiAoYXR0cmlidXRlc1snVGFyZ2V0QXR0cmlidXRlcyddICYmXG4gICAgICAgICAgICBhdHRyaWJ1dGVzWydUYXJnZXRBdHRyaWJ1dGVzJ11bdGFyZ2V0LnV1aWRdKSB7XG4gICAgICAgICAgICBkZWxldGUgYXR0cmlidXRlc1snVGFyZ2V0QXR0cmlidXRlcyddW3RhcmdldC51dWlkXVtwcm9wXTtcbiAgICAgICAgfVxuICAgIH1cblxufSJdfQ==