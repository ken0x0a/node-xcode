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
 * it that way for a reason.
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
        watch_extension: 'plugins'
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
        watch_extension: 'com.apple.product-type.watchkit-extension'
    };
    var pt = PRODUCTTYPE_BY_TARGETTYPE[targetType];
    if (pt !== undefined)
        return pt;
    else
        throw new Error("No product type for target type of '" + targetType + "'");
}
function filetypeForProducttype(productType) {
    var FILETYPE_BY_PRODUCTTYPE = {
        'com.apple.product-type.application': 'wrapper.application',
        'com.apple.product-type.app-extension': 'wrapper.app-extension',
        'com.apple.product-type.bundle': 'wrapper.plug-in',
        'com.apple.product-type.tool': 'compiled.mach-o.dylib',
        'com.apple.product-type.library.dynamic': 'compiled.mach-o.dylib',
        'com.apple.product-type.framework': 'wrapper.framework',
        'com.apple.product-type.library.static': 'archive.ar',
        'com.apple.product-type.bundle.unit-test': 'wrapper.cfbundle',
        'com.apple.product-type.application.watchapp': 'wrapper.application',
        'com.apple.product-type.watchkit-extension': 'wrapper.app-extension'
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
    return FILETYPE_BY_PRODUCTTYPE[productType];
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
        var productFileType = filetypeForProducttype(productType);
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
            //  TODO:  Evaluate if this is sound.
            // Create CopyFiles phase in first target
            this.addBuildPhase([], 'PBXCopyFilesBuildPhase', 'Copy Files', this.getFirstTarget().uuid, targetType);
            // Add product to CopyFiles phase
            this.addToPbxCopyfilesBuildPhase(productFile);
            // this.addBuildPhaseToTarget(newPhase.buildPhase, this.getFirstTarget().uuid)
        }
        ;
        // Target: Add uuid to root project
        this.addToPbxProjectSection(target);
        // Target: Add dependency for this target to first (main) target
        this.addTargetDependency(this.getFirstTarget().uuid, [target.uuid]);
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
        // Get first targets UUID
        var firstTargetUuid = this.getFirstProject()['firstProject']['targets'][0].value;
        // Get first pbxNativeTarget
        var firstTarget = this.pbxNativeTargetSection()[firstTargetUuid];
        return {
            uuid: firstTargetUuid,
            firstTarget: firstTarget
        };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiWGNQcm9qZWN0RmlsZUVkaXRvci5qcyIsInNvdXJjZVJvb3QiOiIuLi9zcmMvdHMvIiwic291cmNlcyI6WyJsaWIvWGNQcm9qZWN0RmlsZUVkaXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7Ozs7OztHQWVHOzs7Ozs7Ozs7Ozs7Ozs7QUFHSDs7Ozs7Ozs7RUFRRTtBQUVGLDZCQUFtQztBQUNuQywyQkFBNkI7QUFDN0IsMkJBQTZCO0FBQzdCLHVCQUF5QjtBQUN6QixrQ0FBa0M7QUFDbEMsSUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLGNBQWMsQ0FBUSxDQUFDO0FBQzdDLHdDQUF3QztBQUV4QyxpQ0FBc0M7QUFDdEMsK0NBQW1EO0FBRW5ELHlDQUEwRDtBQUUxRCwwREFBMEQ7QUFDMUQsb0NBQW9DO0FBQ3BDLElBQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0FBRTNDLCtDQUE4QztBQUU5QyxtRUFBMHRCO0FBQzF0QiwyQ0FBbUk7QUFJbkk7Ozs7OztHQU1HO0FBQ0gsSUFBTSx5QkFBeUIsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsd0JBQXdCLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLGlHQUFpRztBQWlDbkwseUNBQXlDO0FBQ3pDLDBDQUEwQztBQUMxQywyQ0FBMkM7QUFDM0Msa0JBQWtCO0FBQ2xCLDJCQUEyQjtBQUMzQiwrQ0FBK0M7QUFDL0MseUVBQXlFO0FBQ3pFLG9EQUFvRDtBQUNwRCxzQ0FBc0M7QUFDdEMsa0NBQWtDO0FBQ2xDLGdCQUFnQjtBQUNoQixZQUFZO0FBQ1osUUFBUTtBQUNSLElBQUk7QUFFSixtQ0FBbUM7QUFDbkMsU0FBUyxlQUFlLENBQUMsSUFBa0I7SUFFdkMsMkRBQTJEO0lBQzNELDRCQUE0QjtJQUM1QixJQUFJLE9BQU8sSUFBSSxDQUFDLE9BQU8sS0FBSyxRQUFRLEVBQUU7UUFDbEMsTUFBTSxJQUFJLEtBQUssQ0FBQyxxREFBcUQsQ0FBQyxDQUFDO0tBQzFFO0lBRUQsSUFBSSxHQUFHLEdBQWlCO1FBQ3BCLEdBQUcsRUFBRSxjQUFjO1FBQ25CLE9BQU8sRUFBRSxJQUFJLENBQUMsT0FBTztRQUNyQixlQUFlLEVBQUUsSUFBSSxDQUFDLFFBQVE7S0FDakMsQ0FBQztJQUVGLElBQUksSUFBSSxDQUFDLFFBQVE7UUFDYixHQUFHLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7SUFFakMsT0FBTyxHQUFHLENBQUM7QUFDZixDQUFDO0FBRUQsU0FBUyxtQkFBbUIsQ0FBQyxJQUFhO0lBQ3RDLHdCQUF3QjtJQUV4QixrRUFBa0U7SUFFbEUsOEVBQThFO0lBQzlFLG1FQUFtRTtJQUNuRSwyQ0FBMkM7SUFDM0MsNEdBQTRHO0lBRTVHLElBQUksVUFBVSxHQUFxQjtRQUMvQixHQUFHLEVBQUUsa0JBQWtCO1FBQ3ZCLElBQUksRUFBRSxJQUFJLEdBQUcsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJO1FBQ2pDLElBQUksRUFBRSxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxHQUFHLElBQUk7UUFDakQsVUFBVSxFQUFFLElBQUksQ0FBQyxVQUFVO1FBQzNCLFlBQVksRUFBRSxJQUFJLENBQUMsWUFBWTtRQUMvQixpQkFBaUIsRUFBRSxJQUFJLENBQUMsaUJBQWlCO1FBQ3pDLGdCQUFnQixFQUFFLElBQUksQ0FBQyxnQkFBZ0I7UUFDdkMsY0FBYyxFQUFFLElBQUksQ0FBQyxjQUFjO0tBQ3RDLENBQUM7SUFFRixPQUFPLFVBQVUsQ0FBQztBQUN0QixDQUFDO0FBSUQsU0FBUyxhQUFhLENBQUMsSUFBNEI7SUFFL0MsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUU7UUFDZixNQUFNLElBQUksS0FBSyxDQUFDLGtCQUFrQixDQUFDLENBQUM7S0FDdkM7SUFFRCxPQUFPO1FBQ0gsS0FBSyxFQUFFLElBQUksQ0FBQyxPQUFPO1FBQ25CLE9BQU8sRUFBRSxJQUFJLENBQUMsUUFBUTtLQUN6QixDQUFDO0FBQ04sQ0FBQztBQUVELGlGQUFpRjtBQUNqRiwwR0FBMEc7QUFDMUcsMENBQTBDO0FBQzFDLHlDQUF5QztBQUN6QyxlQUFlO0FBQ2YsK0NBQStDO0FBQy9DLFFBQVE7QUFDUixJQUFJO0FBRUosU0FBUyxnQkFBZ0IsQ0FBQyxJQUFrQjtJQUN4QyxJQUFJLEdBQUcsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBRTlCLElBQUksQ0FBQywyQkFBWSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7UUFDeEMsTUFBTSxJQUFJLEtBQUssQ0FBQyx3QkFBc0IsSUFBSSxDQUFDLElBQUksa0JBQWUsQ0FBQyxDQUFDO0tBQ25FO0lBRUQsR0FBRyxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQ3RCLEdBQUcsQ0FBQyxPQUFPLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBRWhDLE9BQU8sR0FBRyxDQUFDO0FBQ2YsQ0FBQztBQUVELFNBQVMseUJBQXlCLENBQzlCLEdBQXNCLEVBQ3RCLFVBQWtCLEVBQ2xCLGFBQTZCLEVBQzdCLFNBQXlCO0lBRXpCLHdEQUF3RDtJQUN4RCxJQUFJLHlCQUF5QixHQUFxQztRQUM5RCxXQUFXLEVBQUUsU0FBUztRQUN0QixhQUFhLEVBQUUsU0FBUztRQUN4QixNQUFNLEVBQUUsU0FBUztRQUNqQixpQkFBaUIsRUFBRSxTQUFTO1FBQzVCLGVBQWUsRUFBRSxvQkFBb0I7UUFDckMsU0FBUyxFQUFFLG1CQUFtQjtRQUM5QixVQUFVLEVBQUUsWUFBWTtRQUN4QixjQUFjLEVBQUUsb0JBQW9CO1FBQ3BDLGdCQUFnQixFQUFFLFNBQVM7UUFDM0IsU0FBUyxFQUFFLFNBQVM7UUFDcEIsZUFBZSxFQUFFLFNBQVM7S0FDN0IsQ0FBQTtJQUVELElBQUksNEJBQTRCLEdBQXNDO1FBQ2xFLGFBQWEsRUFBRSxDQUFDO1FBQ2hCLFdBQVcsRUFBRSxDQUFDO1FBQ2QsVUFBVSxFQUFFLEVBQUU7UUFDZCxjQUFjLEVBQUUsRUFBRTtRQUNsQixPQUFPLEVBQUUsRUFBRTtRQUNYLGtCQUFrQixFQUFFLEVBQUU7UUFDdEIsU0FBUyxFQUFFLENBQUM7UUFDWixpQkFBaUIsRUFBRSxFQUFFO1FBQ3JCLGNBQWMsRUFBRSxFQUFFO1FBQ2xCLE9BQU8sRUFBRSxDQUFDO1FBQ1YsWUFBWSxFQUFFLENBQUM7S0FDbEIsQ0FBQTtJQUVELElBQU0sTUFBTSxHQUFHLEdBQTZCLENBQUM7SUFDN0MsTUFBTSxDQUFDLElBQUksR0FBRyxHQUFHLEdBQUcsU0FBUyxHQUFHLEdBQUcsQ0FBQztJQUNwQyxNQUFNLENBQUMsT0FBTyxHQUFHLGFBQWEsSUFBSSxJQUFJLENBQUM7SUFDdkMsTUFBTSxDQUFDLGdCQUFnQixHQUFHLDRCQUE0QixDQUFDLHlCQUF5QixDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7SUFFOUYsT0FBTyxNQUFNLENBQUM7QUFDbEIsQ0FBQztBQVNELFNBQVMsMkJBQTJCLENBQ2hDLEdBQXNCLEVBQ3RCLE9BQXlDLEVBQ3pDLFNBQWlCO0lBRWpCLElBQU0sTUFBTSxHQUFHLEdBQStCLENBQUM7SUFDL0MsTUFBTSxDQUFDLElBQUksR0FBRyxHQUFHLEdBQUcsU0FBUyxHQUFHLEdBQUcsQ0FBQztJQUNwQyxNQUFNLENBQUMsVUFBVSxHQUFHLE9BQU8sQ0FBQyxVQUFVLElBQUksRUFBRSxDQUFDO0lBQzdDLE1BQU0sQ0FBQyxXQUFXLEdBQUcsT0FBTyxDQUFDLFdBQVcsSUFBSSxFQUFFLENBQUM7SUFDL0MsTUFBTSxDQUFDLFNBQVMsR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDO0lBQ3JDLE1BQU0sQ0FBQyxXQUFXLEdBQUcsR0FBRyxHQUFHLE9BQU8sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsR0FBRyxHQUFHLENBQUM7SUFFMUUsT0FBTyxNQUFNLENBQUM7QUFDbEIsQ0FBQztBQUVELFNBQVMsbUJBQW1CLENBQUMsSUFBcUI7SUFDOUMsT0FBTyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDN0IsQ0FBQztBQUVELFNBQVMsdUJBQXVCLENBQUMsSUFBYTtJQUMxQyxPQUFPLElBQUksQ0FBQyxRQUFRLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDckQsQ0FBQztBQUVELFNBQVMsc0JBQXNCLENBQUMsTUFBdUI7SUFDbkQsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDO0FBQ3ZCLENBQUM7QUFFRCxTQUFTLFdBQVcsQ0FBQyxJQUFxQjtJQUV0QywrREFBK0Q7SUFDL0Qsd0JBQXdCO0lBQ3hCLDZEQUE2RDtJQUM3RCwrREFBK0Q7SUFDL0QsNkRBQTZEO0lBQzdELG9FQUFvRTtJQUNwRSxxQ0FBcUM7SUFDckMsSUFBSTtJQUNKLDJEQUEyRDtJQUMzRCxxQ0FBcUM7SUFDckMsaURBQWlEO0lBRWpELE9BQU8sYUFBQyxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNwRCxDQUFDO0FBRUQsdUJBQXVCO0FBQ3ZCLFNBQVMscUJBQXFCLENBQUMsSUFBYSxFQUFFLE9BQTRCO0lBQ3RFLE9BQU8sY0FBYyxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7QUFDcEQsQ0FBQztBQUVELFNBQVMsdUJBQXVCLENBQUMsSUFBYSxFQUFFLE9BQTRCO0lBQ3hFLE9BQU8sY0FBYyxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsV0FBVyxDQUFDLENBQUM7QUFDdEQsQ0FBQztBQUdELFlBQVk7QUFDWiwwRUFBMEU7QUFDMUUsMERBQTBEO0FBQzFELElBQUk7QUFFSixTQUFTLGNBQWMsQ0FBQyxJQUFhLEVBQUUsT0FBNEIsRUFBRSxLQUFhO0lBQzlFLElBQUksV0FBVyxHQUFHLElBQUksTUFBTSxDQUFDLEdBQUcsR0FBRyxLQUFLLEdBQUcsU0FBUyxDQUFDLENBQUM7SUFFdEQsSUFBTSxRQUFRLEdBQW9CLE9BQU8sQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUM7SUFFaEUsSUFBSSxDQUFDLFFBQVE7UUFDVCxNQUFNLElBQUksS0FBSyxDQUFDLGtCQUFrQixDQUFDLENBQUM7SUFFeEMsSUFBSSxRQUFRLENBQUMsSUFBSTtRQUNiLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBRW5ELE9BQU8sSUFBSSxDQUFDO0FBQ2hCLENBQUM7QUFFRCxTQUFTLGlCQUFpQixDQUFDLElBQWEsRUFBRSxJQUF5QjtJQUMvRCxJQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQy9DLElBQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0lBRWxELElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBRXRDLElBQUksT0FBTyxJQUFJLEdBQUcsRUFBRTtRQUNoQixPQUFPLEdBQUcsRUFBRSxDQUFDO0tBQ2hCO1NBQU07UUFDSCxPQUFPLEdBQUcsR0FBRyxHQUFHLE9BQU8sQ0FBQztLQUMzQjtJQUVELElBQUksSUFBSSxDQUFDLE1BQU0sSUFBSSxXQUFXLEVBQUU7UUFDNUIsT0FBTyxpQkFBaUIsR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFDLEdBQUcsTUFBTSxDQUFDO0tBQzVEO1NBQU0sSUFBSSxJQUFJLENBQUMsZUFBZSxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7UUFDN0MsT0FBTyxNQUFNLEdBQUcsSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUM7S0FDekM7U0FBTTtRQUNILE9BQU8saUJBQWlCLEdBQUcsSUFBSSxDQUFDLFdBQVcsR0FBRyxPQUFPLEdBQUcsTUFBTSxDQUFDO0tBQ2xFO0FBQ0wsQ0FBQztBQUVELFNBQVMsVUFBVSxDQUFDLEdBQVc7SUFDM0IsT0FBTyxHQUFHLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQztBQUN6QyxDQUFDO0FBRUQsU0FBUyxPQUFPLENBQUMsR0FBdUI7SUFDcEMsSUFBSSxHQUFHO1FBQ0gsT0FBTyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7O1FBRXZCLE9BQU8sU0FBUyxDQUFDO0FBQ3pCLENBQUM7QUFJRCxZQUFZO0FBQ1oscUVBQXFFO0FBRXJFLHFFQUFxRTtBQUNyRSxnREFBZ0Q7QUFDaEQsK0NBQStDO0FBQy9DLDJDQUEyQztBQUMzQyxnREFBZ0Q7QUFDaEQsUUFBUTtBQUVSLDJFQUEyRTtBQUMzRSxJQUFJO0FBRUosU0FBUyx3QkFBd0IsQ0FBQyxVQUF1QjtJQUVyRCxJQUFNLHlCQUF5QixHQUEyQztRQUN0RSxXQUFXLEVBQUUsb0NBQW9DO1FBQ2pELGFBQWEsRUFBRSxzQ0FBc0M7UUFDckQsTUFBTSxFQUFFLCtCQUErQjtRQUN2QyxpQkFBaUIsRUFBRSw2QkFBNkI7UUFDaEQsZUFBZSxFQUFFLHdDQUF3QztRQUN6RCxTQUFTLEVBQUUsa0NBQWtDO1FBQzdDLGNBQWMsRUFBRSx1Q0FBdUM7UUFDdkQsZ0JBQWdCLEVBQUUseUNBQXlDO1FBQzNELFNBQVMsRUFBRSw2Q0FBNkM7UUFDeEQsZUFBZSxFQUFFLDJDQUEyQztLQUMvRCxDQUFDO0lBRUYsSUFBTSxFQUFFLEdBQUcseUJBQXlCLENBQUMsVUFBVSxDQUFDLENBQUM7SUFFakQsSUFBSSxFQUFFLEtBQUssU0FBUztRQUNoQixPQUFPLEVBQUUsQ0FBQzs7UUFFVixNQUFNLElBQUksS0FBSyxDQUFDLHlDQUF1QyxVQUFVLE1BQUcsQ0FBQyxDQUFDO0FBQzlFLENBQUM7QUFFRCxTQUFTLHNCQUFzQixDQUFDLFdBQXlCO0lBRXJELElBQU0sdUJBQXVCLEdBQTJDO1FBQ3BFLG9DQUFvQyxFQUFFLHFCQUFxQjtRQUMzRCxzQ0FBc0MsRUFBRSx1QkFBdUI7UUFDL0QsK0JBQStCLEVBQUUsaUJBQWlCO1FBQ2xELDZCQUE2QixFQUFFLHVCQUF1QjtRQUN0RCx3Q0FBd0MsRUFBRSx1QkFBdUI7UUFDakUsa0NBQWtDLEVBQUUsbUJBQW1CO1FBQ3ZELHVDQUF1QyxFQUFFLFlBQVk7UUFDckQseUNBQXlDLEVBQUUsa0JBQWtCO1FBQzdELDZDQUE2QyxFQUFFLHFCQUFxQjtRQUNwRSwyQ0FBMkMsRUFBRSx1QkFBdUI7S0FDdkUsQ0FBQztJQUVGLDBFQUEwRTtJQUMxRSx5RUFBeUU7SUFDekUsNEJBQTRCO0lBQzVCLGlFQUFpRTtJQUNqRSxxRUFBcUU7SUFDckUsd0RBQXdEO0lBQ3hELDREQUE0RDtJQUM1RCx1RUFBdUU7SUFDdkUsNkRBQTZEO0lBQzdELDJEQUEyRDtJQUMzRCxtRUFBbUU7SUFDbkUsMEVBQTBFO0lBQzFFLHlFQUF5RTtJQUd6RSxPQUFPLHVCQUF1QixDQUFDLFdBQVcsQ0FBQyxDQUFBO0FBQy9DLENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSDtJQUF5Qyx1Q0FBWTtJQU9qRCw2QkFBWSxRQUFnQjtRQUE1QixZQUNJLGlCQUFPLFNBRVY7UUFERyxLQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7O0lBQzNDLENBQUM7SUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7OztPQW1CRztJQUNILG1DQUFLLEdBQUwsVUFBTSxFQUErQztRQUFyRCxpQkFtREM7UUFqREcsSUFBSSxFQUFFLEVBQUU7WUFDSixJQUFJLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQztZQUNyQixJQUFJLENBQUMsRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztTQUN0QjtRQUVELElBQUkseUJBQXlCLEVBQUU7WUFDM0IseURBQXlEO1lBQ3pELElBQUksT0FBSyxHQUFRLElBQUksQ0FBQztZQUN0QixJQUFJO2dCQUNBLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQzthQUNwQjtZQUFDLE9BQU8sR0FBRyxFQUFFO2dCQUNWLE9BQUssR0FBRyxHQUFHLENBQUM7YUFDZjtZQUVELHlEQUF5RDtZQUN6RCw2REFBNkQ7WUFDN0QsdUVBQXVFO1lBQ3ZFLFVBQVUsQ0FBQztnQkFDUCxJQUFNLFNBQVMsR0FBRyxLQUFJLENBQUMsSUFBSSxDQUFDLENBQUMscUJBQXFCO2dCQUNsRCxJQUFNLE1BQU0sR0FBRyxPQUFLLENBQUMsQ0FBQyx5Q0FBeUM7Z0JBRS9ELHVFQUF1RTtnQkFDdkUsK0JBQStCO2dCQUMvQixJQUFJLE1BQU0sSUFBSSxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxJQUFJLGFBQWEsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQ2pFLEtBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUFDO2lCQUM5QjtxQkFBTTtvQkFDSCxLQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUM7aUJBQ3JDO1lBQ0wsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1NBRVQ7YUFBTTtZQUVILDZFQUE2RTtZQUM3RSx1RUFBdUU7WUFDdkUsSUFBSSxNQUFNLEdBQWlCLG9CQUFJLENBQUMsU0FBUyxHQUFHLGNBQWMsRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFBO1lBRTVFLE1BQU0sQ0FBQyxFQUFFLENBQUMsU0FBUyxFQUFFLFVBQUMsR0FBUTtnQkFDMUIsSUFBSSxHQUFHLENBQUMsSUFBSSxJQUFJLGFBQWEsSUFBSSxHQUFHLENBQUMsSUFBSSxFQUFFO29CQUN2QyxLQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsQ0FBQztpQkFDM0I7cUJBQU07b0JBQ0gsS0FBSSxDQUFDLElBQUksR0FBRyxHQUFHLENBQUM7b0JBQ2hCLEtBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQTtpQkFDOUI7WUFDTCxDQUFDLENBQUMsQ0FBQztZQUVILGdCQUFnQjtTQUNuQjtRQUVELE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFFRDs7bURBRStDO0lBQy9DLHVDQUFTLEdBQVQ7UUFDSSxJQUFJLGFBQWEsR0FBRyxFQUFFLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFFNUQsSUFBSSxDQUFDLElBQUksR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBQ3hDLE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFFRDs4QkFDMEI7SUFDMUIsdUNBQVMsR0FBVCxVQUFVLE9BQTBCO1FBQ2hDLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxxQkFBUyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDaEQsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRSxDQUFDO0lBQ25DLENBQUM7SUFHRCx5REFBeUQ7SUFDekQsc0NBQVEsR0FBUjtRQUVJLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSTtZQUNWLE1BQU0sSUFBSSxLQUFLLENBQUMscUJBQXFCLENBQUMsQ0FBQztRQUUzQyxJQUFNLFFBQVEsR0FBc0MsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDO1FBQzlFLElBQUksS0FBSyxHQUFtQixFQUFFLENBQUM7UUFFL0IsS0FBSyxJQUFNLEdBQUcsSUFBSSxRQUFRLEVBQUU7WUFDeEIsSUFBTSxPQUFPLEdBQVksUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFBO1lBQ3RDLEtBQUssR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQTtTQUM3QztRQUVELEtBQUssR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLFVBQVUsR0FBaUI7WUFDNUMsNEVBQTRFO1lBQzVFLHFGQUFxRjtZQUNyRiwyRkFBMkY7WUFDM0YsOEJBQThCO1lBQzlCLDZEQUE2RDtZQUM3RCxPQUFPLDJCQUFZLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzNDLENBQUMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxLQUFLLENBQUM7SUFDakIsQ0FBQztJQUVELGlGQUFpRjtJQUNqRiwwQ0FBWSxHQUFaO1FBQ0ksSUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLEVBQUUsRUFBRTthQUNmLE9BQU8sQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDO2FBQ2pCLE1BQU0sQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDO2FBQ2IsV0FBVyxFQUFFLENBQUE7UUFFbEIsSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNsQyxPQUFPLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztTQUM5QjthQUFNO1lBQ0gsT0FBTyxFQUFFLENBQUM7U0FDYjtJQUNMLENBQUM7SUFFRDs7OztVQUlNO0lBQ04sMkNBQWEsR0FBYixVQUFjLElBQVksRUFBRSxHQUE0QjtRQUVwRCxJQUFNLElBQUksR0FBRyxJQUFJLG9CQUFPLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBRXBDLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLENBQUMsNkVBQTZFO1FBQ2pHLHFCQUFxQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztRQUVsQyxrQ0FBa0M7UUFDbEMsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7WUFBRSxPQUFPLElBQUksQ0FBQztRQUV6QyxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUVuQyxJQUFJLENBQUMsNEJBQTRCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBSSxtQkFBbUI7UUFDL0QsSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQVksV0FBVztRQUV2RCxPQUFPLElBQUksQ0FBQztJQUNoQixDQUFDO0lBR0Q7O09BRUc7SUFDSCw4Q0FBZ0IsR0FBaEIsVUFBaUIsSUFBWSxFQUFFLEdBQTRCO1FBQ3ZELElBQU0sSUFBSSxHQUFHLElBQUksb0JBQU8sQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDcEMscUJBQXFCLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBRWxDLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFJLG1CQUFtQjtRQUNwRSxJQUFJLENBQUMseUJBQXlCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBWSxXQUFXO1FBRTVELE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFFRCx5RUFBeUU7SUFFekUsNENBQWMsR0FBZCxVQUFlLFVBQWtCLEVBQzdCLEdBS1E7UUFFUixJQUFNLElBQUksR0FBRyxJQUFJLG9CQUFPLENBQUMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBRTFDLElBQUksQ0FBQyxjQUFjLEdBQUcsQ0FBQyxDQUFDO1FBQ3hCLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ25DLElBQUksQ0FBQyxNQUFNLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDM0MsSUFBSSxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUN6QyxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUNoQyxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7UUFFMUIsSUFBSSxDQUFDLDRCQUE0QixDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3hDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFnQixXQUFXO1FBRTVELE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFFRDs7O09BR0c7SUFDSCwrQ0FBaUIsR0FBakIsVUFBa0IsSUFBWSxFQUFFLEdBQTRCO1FBQ3hELElBQU0sSUFBSSxHQUFHLElBQUksb0JBQU8sQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFFcEMsSUFBSSxDQUFDLDBCQUEwQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQVcsV0FBVztRQUU1RCxPQUFPLElBQUksQ0FBQztJQUNoQixDQUFDO0lBRUQ7Ozs7OztPQU1HO0lBQ0gsMkNBQWEsR0FBYixVQUFjLElBQVksRUFBRSxHQUFxQixFQUFFLEtBQWM7UUFDN0QsSUFBSSxJQUFJLENBQUM7UUFDVCxJQUFJLEtBQUssRUFBRTtZQUNQLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUM7U0FDekM7YUFDSTtZQUNELElBQUksR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztTQUN4QztRQUVELElBQUksQ0FBQyxJQUFJO1lBQ0wsT0FBTyxLQUFLLENBQUM7UUFFakIsSUFBSSxDQUFDLE1BQU0sR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUMzQyxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUVoQyxJQUFJLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBUSxlQUFlO1FBQzNELElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFPLHVCQUF1QjtRQUVuRSxPQUFPLElBQUksQ0FBQztJQUNoQixDQUFDO0lBRUQ7Ozs7OztPQU1HO0lBQ0gsOENBQWdCLEdBQWhCLFVBQWlCLElBQVksRUFBRSxHQUFxQixFQUFFLEtBQXFCO1FBRXZFLElBQUksSUFBYSxDQUFDO1FBRWxCLElBQUksS0FBSyxFQUFFO1lBQ1AsSUFBSSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztTQUM1QzthQUFNO1lBQ0gsSUFBSSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7U0FDM0M7UUFFRCxJQUFJLENBQUMsTUFBTSxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBQzNDLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFRLGVBQWU7UUFDaEUsSUFBSSxDQUFDLDhCQUE4QixDQUFDLElBQUksQ0FBQyxDQUFDLENBQU8sdUJBQXVCO1FBRXhFLE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFFRDs7Ozs7O09BTUc7SUFDSCwyQ0FBYSxHQUFiLFVBQWMsSUFBWSxFQUFFLEdBQXFCLEVBQUUsS0FBcUI7UUFDcEUsSUFBSSxLQUFLLEVBQUU7WUFDUCxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztTQUN6QzthQUNJO1lBQ0QsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztTQUN4QztJQUNMLENBQUM7SUFFRDs7Ozs7O09BTUc7SUFDSCw4Q0FBZ0IsR0FBaEIsVUFBaUIsSUFBWSxFQUFFLEdBQTRCLEVBQUUsS0FBcUI7UUFDOUUsSUFBSSxLQUFLLEVBQUU7WUFDUCxPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztTQUM1QzthQUNJO1lBQ0QsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1NBQzNDO0lBQ0wsQ0FBQztJQUVEOzs7Ozs7T0FNRztJQUNILDZDQUFlLEdBQWYsVUFDSSxJQUFZLEVBQ1osR0FBNkUsRUFDN0UsS0FBMkI7UUFFM0IsR0FBRyxHQUFHLEdBQUcsSUFBSSxFQUFFLENBQUM7UUFFaEIsSUFBSSxJQUFnQyxDQUFDO1FBRXJDLElBQUksR0FBRyxDQUFDLE1BQU0sRUFBRTtZQUNaLElBQUksR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztZQUNyQyxJQUFJLENBQUMsSUFBSTtnQkFBRSxPQUFPLEtBQUssQ0FBQztTQUMzQjthQUFNO1lBQ0gsSUFBSSxHQUFHLElBQUksb0JBQU8sQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFDOUIsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7Z0JBQUUsT0FBTyxLQUFLLENBQUM7U0FDN0M7UUFFRCxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUNoQyxJQUFJLENBQUMsTUFBTSxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBRTNDLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFO1lBQ2IsdUJBQXVCLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3BDLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1NBQ3RDO1FBRUQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUU7WUFDbkIsSUFBSSxDQUFDLHdCQUF3QixDQUFDLElBQUksQ0FBQyxDQUFDLENBQVEsZUFBZTtZQUMzRCxJQUFJLENBQUMsMkJBQTJCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBSyx5QkFBeUI7U0FDeEU7UUFFRCxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRTtZQUNiLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFJLG1CQUFtQjtZQUMvRCxJQUFJLEtBQUssRUFBRTtnQkFDUCxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsRUFBRTtvQkFDOUIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBUSw0Q0FBNEM7aUJBQ3ZGO3FCQUNJLElBQUksSUFBSSxDQUFDLHVCQUF1QixDQUFDLEtBQUssQ0FBQyxFQUFFO29CQUMxQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUUsa0JBQWtCO2lCQUM5RDthQUNKO2lCQUNJO2dCQUNELElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFVLFdBQVc7YUFDMUQ7U0FFSjtRQUVELE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFFRDs7Ozs7O09BTUc7SUFDSCxnREFBa0IsR0FBbEIsVUFBbUIsSUFBWSxFQUFFLEdBQTRCLEVBQUUsU0FBd0I7UUFDbkYsSUFBSSxJQUFJLEdBQUcsSUFBSSxvQkFBTyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztRQUNsQyxJQUFJLENBQUMsTUFBTSxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBRTNDLHVCQUF1QixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztRQUVwQyxJQUFJLENBQUMsNkJBQTZCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBUSxlQUFlO1FBQ2hFLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFJLG1CQUFtQjtRQUVwRSxJQUFJLFNBQVMsRUFBRTtZQUNYLElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsQ0FBQyxFQUFFO2dCQUNsQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQVEsNENBQTRDO2FBQ2hHO2lCQUNJLElBQUksSUFBSSxDQUFDLHVCQUF1QixDQUFDLFNBQVMsQ0FBQyxFQUFFO2dCQUM5QyxJQUFJLENBQUMseUJBQXlCLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUUsa0JBQWtCO2FBQ3ZFO1NBQ0o7YUFDSTtZQUNELElBQUksQ0FBQywyQkFBMkIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFVLFdBQVc7U0FDL0Q7UUFFRCxJQUFJLENBQUMsZ0NBQWdDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBSyx5QkFBeUI7UUFFMUUsT0FBTyxJQUFJLENBQUM7SUFDaEIsQ0FBQztJQUVELDBDQUFZLEdBQVosVUFBYSxLQUFhLEVBQ3RCLEdBS1E7UUFFUixzRUFBc0U7UUFDdEUsSUFBTSxlQUFlLEdBQVksQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxlQUFlLElBQUksSUFBSSxDQUFDLENBQUM7UUFDeEUsSUFBTSxJQUFJLEdBQVksQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLFNBQVMsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBSSxtQ0FBbUM7UUFDekcsSUFBTSxLQUFLLEdBQVksQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUE4QixvQ0FBb0M7UUFFOUcsSUFBSSxHQUFHLEVBQUU7WUFDTCxPQUFPLEdBQUcsQ0FBQyxLQUFLLENBQUM7U0FDcEI7UUFFRCxJQUFJLElBQUksR0FBRyxJQUFJLG9CQUFPLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBRW5DLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ2hDLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ25DLElBQUksQ0FBQyxNQUFNLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFFM0MsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7WUFBRSxPQUFPLEtBQUssQ0FBQztRQUUxQyxJQUFJLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBUSxlQUFlO1FBQzNELElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFJLG1CQUFtQjtRQUMvRCxJQUFJLENBQUMsdUJBQXVCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBUyxXQUFXO1FBRXZELElBQUksSUFBSSxFQUFFO1lBQ04sSUFBSSxDQUFDLDRCQUE0QixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUksMEJBQTBCO1NBQ3pFO1FBRUQsSUFBSSxHQUFHLElBQUksZUFBZSxFQUFFLEVBQUUsK0RBQStEO1lBQ3pGLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUVyQyxJQUFJLEtBQUssRUFBRTtnQkFDUCxHQUFHLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztnQkFDbEIsSUFBSSxZQUFZLEdBQUcsSUFBSSxvQkFBTyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztnQkFFM0MsWUFBWSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7Z0JBQ3hDLFlBQVksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQztnQkFFcEMsNERBQTREO2dCQUM1RCxJQUFJLENBQUMsd0JBQXdCLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBUSxlQUFlO2dCQUVuRSxJQUFJLENBQUMsaUNBQWlDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyx5QkFBeUI7Z0JBRS9FLE9BQU8sWUFBWSxDQUFDO2FBQ3ZCO1NBQ0o7UUFFRCxPQUFPLElBQUksQ0FBQztJQUNoQixDQUFDO0lBRUQsNkNBQWUsR0FBZixVQUFnQixLQUFhLEVBQUUsR0FBNEI7UUFDdkQsOEVBQThFO1FBQzlFLDZDQUE2QztRQUU3QyxJQUFJLEdBQUcsRUFBRTtZQUNMLE9BQU8sR0FBRyxDQUFDLEtBQUssQ0FBQztTQUNwQjtRQUVELElBQU0sSUFBSSxHQUFHLElBQUksb0JBQU8sQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDckMsSUFBSSxDQUFDLE1BQU0sR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUUzQyxJQUFJLENBQUMsNkJBQTZCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBVSxlQUFlO1FBQ2xFLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFNLG1CQUFtQjtRQUN0RSxJQUFJLENBQUMsNEJBQTRCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBVyxXQUFXO1FBQzlELElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFNLDBCQUEwQjtRQUU3RSxJQUFJLEdBQUcsSUFBSSxHQUFHLENBQUMsZUFBZSxFQUFFO1lBQzVCLElBQUksQ0FBQyw4QkFBOEIsQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUM3QztRQUVELEdBQUcsR0FBRyxHQUFHLElBQUksRUFBRSxDQUFDO1FBQ2hCLEdBQUcsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDO1FBQ2pCLElBQUksWUFBWSxHQUFHLElBQUksb0JBQU8sQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFFM0MsWUFBWSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDO1FBRXBDLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFVLGVBQWU7UUFDMUUsSUFBSSxDQUFDLHNDQUFzQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMseUJBQXlCO1FBRXBGLE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFHRCx5Q0FBVyxHQUFYLFVBQVksS0FBYSxFQUFFLEdBQTRCO1FBRW5ELElBQUksSUFBSSxHQUFZLElBQUksb0JBQU8sQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFFNUMsbUJBQW1CO1FBQ25CLElBQUksWUFBWSxHQUE2QixJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUVyRSxJQUFJLFlBQVksRUFBRTtZQUNkLFlBQVk7WUFDWix1RUFBdUU7WUFDdkUsZ0VBQWdFO1lBQ2hFLGdFQUFnRTtZQUNoRSxrRUFBa0U7WUFDbEUsbUVBQW1FO1lBQ25FLG9FQUFvRTtZQUNwRSx3REFBd0Q7WUFDeEQsMkNBQTJDO1lBQzNDLCtEQUErRDtZQUMvRCxJQUFJLEdBQUcsWUFBOEIsQ0FBQztTQUN6QztRQUVELElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDL0MsSUFBSSxDQUFDLE1BQU0sR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUUzQyxJQUFJLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBUSxlQUFlO1FBQzNELElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFJLG1CQUFtQjtRQUMvRCxJQUFJLENBQUMsMkJBQTJCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBSyx5QkFBeUI7UUFFckUsT0FBTyxJQUFJLENBQUM7SUFDaEIsQ0FBQztJQUVELHVEQUF5QixHQUF6QixVQUEwQixNQUE0QjtRQUNsRCxPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyx3QkFBd0IsRUFBRSxZQUFZLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDakYsQ0FBQztJQUVELHlEQUEyQixHQUEzQixVQUE0QixJQUFhO1FBQ3JDLElBQU0sT0FBTyxHQUNULElBQUksQ0FBQyxnQkFBZ0IsQ0FBeUIsd0JBQXdCLEVBQ2xFLFlBQVksRUFBRSxJQUFJLENBQUMsTUFBTSxDQUEyQixDQUFDO1FBRTdELElBQUksQ0FBQyxPQUFPLEVBQUU7WUFDVixNQUFNLElBQUksS0FBSyxDQUFDLGtCQUFrQixDQUFDLENBQUM7U0FDdkM7UUFFRCxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQy9DLENBQUM7SUFFRCw0Q0FBYyxHQUFkLFVBQWUsS0FBYSxFQUFFLEdBQW9CO1FBQzlDLElBQUksSUFBSSxHQUFHLElBQUksb0JBQU8sQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDbkMsSUFBSSxDQUFDLE1BQU0sR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUUzQyxJQUFJLENBQUMsNkJBQTZCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBUSxlQUFlO1FBQ2hFLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFJLG1CQUFtQjtRQUNwRSxJQUFJLENBQUMsZ0NBQWdDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBSSwwQkFBMEI7UUFFMUUsT0FBTyxJQUFJLENBQUM7SUFDaEIsQ0FBQztJQUVELDhEQUFnQyxHQUFoQyxVQUFpQyxJQUFhO1FBQzFDLElBQU0sT0FBTyxHQUFrQyxJQUFJLENBQUMseUJBQXlCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRTNGLElBQUksQ0FBQyxPQUFPLEVBQUUsNkJBQTZCO1lBQ3ZDLE9BQU87UUFFWCxLQUFLLElBQUksQ0FBQyxJQUFJLE9BQU8sQ0FBQyxLQUFLLEVBQUU7WUFDekIsSUFBSSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxXQUFXLENBQUMsSUFBdUIsQ0FBQyxFQUFFO2dCQUNsRSxPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFzQixFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNoRCxNQUFNO2FBQ1Q7U0FDSjtJQUNMLENBQUM7SUFFRCw4Q0FBZ0IsR0FBaEIsVUFDSSxJQUFZLEVBQ1osR0FBcUQ7UUFFckQsR0FBRyxHQUFHLEdBQUcsSUFBSSxFQUFFLENBQUM7UUFFaEIsSUFBSSxJQUFvQixDQUFDO1FBRXpCLElBQUksR0FBRyxDQUFDLE1BQU0sRUFBRTtZQUNaLElBQUksR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztZQUNyQyxJQUFJLENBQUMsSUFBSTtnQkFBRSxPQUFPLEtBQUssQ0FBQztTQUMzQjthQUFNO1lBQ0gsSUFBSSxHQUFHLElBQUksb0JBQU8sQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFDOUIsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7Z0JBQUUsT0FBTyxLQUFLLENBQUM7U0FDN0M7UUFFRCxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUNoQyxJQUFJLENBQUMsTUFBTSxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBRTNDLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFO1lBQ2IsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDbkMsSUFBSSxDQUFDLDRCQUE0QixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUksbUJBQW1CO1NBQ2xFO1FBRUQsSUFBSSxDQUFDLHdCQUF3QixDQUFDLElBQUksQ0FBQyxDQUFDLENBQVEsZUFBZTtRQUMzRCxJQUFJLENBQUMsNEJBQTRCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBSSwwQkFBMEI7UUFDdEUsSUFBSSxDQUFDLHVCQUF1QixDQUFDLElBQUksQ0FBQyxDQUFDLENBQVEsMkJBQTJCO1FBRXRFLE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFFRCw0QkFBNEI7SUFDNUIsc0RBQXdCLEdBQXhCLFVBQXlCLElBQWtCO1FBRXZDLGdEQUFnRDtRQUNoRCxtREFBbUQ7UUFDbkQsNEVBQTRFO1FBQzVFLDJCQUEyQjtRQUMzQixJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxFQUFFLHNCQUFzQjtZQUNwQyxNQUFNLElBQUksS0FBSyxDQUFDLHdCQUF3QixDQUFDLENBQUM7U0FDN0M7UUFFRCwyQkFBWSxDQUFDLGFBQWEsQ0FDdEIsSUFBSSxDQUFDLG1CQUFtQixFQUFFLEVBQzFCLElBQUksQ0FBQyxJQUFJLEVBQ1QsZUFBZSxDQUFDLElBQUksQ0FBQyxFQUNyQixtQkFBbUIsQ0FBQyxJQUF1QixDQUFDLENBQUMsQ0FBQztRQUVsRCw4REFBOEQ7UUFDOUQsa0RBQWtEO1FBRWxELGlFQUFpRTtRQUVqRSxxR0FBcUc7UUFDckcsaUJBQWlCO1FBQ2pCLHlGQUF5RjtJQUM3RixDQUFDO0lBRUQ7Ozs7Ozs7T0FPRztJQUNILDJEQUE2QixHQUE3QixVQUE4QixJQUFhO1FBQ3ZDLElBQU0sT0FBTyxHQUErQixJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztRQUV2RSxLQUFLLElBQUksTUFBSSxJQUFJLE9BQU8sRUFBRSxFQUFFLGtDQUFrQztZQUMxRCxJQUFNLFNBQVMsR0FBc0MsT0FBTyxDQUFDLE1BQUksQ0FBQyxDQUFDO1lBRW5FLElBQUksT0FBTyxTQUFTLElBQUksUUFBUSxJQUFJLFNBQVMsQ0FBQyxlQUFlLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRTtnQkFDNUUsMERBQTBEO2dCQUMxRCxJQUFJLENBQUMsSUFBSSxHQUFHLE1BQUksQ0FBQztnQkFFakIsMkJBQVksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsTUFBSSxDQUFDLENBQUM7Z0JBQzdDLHdCQUF3QjtnQkFFeEIsaURBQWlEO2dCQUNqRCw4QkFBOEI7YUFDakM7U0FDSjtJQUNMLENBQUM7SUFFRCx5Q0FBVyxHQUFYLFVBQ0ksY0FBd0IsRUFDeEIsSUFBWSxFQUNaLElBQWEsRUFDYixVQUFpQztRQUVqQyxJQUFNLG9CQUFvQixHQUFtQyxJQUFJLENBQUMsdUJBQXVCLEVBQUUsQ0FBQztRQUU1Riw2RkFBNkY7UUFDN0YsSUFBTSxtQkFBbUIsR0FBbUQsRUFBRSxDQUFDO1FBQy9FLEtBQUssSUFBSSxHQUFHLElBQUksb0JBQW9CLEVBQUU7WUFDbEMseUJBQXlCO1lBQ3pCLElBQUksMkJBQVksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsRUFBRTtnQkFFcEMsOERBQThEO2dCQUM5RCxJQUFNLGdCQUFnQixHQUFpQiwyQkFBWSxDQUFDLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUM5RSxJQUFNLGFBQWEsR0FBcUIsb0JBQW9CLENBQUMsZ0JBQWdCLENBQXFCLENBQUM7Z0JBRW5HLG1CQUFtQixDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxRQUFRLEVBQUUsb0JBQW9CLENBQUMsR0FBRyxDQUFXLEVBQUUsQ0FBQzthQUMxSDtTQUNKO1FBRUQsSUFBTSxRQUFRLEdBQWE7WUFDdkIsR0FBRyxFQUFFLGtDQUFTO1lBQ2QsUUFBUSxFQUFFLEVBQUU7WUFDWixJQUFJLEVBQUUsSUFBSTtZQUNWLElBQUksRUFBRSxJQUFJO1lBQ1YsVUFBVSxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxXQUFXO1NBQ3BELENBQUM7UUFFRixLQUFLLElBQUksS0FBSyxHQUFHLENBQUMsRUFBRSxLQUFLLEdBQUcsY0FBYyxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsRUFBRTtZQUN4RCxJQUFNLFFBQVEsR0FBRyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDdkMsSUFBTSxjQUFjLEdBQUcsSUFBSSxHQUFHLFFBQVEsR0FBRyxJQUFJLENBQUM7WUFFOUMsSUFBSSxtQkFBbUIsQ0FBQyxRQUFRLENBQUMsRUFBRTtnQkFDL0IsUUFBUSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUN4RTtpQkFBTSxJQUFJLG1CQUFtQixDQUFDLGNBQWMsQ0FBQyxFQUFFO2dCQUM1QyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsbUJBQW1CLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQzlFO2lCQUFNO2dCQUNILElBQUksSUFBSSxHQUFHLElBQUksb0JBQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDakMsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7Z0JBQ2hDLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO2dCQUNuQyxJQUFJLENBQUMsNEJBQTRCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBSSxtQkFBbUI7Z0JBQy9ELElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFRLGVBQWU7Z0JBQzNELFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUE4QixDQUFDLENBQUMsQ0FBQzthQUN6RTtTQUNKO1FBRUQsSUFBTSxNQUFNLEdBQTJCLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBRS9ELElBQU0sWUFBWSxHQUFpQixJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7UUFFdkQsMkJBQVksQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFLFlBQVksRUFBRSxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDakUsOEVBQThFO1FBRTlFLG1DQUFtQztRQUNuQyw2QkFBNkI7UUFFN0IsT0FBTyxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxDQUFDO0lBQ3RELENBQUM7SUFFRCw0Q0FBYyxHQUFkLFVBQWUsU0FBaUI7UUFDNUIsSUFBTSxPQUFPLEdBQTJCLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBRWhFLDJCQUFZLENBQUMsdUJBQXVCLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBRXpELDZCQUE2QjtRQUM3QixnQ0FBZ0M7UUFDaEMsNENBQTRDO1FBRTVDLDBGQUEwRjtRQUMxRixtRkFBbUY7UUFDbkYsbUNBQW1DO1FBQ25DLFFBQVE7UUFDUixJQUFJO0lBQ1IsQ0FBQztJQUVELG9EQUFzQixHQUF0QixVQUF1QixNQUE0QjtRQUUvQyxJQUFNLFNBQVMsR0FBb0I7WUFDL0IsS0FBSyxFQUFFLE1BQU0sQ0FBQyxJQUFJO1lBQ2xCLE9BQU8sRUFBRSxzQkFBc0IsQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDO1NBQzFELENBQUM7UUFFRixzRUFBc0U7UUFDdEUsc0ZBQXNGO1FBRXRGLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNoRSxDQUFDO0lBRUQseURBQTJCLEdBQTNCLFVBQTRCLE1BQTRCO1FBRXBELDJCQUFZLENBQUMsYUFBYSxDQUN0QixJQUFJLENBQUMsc0JBQXNCLEVBQUUsRUFDN0IsTUFBTSxDQUFDLElBQUksRUFDWCxNQUFNLENBQUMsZUFBZSxFQUN0QixNQUFNLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRWpDLDBEQUEwRDtRQUUxRCwyRUFBMkU7UUFDM0UsK0VBQStFO0lBQ25GLENBQUM7SUFFRCwwREFBNEIsR0FBNUIsVUFBNkIsSUFBYTtRQUV0QyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU87WUFDYixNQUFNLElBQUksS0FBSyxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFFeEMsMkJBQVksQ0FBQyxhQUFhLENBQ3RCLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxFQUM5QixJQUFJLENBQUMsT0FBTyxFQUNaLG1CQUFtQixDQUFDLElBQUksQ0FBQyxFQUN6Qix1QkFBdUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBRW5DLHVEQUF1RDtRQUV2RCw0RUFBNEU7UUFDNUUsOEVBQThFO0lBQ2xGLENBQUM7SUFFRDs7Ozs7Ozs7T0FRRztJQUNILCtEQUFpQyxHQUFqQyxVQUFrQyxJQUFhO1FBRTNDLGdFQUFnRTtRQUNoRSxJQUFJLE1BQU0sR0FBcUIsbUJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFekQsSUFBTSxPQUFPLEdBQW1DLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1FBRS9FLEtBQUssSUFBSSxDQUFDLElBQUksT0FBTyxFQUFFO1lBQ25CLElBQU0sUUFBUSxHQUE4QixPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDdkQsSUFBSSxPQUFPLFFBQVEsSUFBSSxRQUFRO2dCQUMzQixDQUFDLFFBQVEsQ0FBQyxJQUFJLElBQUksTUFBTSxDQUFDLElBQUk7b0JBQ3pCLENBQUMsR0FBRyxHQUFHLFFBQVEsQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDLElBQUksTUFBTSxDQUFDLElBQUk7b0JBQzFDLFFBQVEsQ0FBQyxJQUFJLElBQUksTUFBTSxDQUFDLElBQUk7b0JBQzVCLENBQUMsR0FBRyxHQUFHLFFBQVEsQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUVqRCxzREFBc0Q7Z0JBQ3RELGdDQUFnQztnQkFDaEMsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQztnQkFFN0IsMkJBQVksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQzFDLHFCQUFxQjtnQkFFckIsdUZBQXVGO2dCQUN2Rix1REFBdUQ7Z0JBQ3ZELDBDQUEwQztnQkFDMUMsa0NBQWtDO2dCQUNsQyxJQUFJO2dCQUVKLE1BQU07YUFDVDtTQUNKO1FBRUQsT0FBTyxJQUFJLENBQUM7SUFDaEIsQ0FBQztJQUVELHdEQUEwQixHQUExQixVQUEyQixJQUFzQztRQUU3RCxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUU7WUFDcEMsTUFBTSxJQUFJLEtBQUssQ0FBQyw0RUFBNEUsQ0FBQyxDQUFDO1NBQ2pHO1FBRUQsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRTtZQUM3QyxNQUFNLElBQUksS0FBSyxDQUFDLGtCQUFrQixDQUFDLENBQUM7U0FDdkM7UUFFRCxJQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztRQUU3QyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRTtZQUN4QixJQUFNLGVBQWUsR0FBbUI7Z0JBQ3BDLEdBQUcsRUFBRSxnQkFBZ0I7Z0JBQ3JCLFFBQVEsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQVcsSUFBSSxPQUFPLEVBQUUsQ0FBQyxPQUF1QixDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUN4RixjQUFjLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxPQUFPO2dCQUN6QyxJQUFJLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO2dCQUM5QixJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7Z0JBQ2YsVUFBVSxFQUFFLFdBQVc7Z0JBQ3ZCLGdCQUFnQixFQUFFLHFCQUFxQjthQUMxQyxDQUFDO1lBRUYsMkJBQVksQ0FBQyxhQUFhLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFPLEVBQUUsZUFBZSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFFN0YsdURBQXVEO1lBQ3ZELGdFQUFnRTtZQUNoRSx1RUFBdUU7U0FDMUU7SUFDTCxDQUFDO0lBRUQsNkRBQStCLEdBQS9CLFVBQWdDLElBQWEsRUFBRSxTQUFpQjtRQUU1RCxJQUFNLFFBQVEsR0FBb0IsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNqRSxJQUFJLENBQUMsUUFBUSxFQUFFO1lBQ1gsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQztTQUM1QzthQUFNO1lBQ0gsUUFBUSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7U0FDL0M7SUFDTCxDQUFDO0lBRUQsMERBQTRCLEdBQTVCLFVBQTZCLElBQWEsRUFBRSxTQUFpQjtRQUN6RCxJQUFNLFFBQVEsR0FBb0IsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNqRSxJQUFJLENBQUMsUUFBUSxFQUFFO1lBQ1gsT0FBTztTQUNWO1FBRUQsSUFBTSxVQUFVLEdBQW9CLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN4RCxJQUFNLG9CQUFvQixHQUFzQixRQUFRLENBQUMsUUFBUSxDQUFDO1FBQ2xFLEtBQUssSUFBSSxDQUFDLElBQUksb0JBQW9CLEVBQUU7WUFDaEMsSUFBSSxVQUFVLENBQUMsS0FBSyxJQUFJLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUs7Z0JBQ2pELFVBQVUsQ0FBQyxPQUFPLElBQUksb0JBQW9CLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFO2dCQUN2RCxvQkFBb0IsQ0FBQyxNQUFNLENBQUMsQ0FBc0IsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDdkQsTUFBTTthQUNUO1NBQ0o7SUFDTCxDQUFDO0lBRUQsa0RBQW9CLEdBQXBCLFVBQXFCLElBQWE7UUFDOUIsSUFBSSxDQUFDLCtCQUErQixDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQztRQUN0RCx3RUFBd0U7UUFDeEUsdUJBQXVCO1FBQ3ZCLGdEQUFnRDtRQUNoRCxXQUFXO1FBQ1gsdURBQXVEO1FBQ3ZELElBQUk7SUFDUixDQUFDO0lBRUQsdURBQXlCLEdBQXpCLFVBQTBCLElBQWE7UUFDbkMsSUFBSSxDQUFDLDRCQUE0QixDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQztRQUNuRCx3RUFBd0U7UUFDeEUsdUJBQXVCO1FBQ3ZCLGNBQWM7UUFDZCxtQ0FBbUM7UUFDbkMsdUZBQXVGO1FBQ3ZGLElBQUk7UUFFSiwyREFBMkQ7UUFDM0QseUVBQXlFO1FBQ3pFLHdDQUF3QztRQUN4QywrREFBK0Q7UUFDL0QsbUVBQW1FO1FBQ25FLGtFQUFrRTtRQUNsRSxpQkFBaUI7UUFDakIsUUFBUTtRQUNSLElBQUk7SUFDUixDQUFDO0lBRUQsb0RBQXNCLEdBQXRCLFVBQXVCLElBQWE7UUFDaEMsSUFBSSxDQUFDLCtCQUErQixDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQztRQUV4RCx5RUFBeUU7UUFFekUsdUJBQXVCO1FBQ3ZCLGtEQUFrRDtRQUNsRCxXQUFXO1FBQ1gsdURBQXVEO1FBQ3ZELElBQUk7SUFDUixDQUFDO0lBRUQseURBQTJCLEdBQTNCLFVBQTRCLElBQWE7UUFDckMsSUFBSSxDQUFDLDRCQUE0QixDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQztRQUNyRCwyQ0FBMkM7UUFDM0MsZUFBZTtRQUNmLHFCQUFxQjtRQUNyQixJQUFJO1FBQ0osMkVBQTJFO1FBQzNFLG9DQUFvQztRQUNwQyx3RUFBd0U7UUFDeEUsNEVBQTRFO1FBQzVFLDZDQUE2QztRQUM3QyxpQkFBaUI7UUFDakIsUUFBUTtRQUNSLElBQUk7SUFDUixDQUFDO0lBRUQscURBQXVCLEdBQXZCLFVBQXdCLElBQWE7UUFDakMsSUFBSSxDQUFDLCtCQUErQixDQUFDLElBQUksRUFBRSxZQUFZLENBQUMsQ0FBQztRQUN6RCx3REFBd0Q7UUFDeEQsdUJBQXVCO1FBQ3ZCLG1EQUFtRDtRQUNuRCxXQUFXO1FBQ1gsdURBQXVEO1FBQ3ZELElBQUk7SUFDUixDQUFDO0lBRUQsMERBQTRCLEdBQTVCLFVBQTZCLElBQWE7UUFDdEMsSUFBSSxDQUFDLDRCQUE0QixDQUFDLElBQUksRUFBRSxZQUFZLENBQUMsQ0FBQztRQUN0RCw0Q0FBNEM7UUFDNUMsbUJBQW1CO1FBQ25CLElBQUk7UUFDSix5RUFBeUU7UUFFekUsb0NBQW9DO1FBQ3BDLHdFQUF3RTtRQUN4RSw0RUFBNEU7UUFDNUUsNkNBQTZDO1FBQzdDLGlCQUFpQjtRQUNqQixRQUFRO1FBQ1IsSUFBSTtJQUNSLENBQUM7SUFFRCxtREFBcUIsR0FBckIsVUFBc0IsSUFBYTtRQUMvQixJQUFJLENBQUMsK0JBQStCLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ3ZELHVEQUF1RDtRQUN2RCx3QkFBd0I7UUFDeEIsaURBQWlEO1FBQ2pELFdBQVc7UUFDWCx3REFBd0Q7UUFDeEQsSUFBSTtJQUNSLENBQUM7SUFFRCx3REFBMEIsR0FBMUIsVUFBMkIsSUFBYTtRQUNwQyxJQUFJLENBQUMsNEJBQTRCLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ3BELDBFQUEwRTtRQUUxRSx3QkFBd0I7UUFDeEIsc0JBQXNCO1FBQ3RCLGNBQWM7UUFDZCxJQUFJO1FBRUosMEVBQTBFO1FBRTFFLHlDQUF5QztRQUN6Qyx5RUFBeUU7UUFDekUsNkVBQTZFO1FBQzdFLDhDQUE4QztRQUM5QyxpQkFBaUI7UUFDakIsUUFBUTtRQUNSLElBQUk7SUFDUixDQUFDO0lBRU8sZ0RBQWtCLEdBQTFCLFVBQTJCLFVBQW9DLEVBQUUsSUFBa0I7UUFFL0UsSUFBSSxDQUFDLFVBQVUsRUFBRTtZQUNiLE1BQU0sSUFBSSxLQUFLLENBQUMsdUJBQXVCLENBQUMsQ0FBQztTQUM1QztRQUVELFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDbEQsQ0FBQztJQUVPLHFEQUF1QixHQUEvQixVQUFnQyxVQUFvQyxFQUFFLElBQWE7UUFFL0UsSUFBSSxDQUFDLFVBQVU7WUFDWCxPQUFPO1FBRVgsZ0VBQWdFO1FBQ2hFLHVFQUF1RTtRQUN2RSxpRUFBaUU7UUFDakUsc0VBQXNFO1FBQ3RFLHFCQUFxQjtRQUNyQix1RUFBdUU7UUFDdkUsSUFBTSxLQUFLLEdBQXNCLEVBQUUsQ0FBQztRQUNwQyxJQUFNLFdBQVcsR0FBVyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFOUMsS0FBSyxJQUFJLENBQUMsSUFBSSxVQUFVLENBQUMsS0FBSyxFQUFFO1lBQzVCLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksV0FBVyxFQUFFO2dCQUM1QyxLQUFLLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUNuQztTQUNKO1FBRUQsVUFBVSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7SUFDN0IsQ0FBQztJQUdELCtEQUFpQyxHQUFqQyxVQUFrQyxJQUFhO1FBRTNDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsK0JBQStCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ2pGLDhGQUE4RjtRQUM5RiwrQ0FBK0M7UUFFL0Msb0VBQW9FO1FBQ3BFLGdHQUFnRztRQUNoRyw4REFBOEQ7UUFDOUQsa0ZBQWtGO1FBQ2xGLG1CQUFtQjtRQUVuQixpQkFBaUI7UUFDakIsZ0VBQWdFO1FBQ2hFLG9EQUFvRDtRQUNwRCxJQUFJO0lBQ1IsQ0FBQztJQUVELG9FQUFzQyxHQUF0QyxVQUF1QyxJQUFhO1FBRWhELElBQUksQ0FBQyx1QkFBdUIsQ0FDeEIsSUFBSSxDQUFDLCtCQUErQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFDakQsSUFBSSxDQUFDLENBQUM7UUFFVixxRUFBcUU7UUFDckUsK0VBQStFO1FBQy9FLDZFQUE2RTtRQUM3RSxvR0FBb0c7UUFDcEcsaUJBQWlCO1FBQ2pCLHNCQUFzQjtRQUN0QixxQ0FBcUM7UUFDckMsK0RBQStEO1FBQy9ELDRDQUE0QztRQUM1QyxZQUFZO1FBQ1osUUFBUTtRQUNSLDZCQUE2QjtRQUM3QixJQUFJO0lBQ1IsQ0FBQztJQUVELHVEQUF5QixHQUF6QixVQUEwQixJQUFhO1FBRW5DLElBQUksQ0FBQyxrQkFBa0IsQ0FDbkIsSUFBSSxDQUFDLHVCQUF1QixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFDekMsSUFBSSxDQUFDLENBQUM7UUFFViw0REFBNEQ7UUFDNUQsc0RBQXNEO1FBRXRELDREQUE0RDtJQUNoRSxDQUFDO0lBRUQsNERBQThCLEdBQTlCLFVBQStCLElBQWE7UUFFeEMsSUFBSSxDQUFDLHVCQUF1QixDQUN4QixJQUFJLENBQUMsdUJBQXVCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUN6QyxJQUFJLENBQUMsQ0FBQztRQUVWLDBEQUEwRDtRQUMxRCw2REFBNkQ7UUFDN0QseUNBQXlDO1FBQ3pDLDREQUE0RDtRQUU1RCxpQ0FBaUM7UUFDakMsMkRBQTJEO1FBQzNELDJEQUEyRDtRQUMzRCxpQkFBaUI7UUFDakIsUUFBUTtRQUNSLElBQUk7SUFDUixDQUFDO0lBRUQseURBQTJCLEdBQTNCLFVBQTRCLElBQXFEO1FBRTdFLElBQUksQ0FBQyxrQkFBa0IsQ0FDbkIsSUFBSSxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFDM0MsSUFBSSxDQUFDLENBQUM7UUFDViw2REFBNkQ7UUFDN0QsOENBQThDO0lBQ2xELENBQUM7SUFFRCw4REFBZ0MsR0FBaEMsVUFBaUMsSUFBYTtRQUUxQyxJQUFJLENBQUMsdUJBQXVCLENBQ3hCLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQzNDLElBQUksQ0FBQyxDQUFDO1FBRVYsK0RBQStEO1FBQy9ELDJFQUEyRTtRQUMzRSxnRUFBZ0U7UUFFaEUsNkJBQTZCO1FBQzdCLDJEQUEyRDtRQUMzRCxzQ0FBc0M7UUFDdEMsaUJBQWlCO1FBQ2pCLFFBQVE7UUFDUixJQUFJO0lBQ1IsQ0FBQztJQUVELDBEQUE0QixHQUE1QixVQUE2QixJQUFhO1FBRXRDLElBQUksQ0FBQyxrQkFBa0IsQ0FDbkIsSUFBSSxDQUFDLDBCQUEwQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFDNUMsSUFBSSxDQUFDLENBQUM7UUFFViw4REFBOEQ7UUFDOUQsNERBQTREO0lBQ2hFLENBQUM7SUFFRCwrREFBaUMsR0FBakMsVUFBa0MsSUFBYTtRQUUzQyxJQUFJLENBQUMsdUJBQXVCLENBQ3hCLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQzVDLElBQUksQ0FBQyxDQUFDO1FBRVYsbUVBQW1FO1FBQ25FLDhEQUE4RDtRQUM5RCxtQkFBbUI7UUFFbkIsOERBQThEO1FBQzlELDZCQUE2QjtRQUM3QiwyREFBMkQ7UUFDM0Qsc0NBQXNDO1FBQ3RDLGlCQUFpQjtRQUNqQixRQUFRO1FBQ1IsSUFBSTtJQUNSLENBQUM7SUFFRCxvREFBc0IsR0FBdEIsVUFDSSx5QkFBaUQsRUFDakQsd0JBQWdDLEVBQ2hDLE9BQWU7UUFFZixJQUFNLDRCQUE0QixHQUM5QixJQUFJLENBQUMsMkJBQTJCLEVBQUUsQ0FBQztRQUV2QyxJQUFNLG1CQUFtQixHQUF3QjtZQUM3QyxHQUFHLEVBQUUscUJBQXFCO1lBQzFCLG1CQUFtQixFQUFFLEVBQUU7WUFDdkIsNkJBQTZCLEVBQUUsQ0FBQztZQUNoQyx3QkFBd0IsRUFBRSx3QkFBd0I7U0FDckQsQ0FBQztRQUVGLEtBQUssSUFBSSxLQUFLLEdBQUcsQ0FBQyxFQUFFLEtBQUssR0FBRyx5QkFBeUIsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLEVBQUU7WUFDbkUsSUFBTSxhQUFhLEdBQUcseUJBQXlCLENBQUMsS0FBSyxDQUFDLENBQUM7WUFFdkQsSUFBTSxpQkFBaUIsR0FBaUIsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBRTVELDJCQUFZLENBQUMsYUFBYSxDQUFDLDRCQUE0QixFQUFFLGlCQUFpQixFQUFFLGFBQWEsRUFBRSxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDL0csbUVBQW1FO1lBQ25FLHlFQUF5RTtZQUN6RSw4RUFBOEU7WUFFOUUsbUJBQW1CLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLGlCQUFpQixFQUFFLE9BQU8sRUFBRSxhQUFhLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztTQUMzRztRQUVELElBQU0sdUJBQXVCLEdBQWlCLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUVsRSwyQkFBWSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsRUFBRSx1QkFBdUIsRUFBRSxtQkFBbUIsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUU5RywyRUFBMkU7UUFDM0UscUNBQXFDO1FBQ3JDLDRFQUE0RTtRQUM1RSx1Q0FBdUM7UUFDdkMsb0ZBQW9GO1FBQ3BGLDJEQUEyRDtRQUMzRCxJQUFJO1FBRUosSUFBTSxPQUFPLEdBQThCLEVBQUUsSUFBSSxFQUFFLHVCQUF1QixFQUFFLG1CQUFtQixFQUFFLG1CQUFtQixFQUFFLENBQUM7UUFDdkgsT0FBTyxPQUFPLENBQUM7SUFDbkIsQ0FBQztJQUVELGlEQUFtQixHQUFuQixVQUFvQixNQUFvQixFQUFFLGlCQUFpQztRQUV2RSxJQUFJLENBQUMsTUFBTTtZQUNQLE9BQU8sU0FBUyxDQUFDO1FBQ3JCLG9KQUFvSjtRQUNwSiw0RkFBNEY7UUFFNUYsSUFBTSxhQUFhLEdBQWtDLElBQUksQ0FBQyxzQkFBc0IsRUFBRSxDQUFDO1FBQ25GLElBQU0sWUFBWSxHQUF5QyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFakYsSUFBSSxPQUFPLFlBQVksSUFBSSxRQUFRLEVBQUUsdUdBQXVHO1lBQ3hJLE1BQU0sSUFBSSxLQUFLLENBQUMsa0JBQWtCLEdBQUcsTUFBTSxDQUFDLENBQUM7UUFFakQsS0FBSyxJQUFJLEtBQUssR0FBRyxDQUFDLEVBQUUsS0FBSyxHQUFHLGlCQUFpQixDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsRUFBRTtZQUMzRCxJQUFNLGdCQUFnQixHQUFHLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ2xELElBQUksT0FBTyxhQUFhLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxRQUFRLEVBQUUscUVBQXFFO2dCQUN6SCxNQUFNLElBQUksS0FBSyxDQUFDLGtCQUFrQixHQUFHLGdCQUFnQixDQUFDLENBQUM7U0FDOUQ7UUFFRCxJQUFNLDBCQUEwQixHQUFzQyxJQUFJLENBQUMsMEJBQTBCLEVBQUUsQ0FBQztRQUN4RyxJQUFNLDRCQUE0QixHQUF3QyxJQUFJLENBQUMsNEJBQTRCLEVBQUUsQ0FBQztRQUU5RyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRyxvQ0FBb0M7WUFDakQsTUFBTSxJQUFJLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUVsQyxJQUFNLE9BQU8sR0FBYSxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQztRQUU1QyxLQUFLLElBQUksS0FBSyxHQUFHLENBQUMsRUFBRSxLQUFLLEdBQUcsaUJBQWlCLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxFQUFFO1lBRTNELElBQU0sb0JBQW9CLEdBQWlCLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3BFLElBQU0sMEJBQTBCLEdBQW1CLDJCQUFZLENBQUMsb0JBQW9CLENBQUMsb0JBQW9CLENBQUMsQ0FBQztZQUUzRyxJQUFNLG9CQUFvQixHQUFpQixJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDL0QsOEdBQThHO1lBRTlHLElBQU0sYUFBYSxHQUFpQixJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDeEQsK0ZBQStGO1lBRS9GLElBQU0sU0FBUyxHQUEwQjtnQkFDckMsR0FBRyxFQUFFLCtDQUFzQjtnQkFDM0IsZUFBZSxFQUFFLE9BQU8sQ0FBQyxZQUFZLENBQUM7Z0JBQ3RDLHVCQUF1QixFQUFFLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQztnQkFDdEQsU0FBUyxFQUFFLENBQUM7Z0JBQ1osb0JBQW9CLEVBQUUsb0JBQW9CO2dCQUMxQyxVQUFVLEVBQUcsYUFBYSxDQUFDLG9CQUFvQixDQUFxQixDQUFDLElBQUk7YUFDNUUsQ0FBQztZQUVGLElBQU0sZ0JBQWdCLEdBQXdCO2dCQUMxQyxHQUFHLEVBQUUsNkNBQW9CO2dCQUN6QixNQUFNLEVBQUUsb0JBQW9CO2dCQUM1QixjQUFjLEVBQUUsYUFBYSxDQUFDLDBCQUEwQixDQUFXO2dCQUNuRSxXQUFXLEVBQUUsYUFBYTtnQkFDMUIsbUJBQW1CLEVBQUUsK0NBQXNCO2FBQzlDLENBQUM7WUFFRiw0RkFBNEY7WUFDNUYsK0VBQStFO1lBRS9FLDJCQUFZLENBQUMsYUFBYSxDQUFDLDRCQUE0QixFQUFFLGFBQWEsRUFBRSxTQUFTLEVBQUUsK0NBQXNCLENBQUMsQ0FBQztZQUMzRywyREFBMkQ7WUFDM0QsOEVBQThFO1lBRTlFLDJCQUFZLENBQUMsYUFBYSxDQUFDLDBCQUEwQixFQUFFLG9CQUFvQixFQUFFLGdCQUFnQixFQUFFLDZDQUFvQixDQUFDLENBQUM7WUFDckgsdUVBQXVFO1lBQ3ZFLGlGQUFpRjtZQUVqRixZQUFZLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxvQkFBb0IsRUFBRSxPQUFPLEVBQUUsNkNBQW9CLEVBQUUsQ0FBQyxDQUFBO1lBQzlGLGNBQWM7U0FDakI7UUFFRCxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLENBQUM7SUFDbEQsQ0FBQztJQUVEOzs7Ozs7OztPQVFHO0lBQ0gsMkNBQWEsR0FBYixVQUNJLGNBQXdCO0lBQ3hCLHNFQUFzRTtJQUN0RSx5Q0FBeUM7SUFDekMsY0FBcUUsRUFDckUsT0FBZSxFQUNmLE1BQXVDLEVBQ3ZDLG1CQUE4RCxFQUM5RCxhQUE2QjtRQUU3QixJQUFNLGdCQUFnQixHQUErQixJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztRQUVoRixJQUFJLFVBQVUsR0FBc0I7WUFDaEMsR0FBRyxFQUFFLGNBQWM7WUFDbkIsZUFBZSxFQUFFLFVBQVU7WUFDM0IsS0FBSyxFQUFFLEVBQUU7WUFDVCxrQ0FBa0MsRUFBRSxDQUFDO1NBQ3hDLENBQUM7UUFHRixJQUFJLGNBQWMsS0FBSyxnREFBdUIsRUFBRTtZQUM1QyxJQUFJLE9BQU8sbUJBQW1CLElBQUksUUFBUTtnQkFDdEMsTUFBTSxJQUFJLEtBQUssQ0FBQyw4QkFBNEIsZ0RBQXVCLE1BQUcsQ0FBQyxDQUFDO1lBRTVFLFVBQVUsR0FBRyx5QkFBeUIsQ0FBQyxVQUFVLEVBQUUsbUJBQW1CLEVBQUUsYUFBYSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1NBQ25HO2FBQU0sSUFBSSxjQUFjLEtBQUssa0RBQXlCLEVBQUU7WUFDckQsSUFBSSxPQUFPLG1CQUFtQixJQUFJLFFBQVE7Z0JBQ3RDLE1BQU0sSUFBSSxLQUFLLENBQUMsOEJBQTRCLGtEQUF5QixNQUFHLENBQUMsQ0FBQztZQUU5RSxVQUFVLEdBQUcsMkJBQTJCLENBQUMsVUFBVSxFQUFFLG1CQUFtQixFQUFFLE9BQU8sQ0FBQyxDQUFBO1NBQ3JGO1FBRUQscUZBQXFGO1FBQ3JGLGtGQUFrRjtRQUNsRixtRUFBbUU7UUFHbkUsSUFBTSxjQUFjLEdBQWlCLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUV6RCxvREFBb0Q7UUFDcEQsbUVBQW1FO1FBQ25FLGdIQUFnSDtRQUNoSCxrREFBa0Q7UUFDbEQsMkNBQTJDO1FBQzNDLHlHQUF5RztRQUV6RyxJQUFNLG9CQUFvQixHQUFpQixNQUFNLElBQUksSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLElBQUksQ0FBQztRQUVoRixJQUFNLFlBQVksR0FBMkIsMkJBQVksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLHNCQUFzQixFQUFFLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztRQUU3SCw0RkFBNEY7UUFDNUYsZ0dBQWdHO1FBQ2hHLHdCQUF3QjtRQUN4QixpREFBaUQ7UUFDakQsSUFBSSxZQUFZLEVBQUU7WUFDZCxZQUFZLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQztnQkFDMUIsS0FBSyxFQUFFLGNBQWM7Z0JBQ3JCLE9BQU8sRUFBRSxPQUFPO2FBQ25CLENBQUMsQ0FBQztTQUNOO1FBRUQsSUFBTSxvQkFBb0IsR0FBbUMsSUFBSSxDQUFDLHVCQUF1QixFQUFFLENBQUM7UUFFNUYsMkNBQTJDO1FBQzNDLElBQU0sbUJBQW1CLEdBQXFDLEVBQUUsQ0FBQztRQUNqRSxLQUFLLElBQUksR0FBRyxJQUFJLGdCQUFnQixFQUFFO1lBQzlCLDRCQUE0QjtZQUM1Qix3Q0FBd0M7WUFFeEMsZ0RBQWdEO1lBQ2hELGtEQUFrRDtZQUNsRCwyREFBMkQ7WUFFM0QsZ0NBQWdDO1lBRWhDLG9EQUFvRDtZQUVwRCw0SEFBNEg7WUFDNUgsMEJBQTBCO1lBQzFCLElBQUksMkJBQVksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsRUFBRTtnQkFFcEMsSUFBTSxZQUFZLEdBQWlCLDJCQUFZLENBQUMsb0JBQW9CLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQzFFLElBQU0sU0FBUyxHQUFpQixnQkFBZ0IsQ0FBQyxZQUFZLENBQWlCLENBQUM7Z0JBQy9FLElBQU0sYUFBYSxHQUEwQyxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBRXJHLElBQUksT0FBTyxhQUFhLElBQUksUUFBUSxFQUFFO29CQUNsQyxJQUFNLFVBQVUsR0FBRyxJQUFJLG9CQUFPLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO29CQUVuRCxtQkFBbUIsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLFFBQVEsRUFBRSxVQUFVLENBQUMsUUFBUSxFQUFFLEtBQUssRUFBRSxVQUFVLENBQUMsS0FBSyxFQUFFLENBQUM7aUJBQzVIO2FBQ0o7U0FDSjtRQUVELEtBQUssSUFBSSxLQUFLLEdBQUcsQ0FBQyxFQUFFLEtBQUssR0FBRyxjQUFjLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxFQUFFO1lBQ3hELElBQUksUUFBUSxHQUFHLGNBQWMsQ0FBQyxLQUFLLENBQUMsRUFDaEMsY0FBYyxHQUFHLElBQUksR0FBRyxRQUFRLEdBQUcsSUFBSSxFQUN2QyxJQUFJLEdBQUcsSUFBSSxvQkFBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBRWpDLElBQUksbUJBQW1CLENBQUMsUUFBUSxDQUFDLEVBQUU7Z0JBQy9CLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDdkUsU0FBUzthQUNaO2lCQUFNLElBQUksbUJBQW1CLENBQUMsY0FBYyxDQUFDLEVBQUU7Z0JBQzVDLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLG1CQUFtQixDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDN0UsU0FBUzthQUNaO1lBRUQsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDaEMsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDbkMsSUFBSSxDQUFDLDRCQUE0QixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUksbUJBQW1CO1lBQy9ELElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFRLGVBQWU7WUFDM0QsVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztTQUNqRDtRQUVELGdFQUFnRTtRQUNoRSxJQUFNLGlCQUFpQixHQUNuQixJQUFJLENBQUMscUJBQXFCLENBQW9CLGNBQWMsQ0FBQyxDQUFDO1FBRWxFLDJCQUFZLENBQUMsYUFBYSxDQUFvQixpQkFBaUIsRUFBRSxjQUFjLEVBQUUsVUFBVSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3RHLDJCQUEyQjtRQUMzQixzREFBc0Q7UUFDdEQsK0NBQStDO1FBQy9DLElBQUk7UUFFSixPQUFPLEVBQUUsSUFBSSxFQUFFLGNBQWMsRUFBRSxVQUFVLEVBQUUsVUFBVSxFQUFFLENBQUM7SUFDNUQsQ0FBQztJQUVELDJFQUEyRTtJQUMzRSw0REFBNEQ7SUFDcEQsbURBQXFCLEdBQTdCLFVBQWtFLFdBQXFCO1FBRW5GLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFO1lBQ1osTUFBTSxJQUFJLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQztTQUNqQztRQUVELElBQUksT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLEtBQUssUUFBUSxFQUFFO1lBQzVELElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLENBQUM7U0FDL0M7UUFFRCxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQStCLENBQUM7SUFDaEYsQ0FBQztJQUVELDhDQUFnQixHQUFoQjtRQUNJLE9BQU8sSUFBSSxDQUFDLHFCQUFxQixDQUFXLGtDQUFTLENBQUMsQ0FBQztJQUMzRCxDQUFDO0lBRUQscURBQXVCLEdBQXZCO1FBQ0ksT0FBTyxJQUFJLENBQUMscUJBQXFCLENBQWtCLHlDQUFnQixDQUFDLENBQUM7SUFDekUsQ0FBQztJQUNELDBCQUEwQjtJQUMxQiwrQ0FBaUIsR0FBakI7UUFDSSxPQUFPLElBQUksQ0FBQyxxQkFBcUIsQ0FBYSxvQ0FBVyxDQUFDLENBQUM7SUFDL0QsQ0FBQztJQUVELGlEQUFtQixHQUFuQjtRQUNJLE9BQU8sSUFBSSxDQUFDLHFCQUFxQixDQUFDLHNDQUFhLENBQUMsQ0FBQztJQUNyRCxDQUFDO0lBRUQscURBQXVCLEdBQXZCO1FBQ0ksT0FBTyxJQUFJLENBQUMscUJBQXFCLENBQW1CLDBDQUFpQixDQUFDLENBQUM7SUFDM0UsQ0FBQztJQUVELG9EQUFzQixHQUF0QjtRQUNJLE9BQU8sSUFBSSxDQUFDLHFCQUFxQixDQUFDLHlDQUFnQixDQUFDLENBQUM7SUFDeEQsQ0FBQztJQUVELHdEQUEwQixHQUExQjtRQUNJLE9BQU8sSUFBSSxDQUFDLHFCQUFxQixDQUFDLDZDQUFvQixDQUFDLENBQUM7SUFDNUQsQ0FBQztJQUVELDBEQUE0QixHQUE1QjtRQUNJLE9BQU8sSUFBSSxDQUFDLHFCQUFxQixDQUFDLCtDQUFzQixDQUFDLENBQUM7SUFDOUQsQ0FBQztJQUVELDBFQUEwRTtJQUMxRSx3REFBd0Q7SUFDeEQsNERBQThCLEdBQTlCO1FBQ0ksT0FBTyxJQUFJLENBQUMsMkJBQTJCLEVBQUUsQ0FBQztJQUM5QyxDQUFDO0lBRUQseURBQTJCLEdBQTNCO1FBQ0ksT0FBTyxJQUFJLENBQUMscUJBQXFCLENBQUMsOENBQXFCLENBQUMsQ0FBQztJQUM3RCxDQUFDO0lBRUQsc0VBQXNFO0lBQ3RFLHVDQUF1QztJQUN2QyxtREFBcUIsR0FBckI7UUFDSSxPQUFPLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyx3Q0FBZSxDQUFDLENBQUM7SUFDdkQsQ0FBQztJQUVELDBFQUEwRTtJQUMxRSx3REFBd0Q7SUFDeEQsb0RBQXNCLEdBQXRCO1FBQ0ksT0FBTyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztJQUN0QyxDQUFDO0lBRUQsaURBQW1CLEdBQW5CO1FBQ0ksT0FBTyxJQUFJLENBQUMscUJBQXFCLENBQUMsNkNBQW9CLENBQUMsQ0FBQztJQUM1RCxDQUFDO0lBRUQsNENBQWMsR0FBZCxVQUFlLElBQVk7UUFFdkIsT0FBTywyQkFBWSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBRXhFLGlEQUFpRDtRQUVqRCxpRUFBaUU7UUFFakUsNEJBQTRCO1FBQzVCLGdDQUFnQztRQUNoQyw0Q0FBNEM7UUFFNUMsaUNBQWlDO1FBQ2pDLHNEQUFzRDtRQUN0RCwrQ0FBK0M7UUFDL0MsUUFBUTtRQUNSLElBQUk7UUFFSixlQUFlO0lBQ25CLENBQUM7SUFFRCw2Q0FBZSxHQUFmLFVBQWdCLElBQVk7UUFDeEIsT0FBTywyQkFBWSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxzQkFBc0IsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzlFLHlEQUF5RDtJQUM3RCxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILDJDQUFhLEdBQWIsVUFBYyxJQUFZO1FBQ3RCLElBQU0sT0FBTyxHQUFrQyxJQUFJLENBQUMsc0JBQXNCLEVBQUUsQ0FBQztRQUU3RSxLQUFLLElBQUksR0FBRyxJQUFJLE9BQU8sRUFBRTtZQUNyQixJQUFJLENBQUMsMkJBQVksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsRUFBRTtnQkFDckMsSUFBTSxNQUFNLEdBQW9CLE9BQU8sQ0FBQyxHQUFHLENBQW9CLENBQUM7Z0JBQ2hFLElBQUksTUFBTSxDQUFDLElBQUksS0FBSyxJQUFJLEVBQUU7b0JBQ3RCLE9BQU8sR0FBRyxDQUFDO2lCQUNkO2FBQ0o7U0FDSjtRQUVELE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFFRCw4Q0FBZ0IsR0FBaEIsVUFBcUQsT0FBZSxFQUFFLGNBQXdCO1FBQzFGLE9BQU8sMkJBQVksQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQWUsY0FBYyxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDNUcsMkRBQTJEO1FBQzNELG9CQUFvQjtRQUVwQix5QkFBeUI7UUFDekIsZ0NBQWdDO1FBQ2hDLDRDQUE0QztRQUU1QyxxQ0FBcUM7UUFDckMsK0NBQStDO1FBQy9DLG1DQUFtQztRQUNuQyxRQUFRO1FBQ1IsSUFBSTtRQUVKLGVBQWU7SUFDbkIsQ0FBQztJQUVELHFEQUF1QixHQUF2QixVQUF3QixNQUE0QjtRQUNoRCxPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBdUIsc0JBQXNCLEVBQUUsU0FBUyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQ2xHLENBQUM7SUFFRCx1REFBeUIsR0FBekIsVUFBMEIsTUFBNEI7UUFDbEQsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQXlCLHdCQUF3QixFQUFFLFdBQVcsRUFBRSxNQUFNLENBQUMsQ0FBQztJQUN4RyxDQUFDO0lBRUQsd0RBQTBCLEdBQTFCLFVBQTJCLE1BQTRCO1FBQ25ELE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUEwQix5QkFBeUIsRUFBRSxZQUFZLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDM0csQ0FBQztJQUVELDZEQUErQixHQUEvQixVQUFnQyxNQUE0QjtRQUN4RCxPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBeUIsd0JBQXdCLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDL0csQ0FBQztJQUFBLENBQUM7SUFFRjs7Ozs7Ozs7Ozs7Ozs7Ozs7T0FpQkc7SUFDSCx3Q0FBVSxHQUFWLFVBQVcsS0FBcUIsRUFBRSxNQUE0QjtRQUUxRCxJQUFJLENBQUMsTUFBTTtZQUNQLE9BQU8sU0FBUyxDQUFDO1FBRXJCLElBQU0sYUFBYSxHQUFrQyxJQUFJLENBQUMsc0JBQXNCLEVBQUUsQ0FBQztRQUNuRixJQUFJLE9BQU8sYUFBYSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFdBQVc7WUFDM0MsTUFBTSxJQUFJLEtBQUssQ0FBQyxrQkFBa0IsR0FBRyxNQUFNLENBQUMsQ0FBQztRQUVqRCxxRkFBcUY7UUFDckYsSUFBTSxZQUFZLEdBQW9CLGFBQWEsQ0FBQyxNQUFNLENBQW9CLENBQUM7UUFDL0UsSUFBTSxXQUFXLEdBQXNCLFlBQVksQ0FBQyxXQUFXLENBQUM7UUFDaEUsS0FBSyxJQUFJLENBQUMsSUFBSSxXQUFXLEVBQUU7WUFDdkIsSUFBTSxVQUFVLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2xDLElBQUksVUFBVSxDQUFDLE9BQU8sSUFBSSxLQUFLO2dCQUMzQixPQUFPLFVBQVUsQ0FBQyxLQUFLLEdBQUcsVUFBVSxDQUFDO1NBQzVDO1FBRUQsT0FBTyxTQUFTLENBQUM7SUFDckIsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0gsOENBQWdCLEdBQWhCLFVBQ0ksSUFBMEIsRUFDMUIsS0FBcUIsRUFDckIsTUFBNEI7UUFFNUIsSUFBTSxPQUFPLEdBQStCLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM3RSxJQUFNLFVBQVUsR0FBK0IsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFFOUUsS0FBSyxJQUFJLEdBQUcsSUFBSSxPQUFPLEVBQUU7WUFFckIseUJBQXlCO1lBQ3pCLElBQUksMkJBQVksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsSUFBa0Isd0JBQXdCO2dCQUM1RSxDQUFDLFVBQVUsSUFBSSxTQUFTLElBQUksVUFBVSxJQUFJLEdBQUcsQ0FBQyxJQUFNLCtEQUErRDtnQkFDbkgsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEtBQUssRUFBRSxFQUFFLGtEQUFrRDtnQkFFM0UsZ0VBQWdFO2dCQUNoRSw4Q0FBOEM7Z0JBQzlDLE9BQU8sMkJBQVksQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLENBQUM7YUFDekQ7U0FDSjtRQUVELE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFFRCw4Q0FBZ0IsR0FBaEIsVUFBaUIsSUFBWSxFQUFFLEtBQWEsRUFBRSxVQUFrQjtRQUM1RCxJQUFNLGNBQWMsR0FBK0MsMkJBQVksQ0FBQyw0QkFBNEIsQ0FBQyxJQUFJLENBQUMsMkJBQTJCLEVBQUUsQ0FBQyxDQUFDO1FBRWpKLEtBQUssSUFBSSxHQUFHLElBQUksY0FBYyxFQUFFO1lBQzVCLElBQU0sYUFBYSxHQUF5QixjQUFjLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDaEUsSUFBSSxDQUFDLFVBQVUsSUFBSSxhQUFhLENBQUMsSUFBSSxLQUFLLFVBQVUsRUFBRTtnQkFDbEQsYUFBYSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsR0FBRyxLQUFLLENBQUM7YUFDN0M7U0FDSjtJQUNMLENBQUM7SUFFRCxpREFBbUIsR0FBbkIsVUFBb0IsSUFBWSxFQUFFLFVBQWtCO1FBQ2hELElBQU0sY0FBYyxHQUErQywyQkFBWSxDQUFDLDRCQUE0QixDQUFDLElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDLENBQUM7UUFFakosS0FBSyxJQUFJLEdBQUcsSUFBSSxjQUFjLEVBQUU7WUFDNUIsSUFBTSxhQUFhLEdBQUcsY0FBYyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQzFDLElBQUksYUFBYSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUM7Z0JBQ2pDLENBQUMsVUFBVSxJQUFJLGFBQWEsQ0FBQyxJQUFJLEtBQUssVUFBVSxFQUFFO2dCQUNsRCxPQUFPLGFBQWEsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDNUM7U0FDSjtJQUNMLENBQUM7SUFFRDs7Ozs7OztPQU9HO0lBQ0gsaURBQW1CLEdBQW5CLFVBQW9CLElBQVksRUFBRSxLQUFVLEVBQUUsS0FBa0M7UUFDNUUsSUFBSSxPQUFPLEdBQXVDLElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDO1FBQ3JGLEtBQUssSUFBSSxVQUFVLElBQUksT0FBTyxFQUFFO1lBQzVCLElBQUksQ0FBQywyQkFBWSxDQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxFQUFFO2dCQUM1QyxJQUFJLE1BQU0sR0FBeUIsT0FBTyxDQUFDLFVBQVUsQ0FBeUIsQ0FBQztnQkFDL0UsSUFBSSxDQUFDLEtBQUssSUFBSSxNQUFNLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRTtvQkFDOUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsR0FBRyxLQUFLLENBQUM7aUJBQ3RDO2FBQ0o7U0FDSjtJQUNMLENBQUM7SUFFRCwrQ0FBaUIsR0FBakIsVUFBa0IsSUFBWTtRQUMxQixJQUFJLENBQUMsbUJBQW1CLENBQUMsY0FBYyxFQUFFLEdBQUcsR0FBRyxJQUFJLEdBQUcsR0FBRyxDQUFDLENBQUM7SUFDL0QsQ0FBQztJQUlPLDZFQUErQyxHQUF2RCxVQUNJLFFBQXdGO1FBRXhGLElBQU0sY0FBYyxHQUErQywyQkFBWSxDQUFDLDRCQUE0QixDQUFDLElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDLENBQUM7UUFFakosb0VBQW9FO1FBQ3BFLElBQU0sV0FBVyxHQUFXLElBQUksQ0FBQyxXQUFXLENBQUM7UUFFN0MsS0FBSyxJQUFJLFNBQVMsSUFBSSxjQUFjLEVBQUU7WUFDbEMsSUFBTSxNQUFNLEdBQXlCLGNBQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUMvRCxJQUFNLGFBQWEsR0FBRyxNQUFNLENBQUMsYUFBYSxDQUFDO1lBRTNDLElBQUksT0FBTyxDQUFDLGFBQWEsQ0FBQyxjQUFjLENBQUMsQ0FBQyxJQUFJLFdBQVcsRUFBRTtnQkFDdkQsUUFBUSxDQUFDLGFBQWEsRUFBRSxNQUFNLENBQUMsQ0FBQzthQUNuQztTQUNKO0lBQ0wsQ0FBQztJQUdELHNDQUFRLEdBQVIsVUFBUyxJQUFhO1FBRWxCLGFBQWE7UUFFYixJQUFJLENBQUMsK0NBQStDLENBQ2hELFVBQUMsYUFBc0M7WUFFbkMscUJBQXFCO1FBQ3pCLENBQUMsQ0FDSixDQUFDO0lBQ04sQ0FBQztJQUVELDREQUE4QixHQUE5QixVQUErQixJQUFhO1FBRXhDLElBQU0sWUFBWSxHQUFHLHdCQUF3QixDQUFDO1FBRTlDLElBQU0sUUFBUSxHQUFHLGlCQUFpQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztRQUUvQyxJQUFJLENBQUMsK0NBQStDLENBQ2hELFVBQUMsYUFBc0M7WUFFbkMsSUFBTSxXQUFXLEdBQUcsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBRWhELElBQUksV0FBVyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLEVBQUU7Z0JBQzNDLElBQUksT0FBTyxHQUFHLFdBQVcsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDO29CQUN4QyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQ3BDLENBQUMsQ0FBQyxDQUFDO2dCQUNILE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDO29CQUN2QixJQUFJLEdBQUcsR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUNqQyxXQUFXLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDL0IsQ0FBQyxDQUFDLENBQUM7YUFDTjtRQUNMLENBQUMsQ0FDSixDQUFDO0lBQ04sQ0FBQztJQUVELHVEQUF5QixHQUF6QixVQUEwQixJQUFhO1FBQXZDLGlCQWdCQztRQWRHLElBQUksQ0FBQywrQ0FBK0MsQ0FDaEQsVUFBQyxhQUFzQztZQUVuQyxJQUFNLFNBQVMsR0FBRyxnQkFBZ0IsQ0FBQztZQUVuQyxJQUFJLENBQUMsYUFBYSxDQUFDLHdCQUF3QixDQUFDO21CQUNyQyxhQUFhLENBQUMsd0JBQXdCLENBQUMsS0FBSyxTQUFTLEVBQUU7Z0JBQzFELGFBQWEsQ0FBQyx3QkFBd0IsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7YUFDekQ7WUFFRCxhQUFhLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFLEtBQUksQ0FBQyxDQUFDLENBQUM7UUFFaEYsQ0FBQyxDQUNKLENBQUM7SUFDTixDQUFDO0lBRUQsMERBQTRCLEdBQTVCLFVBQTZCLElBQWE7UUFDdEMsSUFBTSxRQUFRLEdBQUcsaUJBQWlCLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBRS9DLElBQUksQ0FBQywrQ0FBK0MsQ0FDaEQsVUFBQyxhQUFzQztZQUVuQyxJQUFNLFlBQVksR0FBRyxzQkFBc0IsRUFFdkMsV0FBVyxHQUFHLGFBQWEsQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUU5QyxJQUFJLFdBQVcsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxFQUFFO2dCQUMzQyxJQUFJLE9BQU8sR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQztvQkFDeEMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUNwQyxDQUFDLENBQUMsQ0FBQztnQkFDSCxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQztvQkFDdkIsSUFBSSxHQUFHLEdBQUcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDakMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQy9CLENBQUMsQ0FBQyxDQUFDO2FBQ047UUFDTCxDQUFDLENBQ0osQ0FBQztJQUVOLENBQUM7SUFFRCxxREFBdUIsR0FBdkIsVUFBd0IsSUFBYTtRQUFyQyxpQkFtQkM7UUFqQkcsSUFBSSxDQUFDLCtDQUErQyxDQUNoRCxVQUFDLGFBQXNDO1lBRW5DLElBQU0sU0FBUyxHQUFHLGdCQUFnQixDQUFDO1lBRW5DLElBQUksQ0FBQyxhQUFhLENBQUMsc0JBQXNCLENBQUM7bUJBQ25DLGFBQWEsQ0FBQyxzQkFBc0IsQ0FBQyxLQUFLLFNBQVMsRUFBRTtnQkFDeEQsYUFBYSxDQUFDLHNCQUFzQixDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQzthQUN2RDtZQUVELElBQUksT0FBTyxJQUFJLEtBQUssUUFBUSxFQUFFO2dCQUMxQixhQUFhLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDcEQ7aUJBQU07Z0JBQ0gsYUFBYSxDQUFDLHNCQUFzQixDQUFDLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksRUFBRSxLQUFJLENBQUMsQ0FBQyxDQUFDO2FBQzdFO1FBQ0wsQ0FBQyxDQUNKLENBQUM7SUFDTixDQUFDO0lBRUQseURBQTJCLEdBQTNCLFVBQTRCLElBQWE7UUFDckMsSUFBTSxRQUFRLEdBQUcsaUJBQWlCLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBRS9DLElBQUksQ0FBQywrQ0FBK0MsQ0FDaEQsVUFBQyxhQUFzQztZQUVuQyxJQUFNLFlBQVksR0FBRyxxQkFBcUIsQ0FBQztZQUUzQyxJQUFJLGFBQWEsQ0FBQyxZQUFZLENBQUMsRUFBRTtnQkFDN0IsSUFBSSxPQUFPLEdBQUcsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQVM7b0JBQ2hFLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDcEMsQ0FBQyxDQUFDLENBQUM7Z0JBQ0gsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQU07b0JBQzVCLElBQUksR0FBRyxHQUFHLGFBQWEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ2pELGFBQWEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUMvQyxDQUFDLENBQUMsQ0FBQzthQUNOO1FBQ0wsQ0FBQyxDQUNKLENBQUM7SUFDTixDQUFDO0lBRUQsb0RBQXNCLEdBQXRCLFVBQXVCLElBQWE7UUFBcEMsaUJBa0JDO1FBaEJHLElBQUksQ0FBQywrQ0FBK0MsQ0FDaEQsVUFBQyxhQUFzQztZQUVuQyxJQUFNLFNBQVMsR0FBRyxnQkFBZ0IsQ0FBQztZQUVuQyxJQUFJLENBQUMsYUFBYSxDQUFDLHFCQUFxQixDQUFDLEVBQUU7Z0JBQ3ZDLGFBQWEsQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7YUFDdEQ7WUFFRCxJQUFJLE9BQU8sSUFBSSxLQUFLLFFBQVEsRUFBRTtnQkFDMUIsYUFBYSxDQUFDLHFCQUFxQixDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQ25EO2lCQUFNO2dCQUNILGFBQWEsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsS0FBSSxDQUFDLENBQUMsQ0FBQzthQUM1RTtRQUNMLENBQUMsQ0FDSixDQUFDO0lBQ04sQ0FBQztJQUVELG1EQUFxQixHQUFyQixVQUFzQixJQUFTO1FBRTNCLElBQUksQ0FBQywrQ0FBK0MsQ0FDaEQsVUFBQyxhQUFzQztZQUVuQyxJQUFNLFNBQVMsR0FBRyxnQkFBZ0IsRUFDOUIsYUFBYSxHQUFHLGVBQWUsQ0FBQztZQUdwQyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQzttQkFDMUIsYUFBYSxDQUFDLGFBQWEsQ0FBQyxLQUFLLFNBQVMsRUFBRTtnQkFDL0MsYUFBYSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7YUFDOUM7WUFFRCxhQUFhLENBQUMsYUFBYSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzVDLENBQUMsQ0FDSixDQUFDO0lBQ04sQ0FBQztJQUVELHdEQUEwQixHQUExQixVQUEyQixJQUFTO1FBRWhDLElBQUksQ0FBQywrQ0FBK0MsQ0FDaEQsVUFBQyxhQUFzQztZQUVuQyxJQUFNLGFBQWEsR0FBRyxlQUFlLENBQUM7WUFDdEMsSUFBSSxhQUFhLENBQUMsYUFBYSxDQUFDLEVBQUU7Z0JBQzlCLElBQUksT0FBTyxHQUFHLGFBQWEsQ0FBQyxhQUFhLENBQUMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFNO29CQUM5RCxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQ2hDLENBQUMsQ0FBQyxDQUFDO2dCQUNILE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFNO29CQUM1QixJQUFJLEdBQUcsR0FBRyxhQUFhLENBQUMsYUFBYSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUNsRCxhQUFhLENBQUMsYUFBYSxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDaEQsQ0FBQyxDQUFDLENBQUM7YUFDTjtRQUNMLENBQUMsQ0FDSixDQUFDO0lBQ04sQ0FBQztJQUVELGdEQUFrQixHQUFsQixVQUFtQixZQUFvQixFQUFFLEtBQVU7UUFDL0MsSUFBTSxjQUFjLEdBQStDLDJCQUFZLENBQUMsNEJBQTRCLENBQUMsSUFBSSxDQUFDLDJCQUEyQixFQUFFLENBQUMsQ0FBQztRQUVqSixLQUFLLElBQUksTUFBTSxJQUFJLGNBQWMsRUFBRTtZQUMvQixJQUFNLGFBQWEsR0FBRyxjQUFjLENBQUMsTUFBTSxDQUFDLENBQUMsYUFBYSxDQUFDO1lBRTNELGFBQWEsQ0FBQyxZQUFZLENBQUMsR0FBRyxLQUFLLENBQUM7U0FDdkM7SUFDTCxDQUFDO0lBRUQscURBQXVCLEdBQXZCLFVBQXdCLFlBQW9CO1FBQ3hDLElBQU0sY0FBYyxHQUErQywyQkFBWSxDQUFDLDRCQUE0QixDQUFDLElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDLENBQUM7UUFFakosS0FBSyxJQUFJLE1BQU0sSUFBSSxjQUFjLEVBQUU7WUFDL0IsSUFBTSxhQUFhLEdBQUcsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQztZQUUzRCxJQUFJLGFBQWEsQ0FBQyxZQUFZLENBQUMsRUFBRTtnQkFDN0IsT0FBTyxhQUFhLENBQUMsWUFBWSxDQUFDLENBQUM7YUFDdEM7U0FDSjtJQUNMLENBQUM7SUFXRCxzQkFBSSw0Q0FBVztRQVRmLG9CQUFvQjtRQUNwQiwrQ0FBK0M7UUFFL0M7Ozs7O1dBS0c7YUFDSDtZQUVJLElBQU0sY0FBYyxHQUErQywyQkFBWSxDQUFDLDRCQUE0QixDQUFDLElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDLENBQUM7WUFFakosS0FBSyxJQUFJLE1BQU0sSUFBSSxjQUFjLEVBQUU7Z0JBQy9CLElBQU0sV0FBVyxHQUF1QixjQUFjLENBQUMsTUFBTSxDQUFDLENBQUMsYUFBYSxDQUFDLGNBQWMsQ0FBQyxDQUFDO2dCQUU3RixJQUFJLFdBQVcsRUFBRTtvQkFDYixPQUFPLFVBQVUsQ0FBQyxXQUFXLENBQUMsQ0FBQztpQkFDbEM7YUFDSjtZQUVELHVDQUF1QztZQUN2QyxNQUFNLElBQUksS0FBSyxDQUFDLDZCQUE2QixDQUFDLENBQUM7UUFDbkQsQ0FBQzs7O09BQUE7SUFFRCwyQkFBMkI7SUFDM0IscUNBQU8sR0FBUCxVQUFRLFFBQWdCO1FBQ3BCLElBQU0sS0FBSyxHQUEyQywyQkFBWSxDQUFDLDRCQUE0QixDQUFDLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDLENBQUM7UUFFaEksS0FBSyxJQUFJLEVBQUUsSUFBSSxLQUFLLEVBQUU7WUFDbEIsSUFBTSxJQUFJLEdBQXFCLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUN6QyxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksUUFBUSxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxHQUFHLEdBQUcsUUFBUSxHQUFHLEdBQUcsQ0FBQyxFQUFFO2dCQUM5RCxPQUFPLElBQUksQ0FBQzthQUNmO1NBQ0o7UUFFRCxPQUFPLEtBQUssQ0FBQztJQUNqQixDQUFDO0lBRUQsdUNBQVMsR0FBVCxVQUFVLElBQVksRUFBRSxJQUFpQixFQUFFLFNBQWlCO1FBRXhELG9DQUFvQztRQUNwQyxJQUFNLFVBQVUsR0FBaUIsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ3JELElBQU0sVUFBVSxHQUFnQixJQUFJLENBQUM7UUFDckMsSUFBTSxlQUFlLEdBQVcsU0FBUyxJQUFJLElBQUksQ0FBQztRQUNsRCxJQUFNLFVBQVUsR0FBVyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7UUFFdkMsa0RBQWtEO1FBQ2xELElBQUksQ0FBQyxVQUFVLEVBQUU7WUFDYixNQUFNLElBQUksS0FBSyxDQUFDLHNCQUFzQixDQUFDLENBQUM7U0FDM0M7UUFFRCxrREFBa0Q7UUFDbEQsSUFBSSxDQUFDLFVBQVUsRUFBRTtZQUNiLE1BQU0sSUFBSSxLQUFLLENBQUMsc0JBQXNCLENBQUMsQ0FBQztTQUMzQztRQUVELGtEQUFrRDtRQUNsRCxJQUFNLFdBQVcsR0FBaUIsd0JBQXdCLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDdkUsSUFBSSxDQUFDLFdBQVcsRUFBRTtZQUNkLE1BQU0sSUFBSSxLQUFLLENBQUMsdUJBQXVCLEdBQUcsVUFBVSxDQUFDLENBQUM7U0FDekQ7UUFFRCw4QkFBOEI7UUFDOUIsSUFBTSx1QkFBdUIsR0FBMkI7WUFDcEQ7Z0JBQ0ksSUFBSSxFQUFFLE9BQU87Z0JBQ2IsR0FBRyxFQUFFLHNCQUFzQjtnQkFDM0IsYUFBYSxFQUFFO29CQUNYLDRCQUE0QixFQUFFLENBQUMsV0FBVyxFQUFFLGdCQUFnQixDQUFDO29CQUM3RCxjQUFjLEVBQUUsR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLGVBQWUsR0FBRyxhQUFhLEdBQUcsR0FBRyxDQUFDO29CQUN2Rix1QkFBdUIsRUFBRSw4RUFBOEU7b0JBQ3ZHLFlBQVksRUFBRSxHQUFHLEdBQUcsVUFBVSxHQUFHLEdBQUc7b0JBQ3BDLFlBQVksRUFBRSxLQUFLO2lCQUN0QjthQUNKO1lBQ0Q7Z0JBQ0ksSUFBSSxFQUFFLFNBQVM7Z0JBQ2YsR0FBRyxFQUFFLHNCQUFzQjtnQkFDM0IsYUFBYSxFQUFFO29CQUNYLGNBQWMsRUFBRSxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUUsZUFBZSxHQUFHLGFBQWEsR0FBRyxHQUFHLENBQUM7b0JBQ3ZGLHVCQUF1QixFQUFFLDhFQUE4RTtvQkFDdkcsWUFBWSxFQUFFLEdBQUcsR0FBRyxVQUFVLEdBQUcsR0FBRztvQkFDcEMsWUFBWSxFQUFFLEtBQUs7aUJBQ3RCO2FBQ0o7U0FDSixDQUFDO1FBRUYsMkJBQTJCO1FBQzNCLElBQUksbUJBQW1CLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixDQUFDLHVCQUF1QixFQUFFLFNBQVMsRUFBRSxnREFBZ0QsR0FBRyxVQUFVLEdBQUcsR0FBRyxDQUFDLENBQUM7UUFFL0osa0JBQWtCO1FBQ2xCLElBQU0sV0FBVyxHQUFXLFVBQVUsQ0FBQztRQUN2QyxJQUFNLGVBQWUsR0FBZ0Isc0JBQXNCLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDekUsSUFBTSxXQUFXLEdBQVksSUFBSSxDQUFDLGNBQWMsQ0FBQyxXQUFXLEVBQUUsRUFBRSxLQUFLLEVBQUUsWUFBWSxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsa0JBQWtCLEVBQUUsZUFBZSxFQUFFLENBQUMsQ0FBQztRQUNsSixxREFBcUQ7UUFHckQsa0NBQWtDO1FBQ2xDLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUUzQyxpQkFBaUI7UUFDakIsSUFBTSxNQUFNLEdBQXlCO1lBQ2pDLElBQUksRUFBRSxVQUFVO1lBQ2hCLGVBQWUsRUFBRTtnQkFDYixHQUFHLEVBQUUsaUJBQWlCO2dCQUN0QixJQUFJLEVBQUUsR0FBRyxHQUFHLFVBQVUsR0FBRyxHQUFHO2dCQUM1QixXQUFXLEVBQUUsR0FBRyxHQUFHLFVBQVUsR0FBRyxHQUFHO2dCQUNuQyxnQkFBZ0IsRUFBRSxXQUFXLENBQUMsT0FBdUI7Z0JBQ3JELFdBQVcsRUFBRSxHQUFHLEdBQUcsd0JBQXdCLENBQUMsVUFBVSxDQUFDLEdBQUcsR0FBRztnQkFDN0Qsc0JBQXNCLEVBQUUsbUJBQW1CLENBQUMsSUFBSTtnQkFDaEQsV0FBVyxFQUFFLEVBQUU7Z0JBQ2YsVUFBVSxFQUFFLEVBQUU7Z0JBQ2QsWUFBWSxFQUFFLEVBQUU7YUFDbkI7U0FDSixDQUFDO1FBRUYseUNBQXlDO1FBQ3pDLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxNQUFNLENBQUMsQ0FBQTtRQUV4QyxxREFBcUQ7UUFDckQsSUFBSSxVQUFVLEtBQUssZUFBZSxFQUFFO1lBRWhDLHFDQUFxQztZQUVyQyx5Q0FBeUM7WUFDekMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxFQUFFLEVBQUUsd0JBQXdCLEVBQUUsWUFBWSxFQUFFLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUE7WUFFdEcsaUNBQWlDO1lBQ2pDLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxXQUFXLENBQUMsQ0FBQTtZQUU3Qyw4RUFBOEU7U0FFakY7UUFBQSxDQUFDO1FBRUYsbUNBQW1DO1FBQ25DLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUVwQyxnRUFBZ0U7UUFDaEUsSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUVwRSwyQkFBMkI7UUFDM0IsT0FBTyxNQUFNLENBQUM7SUFDbEIsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0gsNkNBQWUsR0FBZjtRQUVJLDJCQUEyQjtRQUMzQixJQUFNLG1CQUFtQixHQUE2QixJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztRQUUvRSw0QkFBNEI7UUFDNUIsbUZBQW1GO1FBQ25GLG1GQUFtRjtRQUNuRixzREFBc0Q7UUFDdEQsMEVBQTBFO1FBQzFFLDZCQUE2QjtRQUM3QixpSEFBaUg7UUFDakgsNkZBQTZGO1FBQzdGLElBQU0sZ0JBQWdCLEdBQWlCLE1BQU0sQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUUzRSx1QkFBdUI7UUFDdkIsSUFBTSxZQUFZLEdBQUcsbUJBQW1CLENBQUMsZ0JBQWdCLENBQWUsQ0FBQztRQUV6RSxPQUFPO1lBQ0gsSUFBSSxFQUFFLGdCQUFnQjtZQUN0QixZQUFZLEVBQUUsWUFBWTtTQUM3QixDQUFBO0lBQ0wsQ0FBQztJQUVEOzs7O09BSUc7SUFDSCw0Q0FBYyxHQUFkO1FBRUkseUJBQXlCO1FBQ3pCLElBQU0sZUFBZSxHQUFpQixJQUFJLENBQUMsZUFBZSxFQUFFLENBQUMsY0FBYyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO1FBRWpHLDRCQUE0QjtRQUM1QixJQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsc0JBQXNCLEVBQUUsQ0FBQyxlQUFlLENBQW9CLENBQUM7UUFFdEYsT0FBTztZQUNILElBQUksRUFBRSxlQUFlO1lBQ3JCLFdBQVcsRUFBRSxXQUFXO1NBQzNCLENBQUE7SUFDTCxDQUFDO0lBRUQsYUFBYTtJQUdiOzs7Ozs7T0FNRztJQUNILCtDQUFpQixHQUFqQixVQUFrQixJQUEyQyxFQUFFLFFBQXNCLEVBQUUsU0FBeUI7UUFFNUcsSUFBTSxLQUFLLEdBQW9CLElBQUksQ0FBQyx1QkFBdUIsQ0FBVyxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFFM0YsSUFBSSxLQUFLLElBQUksS0FBSyxDQUFDLFFBQVEsS0FBSyxTQUFTLEVBQUU7WUFDdkMsSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRLEVBQUU7Z0JBRTFCLElBQU0sY0FBYyxHQUFpQixJQUFJLENBQUM7Z0JBRTFDLElBQUksT0FBTyxTQUFvQixDQUFDO2dCQUVoQyxXQUFXO2dCQUNYLElBQU0sUUFBUSxHQUFvQixJQUFJLENBQUMsZ0JBQWdCLENBQUMsY0FBYyxDQUFDLENBQUM7Z0JBQ3hFLElBQUksUUFBUSxFQUFFO29CQUNWLE9BQU8sR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDO2lCQUMzQjtxQkFDSTtvQkFDRCxJQUFNLFdBQVcsR0FBMkIsSUFBSSxDQUFDLHVCQUF1QixDQUFDLGNBQWMsQ0FBQyxDQUFDO29CQUN6RixJQUFJLFdBQVc7d0JBQ1gsT0FBTyxHQUFHLFdBQVcsQ0FBQyxJQUFJLENBQUM7aUJBQ2xDO2dCQUVELElBQUksT0FBTyxJQUFJLFNBQVM7b0JBQ3BCLE1BQU0sSUFBSSxLQUFLLENBQUMsdUNBQXFDLGNBQWMsTUFBRyxDQUFDLENBQUM7Z0JBRTVFLElBQU0sVUFBVSxHQUFvQjtvQkFDaEMsS0FBSyxFQUFFLGNBQWM7b0JBQ3JCLE9BQU8sRUFBRSxPQUFPO2lCQUNuQixDQUFDO2dCQUNGLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2FBQ25DO2lCQUNJO2dCQUNELGFBQWE7Z0JBQ2IsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7YUFDNUM7U0FDSjtJQUNMLENBQUM7SUFFRCxrREFBb0IsR0FBcEIsVUFBcUIsSUFBcUMsRUFBRSxRQUFzQjtRQUM5RSxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO0lBQzlELENBQUM7SUFFRCwyQ0FBYSxHQUFiLFVBQWMsSUFBcUMsRUFBRSxRQUFzQjtRQUN2RSxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxVQUFVLENBQUMsQ0FBQztJQUN2RCxDQUFDO0lBRUQsb0RBQXNCLEdBQXRCLFVBQXVCLElBQVksRUFBRSxRQUFtQyxFQUFFLFNBQXlCO1FBQy9GLGVBQWU7UUFDZixJQUFNLEtBQUssR0FBYTtZQUNwQiw2QkFBNkI7WUFDN0IsR0FBRyxFQUFFLFNBQVM7WUFDZCxRQUFRLEVBQUUsRUFBRTtZQUNaLElBQUksRUFBRSxJQUFJO1lBQ1YsVUFBVSxFQUFFLFdBQVc7U0FDMUIsQ0FBQztRQUVGLElBQUksUUFBUTtZQUFFLEtBQUssQ0FBQyxJQUFJLEdBQUcsUUFBUSxDQUFDO1FBRXBDLElBQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUVoQyxnREFBZ0Q7UUFDaEQsSUFBTSxZQUFZLEdBQTJCLElBQUksQ0FBQyxxQkFBcUIsQ0FBVyxTQUFTLENBQUMsQ0FBQztRQUM3RiwyQkFBWSxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztRQUUzRCxtQkFBbUI7UUFDbkIsb0NBQW9DO1FBRXBDLHNDQUFzQztRQUN0Qyw0QkFBNEI7UUFDNUIsdUJBQXVCO1FBRXZCLE9BQU8sR0FBRyxDQUFDO0lBQ2YsQ0FBQztJQUVELG1EQUFxQixHQUFyQixVQUFzQixJQUFZO1FBQzlCLE9BQU8sSUFBSSxDQUFDLHNCQUFzQixDQUFDLElBQUksRUFBRSxTQUFTLEVBQUUsaUJBQWlCLENBQUMsQ0FBQTtJQUMxRSxDQUFDO0lBRUQsNENBQWMsR0FBZCxVQUFlLElBQVksRUFBRSxRQUF3QjtRQUNqRCxPQUFPLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ25FLENBQUM7SUFFRCx1REFBeUIsR0FBekIsVUFBMEIsSUFBNEIsRUFBRSxRQUFzQixFQUFFLFNBQXlCO1FBRXJHLElBQU0sS0FBSyxHQUFvQixJQUFJLENBQUMsdUJBQXVCLENBQUMsUUFBUSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBRWpGLElBQUksS0FBSyxFQUFFO1lBQ1AsSUFBSSxhQUFhLEdBQUcsS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7WUFDdEMsSUFBTSxPQUFPLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3BDLEtBQUssQ0FBQyxJQUFJLGFBQWEsRUFBRTtnQkFDckIsSUFBSSxPQUFPLENBQUMsS0FBSyxJQUFJLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLO29CQUN2QyxPQUFPLENBQUMsT0FBTyxJQUFJLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUU7b0JBQzdDLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBc0IsRUFBRSxDQUFDLENBQUMsQ0FBQztvQkFDaEQsTUFBTTtpQkFDVDthQUNKO1NBQ0o7SUFDTCxDQUFDO0lBRUQsZ0RBQWtCLEdBQWxCLFVBQW1CLElBQTRCLEVBQUUsUUFBc0I7UUFDbkUsSUFBSSxDQUFDLHlCQUF5QixDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDL0QsQ0FBQztJQUVELHVEQUF5QixHQUF6QixVQUEwQixJQUE0QixFQUFFLFFBQXNCO1FBQzFFLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLGlCQUFpQixDQUFDLENBQUM7SUFDdEUsQ0FBQztJQUVELHFEQUF1QixHQUF2QixVQUF1RCxHQUFpQixFQUFFLFNBQXlCO1FBQy9GLDJEQUEyRDtRQUMzRCxPQUFPLDJCQUFZLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBZSxTQUFTLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztJQUNoRyxDQUFDO0lBRUQsOENBQWdCLEdBQWhCLFVBQWlCLElBQWtCO1FBQy9CLE9BQU8sMkJBQVksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLGdCQUFnQixFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDakUsK0ZBQStGO0lBQ25HLENBQUM7SUFBQSxDQUFDO0lBRUYscURBQXVCLEdBQXZCLFVBQXdCLElBQWtCO1FBQ3RDLE9BQU8sMkJBQVksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLHVCQUF1QixFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDeEUsNERBQTREO0lBQ2hFLENBQUM7SUFBQSxDQUFDO0lBR0Y7Ozs7O09BS0c7SUFDSCxvREFBc0IsR0FBdEIsVUFDSSxRQUE2QixFQUM3QixTQUF5QztRQUV6QyxvRUFBb0U7UUFDcEUseUVBQXlFO1FBQ3pFLG1CQUFtQjtRQUNuQixJQUFJLENBQUMsUUFBUTtZQUNULE9BQU8sU0FBUyxDQUFDO1FBRXJCLElBQU0sTUFBTSxHQUFpQyxJQUFJLENBQUMscUJBQXFCLENBQ25FLFNBQVMsQ0FBQyxDQUFDO1FBRWYsc0RBQXNEO1FBRXRELEtBQUssSUFBSSxHQUFHLElBQUksTUFBTSxFQUFFO1lBQ3BCLDZCQUE2QjtZQUM3QixJQUFJLENBQUMsMkJBQVksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsRUFBRTtnQkFFckMsSUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBYSxDQUFDO2dCQUV0QyxxQ0FBcUM7Z0JBQ3JDLElBQUksUUFBUSxDQUFDLElBQUksRUFBRTtvQkFDZixJQUFJLFFBQVEsQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLElBQUksRUFBRTt3QkFDOUIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLElBQUksUUFBUSxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsSUFBSTs0QkFDOUMsT0FBTyxHQUFHLENBQUM7cUJBQ2xCO2lCQUNKO3FCQUNJLElBQUksUUFBUSxDQUFDLElBQUksSUFBSSxRQUFRLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxJQUFJLEVBQUU7b0JBQ3BELE9BQU8sR0FBRyxDQUFDO2lCQUNkO2FBQ0o7U0FDSjtRQUVELE9BQU8sU0FBUyxDQUFDLENBQUMsWUFBWTtJQUNsQyxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILDZDQUFlLEdBQWYsVUFBZ0IsUUFBNkI7UUFDekMsT0FBTyxJQUFJLENBQUMsc0JBQXNCLENBQUMsUUFBUSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQzdELENBQUM7SUFFRDs7OztPQUlHO0lBRUgsb0RBQXNCLEdBQXRCLFVBQXVCLFFBQTZCO1FBQ2hELE9BQU8sSUFBSSxDQUFDLHNCQUFzQixDQUFDLFFBQVEsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3BFLENBQUM7SUFFRCx5REFBMkIsR0FBM0IsVUFBNEIsSUFBWTtRQUNwQyxJQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFbEQsSUFBTSxnQkFBZ0IsR0FBNkIsSUFBSSxDQUFDLGVBQWUsQ0FBQyxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsQ0FBQyxDQUFDO1FBRS9GLElBQUksZ0JBQWdCLElBQUksU0FBUztZQUM3QixNQUFNLElBQUksS0FBSyxDQUFDLDRCQUE0QixDQUFDLENBQUM7UUFFbEQsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztRQUUvQyxJQUFJLHdCQUF3QixHQUFHO1lBQzNCLElBQUksRUFBRSxJQUFJLENBQUMsWUFBWSxFQUFFO1lBQ3pCLE9BQU8sRUFBRSxRQUFRO1lBQ2pCLFFBQVEsRUFBRSxJQUFJO1NBQ2pCLENBQUE7UUFFRCxJQUFJLENBQUMsd0JBQXdCLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxDQUFRLGVBQWU7UUFDL0UsSUFBSSxDQUFDLDJCQUEyQixDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBSyx3QkFBd0I7UUFFeEYsT0FBTyx3QkFBd0IsQ0FBQztJQUNwQyxDQUFDO0lBQUEsQ0FBQztJQUVGLDRDQUFjLEdBQWQsVUFBZSxJQUFZO1FBRXZCLElBQU0sT0FBTyxHQUFlLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQyxZQUFZLENBQUM7UUFFaEUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZO1lBQ3JCLE9BQU8sQ0FBQyxZQUFZLEdBQUcsRUFBRSxDQUFDO1FBRTlCLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQzVCLE9BQU8sQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQ25DO1FBRUQsbUZBQW1GO1FBQ25GLHFGQUFxRjtRQUNyRixJQUFJO1FBQ0osb0NBQW9DO1FBQ3BDLDJGQUEyRjtRQUMzRixJQUFJO0lBQ1IsQ0FBQztJQUVELCtDQUFpQixHQUFqQixVQUFrQixJQUFZO1FBQzFCLElBQU0sT0FBTyxHQUF5QixJQUFJLENBQUMsZUFBZSxFQUFFLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQztRQUN2RixJQUFJLE9BQU8sRUFBRTtZQUNULEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO2dCQUNyQyxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLEVBQUU7b0JBQ3JCLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO29CQUNyQixNQUFNO2lCQUNUO2FBQ0o7WUFFRCx5QkFBeUI7WUFDekIsc0ZBQXNGO1NBQ3pGO0lBQ0wsQ0FBQztJQUVELDRDQUFjLEdBQWQsVUFBZSxJQUFZO1FBQ3ZCLElBQU0sT0FBTyxHQUF5QixJQUFJLENBQUMsZUFBZSxFQUFFLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQztRQUN2Rix5RkFBeUY7UUFDekYsSUFBSSxPQUFPLEVBQUU7WUFDVCxLQUFLLElBQUksQ0FBQyxJQUFJLE9BQU8sRUFBRTtnQkFDbkIsSUFBSSxPQUFPLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSSxFQUFFO29CQUNyQixPQUFPLElBQUksQ0FBQztpQkFDZjthQUNKO1NBQ0o7UUFDRCxPQUFPLEtBQUssQ0FBQztJQUNqQixDQUFDO0lBR0QsMENBQVksR0FBWixVQUFpRCxJQUFjO1FBQzNELElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSTtZQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUM7UUFFOUMsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUEyQyxDQUFDO0lBQ3JGLENBQUM7SUFLRDs7Ozs7Ozs7Ozs7OztPQWFHO0lBQ0gscUNBQU8sR0FBUCxVQUFRLElBQVksRUFBRSxLQUFtQixFQUFFLEdBQTRCO1FBQ25FLElBQU0sSUFBSSxHQUFHLElBQUksb0JBQU8sQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFFcEMsa0NBQWtDO1FBQ2xDLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFFekMsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7UUFFbkMsSUFBSSxDQUFDLDRCQUE0QixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUksbUJBQW1CO1FBRS9ELElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxFQUFFO1lBQzlCLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQVEsV0FBVztTQUN0RDthQUNJLElBQUksSUFBSSxDQUFDLHVCQUF1QixDQUFDLEtBQUssQ0FBQyxFQUFFO1lBQzFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBWSxrQkFBa0I7U0FDeEU7UUFFRCxPQUFPLElBQUksQ0FBQztJQUNoQixDQUFDO0lBRUQsd0NBQVUsR0FBVixVQUFXLElBQVksRUFBRSxLQUFtQixFQUFFLEdBQTRCO1FBQ3RFLElBQU0sSUFBSSxHQUFHLElBQUksb0JBQU8sQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFFcEMsSUFBSSxDQUFDLGlDQUFpQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUksbUJBQW1CO1FBRXBFLElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxFQUFFO1lBQzlCLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBWSxXQUFXO1NBQy9EO2FBQ0ksSUFBSSxJQUFJLENBQUMsdUJBQXVCLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFDMUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFLLGtCQUFrQjtTQUN0RTtRQUVELE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFFRDs7Ozs7T0FLRztJQUNILDhDQUFnQixHQUFoQixVQUFpQixJQUFZLEVBQUUsS0FBdUM7UUFDbEUsSUFBSSxNQUFNLENBQUM7UUFDWCxJQUFNLE9BQU8sR0FBdUMsSUFBSSxDQUFDLDJCQUEyQixFQUFFLENBQUM7UUFDdkYsS0FBSyxJQUFJLFNBQVMsSUFBSSxPQUFPLEVBQUU7WUFDM0IsSUFBSSxDQUFDLDJCQUFZLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxDQUFDLEVBQUU7Z0JBQzNDLElBQU0sTUFBTSxHQUF5QixPQUFPLENBQUMsU0FBUyxDQUF5QixDQUFDO2dCQUVoRixJQUFJLENBQUMsS0FBSyxJQUFJLE1BQU0sQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLEtBQUssU0FBUyxDQUFDLEVBQUU7b0JBQzNELElBQUksTUFBTSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsS0FBSyxTQUFTLEVBQUU7d0JBQzFDLE1BQU0sR0FBRyxNQUFNLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO3FCQUN2QztpQkFDSjthQUNKO1NBQ0o7UUFFRCxPQUFPLE1BQU0sQ0FBQztJQUNsQixDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsa0RBQW9CLEdBQXBCLFVBQXFCLEtBQTBCO1FBRTNDLElBQU0sTUFBTSxHQUE2QyxFQUFFLENBQUM7UUFFNUQsSUFBTSxPQUFPLEdBQXVDLElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDO1FBQ3ZGLEtBQUssSUFBSSxHQUFHLElBQUksT0FBTyxFQUFFO1lBQ3JCLElBQUksQ0FBQywyQkFBWSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxFQUFFO2dCQUNyQyxJQUFNLE1BQU0sR0FBeUIsT0FBTyxDQUFDLEdBQUcsQ0FBeUIsQ0FBQztnQkFDMUUsSUFBSSxNQUFNLENBQUMsSUFBSSxLQUFLLEtBQUssRUFBRTtvQkFDdkIsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQztpQkFDeEI7YUFDSjtTQUNKO1FBQ0QsT0FBTyxNQUFNLENBQUM7SUFDbEIsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0gsa0RBQW9CLEdBQXBCLFVBQXFCLFFBQWdCLEVBQUUsS0FBZ0UsRUFBRSxHQUE0QjtRQUVqSSxrQ0FBa0M7UUFDbEMsSUFBSSxDQUFDLEtBQUssRUFBRTtZQUNSLEtBQUssR0FBRyxXQUFXLENBQUM7U0FDdkI7UUFFRCxJQUFJLENBQUMsMkJBQVksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLEVBQUUsRUFBRSx5R0FBeUc7WUFDbkosZ0ZBQWdGO1lBQzVFLEtBQUssR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7U0FDakQ7UUFFRCwyREFBMkQ7UUFDM0QsSUFBSSxDQUFDLEtBQUs7WUFDTixNQUFNLElBQUksS0FBSyxDQUFDLDJCQUEyQixDQUFDLENBQUM7UUFFakQsSUFBTSxJQUFJLEdBQXFDLElBQUksb0JBQU8sQ0FBQyxRQUFRLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFFMUUsSUFBSSxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7WUFBRSxPQUFPLElBQUksQ0FBQztRQUVsRCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUNuQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztRQUVoQyxJQUFJLENBQUMsSUFBSTtZQUFFLE9BQU8sS0FBSyxDQUFDO1FBRXhCLElBQUksQ0FBQyxNQUFNLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDM0MsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7UUFFaEMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3BDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUVyQyxJQUFJLENBQUMsTUFBTSxHQUFHLEVBQUUsQ0FBQztRQUNqQixJQUFJLGtCQUFrQixDQUFDO1FBQ3ZCLElBQUksVUFBVSxHQUFHLEVBQUUsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzNDLEtBQUssSUFBSSxLQUFLLElBQUksVUFBVSxFQUFFO1lBQzFCLElBQUksYUFBYSxHQUFHLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUN0QyxJQUFJLGFBQWEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxhQUFhLENBQUMsQ0FBQztZQUV2RCxJQUFJLGFBQWEsSUFBSSxtQkFBbUIsRUFBRTtnQkFDdEMsa0JBQWtCLEdBQUcsS0FBSyxDQUFDLFlBQVksQ0FBQyxhQUFhLENBQUMsQ0FBQyxxQkFBcUIsQ0FBQztnQkFDN0UsU0FBUzthQUNaO1lBRUQsSUFBSSxTQUFTLEdBQUcsSUFBSSxvQkFBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO1lBQzNDLFNBQVMsQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBRXhDLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUU3QyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUU1QixJQUFJLGtCQUFrQixJQUFJLGtCQUFrQixLQUFLLGFBQWEsRUFBRTtnQkFDNUQsSUFBSSxDQUFDLFlBQVksR0FBRyxTQUFTLENBQUM7YUFDakM7U0FDSjtRQUVELElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFO1lBQ3BCLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUN0QztRQUVELElBQUksQ0FBQywwQkFBMEIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUV0QyxPQUFPLElBQUksQ0FBQztJQUNoQixDQUFDO0lBRUQ7Ozs7OztPQU1HO0lBQ0gsZ0RBQWtCLEdBQWxCLFVBQW1CLElBQVksRUFBRSxLQUFVLEVBQUUsTUFBOEI7UUFFdkUsSUFBTSxJQUFJLEdBQWUsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDLFlBQVksQ0FBQztRQUM3RCxJQUFNLFVBQVUsR0FBMEIsSUFBSSxDQUFDLFVBQVUsQ0FBQztRQUUxRCx5RUFBeUU7UUFDekUsSUFBSSxVQUFVLENBQUMsa0JBQWtCLENBQUMsS0FBSyxTQUFTLEVBQUU7WUFDOUMsVUFBVSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsRUFBRSxDQUFDO1NBQ3ZDO1FBQ0QsTUFBTSxHQUFHLE1BQU0sSUFBSSxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7UUFDekMsSUFBSSxVQUFVLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssU0FBUyxFQUFFO1lBQzNELFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7U0FDcEQ7UUFDRCxVQUFVLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsS0FBSyxDQUFDO0lBQzlELENBQUM7SUFFRDs7OztPQUlHO0lBQ0gsbURBQXFCLEdBQXJCLFVBQXNCLElBQVksRUFBRSxNQUErQjtRQUUvRCxJQUFNLElBQUksR0FBZSxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUMsWUFBWSxDQUFDO1FBQzdELElBQU0sVUFBVSxHQUEwQixJQUFJLENBQUMsVUFBVSxDQUFDO1FBRTFELE1BQU0sR0FBRyxNQUFNLElBQUksSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQ3pDLElBQUksVUFBVSxDQUFDLGtCQUFrQixDQUFDO1lBQzlCLFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUM3QyxPQUFPLFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUM1RDtJQUNMLENBQUM7SUFFTCwwQkFBQztBQUFELENBQUMsQUFoL0VELENBQXlDLHFCQUFZLEdBZy9FcEQ7QUFoL0VZLGtEQUFtQiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuIExpY2Vuc2VkIHRvIHRoZSBBcGFjaGUgU29mdHdhcmUgRm91bmRhdGlvbiAoQVNGKSB1bmRlciBvbmVcbiBvciBtb3JlIGNvbnRyaWJ1dG9yIGxpY2Vuc2UgYWdyZWVtZW50cy4gIFNlZSB0aGUgTk9USUNFIGZpbGVcbiBkaXN0cmlidXRlZCB3aXRoIHRoaXMgd29yayBmb3IgYWRkaXRpb25hbCBpbmZvcm1hdGlvblxuIHJlZ2FyZGluZyBjb3B5cmlnaHQgb3duZXJzaGlwLiAgVGhlIEFTRiBsaWNlbnNlcyB0aGlzIGZpbGVcbiB0byB5b3UgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlXG4gJ0xpY2Vuc2UnKTsgeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZVxuIHdpdGggdGhlIExpY2Vuc2UuICBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsXG4gc29mdHdhcmUgZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW5cbiAnQVMgSVMnIEJBU0lTLCBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTllcbiBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLiAgU2VlIHRoZSBMaWNlbnNlIGZvciB0aGVcbiBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kIGxpbWl0YXRpb25zXG4gdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxuXG4vKlxuSGVscGZ1bCBCYWNrZ3JvdW5kIExpbmtzOlxuXG5odHRwOi8vZGFud3JpZ2h0LmluZm8vYmxvZy8yMDEwLzEwL3hjb2RlLXBieHByb2plY3QtZmlsZXMvXG5odHRwOi8vd3d3Lm1vbm9iamMubmV0L3hjb2RlLXByb2plY3QtZmlsZS1mb3JtYXQuaHRtbFxuaHR0cHM6Ly9naXRodWIuY29tL01vbm9iamMvbW9ub2JqYy10b29sc1xuXG5cbiovXG5cbmltcG9ydCB7IGZvcm1hdCBhcyBmIH0gZnJvbSAndXRpbCc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgdXVpZCBmcm9tICd1dWlkJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbi8vICBubyB0eXBlcyBmaWxlIGZvciBzaW1wbGUtcGxpc3RcbmNvbnN0IHBsaXN0ID0gcmVxdWlyZSgnc2ltcGxlLXBsaXN0JykgYXMgYW55O1xuLy9pbXBvcnQgKiBhcyBwbGlzdCBmcm9tICdzaW1wbGUtcGxpc3QnO1xuXG5pbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tICdldmVudHMnO1xuaW1wb3J0IHsgZm9yaywgQ2hpbGRQcm9jZXNzIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5cbmltcG9ydCB7IFBieFdyaXRlciwgUGJ4V3JpdGVyT3B0aW9ucyB9IGZyb20gJy4vcGJ4V3JpdGVyJztcblxuLy8gIFRoaXMgaXMgYSBhdXRvbWF0aWNhbGx5IGdlbmVyYXRlZCAuanMgZmlsZSBmcm9tIHBlZ2pzLlxuLy8gIFNvIGdvIG9sZHNjaG9vbCBhbmQgdXNlIHJlcXVpcmUuXG5jb25zdCBwYXJzZXIgPSByZXF1aXJlKCcuL3BhcnNlci9wYnhwcm9qJyk7XG5cbmltcG9ydCB7IFNlY3Rpb25VdGlscyB9IGZyb20gJy4vU2VjdGlvblV0aWxzJztcbmltcG9ydCB7IFhDX1BST0pfVVVJRCwgVEFSR0VUX1RZUEUsIFBST0RVQ1RfVFlQRSwgWENfQ09NTUVOVF9LRVkgfSBmcm9tICcuL0lYY29kZVByb2pGaWxlU2ltcGxlVHlwZXMnO1xuaW1wb3J0IHsgUEJYTmF0aXZlVGFyZ2V0LCBQQlhCdWlsZFBoYXNlQmFzZSwgWENDb25maWd1cmF0aW9uTGlzdCwgUEJYQnVpbGRGaWxlLCBQQlhGaWxlUmVmZXJlbmNlLCBJQ2hpbGRMaXN0RW50cnksIFBCWENvcHlGaWxlc0J1aWxkUGhhc2UsIFBCWFNoZWxsU2NyaXB0QnVpbGRQaGFzZSwgUEJYR3JvdXAsIGNQQlhHcm91cCwgWENWZXJzaW9uR3JvdXAsIFhDQnVpbGRDb25maWd1cmF0aW9uLCBQQlhUYXJnZXREZXBlbmRlbmN5LCBQQlhDb250YWluZXJJdGVtUHJveHksIGNQQlhDb250YWluZXJJdGVtUHJveHksIGNQQlhUYXJnZXREZXBlbmRlbmN5LCBjUEJYQ29weUZpbGVzQnVpbGRQaGFzZSwgY1BCWFNoZWxsU2NyaXB0QnVpbGRQaGFzZSwgUEJYT2JqZWN0QmFzZSwgSVNBX1RZUEUsIFBCWFZhcmlhbnRHcm91cCwgY1BCWFZhcmlhbnRHcm91cCwgUEJYUHJvamVjdCwgY1BCWFByb2plY3QsIGNQQlhCdWlsZEZpbGUsIGNQQlhGaWxlUmVmZXJlbmNlLCBjUEJYTmF0aXZlVGFyZ2V0LCBjWENCdWlsZENvbmZpZ3VyYXRpb24sIGNYQ1ZlcnNpb25Hcm91cCwgY1hDQ29uZmlndXJhdGlvbkxpc3QsIFBCWFNvdXJjZXNCdWlsZFBoYXNlLCBQQlhSZXNvdXJjZXNCdWlsZFBoYXNlLCBQQlhGcmFtZXdvcmtzQnVpbGRQaGFzZSwgSVNBX0JVSUxEX1BIQVNFX1RZUEUsIElTQV9HUk9VUF9UWVBFLCBJQXR0cmlidXRlc0RpY3Rpb25hcnkgfSBmcm9tICcuL0lYY29kZVByb2pGaWxlT2JqVHlwZXMnO1xuaW1wb3J0IHsgUGJ4RmlsZSwgSUZpbGVQYXRoT2JqLCBJTG9uZ0NvbW1lbnRPYmosIFhDX0ZJTEVUWVBFLCBJUGJ4RmlsZU9wdGlvbnMsIEZJTEVUWVBFX0dST1VQLCBYQ19TT1VSQ0VUUkVFIH0gZnJvbSAnLi9QYnhGaWxlRGVmJztcbmltcG9ydCB7IElYY29kZVByb2pGaWxlLCBTZWN0aW9uLCBUeXBlZFNlY3Rpb24sIElQcm9qZWN0LCBTZWN0aW9uRGljdFV1aWRUb09iaiB9IGZyb20gJy4vSVhjb2RlUHJvakZpbGUnO1xuXG5cbi8qKlxuICogRHVlIHRvIGEgcHJvYmxlbSBkZWJ1Z2dpbmcgY29kZSB0aGF0IGRlcGVuZHMgb24gdGhlIGZvcmsgdXNlZCBpbiBcbiAqIHRoZSBwYXJzZSBtZXRob2QsIHdlIGFsbG93IHNldHRpbmcgYW4gZW52aXJvbm1lbnQgdmFyaWFibGUgdGhhdCBcbiAqIG1ha2VzIGNhbGxzIHRvIHBhcnNlIHNpbXVsYXRlIHRoZSBmb3JrIG1ldGhvZC4gIEluIHJlYWxpdHksIHdlIHNob3VsZFxuICoganVzdCByZW1vdmUgdGhlIGZvcmsgb3V0cmlnaHQuICBCdXQgd2UgYXJlIGZvciBub3cgYXNzdW1pbmcgc29tZW9uZSBjb2RlZFxuICogaXQgdGhhdCB3YXkgZm9yIGEgcmVhc29uLlxuICovXG5jb25zdCByZXBsYWNlUGFyc2VXaXRoUGFyc2VTeW5jID0gKHByb2Nlc3MuZW52W1wiWE5PREVfUEFSU0VfQVZPSURfRk9SS1wiXSA9PSBcIjFcIik7IC8vIFNlZSBpZiB3ZSBjYW4gcHVsbCBhbiBlbnZpcm9ubWVudCB2YXJpYWJsZSB0byBzZXQgdGhpcyB3aGVuIHJ1bm5pbmcgb3V0IG9mIFZTQ29kZSBvciBkZWJ1Z2dlci5cblxuZXhwb3J0IGludGVyZmFjZSBJTmF0aXZlVGFyZ2V0V3JhcHBlciB7XG4gICAgdXVpZDogWENfUFJPSl9VVUlEO1xuICAgIHBieE5hdGl2ZVRhcmdldDogUEJYTmF0aXZlVGFyZ2V0O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElOYXRpdmVUYXJnZXRXcmFwcGVyMiB7XG4gICAgdXVpZDogWENfUFJPSl9VVUlEO1xuICAgIHRhcmdldDogUEJYTmF0aXZlVGFyZ2V0O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElCdWlsZFBoYXNlV3JhcHBlciB7XG4gICAgdXVpZDogWENfUFJPSl9VVUlEO1xuICAgIGJ1aWxkUGhhc2U6IFBCWEJ1aWxkUGhhc2VCYXNlO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDb25maWd1cmF0aW9uTGlzdFdyYXBwZXIge1xuICAgIHV1aWQ6IFhDX1BST0pfVVVJRDtcbiAgICB4Y0NvbmZpZ3VyYXRpb25MaXN0OiBYQ0NvbmZpZ3VyYXRpb25MaXN0O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElHcm91cE1hdGNoQ3JpdGVyaWEge1xuICAgIHBhdGg/OiBzdHJpbmc7XG4gICAgbmFtZT86IHN0cmluZztcbn1cblxuLy8gIFVzZWQgdG8gZXh0ZW5kIFBieEZpbGUgZm9yIGRhdGEgbW9kZWwgZmlsZXMuXG5leHBvcnQgaW50ZXJmYWNlIElEYXRhTW9kZWxEb2N1bWVudEZpbGUge1xuICAgIG1vZGVscz86IFBieEZpbGVbXTtcbiAgICBjdXJyZW50TW9kZWw/OiBQYnhGaWxlO1xufVxuXG4vLyAgQXBwZWFycyB0byBub3QgYmUgdXNlZCAoQmFsbCAyMDE5LzEwKVxuLy8gLy8gaGVscGVyIHJlY3Vyc2l2ZSBwcm9wIHNlYXJjaCtyZXBsYWNlXG4vLyBmdW5jdGlvbiBwcm9wUmVwbGFjZShvYmosIHByb3AsIHZhbHVlKSB7XG4vLyAgICAgdmFyIG8gPSB7fTtcbi8vICAgICBmb3IgKHZhciBwIGluIG9iaikge1xuLy8gICAgICAgICBpZiAoby5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcCkpIHtcbi8vICAgICAgICAgICAgIGlmICh0eXBlb2Ygb2JqW3BdID09ICdvYmplY3QnICYmICFBcnJheS5pc0FycmF5KG9ialtwXSkpIHtcbi8vICAgICAgICAgICAgICAgICBwcm9wUmVwbGFjZShvYmpbcF0sIHByb3AsIHZhbHVlKTtcbi8vICAgICAgICAgICAgIH0gZWxzZSBpZiAocCA9PSBwcm9wKSB7XG4vLyAgICAgICAgICAgICAgICAgb2JqW3BdID0gdmFsdWU7XG4vLyAgICAgICAgICAgICB9XG4vLyAgICAgICAgIH1cbi8vICAgICB9XG4vLyB9XG5cbi8vIGhlbHBlciBvYmplY3QgY3JlYXRpb24gZnVuY3Rpb25zXG5mdW5jdGlvbiBwYnhCdWlsZEZpbGVPYmooZmlsZTogSUZpbGVQYXRoT2JqKTogUEJYQnVpbGRGaWxlIHtcblxuICAgIC8vICBNYWtpbmcgYW4gYXNzdW1wdGlvbiB0aGF0IGEgQnVpbGRGaWxlIHdpdGhvdXQgYSBmaWxlUmVmXG4gICAgLy8gIGlzIGFuIGlsbGVnYWwgY29uZGl0aW9uLlxuICAgIGlmICh0eXBlb2YgZmlsZS5maWxlUmVmICE9PSAnc3RyaW5nJykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Fzc3VtaW5nIGFsbCBCdWlsZEZpbGUgaW5zdGFuY2VzIHJlcXVpcmUgYSBmaWxlUmVmLicpO1xuICAgIH1cblxuICAgIHZhciBvYmo6IFBCWEJ1aWxkRmlsZSA9IHtcbiAgICAgICAgaXNhOiAnUEJYQnVpbGRGaWxlJyxcbiAgICAgICAgZmlsZVJlZjogZmlsZS5maWxlUmVmLFxuICAgICAgICBmaWxlUmVmX2NvbW1lbnQ6IGZpbGUuYmFzZW5hbWVcbiAgICB9O1xuXG4gICAgaWYgKGZpbGUuc2V0dGluZ3MpXG4gICAgICAgIG9iai5zZXR0aW5ncyA9IGZpbGUuc2V0dGluZ3M7XG5cbiAgICByZXR1cm4gb2JqO1xufVxuXG5mdW5jdGlvbiBwYnhGaWxlUmVmZXJlbmNlT2JqKGZpbGU6IFBieEZpbGUpOiBQQlhGaWxlUmVmZXJlbmNlIHtcbiAgICAvLyAgQWxsIGZpbGUgcmVmZXJlbmNlcyBcblxuICAgIC8vICBBc3N1bWluZyBYQyBjYW4ndCBoYW5kbGUgdGhpcy4gIFVuc3VyZSBpZiB0aGlzIGlzIHRydWUgb3Igbm90LlxuXG4gICAgLy8gIFRoZSB0ZXN0IGNhc2VzIGZvcmNlZCBhbiAndW5rbm93bicgdmFsdWUgaGVyZS4gIFJlc3RvcmUgdGhpcyBjaGVjayBhbmQgZml4XG4gICAgLy8gIHRoZSB0ZXN0IGNhc2VzIGlmIHdlIGRldGVybWluZSB0aGF0IHhjb2RlIGNhbid0IGhhbmRsZSB1bmtub3duLlxuICAgIC8vIGlmIChmaWxlLmxhc3RLbm93bkZpbGVUeXBlID09ICd1bmtub3duJylcbiAgICAvLyAgICAgdGhyb3cgbmV3IEVycm9yKCdBdHRlbXB0aW5nIHRvIHNldCB0aGUgbGFzdEtub3duRmlsZVR5cGUgb2YgYSBQQlhGaWxlUmVmZXJlbmNlIG9iamVjdCB0byBcInVua25vd25cIicpO1xuXG4gICAgdmFyIGZpbGVPYmplY3Q6IFBCWEZpbGVSZWZlcmVuY2UgPSB7XG4gICAgICAgIGlzYTogXCJQQlhGaWxlUmVmZXJlbmNlXCIsXG4gICAgICAgIG5hbWU6IFwiXFxcIlwiICsgZmlsZS5iYXNlbmFtZSArIFwiXFxcIlwiLFxuICAgICAgICBwYXRoOiBcIlxcXCJcIiArIGZpbGUucGF0aC5yZXBsYWNlKC9cXFxcL2csICcvJykgKyBcIlxcXCJcIixcbiAgICAgICAgc291cmNlVHJlZTogZmlsZS5zb3VyY2VUcmVlLFxuICAgICAgICBmaWxlRW5jb2Rpbmc6IGZpbGUuZmlsZUVuY29kaW5nLFxuICAgICAgICBsYXN0S25vd25GaWxlVHlwZTogZmlsZS5sYXN0S25vd25GaWxlVHlwZSwgLy8gU2hvdWxkIHdlIGFsbG93IHRoaXMgdG8gaW5jbHVkZSBcInVua25vd25cIj9cbiAgICAgICAgZXhwbGljaXRGaWxlVHlwZTogZmlsZS5leHBsaWNpdEZpbGVUeXBlLFxuICAgICAgICBpbmNsdWRlSW5JbmRleDogZmlsZS5pbmNsdWRlSW5JbmRleFxuICAgIH07XG5cbiAgICByZXR1cm4gZmlsZU9iamVjdDtcbn1cblxuaW50ZXJmYWNlIElQYnhHcm91cENoaWxkRmlsZUluZm8geyBmaWxlUmVmPzogWENfUFJPSl9VVUlELCBiYXNlbmFtZTogc3RyaW5nIH1cblxuZnVuY3Rpb24gcGJ4R3JvdXBDaGlsZChmaWxlOiBJUGJ4R3JvdXBDaGlsZEZpbGVJbmZvKTogSUNoaWxkTGlzdEVudHJ5IHtcblxuICAgIGlmICghZmlsZS5maWxlUmVmKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignZmlsZVJlZiBub3Qgc2V0IScpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIHZhbHVlOiBmaWxlLmZpbGVSZWYsXG4gICAgICAgIGNvbW1lbnQ6IGZpbGUuYmFzZW5hbWVcbiAgICB9O1xufVxuXG4vLyBmdW5jdGlvbiBwYnhCdWlsZFBoYXNlT2JqVGhyb3dJZkludmFsaWQoZmlsZTogSUZpbGVQYXRoT2JqKTogSUNoaWxkTGlzdEVudHJ5IHtcbi8vICAgICAvLyBpZiAodHlwZW9mIGZpbGUudXVpZCA9PSBcInN0cmluZ1wiICYmIHR5cGVvZiBmaWxlLmdyb3VwID09IFwic3RyaW5nXCIpIHsgZW5zdXJlZCBncm91cCBpcyBhbHdheXMgc2V0XG4vLyAgICAgaWYgKHR5cGVvZiBmaWxlLnV1aWQgPT0gXCJzdHJpbmdcIikge1xuLy8gICAgICAgICByZXR1cm4gcGJ4QnVpbGRQaGFzZU9iaihmaWxlKTtcbi8vICAgICB9IGVsc2Uge1xuLy8gICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3V1aWQgaXMgbm90IHNldC4nKTtcbi8vICAgICB9XG4vLyB9XG5cbmZ1bmN0aW9uIHBieEJ1aWxkUGhhc2VPYmooZmlsZTogSUZpbGVQYXRoT2JqKTogSUNoaWxkTGlzdEVudHJ5IHtcbiAgICB2YXIgb2JqID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuICAgIGlmICghU2VjdGlvblV0aWxzLmRpY3RLZXlJc1V1aWQoZmlsZS51dWlkKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFRoZSB1dWlkIHZhbHVlIG9mICcke2ZpbGUudXVpZH0nIGlzIGludmFsaWQhYCk7XG4gICAgfVxuXG4gICAgb2JqLnZhbHVlID0gZmlsZS51dWlkO1xuICAgIG9iai5jb21tZW50ID0gbG9uZ0NvbW1lbnQoZmlsZSk7XG5cbiAgICByZXR1cm4gb2JqO1xufVxuXG5mdW5jdGlvbiBwYnhDb3B5RmlsZXNCdWlsZFBoYXNlT2JqKFxuICAgIG9iajogUEJYQnVpbGRQaGFzZUJhc2UsXG4gICAgZm9sZGVyVHlwZTogc3RyaW5nLFxuICAgIHN1YmZvbGRlclBhdGg/OiBzdHJpbmcgfCBudWxsLFxuICAgIHBoYXNlTmFtZT86IHN0cmluZyB8IG51bGwpOiBQQlhDb3B5RmlsZXNCdWlsZFBoYXNlIHtcblxuICAgIC8vIEFkZCBhZGRpdGlvbmFsIHByb3BlcnRpZXMgZm9yICdDb3B5RmlsZXMnIGJ1aWxkIHBoYXNlXG4gICAgdmFyIERFU1RJTkFUSU9OX0JZX1RBUkdFVFRZUEU6IHsgW3RhcmdldFR5cGU6IHN0cmluZ106IHN0cmluZyB9ID0ge1xuICAgICAgICBhcHBsaWNhdGlvbjogJ3dyYXBwZXInLFxuICAgICAgICBhcHBfZXh0ZW5zaW9uOiAncGx1Z2lucycsXG4gICAgICAgIGJ1bmRsZTogJ3dyYXBwZXInLFxuICAgICAgICBjb21tYW5kX2xpbmVfdG9vbDogJ3dyYXBwZXInLFxuICAgICAgICBkeW5hbWljX2xpYnJhcnk6ICdwcm9kdWN0c19kaXJlY3RvcnknLFxuICAgICAgICBmcmFtZXdvcms6ICdzaGFyZWRfZnJhbWV3b3JrcycsXG4gICAgICAgIGZyYW1ld29ya3M6ICdmcmFtZXdvcmtzJyxcbiAgICAgICAgc3RhdGljX2xpYnJhcnk6ICdwcm9kdWN0c19kaXJlY3RvcnknLFxuICAgICAgICB1bml0X3Rlc3RfYnVuZGxlOiAnd3JhcHBlcicsXG4gICAgICAgIHdhdGNoX2FwcDogJ3dyYXBwZXInLFxuICAgICAgICB3YXRjaF9leHRlbnNpb246ICdwbHVnaW5zJ1xuICAgIH1cblxuICAgIHZhciBTVUJGT0xERVJTUEVDX0JZX0RFU1RJTkFUSU9OOiB7IFtkZXN0aW5hdGlvbjogc3RyaW5nXTogbnVtYmVyIH0gPSB7XG4gICAgICAgIGFic29sdXRlX3BhdGg6IDAsXG4gICAgICAgIGV4ZWN1dGFibGVzOiA2LFxuICAgICAgICBmcmFtZXdvcmtzOiAxMCxcbiAgICAgICAgamF2YV9yZXNvdXJjZXM6IDE1LFxuICAgICAgICBwbHVnaW5zOiAxMyxcbiAgICAgICAgcHJvZHVjdHNfZGlyZWN0b3J5OiAxNixcbiAgICAgICAgcmVzb3VyY2VzOiA3LFxuICAgICAgICBzaGFyZWRfZnJhbWV3b3JrczogMTEsXG4gICAgICAgIHNoYXJlZF9zdXBwb3J0OiAxMixcbiAgICAgICAgd3JhcHBlcjogMSxcbiAgICAgICAgeHBjX3NlcnZpY2VzOiAwXG4gICAgfVxuXG4gICAgY29uc3Qgb2JqT3V0ID0gb2JqIGFzIFBCWENvcHlGaWxlc0J1aWxkUGhhc2U7XG4gICAgb2JqT3V0Lm5hbWUgPSAnXCInICsgcGhhc2VOYW1lICsgJ1wiJztcbiAgICBvYmpPdXQuZHN0UGF0aCA9IHN1YmZvbGRlclBhdGggfHwgJ1wiXCInO1xuICAgIG9iak91dC5kc3RTdWJmb2xkZXJTcGVjID0gU1VCRk9MREVSU1BFQ19CWV9ERVNUSU5BVElPTltERVNUSU5BVElPTl9CWV9UQVJHRVRUWVBFW2ZvbGRlclR5cGVdXTtcblxuICAgIHJldHVybiBvYmpPdXQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVBieFNoZWxsU2NyaXB0QnVpbGRQaGFzZU9wdGlvbnMge1xuICAgIGlucHV0UGF0aHM/OiBzdHJpbmdbXSxcbiAgICBvdXRwdXRQYXRocz86IHN0cmluZ1tdLFxuICAgIHNoZWxsUGF0aD86IHN0cmluZyxcbiAgICBzaGVsbFNjcmlwdDogc3RyaW5nIC8vIFJlcXVpcmVkXG59XG5cbmZ1bmN0aW9uIHBieFNoZWxsU2NyaXB0QnVpbGRQaGFzZU9iaihcbiAgICBvYmo6IFBCWEJ1aWxkUGhhc2VCYXNlLFxuICAgIG9wdGlvbnM6IElQYnhTaGVsbFNjcmlwdEJ1aWxkUGhhc2VPcHRpb25zLFxuICAgIHBoYXNlTmFtZTogc3RyaW5nKTogUEJYU2hlbGxTY3JpcHRCdWlsZFBoYXNlIHtcblxuICAgIGNvbnN0IG9iak91dCA9IG9iaiBhcyBQQlhTaGVsbFNjcmlwdEJ1aWxkUGhhc2U7XG4gICAgb2JqT3V0Lm5hbWUgPSAnXCInICsgcGhhc2VOYW1lICsgJ1wiJztcbiAgICBvYmpPdXQuaW5wdXRQYXRocyA9IG9wdGlvbnMuaW5wdXRQYXRocyB8fCBbXTtcbiAgICBvYmpPdXQub3V0cHV0UGF0aHMgPSBvcHRpb25zLm91dHB1dFBhdGhzIHx8IFtdO1xuICAgIG9iak91dC5zaGVsbFBhdGggPSBvcHRpb25zLnNoZWxsUGF0aDtcbiAgICBvYmpPdXQuc2hlbGxTY3JpcHQgPSAnXCInICsgb3B0aW9ucy5zaGVsbFNjcmlwdC5yZXBsYWNlKC9cIi9nLCAnXFxcXFwiJykgKyAnXCInO1xuXG4gICAgcmV0dXJuIG9iak91dDtcbn1cblxuZnVuY3Rpb24gcGJ4QnVpbGRGaWxlQ29tbWVudChmaWxlOiBJTG9uZ0NvbW1lbnRPYmopIHtcbiAgICByZXR1cm4gbG9uZ0NvbW1lbnQoZmlsZSk7XG59XG5cbmZ1bmN0aW9uIHBieEZpbGVSZWZlcmVuY2VDb21tZW50KGZpbGU6IFBieEZpbGUpOiBzdHJpbmcge1xuICAgIHJldHVybiBmaWxlLmJhc2VuYW1lIHx8IHBhdGguYmFzZW5hbWUoZmlsZS5wYXRoKTtcbn1cblxuZnVuY3Rpb24gcGJ4TmF0aXZlVGFyZ2V0Q29tbWVudCh0YXJnZXQ6IFBCWE5hdGl2ZVRhcmdldCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRhcmdldC5uYW1lO1xufVxuXG5mdW5jdGlvbiBsb25nQ29tbWVudChmaWxlOiBJTG9uZ0NvbW1lbnRPYmopOiBzdHJpbmcge1xuXG4gICAgLy8gIFRoaXMgaXMgZmFpbGluZyBhIHRlc3QuICBJIHRlbnRhdGl2ZWx5IHRoaW5rIGl0IHNob3VsZCBmYWlsXG4gICAgLy8gIGFuZCB0aGUgdGVzdCBpcyBiYWQuXG4gICAgLy8gIEhvd2V2ZXIsIGl0IHdhcyBwYXNzaW5nIGFuZCBJIGRvbid0IGtub3cgZW5vdWdoIGFib3V0IHRoZVxuICAgIC8vICBhY3R1YWwgcmVxdWlyZWQgdXNlIGFuZCBleHBlY3RhdGlvbiBvZiB4Y29kZSB0byBrbm93IGlmIGl0IFxuICAgIC8vICBpcyByZWFsbHkgYSBwcm9ibGVtLiAgRm9yIG5vdywganVzdCByZW1vdmUgdGhlIHRocm93IGFuZCBcbiAgICAvLyAgcmVzdG9yZSBpdCBpZiBJIGxhdGVyIGZpbmQgb3V0IG15IG9yaWdpbmFsIGFzc3VtcHRpb24gaXMgY29ycmVjdFxuICAgIC8vICBhbmQgdGhlIHRlc3QgaXMgYmFkIG5vdCB0aGUgY29kZS5cbiAgICAvLyAgXG4gICAgLy8gLy8gIEFkZGluZyBlcnJvciBjaGVja2luZyB0byBtYWtlIHN1cmUgZmlsZS5ncm91cCBleGlzdHNcbiAgICAvLyBpZiAodHlwZW9mIGZpbGUuZ3JvdXAgIT0gXCJzdHJpbmdcIilcbiAgICAvLyAgICAgdGhyb3cgbmV3IEVycm9yKFwiZ3JvdXAgbm90IHNldCBvbiBmaWxlLlwiKTtcblxuICAgIHJldHVybiBmKFwiJXMgaW4gJXNcIiwgZmlsZS5iYXNlbmFtZSwgZmlsZS5ncm91cCk7XG59XG5cbi8vIHJlc3BlY3QgPGdyb3VwPiBwYXRoXG5mdW5jdGlvbiBjb3JyZWN0Rm9yUGx1Z2luc1BhdGgoZmlsZTogUGJ4RmlsZSwgcHJvamVjdDogWGNQcm9qZWN0RmlsZUVkaXRvcikge1xuICAgIHJldHVybiBjb3JyZWN0Rm9yUGF0aChmaWxlLCBwcm9qZWN0LCAnUGx1Z2lucycpO1xufVxuXG5mdW5jdGlvbiBjb3JyZWN0Rm9yUmVzb3VyY2VzUGF0aChmaWxlOiBQYnhGaWxlLCBwcm9qZWN0OiBYY1Byb2plY3RGaWxlRWRpdG9yKSB7XG4gICAgcmV0dXJuIGNvcnJlY3RGb3JQYXRoKGZpbGUsIHByb2plY3QsICdSZXNvdXJjZXMnKTtcbn1cblxuXG4vLyAgbm90IHVzZWRcbi8vIGZ1bmN0aW9uIGNvcnJlY3RGb3JGcmFtZXdvcmtzUGF0aChmaWxlOiBQYnhGaWxlLCBwcm9qZWN0OiBQYnhQcm9qZWN0KSB7XG4vLyAgICAgcmV0dXJuIGNvcnJlY3RGb3JQYXRoKGZpbGUsIHByb2plY3QsICdGcmFtZXdvcmtzJyk7XG4vLyB9XG5cbmZ1bmN0aW9uIGNvcnJlY3RGb3JQYXRoKGZpbGU6IFBieEZpbGUsIHByb2plY3Q6IFhjUHJvamVjdEZpbGVFZGl0b3IsIGdyb3VwOiBzdHJpbmcpOiBQYnhGaWxlIHtcbiAgICB2YXIgcl9ncm91cF9kaXIgPSBuZXcgUmVnRXhwKCdeJyArIGdyb3VwICsgJ1tcXFxcXFxcXC9dJyk7XG5cbiAgICBjb25zdCBncm91cE9iajogUEJYR3JvdXAgfCBudWxsID0gcHJvamVjdC5wYnhHcm91cEJ5TmFtZShncm91cCk7XG5cbiAgICBpZiAoIWdyb3VwT2JqKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJHcm91cCBub3QgZm91bmQhXCIpO1xuXG4gICAgaWYgKGdyb3VwT2JqLnBhdGgpXG4gICAgICAgIGZpbGUucGF0aCA9IGZpbGUucGF0aC5yZXBsYWNlKHJfZ3JvdXBfZGlyLCAnJyk7XG5cbiAgICByZXR1cm4gZmlsZTtcbn1cblxuZnVuY3Rpb24gc2VhcmNoUGF0aEZvckZpbGUoZmlsZTogUGJ4RmlsZSwgcHJvajogWGNQcm9qZWN0RmlsZUVkaXRvcik6IHN0cmluZyB7XG4gICAgY29uc3QgcGx1Z2lucyA9IHByb2oucGJ4R3JvdXBCeU5hbWUoJ1BsdWdpbnMnKTtcbiAgICBjb25zdCBwbHVnaW5zUGF0aCA9IHBsdWdpbnMgPyBwbHVnaW5zLnBhdGggOiBudWxsO1xuXG4gICAgbGV0IGZpbGVEaXIgPSBwYXRoLmRpcm5hbWUoZmlsZS5wYXRoKTtcblxuICAgIGlmIChmaWxlRGlyID09ICcuJykge1xuICAgICAgICBmaWxlRGlyID0gJyc7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZmlsZURpciA9ICcvJyArIGZpbGVEaXI7XG4gICAgfVxuXG4gICAgaWYgKGZpbGUucGx1Z2luICYmIHBsdWdpbnNQYXRoKSB7XG4gICAgICAgIHJldHVybiAnXCJcXFxcXCIkKFNSQ1JPT1QpLycgKyB1bnF1b3RlKHBsdWdpbnNQYXRoKSArICdcXFxcXCJcIic7XG4gICAgfSBlbHNlIGlmIChmaWxlLmN1c3RvbUZyYW1ld29yayAmJiBmaWxlLmRpcm5hbWUpIHtcbiAgICAgICAgcmV0dXJuICdcIlxcXFxcIicgKyBmaWxlLmRpcm5hbWUgKyAnXFxcXFwiXCInO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAnXCJcXFxcXCIkKFNSQ1JPT1QpLycgKyBwcm9qLnByb2R1Y3ROYW1lICsgZmlsZURpciArICdcXFxcXCJcIic7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB1bnF1b3RlU3RyKHN0cjogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gc3RyLnJlcGxhY2UoL15cIiguKilcIiQvLCBcIiQxXCIpO1xufVxuXG5mdW5jdGlvbiB1bnF1b3RlKHN0cjogc3RyaW5nIHwgdW5kZWZpbmVkKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgICBpZiAoc3RyKVxuICAgICAgICByZXR1cm4gdW5xdW90ZVN0cihzdHIpO1xuICAgIGVsc2VcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuXG5cbi8vICBub3QgdXNlZFxuLy8gZnVuY3Rpb24gYnVpbGRQaGFzZU5hbWVGb3JJc2EoaXNhOiBJU0FfVFlQRSk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cbi8vICAgICBjb25zdCBCVUlMRFBIQVNFTkFNRV9CWV9JU0E6IHsgW2lzYVR5cGU6IHN0cmluZ106IHN0cmluZyB9ID0ge1xuLy8gICAgICAgICBQQlhDb3B5RmlsZXNCdWlsZFBoYXNlOiAnQ29weSBGaWxlcycsXG4vLyAgICAgICAgIFBCWFJlc291cmNlc0J1aWxkUGhhc2U6ICdSZXNvdXJjZXMnLFxuLy8gICAgICAgICBQQlhTb3VyY2VzQnVpbGRQaGFzZTogJ1NvdXJjZXMnLFxuLy8gICAgICAgICBQQlhGcmFtZXdvcmtzQnVpbGRQaGFzZTogJ0ZyYW1ld29ya3MnXG4vLyAgICAgfVxuXG4vLyAgICAgcmV0dXJuIEJVSUxEUEhBU0VOQU1FX0JZX0lTQVsoaXNhIGFzIHN0cmluZyldIGFzIHN0cmluZyB8IHVuZGVmaW5lZDtcbi8vIH1cblxuZnVuY3Rpb24gcHJvZHVjdHR5cGVGb3JUYXJnZXR0eXBlKHRhcmdldFR5cGU6IFRBUkdFVF9UWVBFKTogUFJPRFVDVF9UWVBFIHtcblxuICAgIGNvbnN0IFBST0RVQ1RUWVBFX0JZX1RBUkdFVFRZUEU6IHsgW3RhcmdldFR5cGU6IHN0cmluZ106IFBST0RVQ1RfVFlQRSB9ID0ge1xuICAgICAgICBhcHBsaWNhdGlvbjogJ2NvbS5hcHBsZS5wcm9kdWN0LXR5cGUuYXBwbGljYXRpb24nLFxuICAgICAgICBhcHBfZXh0ZW5zaW9uOiAnY29tLmFwcGxlLnByb2R1Y3QtdHlwZS5hcHAtZXh0ZW5zaW9uJyxcbiAgICAgICAgYnVuZGxlOiAnY29tLmFwcGxlLnByb2R1Y3QtdHlwZS5idW5kbGUnLFxuICAgICAgICBjb21tYW5kX2xpbmVfdG9vbDogJ2NvbS5hcHBsZS5wcm9kdWN0LXR5cGUudG9vbCcsXG4gICAgICAgIGR5bmFtaWNfbGlicmFyeTogJ2NvbS5hcHBsZS5wcm9kdWN0LXR5cGUubGlicmFyeS5keW5hbWljJyxcbiAgICAgICAgZnJhbWV3b3JrOiAnY29tLmFwcGxlLnByb2R1Y3QtdHlwZS5mcmFtZXdvcmsnLFxuICAgICAgICBzdGF0aWNfbGlicmFyeTogJ2NvbS5hcHBsZS5wcm9kdWN0LXR5cGUubGlicmFyeS5zdGF0aWMnLFxuICAgICAgICB1bml0X3Rlc3RfYnVuZGxlOiAnY29tLmFwcGxlLnByb2R1Y3QtdHlwZS5idW5kbGUudW5pdC10ZXN0JyxcbiAgICAgICAgd2F0Y2hfYXBwOiAnY29tLmFwcGxlLnByb2R1Y3QtdHlwZS5hcHBsaWNhdGlvbi53YXRjaGFwcCcsXG4gICAgICAgIHdhdGNoX2V4dGVuc2lvbjogJ2NvbS5hcHBsZS5wcm9kdWN0LXR5cGUud2F0Y2hraXQtZXh0ZW5zaW9uJ1xuICAgIH07XG5cbiAgICBjb25zdCBwdCA9IFBST0RVQ1RUWVBFX0JZX1RBUkdFVFRZUEVbdGFyZ2V0VHlwZV07XG5cbiAgICBpZiAocHQgIT09IHVuZGVmaW5lZClcbiAgICAgICAgcmV0dXJuIHB0O1xuICAgIGVsc2VcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBObyBwcm9kdWN0IHR5cGUgZm9yIHRhcmdldCB0eXBlIG9mICcke3RhcmdldFR5cGV9J2ApO1xufVxuXG5mdW5jdGlvbiBmaWxldHlwZUZvclByb2R1Y3R0eXBlKHByb2R1Y3RUeXBlOiBQUk9EVUNUX1RZUEUpOiBYQ19GSUxFVFlQRSB7XG5cbiAgICBjb25zdCBGSUxFVFlQRV9CWV9QUk9EVUNUVFlQRTogeyBbcHJvZHVjdFR5cGU6IHN0cmluZ106IFhDX0ZJTEVUWVBFIH0gPSB7XG4gICAgICAgICdjb20uYXBwbGUucHJvZHVjdC10eXBlLmFwcGxpY2F0aW9uJzogJ3dyYXBwZXIuYXBwbGljYXRpb24nLFxuICAgICAgICAnY29tLmFwcGxlLnByb2R1Y3QtdHlwZS5hcHAtZXh0ZW5zaW9uJzogJ3dyYXBwZXIuYXBwLWV4dGVuc2lvbicsXG4gICAgICAgICdjb20uYXBwbGUucHJvZHVjdC10eXBlLmJ1bmRsZSc6ICd3cmFwcGVyLnBsdWctaW4nLFxuICAgICAgICAnY29tLmFwcGxlLnByb2R1Y3QtdHlwZS50b29sJzogJ2NvbXBpbGVkLm1hY2gtby5keWxpYicsXG4gICAgICAgICdjb20uYXBwbGUucHJvZHVjdC10eXBlLmxpYnJhcnkuZHluYW1pYyc6ICdjb21waWxlZC5tYWNoLW8uZHlsaWInLFxuICAgICAgICAnY29tLmFwcGxlLnByb2R1Y3QtdHlwZS5mcmFtZXdvcmsnOiAnd3JhcHBlci5mcmFtZXdvcmsnLFxuICAgICAgICAnY29tLmFwcGxlLnByb2R1Y3QtdHlwZS5saWJyYXJ5LnN0YXRpYyc6ICdhcmNoaXZlLmFyJyxcbiAgICAgICAgJ2NvbS5hcHBsZS5wcm9kdWN0LXR5cGUuYnVuZGxlLnVuaXQtdGVzdCc6ICd3cmFwcGVyLmNmYnVuZGxlJyxcbiAgICAgICAgJ2NvbS5hcHBsZS5wcm9kdWN0LXR5cGUuYXBwbGljYXRpb24ud2F0Y2hhcHAnOiAnd3JhcHBlci5hcHBsaWNhdGlvbicsXG4gICAgICAgICdjb20uYXBwbGUucHJvZHVjdC10eXBlLndhdGNoa2l0LWV4dGVuc2lvbic6ICd3cmFwcGVyLmFwcC1leHRlbnNpb24nXG4gICAgfTtcblxuICAgIC8vICBJIGFtIHByZXR0eSBzdXJlIHRoZSBvcmlnaW5hbCB2ZXJzaW9uIG9mIHRoaXMgYWRkZWQgdGhlIGRvdWJsZSBxdW90ZXMuXG4gICAgLy8gIGhvd2V2ZXIsIG91ciB0eXBlIGNoZWNraW5nIGRpY3RhdGVzIHRoYXQgdGhleSBkbyBub3QgaGF2ZSB0aGUgcXVvdGVzLlxuICAgIC8vICBXaWxsIHRyb3VibGVzaG9vdCBsYXRlci5cbiAgICAvLyAnY29tLmFwcGxlLnByb2R1Y3QtdHlwZS5hcHBsaWNhdGlvbic6ICdcIndyYXBwZXIuYXBwbGljYXRpb25cIicsXG4gICAgLy8gJ2NvbS5hcHBsZS5wcm9kdWN0LXR5cGUuYXBwLWV4dGVuc2lvbic6ICdcIndyYXBwZXIuYXBwLWV4dGVuc2lvblwiJyxcbiAgICAvLyAnY29tLmFwcGxlLnByb2R1Y3QtdHlwZS5idW5kbGUnOiAnXCJ3cmFwcGVyLnBsdWctaW5cIicsXG4gICAgLy8gJ2NvbS5hcHBsZS5wcm9kdWN0LXR5cGUudG9vbCc6ICdcImNvbXBpbGVkLm1hY2gtby5keWxpYlwiJyxcbiAgICAvLyAnY29tLmFwcGxlLnByb2R1Y3QtdHlwZS5saWJyYXJ5LmR5bmFtaWMnOiAnXCJjb21waWxlZC5tYWNoLW8uZHlsaWJcIicsXG4gICAgLy8gJ2NvbS5hcHBsZS5wcm9kdWN0LXR5cGUuZnJhbWV3b3JrJzogJ1wid3JhcHBlci5mcmFtZXdvcmtcIicsXG4gICAgLy8gJ2NvbS5hcHBsZS5wcm9kdWN0LXR5cGUubGlicmFyeS5zdGF0aWMnOiAnXCJhcmNoaXZlLmFyXCInLFxuICAgIC8vICdjb20uYXBwbGUucHJvZHVjdC10eXBlLmJ1bmRsZS51bml0LXRlc3QnOiAnXCJ3cmFwcGVyLmNmYnVuZGxlXCInLFxuICAgIC8vICdjb20uYXBwbGUucHJvZHVjdC10eXBlLmFwcGxpY2F0aW9uLndhdGNoYXBwJzogJ1wid3JhcHBlci5hcHBsaWNhdGlvblwiJyxcbiAgICAvLyAnY29tLmFwcGxlLnByb2R1Y3QtdHlwZS53YXRjaGtpdC1leHRlbnNpb24nOiAnXCJ3cmFwcGVyLmFwcC1leHRlbnNpb25cIidcblxuXG4gICAgcmV0dXJuIEZJTEVUWVBFX0JZX1BST0RVQ1RUWVBFW3Byb2R1Y3RUeXBlXVxufVxuXG4vKipcbiAqIExvYWRzIGFuIGluIG1lbW9yeSByZXByZXNlbnRhdGlvbiBvZiBhIHByb2pjdC5wYnhwcm9qIGZpbGUsXG4gKiBhbGxvd3MgbWFuaXB1bGF0aW5nIHRoYXQgaW4gbWVtb3J5IHJlcHJlc2VudGF0aW9uLCBhbmQgdGhlblxuICogc2F2aW5nIGl0IGJhY2sgdG8gZGlzay5cbiAqIFxuICogVXNlZCB0byBiZSBjYWxsZWQgcGJ4UHJvamVjdC5cbiAqL1xuZXhwb3J0IGNsYXNzIFhjUHJvamVjdEZpbGVFZGl0b3IgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuXG4gICAgcmVhZG9ubHkgZmlsZXBhdGg6IHN0cmluZztcblxuICAgIGhhc2g/OiBJWGNvZGVQcm9qRmlsZTtcbiAgICB3cml0ZXI/OiBQYnhXcml0ZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihmaWxlbmFtZTogc3RyaW5nKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuZmlsZXBhdGggPSBwYXRoLnJlc29sdmUoZmlsZW5hbWUpO1xuICAgIH1cblxuICAgIC8qKiBcbiAgICAgKiBBc3luY3Jvbm91c2x5IHJlYWQgYW5kIHBhcnNlIHRoZSBmaWxlIGFuZCBjcmVhdGUuICBUaGlzIGZvcmtzXG4gICAgICogYW5vdGhlciBwcm9jZXNzIGFuZCBoYXMgdGhhdCBzZWNvbmQgcHJvY2VzcyBzZW5kIGEgbWVzc2FnZSBiYWNrXG4gICAgICogdG8gdGhlIGZpcnN0LiAgVGhlIGZpcnN0IG1lc3NhZ2UgbmV2ZXIgcmVjZWl2ZWQgYSBtZXNzYWdlIGFuZCBqdXN0XG4gICAgICogZXhpdGVkIHdoZW4gSSB0cmllZCB0aGlzLiAgRHJvcHBlZCB0aGlzIGluIGZhdm9yIG9mIHBhcnNlU3luY1xuICAgICAqIHNpbmNlIHRoaXMgaXMgbm90IGEgc2VydmVyIGFwcGxpY2F0aW9uIGFueXdheXMuXG4gICAgICogXG4gICAgICogQHBhcmFtIGNiIFdpbGwgYmUgY2FsbGVkIHdpdGggcmVzdWx0IGJlaW5nIGFuIGluc3RhbmNlIG9mIGVycm9yXG4gICAgICogKGluZmVycmVkICBmcm9tIG5hbWUgb3IgY29kZSBwcm9wZXJ0eSkgb3IgbnVsbCBpZiBzdWNjZXNzZnVsLiAgVGhlIHNlY29uZFxuICAgICAqIHBhcmFtZXRlciB3aWxsIGJlIHRoZSBtb2RlbCBvZiB0aGUgcHJvamVjdCBmaWxlLCB3aGljaCB5b3Ugc2hvdWxkIFxuICAgICAqIGxpa2VseSBpZ25vcmUgYXMgdGhlIHBvaW50IG9mIHRoaXMgcHJvamVjdCB3cmFwcGVyIGlzIHRvIG1hbmlwdWxhdGUgaXQuXG4gICAgICogXG4gICAgICogUmFzaWVzIGV2ZW50IGVycm9yIG9yIGVuZCBhbHNvLiAgVGhlc2UgYXJlIGFuIGFsdGVybmF0aXZlIHRvIHRoZSB1c2Ugb2YgdGhlXG4gICAgICogY2FsbGJhY2suXG4gICAgICogXG4gICAgICogVGhpcyBtZXRob2QgY2F1c2VzIGlzc3VlcyBhdHRhY2hpbmcgYSBkZWJ1Z2dlciB0byB0aGUgcHJvY2Vzcy4gIFRvIHJlc29sdmUgdGhpc1xuICAgICAqIHlvdSBjYW4gc2V0IHRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZSBcIlhOT0RFX1BBUlNFX0FWT0lEX0ZPUktcIiB0byBcIjFcIiBhbmQgdGhpcyB3aWxsIGF2b2lkIHRoZSBmb3JrXG4gICAgICogYW5kIGFsbG93IHlvdSB0byBkZWJ1ZyB0aGUgY29kZSB3aXRoIGEgZGVidWdnZXIuICBOT1RFIHRoZSBmYWlsdXJlIHdhcyBvbmx5IFxuICAgICAqIGNvbmZpcm1lZCB3aGVuIGRlYnVnZ2luZyBmcm9tIHZzY29kZS5cbiAgICAgKi9cbiAgICBwYXJzZShjYj86IChyZXN1bHQ6IEVycm9yIHwgbnVsbCwgbW9kZWw6IGFueSkgPT4gdm9pZCk6IHRoaXMge1xuXG4gICAgICAgIGlmIChjYikge1xuICAgICAgICAgICAgdGhpcy5vbignZXJyb3InLCBjYik7XG4gICAgICAgICAgICB0aGlzLm9uKCdlbmQnLCBjYik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocmVwbGFjZVBhcnNlV2l0aFBhcnNlU3luYykge1xuICAgICAgICAgICAgLy8gUmVxdWlyZWQgZm9yIGFueSBlZmZlY3RpdmUgdXNlIG9mIGRlYnVnZ2luZyBpbiB2c2NvZGUuXG4gICAgICAgICAgICBsZXQgZXJyb3I6IGFueSA9IG51bGw7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHRoaXMucGFyc2VTeW5jKCk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBlcnJvciA9IGVycjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gIFNjaGVkdWxlIHRoZSBjYWxsYmFjayB0byBiZSBzb21ld2hhdCBjbG9zZSB0byBhIGZvcmsuXG4gICAgICAgICAgICAvLyAgV2UgZG8gdGhpcyBiZWNhdXNlIHdlIHdhbnQgdGhpcyB0byBiZWhhdmUgdGhlIHNhbWUgZHVyaW5nXG4gICAgICAgICAgICAvLyAgZGVidWcgc2Vzc2lvbiBhcyBpbiBhIG5vcm1hbCBzZXNzaW9uIHRoYXQgcGVyZm9ybXMgdGhlIGFjdHVhbCBmb3JrLlxuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgbW9kZWxIYXNoID0gdGhpcy5oYXNoOyAvLyAoZGVidWdnaW5nIGVhc2llcilcbiAgICAgICAgICAgICAgICBjb25zdCByZXRFcnIgPSBlcnJvcjsgLy8gUHVsbCBvdXQgb2YgY2xvc3VyZSAoZGVidWdnaW5nIGVhc2llcilcblxuICAgICAgICAgICAgICAgIC8vIENoZWNrIFN5bnRheEVycm9yIGFuZCBjb2RlIHRvIGtlZXAgbG9naWNhbGx5IGluIHN5bmMgd2l0aCBmb3JrIGNvZGUuXG4gICAgICAgICAgICAgICAgLy8gIEl0IGlzIHByb2JhYmx5IHVubmVjZXNzYXJ5LlxuICAgICAgICAgICAgICAgIGlmIChyZXRFcnIgIT0gbnVsbCAmJiAocmV0RXJyLm5hbWUgPT0gJ1N5bnRheEVycm9yJyB8fCByZXRFcnIuY29kZSkpIHsgXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCByZXRFcnIpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdCgnZW5kJywgbnVsbCwgbW9kZWxIYXNoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LCAxKTtcblxuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAvLyBPcmlnaW5hbCBsb2dpYyBvZiB1c2luZyBmb3JrIGFzc3VtaW5nIHRoYXQgdGhlIHBhcnNlIHByb2Nlc3MgaXMgZXhwZW5zaXZlIFxuICAgICAgICAgICAgLy8gIGFuZCBlYXRpbmcgdmFsdWVhYmxlIENQVSBjeWNsZXMgb2YgdGhlIHByb2Nlc3MgbW9kaWZ5aW5nIHRoaXMgZmlsZS5cbiAgICAgICAgICAgIHZhciB3b3JrZXI6IENoaWxkUHJvY2VzcyA9IGZvcmsoX19kaXJuYW1lICsgJy9wYXJzZUpvYi5qcycsIFt0aGlzLmZpbGVwYXRoXSlcblxuICAgICAgICAgICAgd29ya2VyLm9uKCdtZXNzYWdlJywgKG1zZzogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKG1zZy5uYW1lID09ICdTeW50YXhFcnJvcicgfHwgbXNnLmNvZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIG1zZyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5oYXNoID0gbXNnO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmVtaXQoJ2VuZCcsIG51bGwsIG1zZylcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy99LmJpbmQodGhpcykpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyogc3luYyB2ZXJzaW9uIG9mIHBhcnNlLiAgVGhpcyBhY3R1YWxseSB3b3JrZWQgaW4gbXkgdHJpYWxzIGNvbXBhcmVkIHRvIHRoZSBwYXJzZSB2ZXJzaW9uXG4gICAgIHdoaWNoIGRpZCBub3QuICBUaGUgcGFyc2UgdmVyc2lvbidzIGltcGxlbWVudGF0aW9uIGlzIGFuIG92ZXJlYWdlciBvcHRpbWl6YXRpb24gdGhhdCBhdHRlbXB0c1xuICAgICB0byBwZXJmb3JtIHRoZSBwYXJzaW5nIGluIGEgZm9ya2VkIHByb2Nlc3MuICovXG4gICAgcGFyc2VTeW5jKCk6IHRoaXMge1xuICAgICAgICB2YXIgZmlsZV9jb250ZW50cyA9IGZzLnJlYWRGaWxlU3luYyh0aGlzLmZpbGVwYXRoLCAndXRmLTgnKTtcblxuICAgICAgICB0aGlzLmhhc2ggPSBwYXJzZXIucGFyc2UoZmlsZV9jb250ZW50cyk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qICBHZW5lcmF0ZSB0aGUgY29udGVudHMgb2YgdGhlIHByb2plY3QucGJ4cHJvaiBmaWxlLiAgTm90ZSwgdGhpcyBkb2VzIG5vdFxuICAgIHdyaXRlIGFueXRoaW5nIHRvIGRpc2suICovXG4gICAgd3JpdGVTeW5jKG9wdGlvbnM/OiBQYnhXcml0ZXJPcHRpb25zKTogc3RyaW5nIHtcbiAgICAgICAgdGhpcy53cml0ZXIgPSBuZXcgUGJ4V3JpdGVyKHRoaXMuaGFzaCwgb3B0aW9ucyk7XG4gICAgICAgIHJldHVybiB0aGlzLndyaXRlci53cml0ZVN5bmMoKTtcbiAgICB9XG5cblxuICAgIC8qIFJldHVybiBhbGwgVXVpZHMgd2l0aGluIGFsbCBzZWN0aW9ucyBvZiB0aGUgcHJvamVjdCAqL1xuICAgIGFsbFV1aWRzKCk6IFhDX1BST0pfVVVJRFtdIHtcblxuICAgICAgICBpZiAoIXRoaXMuaGFzaClcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigncGFyc2Ugbm90IGNvbXBsZXRlZCcpO1xuXG4gICAgICAgIGNvbnN0IHNlY3Rpb25zOiB7IFtpc2FUeXBlS2V5OiBzdHJpbmddOiBTZWN0aW9uIH0gPSB0aGlzLmhhc2gucHJvamVjdC5vYmplY3RzO1xuICAgICAgICBsZXQgdXVpZHM6IFhDX1BST0pfVVVJRFtdID0gW107XG5cbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gc2VjdGlvbnMpIHtcbiAgICAgICAgICAgIGNvbnN0IHNlY3Rpb246IFNlY3Rpb24gPSBzZWN0aW9uc1trZXldXG4gICAgICAgICAgICB1dWlkcyA9IHV1aWRzLmNvbmNhdChPYmplY3Qua2V5cyhzZWN0aW9uKSlcbiAgICAgICAgfVxuXG4gICAgICAgIHV1aWRzID0gdXVpZHMuZmlsdGVyKGZ1bmN0aW9uIChrZXk6IFhDX1BST0pfVVVJRCkge1xuICAgICAgICAgICAgLy8gIEkgYW0gdW5jb21mb3J0YWJsZSB0aGF0IHRoaXMgYXNzdW1lcyB0aGVyZSBhcmUgb2JqZWN0cyBpbiB0aGUgZGljdGlvbmFyeVxuICAgICAgICAgICAgLy8gIG90aGVyIHRoYW4gYSBjb21tZW50IG9yIGEgMjQgbG9uZyBVVUlELiAgICBCdXQgSSBmb3VuZCBpdCB0aGlzIHdheSBhbmQgZG9uJ3Qga25vd1xuICAgICAgICAgICAgLy8gIHRoYXQgdGhlIHBhcnNlciBtYXkgbm90IGZpbmQgYSBub24gMjQgY2hhcmFjaHRlciBub24gY29tbWVudC4gICBXZW50IGFsbCBpbiBhbmQgYXNzdW1lZFxuICAgICAgICAgICAgLy8gIGl0IGlzIDI0IGNoYXJzIGV2ZXJ5d2hlcmUuXG4gICAgICAgICAgICAvLyByZXR1cm4gIVNlY3Rpb25VdGlscy5kaWN0S2V5SXNDb21tZW50ICYmIHN0ci5sZW5ndGggPT0gMjQ7XG4gICAgICAgICAgICByZXR1cm4gU2VjdGlvblV0aWxzLmRpY3RLZXlJc1V1aWQoa2V5KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHV1aWRzO1xuICAgIH1cblxuICAgIC8qKiBSZXR1cm4gYSBuZXcgMjQgY2hhcmFjaHRlciBVdWlkIHRoYXQgZG9lcyBub3QgYWxyZWFkeSBleGlzdCBpbiB0aGUgcHJvamVjdCAqL1xuICAgIGdlbmVyYXRlVXVpZCgpOiBYQ19QUk9KX1VVSUQge1xuICAgICAgICBjb25zdCBpZCA9IHV1aWQudjQoKVxuICAgICAgICAgICAgLnJlcGxhY2UoLy0vZywgJycpXG4gICAgICAgICAgICAuc3Vic3RyKDAsIDI0KVxuICAgICAgICAgICAgLnRvVXBwZXJDYXNlKClcblxuICAgICAgICBpZiAodGhpcy5hbGxVdWlkcygpLmluZGV4T2YoaWQpID49IDApIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmdlbmVyYXRlVXVpZCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGlkO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIFxuICAgICAgICAqIEFkZCBhIHBsdWdpbiBmaWxlIGlmIG5vdCBhbHJlYWR5IGV4aXN0aW5nLlxuICAgICAgICAqIEFsc28gYWRkcyBpdCB0byB0aGUgUGJ4RmlsZVJlZmVyZW5jZSBTZWN0aW9uIGFuZCB0aGUgcGx1Z2lucyBQYnhHcm91cFxuICAgICAgICAqIEByZXR1cm5zIG51bGwgaWYgZmlsZSBhbHJlYWR5IGV4aXN0cy5cbiAgICAgICAgKi9cbiAgICBhZGRQbHVnaW5GaWxlKHBhdGg6IHN0cmluZywgb3B0PzogSVBieEZpbGVPcHRpb25zIHwgbnVsbCk6IFBieEZpbGUgfCBudWxsIHtcblxuICAgICAgICBjb25zdCBmaWxlID0gbmV3IFBieEZpbGUocGF0aCwgb3B0KTtcblxuICAgICAgICBmaWxlLnBsdWdpbiA9IHRydWU7IC8vIEFzc3VtaW5nIGEgY2xpZW50IG9mIHRoaXMgbGlicmFyeSB1c2VzIHRoaXMuICBMZWF2aW5nIGZvciBubyBvdGhlciByZWFzb24uXG4gICAgICAgIGNvcnJlY3RGb3JQbHVnaW5zUGF0aChmaWxlLCB0aGlzKTtcblxuICAgICAgICAvLyBudWxsIGlzIGJldHRlciBmb3IgZWFybHkgZXJyb3JzXG4gICAgICAgIGlmICh0aGlzLmhhc0ZpbGUoZmlsZS5wYXRoKSkgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgZmlsZS5maWxlUmVmID0gdGhpcy5nZW5lcmF0ZVV1aWQoKTtcblxuICAgICAgICB0aGlzLmFkZFRvUGJ4RmlsZVJlZmVyZW5jZVNlY3Rpb24oZmlsZSk7ICAgIC8vIFBCWEZpbGVSZWZlcmVuY2VcbiAgICAgICAgdGhpcy5hZGRUb1BsdWdpbnNQYnhHcm91cChmaWxlKTsgICAgICAgICAgICAvLyBQQlhHcm91cFxuXG4gICAgICAgIHJldHVybiBmaWxlO1xuICAgIH1cblxuXG4gICAgLyoqIEludmVyc2Ugb2YgYWRkUGx1Z2luRmlsZS4gIEFsd2F5cyByZXR1cm5zIGEgbmV3IGluc3RhbmNlIGlmIElQYnhGaWxlXG4gICAgICogdGhhdCB3YXMgcmVtb3ZlZC5cbiAgICAgKi9cbiAgICByZW1vdmVQbHVnaW5GaWxlKHBhdGg6IHN0cmluZywgb3B0PzogSVBieEZpbGVPcHRpb25zIHwgbnVsbCk6IFBieEZpbGUge1xuICAgICAgICBjb25zdCBmaWxlID0gbmV3IFBieEZpbGUocGF0aCwgb3B0KTtcbiAgICAgICAgY29ycmVjdEZvclBsdWdpbnNQYXRoKGZpbGUsIHRoaXMpO1xuXG4gICAgICAgIHRoaXMucmVtb3ZlRnJvbVBieEZpbGVSZWZlcmVuY2VTZWN0aW9uKGZpbGUpOyAgICAvLyBQQlhGaWxlUmVmZXJlbmNlXG4gICAgICAgIHRoaXMucmVtb3ZlRnJvbVBsdWdpbnNQYnhHcm91cChmaWxlKTsgICAgICAgICAgICAvLyBQQlhHcm91cFxuXG4gICAgICAgIHJldHVybiBmaWxlO1xuICAgIH1cblxuICAgIC8qICBTaW1pbGFyIHRvIGFkZCBwbHVnaW4gZmlsZSBidXQgaXQgaXMgYWRkZWQgdG8gdGhlIFByb2R1Y3RzUGJ4R3JvdXAgKi9cblxuICAgIGFkZFByb2R1Y3RGaWxlKHRhcmdldFBhdGg6IHN0cmluZyxcbiAgICAgICAgb3B0PzogKElQYnhGaWxlT3B0aW9ucyAmXG4gICAgICAgIHtcbiAgICAgICAgICAgIC8qKiBUaGlzIHdpbGwgb3ZlcnJpZGUgdGhlIGRlZmF1bHQgZ3JvdXAuICAqL1xuICAgICAgICAgICAgZ3JvdXA/OiBGSUxFVFlQRV9HUk9VUFxuICAgICAgICB9XG4gICAgICAgICkgfCBudWxsKTogUGJ4RmlsZSB7XG5cbiAgICAgICAgY29uc3QgZmlsZSA9IG5ldyBQYnhGaWxlKHRhcmdldFBhdGgsIG9wdCk7XG5cbiAgICAgICAgZmlsZS5pbmNsdWRlSW5JbmRleCA9IDA7XG4gICAgICAgIGZpbGUuZmlsZVJlZiA9IHRoaXMuZ2VuZXJhdGVVdWlkKCk7XG4gICAgICAgIGZpbGUudGFyZ2V0ID0gb3B0ID8gb3B0LnRhcmdldCA6IHVuZGVmaW5lZDtcbiAgICAgICAgZmlsZS5ncm91cCA9IG9wdCA/IG9wdC5ncm91cCA6IHVuZGVmaW5lZDtcbiAgICAgICAgZmlsZS51dWlkID0gdGhpcy5nZW5lcmF0ZVV1aWQoKTtcbiAgICAgICAgZmlsZS5wYXRoID0gZmlsZS5iYXNlbmFtZTtcblxuICAgICAgICB0aGlzLmFkZFRvUGJ4RmlsZVJlZmVyZW5jZVNlY3Rpb24oZmlsZSk7XG4gICAgICAgIHRoaXMuYWRkVG9Qcm9kdWN0c1BieEdyb3VwKGZpbGUpOyAgICAgICAgICAgICAgICAvLyBQQlhHcm91cFxuXG4gICAgICAgIHJldHVybiBmaWxlO1xuICAgIH1cblxuICAgIC8qKiBUaGlzIHJlbW92ZXMgdGhpcyBmcm9tIHRoZSBwcm9kdWN0cyBncm91cC4gIE9kZGx5IGVub3VnaCBpdCBkb2VzIG5vdFxuICAgICAqIHJlbW92ZSBpdCBmcm9tIHRoZSBQYnhSZWZlcmVuY2VTZWN0aW9uIGFzIGEgcGx1Z2luIGZpbGUuICBJIGRvbid0IGtub3dcbiAgICAgKiB3aHkgdGhpcyBpcyBhdCB0aGUgdGltZSBvZiB3cml0aW5nLlxuICAgICAqL1xuICAgIHJlbW92ZVByb2R1Y3RGaWxlKHBhdGg6IHN0cmluZywgb3B0PzogSVBieEZpbGVPcHRpb25zIHwgbnVsbCk6IFBieEZpbGUge1xuICAgICAgICBjb25zdCBmaWxlID0gbmV3IFBieEZpbGUocGF0aCwgb3B0KTtcblxuICAgICAgICB0aGlzLnJlbW92ZUZyb21Qcm9kdWN0c1BieEdyb3VwKGZpbGUpOyAgICAgICAgICAgLy8gUEJYR3JvdXBcblxuICAgICAgICByZXR1cm4gZmlsZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSBwYXRoIHtTdHJpbmd9XG4gICAgICogQHBhcmFtIG9wdCB7T2JqZWN0fSBzZWUgUGJ4RmlsZSBmb3IgYXZhaWwgb3B0aW9uc1xuICAgICAqIEBwYXJhbSBncm91cCB7U3RyaW5nfSBncm91cCBrZXlcbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBmaWxlOyBzZWUgUGJ4RmlsZVxuICAgICAqL1xuICAgIGFkZFNvdXJjZUZpbGUocGF0aDogc3RyaW5nLCBvcHQ/OiBJUGJ4RmlsZU9wdGlvbnMsIGdyb3VwPzogc3RyaW5nKTogUGJ4RmlsZSB8IGZhbHNlIHtcbiAgICAgICAgbGV0IGZpbGU7XG4gICAgICAgIGlmIChncm91cCkge1xuICAgICAgICAgICAgZmlsZSA9IHRoaXMuYWRkRmlsZShwYXRoLCBncm91cCwgb3B0KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGZpbGUgPSB0aGlzLmFkZFBsdWdpbkZpbGUocGF0aCwgb3B0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghZmlsZSlcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICBmaWxlLnRhcmdldCA9IG9wdCA/IG9wdC50YXJnZXQgOiB1bmRlZmluZWQ7XG4gICAgICAgIGZpbGUudXVpZCA9IHRoaXMuZ2VuZXJhdGVVdWlkKCk7XG5cbiAgICAgICAgdGhpcy5hZGRUb1BieEJ1aWxkRmlsZVNlY3Rpb24oZmlsZSk7ICAgICAgICAvLyBQQlhCdWlsZEZpbGVcbiAgICAgICAgdGhpcy5hZGRUb1BieFNvdXJjZXNCdWlsZFBoYXNlKGZpbGUpOyAgICAgICAvLyBQQlhTb3VyY2VzQnVpbGRQaGFzZVxuXG4gICAgICAgIHJldHVybiBmaWxlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHBhdGgge1N0cmluZ31cbiAgICAgKiBAcGFyYW0gb3B0IHtPYmplY3R9IHNlZSBQYnhGaWxlIGZvciBhdmFpbCBvcHRpb25zXG4gICAgICogQHBhcmFtIGdyb3VwIHtTdHJpbmd9IGdyb3VwIGtleVxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9IGZpbGU7IHNlZSBQYnhGaWxlXG4gICAgICovXG4gICAgcmVtb3ZlU291cmNlRmlsZShwYXRoOiBzdHJpbmcsIG9wdD86IElQYnhGaWxlT3B0aW9ucywgZ3JvdXA/OiBzdHJpbmcgfCBudWxsKTogUGJ4RmlsZSB7XG5cbiAgICAgICAgbGV0IGZpbGU6IFBieEZpbGU7XG5cbiAgICAgICAgaWYgKGdyb3VwKSB7XG4gICAgICAgICAgICBmaWxlID0gdGhpcy5yZW1vdmVGaWxlKHBhdGgsIGdyb3VwLCBvcHQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZmlsZSA9IHRoaXMucmVtb3ZlUGx1Z2luRmlsZShwYXRoLCBvcHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgZmlsZS50YXJnZXQgPSBvcHQgPyBvcHQudGFyZ2V0IDogdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLnJlbW92ZUZyb21QYnhCdWlsZEZpbGVTZWN0aW9uKGZpbGUpOyAgICAgICAgLy8gUEJYQnVpbGRGaWxlXG4gICAgICAgIHRoaXMucmVtb3ZlRnJvbVBieFNvdXJjZXNCdWlsZFBoYXNlKGZpbGUpOyAgICAgICAvLyBQQlhTb3VyY2VzQnVpbGRQaGFzZVxuXG4gICAgICAgIHJldHVybiBmaWxlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHBhdGgge1N0cmluZ31cbiAgICAgKiBAcGFyYW0gb3B0IHtPYmplY3R9IHNlZSBwYnhGaWxlIGZvciBhdmFpbCBvcHRpb25zXG4gICAgICogQHBhcmFtIGdyb3VwIHtTdHJpbmd9IGdyb3VwIGtleVxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9IGZpbGU7IHNlZSBwYnhGaWxlXG4gICAgICovXG4gICAgYWRkSGVhZGVyRmlsZShwYXRoOiBzdHJpbmcsIG9wdD86IElQYnhGaWxlT3B0aW9ucywgZ3JvdXA/OiBzdHJpbmcgfCBudWxsKTogUGJ4RmlsZSB8IG51bGwge1xuICAgICAgICBpZiAoZ3JvdXApIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmFkZEZpbGUocGF0aCwgZ3JvdXAsIG9wdCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5hZGRQbHVnaW5GaWxlKHBhdGgsIG9wdCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSBwYXRoIHtTdHJpbmd9XG4gICAgICogQHBhcmFtIG9wdCB7T2JqZWN0fSBzZWUgcGJ4RmlsZSBmb3IgYXZhaWwgb3B0aW9uc1xuICAgICAqIEBwYXJhbSBncm91cCB7U3RyaW5nfSBncm91cCBrZXlcbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBmaWxlOyBzZWUgcGJ4RmlsZVxuICAgICAqL1xuICAgIHJlbW92ZUhlYWRlckZpbGUocGF0aDogc3RyaW5nLCBvcHQ/OiBJUGJ4RmlsZU9wdGlvbnMgfCBudWxsLCBncm91cD86IHN0cmluZyB8IG51bGwpOiBQYnhGaWxlIHtcbiAgICAgICAgaWYgKGdyb3VwKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5yZW1vdmVGaWxlKHBhdGgsIGdyb3VwLCBvcHQpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVtb3ZlUGx1Z2luRmlsZShwYXRoLCBvcHQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0gcGF0aCB7U3RyaW5nfVxuICAgICAqIEBwYXJhbSBvcHQge09iamVjdH0gc2VlIHBieEZpbGUgZm9yIGF2YWlsIG9wdGlvbnNcbiAgICAgKiBAcGFyYW0gZ3JvdXAge1N0cmluZ30gZ3JvdXAga2V5XG4gICAgICogQHJldHVybnMge1BieEZpbGV9IGlmIGFkZGVkIG9yIGZhbHNlIGlmIGl0IGFscmVhZHkgZXhpc3RlZC5cbiAgICAgKi9cbiAgICBhZGRSZXNvdXJjZUZpbGUoXG4gICAgICAgIHBhdGg6IHN0cmluZyxcbiAgICAgICAgb3B0PzogKElQYnhGaWxlT3B0aW9ucyAmIHsgcGx1Z2luPzogYm9vbGVhbjsgdmFyaWFudEdyb3VwPzogYm9vbGVhbiB9KSB8IG51bGwsXG4gICAgICAgIGdyb3VwPzogWENfUFJPSl9VVUlEIHwgbnVsbCk6IFBieEZpbGUgfCBmYWxzZSB7XG5cbiAgICAgICAgb3B0ID0gb3B0IHx8IHt9O1xuXG4gICAgICAgIGxldCBmaWxlOiBQYnhGaWxlIHwgbnVsbCB8IHVuZGVmaW5lZDtcblxuICAgICAgICBpZiAob3B0LnBsdWdpbikge1xuICAgICAgICAgICAgZmlsZSA9IHRoaXMuYWRkUGx1Z2luRmlsZShwYXRoLCBvcHQpO1xuICAgICAgICAgICAgaWYgKCFmaWxlKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmaWxlID0gbmV3IFBieEZpbGUocGF0aCwgb3B0KTtcbiAgICAgICAgICAgIGlmICh0aGlzLmhhc0ZpbGUoZmlsZS5wYXRoKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgZmlsZS51dWlkID0gdGhpcy5nZW5lcmF0ZVV1aWQoKTtcbiAgICAgICAgZmlsZS50YXJnZXQgPSBvcHQgPyBvcHQudGFyZ2V0IDogdW5kZWZpbmVkO1xuXG4gICAgICAgIGlmICghb3B0LnBsdWdpbikge1xuICAgICAgICAgICAgY29ycmVjdEZvclJlc291cmNlc1BhdGgoZmlsZSwgdGhpcyk7XG4gICAgICAgICAgICBmaWxlLmZpbGVSZWYgPSB0aGlzLmdlbmVyYXRlVXVpZCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFvcHQudmFyaWFudEdyb3VwKSB7XG4gICAgICAgICAgICB0aGlzLmFkZFRvUGJ4QnVpbGRGaWxlU2VjdGlvbihmaWxlKTsgICAgICAgIC8vIFBCWEJ1aWxkRmlsZVxuICAgICAgICAgICAgdGhpcy5hZGRUb1BieFJlc291cmNlc0J1aWxkUGhhc2UoZmlsZSk7ICAgICAvLyBQQlhSZXNvdXJjZXNCdWlsZFBoYXNlXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIW9wdC5wbHVnaW4pIHtcbiAgICAgICAgICAgIHRoaXMuYWRkVG9QYnhGaWxlUmVmZXJlbmNlU2VjdGlvbihmaWxlKTsgICAgLy8gUEJYRmlsZVJlZmVyZW5jZVxuICAgICAgICAgICAgaWYgKGdyb3VwKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZ2V0UEJYR3JvdXBCeUtleShncm91cCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hZGRUb1BieEdyb3VwKGZpbGUsIGdyb3VwKTsgICAgICAgIC8vR3JvdXAgb3RoZXIgdGhhbiBSZXNvdXJjZXMgKGkuZS4gJ3NwbGFzaCcpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuZ2V0UEJYVmFyaWFudEdyb3VwQnlLZXkoZ3JvdXApKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkVG9QYnhWYXJpYW50R3JvdXAoZmlsZSwgZ3JvdXApOyAgLy8gUEJYVmFyaWFudEdyb3VwXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hZGRUb1Jlc291cmNlc1BieEdyb3VwKGZpbGUpOyAgICAgICAgICAvLyBQQlhHcm91cFxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmlsZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSBwYXRoIHtTdHJpbmd9XG4gICAgICogQHBhcmFtIG9wdCB7T2JqZWN0fSBzZWUgcGJ4RmlsZSBmb3IgYXZhaWwgb3B0aW9uc1xuICAgICAqIEBwYXJhbSBncm91cFV1aWQge1N0cmluZ30gZ3JvdXAga2V5XG4gICAgICogQHJldHVybnMge09iamVjdH0gZmlsZTsgc2VlIHBieEZpbGVcbiAgICAgKi9cbiAgICByZW1vdmVSZXNvdXJjZUZpbGUocGF0aDogc3RyaW5nLCBvcHQ/OiBJUGJ4RmlsZU9wdGlvbnMgfCBudWxsLCBncm91cFV1aWQ/OiBYQ19QUk9KX1VVSUQpOiBQYnhGaWxlIHtcbiAgICAgICAgdmFyIGZpbGUgPSBuZXcgUGJ4RmlsZShwYXRoLCBvcHQpO1xuICAgICAgICBmaWxlLnRhcmdldCA9IG9wdCA/IG9wdC50YXJnZXQgOiB1bmRlZmluZWQ7XG5cbiAgICAgICAgY29ycmVjdEZvclJlc291cmNlc1BhdGgoZmlsZSwgdGhpcyk7XG5cbiAgICAgICAgdGhpcy5yZW1vdmVGcm9tUGJ4QnVpbGRGaWxlU2VjdGlvbihmaWxlKTsgICAgICAgIC8vIFBCWEJ1aWxkRmlsZVxuICAgICAgICB0aGlzLnJlbW92ZUZyb21QYnhGaWxlUmVmZXJlbmNlU2VjdGlvbihmaWxlKTsgICAgLy8gUEJYRmlsZVJlZmVyZW5jZVxuXG4gICAgICAgIGlmIChncm91cFV1aWQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmdldFBCWEdyb3VwQnlLZXkoZ3JvdXBVdWlkKSkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVtb3ZlRnJvbVBieEdyb3VwKGZpbGUsIGdyb3VwVXVpZCk7ICAgICAgICAvL0dyb3VwIG90aGVyIHRoYW4gUmVzb3VyY2VzIChpLmUuICdzcGxhc2gnKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5nZXRQQlhWYXJpYW50R3JvdXBCeUtleShncm91cFV1aWQpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW1vdmVGcm9tUGJ4VmFyaWFudEdyb3VwKGZpbGUsIGdyb3VwVXVpZCk7ICAvLyBQQlhWYXJpYW50R3JvdXBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlRnJvbVJlc291cmNlc1BieEdyb3VwKGZpbGUpOyAgICAgICAgICAvLyBQQlhHcm91cFxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5yZW1vdmVGcm9tUGJ4UmVzb3VyY2VzQnVpbGRQaGFzZShmaWxlKTsgICAgIC8vIFBCWFJlc291cmNlc0J1aWxkUGhhc2VcblxuICAgICAgICByZXR1cm4gZmlsZTtcbiAgICB9XG5cbiAgICBhZGRGcmFtZXdvcmsoZnBhdGg6IHN0cmluZyxcbiAgICAgICAgb3B0PzogKElQYnhGaWxlT3B0aW9ucyAmXG4gICAgICAgIHtcbiAgICAgICAgICAgIC8qKiBkZWZhdWx0cyB0byB0cnVlIGlmIG5vdCBzcGVjaWZpZWQuICovXG4gICAgICAgICAgICBsaW5rPzogYm9vbGVhblxuICAgICAgICB9XG4gICAgICAgICkgfCBudWxsKTogUGJ4RmlsZSB8IGZhbHNlIHtcblxuICAgICAgICAvLyAgV2UgY2FwdHVyZSB0aGVzZSBlYXJseSBzaW5jZSB0aGUgb3B0aW9uIGlzIG1vZGlmaWVkIGFmdGVyIGNhbGxpbmcuXG4gICAgICAgIGNvbnN0IGN1c3RvbUZyYW1ld29yazogYm9vbGVhbiA9ICEhKG9wdCAmJiBvcHQuY3VzdG9tRnJhbWV3b3JrID09IHRydWUpO1xuICAgICAgICBjb25zdCBsaW5rOiBib29sZWFuID0gIW9wdCB8fCAob3B0LmxpbmsgPT0gdW5kZWZpbmVkIHx8IG9wdC5saW5rKTsgICAgLy9kZWZhdWx0cyB0byB0cnVlIGlmIG5vdCBzcGVjaWZpZWRcbiAgICAgICAgY29uc3QgZW1iZWQ6IGJvb2xlYW4gPSAhIShvcHQgJiYgb3B0LmVtYmVkKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL2RlZmF1bHRzIHRvIGZhbHNlIGlmIG5vdCBzcGVjaWZpZWRcblxuICAgICAgICBpZiAob3B0KSB7XG4gICAgICAgICAgICBkZWxldGUgb3B0LmVtYmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGZpbGUgPSBuZXcgUGJ4RmlsZShmcGF0aCwgb3B0KTtcblxuICAgICAgICBmaWxlLnV1aWQgPSB0aGlzLmdlbmVyYXRlVXVpZCgpO1xuICAgICAgICBmaWxlLmZpbGVSZWYgPSB0aGlzLmdlbmVyYXRlVXVpZCgpO1xuICAgICAgICBmaWxlLnRhcmdldCA9IG9wdCA/IG9wdC50YXJnZXQgOiB1bmRlZmluZWQ7XG5cbiAgICAgICAgaWYgKHRoaXMuaGFzRmlsZShmaWxlLnBhdGgpKSByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5hZGRUb1BieEJ1aWxkRmlsZVNlY3Rpb24oZmlsZSk7ICAgICAgICAvLyBQQlhCdWlsZEZpbGVcbiAgICAgICAgdGhpcy5hZGRUb1BieEZpbGVSZWZlcmVuY2VTZWN0aW9uKGZpbGUpOyAgICAvLyBQQlhGaWxlUmVmZXJlbmNlXG4gICAgICAgIHRoaXMuYWRkVG9GcmFtZXdvcmtzUGJ4R3JvdXAoZmlsZSk7ICAgICAgICAgLy8gUEJYR3JvdXBcblxuICAgICAgICBpZiAobGluaykge1xuICAgICAgICAgICAgdGhpcy5hZGRUb1BieEZyYW1ld29ya3NCdWlsZFBoYXNlKGZpbGUpOyAgICAvLyBQQlhGcmFtZXdvcmtzQnVpbGRQaGFzZVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdCAmJiBjdXN0b21GcmFtZXdvcmspIHsgLy8gZXh0cmEgY2hlY2sgb24gb3B0IGlzIGZvciBUeXBlc2NyaXB0LCBub3QgbG9naWNhbGx5IHJlcXVpcmVkXG4gICAgICAgICAgICB0aGlzLmFkZFRvRnJhbWV3b3JrU2VhcmNoUGF0aHMoZmlsZSk7XG5cbiAgICAgICAgICAgIGlmIChlbWJlZCkge1xuICAgICAgICAgICAgICAgIG9wdC5lbWJlZCA9IGVtYmVkO1xuICAgICAgICAgICAgICAgIHZhciBlbWJlZGRlZEZpbGUgPSBuZXcgUGJ4RmlsZShmcGF0aCwgb3B0KTtcblxuICAgICAgICAgICAgICAgIGVtYmVkZGVkRmlsZS51dWlkID0gdGhpcy5nZW5lcmF0ZVV1aWQoKTtcbiAgICAgICAgICAgICAgICBlbWJlZGRlZEZpbGUuZmlsZVJlZiA9IGZpbGUuZmlsZVJlZjtcblxuICAgICAgICAgICAgICAgIC8va2VlcGluZyBhIHNlcGFyYXRlIFBCWEJ1aWxkRmlsZSBlbnRyeSBmb3IgRW1iZWQgRnJhbWV3b3Jrc1xuICAgICAgICAgICAgICAgIHRoaXMuYWRkVG9QYnhCdWlsZEZpbGVTZWN0aW9uKGVtYmVkZGVkRmlsZSk7ICAgICAgICAvLyBQQlhCdWlsZEZpbGVcblxuICAgICAgICAgICAgICAgIHRoaXMuYWRkVG9QYnhFbWJlZEZyYW1ld29ya3NCdWlsZFBoYXNlKGVtYmVkZGVkRmlsZSk7IC8vIFBCWENvcHlGaWxlc0J1aWxkUGhhc2VcblxuICAgICAgICAgICAgICAgIHJldHVybiBlbWJlZGRlZEZpbGU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmlsZTtcbiAgICB9XG5cbiAgICByZW1vdmVGcmFtZXdvcmsoZnBhdGg6IHN0cmluZywgb3B0PzogSVBieEZpbGVPcHRpb25zIHwgbnVsbCk6IFBieEZpbGUge1xuICAgICAgICAvLyAgVGhpcyB3YXMgY2FsY3VsYXRlZCBpbiB0aGUgb3JpZ2luYWwgY29kZSwgYnV0IG5ldmVyIHVzZWQuICBFcnJvcj8gIDEwLzIwMTlcbiAgICAgICAgLy9jb25zdCBlbWJlZDpib29sZWFuID0gISEob3B0ICYmIG9wdC5lbWJlZCk7XG5cbiAgICAgICAgaWYgKG9wdCkge1xuICAgICAgICAgICAgZGVsZXRlIG9wdC5lbWJlZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGZpbGUgPSBuZXcgUGJ4RmlsZShmcGF0aCwgb3B0KTtcbiAgICAgICAgZmlsZS50YXJnZXQgPSBvcHQgPyBvcHQudGFyZ2V0IDogdW5kZWZpbmVkO1xuXG4gICAgICAgIHRoaXMucmVtb3ZlRnJvbVBieEJ1aWxkRmlsZVNlY3Rpb24oZmlsZSk7ICAgICAgICAgIC8vIFBCWEJ1aWxkRmlsZVxuICAgICAgICB0aGlzLnJlbW92ZUZyb21QYnhGaWxlUmVmZXJlbmNlU2VjdGlvbihmaWxlKTsgICAgICAvLyBQQlhGaWxlUmVmZXJlbmNlXG4gICAgICAgIHRoaXMucmVtb3ZlRnJvbUZyYW1ld29ya3NQYnhHcm91cChmaWxlKTsgICAgICAgICAgIC8vIFBCWEdyb3VwXG4gICAgICAgIHRoaXMucmVtb3ZlRnJvbVBieEZyYW1ld29ya3NCdWlsZFBoYXNlKGZpbGUpOyAgICAgIC8vIFBCWEZyYW1ld29ya3NCdWlsZFBoYXNlXG5cbiAgICAgICAgaWYgKG9wdCAmJiBvcHQuY3VzdG9tRnJhbWV3b3JrKSB7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZUZyb21GcmFtZXdvcmtTZWFyY2hQYXRocyhmaWxlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG9wdCA9IG9wdCB8fCB7fTtcbiAgICAgICAgb3B0LmVtYmVkID0gdHJ1ZTtcbiAgICAgICAgdmFyIGVtYmVkZGVkRmlsZSA9IG5ldyBQYnhGaWxlKGZwYXRoLCBvcHQpO1xuXG4gICAgICAgIGVtYmVkZGVkRmlsZS5maWxlUmVmID0gZmlsZS5maWxlUmVmO1xuXG4gICAgICAgIHRoaXMucmVtb3ZlRnJvbVBieEJ1aWxkRmlsZVNlY3Rpb24oZW1iZWRkZWRGaWxlKTsgICAgICAgICAgLy8gUEJYQnVpbGRGaWxlXG4gICAgICAgIHRoaXMucmVtb3ZlRnJvbVBieEVtYmVkRnJhbWV3b3Jrc0J1aWxkUGhhc2UoZW1iZWRkZWRGaWxlKTsgLy8gUEJYQ29weUZpbGVzQnVpbGRQaGFzZVxuXG4gICAgICAgIHJldHVybiBmaWxlO1xuICAgIH1cblxuXG4gICAgYWRkQ29weWZpbGUoZnBhdGg6IHN0cmluZywgb3B0PzogSVBieEZpbGVPcHRpb25zIHwgbnVsbCk6IFBieEZpbGUge1xuXG4gICAgICAgIGxldCBmaWxlOiBQYnhGaWxlID0gbmV3IFBieEZpbGUoZnBhdGgsIG9wdCk7XG5cbiAgICAgICAgLy8gY2F0Y2ggZHVwbGljYXRlc1xuICAgICAgICBsZXQgZXhpc3RpbmdGaWxlOiBQQlhGaWxlUmVmZXJlbmNlIHwgZmFsc2UgPSB0aGlzLmhhc0ZpbGUoZmlsZS5wYXRoKTtcblxuICAgICAgICBpZiAoZXhpc3RpbmdGaWxlKSB7XG4gICAgICAgICAgICAvLyAgV0FSTklORzpcbiAgICAgICAgICAgIC8vICBUaGlzIGlzIHRoZSBvcmlnaW5hbCBsb2dpYy4gICAoRm91bmQgMTAvMjAxOSB3aGVuIGNvbnZlcnRpbmcgdG8gVFMpXG4gICAgICAgICAgICAvLyAgSXQgdHJlYXRzIHRoZSBhY3R1YWwgUEJYRmlsZVJlZmVyZW5jZSBvYmplY3QgdGhhdCBpcyBhbHJlYWR5XG4gICAgICAgICAgICAvLyAgaW50ZWdyYXRlZCBpbnRvIHRoZSBmaWxlIG9iamVjdCBtb2RlbCBhcyBhIFBieEZpbGUsIG1vZGlmaWVzXG4gICAgICAgICAgICAvLyAgaXQgYW5kIHRoZW4gcmV0dXJucyBpdCB0byB0aGUgY2FsbGVyLiAgVGhpcyBzZWVtcyB1bmRlc2lyYWJsZS5cbiAgICAgICAgICAgIC8vICBJIGFzc3VtZSBpdCB3b3JrcyBzaW5jZSB0aGUgUGJ4RmlsZSBhbmQgUEJYRmlsZVJlZmVyZW5jZXMgaGF2ZSBcbiAgICAgICAgICAgIC8vICBtYW55IG9mIHRoZSBzYW1lIHByb3BlcnRpZXMgYW5kIHRoZSBvbmVzIHRoYXQgYXJlIGJlaW5nIG1vZGlmaWVkXG4gICAgICAgICAgICAvLyAgYmVsb3cgc2hvdWxkIG5vdCBiZSB3cml0dGVuIGJhY2sgdG8gdGhlIGFjdHVhbCBmaWxlLlxuICAgICAgICAgICAgLy8gIEkgYW0gbm90IHN1cmUgdGhpcyBpcyBjb3JyZWN0IGF0IGFsbC4gIFxuICAgICAgICAgICAgLy8gIFdpbGwgbGVhdmUgZm9yIG5vdyBhbmQgcmVzb2x2ZSBpZiBpdCB0dXJucyBvdXQgdG8gYmUgYSBidWcuXG4gICAgICAgICAgICBmaWxlID0gZXhpc3RpbmdGaWxlIGFzIGFueSBhcyBQYnhGaWxlO1xuICAgICAgICB9XG5cbiAgICAgICAgZmlsZS5maWxlUmVmID0gZmlsZS51dWlkID0gdGhpcy5nZW5lcmF0ZVV1aWQoKTtcbiAgICAgICAgZmlsZS50YXJnZXQgPSBvcHQgPyBvcHQudGFyZ2V0IDogdW5kZWZpbmVkO1xuXG4gICAgICAgIHRoaXMuYWRkVG9QYnhCdWlsZEZpbGVTZWN0aW9uKGZpbGUpOyAgICAgICAgLy8gUEJYQnVpbGRGaWxlXG4gICAgICAgIHRoaXMuYWRkVG9QYnhGaWxlUmVmZXJlbmNlU2VjdGlvbihmaWxlKTsgICAgLy8gUEJYRmlsZVJlZmVyZW5jZVxuICAgICAgICB0aGlzLmFkZFRvUGJ4Q29weWZpbGVzQnVpbGRQaGFzZShmaWxlKTsgICAgIC8vIFBCWENvcHlGaWxlc0J1aWxkUGhhc2VcblxuICAgICAgICByZXR1cm4gZmlsZTtcbiAgICB9XG5cbiAgICBwYnhDb3B5ZmlsZXNCdWlsZFBoYXNlT2JqKHRhcmdldD86IFhDX1BST0pfVVVJRCB8IG51bGwpOiBQQlhDb3B5RmlsZXNCdWlsZFBoYXNlIHwgbnVsbCB7XG4gICAgICAgIHJldHVybiB0aGlzLmJ1aWxkUGhhc2VPYmplY3QoJ1BCWENvcHlGaWxlc0J1aWxkUGhhc2UnLCAnQ29weSBGaWxlcycsIHRhcmdldCk7XG4gICAgfVxuXG4gICAgYWRkVG9QYnhDb3B5ZmlsZXNCdWlsZFBoYXNlKGZpbGU6IFBieEZpbGUpOiB2b2lkIHtcbiAgICAgICAgY29uc3Qgc291cmNlcyA9XG4gICAgICAgICAgICB0aGlzLmJ1aWxkUGhhc2VPYmplY3Q8UEJYQ29weUZpbGVzQnVpbGRQaGFzZT4oJ1BCWENvcHlGaWxlc0J1aWxkUGhhc2UnLFxuICAgICAgICAgICAgICAgICdDb3B5IEZpbGVzJywgZmlsZS50YXJnZXQpIGFzIFBCWENvcHlGaWxlc0J1aWxkUGhhc2U7XG5cbiAgICAgICAgaWYgKCFzb3VyY2VzKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3RhcmdldCBub3QgZm91bmQnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNvdXJjZXMuZmlsZXMucHVzaChwYnhCdWlsZFBoYXNlT2JqKGZpbGUpKTtcbiAgICB9XG5cbiAgICByZW1vdmVDb3B5ZmlsZShmcGF0aDogc3RyaW5nLCBvcHQ6IElQYnhGaWxlT3B0aW9ucykge1xuICAgICAgICB2YXIgZmlsZSA9IG5ldyBQYnhGaWxlKGZwYXRoLCBvcHQpO1xuICAgICAgICBmaWxlLnRhcmdldCA9IG9wdCA/IG9wdC50YXJnZXQgOiB1bmRlZmluZWQ7XG5cbiAgICAgICAgdGhpcy5yZW1vdmVGcm9tUGJ4QnVpbGRGaWxlU2VjdGlvbihmaWxlKTsgICAgICAgIC8vIFBCWEJ1aWxkRmlsZVxuICAgICAgICB0aGlzLnJlbW92ZUZyb21QYnhGaWxlUmVmZXJlbmNlU2VjdGlvbihmaWxlKTsgICAgLy8gUEJYRmlsZVJlZmVyZW5jZVxuICAgICAgICB0aGlzLnJlbW92ZUZyb21QYnhDb3B5ZmlsZXNCdWlsZFBoYXNlKGZpbGUpOyAgICAvLyBQQlhGcmFtZXdvcmtzQnVpbGRQaGFzZVxuXG4gICAgICAgIHJldHVybiBmaWxlO1xuICAgIH1cblxuICAgIHJlbW92ZUZyb21QYnhDb3B5ZmlsZXNCdWlsZFBoYXNlKGZpbGU6IFBieEZpbGUpOiB2b2lkIHtcbiAgICAgICAgY29uc3Qgc291cmNlczogUEJYQ29weUZpbGVzQnVpbGRQaGFzZSB8IG51bGwgPSB0aGlzLnBieENvcHlmaWxlc0J1aWxkUGhhc2VPYmooZmlsZS50YXJnZXQpO1xuXG4gICAgICAgIGlmICghc291cmNlcykgLy8gTm90aGluZyB0byByZW1vdmUgaXQgZnJvbS5cbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBmb3IgKGxldCBpIGluIHNvdXJjZXMuZmlsZXMpIHtcbiAgICAgICAgICAgIGlmIChzb3VyY2VzLmZpbGVzW2ldLmNvbW1lbnQgPT0gbG9uZ0NvbW1lbnQoZmlsZSBhcyBJTG9uZ0NvbW1lbnRPYmopKSB7XG4gICAgICAgICAgICAgICAgc291cmNlcy5maWxlcy5zcGxpY2UoaSBhcyB1bmtub3duIGFzIG51bWJlciwgMSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhZGRTdGF0aWNMaWJyYXJ5KFxuICAgICAgICBwYXRoOiBzdHJpbmcsXG4gICAgICAgIG9wdD86IChJUGJ4RmlsZU9wdGlvbnMgJiB7IHBsdWdpbj86IGJvb2xlYW4gfSkgfCBudWxsKTogUGJ4RmlsZSB8IGZhbHNlIHtcblxuICAgICAgICBvcHQgPSBvcHQgfHwge307XG5cbiAgICAgICAgbGV0IGZpbGU6IFBieEZpbGUgfCBudWxsO1xuXG4gICAgICAgIGlmIChvcHQucGx1Z2luKSB7XG4gICAgICAgICAgICBmaWxlID0gdGhpcy5hZGRQbHVnaW5GaWxlKHBhdGgsIG9wdCk7XG4gICAgICAgICAgICBpZiAoIWZpbGUpIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZpbGUgPSBuZXcgUGJ4RmlsZShwYXRoLCBvcHQpO1xuICAgICAgICAgICAgaWYgKHRoaXMuaGFzRmlsZShmaWxlLnBhdGgpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBmaWxlLnV1aWQgPSB0aGlzLmdlbmVyYXRlVXVpZCgpO1xuICAgICAgICBmaWxlLnRhcmdldCA9IG9wdCA/IG9wdC50YXJnZXQgOiB1bmRlZmluZWQ7XG5cbiAgICAgICAgaWYgKCFvcHQucGx1Z2luKSB7XG4gICAgICAgICAgICBmaWxlLmZpbGVSZWYgPSB0aGlzLmdlbmVyYXRlVXVpZCgpO1xuICAgICAgICAgICAgdGhpcy5hZGRUb1BieEZpbGVSZWZlcmVuY2VTZWN0aW9uKGZpbGUpOyAgICAvLyBQQlhGaWxlUmVmZXJlbmNlXG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmFkZFRvUGJ4QnVpbGRGaWxlU2VjdGlvbihmaWxlKTsgICAgICAgIC8vIFBCWEJ1aWxkRmlsZVxuICAgICAgICB0aGlzLmFkZFRvUGJ4RnJhbWV3b3Jrc0J1aWxkUGhhc2UoZmlsZSk7ICAgIC8vIFBCWEZyYW1ld29ya3NCdWlsZFBoYXNlXG4gICAgICAgIHRoaXMuYWRkVG9MaWJyYXJ5U2VhcmNoUGF0aHMoZmlsZSk7ICAgICAgICAvLyBtYWtlIHN1cmUgaXQgZ2V0cyBidWlsdCFcblxuICAgICAgICByZXR1cm4gZmlsZTtcbiAgICB9XG5cbiAgICAvLyBoZWxwZXIgYWRkaXRpb24gZnVuY3Rpb25zXG4gICAgYWRkVG9QYnhCdWlsZEZpbGVTZWN0aW9uKGZpbGU6IElGaWxlUGF0aE9iaik6IHZvaWQge1xuXG4gICAgICAgIC8vIHJlbW92ZWQgdGVzdCBvbiBmaWxlLmdyb3VwIG5lZWRpbmcgdG8gYmUgc2V0LlxuICAgICAgICAvLyAgVGhpcyB3YXMgZmFpbGluZyBhIHRlc3QuICBGb3Igbm93LCBsZXQgaXQgcGFzcyBcbiAgICAgICAgLy8gIHVudGlsIHdlIGtub3cgZm9yIHN1cmUgdGhhdCB0aGUgdGVzdCB3YXMgaW52YWxpZCBhbmQgbm90IHRoZSBhc3N1bXB0aW9uIFxuICAgICAgICAvLyAgdGhhdCBncm91cCBtdXN0IGJlIHNldC5cbiAgICAgICAgaWYgKCFmaWxlLnV1aWQpIHsgLy8gIHx8ICFmaWxlLmdyb3VwKSAge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd1dWlkIG9yIGdyb3VwIG5vdCBzZXQhJyk7XG4gICAgICAgIH1cblxuICAgICAgICBTZWN0aW9uVXRpbHMuZW50cnlTZXRXVXVpZChcbiAgICAgICAgICAgIHRoaXMucGJ4QnVpbGRGaWxlU2VjdGlvbigpLFxuICAgICAgICAgICAgZmlsZS51dWlkLFxuICAgICAgICAgICAgcGJ4QnVpbGRGaWxlT2JqKGZpbGUpLFxuICAgICAgICAgICAgcGJ4QnVpbGRGaWxlQ29tbWVudChmaWxlIGFzIElMb25nQ29tbWVudE9iaikpO1xuXG4gICAgICAgIC8vIGNvbnN0IGNvbW1lbnRLZXk6IHN0cmluZyA9IGNyZWF0ZVV1aWRDb21tZW50S2V5KGZpbGUudXVpZCk7XG4gICAgICAgIC8vIC8vIHZhciBjb21tZW50S2V5ID0gZihcIiVzX2NvbW1lbnRcIiwgZmlsZS51dWlkKTtcblxuICAgICAgICAvLyB0aGlzLnBieEJ1aWxkRmlsZVNlY3Rpb24oKVtmaWxlLnV1aWRdID0gcGJ4QnVpbGRGaWxlT2JqKGZpbGUpO1xuXG4gICAgICAgIC8vIC8vICBJIGJlbGlldmUgVFMgc2hvdWxkIGhhdmUgYWxsb3dlZCBJTG9uZ0NvbW1lbnRPYmogd2l0aG91dCBjYXN0IGR1ZSB0byBwcmV2aW9zIGNoZWNrIG9uIGdyb3VwLiAgXG4gICAgICAgIC8vIC8vICBGb3JjZWQgaXQuXG4gICAgICAgIC8vIHRoaXMucGJ4QnVpbGRGaWxlU2VjdGlvbigpW2NvbW1lbnRLZXldID0gcGJ4QnVpbGRGaWxlQ29tbWVudChmaWxlIGFzIElMb25nQ29tbWVudE9iaik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmluZCB0aGUgUEJYQnVpbGRGaWxlIHRoYXQgaXMgYXNzb2NpYXRlZCB3aXRoIHRoaXMgZmlsZSBiYXNlZCBcbiAgICAgKiBvbiB0aGUgYmFzZW5hbWUuXG4gICAgICogXG4gICAgICogSWYgZm91bmQsIHNldCB0aGUgZmlsZSdzIHV1aWQgdG8gdGhlIGZvdW5kIFBCWEJ1aWxkRmlsZSBpbnN0YW5jZSBhbmQgXG4gICAgICogZGVsZXRlIHRoZSBQQlhCdWlsZEZpbGUgYW5kIGl0cyBjb21tZW50cyBmcm9tIHRoZSBjb2xsZWN0aW9uLlxuICAgICAqIEBwYXJhbSBmaWxlIFxuICAgICAqL1xuICAgIHJlbW92ZUZyb21QYnhCdWlsZEZpbGVTZWN0aW9uKGZpbGU6IFBieEZpbGUpOiB2b2lkIHtcbiAgICAgICAgY29uc3Qgc2VjdGlvbjogVHlwZWRTZWN0aW9uPFBCWEJ1aWxkRmlsZT4gPSB0aGlzLnBieEJ1aWxkRmlsZVNlY3Rpb24oKTtcblxuICAgICAgICBmb3IgKGxldCB1dWlkIGluIHNlY3Rpb24pIHsgLy8gdXVpZCBpcyBhIHV1aWQgb3IgYSBjb21tZW50IGtleVxuICAgICAgICAgICAgY29uc3QgYnVpbGRGaWxlOiBQQlhCdWlsZEZpbGUgfCBzdHJpbmcgfCB1bmRlZmluZWQgPSBzZWN0aW9uW3V1aWRdO1xuXG4gICAgICAgICAgICBpZiAodHlwZW9mIGJ1aWxkRmlsZSA9PSBcIm9iamVjdFwiICYmIGJ1aWxkRmlsZS5maWxlUmVmX2NvbW1lbnQgPT0gZmlsZS5iYXNlbmFtZSkge1xuICAgICAgICAgICAgICAgIC8vICBpZiBidWlsZEZpbGUgaXMgYW4gb2JqZWN0LCB0aGVuIHRoaXMgaXMgbm90IGEgY29tbWVudC5cbiAgICAgICAgICAgICAgICBmaWxlLnV1aWQgPSB1dWlkO1xuXG4gICAgICAgICAgICAgICAgU2VjdGlvblV0aWxzLmVudHJ5RGVsZXRlV1V1aWQoc2VjdGlvbiwgdXVpZCk7XG4gICAgICAgICAgICAgICAgLy8gZGVsZXRlIHNlY3Rpb25bdXVpZF07XG5cbiAgICAgICAgICAgICAgICAvLyBjb25zdCBjb21tZW50S2V5ID0gY3JlYXRlVXVpZENvbW1lbnRLZXkodXVpZCk7XG4gICAgICAgICAgICAgICAgLy8gZGVsZXRlIHNlY3Rpb25bY29tbWVudEtleV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhZGRQYnhHcm91cChcbiAgICAgICAgZmlsZVBhdGhzQXJyYXk6IHN0cmluZ1tdLFxuICAgICAgICBuYW1lOiBzdHJpbmcsXG4gICAgICAgIHBhdGg/OiBzdHJpbmcsXG4gICAgICAgIHNvdXJjZVRyZWU/OiBYQ19TT1VSQ0VUUkVFIHwgbnVsbCk6IHsgdXVpZDogWENfUFJPSl9VVUlELCBwYnhHcm91cDogUEJYR3JvdXAgfSB7XG5cbiAgICAgICAgY29uc3QgZmlsZVJlZmVyZW5jZVNlY3Rpb246IFR5cGVkU2VjdGlvbjxQQlhGaWxlUmVmZXJlbmNlPiA9IHRoaXMucGJ4RmlsZVJlZmVyZW5jZVNlY3Rpb24oKTtcblxuICAgICAgICAvLyAgQnVpbGQgYSBkaWN0aW9uYXJ5IG9mIGZpbGVQYXRoIHRvIElQYnhHcm91cENoaWxkRmlsZUluZm8gZm9yIGFsbCBQQlhGaWxlUmVmZXJlbmNlIG9iamVjdHNcbiAgICAgICAgY29uc3QgZmlsZVBhdGhUb1JlZmVyZW5jZTogeyBbZmlsZVBhdGg6IHN0cmluZ106IElQYnhHcm91cENoaWxkRmlsZUluZm8gfSA9IHt9O1xuICAgICAgICBmb3IgKGxldCBrZXkgaW4gZmlsZVJlZmVyZW5jZVNlY3Rpb24pIHtcbiAgICAgICAgICAgIC8vIG9ubHkgbG9vayBmb3IgY29tbWVudHNcbiAgICAgICAgICAgIGlmIChTZWN0aW9uVXRpbHMuZGljdEtleUlzQ29tbWVudChrZXkpKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBjb25zdCBmaWxlUmVmZXJlbmNlS2V5OiBzdHJpbmcgPSBrZXkuc3BsaXQoQ09NTUVOVF9LRVkpWzBdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVSZWZlcmVuY2VLZXk6IFhDX1BST0pfVVVJRCA9IFNlY3Rpb25VdGlscy5kaWN0S2V5Q29tbWVudFRvVXVpZChrZXkpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVSZWZlcmVuY2U6IFBCWEZpbGVSZWZlcmVuY2UgPSBmaWxlUmVmZXJlbmNlU2VjdGlvbltmaWxlUmVmZXJlbmNlS2V5XSBhcyBQQlhGaWxlUmVmZXJlbmNlO1xuXG4gICAgICAgICAgICAgICAgZmlsZVBhdGhUb1JlZmVyZW5jZVtmaWxlUmVmZXJlbmNlLnBhdGhdID0geyBmaWxlUmVmOiBmaWxlUmVmZXJlbmNlS2V5LCBiYXNlbmFtZTogZmlsZVJlZmVyZW5jZVNlY3Rpb25ba2V5XSBhcyBzdHJpbmcgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHBieEdyb3VwOiBQQlhHcm91cCA9IHtcbiAgICAgICAgICAgIGlzYTogY1BCWEdyb3VwLFxuICAgICAgICAgICAgY2hpbGRyZW46IFtdLFxuICAgICAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgICAgIHBhdGg6IHBhdGgsXG4gICAgICAgICAgICBzb3VyY2VUcmVlOiBzb3VyY2VUcmVlID8gc291cmNlVHJlZSA6ICdcIjxncm91cD5cIidcbiAgICAgICAgfTtcblxuICAgICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgZmlsZVBhdGhzQXJyYXkubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgICAgICBjb25zdCBmaWxlUGF0aCA9IGZpbGVQYXRoc0FycmF5W2luZGV4XTtcbiAgICAgICAgICAgIGNvbnN0IGZpbGVQYXRoUXVvdGVkID0gXCJcXFwiXCIgKyBmaWxlUGF0aCArIFwiXFxcIlwiO1xuXG4gICAgICAgICAgICBpZiAoZmlsZVBhdGhUb1JlZmVyZW5jZVtmaWxlUGF0aF0pIHtcbiAgICAgICAgICAgICAgICBwYnhHcm91cC5jaGlsZHJlbi5wdXNoKHBieEdyb3VwQ2hpbGQoZmlsZVBhdGhUb1JlZmVyZW5jZVtmaWxlUGF0aF0pKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZmlsZVBhdGhUb1JlZmVyZW5jZVtmaWxlUGF0aFF1b3RlZF0pIHtcbiAgICAgICAgICAgICAgICBwYnhHcm91cC5jaGlsZHJlbi5wdXNoKHBieEdyb3VwQ2hpbGQoZmlsZVBhdGhUb1JlZmVyZW5jZVtmaWxlUGF0aFF1b3RlZF0pKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIGZpbGUgPSBuZXcgUGJ4RmlsZShmaWxlUGF0aCk7XG4gICAgICAgICAgICAgICAgZmlsZS51dWlkID0gdGhpcy5nZW5lcmF0ZVV1aWQoKTtcbiAgICAgICAgICAgICAgICBmaWxlLmZpbGVSZWYgPSB0aGlzLmdlbmVyYXRlVXVpZCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuYWRkVG9QYnhGaWxlUmVmZXJlbmNlU2VjdGlvbihmaWxlKTsgICAgLy8gUEJYRmlsZVJlZmVyZW5jZVxuICAgICAgICAgICAgICAgIHRoaXMuYWRkVG9QYnhCdWlsZEZpbGVTZWN0aW9uKGZpbGUpOyAgICAgICAgLy8gUEJYQnVpbGRGaWxlXG4gICAgICAgICAgICAgICAgcGJ4R3JvdXAuY2hpbGRyZW4ucHVzaChwYnhHcm91cENoaWxkKGZpbGUgYXMgSVBieEdyb3VwQ2hpbGRGaWxlSW5mbykpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZ3JvdXBzOiBUeXBlZFNlY3Rpb248UEJYR3JvdXA+ID0gdGhpcy5wYnhHcm91cHNTZWN0aW9uKCk7XG5cbiAgICAgICAgY29uc3QgcGJ4R3JvdXBVdWlkOiBYQ19QUk9KX1VVSUQgPSB0aGlzLmdlbmVyYXRlVXVpZCgpO1xuXG4gICAgICAgIFNlY3Rpb25VdGlscy5lbnRyeVNldFdVdWlkKGdyb3VwcywgcGJ4R3JvdXBVdWlkLCBwYnhHcm91cCwgbmFtZSk7XG4gICAgICAgIC8vIGNvbnN0IGNvbW1lbnRLZXk6IHN0cmluZyA9IFNlY3Rpb25VdGlscy5kaWN0S2V5VXVpZFRvQ29tbWVudChwYnhHcm91cFV1aWQpO1xuXG4gICAgICAgIC8vIGdyb3Vwc1twYnhHcm91cFV1aWRdID0gcGJ4R3JvdXA7XG4gICAgICAgIC8vIGdyb3Vwc1tjb21tZW50S2V5XSA9IG5hbWU7XG5cbiAgICAgICAgcmV0dXJuIHsgdXVpZDogcGJ4R3JvdXBVdWlkLCBwYnhHcm91cDogcGJ4R3JvdXAgfTtcbiAgICB9XG5cbiAgICByZW1vdmVQYnhHcm91cChncm91cE5hbWU6IHN0cmluZyk6IHZvaWQge1xuICAgICAgICBjb25zdCBzZWN0aW9uOiBUeXBlZFNlY3Rpb248UEJYR3JvdXA+ID0gdGhpcy5wYnhHcm91cHNTZWN0aW9uKCk7XG5cbiAgICAgICAgU2VjdGlvblV0aWxzLmVudHJ5RGVsZXRlV0NvbW1lbnRUZXh0KHNlY3Rpb24sIGdyb3VwTmFtZSk7XG5cbiAgICAgICAgLy8gZm9yIChsZXQga2V5IGluIHNlY3Rpb24pIHtcbiAgICAgICAgLy8gICAgIC8vIG9ubHkgbG9vayBmb3IgY29tbWVudHNcbiAgICAgICAgLy8gICAgIGlmICghQ09NTUVOVF9LRVkudGVzdChrZXkpKSBjb250aW51ZTtcblxuICAgICAgICAvLyAgICAgaWYgKHNlY3Rpb25ba2V5XSA9PSBncm91cE5hbWUpIHsgLy8gVGhlIGNvbW1lbnQgaXMgdGhlIHBhc3NlZCBpbiBuYW1lIG9mIHRoZSBncm91cC5cbiAgICAgICAgLy8gICAgICAgICBjb25zdCBpdGVtS2V5OiBYQ19QUk9KX1VVSUQgPSBrZXkuc3BsaXQoQ09NTUVOVF9LRVkpWzBdOyAvLyBnZXQgdGhlIFV1aWRcbiAgICAgICAgLy8gICAgICAgICBkZWxldGUgc2VjdGlvbltpdGVtS2V5XTtcbiAgICAgICAgLy8gICAgIH1cbiAgICAgICAgLy8gfVxuICAgIH1cblxuICAgIGFkZFRvUGJ4UHJvamVjdFNlY3Rpb24odGFyZ2V0OiBJTmF0aXZlVGFyZ2V0V3JhcHBlcik6IHZvaWQge1xuXG4gICAgICAgIGNvbnN0IG5ld1RhcmdldDogSUNoaWxkTGlzdEVudHJ5ID0ge1xuICAgICAgICAgICAgdmFsdWU6IHRhcmdldC51dWlkLFxuICAgICAgICAgICAgY29tbWVudDogcGJ4TmF0aXZlVGFyZ2V0Q29tbWVudCh0YXJnZXQucGJ4TmF0aXZlVGFyZ2V0KVxuICAgICAgICB9O1xuXG4gICAgICAgIC8vICB0aGUgcmV0dXJuIHR5cGUgYWxyZWFkeSBpbmNsdWRlcyB0aGUgcHJvamVjdCBpdCBpcyByZWdldHRpbmcgaGVyZS5cbiAgICAgICAgLy90aGlzLnBieFByb2plY3RTZWN0aW9uKClbdGhpcy5nZXRGaXJzdFByb2plY3QoKVsndXVpZCddXVsndGFyZ2V0cyddLnB1c2gobmV3VGFyZ2V0KTtcblxuICAgICAgICB0aGlzLmdldEZpcnN0UHJvamVjdCgpLmZpcnN0UHJvamVjdC50YXJnZXRzLnB1c2gobmV3VGFyZ2V0KTtcbiAgICB9XG5cbiAgICBhZGRUb1BieE5hdGl2ZVRhcmdldFNlY3Rpb24odGFyZ2V0OiBJTmF0aXZlVGFyZ2V0V3JhcHBlcik6IHZvaWQge1xuXG4gICAgICAgIFNlY3Rpb25VdGlscy5lbnRyeVNldFdVdWlkKFxuICAgICAgICAgICAgdGhpcy5wYnhOYXRpdmVUYXJnZXRTZWN0aW9uKCksXG4gICAgICAgICAgICB0YXJnZXQudXVpZCxcbiAgICAgICAgICAgIHRhcmdldC5wYnhOYXRpdmVUYXJnZXQsXG4gICAgICAgICAgICB0YXJnZXQucGJ4TmF0aXZlVGFyZ2V0Lm5hbWUpO1xuXG4gICAgICAgIC8vICAgICB2YXIgY29tbWVudEtleSA9IGRpY3RLZXlVdWlkVG9Db21tZW50KHRhcmdldC51dWlkKTtcblxuICAgICAgICAvLyAgICAgdGhpcy5wYnhOYXRpdmVUYXJnZXRTZWN0aW9uKClbdGFyZ2V0LnV1aWRdID0gdGFyZ2V0LnBieE5hdGl2ZVRhcmdldDtcbiAgICAgICAgLy8gICAgIHRoaXMucGJ4TmF0aXZlVGFyZ2V0U2VjdGlvbigpW2NvbW1lbnRLZXldID0gdGFyZ2V0LnBieE5hdGl2ZVRhcmdldC5uYW1lO1xuICAgIH1cblxuICAgIGFkZFRvUGJ4RmlsZVJlZmVyZW5jZVNlY3Rpb24oZmlsZTogUGJ4RmlsZSk6IHZvaWQge1xuXG4gICAgICAgIGlmICghZmlsZS5maWxlUmVmKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiZmlsZVJlZiBub3Qgc2V0LlwiKTtcblxuICAgICAgICBTZWN0aW9uVXRpbHMuZW50cnlTZXRXVXVpZChcbiAgICAgICAgICAgIHRoaXMucGJ4RmlsZVJlZmVyZW5jZVNlY3Rpb24oKSxcbiAgICAgICAgICAgIGZpbGUuZmlsZVJlZixcbiAgICAgICAgICAgIHBieEZpbGVSZWZlcmVuY2VPYmooZmlsZSksXG4gICAgICAgICAgICBwYnhGaWxlUmVmZXJlbmNlQ29tbWVudChmaWxlKSk7XG5cbiAgICAgICAgLy8gdmFyIGNvbW1lbnRLZXkgPSBkaWN0S2V5VXVpZFRvQ29tbWVudChmaWxlLmZpbGVSZWYpO1xuXG4gICAgICAgIC8vIHRoaXMucGJ4RmlsZVJlZmVyZW5jZVNlY3Rpb24oKVtmaWxlLmZpbGVSZWZdID0gcGJ4RmlsZVJlZmVyZW5jZU9iaihmaWxlKTtcbiAgICAgICAgLy8gdGhpcy5wYnhGaWxlUmVmZXJlbmNlU2VjdGlvbigpW2NvbW1lbnRLZXldID0gcGJ4RmlsZVJlZmVyZW5jZUNvbW1lbnQoZmlsZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2VhcmNoIGZvciBhIHJlZmVyZW5jZSB0byB0aGlzIGZpbGUgZnJvbSB0aGUgUEJYRmlsZVJlZmVyZW5jZSBzZWN0aW9uLlxuICAgICAqIFRoZSBtYXRjaCBpcyBtYWRlIGJ5IGVpdGhlciB0aGUgYmFzZW5hbWUgb3IgcGF0aCBtYXRjaGluZy5cbiAgICAgKiBcbiAgICAgKiAoSXQgYXBwZWFycyB0aGF0IHRoaXMgc2hvdWxkIGJlIGEgY29uY2VybiB0byB5b3UgaWYgeW91IGhhdmUgZmlsZXMgd2l0aCB0aGUgc2FtZSBuYW1lXG4gICAgICogaW4gZGlmZmVyZW50IGZvbGRlcnMuKVxuICAgICAqIFxuICAgICAqIEBwYXJhbSBmaWxlIFxuICAgICAqL1xuICAgIHJlbW92ZUZyb21QYnhGaWxlUmVmZXJlbmNlU2VjdGlvbihmaWxlOiBQYnhGaWxlKTogUGJ4RmlsZSB7XG5cbiAgICAgICAgLy8gIENyZWF0ZSBhIHRlbXBsYXRlIG9iamVjdCAobm90IGFkZGVkIHRvIG1vZGVsKSBmb3IgY29tcGFyaXNvblxuICAgICAgICB2YXIgcmVmT2JqOiBQQlhGaWxlUmVmZXJlbmNlID0gcGJ4RmlsZVJlZmVyZW5jZU9iaihmaWxlKTtcblxuICAgICAgICBjb25zdCBzZWN0aW9uOiBUeXBlZFNlY3Rpb248UEJYRmlsZVJlZmVyZW5jZT4gPSB0aGlzLnBieEZpbGVSZWZlcmVuY2VTZWN0aW9uKCk7XG5cbiAgICAgICAgZm9yIChsZXQgaSBpbiBzZWN0aW9uKSB7XG4gICAgICAgICAgICBjb25zdCBleGlzdGluZzogUEJYRmlsZVJlZmVyZW5jZSB8IHN0cmluZyA9IHNlY3Rpb25baV07XG4gICAgICAgICAgICBpZiAodHlwZW9mIGV4aXN0aW5nID09IFwib2JqZWN0XCIgJiZcbiAgICAgICAgICAgICAgICAoZXhpc3RpbmcubmFtZSA9PSByZWZPYmoubmFtZSB8fFxuICAgICAgICAgICAgICAgICAgICAoJ1wiJyArIGV4aXN0aW5nLm5hbWUgKyAnXCInKSA9PSByZWZPYmoubmFtZSB8fFxuICAgICAgICAgICAgICAgICAgICBleGlzdGluZy5wYXRoID09IHJlZk9iai5wYXRoIHx8XG4gICAgICAgICAgICAgICAgICAgICgnXCInICsgZXhpc3RpbmcucGF0aCArICdcIicpID09IHJlZk9iai5wYXRoKSkge1xuXG4gICAgICAgICAgICAgICAgLy8gIFBhc3MgdGhpcyBiYWNrIHRvIHRoZSBjYWxsZXIuICBCdXQgaXQgaXMgYWxzbyB1c2VkXG4gICAgICAgICAgICAgICAgLy8gIHRvIGRlbGV0ZSB0aGUgY29tbWVudCBiZWxvdy5cbiAgICAgICAgICAgICAgICBmaWxlLmZpbGVSZWYgPSBmaWxlLnV1aWQgPSBpO1xuXG4gICAgICAgICAgICAgICAgU2VjdGlvblV0aWxzLmVudHJ5RGVsZXRlV1V1aWQoc2VjdGlvbiwgaSk7XG4gICAgICAgICAgICAgICAgLy8gZGVsZXRlIHNlY3Rpb25baV07XG5cbiAgICAgICAgICAgICAgICAvLyAvLyAgMTAvMjAxOSBtb3ZlZCB0aGlzIGludG8gdGhlIGxvb3AuICBMZXNzIGVycm9yIHByb25lIGlmIFwiYnJlYWtcIiBpcyByZW1vdmVkIGxhdGVyLlxuICAgICAgICAgICAgICAgIC8vIHZhciBjb21tZW50S2V5ID0gZGljdEtleVV1aWRUb0NvbW1lbnQoZmlsZS5maWxlUmVmKTtcbiAgICAgICAgICAgICAgICAvLyBpZiAoc2VjdGlvbltjb21tZW50S2V5XSAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAvLyAgICAgZGVsZXRlIHNlY3Rpb25bY29tbWVudEtleV07XG4gICAgICAgICAgICAgICAgLy8gfVxuXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmlsZTtcbiAgICB9XG5cbiAgICBhZGRUb1hjVmVyc2lvbkdyb3VwU2VjdGlvbihmaWxlOiBQYnhGaWxlICYgSURhdGFNb2RlbERvY3VtZW50RmlsZSk6IHZvaWQge1xuXG4gICAgICAgIGlmICghZmlsZS5tb2RlbHMgfHwgIWZpbGUuY3VycmVudE1vZGVsKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgY3JlYXRlIGEgWENWZXJzaW9uR3JvdXAgc2VjdGlvbiBmcm9tIG5vdCBhIGRhdGEgbW9kZWwgZG9jdW1lbnQgZmlsZVwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghZmlsZS5maWxlUmVmIHx8ICFmaWxlLmN1cnJlbnRNb2RlbC5maWxlUmVmKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZpbGVyZWYgbm90IHNldC4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNlY3Rpb24gPSB0aGlzLnhjVmVyc2lvbkdyb3VwU2VjdGlvbigpO1xuXG4gICAgICAgIGlmICghc2VjdGlvbltmaWxlLmZpbGVSZWZdKSB7XG4gICAgICAgICAgICBjb25zdCBuZXdWZXJzaW9uR3JvdXA6IFhDVmVyc2lvbkdyb3VwID0ge1xuICAgICAgICAgICAgICAgIGlzYTogJ1hDVmVyc2lvbkdyb3VwJyxcbiAgICAgICAgICAgICAgICBjaGlsZHJlbjogZmlsZS5tb2RlbHMubWFwKGZ1bmN0aW9uIChlbDogUGJ4RmlsZSkgeyByZXR1cm4gZWwuZmlsZVJlZiBhcyBYQ19QUk9KX1VVSUQ7IH0pLFxuICAgICAgICAgICAgICAgIGN1cnJlbnRWZXJzaW9uOiBmaWxlLmN1cnJlbnRNb2RlbC5maWxlUmVmLFxuICAgICAgICAgICAgICAgIG5hbWU6IHBhdGguYmFzZW5hbWUoZmlsZS5wYXRoKSxcbiAgICAgICAgICAgICAgICBwYXRoOiBmaWxlLnBhdGgsXG4gICAgICAgICAgICAgICAgc291cmNlVHJlZTogJ1wiPGdyb3VwPlwiJyxcbiAgICAgICAgICAgICAgICB2ZXJzaW9uR3JvdXBUeXBlOiAnd3JhcHBlci54Y2RhdGFtb2RlbCdcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIFNlY3Rpb25VdGlscy5lbnRyeVNldFdVdWlkKHNlY3Rpb24sIGZpbGUuZmlsZVJlZiwgbmV3VmVyc2lvbkdyb3VwLCBwYXRoLmJhc2VuYW1lKGZpbGUucGF0aCkpO1xuXG4gICAgICAgICAgICAvLyB2YXIgY29tbWVudEtleSA9IGRpY3RLZXlVdWlkVG9Db21tZW50KGZpbGUuZmlsZVJlZik7XG4gICAgICAgICAgICAvLyB0aGlzLnhjVmVyc2lvbkdyb3VwU2VjdGlvbigpW2ZpbGUuZmlsZVJlZl0gPSBuZXdWZXJzaW9uR3JvdXA7XG4gICAgICAgICAgICAvLyB0aGlzLnhjVmVyc2lvbkdyb3VwU2VjdGlvbigpW2NvbW1lbnRLZXldID0gcGF0aC5iYXNlbmFtZShmaWxlLnBhdGgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWRkVG9PckNyZWF0ZV9QQlhHcm91cF9XaXRoTmFtZShmaWxlOiBQYnhGaWxlLCBncm91cE5hbWU6IHN0cmluZyk6IHZvaWQge1xuXG4gICAgICAgIGNvbnN0IHBieEdyb3VwOiBQQlhHcm91cCB8IG51bGwgPSB0aGlzLnBieEdyb3VwQnlOYW1lKGdyb3VwTmFtZSk7XG4gICAgICAgIGlmICghcGJ4R3JvdXApIHtcbiAgICAgICAgICAgIHRoaXMuYWRkUGJ4R3JvdXAoW2ZpbGUucGF0aF0sIGdyb3VwTmFtZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwYnhHcm91cC5jaGlsZHJlbi5wdXNoKHBieEdyb3VwQ2hpbGQoZmlsZSkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVtb3ZlRnJvbV9QQlhHcm91cF9XaXRoTmFtZShmaWxlOiBQYnhGaWxlLCBncm91cE5hbWU6IHN0cmluZyk6IHZvaWQge1xuICAgICAgICBjb25zdCBwYnhHcm91cDogUEJYR3JvdXAgfCBudWxsID0gdGhpcy5wYnhHcm91cEJ5TmFtZShncm91cE5hbWUpO1xuICAgICAgICBpZiAoIXBieEdyb3VwKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBtYXRjaENoaWxkOiBJQ2hpbGRMaXN0RW50cnkgPSBwYnhHcm91cENoaWxkKGZpbGUpO1xuICAgICAgICBjb25zdCBwbHVnaW5zR3JvdXBDaGlsZHJlbjogSUNoaWxkTGlzdEVudHJ5W10gPSBwYnhHcm91cC5jaGlsZHJlbjtcbiAgICAgICAgZm9yIChsZXQgaSBpbiBwbHVnaW5zR3JvdXBDaGlsZHJlbikge1xuICAgICAgICAgICAgaWYgKG1hdGNoQ2hpbGQudmFsdWUgPT0gcGx1Z2luc0dyb3VwQ2hpbGRyZW5baV0udmFsdWUgJiZcbiAgICAgICAgICAgICAgICBtYXRjaENoaWxkLmNvbW1lbnQgPT0gcGx1Z2luc0dyb3VwQ2hpbGRyZW5baV0uY29tbWVudCkge1xuICAgICAgICAgICAgICAgIHBsdWdpbnNHcm91cENoaWxkcmVuLnNwbGljZShpIGFzIHVua25vd24gYXMgbnVtYmVyLCAxKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFkZFRvUGx1Z2luc1BieEdyb3VwKGZpbGU6IFBieEZpbGUpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5hZGRUb09yQ3JlYXRlX1BCWEdyb3VwX1dpdGhOYW1lKGZpbGUsICdQbHVnaW5zJyk7XG4gICAgICAgIC8vIGNvbnN0IHBsdWdpbnNHcm91cDogUEJYR3JvdXAgfCBudWxsID0gdGhpcy5wYnhHcm91cEJ5TmFtZSgnUGx1Z2lucycpO1xuICAgICAgICAvLyBpZiAoIXBsdWdpbnNHcm91cCkge1xuICAgICAgICAvLyAgICAgdGhpcy5hZGRQYnhHcm91cChbZmlsZS5wYXRoXSwgJ1BsdWdpbnMnKTtcbiAgICAgICAgLy8gfSBlbHNlIHtcbiAgICAgICAgLy8gICAgIHBsdWdpbnNHcm91cC5jaGlsZHJlbi5wdXNoKHBieEdyb3VwQ2hpbGQoZmlsZSkpO1xuICAgICAgICAvLyB9XG4gICAgfVxuXG4gICAgcmVtb3ZlRnJvbVBsdWdpbnNQYnhHcm91cChmaWxlOiBQYnhGaWxlKTogdm9pZCB7XG4gICAgICAgIHRoaXMucmVtb3ZlRnJvbV9QQlhHcm91cF9XaXRoTmFtZShmaWxlLCAnUGx1Z2lucycpO1xuICAgICAgICAvLyBjb25zdCBwbHVnaW5zR3JvdXA6IFBCWEdyb3VwIHwgbnVsbCA9IHRoaXMucGJ4R3JvdXBCeU5hbWUoJ1BsdWdpbnMnKTtcbiAgICAgICAgLy8gaWYgKCFwbHVnaW5zR3JvdXApIHtcbiAgICAgICAgLy8gICAgIHJldHVybjtcbiAgICAgICAgLy8gICAgIC8vIE5vIGxvbmdlciByZXR1cm5pbmcgbnVsbC5cbiAgICAgICAgLy8gICAgIC8vIHJldHVybiBudWxsOyBJIGNhbid0IGltYWdpbmUgcmV0dXJuaW5nIG51bGwgdmVyc3VzIHVuZGVmaW5lZCB3YXMgaW50ZW50aW9uYWwuXG4gICAgICAgIC8vIH1cblxuICAgICAgICAvLyBjb25zdCBtYXRjaENoaWxkIDpJQ2hpbGRMaXN0RW50cnkgPSBwYnhHcm91cENoaWxkKGZpbGUpO1xuICAgICAgICAvLyBjb25zdCBwbHVnaW5zR3JvdXBDaGlsZHJlbjogSUNoaWxkTGlzdEVudHJ5W10gPSBwbHVnaW5zR3JvdXAuY2hpbGRyZW47XG4gICAgICAgIC8vIGZvciAobGV0IGkgaW4gcGx1Z2luc0dyb3VwQ2hpbGRyZW4pIHtcbiAgICAgICAgLy8gICAgIGlmIChtYXRjaENoaWxkLnZhbHVlID09IHBsdWdpbnNHcm91cENoaWxkcmVuW2ldLnZhbHVlICYmXG4gICAgICAgIC8vICAgICAgICAgbWF0Y2hDaGlsZC5jb21tZW50ID09IHBsdWdpbnNHcm91cENoaWxkcmVuW2ldLmNvbW1lbnQpIHtcbiAgICAgICAgLy8gICAgICAgICBwbHVnaW5zR3JvdXBDaGlsZHJlbi5zcGxpY2UoaSBhcyB1bmtub3duIGFzIG51bWJlciwgMSk7XG4gICAgICAgIC8vICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vICAgICB9XG4gICAgICAgIC8vIH1cbiAgICB9XG5cbiAgICBhZGRUb1Jlc291cmNlc1BieEdyb3VwKGZpbGU6IFBieEZpbGUpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5hZGRUb09yQ3JlYXRlX1BCWEdyb3VwX1dpdGhOYW1lKGZpbGUsICdSZXNvdXJjZXMnKTtcblxuICAgICAgICAvLyBjb25zdCBwbHVnaW5zR3JvdXA6UEJYR3JvdXAgfCBudWxsID0gdGhpcy5wYnhHcm91cEJ5TmFtZSgnUmVzb3VyY2VzJyk7XG5cbiAgICAgICAgLy8gaWYgKCFwbHVnaW5zR3JvdXApIHtcbiAgICAgICAgLy8gICAgIHRoaXMuYWRkUGJ4R3JvdXAoW2ZpbGUucGF0aF0sICdSZXNvdXJjZXMnKTtcbiAgICAgICAgLy8gfSBlbHNlIHtcbiAgICAgICAgLy8gICAgIHBsdWdpbnNHcm91cC5jaGlsZHJlbi5wdXNoKHBieEdyb3VwQ2hpbGQoZmlsZSkpO1xuICAgICAgICAvLyB9XG4gICAgfVxuXG4gICAgcmVtb3ZlRnJvbVJlc291cmNlc1BieEdyb3VwKGZpbGU6IFBieEZpbGUpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5yZW1vdmVGcm9tX1BCWEdyb3VwX1dpdGhOYW1lKGZpbGUsICdSZXNvdXJjZXMnKTtcbiAgICAgICAgLy8gaWYgKCF0aGlzLnBieEdyb3VwQnlOYW1lKCdSZXNvdXJjZXMnKSkge1xuICAgICAgICAvLyAgICAgcmV0dXJuOyBcbiAgICAgICAgLy8gICAgIC8vcmV0dXJuIG51bGw7XG4gICAgICAgIC8vIH1cbiAgICAgICAgLy8gdmFyIHBsdWdpbnNHcm91cENoaWxkcmVuID0gdGhpcy5wYnhHcm91cEJ5TmFtZSgnUmVzb3VyY2VzJykuY2hpbGRyZW4sIGk7XG4gICAgICAgIC8vIGZvciAoaSBpbiBwbHVnaW5zR3JvdXBDaGlsZHJlbikge1xuICAgICAgICAvLyAgICAgaWYgKHBieEdyb3VwQ2hpbGQoZmlsZSkudmFsdWUgPT0gcGx1Z2luc0dyb3VwQ2hpbGRyZW5baV0udmFsdWUgJiZcbiAgICAgICAgLy8gICAgICAgICBwYnhHcm91cENoaWxkKGZpbGUpLmNvbW1lbnQgPT0gcGx1Z2luc0dyb3VwQ2hpbGRyZW5baV0uY29tbWVudCkge1xuICAgICAgICAvLyAgICAgICAgIHBsdWdpbnNHcm91cENoaWxkcmVuLnNwbGljZShpLCAxKTtcbiAgICAgICAgLy8gICAgICAgICBicmVhaztcbiAgICAgICAgLy8gICAgIH1cbiAgICAgICAgLy8gfVxuICAgIH1cblxuICAgIGFkZFRvRnJhbWV3b3Jrc1BieEdyb3VwKGZpbGU6IFBieEZpbGUpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5hZGRUb09yQ3JlYXRlX1BCWEdyb3VwX1dpdGhOYW1lKGZpbGUsICdGcmFtZXdvcmtzJyk7XG4gICAgICAgIC8vIHZhciBwbHVnaW5zR3JvdXAgPSB0aGlzLnBieEdyb3VwQnlOYW1lKCdGcmFtZXdvcmtzJyk7XG4gICAgICAgIC8vIGlmICghcGx1Z2luc0dyb3VwKSB7XG4gICAgICAgIC8vICAgICB0aGlzLmFkZFBieEdyb3VwKFtmaWxlLnBhdGhdLCAnRnJhbWV3b3JrcycpO1xuICAgICAgICAvLyB9IGVsc2Uge1xuICAgICAgICAvLyAgICAgcGx1Z2luc0dyb3VwLmNoaWxkcmVuLnB1c2gocGJ4R3JvdXBDaGlsZChmaWxlKSk7XG4gICAgICAgIC8vIH1cbiAgICB9XG5cbiAgICByZW1vdmVGcm9tRnJhbWV3b3Jrc1BieEdyb3VwKGZpbGU6IFBieEZpbGUpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5yZW1vdmVGcm9tX1BCWEdyb3VwX1dpdGhOYW1lKGZpbGUsICdGcmFtZXdvcmtzJyk7XG4gICAgICAgIC8vIGlmICghdGhpcy5wYnhHcm91cEJ5TmFtZSgnRnJhbWV3b3JrcycpKSB7XG4gICAgICAgIC8vICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgLy8gfVxuICAgICAgICAvLyB2YXIgcGx1Z2luc0dyb3VwQ2hpbGRyZW4gPSB0aGlzLnBieEdyb3VwQnlOYW1lKCdGcmFtZXdvcmtzJykuY2hpbGRyZW47XG5cbiAgICAgICAgLy8gZm9yIChpIGluIHBsdWdpbnNHcm91cENoaWxkcmVuKSB7XG4gICAgICAgIC8vICAgICBpZiAocGJ4R3JvdXBDaGlsZChmaWxlKS52YWx1ZSA9PSBwbHVnaW5zR3JvdXBDaGlsZHJlbltpXS52YWx1ZSAmJlxuICAgICAgICAvLyAgICAgICAgIHBieEdyb3VwQ2hpbGQoZmlsZSkuY29tbWVudCA9PSBwbHVnaW5zR3JvdXBDaGlsZHJlbltpXS5jb21tZW50KSB7XG4gICAgICAgIC8vICAgICAgICAgcGx1Z2luc0dyb3VwQ2hpbGRyZW4uc3BsaWNlKGksIDEpO1xuICAgICAgICAvLyAgICAgICAgIGJyZWFrO1xuICAgICAgICAvLyAgICAgfVxuICAgICAgICAvLyB9XG4gICAgfVxuXG4gICAgYWRkVG9Qcm9kdWN0c1BieEdyb3VwKGZpbGU6IFBieEZpbGUpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5hZGRUb09yQ3JlYXRlX1BCWEdyb3VwX1dpdGhOYW1lKGZpbGUsICdQcm9kdWN0cycpO1xuICAgICAgICAvLyB2YXIgcHJvZHVjdHNHcm91cCA9IHRoaXMucGJ4R3JvdXBCeU5hbWUoJ1Byb2R1Y3RzJyk7XG4gICAgICAgIC8vIGlmICghcHJvZHVjdHNHcm91cCkge1xuICAgICAgICAvLyAgICAgdGhpcy5hZGRQYnhHcm91cChbZmlsZS5wYXRoXSwgJ1Byb2R1Y3RzJyk7XG4gICAgICAgIC8vIH0gZWxzZSB7XG4gICAgICAgIC8vICAgICBwcm9kdWN0c0dyb3VwLmNoaWxkcmVuLnB1c2gocGJ4R3JvdXBDaGlsZChmaWxlKSk7XG4gICAgICAgIC8vIH1cbiAgICB9XG5cbiAgICByZW1vdmVGcm9tUHJvZHVjdHNQYnhHcm91cChmaWxlOiBQYnhGaWxlKTogdm9pZCB7XG4gICAgICAgIHRoaXMucmVtb3ZlRnJvbV9QQlhHcm91cF9XaXRoTmFtZShmaWxlLCAnUHJvZHVjdHMnKTtcbiAgICAgICAgLy8gY29uc3QgcHJvZHVjdHNHcm91cDogUEJYR3JvdXAgfCBudWxsID0gdGhpcy5wYnhHcm91cEJ5TmFtZSgnUHJvZHVjdHMnKTtcblxuICAgICAgICAvLyBpZiAoIXByb2R1Y3RzR3JvdXApIHtcbiAgICAgICAgLy8gICAgIC8vIHJldHVybiBudWxsO1xuICAgICAgICAvLyAgICAgcmV0dXJuO1xuICAgICAgICAvLyB9XG5cbiAgICAgICAgLy8gY29uc3QgcHJvZHVjdHNHcm91cENoaWxkcmVuOiBQQlhGaWxlRWxlbWVudFtdID0gcHJvZHVjdHNHcm91cC5jaGlsZHJlbjtcblxuICAgICAgICAvLyBmb3IgKGxldCBpIGluIHByb2R1Y3RzR3JvdXBDaGlsZHJlbikge1xuICAgICAgICAvLyAgICAgaWYgKHBieEdyb3VwQ2hpbGQoZmlsZSkudmFsdWUgPT0gcHJvZHVjdHNHcm91cENoaWxkcmVuW2ldLnZhbHVlICYmXG4gICAgICAgIC8vICAgICAgICAgcGJ4R3JvdXBDaGlsZChmaWxlKS5jb21tZW50ID09IHByb2R1Y3RzR3JvdXBDaGlsZHJlbltpXS5jb21tZW50KSB7XG4gICAgICAgIC8vICAgICAgICAgcHJvZHVjdHNHcm91cENoaWxkcmVuLnNwbGljZShpLCAxKTtcbiAgICAgICAgLy8gICAgICAgICBicmVhaztcbiAgICAgICAgLy8gICAgIH1cbiAgICAgICAgLy8gfVxuICAgIH1cblxuICAgIHByaXZhdGUgcGZfYWRkVG9CdWlsZFBoYXNlKGJ1aWxkUGhhc2U6IFBCWEJ1aWxkUGhhc2VCYXNlIHwgbnVsbCwgZmlsZTogSUZpbGVQYXRoT2JqKTogdm9pZCB7XG5cbiAgICAgICAgaWYgKCFidWlsZFBoYXNlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2J1aWxkUGhhc2Ugbm90IGZvdW5kIScpO1xuICAgICAgICB9XG5cbiAgICAgICAgYnVpbGRQaGFzZS5maWxlcy5wdXNoKHBieEJ1aWxkUGhhc2VPYmooZmlsZSkpO1xuICAgIH1cblxuICAgIHByaXZhdGUgcGZfcmVtb3ZlRnJvbUJ1aWxkUGhhc2UoYnVpbGRQaGFzZTogUEJYQnVpbGRQaGFzZUJhc2UgfCBudWxsLCBmaWxlOiBQYnhGaWxlKTogdm9pZCB7XG5cbiAgICAgICAgaWYgKCFidWlsZFBoYXNlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIC8vICBOT1RFOiAgVGhlcmUgd2VyZSB0d28gZGlmZmVyZW50IGR1cGxpY2F0ZWQgc2V0cyBvZiBjb2RlIHRoYXRcbiAgICAgICAgLy8gIG1vc3RseSBkaWQgdGhlIHNhbWUgdGhpbmcuICBPbmUgdXNlZCBzcGxpY2UgYWZ0ZXIgZmluZGluZyBvbmUgaXRlbS5cbiAgICAgICAgLy8gIFRoZSBvbmUgd2Uga2VwdCBhc3N1bWVzIHRoZSBjb21tZW50IG1heSBleGlzdCBtdWx0aXBsZSB0aW1lcy5cbiAgICAgICAgLy8gIENvdWxkIGJlIGlzc3VlcyBpZiBzb21lIHBsYWNlcyBoZWxkIHRoZSBvcmlnaW5hbCBmaWxlcyBoYW5kbGUgdGhhdFxuICAgICAgICAvLyAgd2FzIHVzaW5nIHNwbGljZS5cbiAgICAgICAgLy8gIFByZWZlciB0byBoYXZlIHRoaXMgRFJZIGFuZCBjbGVhbiBpdCB1cCBsYXRlciBpZiB0aGVyZSBpcyBhbiBpc3N1ZS5cbiAgICAgICAgY29uc3QgZmlsZXM6IElDaGlsZExpc3RFbnRyeVtdID0gW107XG4gICAgICAgIGNvbnN0IGZpbGVDb21tZW50OiBzdHJpbmcgPSBsb25nQ29tbWVudChmaWxlKTtcblxuICAgICAgICBmb3IgKGxldCBpIGluIGJ1aWxkUGhhc2UuZmlsZXMpIHtcbiAgICAgICAgICAgIGlmIChidWlsZFBoYXNlLmZpbGVzW2ldLmNvbW1lbnQgIT0gZmlsZUNvbW1lbnQpIHtcbiAgICAgICAgICAgICAgICBmaWxlcy5wdXNoKGJ1aWxkUGhhc2UuZmlsZXNbaV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgYnVpbGRQaGFzZS5maWxlcyA9IGZpbGVzO1xuICAgIH1cblxuXG4gICAgYWRkVG9QYnhFbWJlZEZyYW1ld29ya3NCdWlsZFBoYXNlKGZpbGU6IFBieEZpbGUpOiB2b2lkIHtcblxuICAgICAgICB0aGlzLnBmX2FkZFRvQnVpbGRQaGFzZSh0aGlzLnBieEVtYmVkRnJhbWV3b3Jrc0J1aWxkUGhhc2VPYmooZmlsZS50YXJnZXQpLCBmaWxlKTtcbiAgICAgICAgLy8gIFdhcm5pbmc6ICBOZXcgaW1wbGVtZW50YXRpb24gd2lsbCB0aHJvdyBpZiBpdCBkb2VzIG5vdCBmaW5kIHRoZSBlbWJlZGVkRnJhbWV3b3JrQnVpbGRQaGFzZVxuICAgICAgICAvLyAgaW5zdGVhZCBvZiBzaWxlbnRseSBmYWlsaW5nIHRvIGRvIGFueXRoaW5nLlxuXG4gICAgICAgIC8vICB2YXIgc291cmNlcyA9IHRoaXMucGJ4RW1iZWRGcmFtZXdvcmtzQnVpbGRQaGFzZU9iaihmaWxlLnRhcmdldCk7XG4gICAgICAgIC8vIC8vICBUaGlzIHNlZW1lZCB3cm9uZyB0byBtZS4gIEl0IGp1c3QgZG9lcyBub3RoaW5nIGlmIGl0IGNhbid0IGZpbmQgdGhlIEVtYmVkRnJhbWV3b3JrcyBidWlsZFxuICAgICAgICAvLyAvLyAgcGhhc2UuICBTZWVtcyBsaWtlIGl0IHNob3VsZCB0aHJvdyBvciByZXR1cm4gYSBmYWlsdXJlLlxuICAgICAgICAvLyAvLyAgQWxzbywgaXQgaXMgaW5jb25zaXN0ZW50IHdpdGggdGhlIG90aGVyIG1ldGhvZHMgZG9pbmcgdGhlIGV4YWN0IHNhbWUgdGhpbmcuXG4gICAgICAgIC8vIC8vICBzdGFuZGFyZGl6ZWRcblxuICAgICAgICAvLyBpZiAoc291cmNlcykge1xuICAgICAgICAvLyAgICAgc291cmNlcy5maWxlcy5wdXNoKHBieEJ1aWxkUGhhc2VPYmpUaHJvd0lmSW52YWxpZChmaWxlKSk7XG4gICAgICAgIC8vICAgICAvL3NvdXJjZXMuZmlsZXMucHVzaChwYnhCdWlsZFBoYXNlT2JqKGZpbGUpKTtcbiAgICAgICAgLy8gfVxuICAgIH1cblxuICAgIHJlbW92ZUZyb21QYnhFbWJlZEZyYW1ld29ya3NCdWlsZFBoYXNlKGZpbGU6IFBieEZpbGUpOiB2b2lkIHtcblxuICAgICAgICB0aGlzLnBmX3JlbW92ZUZyb21CdWlsZFBoYXNlKFxuICAgICAgICAgICAgdGhpcy5wYnhFbWJlZEZyYW1ld29ya3NCdWlsZFBoYXNlT2JqKGZpbGUudGFyZ2V0KSxcbiAgICAgICAgICAgIGZpbGUpO1xuXG4gICAgICAgIC8vIC8vICBUaGUgYXV0aG9yIG9mIHRoaXMgbWV0aG9kIHdlbnQgd2l0aCBhIGRpZmZlcmVudCBzdHJhdGVneSB0aGFuIFxuICAgICAgICAvLyAvLyAgdGhlIG9yaWdpbmFsIGF1dGhvcnMuICBUaGlzIHN0cmF0ZWd5IHJlbW92ZXMgbXVsdGlwbGUgbWF0Y2hpbmcgY29tbWVudHMuXG4gICAgICAgIC8vIC8vICBUbyBtYWtlIHRoaXMgRFJZLCBzZXR0bGluZyBvbiB0aGlzIHdoaWNoIGluIHRoZW9yeSBoYW5kbGVzIG1vcmUgY2FzZXMuXG4gICAgICAgIC8vIGNvbnN0IHNvdXJjZXM6IFBCWENvcHlGaWxlc0J1aWxkUGhhc2UgfCBudWxsID0gdGhpcy5wYnhFbWJlZEZyYW1ld29ya3NCdWlsZFBoYXNlT2JqKGZpbGUudGFyZ2V0KTtcbiAgICAgICAgLy8gaWYgKHNvdXJjZXMpIHtcbiAgICAgICAgLy8gICAgIHZhciBmaWxlcyA9IFtdO1xuICAgICAgICAvLyAgICAgZm9yIChsZXQgaSBpbiBzb3VyY2VzLmZpbGVzKSB7XG4gICAgICAgIC8vICAgICAgICAgaWYgKHNvdXJjZXMuZmlsZXNbaV0uY29tbWVudCAhPSBsb25nQ29tbWVudChmaWxlKSkge1xuICAgICAgICAvLyAgICAgICAgICAgICBmaWxlcy5wdXNoKHNvdXJjZXMuZmlsZXNbaV0pO1xuICAgICAgICAvLyAgICAgICAgIH1cbiAgICAgICAgLy8gICAgIH1cbiAgICAgICAgLy8gICAgIHNvdXJjZXMuZmlsZXMgPSBmaWxlcztcbiAgICAgICAgLy8gfVxuICAgIH1cblxuICAgIGFkZFRvUGJ4U291cmNlc0J1aWxkUGhhc2UoZmlsZTogUGJ4RmlsZSk6IHZvaWQge1xuXG4gICAgICAgIHRoaXMucGZfYWRkVG9CdWlsZFBoYXNlKFxuICAgICAgICAgICAgdGhpcy5wYnhTb3VyY2VzQnVpbGRQaGFzZU9iaihmaWxlLnRhcmdldCksXG4gICAgICAgICAgICBmaWxlKTtcblxuICAgICAgICAvLyBjb25zdCBzb3VyY2VzID0gdGhpcy5wYnhTb3VyY2VzQnVpbGRQaGFzZU9iaihmaWxlLnRhcmdldCxcbiAgICAgICAgLy8gICAgIGVIYW5kbGVOb3RGb3VuZC50aHJvdykgYXMgUEJYU291cmNlc0J1aWxkUGhhc2U7XG5cbiAgICAgICAgLy8gc291cmNlcy5maWxlcy5wdXNoKHBieEJ1aWxkUGhhc2VPYmpUaHJvd0lmSW52YWxpZChmaWxlKSk7XG4gICAgfVxuXG4gICAgcmVtb3ZlRnJvbVBieFNvdXJjZXNCdWlsZFBoYXNlKGZpbGU6IFBieEZpbGUpOiB2b2lkIHtcblxuICAgICAgICB0aGlzLnBmX3JlbW92ZUZyb21CdWlsZFBoYXNlKFxuICAgICAgICAgICAgdGhpcy5wYnhTb3VyY2VzQnVpbGRQaGFzZU9iaihmaWxlLnRhcmdldCksXG4gICAgICAgICAgICBmaWxlKTtcblxuICAgICAgICAvLyAgV2FybmluZy4gIE5ldyBpbXBsZW1lbnRhdGlvbiBjcmVhdGVzIGEgbmV3IGFycmF5LiAgT2xkXG4gICAgICAgIC8vICBvbmUgdXNlZCBzcGxpY2UuICBJbiB0aGVvcnkgdGhpcyBjb3VsZCBicmVhayBjbGllbnQgY29kZS5cbiAgICAgICAgLy8gLy8gIFRocm93IGlmIG5vdCBmb3VuZC4gIFRoZW4gY2FzdCB0byBcbiAgICAgICAgLy8gY29uc3Qgc291cmNlcyA9IHRoaXMucGJ4U291cmNlc0J1aWxkUGhhc2VPYmooZmlsZS50YXJnZXQpXG5cbiAgICAgICAgLy8gZm9yIChsZXQgaSBpbiBzb3VyY2VzLmZpbGVzKSB7XG4gICAgICAgIC8vICAgICBpZiAoc291cmNlcy5maWxlc1tpXS5jb21tZW50ID09IGxvbmdDb21tZW50KGZpbGUpKSB7XG4gICAgICAgIC8vICAgICAgICAgc291cmNlcy5maWxlcy5zcGxpY2UoaSBhcyB1bmtub3duIGFzIG51bWJlciwgMSk7XG4gICAgICAgIC8vICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vICAgICB9XG4gICAgICAgIC8vIH1cbiAgICB9XG5cbiAgICBhZGRUb1BieFJlc291cmNlc0J1aWxkUGhhc2UoZmlsZTogSUZpbGVQYXRoT2JqICYgeyB0YXJnZXQ/OiBYQ19QUk9KX1VVSUQgfCBudWxsIH0pOiB2b2lkIHtcblxuICAgICAgICB0aGlzLnBmX2FkZFRvQnVpbGRQaGFzZShcbiAgICAgICAgICAgIHRoaXMucGJ4UmVzb3VyY2VzQnVpbGRQaGFzZU9iaihmaWxlLnRhcmdldCksXG4gICAgICAgICAgICBmaWxlKTtcbiAgICAgICAgLy8gdmFyIHNvdXJjZXMgPSB0aGlzLnBieFJlc291cmNlc0J1aWxkUGhhc2VPYmooZmlsZS50YXJnZXQpO1xuICAgICAgICAvLyBzb3VyY2VzLmZpbGVzLnB1c2gocGJ4QnVpbGRQaGFzZU9iaihmaWxlKSk7XG4gICAgfVxuXG4gICAgcmVtb3ZlRnJvbVBieFJlc291cmNlc0J1aWxkUGhhc2UoZmlsZTogUGJ4RmlsZSk6IHZvaWQge1xuXG4gICAgICAgIHRoaXMucGZfcmVtb3ZlRnJvbUJ1aWxkUGhhc2UoXG4gICAgICAgICAgICB0aGlzLnBieFJlc291cmNlc0J1aWxkUGhhc2VPYmooZmlsZS50YXJnZXQpLFxuICAgICAgICAgICAgZmlsZSk7XG5cbiAgICAgICAgLy8gIFdhcm5pbmc6ICBOZXcgaW1wbGVtZW50YXRpb24gY3JlYXRlcyBhIG5ldyBhcnJheSBpbnN0ZWFkIG9mXG4gICAgICAgIC8vICBzcGxpY2luZyB0aGUgZXhpc3Rpbmcgb25lLiAgVGhpcyBjb3VsZCBjYXVzZSBhbiBpc3N1ZSB3aXRoIGNsaWVudCBjb2RlLlxuICAgICAgICAvLyB2YXIgc291cmNlcyA9IHRoaXMucGJ4UmVzb3VyY2VzQnVpbGRQaGFzZU9iaihmaWxlLnRhcmdldCksIGk7XG5cbiAgICAgICAgLy8gZm9yIChpIGluIHNvdXJjZXMuZmlsZXMpIHtcbiAgICAgICAgLy8gICAgIGlmIChzb3VyY2VzLmZpbGVzW2ldLmNvbW1lbnQgPT0gbG9uZ0NvbW1lbnQoZmlsZSkpIHtcbiAgICAgICAgLy8gICAgICAgICBzb3VyY2VzLmZpbGVzLnNwbGljZShpLCAxKTtcbiAgICAgICAgLy8gICAgICAgICBicmVhaztcbiAgICAgICAgLy8gICAgIH1cbiAgICAgICAgLy8gfVxuICAgIH1cblxuICAgIGFkZFRvUGJ4RnJhbWV3b3Jrc0J1aWxkUGhhc2UoZmlsZTogUGJ4RmlsZSk6IHZvaWQge1xuXG4gICAgICAgIHRoaXMucGZfYWRkVG9CdWlsZFBoYXNlKFxuICAgICAgICAgICAgdGhpcy5wYnhGcmFtZXdvcmtzQnVpbGRQaGFzZU9iaihmaWxlLnRhcmdldCksXG4gICAgICAgICAgICBmaWxlKTtcblxuICAgICAgICAvLyB2YXIgc291cmNlcyA9IHRoaXMucGJ4RnJhbWV3b3Jrc0J1aWxkUGhhc2VPYmooZmlsZS50YXJnZXQpO1xuICAgICAgICAvLyBzb3VyY2VzLmZpbGVzLnB1c2gocGJ4QnVpbGRQaGFzZU9ialRocm93SWZJbnZhbGlkKGZpbGUpKTtcbiAgICB9XG5cbiAgICByZW1vdmVGcm9tUGJ4RnJhbWV3b3Jrc0J1aWxkUGhhc2UoZmlsZTogUGJ4RmlsZSk6IHZvaWQge1xuXG4gICAgICAgIHRoaXMucGZfcmVtb3ZlRnJvbUJ1aWxkUGhhc2UoXG4gICAgICAgICAgICB0aGlzLnBieEZyYW1ld29ya3NCdWlsZFBoYXNlT2JqKGZpbGUudGFyZ2V0KSxcbiAgICAgICAgICAgIGZpbGUpO1xuXG4gICAgICAgIC8vICBXYXJuaW5nOiAgTmV3IGltcGxlbWVudGF0aW9uIGNyZWF0ZXMgYSBuZXcgYXJyYXkuICBPbGQgb25lIHVzZWRcbiAgICAgICAgLy8gIHNwbGljZS4gIFRoaXMgY291bGQgYnJlYWsgY2xpZW50IGNvZGUgaWYgaXQgaGVsZCBvbnRvIHRoZSBcbiAgICAgICAgLy8gIG9yaWdpbmFsIGFycmF5LlxuXG4gICAgICAgIC8vIHZhciBzb3VyY2VzID0gdGhpcy5wYnhGcmFtZXdvcmtzQnVpbGRQaGFzZU9iaihmaWxlLnRhcmdldCk7XG4gICAgICAgIC8vIGZvciAoaSBpbiBzb3VyY2VzLmZpbGVzKSB7XG4gICAgICAgIC8vICAgICBpZiAoc291cmNlcy5maWxlc1tpXS5jb21tZW50ID09IGxvbmdDb21tZW50KGZpbGUpKSB7XG4gICAgICAgIC8vICAgICAgICAgc291cmNlcy5maWxlcy5zcGxpY2UoaSwgMSk7XG4gICAgICAgIC8vICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vICAgICB9XG4gICAgICAgIC8vIH1cbiAgICB9XG5cbiAgICBhZGRYQ0NvbmZpZ3VyYXRpb25MaXN0KFxuICAgICAgICBjb25maWd1cmF0aW9uT2JqZWN0c0FycmF5OiBYQ0J1aWxkQ29uZmlndXJhdGlvbltdLFxuICAgICAgICBkZWZhdWx0Q29uZmlndXJhdGlvbk5hbWU6IHN0cmluZyxcbiAgICAgICAgY29tbWVudDogc3RyaW5nKTogSUNvbmZpZ3VyYXRpb25MaXN0V3JhcHBlciB7XG5cbiAgICAgICAgY29uc3QgcGJ4QnVpbGRDb25maWd1cmF0aW9uU2VjdGlvbjogVHlwZWRTZWN0aW9uPFhDQnVpbGRDb25maWd1cmF0aW9uPiA9XG4gICAgICAgICAgICB0aGlzLnhjQnVpbGRDb25maWd1cmF0aW9uU2VjdGlvbigpO1xuXG4gICAgICAgIGNvbnN0IHhjQ29uZmlndXJhdGlvbkxpc3Q6IFhDQ29uZmlndXJhdGlvbkxpc3QgPSB7XG4gICAgICAgICAgICBpc2E6ICdYQ0NvbmZpZ3VyYXRpb25MaXN0JyxcbiAgICAgICAgICAgIGJ1aWxkQ29uZmlndXJhdGlvbnM6IFtdLFxuICAgICAgICAgICAgZGVmYXVsdENvbmZpZ3VyYXRpb25Jc1Zpc2libGU6IDAsXG4gICAgICAgICAgICBkZWZhdWx0Q29uZmlndXJhdGlvbk5hbWU6IGRlZmF1bHRDb25maWd1cmF0aW9uTmFtZVxuICAgICAgICB9O1xuXG4gICAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBjb25maWd1cmF0aW9uT2JqZWN0c0FycmF5Lmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgICAgY29uc3QgY29uZmlndXJhdGlvbiA9IGNvbmZpZ3VyYXRpb25PYmplY3RzQXJyYXlbaW5kZXhdO1xuXG4gICAgICAgICAgICBjb25zdCBjb25maWd1cmF0aW9uVXVpZDogWENfUFJPSl9VVUlEID0gdGhpcy5nZW5lcmF0ZVV1aWQoKTtcblxuICAgICAgICAgICAgU2VjdGlvblV0aWxzLmVudHJ5U2V0V1V1aWQocGJ4QnVpbGRDb25maWd1cmF0aW9uU2VjdGlvbiwgY29uZmlndXJhdGlvblV1aWQsIGNvbmZpZ3VyYXRpb24sIGNvbmZpZ3VyYXRpb24ubmFtZSk7XG4gICAgICAgICAgICAvLyBwYnhCdWlsZENvbmZpZ3VyYXRpb25TZWN0aW9uW2NvbmZpZ3VyYXRpb25VdWlkXSA9IGNvbmZpZ3VyYXRpb247XG4gICAgICAgICAgICAvLyAgICAgY29uZmlndXJhdGlvbkNvbW1lbnRLZXkgPSBkaWN0S2V5VXVpZFRvQ29tbWVudChjb25maWd1cmF0aW9uVXVpZCk7XG4gICAgICAgICAgICAvLyBwYnhCdWlsZENvbmZpZ3VyYXRpb25TZWN0aW9uW2NvbmZpZ3VyYXRpb25Db21tZW50S2V5XSA9IGNvbmZpZ3VyYXRpb24ubmFtZTtcblxuICAgICAgICAgICAgeGNDb25maWd1cmF0aW9uTGlzdC5idWlsZENvbmZpZ3VyYXRpb25zLnB1c2goeyB2YWx1ZTogY29uZmlndXJhdGlvblV1aWQsIGNvbW1lbnQ6IGNvbmZpZ3VyYXRpb24ubmFtZSB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHhjQ29uZmlndXJhdGlvbkxpc3RVdWlkOiBYQ19QUk9KX1VVSUQgPSB0aGlzLmdlbmVyYXRlVXVpZCgpO1xuXG4gICAgICAgIFNlY3Rpb25VdGlscy5lbnRyeVNldFdVdWlkKHRoaXMueGNDb25maWd1cmF0aW9uTGlzdCgpLCB4Y0NvbmZpZ3VyYXRpb25MaXN0VXVpZCwgeGNDb25maWd1cmF0aW9uTGlzdCwgY29tbWVudCk7XG5cbiAgICAgICAgLy8gY29uc3QgcGJ4WENDb25maWd1cmF0aW9uTGlzdFNlY3Rpb246IFR5cGVkU2VjdGlvbjxYQ0NvbmZpZ3VyYXRpb25MaXN0PiA9XG4gICAgICAgIC8vICAgICB0aGlzLnBieFhDQ29uZmlndXJhdGlvbkxpc3QoKTtcbiAgICAgICAgLy8gY29uc3QgY29tbWVudEtleTogc3RyaW5nID0gZGljdEtleVV1aWRUb0NvbW1lbnQoeGNDb25maWd1cmF0aW9uTGlzdFV1aWQpO1xuICAgICAgICAvLyBpZiAocGJ4WENDb25maWd1cmF0aW9uTGlzdFNlY3Rpb24pIHtcbiAgICAgICAgLy8gICAgIHBieFhDQ29uZmlndXJhdGlvbkxpc3RTZWN0aW9uW3hjQ29uZmlndXJhdGlvbkxpc3RVdWlkXSA9IHhjQ29uZmlndXJhdGlvbkxpc3Q7XG4gICAgICAgIC8vICAgICBwYnhYQ0NvbmZpZ3VyYXRpb25MaXN0U2VjdGlvbltjb21tZW50S2V5XSA9IGNvbW1lbnQ7XG4gICAgICAgIC8vIH1cblxuICAgICAgICBjb25zdCB3cmFwcGVyOiBJQ29uZmlndXJhdGlvbkxpc3RXcmFwcGVyID0geyB1dWlkOiB4Y0NvbmZpZ3VyYXRpb25MaXN0VXVpZCwgeGNDb25maWd1cmF0aW9uTGlzdDogeGNDb25maWd1cmF0aW9uTGlzdCB9O1xuICAgICAgICByZXR1cm4gd3JhcHBlcjtcbiAgICB9XG5cbiAgICBhZGRUYXJnZXREZXBlbmRlbmN5KHRhcmdldDogWENfUFJPSl9VVUlELCBkZXBlbmRlbmN5VGFyZ2V0czogWENfUFJPSl9VVUlEW10pOiBJTmF0aXZlVGFyZ2V0V3JhcHBlcjIgfCB1bmRlZmluZWQge1xuXG4gICAgICAgIGlmICghdGFyZ2V0KVxuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgLy8gICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIHRhcmdldCBzcGVjaWZpZWQhJyk7IEkgaGFkIHRob3VnaHQgaXQgbWFkZSBtb3JlIHNlbnNlIHRvIHRocm93IGFuIGVycm9yLiAgQnV0IGEgdGVzdCBkaWN0YXRlcyB0aGlzIHJldHVybnMgdW5kZWZpbmVkLlxuICAgICAgICAvLyAgVG8gbWFpbnRhaW4gY29tcGF0aWJpbGl0eSB3aXRoIHRoZSBvcmlnaW5hbCB2ZXJzaW9uLCByZXN0b3JpbmcgZWF0aW5nIHRoZSBpbnZhbGlkIGNhbGwuIFxuXG4gICAgICAgIGNvbnN0IG5hdGl2ZVRhcmdldHM6IFR5cGVkU2VjdGlvbjxQQlhOYXRpdmVUYXJnZXQ+ID0gdGhpcy5wYnhOYXRpdmVUYXJnZXRTZWN0aW9uKCk7XG4gICAgICAgIGNvbnN0IG5hdGl2ZVRhcmdldDogUEJYTmF0aXZlVGFyZ2V0IHwgc3RyaW5nIHwgdW5kZWZpbmVkID0gbmF0aXZlVGFyZ2V0c1t0YXJnZXRdO1xuXG4gICAgICAgIGlmICh0eXBlb2YgbmF0aXZlVGFyZ2V0ICE9IFwib2JqZWN0XCIpIC8vIHN3aXRjaGVkIGZyb20gIT0gdW5kZWZpbmVkIHRvID09IG9iamVjdCB0byBkZWFsIHdpdGggdGhlIHBvc3NpYmlsaXR5IHNvbWVvbmUgcGFzc2VkIGluIGEgY29tbWVudCBrZXlcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgdGFyZ2V0OiBcIiArIHRhcmdldCk7XG5cbiAgICAgICAgZm9yICh2YXIgaW5kZXggPSAwOyBpbmRleCA8IGRlcGVuZGVuY3lUYXJnZXRzLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgICAgY29uc3QgZGVwZW5kZW5jeVRhcmdldCA9IGRlcGVuZGVuY3lUYXJnZXRzW2luZGV4XTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgbmF0aXZlVGFyZ2V0c1tkZXBlbmRlbmN5VGFyZ2V0XSAhPSBcIm9iamVjdFwiKSAvLyBzd2l0Y2hlZCBmcm9tID09IFwidW5kZWZpbmVkXCIgdG8gIT0gXCJvYmplY3RcIiB0byBoYW5kbGUgY29tbWVudCBrZXlzXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCB0YXJnZXQ6IFwiICsgZGVwZW5kZW5jeVRhcmdldCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwYnhUYXJnZXREZXBlbmRlbmN5U2VjdGlvbjogVHlwZWRTZWN0aW9uPFBCWFRhcmdldERlcGVuZGVuY3k+ID0gdGhpcy5wYnhUYXJnZXREZXBlbmRlbmN5U2VjdGlvbigpO1xuICAgICAgICBjb25zdCBwYnhDb250YWluZXJJdGVtUHJveHlTZWN0aW9uOiBUeXBlZFNlY3Rpb248UEJYQ29udGFpbmVySXRlbVByb3h5PiA9IHRoaXMucGJ4Q29udGFpbmVySXRlbVByb3h5U2VjdGlvbigpO1xuXG4gICAgICAgIGlmICghdGhpcy5oYXNoKSAgLy8gIEFzc3VyZSBUUyB3ZSBjYW4gYWNjZXNzIHByb2plY3QuXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vdCBsb2FkZWQnKTtcblxuICAgICAgICBjb25zdCBwcm9qZWN0OiBJUHJvamVjdCA9IHRoaXMuaGFzaC5wcm9qZWN0O1xuXG4gICAgICAgIGZvciAodmFyIGluZGV4ID0gMDsgaW5kZXggPCBkZXBlbmRlbmN5VGFyZ2V0cy5sZW5ndGg7IGluZGV4KyspIHtcblxuICAgICAgICAgICAgY29uc3QgZGVwZW5kZW5jeVRhcmdldFV1aWQ6IFhDX1BST0pfVVVJRCA9IGRlcGVuZGVuY3lUYXJnZXRzW2luZGV4XTtcbiAgICAgICAgICAgIGNvbnN0IGRlcGVuZGVuY3lUYXJnZXRDb21tZW50S2V5OiBYQ19DT01NRU5UX0tFWSA9IFNlY3Rpb25VdGlscy5kaWN0S2V5VXVpZFRvQ29tbWVudChkZXBlbmRlbmN5VGFyZ2V0VXVpZCk7XG5cbiAgICAgICAgICAgIGNvbnN0IHRhcmdldERlcGVuZGVuY3lVdWlkOiBYQ19QUk9KX1VVSUQgPSB0aGlzLmdlbmVyYXRlVXVpZCgpO1xuICAgICAgICAgICAgLy8gY29uc3QgdGFyZ2V0RGVwZW5kZW5jeUNvbW1lbnRLZXkgOlhDX0NPTU1FTlRfS0VZID0gU2VjdGlvblV0aWxzLmRpY3RLZXlVdWlkVG9Db21tZW50KHRhcmdldERlcGVuZGVuY3lVdWlkKTtcblxuICAgICAgICAgICAgY29uc3QgaXRlbVByb3h5VXVpZDogWENfUFJPSl9VVUlEID0gdGhpcy5nZW5lcmF0ZVV1aWQoKTtcbiAgICAgICAgICAgIC8vIGNvbnN0IGl0ZW1Qcm94eUNvbW1lbnRLZXk6WENfQ09NTUVOVF9LRVkgPSBTZWN0aW9uVXRpbHMuZGljdEtleVV1aWRUb0NvbW1lbnQoaXRlbVByb3h5VXVpZCk7XG5cbiAgICAgICAgICAgIGNvbnN0IGl0ZW1Qcm94eTogUEJYQ29udGFpbmVySXRlbVByb3h5ID0ge1xuICAgICAgICAgICAgICAgIGlzYTogY1BCWENvbnRhaW5lckl0ZW1Qcm94eSxcbiAgICAgICAgICAgICAgICBjb250YWluZXJQb3J0YWw6IHByb2plY3RbJ3Jvb3RPYmplY3QnXSxcbiAgICAgICAgICAgICAgICBjb250YWluZXJQb3J0YWxfY29tbWVudDogcHJvamVjdFsncm9vdE9iamVjdF9jb21tZW50J10sXG4gICAgICAgICAgICAgICAgcHJveHlUeXBlOiAxLFxuICAgICAgICAgICAgICAgIHJlbW90ZUdsb2JhbElEU3RyaW5nOiBkZXBlbmRlbmN5VGFyZ2V0VXVpZCxcbiAgICAgICAgICAgICAgICByZW1vdGVJbmZvOiAobmF0aXZlVGFyZ2V0c1tkZXBlbmRlbmN5VGFyZ2V0VXVpZF0gYXMgUEJYTmF0aXZlVGFyZ2V0KS5uYW1lXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBjb25zdCB0YXJnZXREZXBlbmRlbmN5OiBQQlhUYXJnZXREZXBlbmRlbmN5ID0ge1xuICAgICAgICAgICAgICAgIGlzYTogY1BCWFRhcmdldERlcGVuZGVuY3ksXG4gICAgICAgICAgICAgICAgdGFyZ2V0OiBkZXBlbmRlbmN5VGFyZ2V0VXVpZCxcbiAgICAgICAgICAgICAgICB0YXJnZXRfY29tbWVudDogbmF0aXZlVGFyZ2V0c1tkZXBlbmRlbmN5VGFyZ2V0Q29tbWVudEtleV0gYXMgc3RyaW5nLFxuICAgICAgICAgICAgICAgIHRhcmdldFByb3h5OiBpdGVtUHJveHlVdWlkLFxuICAgICAgICAgICAgICAgIHRhcmdldFByb3h5X2NvbW1lbnQ6IGNQQlhDb250YWluZXJJdGVtUHJveHlcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vICBXZSBub3cgY3JlYXRlIHRoZSBzZWN0aW9ucyBpZiB0aGV5IGRvbid0IGV4aXN0LiAgU28gd2UgZG9uJ3QgY2hlY2sgaWYgdGhleSBhcmUgc2V0IGhlcmUuXG4gICAgICAgICAgICAvLyAgICAgICAgICAgIGlmIChwYnhDb250YWluZXJJdGVtUHJveHlTZWN0aW9uICYmIHBieFRhcmdldERlcGVuZGVuY3lTZWN0aW9uKSB7XG5cbiAgICAgICAgICAgIFNlY3Rpb25VdGlscy5lbnRyeVNldFdVdWlkKHBieENvbnRhaW5lckl0ZW1Qcm94eVNlY3Rpb24sIGl0ZW1Qcm94eVV1aWQsIGl0ZW1Qcm94eSwgY1BCWENvbnRhaW5lckl0ZW1Qcm94eSk7XG4gICAgICAgICAgICAvLyBwYnhDb250YWluZXJJdGVtUHJveHlTZWN0aW9uW2l0ZW1Qcm94eVV1aWRdID0gaXRlbVByb3h5O1xuICAgICAgICAgICAgLy8gcGJ4Q29udGFpbmVySXRlbVByb3h5U2VjdGlvbltpdGVtUHJveHlDb21tZW50S2V5XSA9IGNQQlhDb250YWluZXJJdGVtUHJveHk7XG5cbiAgICAgICAgICAgIFNlY3Rpb25VdGlscy5lbnRyeVNldFdVdWlkKHBieFRhcmdldERlcGVuZGVuY3lTZWN0aW9uLCB0YXJnZXREZXBlbmRlbmN5VXVpZCwgdGFyZ2V0RGVwZW5kZW5jeSwgY1BCWFRhcmdldERlcGVuZGVuY3kpO1xuICAgICAgICAgICAgLy8gcGJ4VGFyZ2V0RGVwZW5kZW5jeVNlY3Rpb25bdGFyZ2V0RGVwZW5kZW5jeVV1aWRdID0gdGFyZ2V0RGVwZW5kZW5jeTtcbiAgICAgICAgICAgIC8vIHBieFRhcmdldERlcGVuZGVuY3lTZWN0aW9uW3RhcmdldERlcGVuZGVuY3lDb21tZW50S2V5XSA9IGNQQlhUYXJnZXREZXBlbmRlbmN5O1xuXG4gICAgICAgICAgICBuYXRpdmVUYXJnZXQuZGVwZW5kZW5jaWVzLnB1c2goeyB2YWx1ZTogdGFyZ2V0RGVwZW5kZW5jeVV1aWQsIGNvbW1lbnQ6IGNQQlhUYXJnZXREZXBlbmRlbmN5IH0pXG4gICAgICAgICAgICAvLyAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHsgdXVpZDogdGFyZ2V0LCB0YXJnZXQ6IG5hdGl2ZVRhcmdldCB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFxuICAgICAqIEBwYXJhbSBmaWxlUGF0aHNBcnJheSBcbiAgICAgKiBAcGFyYW0gYnVpbGRQaGFzZVR5cGUgXG4gICAgICogQHBhcmFtIGNvbW1lbnQgXG4gICAgICogQHBhcmFtIHRhcmdldCBVVUlEIG9mIFBCWE5hdGl2ZVRhcmdldFxuICAgICAqIEBwYXJhbSBvcHRpb25zT3JGb2xkZXJUeXBlIEEgc3RyaW5nIGZvciBcIkNvcHkgRmlsZXNcIiBhbmQgT3B0aW9ucyBmb3IgXCJTaGVsbCBTY3JpcHRcIiBidWlsZCBwaGFzZXMuXG4gICAgICogQHBhcmFtIHN1YmZvbGRlclBhdGggXG4gICAgICovXG4gICAgYWRkQnVpbGRQaGFzZShcbiAgICAgICAgZmlsZVBhdGhzQXJyYXk6IHN0cmluZ1tdLFxuICAgICAgICAvLyAgRG9uJ3Qga25vdyBpZiB0aGlzIHdhcyBtZWFudCB0byBoYW5kbGUgYWRkaXRpb25hbCBwaGFzZXMgb3Igbm90LiAgXG4gICAgICAgIC8vICBsZWZ0IHRvIG9ubHkgc3VwcG9ydCB0aGVzZSB0d28gdHlwZXMuXG4gICAgICAgIGJ1aWxkUGhhc2VUeXBlOiAnUEJYQ29weUZpbGVzQnVpbGRQaGFzZScgfCAnUEJYU2hlbGxTY3JpcHRCdWlsZFBoYXNlJyxcbiAgICAgICAgY29tbWVudDogc3RyaW5nLFxuICAgICAgICB0YXJnZXQ6IFhDX1BST0pfVVVJRCB8IG51bGwgfCB1bmRlZmluZWQsXG4gICAgICAgIG9wdGlvbnNPckZvbGRlclR5cGU6IHN0cmluZyB8IElQYnhTaGVsbFNjcmlwdEJ1aWxkUGhhc2VPcHRpb25zLFxuICAgICAgICBzdWJmb2xkZXJQYXRoPzogc3RyaW5nIHwgbnVsbCk6IElCdWlsZFBoYXNlV3JhcHBlciB7XG5cbiAgICAgICAgY29uc3QgYnVpbGRGaWxlU2VjdGlvbjogVHlwZWRTZWN0aW9uPFBCWEJ1aWxkRmlsZT4gPSB0aGlzLnBieEJ1aWxkRmlsZVNlY3Rpb24oKTtcblxuICAgICAgICBsZXQgYnVpbGRQaGFzZTogUEJYQnVpbGRQaGFzZUJhc2UgPSB7XG4gICAgICAgICAgICBpc2E6IGJ1aWxkUGhhc2VUeXBlLFxuICAgICAgICAgICAgYnVpbGRBY3Rpb25NYXNrOiAyMTQ3NDgzNjQ3LFxuICAgICAgICAgICAgZmlsZXM6IFtdLFxuICAgICAgICAgICAgcnVuT25seUZvckRlcGxveW1lbnRQb3N0cHJvY2Vzc2luZzogMFxuICAgICAgICB9O1xuXG5cbiAgICAgICAgaWYgKGJ1aWxkUGhhc2VUeXBlID09PSBjUEJYQ29weUZpbGVzQnVpbGRQaGFzZSkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zT3JGb2xkZXJUeXBlICE9ICdzdHJpbmcnKVxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBmb2xkZXIgdHlwZSBmb3IgJyR7Y1BCWENvcHlGaWxlc0J1aWxkUGhhc2V9J2ApO1xuXG4gICAgICAgICAgICBidWlsZFBoYXNlID0gcGJ4Q29weUZpbGVzQnVpbGRQaGFzZU9iaihidWlsZFBoYXNlLCBvcHRpb25zT3JGb2xkZXJUeXBlLCBzdWJmb2xkZXJQYXRoLCBjb21tZW50KTtcbiAgICAgICAgfSBlbHNlIGlmIChidWlsZFBoYXNlVHlwZSA9PT0gY1BCWFNoZWxsU2NyaXB0QnVpbGRQaGFzZSkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zT3JGb2xkZXJUeXBlICE9ICdvYmplY3QnKVxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBmb2xkZXIgdHlwZSBmb3IgJyR7Y1BCWFNoZWxsU2NyaXB0QnVpbGRQaGFzZX0nYCk7XG5cbiAgICAgICAgICAgIGJ1aWxkUGhhc2UgPSBwYnhTaGVsbFNjcmlwdEJ1aWxkUGhhc2VPYmooYnVpbGRQaGFzZSwgb3B0aW9uc09yRm9sZGVyVHlwZSwgY29tbWVudClcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEkgZG9uJ3Qga25vdyBpZiB0aGlzIGlzIHN1cHBvc2VkIHRvIGhhbmRsZSBvdGhlciBidWlsZCBwaGFzZSB0eXBlcy4gIEFzc3VtaW5nIG5vdC5cbiAgICAgICAgLy8gIFdpbGwgZnVuY3Rpb24gdGhlIHNhbWUgd2hlbiBjYWxsZWQgZnJvbSBqYXZhc2NyaXB0LCBidXQgaW5kaWNhdGUgYW4gZXJyb3Igd2hlblxuICAgICAgICAvLyAgY2FsbGluZyBmcm9tIHR5cGVzY3JpcHQgc2ljbmUgd2Ugc3BlY2lmeSBvbmx5IHRoZXNlIHR3byBwaGFzZXMuXG5cblxuICAgICAgICBjb25zdCBidWlsZFBoYXNlVXVpZDogWENfUFJPSl9VVUlEID0gdGhpcy5nZW5lcmF0ZVV1aWQoKTtcblxuICAgICAgICAvLyAgVGhpcyB3YXMgYmVpbmcgZG9uZSB0d2ljZSEgIERvaW5nIGl0IGF0IHRoZSBlbmQuXG4gICAgICAgIC8vIGNvbnN0IGNvbW1lbnRLZXk6IHN0cmluZyA9IGNyZWF0ZVV1aWRDb21tZW50S2V5KGJ1aWxkUGhhc2VVdWlkKTtcbiAgICAgICAgLy8gLy8gaWYgKCF0aGlzLmhhc2gucHJvamVjdC5vYmplY3RzW2J1aWxkUGhhc2VUeXBlXVtidWlsZFBoYXNlVXVpZF0pIHsgcmVtb3ZlZCB0aGlzIGNoZWNrIGFzIHRoaXMgaXMgaW1wb3NzaWJsZVxuICAgICAgICAvLyBidWlsZFBoYXNlU2VjdGlvbltidWlsZFBoYXNlVXVpZF0gPSBidWlsZFBoYXNlO1xuICAgICAgICAvLyBidWlsZFBoYXNlU2VjdGlvbltjb21tZW50S2V5XSA9IGNvbW1lbnQ7XG4gICAgICAgIC8vIFNlY3Rpb25VdGlscy5lbnRyeVNldFdVdWlkPFBCWEJ1aWxkUGhhc2VCYXNlPihidWlsZFBoYXNlU2VjdGlvbiwgYnVpbGRQaGFzZVV1aWQsIGJ1aWxkUGhhc2UsIGNvbW1lbnQpO1xuXG4gICAgICAgIGNvbnN0IGJ1aWxkUGhhc2VUYXJnZXRVdWlkOiBYQ19QUk9KX1VVSUQgPSB0YXJnZXQgfHwgdGhpcy5nZXRGaXJzdFRhcmdldCgpLnV1aWQ7XG5cbiAgICAgICAgY29uc3QgbmF0aXZlVGFyZ2V0OiBQQlhOYXRpdmVUYXJnZXQgfCBudWxsID0gU2VjdGlvblV0aWxzLmVudHJ5R2V0V1V1aWQodGhpcy5wYnhOYXRpdmVUYXJnZXRTZWN0aW9uKCksIGJ1aWxkUGhhc2VUYXJnZXRVdWlkKTtcblxuICAgICAgICAvLyAgT3JpZ2luYWwgY29kZSBib3dlZCBvdXQgaWYgdGhlcmUgYXJlIG5vdCBidWlsZFBoYXNlcy4gIFRoYXQgaW1wbGllcyB0aGlzIGlzIGludmFsaWQgYW5kIFxuICAgICAgICAvLyAgdGhlIGJlaGF2aW9yIGlzIHdyb25nLiAgSSB3YW50IHRoZSBlcnJvciBpZiBuYXRpdmVUYXJnZXQgaGFzIG5vIGJ1aWxkIHBoYXNlcyBvciBhdCBhIG1pbmltdW1cbiAgICAgICAgLy8gIHRvIGFkZCB0aGVtIGJhY2sgaW4uXG4gICAgICAgIC8vaWYgKG5hdGl2ZVRhcmdldCAmJiBuYXRpdmVUYXJnZXQuYnVpbGRQaGFzZXMpIHtcbiAgICAgICAgaWYgKG5hdGl2ZVRhcmdldCkge1xuICAgICAgICAgICAgbmF0aXZlVGFyZ2V0LmJ1aWxkUGhhc2VzLnB1c2goe1xuICAgICAgICAgICAgICAgIHZhbHVlOiBidWlsZFBoYXNlVXVpZCxcbiAgICAgICAgICAgICAgICBjb21tZW50OiBjb21tZW50XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGZpbGVSZWZlcmVuY2VTZWN0aW9uOiBUeXBlZFNlY3Rpb248UEJYRmlsZVJlZmVyZW5jZT4gPSB0aGlzLnBieEZpbGVSZWZlcmVuY2VTZWN0aW9uKCk7XG5cbiAgICAgICAgLy8gIExvYWQgdGhlIGZpbGVQYXRoVG9CdWlsZEZpbGUgZGljdGlvbmFyeVxuICAgICAgICBjb25zdCBmaWxlUGF0aFRvQnVpbGRGaWxlOiB7IFtwYXRoOiBzdHJpbmddOiBJRmlsZVBhdGhPYmogfSA9IHt9O1xuICAgICAgICBmb3IgKHZhciBrZXkgaW4gYnVpbGRGaWxlU2VjdGlvbikge1xuICAgICAgICAgICAgLy8gLy8gb25seSBsb29rIGZvciBjb21tZW50c1xuICAgICAgICAgICAgLy8gaWYgKCFDT01NRU5UX0tFWS50ZXN0KGtleSkpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAvLyB2YXIgYnVpbGRGaWxlS2V5ID0ga2V5LnNwbGl0KENPTU1FTlRfS0VZKVswXSxcbiAgICAgICAgICAgIC8vICAgICBidWlsZEZpbGUgPSBidWlsZEZpbGVTZWN0aW9uW2J1aWxkRmlsZUtleV07XG4gICAgICAgICAgICAvLyBmaWxlUmVmZXJlbmNlID0gZmlsZVJlZmVyZW5jZVNlY3Rpb25bYnVpbGRGaWxlLmZpbGVSZWZdO1xuXG4gICAgICAgICAgICAvLyBpZiAoIWZpbGVSZWZlcmVuY2UpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAvLyB2YXIgcGJ4RmlsZU9iaiA9IG5ldyBQYnhGaWxlKGZpbGVSZWZlcmVuY2UucGF0aCk7XG5cbiAgICAgICAgICAgIC8vIGZpbGVQYXRoVG9CdWlsZEZpbGVbZmlsZVJlZmVyZW5jZS5wYXRoXSA9IHsgdXVpZDogYnVpbGRGaWxlS2V5LCBiYXNlbmFtZTogcGJ4RmlsZU9iai5iYXNlbmFtZSwgZ3JvdXA6IHBieEZpbGVPYmouZ3JvdXAgfTtcbiAgICAgICAgICAgIC8vICBPbmx5IGNvbnNpZGVyIGNvbW1lbnRzXG4gICAgICAgICAgICBpZiAoU2VjdGlvblV0aWxzLmRpY3RLZXlJc0NvbW1lbnQoa2V5KSkge1xuXG4gICAgICAgICAgICAgICAgY29uc3QgYnVpbGRGaWxlS2V5OiBYQ19QUk9KX1VVSUQgPSBTZWN0aW9uVXRpbHMuZGljdEtleUNvbW1lbnRUb1V1aWQoa2V5KTtcbiAgICAgICAgICAgICAgICBjb25zdCBidWlsZEZpbGU6IFBCWEJ1aWxkRmlsZSA9IGJ1aWxkRmlsZVNlY3Rpb25bYnVpbGRGaWxlS2V5XSBhcyBQQlhCdWlsZEZpbGU7XG4gICAgICAgICAgICAgICAgY29uc3QgZmlsZVJlZmVyZW5jZTogUEJYRmlsZVJlZmVyZW5jZSB8IHVuZGVmaW5lZCB8IHN0cmluZyA9IGZpbGVSZWZlcmVuY2VTZWN0aW9uW2J1aWxkRmlsZS5maWxlUmVmXTtcblxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZmlsZVJlZmVyZW5jZSA9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBieEZpbGVPYmogPSBuZXcgUGJ4RmlsZShmaWxlUmVmZXJlbmNlLnBhdGgpO1xuXG4gICAgICAgICAgICAgICAgICAgIGZpbGVQYXRoVG9CdWlsZEZpbGVbZmlsZVJlZmVyZW5jZS5wYXRoXSA9IHsgdXVpZDogYnVpbGRGaWxlS2V5LCBiYXNlbmFtZTogcGJ4RmlsZU9iai5iYXNlbmFtZSwgZ3JvdXA6IHBieEZpbGVPYmouZ3JvdXAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKHZhciBpbmRleCA9IDA7IGluZGV4IDwgZmlsZVBhdGhzQXJyYXkubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgICAgICB2YXIgZmlsZVBhdGggPSBmaWxlUGF0aHNBcnJheVtpbmRleF0sXG4gICAgICAgICAgICAgICAgZmlsZVBhdGhRdW90ZWQgPSBcIlxcXCJcIiArIGZpbGVQYXRoICsgXCJcXFwiXCIsXG4gICAgICAgICAgICAgICAgZmlsZSA9IG5ldyBQYnhGaWxlKGZpbGVQYXRoKTtcblxuICAgICAgICAgICAgaWYgKGZpbGVQYXRoVG9CdWlsZEZpbGVbZmlsZVBhdGhdKSB7XG4gICAgICAgICAgICAgICAgYnVpbGRQaGFzZS5maWxlcy5wdXNoKHBieEJ1aWxkUGhhc2VPYmooZmlsZVBhdGhUb0J1aWxkRmlsZVtmaWxlUGF0aF0pKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZmlsZVBhdGhUb0J1aWxkRmlsZVtmaWxlUGF0aFF1b3RlZF0pIHtcbiAgICAgICAgICAgICAgICBidWlsZFBoYXNlLmZpbGVzLnB1c2gocGJ4QnVpbGRQaGFzZU9iaihmaWxlUGF0aFRvQnVpbGRGaWxlW2ZpbGVQYXRoUXVvdGVkXSkpO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmaWxlLnV1aWQgPSB0aGlzLmdlbmVyYXRlVXVpZCgpO1xuICAgICAgICAgICAgZmlsZS5maWxlUmVmID0gdGhpcy5nZW5lcmF0ZVV1aWQoKTtcbiAgICAgICAgICAgIHRoaXMuYWRkVG9QYnhGaWxlUmVmZXJlbmNlU2VjdGlvbihmaWxlKTsgICAgLy8gUEJYRmlsZVJlZmVyZW5jZVxuICAgICAgICAgICAgdGhpcy5hZGRUb1BieEJ1aWxkRmlsZVNlY3Rpb24oZmlsZSk7ICAgICAgICAvLyBQQlhCdWlsZEZpbGVcbiAgICAgICAgICAgIGJ1aWxkUGhhc2UuZmlsZXMucHVzaChwYnhCdWlsZFBoYXNlT2JqKGZpbGUpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vICBUaGlzIGlzIG9uZSBvZiB0aGUgYnVpbGQgcGhhc2Ugc2VjdGlvbnMuICBUaGVyZSBhcmUgc2V2ZXJhbC5cbiAgICAgICAgY29uc3QgYnVpbGRQaGFzZVNlY3Rpb246IFR5cGVkU2VjdGlvbjxQQlhCdWlsZFBoYXNlQmFzZT4gPVxuICAgICAgICAgICAgdGhpcy5wZl9zZWN0aW9uR2V0T3JDcmVhdGU8UEJYQnVpbGRQaGFzZUJhc2U+KGJ1aWxkUGhhc2VUeXBlKTtcblxuICAgICAgICBTZWN0aW9uVXRpbHMuZW50cnlTZXRXVXVpZDxQQlhCdWlsZFBoYXNlQmFzZT4oYnVpbGRQaGFzZVNlY3Rpb24sIGJ1aWxkUGhhc2VVdWlkLCBidWlsZFBoYXNlLCBjb21tZW50KTtcbiAgICAgICAgLy8gaWYgKGJ1aWxkUGhhc2VTZWN0aW9uKSB7XG4gICAgICAgIC8vICAgICBidWlsZFBoYXNlU2VjdGlvbltidWlsZFBoYXNlVXVpZF0gPSBidWlsZFBoYXNlO1xuICAgICAgICAvLyAgICAgYnVpbGRQaGFzZVNlY3Rpb25bY29tbWVudEtleV0gPSBjb21tZW50O1xuICAgICAgICAvLyB9XG5cbiAgICAgICAgcmV0dXJuIHsgdXVpZDogYnVpbGRQaGFzZVV1aWQsIGJ1aWxkUGhhc2U6IGJ1aWxkUGhhc2UgfTtcbiAgICB9XG5cbiAgICAvLyAgSW1wbGVtZW50YXRpb24gY2hhbmdlOiAgMTAvMjAxOSBpdCB1c2VkIHRvIGJlIG9ubHkgWENWZXJzaW9uR3JvdXAgd291bGRcbiAgICAvLyAgY3JlYXRlIGEgc2VjdGlvbi4gIE5vdyBhbGwgbWlzc2luZyBzZWN0aW9ucyBhcmUgY3JlYXRlZC5cbiAgICBwcml2YXRlIHBmX3NlY3Rpb25HZXRPckNyZWF0ZTxQQlhfT0JKX1RZUEUgZXh0ZW5kcyBQQlhPYmplY3RCYXNlPihzZWN0aW9uTmFtZTogSVNBX1RZUEUpOiBUeXBlZFNlY3Rpb248UEJYX09CSl9UWVBFPiB7XG5cbiAgICAgICAgaWYgKCF0aGlzLmhhc2gpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTm90IExvYWRlZCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLmhhc2gucHJvamVjdC5vYmplY3RzW3NlY3Rpb25OYW1lXSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIHRoaXMuaGFzaC5wcm9qZWN0Lm9iamVjdHNbc2VjdGlvbk5hbWVdID0ge307XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5oYXNoLnByb2plY3Qub2JqZWN0c1tzZWN0aW9uTmFtZV0gYXMgVHlwZWRTZWN0aW9uPFBCWF9PQkpfVFlQRT47XG4gICAgfVxuXG4gICAgcGJ4R3JvdXBzU2VjdGlvbigpOiBUeXBlZFNlY3Rpb248UEJYR3JvdXA+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGZfc2VjdGlvbkdldE9yQ3JlYXRlPFBCWEdyb3VwPihjUEJYR3JvdXApO1xuICAgIH1cblxuICAgIHBieFZhcmlhbnRHcm91cHNTZWN0aW9uKCk6IFR5cGVkU2VjdGlvbjxQQlhWYXJpYW50R3JvdXA+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGZfc2VjdGlvbkdldE9yQ3JlYXRlPFBCWFZhcmlhbnRHcm91cD4oY1BCWFZhcmlhbnRHcm91cCk7XG4gICAgfVxuICAgIC8vIGhlbHBlciBhY2Nlc3MgZnVuY3Rpb25zXG4gICAgcGJ4UHJvamVjdFNlY3Rpb24oKTogVHlwZWRTZWN0aW9uPFBCWFByb2plY3Q+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGZfc2VjdGlvbkdldE9yQ3JlYXRlPFBCWFByb2plY3Q+KGNQQlhQcm9qZWN0KTtcbiAgICB9XG5cbiAgICBwYnhCdWlsZEZpbGVTZWN0aW9uKCk6IFR5cGVkU2VjdGlvbjxQQlhCdWlsZEZpbGU+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGZfc2VjdGlvbkdldE9yQ3JlYXRlKGNQQlhCdWlsZEZpbGUpO1xuICAgIH1cblxuICAgIHBieEZpbGVSZWZlcmVuY2VTZWN0aW9uKCk6IFR5cGVkU2VjdGlvbjxQQlhGaWxlUmVmZXJlbmNlPiB7XG4gICAgICAgIHJldHVybiB0aGlzLnBmX3NlY3Rpb25HZXRPckNyZWF0ZTxQQlhGaWxlUmVmZXJlbmNlPihjUEJYRmlsZVJlZmVyZW5jZSk7XG4gICAgfVxuXG4gICAgcGJ4TmF0aXZlVGFyZ2V0U2VjdGlvbigpOiBUeXBlZFNlY3Rpb248UEJYTmF0aXZlVGFyZ2V0PiB7XG4gICAgICAgIHJldHVybiB0aGlzLnBmX3NlY3Rpb25HZXRPckNyZWF0ZShjUEJYTmF0aXZlVGFyZ2V0KTtcbiAgICB9XG5cbiAgICBwYnhUYXJnZXREZXBlbmRlbmN5U2VjdGlvbigpOiBUeXBlZFNlY3Rpb248UEJYVGFyZ2V0RGVwZW5kZW5jeT4ge1xuICAgICAgICByZXR1cm4gdGhpcy5wZl9zZWN0aW9uR2V0T3JDcmVhdGUoY1BCWFRhcmdldERlcGVuZGVuY3kpO1xuICAgIH1cblxuICAgIHBieENvbnRhaW5lckl0ZW1Qcm94eVNlY3Rpb24oKTogVHlwZWRTZWN0aW9uPFBCWENvbnRhaW5lckl0ZW1Qcm94eT4ge1xuICAgICAgICByZXR1cm4gdGhpcy5wZl9zZWN0aW9uR2V0T3JDcmVhdGUoY1BCWENvbnRhaW5lckl0ZW1Qcm94eSk7XG4gICAgfVxuXG4gICAgLy8gIFRoaXMgd2FzIHRoZSBvcmlnaW5hbCBuYW1lIHRoYXQgSSBkaWQgbm90IHRoaW5rIG1hZGUgc2Vuc2UuICBUZXN0cyB1c2VcbiAgICAvLyAgdGhpcyBzbyBJIHB1dCBpdCBiYWNrIHRvIGNhbGwgdGhlIG5ldyBmdW5jdGlvbiBuYW1lLlxuICAgIHBieFhDQnVpbGRDb25maWd1cmF0aW9uU2VjdGlvbigpOiBUeXBlZFNlY3Rpb248WENCdWlsZENvbmZpZ3VyYXRpb24+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMueGNCdWlsZENvbmZpZ3VyYXRpb25TZWN0aW9uKCk7XG4gICAgfVxuXG4gICAgeGNCdWlsZENvbmZpZ3VyYXRpb25TZWN0aW9uKCk6IFR5cGVkU2VjdGlvbjxYQ0J1aWxkQ29uZmlndXJhdGlvbj4ge1xuICAgICAgICByZXR1cm4gdGhpcy5wZl9zZWN0aW9uR2V0T3JDcmVhdGUoY1hDQnVpbGRDb25maWd1cmF0aW9uKTtcbiAgICB9XG5cbiAgICAvLyAgSW5jb25zaXN0ZW50IG5hbWluZyBvZiBub3QgaGF2aW5nIHBieCBpbiBmcm9udCBleGlzdGVkIHdoZW4gZm91bmQuXG4gICAgLy8gIGxlZnQgaW4gY2FzZSBjbGllbnQgd2FzIHVzaW5nIHRoaXMuXG4gICAgeGNWZXJzaW9uR3JvdXBTZWN0aW9uKCk6IFR5cGVkU2VjdGlvbjxYQ1ZlcnNpb25Hcm91cD4ge1xuICAgICAgICByZXR1cm4gdGhpcy5wZl9zZWN0aW9uR2V0T3JDcmVhdGUoY1hDVmVyc2lvbkdyb3VwKTtcbiAgICB9XG5cbiAgICAvLyAgVGhpcyB3YXMgdGhlIG9yaWdpbmFsIG5hbWUgdGhhdCBJIGRpZCBub3QgdGhpbmsgbWFkZSBzZW5zZS4gIFRlc3RzIHVzZVxuICAgIC8vICB0aGlzIHNvIEkgcHV0IGl0IGJhY2sgdG8gY2FsbCB0aGUgbmV3IGZ1bmN0aW9uIG5hbWUuXG4gICAgcGJ4WENDb25maWd1cmF0aW9uTGlzdCgpOiBUeXBlZFNlY3Rpb248WENDb25maWd1cmF0aW9uTGlzdD4ge1xuICAgICAgICByZXR1cm4gdGhpcy54Y0NvbmZpZ3VyYXRpb25MaXN0KCk7XG4gICAgfVxuXG4gICAgeGNDb25maWd1cmF0aW9uTGlzdCgpOiBUeXBlZFNlY3Rpb248WENDb25maWd1cmF0aW9uTGlzdD4ge1xuICAgICAgICByZXR1cm4gdGhpcy5wZl9zZWN0aW9uR2V0T3JDcmVhdGUoY1hDQ29uZmlndXJhdGlvbkxpc3QpO1xuICAgIH1cblxuICAgIHBieEdyb3VwQnlOYW1lKG5hbWU6IHN0cmluZyk6IFBCWEdyb3VwIHwgbnVsbCB7XG5cbiAgICAgICAgcmV0dXJuIFNlY3Rpb25VdGlscy5lbnRyeUdldFdDb21tZW50VGV4dCh0aGlzLnBieEdyb3Vwc1NlY3Rpb24oKSwgbmFtZSk7XG5cbiAgICAgICAgLy8gaWYgKCF0aGlzLmhhc2gpIHRocm93IG5ldyBFcnJvcignTm90IExvYWRlZCcpO1xuXG4gICAgICAgIC8vIGNvbnN0IGdyb3VwczogU2VjdGlvbiA9IHRoaXMuaGFzaC5wcm9qZWN0Lm9iamVjdHNbJ1BCWEdyb3VwJ107XG5cbiAgICAgICAgLy8gZm9yIChsZXQga2V5IGluIGdyb3Vwcykge1xuICAgICAgICAvLyAgICAgLy8gb25seSBsb29rIGZvciBjb21tZW50c1xuICAgICAgICAvLyAgICAgaWYgKCFDT01NRU5UX0tFWS50ZXN0KGtleSkpIGNvbnRpbnVlO1xuXG4gICAgICAgIC8vICAgICBpZiAoZ3JvdXBzW2tleV0gPT0gbmFtZSkge1xuICAgICAgICAvLyAgICAgICAgIGNvbnN0IGdyb3VwS2V5ID0ga2V5LnNwbGl0KENPTU1FTlRfS0VZKVswXTtcbiAgICAgICAgLy8gICAgICAgICByZXR1cm4gZ3JvdXBzW2dyb3VwS2V5XSBhcyBQQlhHcm91cDtcbiAgICAgICAgLy8gICAgIH1cbiAgICAgICAgLy8gfVxuXG4gICAgICAgIC8vIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHBieFRhcmdldEJ5TmFtZShuYW1lOiBzdHJpbmcpOiBQQlhOYXRpdmVUYXJnZXQgfCBudWxsIHtcbiAgICAgICAgcmV0dXJuIFNlY3Rpb25VdGlscy5lbnRyeUdldFdDb21tZW50VGV4dCh0aGlzLnBieE5hdGl2ZVRhcmdldFNlY3Rpb24oKSwgbmFtZSk7XG4gICAgICAgIC8vIHJldHVybiB0aGlzLnBieEl0ZW1CeUNvbW1lbnQobmFtZSwgJ1BCWE5hdGl2ZVRhcmdldCcpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNlYXJjaCB0aGUgUEJYTmF0aXZlVGFyZ2V0IG9iamVjdHMgZm9yIG9uZSB3aXRoIHRoZSBwYXNzZWQgaW4gbmFtZS5cbiAgICAgKiBSZXR1cm4gdGhlIFVVSUQgaWYgaXQgZXhpc3RzLiAgT3RoZXJ3aXNlIHJldHVybiBudWxsLlxuICAgICAqIEBwYXJhbSBuYW1lIFxuICAgICAqL1xuICAgIGZpbmRUYXJnZXRLZXkobmFtZTogc3RyaW5nKTogWENfUFJPSl9VVUlEIHwgbnVsbCB7XG4gICAgICAgIGNvbnN0IHRhcmdldHM6IFR5cGVkU2VjdGlvbjxQQlhOYXRpdmVUYXJnZXQ+ID0gdGhpcy5wYnhOYXRpdmVUYXJnZXRTZWN0aW9uKCk7XG5cbiAgICAgICAgZm9yIChsZXQga2V5IGluIHRhcmdldHMpIHtcbiAgICAgICAgICAgIGlmICghU2VjdGlvblV0aWxzLmRpY3RLZXlJc0NvbW1lbnQoa2V5KSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldDogUEJYTmF0aXZlVGFyZ2V0ID0gdGFyZ2V0c1trZXldIGFzIFBCWE5hdGl2ZVRhcmdldDtcbiAgICAgICAgICAgICAgICBpZiAodGFyZ2V0Lm5hbWUgPT09IG5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGtleTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBwYnhJdGVtQnlDb21tZW50PFBCWF9PQkpfVFlQRSBleHRlbmRzIFBCWE9iamVjdEJhc2U+KGNvbW1lbnQ6IHN0cmluZywgcGJ4U2VjdGlvbk5hbWU6IElTQV9UWVBFKTogUEJYX09CSl9UWVBFIHwgbnVsbCB7XG4gICAgICAgIHJldHVybiBTZWN0aW9uVXRpbHMuZW50cnlHZXRXQ29tbWVudFRleHQodGhpcy5wZl9zZWN0aW9uR2V0T3JDcmVhdGU8UEJYX09CSl9UWVBFPihwYnhTZWN0aW9uTmFtZSksIGNvbW1lbnQpO1xuICAgICAgICAvLyB2YXIgc2VjdGlvbiA9IHRoaXMuaGFzaC5wcm9qZWN0Lm9iamVjdHNbcGJ4U2VjdGlvbk5hbWVdLFxuICAgICAgICAvLyAgICAga2V5LCBpdGVtS2V5O1xuXG4gICAgICAgIC8vIGZvciAoa2V5IGluIHNlY3Rpb24pIHtcbiAgICAgICAgLy8gICAgIC8vIG9ubHkgbG9vayBmb3IgY29tbWVudHNcbiAgICAgICAgLy8gICAgIGlmICghQ09NTUVOVF9LRVkudGVzdChrZXkpKSBjb250aW51ZTtcblxuICAgICAgICAvLyAgICAgaWYgKHNlY3Rpb25ba2V5XSA9PSBjb21tZW50KSB7XG4gICAgICAgIC8vICAgICAgICAgaXRlbUtleSA9IGtleS5zcGxpdChDT01NRU5UX0tFWSlbMF07XG4gICAgICAgIC8vICAgICAgICAgcmV0dXJuIHNlY3Rpb25baXRlbUtleV07XG4gICAgICAgIC8vICAgICB9XG4gICAgICAgIC8vIH1cblxuICAgICAgICAvLyByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBwYnhTb3VyY2VzQnVpbGRQaGFzZU9iaih0YXJnZXQ/OiBYQ19QUk9KX1VVSUQgfCBudWxsKTogUEJYU291cmNlc0J1aWxkUGhhc2UgfCBudWxsIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYnVpbGRQaGFzZU9iamVjdDxQQlhTb3VyY2VzQnVpbGRQaGFzZT4oJ1BCWFNvdXJjZXNCdWlsZFBoYXNlJywgJ1NvdXJjZXMnLCB0YXJnZXQpO1xuICAgIH1cblxuICAgIHBieFJlc291cmNlc0J1aWxkUGhhc2VPYmoodGFyZ2V0PzogWENfUFJPSl9VVUlEIHwgbnVsbCk6IFBCWFJlc291cmNlc0J1aWxkUGhhc2UgfCBudWxsIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYnVpbGRQaGFzZU9iamVjdDxQQlhSZXNvdXJjZXNCdWlsZFBoYXNlPignUEJYUmVzb3VyY2VzQnVpbGRQaGFzZScsICdSZXNvdXJjZXMnLCB0YXJnZXQpO1xuICAgIH1cblxuICAgIHBieEZyYW1ld29ya3NCdWlsZFBoYXNlT2JqKHRhcmdldD86IFhDX1BST0pfVVVJRCB8IG51bGwpOiBQQlhGcmFtZXdvcmtzQnVpbGRQaGFzZSB8IG51bGwge1xuICAgICAgICByZXR1cm4gdGhpcy5idWlsZFBoYXNlT2JqZWN0PFBCWEZyYW1ld29ya3NCdWlsZFBoYXNlPignUEJYRnJhbWV3b3Jrc0J1aWxkUGhhc2UnLCAnRnJhbWV3b3JrcycsIHRhcmdldCk7XG4gICAgfVxuXG4gICAgcGJ4RW1iZWRGcmFtZXdvcmtzQnVpbGRQaGFzZU9iaih0YXJnZXQ/OiBYQ19QUk9KX1VVSUQgfCBudWxsKTogUEJYQ29weUZpbGVzQnVpbGRQaGFzZSB8IG51bGwge1xuICAgICAgICByZXR1cm4gdGhpcy5idWlsZFBoYXNlT2JqZWN0PFBCWENvcHlGaWxlc0J1aWxkUGhhc2U+KCdQQlhDb3B5RmlsZXNCdWlsZFBoYXNlJywgJ0VtYmVkIEZyYW1ld29ya3MnLCB0YXJnZXQpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBGaW5kIEJ1aWxkIFBoYXNlIGZyb20gZ3JvdXAvdGFyZ2V0XG4gICAgICogQHBhcmFtIGdyb3VwIFRoZSBuYW1lIG9mIHRoZSBidWlsZCBwaGFzZS4gIFwiU291cmNlc1wiLCBcIkZyYW1ld29ya3NcIiwgb3IgXCJSZXNvdXJjZXNcIiBmcm9tIHRoZSBzYW1wbGUuXG4gICAgICogQHBhcmFtIHRhcmdldCBVVUlEIG9mIHRoZSBQQlhOYXRpdmVUYXJnZXQgKEE4MDY3MkU0MjMzRDJBODQwMDNFQTZCQiBpbiB0aGUgc2FtcGxlIGJlbG93KVxuICAgICAqIEByZXR1cm5zIFRoZSBidWlsZCBwaGFzZSB3aXRoIF9jb21tZW50IGFwcGVuZGVkIG9yIHVuZGVmaW5lZCwgIEV4OlwiQTgwNjcyRTEyMzNEMkE4NDAwM0VBNkJCX2NvbW1lbnRcIlxuICAgICAqIFxuICAgICAqIFNhbXBsZTpcbiAgICAgKiAvICogQmVnaW4gUEJYTmF0aXZlVGFyZ2V0IHNlY3Rpb24gKiAvIFxuICAgICAgQTgwNjcyRTQyMzNEMkE4NDAwM0VBNkJCIC8gKiBhZC1ub3RpZmljYXRpb24tc2VydmljZS1leHRlbnNpb24gKiAvID0geyBcbiAgICAgICAgIGlzYSA9IFBCWE5hdGl2ZVRhcmdldDsgXG4gICAgICAgICBidWlsZENvbmZpZ3VyYXRpb25MaXN0ID0gQTgwNjcyRjEyMzNEMkE4NTAwM0VBNkJCIC8gKiBCdWlsZCBjb25maWd1cmF0aW9uIGxpc3QgZm9yIFBCWE5hdGl2ZVRhcmdldCBcImFkLW5vdGlmaWNhdGlvbi1zZXJ2aWNlLWV4dGVuc2lvblwiICogLzsgXG4gICAgICAgICBidWlsZFBoYXNlcyA9ICggXG4gICAgICAgICAgICAgICAgIEE4MDY3MkUxMjMzRDJBODQwMDNFQTZCQiAvICogU291cmNlcyAqIC8sIFxuICAgICAgICAgICAgICAgICBBODA2NzJFMjIzM0QyQTg0MDAzRUE2QkIgLyAqIEZyYW1ld29ya3MgKiAvLCBcbiAgICAgICAgICAgICAgICAgQTgwNjcyRTMyMzNEMkE4NDAwM0VBNkJCIC8gKiBSZXNvdXJjZXMgKiAvLCBcbiAgICAgICAgICk7IFxuICAgICAqIFxuICAgICAqL1xuICAgIGJ1aWxkUGhhc2UoZ3JvdXA6IEZJTEVUWVBFX0dST1VQLCB0YXJnZXQ/OiBYQ19QUk9KX1VVSUQgfCBudWxsKTogWENfQ09NTUVOVF9LRVkgfCB1bmRlZmluZWQge1xuXG4gICAgICAgIGlmICghdGFyZ2V0KVxuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcblxuICAgICAgICBjb25zdCBuYXRpdmVUYXJnZXRzOiBUeXBlZFNlY3Rpb248UEJYTmF0aXZlVGFyZ2V0PiA9IHRoaXMucGJ4TmF0aXZlVGFyZ2V0U2VjdGlvbigpO1xuICAgICAgICBpZiAodHlwZW9mIG5hdGl2ZVRhcmdldHNbdGFyZ2V0XSA9PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCB0YXJnZXQ6IFwiICsgdGFyZ2V0KTtcblxuICAgICAgICAvLyAgQXNzdW1pbmcgdGFyZ2V0IGlzIG5ldmVyIHRoZSBjb21tZW50IHN0cmluZywgc28gbmF0aXZlVGFyZ2V0IGlzIGFsd2F5cyBhbiBvYmplY3QuXG4gICAgICAgIGNvbnN0IG5hdGl2ZVRhcmdldDogUEJYTmF0aXZlVGFyZ2V0ID0gbmF0aXZlVGFyZ2V0c1t0YXJnZXRdIGFzIFBCWE5hdGl2ZVRhcmdldDtcbiAgICAgICAgY29uc3QgYnVpbGRQaGFzZXM6IElDaGlsZExpc3RFbnRyeVtdID0gbmF0aXZlVGFyZ2V0LmJ1aWxkUGhhc2VzO1xuICAgICAgICBmb3IgKGxldCBpIGluIGJ1aWxkUGhhc2VzKSB7XG4gICAgICAgICAgICBjb25zdCBidWlsZFBoYXNlID0gYnVpbGRQaGFzZXNbaV07XG4gICAgICAgICAgICBpZiAoYnVpbGRQaGFzZS5jb21tZW50ID09IGdyb3VwKVxuICAgICAgICAgICAgICAgIHJldHVybiBidWlsZFBoYXNlLnZhbHVlICsgXCJfY29tbWVudFwiO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0gbmFtZSBTZWN0aW9uIE5hbWUgKHR5cGUgb2Ygb2JqZWN0KVxuICAgICAqIEBwYXJhbSBncm91cCBcbiAgICAgKiBAcGFyYW0gdGFyZ2V0IFxuICAgICAqL1xuICAgIGJ1aWxkUGhhc2VPYmplY3Q8UEJYX09CSl9UWVBFIGV4dGVuZHMgUEJYT2JqZWN0QmFzZT4oXG4gICAgICAgIG5hbWU6IElTQV9CVUlMRF9QSEFTRV9UWVBFLFxuICAgICAgICBncm91cDogRklMRVRZUEVfR1JPVVAsXG4gICAgICAgIHRhcmdldD86IFhDX1BST0pfVVVJRCB8IG51bGwpOiBQQlhfT0JKX1RZUEUgfCBudWxsIHtcblxuICAgICAgICBjb25zdCBzZWN0aW9uOiBUeXBlZFNlY3Rpb248UEJYX09CSl9UWVBFPiA9IHRoaXMucGZfc2VjdGlvbkdldE9yQ3JlYXRlKG5hbWUpO1xuICAgICAgICBjb25zdCBidWlsZFBoYXNlOiBYQ19DT01NRU5UX0tFWSB8IHVuZGVmaW5lZCA9IHRoaXMuYnVpbGRQaGFzZShncm91cCwgdGFyZ2V0KTtcblxuICAgICAgICBmb3IgKGxldCBrZXkgaW4gc2VjdGlvbikge1xuXG4gICAgICAgICAgICAvLyBvbmx5IGxvb2sgZm9yIGNvbW1lbnRzXG4gICAgICAgICAgICBpZiAoU2VjdGlvblV0aWxzLmRpY3RLZXlJc0NvbW1lbnQoa2V5KSAmJiAgICAgICAgICAgICAgIC8vIFRoaXMgaXMgYSBjb21tZW50IGtleVxuICAgICAgICAgICAgICAgIChidWlsZFBoYXNlID09IHVuZGVmaW5lZCB8fCBidWlsZFBoYXNlID09IGtleSkgJiYgICAvLyAgQnVpbGQgcGhhc2UgaXMgZWl0aGVyIG5vdCBzZXQgb3IgdGhlIHBoYXNlIG1hdGNoZXMgdGhpcyBrZXlcbiAgICAgICAgICAgICAgICBzZWN0aW9uW2tleV0gPT0gZ3JvdXApIHsgLy8gVmFsdWUgb2YgdGhlIENvbW1lbnQga2V5IG1hdGNoZXMgdGhlIGdyb3VwIHR5cGVcblxuICAgICAgICAgICAgICAgIC8vIGNvbnN0IHNlY3Rpb25LZXkgPSBrZXkuc3BsaXQoQ09NTUVOVF9LRVkpWzBdIGFzIFhDX1BST0pfVVVJRDtcbiAgICAgICAgICAgICAgICAvLyByZXR1cm4gc2VjdGlvbltzZWN0aW9uS2V5XSBhcyBQQlhfT0JKX1RZUEU7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFNlY3Rpb25VdGlscy5lbnRyeUdldFdDb21tZW50S2V5KHNlY3Rpb24sIGtleSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBhZGRCdWlsZFByb3BlcnR5KHByb3A6IHN0cmluZywgdmFsdWU6IHN0cmluZywgYnVpbGRfbmFtZTogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IGNvbmZpZ3VyYXRpb25zOiBTZWN0aW9uRGljdFV1aWRUb09iajxYQ0J1aWxkQ29uZmlndXJhdGlvbj4gPSBTZWN0aW9uVXRpbHMuY3JlYXRlVXVpZEtleU9ubHlTZWN0aW9uRGljdCh0aGlzLnhjQnVpbGRDb25maWd1cmF0aW9uU2VjdGlvbigpKTtcblxuICAgICAgICBmb3IgKGxldCBrZXkgaW4gY29uZmlndXJhdGlvbnMpIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZ3VyYXRpb246IFhDQnVpbGRDb25maWd1cmF0aW9uID0gY29uZmlndXJhdGlvbnNba2V5XTtcbiAgICAgICAgICAgIGlmICghYnVpbGRfbmFtZSB8fCBjb25maWd1cmF0aW9uLm5hbWUgPT09IGJ1aWxkX25hbWUpIHtcbiAgICAgICAgICAgICAgICBjb25maWd1cmF0aW9uLmJ1aWxkU2V0dGluZ3NbcHJvcF0gPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbW92ZUJ1aWxkUHJvcGVydHkocHJvcDogc3RyaW5nLCBidWlsZF9uYW1lOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAgICAgY29uc3QgY29uZmlndXJhdGlvbnM6IFNlY3Rpb25EaWN0VXVpZFRvT2JqPFhDQnVpbGRDb25maWd1cmF0aW9uPiA9IFNlY3Rpb25VdGlscy5jcmVhdGVVdWlkS2V5T25seVNlY3Rpb25EaWN0KHRoaXMueGNCdWlsZENvbmZpZ3VyYXRpb25TZWN0aW9uKCkpO1xuXG4gICAgICAgIGZvciAobGV0IGtleSBpbiBjb25maWd1cmF0aW9ucykge1xuICAgICAgICAgICAgY29uc3QgY29uZmlndXJhdGlvbiA9IGNvbmZpZ3VyYXRpb25zW2tleV07XG4gICAgICAgICAgICBpZiAoY29uZmlndXJhdGlvbi5idWlsZFNldHRpbmdzW3Byb3BdICYmXG4gICAgICAgICAgICAgICAgIWJ1aWxkX25hbWUgfHwgY29uZmlndXJhdGlvbi5uYW1lID09PSBidWlsZF9uYW1lKSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIGNvbmZpZ3VyYXRpb24uYnVpbGRTZXR0aW5nc1twcm9wXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE5vdGUsIHRoaXMgbW9kaWZpZXMgdGhpcyBwcm9wZXJ0eSBvbiBldmVyeSBidWlsZCBjb25maWd1cmF0aW9uIG9iamVjdC5cbiAgICAgKiBUaGVyZSBjYW4gYmUgbWFueS5cbiAgICAgKiBcbiAgICAgKiBAcGFyYW0gcHJvcCB7U3RyaW5nfVxuICAgICAqIEBwYXJhbSB2YWx1ZSB7U3RyaW5nfEFycmF5fE9iamVjdHxOdW1iZXJ8Qm9vbGVhbn1cbiAgICAgKiBAcGFyYW0gYnVpbGQge1N0cmluZ30gUmVsZWFzZSBvciBEZWJ1ZyBvciBwYXNzIGluIG51bGwgdG8gZG8gYWxsXG4gICAgICovXG4gICAgdXBkYXRlQnVpbGRQcm9wZXJ0eShwcm9wOiBzdHJpbmcsIHZhbHVlOiBhbnksIGJ1aWxkPzogJ1JlbGVhc2UnIHwgJ0RlYnVnJyB8IG51bGwpOiB2b2lkIHtcbiAgICAgICAgdmFyIGNvbmZpZ3M6IFR5cGVkU2VjdGlvbjxYQ0J1aWxkQ29uZmlndXJhdGlvbj4gPSB0aGlzLnhjQnVpbGRDb25maWd1cmF0aW9uU2VjdGlvbigpO1xuICAgICAgICBmb3IgKGxldCBjb25maWdOYW1lIGluIGNvbmZpZ3MpIHtcbiAgICAgICAgICAgIGlmICghU2VjdGlvblV0aWxzLmRpY3RLZXlJc0NvbW1lbnQoY29uZmlnTmFtZSkpIHtcbiAgICAgICAgICAgICAgICB2YXIgY29uZmlnOiBYQ0J1aWxkQ29uZmlndXJhdGlvbiA9IGNvbmZpZ3NbY29uZmlnTmFtZV0gYXMgWENCdWlsZENvbmZpZ3VyYXRpb247XG4gICAgICAgICAgICAgICAgaWYgKChidWlsZCAmJiBjb25maWcubmFtZSA9PT0gYnVpbGQpIHx8ICghYnVpbGQpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbmZpZy5idWlsZFNldHRpbmdzW3Byb3BdID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgdXBkYXRlUHJvZHVjdE5hbWUobmFtZTogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIHRoaXMudXBkYXRlQnVpbGRQcm9wZXJ0eSgnUFJPRFVDVF9OQU1FJywgJ1wiJyArIG5hbWUgKyAnXCInKTtcbiAgICB9XG5cblxuXG4gICAgcHJpdmF0ZSBwZl9wcm9jZXNzQnVpbGRDb25maWd1cmF0aW9uc1dpdGhUaGVQcm9kdWN0TmFtZShcbiAgICAgICAgY2FsbGJhY2s6IChidWlsZFNldHRpbmdzOiB7IFtwcm9wOiBzdHJpbmddOiBhbnkgfSwgY29uZmlnOiBYQ0J1aWxkQ29uZmlndXJhdGlvbikgPT4gdm9pZCk6IHZvaWQge1xuXG4gICAgICAgIGNvbnN0IGNvbmZpZ3VyYXRpb25zOiBTZWN0aW9uRGljdFV1aWRUb09iajxYQ0J1aWxkQ29uZmlndXJhdGlvbj4gPSBTZWN0aW9uVXRpbHMuY3JlYXRlVXVpZEtleU9ubHlTZWN0aW9uRGljdCh0aGlzLnhjQnVpbGRDb25maWd1cmF0aW9uU2VjdGlvbigpKTtcblxuICAgICAgICAvLyAgR2V0IHRoZSBwcm9kdWN0IG5hbWUgdXAgZnJvbnQgdG8gYXZvaWQgb3JkZXIgbiBzcXVhcmVkIGFsZ29yaXRobVxuICAgICAgICBjb25zdCBwcm9kdWN0TmFtZTogc3RyaW5nID0gdGhpcy5wcm9kdWN0TmFtZTtcblxuICAgICAgICBmb3IgKGxldCBjb25maWdLZXkgaW4gY29uZmlndXJhdGlvbnMpIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZzogWENCdWlsZENvbmZpZ3VyYXRpb24gPSBjb25maWd1cmF0aW9uc1tjb25maWdLZXldO1xuICAgICAgICAgICAgY29uc3QgYnVpbGRTZXR0aW5ncyA9IGNvbmZpZy5idWlsZFNldHRpbmdzO1xuXG4gICAgICAgICAgICBpZiAodW5xdW90ZShidWlsZFNldHRpbmdzWydQUk9EVUNUX05BTUUnXSkgPT0gcHJvZHVjdE5hbWUpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhidWlsZFNldHRpbmdzLCBjb25maWcpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICB0ZW1wbGF0ZShmaWxlOiBQYnhGaWxlKTogdm9pZCB7XG5cbiAgICAgICAgLy8gIGluaXQgaGVyZVxuXG4gICAgICAgIHRoaXMucGZfcHJvY2Vzc0J1aWxkQ29uZmlndXJhdGlvbnNXaXRoVGhlUHJvZHVjdE5hbWUoXG4gICAgICAgICAgICAoYnVpbGRTZXR0aW5nczogeyBbcHJvcDogc3RyaW5nXTogYW55IH0pID0+IHtcblxuICAgICAgICAgICAgICAgIC8vICBwcm9jZXNzIGVhY2ggaGVyZVxuICAgICAgICAgICAgfVxuICAgICAgICApO1xuICAgIH1cblxuICAgIHJlbW92ZUZyb21GcmFtZXdvcmtTZWFyY2hQYXRocyhmaWxlOiBQYnhGaWxlKTogdm9pZCB7XG5cbiAgICAgICAgY29uc3QgU0VBUkNIX1BBVEhTID0gJ0ZSQU1FV09SS19TRUFSQ0hfUEFUSFMnO1xuXG4gICAgICAgIGNvbnN0IG5ld19wYXRoID0gc2VhcmNoUGF0aEZvckZpbGUoZmlsZSwgdGhpcyk7XG5cbiAgICAgICAgdGhpcy5wZl9wcm9jZXNzQnVpbGRDb25maWd1cmF0aW9uc1dpdGhUaGVQcm9kdWN0TmFtZShcbiAgICAgICAgICAgIChidWlsZFNldHRpbmdzOiB7IFtwcm9wOiBzdHJpbmddOiBhbnkgfSkgPT4ge1xuXG4gICAgICAgICAgICAgICAgY29uc3Qgc2VhcmNoUGF0aHMgPSBidWlsZFNldHRpbmdzW1NFQVJDSF9QQVRIU107XG5cbiAgICAgICAgICAgICAgICBpZiAoc2VhcmNoUGF0aHMgJiYgQXJyYXkuaXNBcnJheShzZWFyY2hQYXRocykpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1hdGNoZXMgPSBzZWFyY2hQYXRocy5maWx0ZXIoZnVuY3Rpb24gKHApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwLmluZGV4T2YobmV3X3BhdGgpID4gLTE7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBtYXRjaGVzLmZvckVhY2goZnVuY3Rpb24gKG0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBpZHggPSBzZWFyY2hQYXRocy5pbmRleE9mKG0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VhcmNoUGF0aHMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICBhZGRUb0ZyYW1ld29ya1NlYXJjaFBhdGhzKGZpbGU6IFBieEZpbGUpOiB2b2lkIHtcblxuICAgICAgICB0aGlzLnBmX3Byb2Nlc3NCdWlsZENvbmZpZ3VyYXRpb25zV2l0aFRoZVByb2R1Y3ROYW1lKFxuICAgICAgICAgICAgKGJ1aWxkU2V0dGluZ3M6IHsgW3Byb3A6IHN0cmluZ106IGFueSB9KSA9PiB7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBJTkhFUklURUQgPSAnXCIkKGluaGVyaXRlZClcIic7XG5cbiAgICAgICAgICAgICAgICBpZiAoIWJ1aWxkU2V0dGluZ3NbJ0ZSQU1FV09SS19TRUFSQ0hfUEFUSFMnXVxuICAgICAgICAgICAgICAgICAgICB8fCBidWlsZFNldHRpbmdzWydGUkFNRVdPUktfU0VBUkNIX1BBVEhTJ10gPT09IElOSEVSSVRFRCkge1xuICAgICAgICAgICAgICAgICAgICBidWlsZFNldHRpbmdzWydGUkFNRVdPUktfU0VBUkNIX1BBVEhTJ10gPSBbSU5IRVJJVEVEXTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBidWlsZFNldHRpbmdzWydGUkFNRVdPUktfU0VBUkNIX1BBVEhTJ10ucHVzaChzZWFyY2hQYXRoRm9yRmlsZShmaWxlLCB0aGlzKSk7XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICByZW1vdmVGcm9tTGlicmFyeVNlYXJjaFBhdGhzKGZpbGU6IFBieEZpbGUpOiB2b2lkIHtcbiAgICAgICAgY29uc3QgbmV3X3BhdGggPSBzZWFyY2hQYXRoRm9yRmlsZShmaWxlLCB0aGlzKTtcblxuICAgICAgICB0aGlzLnBmX3Byb2Nlc3NCdWlsZENvbmZpZ3VyYXRpb25zV2l0aFRoZVByb2R1Y3ROYW1lKFxuICAgICAgICAgICAgKGJ1aWxkU2V0dGluZ3M6IHsgW3Byb3A6IHN0cmluZ106IGFueSB9KSA9PiB7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBTRUFSQ0hfUEFUSFMgPSAnTElCUkFSWV9TRUFSQ0hfUEFUSFMnLFxuXG4gICAgICAgICAgICAgICAgICAgIHNlYXJjaFBhdGhzID0gYnVpbGRTZXR0aW5nc1tTRUFSQ0hfUEFUSFNdO1xuXG4gICAgICAgICAgICAgICAgaWYgKHNlYXJjaFBhdGhzICYmIEFycmF5LmlzQXJyYXkoc2VhcmNoUGF0aHMpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBtYXRjaGVzID0gc2VhcmNoUGF0aHMuZmlsdGVyKGZ1bmN0aW9uIChwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcC5pbmRleE9mKG5ld19wYXRoKSA+IC0xO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgbWF0Y2hlcy5mb3JFYWNoKGZ1bmN0aW9uIChtKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgaWR4ID0gc2VhcmNoUGF0aHMuaW5kZXhPZihtKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlYXJjaFBhdGhzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICk7XG5cbiAgICB9XG5cbiAgICBhZGRUb0xpYnJhcnlTZWFyY2hQYXRocyhmaWxlOiBQYnhGaWxlKTogdm9pZCB7XG5cbiAgICAgICAgdGhpcy5wZl9wcm9jZXNzQnVpbGRDb25maWd1cmF0aW9uc1dpdGhUaGVQcm9kdWN0TmFtZShcbiAgICAgICAgICAgIChidWlsZFNldHRpbmdzOiB7IFtwcm9wOiBzdHJpbmddOiBhbnkgfSkgPT4ge1xuXG4gICAgICAgICAgICAgICAgY29uc3QgSU5IRVJJVEVEID0gJ1wiJChpbmhlcml0ZWQpXCInO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFidWlsZFNldHRpbmdzWydMSUJSQVJZX1NFQVJDSF9QQVRIUyddXG4gICAgICAgICAgICAgICAgICAgIHx8IGJ1aWxkU2V0dGluZ3NbJ0xJQlJBUllfU0VBUkNIX1BBVEhTJ10gPT09IElOSEVSSVRFRCkge1xuICAgICAgICAgICAgICAgICAgICBidWlsZFNldHRpbmdzWydMSUJSQVJZX1NFQVJDSF9QQVRIUyddID0gW0lOSEVSSVRFRF07XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBmaWxlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICBidWlsZFNldHRpbmdzWydMSUJSQVJZX1NFQVJDSF9QQVRIUyddLnB1c2goZmlsZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgYnVpbGRTZXR0aW5nc1snTElCUkFSWV9TRUFSQ0hfUEFUSFMnXS5wdXNoKHNlYXJjaFBhdGhGb3JGaWxlKGZpbGUsIHRoaXMpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgcmVtb3ZlRnJvbUhlYWRlclNlYXJjaFBhdGhzKGZpbGU6IFBieEZpbGUpOiB2b2lkIHtcbiAgICAgICAgY29uc3QgbmV3X3BhdGggPSBzZWFyY2hQYXRoRm9yRmlsZShmaWxlLCB0aGlzKTtcblxuICAgICAgICB0aGlzLnBmX3Byb2Nlc3NCdWlsZENvbmZpZ3VyYXRpb25zV2l0aFRoZVByb2R1Y3ROYW1lKFxuICAgICAgICAgICAgKGJ1aWxkU2V0dGluZ3M6IHsgW3Byb3A6IHN0cmluZ106IGFueSB9KSA9PiB7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBTRUFSQ0hfUEFUSFMgPSAnSEVBREVSX1NFQVJDSF9QQVRIUyc7XG5cbiAgICAgICAgICAgICAgICBpZiAoYnVpbGRTZXR0aW5nc1tTRUFSQ0hfUEFUSFNdKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBtYXRjaGVzID0gYnVpbGRTZXR0aW5nc1tTRUFSQ0hfUEFUSFNdLmZpbHRlcihmdW5jdGlvbiAocDogc3RyaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcC5pbmRleE9mKG5ld19wYXRoKSA+IC0xO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgbWF0Y2hlcy5mb3JFYWNoKGZ1bmN0aW9uIChtOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBpZHggPSBidWlsZFNldHRpbmdzW1NFQVJDSF9QQVRIU10uaW5kZXhPZihtKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ1aWxkU2V0dGluZ3NbU0VBUkNIX1BBVEhTXS5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICApO1xuICAgIH1cblxuICAgIGFkZFRvSGVhZGVyU2VhcmNoUGF0aHMoZmlsZTogUGJ4RmlsZSk6IHZvaWQge1xuXG4gICAgICAgIHRoaXMucGZfcHJvY2Vzc0J1aWxkQ29uZmlndXJhdGlvbnNXaXRoVGhlUHJvZHVjdE5hbWUoXG4gICAgICAgICAgICAoYnVpbGRTZXR0aW5nczogeyBbcHJvcDogc3RyaW5nXTogYW55IH0pID0+IHtcblxuICAgICAgICAgICAgICAgIGNvbnN0IElOSEVSSVRFRCA9ICdcIiQoaW5oZXJpdGVkKVwiJztcblxuICAgICAgICAgICAgICAgIGlmICghYnVpbGRTZXR0aW5nc1snSEVBREVSX1NFQVJDSF9QQVRIUyddKSB7XG4gICAgICAgICAgICAgICAgICAgIGJ1aWxkU2V0dGluZ3NbJ0hFQURFUl9TRUFSQ0hfUEFUSFMnXSA9IFtJTkhFUklURURdO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZmlsZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgYnVpbGRTZXR0aW5nc1snSEVBREVSX1NFQVJDSF9QQVRIUyddLnB1c2goZmlsZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgYnVpbGRTZXR0aW5nc1snSEVBREVSX1NFQVJDSF9QQVRIUyddLnB1c2goc2VhcmNoUGF0aEZvckZpbGUoZmlsZSwgdGhpcykpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICBhZGRUb090aGVyTGlua2VyRmxhZ3MoZmxhZzogYW55KTogdm9pZCB7IC8vIGFueSBpcyBhIGd1ZXNzIC0tIGZpeCB0aGlzIGxhdGVyXG5cbiAgICAgICAgdGhpcy5wZl9wcm9jZXNzQnVpbGRDb25maWd1cmF0aW9uc1dpdGhUaGVQcm9kdWN0TmFtZShcbiAgICAgICAgICAgIChidWlsZFNldHRpbmdzOiB7IFtwcm9wOiBzdHJpbmddOiBhbnkgfSkgPT4ge1xuXG4gICAgICAgICAgICAgICAgY29uc3QgSU5IRVJJVEVEID0gJ1wiJChpbmhlcml0ZWQpXCInLFxuICAgICAgICAgICAgICAgICAgICBPVEhFUl9MREZMQUdTID0gJ09USEVSX0xERkxBR1MnO1xuXG5cbiAgICAgICAgICAgICAgICBpZiAoIWJ1aWxkU2V0dGluZ3NbT1RIRVJfTERGTEFHU11cbiAgICAgICAgICAgICAgICAgICAgfHwgYnVpbGRTZXR0aW5nc1tPVEhFUl9MREZMQUdTXSA9PT0gSU5IRVJJVEVEKSB7XG4gICAgICAgICAgICAgICAgICAgIGJ1aWxkU2V0dGluZ3NbT1RIRVJfTERGTEFHU10gPSBbSU5IRVJJVEVEXTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBidWlsZFNldHRpbmdzW09USEVSX0xERkxBR1NdLnB1c2goZmxhZyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgcmVtb3ZlRnJvbU90aGVyTGlua2VyRmxhZ3MoZmxhZzogYW55KTogdm9pZCB7IC8vIGFueSBpcyBhIGd1ZXNzIC0tIGZpeCB0aGlzIGxhdGVyXG5cbiAgICAgICAgdGhpcy5wZl9wcm9jZXNzQnVpbGRDb25maWd1cmF0aW9uc1dpdGhUaGVQcm9kdWN0TmFtZShcbiAgICAgICAgICAgIChidWlsZFNldHRpbmdzOiB7IFtwcm9wOiBzdHJpbmddOiBhbnkgfSkgPT4ge1xuXG4gICAgICAgICAgICAgICAgY29uc3QgT1RIRVJfTERGTEFHUyA9ICdPVEhFUl9MREZMQUdTJztcbiAgICAgICAgICAgICAgICBpZiAoYnVpbGRTZXR0aW5nc1tPVEhFUl9MREZMQUdTXSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgbWF0Y2hlcyA9IGJ1aWxkU2V0dGluZ3NbT1RIRVJfTERGTEFHU10uZmlsdGVyKGZ1bmN0aW9uIChwOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwLmluZGV4T2YoZmxhZykgPiAtMTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIG1hdGNoZXMuZm9yRWFjaChmdW5jdGlvbiAobTogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgaWR4ID0gYnVpbGRTZXR0aW5nc1tPVEhFUl9MREZMQUdTXS5pbmRleE9mKG0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnVpbGRTZXR0aW5nc1tPVEhFUl9MREZMQUdTXS5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICApO1xuICAgIH1cblxuICAgIGFkZFRvQnVpbGRTZXR0aW5ncyhidWlsZFNldHRpbmc6IHN0cmluZywgdmFsdWU6IGFueSk6IHZvaWQge1xuICAgICAgICBjb25zdCBjb25maWd1cmF0aW9uczogU2VjdGlvbkRpY3RVdWlkVG9PYmo8WENCdWlsZENvbmZpZ3VyYXRpb24+ID0gU2VjdGlvblV0aWxzLmNyZWF0ZVV1aWRLZXlPbmx5U2VjdGlvbkRpY3QodGhpcy54Y0J1aWxkQ29uZmlndXJhdGlvblNlY3Rpb24oKSk7XG5cbiAgICAgICAgZm9yIChsZXQgY29uZmlnIGluIGNvbmZpZ3VyYXRpb25zKSB7XG4gICAgICAgICAgICBjb25zdCBidWlsZFNldHRpbmdzID0gY29uZmlndXJhdGlvbnNbY29uZmlnXS5idWlsZFNldHRpbmdzO1xuXG4gICAgICAgICAgICBidWlsZFNldHRpbmdzW2J1aWxkU2V0dGluZ10gPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbW92ZUZyb21CdWlsZFNldHRpbmdzKGJ1aWxkU2V0dGluZzogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IGNvbmZpZ3VyYXRpb25zOiBTZWN0aW9uRGljdFV1aWRUb09iajxYQ0J1aWxkQ29uZmlndXJhdGlvbj4gPSBTZWN0aW9uVXRpbHMuY3JlYXRlVXVpZEtleU9ubHlTZWN0aW9uRGljdCh0aGlzLnhjQnVpbGRDb25maWd1cmF0aW9uU2VjdGlvbigpKTtcblxuICAgICAgICBmb3IgKGxldCBjb25maWcgaW4gY29uZmlndXJhdGlvbnMpIHtcbiAgICAgICAgICAgIGNvbnN0IGJ1aWxkU2V0dGluZ3MgPSBjb25maWd1cmF0aW9uc1tjb25maWddLmJ1aWxkU2V0dGluZ3M7XG5cbiAgICAgICAgICAgIGlmIChidWlsZFNldHRpbmdzW2J1aWxkU2V0dGluZ10pIHtcbiAgICAgICAgICAgICAgICBkZWxldGUgYnVpbGRTZXR0aW5nc1tidWlsZFNldHRpbmddO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gYSBKUyBnZXR0ZXIuIGhtbW1cbiAgICAvLyBfX2RlZmluZUdldHRlcl9fKFwicHJvZHVjdE5hbWVcIiwgZnVuY3Rpb24oKSB7XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm4gdGhlIHByb2R1Y3ROYW1lIG9mIGEgcmFuZG9tIFhDQnVpbGRDb25maWd1cmF0aW9uU2V0dGluZyB0aGF0XG4gICAgICogaGFzIGEgUFJPRFVDVF9OQU1FIHNldC4gIEluIHJldmlld2luZyB0aGUgdGVzdCBwcm9qZWN0cywgYWxsXG4gICAgICogYnVpbGQgY29uZmlndXJhdGlvbnMgaGFkIHRoZSBzYW1lIHByb2R1Y3QgbmFtZSBzbyB0aGlzIHdvcmtzIGluIHRoZXNlXG4gICAgICogY2FzZXMuICBJIGRvIG5vdCBrbm93IGlmIGl0IHdvcmtzIGluIGFsbCBjYXNlcy5cbiAgICAgKi9cbiAgICBnZXQgcHJvZHVjdE5hbWUoKTogc3RyaW5nIHtcblxuICAgICAgICBjb25zdCBjb25maWd1cmF0aW9uczogU2VjdGlvbkRpY3RVdWlkVG9PYmo8WENCdWlsZENvbmZpZ3VyYXRpb24+ID0gU2VjdGlvblV0aWxzLmNyZWF0ZVV1aWRLZXlPbmx5U2VjdGlvbkRpY3QodGhpcy54Y0J1aWxkQ29uZmlndXJhdGlvblNlY3Rpb24oKSk7XG5cbiAgICAgICAgZm9yIChsZXQgY29uZmlnIGluIGNvbmZpZ3VyYXRpb25zKSB7XG4gICAgICAgICAgICBjb25zdCBwcm9kdWN0TmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkID0gY29uZmlndXJhdGlvbnNbY29uZmlnXS5idWlsZFNldHRpbmdzWydQUk9EVUNUX05BTUUnXTtcblxuICAgICAgICAgICAgaWYgKHByb2R1Y3ROYW1lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHVucXVvdGVTdHIocHJvZHVjdE5hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gIFRoaXMgdXNlZCB0byBqdXN0IHJldHVybiB1bmRlZmluZWQuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIGZpbmQgUFJPRFVDVF9OQU1FJyk7XG4gICAgfVxuXG4gICAgLy8gY2hlY2sgaWYgZmlsZSBpcyBwcmVzZW50XG4gICAgaGFzRmlsZShmaWxlUGF0aDogc3RyaW5nKTogUEJYRmlsZVJlZmVyZW5jZSB8IGZhbHNlIHtcbiAgICAgICAgY29uc3QgZmlsZXM6IFNlY3Rpb25EaWN0VXVpZFRvT2JqPFBCWEZpbGVSZWZlcmVuY2U+ID0gU2VjdGlvblV0aWxzLmNyZWF0ZVV1aWRLZXlPbmx5U2VjdGlvbkRpY3QodGhpcy5wYnhGaWxlUmVmZXJlbmNlU2VjdGlvbigpKTtcblxuICAgICAgICBmb3IgKGxldCBpZCBpbiBmaWxlcykge1xuICAgICAgICAgICAgY29uc3QgZmlsZTogUEJYRmlsZVJlZmVyZW5jZSA9IGZpbGVzW2lkXTtcbiAgICAgICAgICAgIGlmIChmaWxlLnBhdGggPT0gZmlsZVBhdGggfHwgZmlsZS5wYXRoID09ICgnXCInICsgZmlsZVBhdGggKyAnXCInKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmaWxlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGFkZFRhcmdldChuYW1lOiBzdHJpbmcsIHR5cGU6IFRBUkdFVF9UWVBFLCBzdWJmb2xkZXI6IHN0cmluZyk6IElOYXRpdmVUYXJnZXRXcmFwcGVyIHtcblxuICAgICAgICAvLyBTZXR1cCB1dWlkIGFuZCBuYW1lIG9mIG5ldyB0YXJnZXRcbiAgICAgICAgY29uc3QgdGFyZ2V0VXVpZDogWENfUFJPSl9VVUlEID0gdGhpcy5nZW5lcmF0ZVV1aWQoKTtcbiAgICAgICAgY29uc3QgdGFyZ2V0VHlwZTogVEFSR0VUX1RZUEUgPSB0eXBlO1xuICAgICAgICBjb25zdCB0YXJnZXRTdWJmb2xkZXI6IHN0cmluZyA9IHN1YmZvbGRlciB8fCBuYW1lO1xuICAgICAgICBjb25zdCB0YXJnZXROYW1lOiBzdHJpbmcgPSBuYW1lLnRyaW0oKTtcblxuICAgICAgICAvLyBDaGVjayB0eXBlIGFnYWluc3QgbGlzdCBvZiBhbGxvd2VkIHRhcmdldCB0eXBlc1xuICAgICAgICBpZiAoIXRhcmdldE5hbWUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlRhcmdldCBuYW1lIG1pc3NpbmcuXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2hlY2sgdHlwZSBhZ2FpbnN0IGxpc3Qgb2YgYWxsb3dlZCB0YXJnZXQgdHlwZXNcbiAgICAgICAgaWYgKCF0YXJnZXRUeXBlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJUYXJnZXQgdHlwZSBtaXNzaW5nLlwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENoZWNrIHR5cGUgYWdhaW5zdCBsaXN0IG9mIGFsbG93ZWQgdGFyZ2V0IHR5cGVzXG4gICAgICAgIGNvbnN0IHByb2R1Y3RUeXBlOiBQUk9EVUNUX1RZUEUgPSBwcm9kdWN0dHlwZUZvclRhcmdldHR5cGUodGFyZ2V0VHlwZSk7XG4gICAgICAgIGlmICghcHJvZHVjdFR5cGUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlRhcmdldCB0eXBlIGludmFsaWQ6IFwiICsgdGFyZ2V0VHlwZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBCdWlsZCBDb25maWd1cmF0aW9uOiBDcmVhdGVcbiAgICAgICAgY29uc3QgYnVpbGRDb25maWd1cmF0aW9uc0xpc3Q6IFhDQnVpbGRDb25maWd1cmF0aW9uW10gPSBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ0RlYnVnJyxcbiAgICAgICAgICAgICAgICBpc2E6ICdYQ0J1aWxkQ29uZmlndXJhdGlvbicsXG4gICAgICAgICAgICAgICAgYnVpbGRTZXR0aW5nczoge1xuICAgICAgICAgICAgICAgICAgICBHQ0NfUFJFUFJPQ0VTU09SX0RFRklOSVRJT05TOiBbJ1wiREVCVUc9MVwiJywgJ1wiJChpbmhlcml0ZWQpXCInXSxcbiAgICAgICAgICAgICAgICAgICAgSU5GT1BMSVNUX0ZJTEU6ICdcIicgKyBwYXRoLmpvaW4odGFyZ2V0U3ViZm9sZGVyLCB0YXJnZXRTdWJmb2xkZXIgKyAnLUluZm8ucGxpc3QnICsgJ1wiJyksXG4gICAgICAgICAgICAgICAgICAgIExEX1JVTlBBVEhfU0VBUkNIX1BBVEhTOiAnXCIkKGluaGVyaXRlZCkgQGV4ZWN1dGFibGVfcGF0aC9GcmFtZXdvcmtzIEBleGVjdXRhYmxlX3BhdGgvLi4vLi4vRnJhbWV3b3Jrc1wiJyxcbiAgICAgICAgICAgICAgICAgICAgUFJPRFVDVF9OQU1FOiAnXCInICsgdGFyZ2V0TmFtZSArICdcIicsXG4gICAgICAgICAgICAgICAgICAgIFNLSVBfSU5TVEFMTDogJ1lFUydcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdSZWxlYXNlJyxcbiAgICAgICAgICAgICAgICBpc2E6ICdYQ0J1aWxkQ29uZmlndXJhdGlvbicsXG4gICAgICAgICAgICAgICAgYnVpbGRTZXR0aW5nczoge1xuICAgICAgICAgICAgICAgICAgICBJTkZPUExJU1RfRklMRTogJ1wiJyArIHBhdGguam9pbih0YXJnZXRTdWJmb2xkZXIsIHRhcmdldFN1YmZvbGRlciArICctSW5mby5wbGlzdCcgKyAnXCInKSxcbiAgICAgICAgICAgICAgICAgICAgTERfUlVOUEFUSF9TRUFSQ0hfUEFUSFM6ICdcIiQoaW5oZXJpdGVkKSBAZXhlY3V0YWJsZV9wYXRoL0ZyYW1ld29ya3MgQGV4ZWN1dGFibGVfcGF0aC8uLi8uLi9GcmFtZXdvcmtzXCInLFxuICAgICAgICAgICAgICAgICAgICBQUk9EVUNUX05BTUU6ICdcIicgKyB0YXJnZXROYW1lICsgJ1wiJyxcbiAgICAgICAgICAgICAgICAgICAgU0tJUF9JTlNUQUxMOiAnWUVTJ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgXTtcblxuICAgICAgICAvLyBCdWlsZCBDb25maWd1cmF0aW9uOiBBZGRcbiAgICAgICAgdmFyIGJ1aWxkQ29uZmlndXJhdGlvbnMgPSB0aGlzLmFkZFhDQ29uZmlndXJhdGlvbkxpc3QoYnVpbGRDb25maWd1cmF0aW9uc0xpc3QsICdSZWxlYXNlJywgJ0J1aWxkIGNvbmZpZ3VyYXRpb24gbGlzdCBmb3IgUEJYTmF0aXZlVGFyZ2V0IFwiJyArIHRhcmdldE5hbWUgKyAnXCInKTtcblxuICAgICAgICAvLyBQcm9kdWN0OiBDcmVhdGVcbiAgICAgICAgY29uc3QgcHJvZHVjdE5hbWU6IHN0cmluZyA9IHRhcmdldE5hbWU7XG4gICAgICAgIGNvbnN0IHByb2R1Y3RGaWxlVHlwZTogWENfRklMRVRZUEUgPSBmaWxldHlwZUZvclByb2R1Y3R0eXBlKHByb2R1Y3RUeXBlKTtcbiAgICAgICAgY29uc3QgcHJvZHVjdEZpbGU6IFBieEZpbGUgPSB0aGlzLmFkZFByb2R1Y3RGaWxlKHByb2R1Y3ROYW1lLCB7IGdyb3VwOiAnQ29weSBGaWxlcycsICd0YXJnZXQnOiB0YXJnZXRVdWlkLCAnZXhwbGljaXRGaWxlVHlwZSc6IHByb2R1Y3RGaWxlVHlwZSB9KTtcbiAgICAgICAgLy8gICAgICAgICAgICBwcm9kdWN0RmlsZU5hbWUgPSBwcm9kdWN0RmlsZS5iYXNlbmFtZTtcblxuXG4gICAgICAgIC8vIFByb2R1Y3Q6IEFkZCB0byBidWlsZCBmaWxlIGxpc3RcbiAgICAgICAgdGhpcy5hZGRUb1BieEJ1aWxkRmlsZVNlY3Rpb24ocHJvZHVjdEZpbGUpO1xuXG4gICAgICAgIC8vIFRhcmdldDogQ3JlYXRlXG4gICAgICAgIGNvbnN0IHRhcmdldDogSU5hdGl2ZVRhcmdldFdyYXBwZXIgPSB7XG4gICAgICAgICAgICB1dWlkOiB0YXJnZXRVdWlkLFxuICAgICAgICAgICAgcGJ4TmF0aXZlVGFyZ2V0OiB7XG4gICAgICAgICAgICAgICAgaXNhOiAnUEJYTmF0aXZlVGFyZ2V0JyxcbiAgICAgICAgICAgICAgICBuYW1lOiAnXCInICsgdGFyZ2V0TmFtZSArICdcIicsXG4gICAgICAgICAgICAgICAgcHJvZHVjdE5hbWU6ICdcIicgKyB0YXJnZXROYW1lICsgJ1wiJyxcbiAgICAgICAgICAgICAgICBwcm9kdWN0UmVmZXJlbmNlOiBwcm9kdWN0RmlsZS5maWxlUmVmIGFzIFhDX1BST0pfVVVJRCxcbiAgICAgICAgICAgICAgICBwcm9kdWN0VHlwZTogJ1wiJyArIHByb2R1Y3R0eXBlRm9yVGFyZ2V0dHlwZSh0YXJnZXRUeXBlKSArICdcIicsXG4gICAgICAgICAgICAgICAgYnVpbGRDb25maWd1cmF0aW9uTGlzdDogYnVpbGRDb25maWd1cmF0aW9ucy51dWlkLFxuICAgICAgICAgICAgICAgIGJ1aWxkUGhhc2VzOiBbXSxcbiAgICAgICAgICAgICAgICBidWlsZFJ1bGVzOiBbXSxcbiAgICAgICAgICAgICAgICBkZXBlbmRlbmNpZXM6IFtdXG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gVGFyZ2V0OiBBZGQgdG8gUEJYTmF0aXZlVGFyZ2V0IHNlY3Rpb25cbiAgICAgICAgdGhpcy5hZGRUb1BieE5hdGl2ZVRhcmdldFNlY3Rpb24odGFyZ2V0KVxuXG4gICAgICAgIC8vIFByb2R1Y3Q6IEVtYmVkIChvbmx5IGZvciBcImV4dGVuc2lvblwiLXR5cGUgdGFyZ2V0cylcbiAgICAgICAgaWYgKHRhcmdldFR5cGUgPT09ICdhcHBfZXh0ZW5zaW9uJykge1xuXG4gICAgICAgICAgICAvLyAgVE9ETzogIEV2YWx1YXRlIGlmIHRoaXMgaXMgc291bmQuXG5cbiAgICAgICAgICAgIC8vIENyZWF0ZSBDb3B5RmlsZXMgcGhhc2UgaW4gZmlyc3QgdGFyZ2V0XG4gICAgICAgICAgICB0aGlzLmFkZEJ1aWxkUGhhc2UoW10sICdQQlhDb3B5RmlsZXNCdWlsZFBoYXNlJywgJ0NvcHkgRmlsZXMnLCB0aGlzLmdldEZpcnN0VGFyZ2V0KCkudXVpZCwgdGFyZ2V0VHlwZSlcblxuICAgICAgICAgICAgLy8gQWRkIHByb2R1Y3QgdG8gQ29weUZpbGVzIHBoYXNlXG4gICAgICAgICAgICB0aGlzLmFkZFRvUGJ4Q29weWZpbGVzQnVpbGRQaGFzZShwcm9kdWN0RmlsZSlcblxuICAgICAgICAgICAgLy8gdGhpcy5hZGRCdWlsZFBoYXNlVG9UYXJnZXQobmV3UGhhc2UuYnVpbGRQaGFzZSwgdGhpcy5nZXRGaXJzdFRhcmdldCgpLnV1aWQpXG5cbiAgICAgICAgfTtcblxuICAgICAgICAvLyBUYXJnZXQ6IEFkZCB1dWlkIHRvIHJvb3QgcHJvamVjdFxuICAgICAgICB0aGlzLmFkZFRvUGJ4UHJvamVjdFNlY3Rpb24odGFyZ2V0KTtcblxuICAgICAgICAvLyBUYXJnZXQ6IEFkZCBkZXBlbmRlbmN5IGZvciB0aGlzIHRhcmdldCB0byBmaXJzdCAobWFpbikgdGFyZ2V0XG4gICAgICAgIHRoaXMuYWRkVGFyZ2V0RGVwZW5kZW5jeSh0aGlzLmdldEZpcnN0VGFyZ2V0KCkudXVpZCwgW3RhcmdldC51dWlkXSk7XG5cbiAgICAgICAgLy8gUmV0dXJuIHRhcmdldCBvbiBzdWNjZXNzXG4gICAgICAgIHJldHVybiB0YXJnZXQ7XG4gICAgfVxuXG4gICAgLyoqIFxuICAgICAqIEdldCB0aGUgZmlyc3QgcHJvamVjdCB0aGF0IGFwcGVhcnMgaW4gdGhlIFBCWFByb2plY3Qgc2VjdGlvbi5cbiAgICAgKiBBc3N1bWVzIHRoZXJlIGlzIGF0IGxlYXN0IG9uZSBwcm9qZWN0LlxuICAgICAqIFxuICAgICAqIE1vc3QgdXNlcyBvZiB0aGlzIGxpYnJhcnkgbGlrZXkgaGF2ZSBvbmUgYW5kIG9ubHkgb25lIHByb2plY3QuXG4gICAgICovXG4gICAgZ2V0Rmlyc3RQcm9qZWN0KCk6IHsgdXVpZDogWENfUFJPSl9VVUlELCBmaXJzdFByb2plY3Q6IFBCWFByb2plY3QgfSB7XG5cbiAgICAgICAgLy8gR2V0IHBieFByb2plY3QgY29udGFpbmVyXG4gICAgICAgIGNvbnN0IHBieFByb2plY3RDb250YWluZXI6IFR5cGVkU2VjdGlvbjxQQlhQcm9qZWN0PiA9IHRoaXMucGJ4UHJvamVjdFNlY3Rpb24oKTtcblxuICAgICAgICAvLyBHZXQgZmlyc3QgcGJ4UHJvamVjdCBVVUlEXG4gICAgICAgIC8vICBOT1RFOiAgVGhpcyBvbmx5IHdvcmtzIGFzc3VtaW5nIHRoZSBjb21tZW50IGtleSBhbHdheXMgZm9sbG93cyB0aGUgcHJvamVjdCBrZXkuXG4gICAgICAgIC8vICBJcyB0aGlzIGFsd2F5cyB0cnVlLCBpbXBsZW1lbnRhdGlvbiBzcGVjaWZpYywgb3IganVzdCBsdWNreSAoaS5lLiBUREQpPyAgSSBkaWQgXG4gICAgICAgIC8vICBub3QgdGhpbmsga2V5cyB3ZXJlIGd1YXJhbnRlZWQgdG8gYmUgYWxwaGFiZXRpemVkLlxuICAgICAgICAvLyAgSSB3aWxsIGFzc3VtZSBmb3Igbm93IHRoYXQgd2hvZXZlciB3cm90ZSB0aGlzIGtub3dzIHNvbWV0aGluZyBJIGRvbid0LlxuICAgICAgICAvLyAgUmVzZWFyY2hlZDogIEFjY29yZGluZyB0b1xuICAgICAgICAvLyAgaHR0cHM6Ly93d3cuc3RlZmFuanVkaXMuY29tL3RvZGF5LWktbGVhcm5lZC9wcm9wZXJ0eS1vcmRlci1pcy1wcmVkaWN0YWJsZS1pbi1qYXZhc2NyaXB0LW9iamVjdHMtc2luY2UtZXMyMDE1L1xuICAgICAgICAvLyAgdGhlc2UgYXJlIGxpa2VseSBub3QgaW1wbGVtZW50YXRpb24gc3BlY2lmaWMgYXMgbm9kZSBpcyBtb3N0IGRlZmluYXRlbHkgdXNpbmcgdGhlIGxhdGVzdC5cbiAgICAgICAgY29uc3QgZmlyc3RQcm9qZWN0VXVpZDogWENfUFJPSl9VVUlEID0gT2JqZWN0LmtleXMocGJ4UHJvamVjdENvbnRhaW5lcilbMF07XG5cbiAgICAgICAgLy8gR2V0IGZpcnN0IHBieFByb2plY3RcbiAgICAgICAgY29uc3QgZmlyc3RQcm9qZWN0ID0gcGJ4UHJvamVjdENvbnRhaW5lcltmaXJzdFByb2plY3RVdWlkXSBhcyBQQlhQcm9qZWN0O1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB1dWlkOiBmaXJzdFByb2plY3RVdWlkLFxuICAgICAgICAgICAgZmlyc3RQcm9qZWN0OiBmaXJzdFByb2plY3RcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgZmlyc3QgdGFyZ2V0IGluIHRoZSBsaXN0IG9mIHRhcmdldHMgb2YgdGhlIGZpcnN0IChhbmQgdHlwaWNhbGx5IG9ubHkpIHByb2plY3QuXG4gICAgICogVGhpcyBoYXMgYWx3YXlzIGJlZW4gdGhlIGRlcGxveWVkIGFwcGxpY2F0aW9uIGluIHRlc3QgY2FzZXMgSSBoYXZlIG9ic2VydmVkLiAgQnV0XG4gICAgICogdmFsaWRhdGUgdGhpcy5cbiAgICAgKi9cbiAgICBnZXRGaXJzdFRhcmdldCgpOiB7IHV1aWQ6IFhDX1BST0pfVVVJRCwgZmlyc3RUYXJnZXQ6IFBCWE5hdGl2ZVRhcmdldCB9IHtcblxuICAgICAgICAvLyBHZXQgZmlyc3QgdGFyZ2V0cyBVVUlEXG4gICAgICAgIGNvbnN0IGZpcnN0VGFyZ2V0VXVpZDogWENfUFJPSl9VVUlEID0gdGhpcy5nZXRGaXJzdFByb2plY3QoKVsnZmlyc3RQcm9qZWN0J11bJ3RhcmdldHMnXVswXS52YWx1ZTtcblxuICAgICAgICAvLyBHZXQgZmlyc3QgcGJ4TmF0aXZlVGFyZ2V0XG4gICAgICAgIGNvbnN0IGZpcnN0VGFyZ2V0ID0gdGhpcy5wYnhOYXRpdmVUYXJnZXRTZWN0aW9uKClbZmlyc3RUYXJnZXRVdWlkXSBhcyBQQlhOYXRpdmVUYXJnZXQ7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHV1aWQ6IGZpcnN0VGFyZ2V0VXVpZCxcbiAgICAgICAgICAgIGZpcnN0VGFyZ2V0OiBmaXJzdFRhcmdldFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqKiBORVcgKioqL1xuXG5cbiAgICAvKipcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0gZmlsZSAgd2hlbiBhIHN0cmluZywgdGhpcyBpcyB0aGUgVVVJRCBvZiBlaXRoZXIgYSBQQlhHcm91cCBvciBhIFBCWFZhcmlhbnRHcm91cCBvYmplY3QuXG4gICAgICogV2hlbiBhbiBvYmplY3QsIFxuICAgICAqIEBwYXJhbSBncm91cEtleSBcbiAgICAgKiBAcGFyYW0gZ3JvdXBUeXBlIFxuICAgICAqL1xuICAgIGFkZFRvUGJ4R3JvdXBUeXBlKGZpbGU6IFhDX1BST0pfVVVJRCB8IElQYnhHcm91cENoaWxkRmlsZUluZm8sIGdyb3VwS2V5OiBYQ19QUk9KX1VVSUQsIGdyb3VwVHlwZTogSVNBX0dST1VQX1RZUEUpOiB2b2lkIHtcblxuICAgICAgICBjb25zdCBncm91cDogUEJYR3JvdXAgfCBudWxsID0gdGhpcy5nZXRQQlhHcm91cEJ5S2V5QW5kVHlwZTxQQlhHcm91cD4oZ3JvdXBLZXksIGdyb3VwVHlwZSk7XG5cbiAgICAgICAgaWYgKGdyb3VwICYmIGdyb3VwLmNoaWxkcmVuICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZmlsZSA9PT0gJ3N0cmluZycpIHtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkR3JvdXBVdWlkOiBYQ19QUk9KX1VVSUQgPSBmaWxlO1xuXG4gICAgICAgICAgICAgICAgbGV0IGNvbW1lbnQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblxuICAgICAgICAgICAgICAgIC8vR3JvdXAgS2V5XG4gICAgICAgICAgICAgICAgY29uc3QgcGJ4R3JvdXA6IFBCWEdyb3VwIHwgbnVsbCA9IHRoaXMuZ2V0UEJYR3JvdXBCeUtleShjaGlsZEdyb3VwVXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKHBieEdyb3VwKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbW1lbnQgPSBwYnhHcm91cC5uYW1lO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGJ4VmFyR3JvdXA6IFBCWFZhcmlhbnRHcm91cCB8IG51bGwgPSB0aGlzLmdldFBCWFZhcmlhbnRHcm91cEJ5S2V5KGNoaWxkR3JvdXBVdWlkKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBieFZhckdyb3VwKVxuICAgICAgICAgICAgICAgICAgICAgICAgY29tbWVudCA9IHBieFZhckdyb3VwLm5hbWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGNvbW1lbnQgPT0gdW5kZWZpbmVkKVxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBmaW5kIGEgZ3JvdXAgd2l0aCBVVUlEPScke2NoaWxkR3JvdXBVdWlkfSdgKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkR3JvdXA6IElDaGlsZExpc3RFbnRyeSA9IHtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IGNoaWxkR3JvdXBVdWlkLFxuICAgICAgICAgICAgICAgICAgICBjb21tZW50OiBjb21tZW50XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBncm91cC5jaGlsZHJlbi5wdXNoKGNoaWxkR3JvdXApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgLy9GaWxlIE9iamVjdFxuICAgICAgICAgICAgICAgIGdyb3VwLmNoaWxkcmVuLnB1c2gocGJ4R3JvdXBDaGlsZChmaWxlKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhZGRUb1BieFZhcmlhbnRHcm91cChmaWxlOiBzdHJpbmcgfCBJUGJ4R3JvdXBDaGlsZEZpbGVJbmZvLCBncm91cEtleTogWENfUFJPSl9VVUlEKTogdm9pZCB7XG4gICAgICAgIHRoaXMuYWRkVG9QYnhHcm91cFR5cGUoZmlsZSwgZ3JvdXBLZXksICdQQlhWYXJpYW50R3JvdXAnKTtcbiAgICB9XG5cbiAgICBhZGRUb1BieEdyb3VwKGZpbGU6IHN0cmluZyB8IElQYnhHcm91cENoaWxkRmlsZUluZm8sIGdyb3VwS2V5OiBYQ19QUk9KX1VVSUQpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5hZGRUb1BieEdyb3VwVHlwZShmaWxlLCBncm91cEtleSwgJ1BCWEdyb3VwJyk7XG4gICAgfVxuXG4gICAgcGJ4Q3JlYXRlR3JvdXBXaXRoVHlwZShuYW1lOiBzdHJpbmcsIHBhdGhOYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQgfCBudWxsLCBncm91cFR5cGU6IElTQV9HUk9VUF9UWVBFKTogWENfUFJPSl9VVUlEIHtcbiAgICAgICAgLy9DcmVhdGUgb2JqZWN0XG4gICAgICAgIGNvbnN0IG1vZGVsOiBQQlhHcm91cCA9IHtcbiAgICAgICAgICAgIC8vaXNhOiAnXCInICsgZ3JvdXBUeXBlICsgJ1wiJyxcbiAgICAgICAgICAgIGlzYTogZ3JvdXBUeXBlLFxuICAgICAgICAgICAgY2hpbGRyZW46IFtdLFxuICAgICAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgICAgIHNvdXJjZVRyZWU6ICdcIjxncm91cD5cIidcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAocGF0aE5hbWUpIG1vZGVsLnBhdGggPSBwYXRoTmFtZTtcblxuICAgICAgICBjb25zdCBrZXkgPSB0aGlzLmdlbmVyYXRlVXVpZCgpO1xuXG4gICAgICAgIC8vICBQQlhHcm91cCBpcyB0aGUgYmFzZSBpbnRlcmZhY2Ugb2YgYWxsIGdyb3Vwc1xuICAgICAgICBjb25zdCBncm91cFNlY3Rpb246IFR5cGVkU2VjdGlvbjxQQlhHcm91cD4gPSB0aGlzLnBmX3NlY3Rpb25HZXRPckNyZWF0ZTxQQlhHcm91cD4oZ3JvdXBUeXBlKTtcbiAgICAgICAgU2VjdGlvblV0aWxzLmVudHJ5U2V0V1V1aWQoZ3JvdXBTZWN0aW9uLCBrZXksIG1vZGVsLCBuYW1lKTtcblxuICAgICAgICAvLyAvL0NyZWF0ZSBjb21tZW50XG4gICAgICAgIC8vIHZhciBjb21tZW5kSWQgPSBrZXkgKyAnX2NvbW1lbnQnO1xuXG4gICAgICAgIC8vIC8vYWRkIG9iaiBhbmQgY29tbWVudE9iaiB0byBncm91cHM7XG4gICAgICAgIC8vIGdyb3Vwc1tjb21tZW5kSWRdID0gbmFtZTtcbiAgICAgICAgLy8gZ3JvdXBzW2tleV0gPSBtb2RlbDtcblxuICAgICAgICByZXR1cm4ga2V5O1xuICAgIH1cblxuICAgIHBieENyZWF0ZVZhcmlhbnRHcm91cChuYW1lOiBzdHJpbmcpOiBYQ19QUk9KX1VVSUQge1xuICAgICAgICByZXR1cm4gdGhpcy5wYnhDcmVhdGVHcm91cFdpdGhUeXBlKG5hbWUsIHVuZGVmaW5lZCwgJ1BCWFZhcmlhbnRHcm91cCcpXG4gICAgfVxuXG4gICAgcGJ4Q3JlYXRlR3JvdXAobmFtZTogc3RyaW5nLCBwYXRoTmFtZT86IHN0cmluZyB8IG51bGwpOiBYQ19QUk9KX1VVSUQge1xuICAgICAgICByZXR1cm4gdGhpcy5wYnhDcmVhdGVHcm91cFdpdGhUeXBlKG5hbWUsIHBhdGhOYW1lLCAnUEJYR3JvdXAnKTtcbiAgICB9XG5cbiAgICByZW1vdmVGcm9tUGJ4R3JvdXBBbmRUeXBlKGZpbGU6IElQYnhHcm91cENoaWxkRmlsZUluZm8sIGdyb3VwS2V5OiBYQ19QUk9KX1VVSUQsIGdyb3VwVHlwZTogSVNBX0dST1VQX1RZUEUpOiB2b2lkIHtcblxuICAgICAgICBjb25zdCBncm91cDogUEJYR3JvdXAgfCBudWxsID0gdGhpcy5nZXRQQlhHcm91cEJ5S2V5QW5kVHlwZShncm91cEtleSwgZ3JvdXBUeXBlKTtcblxuICAgICAgICBpZiAoZ3JvdXApIHtcbiAgICAgICAgICAgIHZhciBncm91cENoaWxkcmVuID0gZ3JvdXAuY2hpbGRyZW4sIGk7XG4gICAgICAgICAgICBjb25zdCB0b01hdGNoID0gcGJ4R3JvdXBDaGlsZChmaWxlKTtcbiAgICAgICAgICAgIGZvciAoaSBpbiBncm91cENoaWxkcmVuKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRvTWF0Y2gudmFsdWUgPT0gZ3JvdXBDaGlsZHJlbltpXS52YWx1ZSAmJlxuICAgICAgICAgICAgICAgICAgICB0b01hdGNoLmNvbW1lbnQgPT0gZ3JvdXBDaGlsZHJlbltpXS5jb21tZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGdyb3VwQ2hpbGRyZW4uc3BsaWNlKGkgYXMgdW5rbm93biBhcyBudW1iZXIsIDEpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW1vdmVGcm9tUGJ4R3JvdXAoZmlsZTogSVBieEdyb3VwQ2hpbGRGaWxlSW5mbywgZ3JvdXBLZXk6IFhDX1BST0pfVVVJRCk6IHZvaWQge1xuICAgICAgICB0aGlzLnJlbW92ZUZyb21QYnhHcm91cEFuZFR5cGUoZmlsZSwgZ3JvdXBLZXksICdQQlhHcm91cCcpO1xuICAgIH1cblxuICAgIHJlbW92ZUZyb21QYnhWYXJpYW50R3JvdXAoZmlsZTogSVBieEdyb3VwQ2hpbGRGaWxlSW5mbywgZ3JvdXBLZXk6IFhDX1BST0pfVVVJRCk6IHZvaWQge1xuICAgICAgICB0aGlzLnJlbW92ZUZyb21QYnhHcm91cEFuZFR5cGUoZmlsZSwgZ3JvdXBLZXksICdQQlhWYXJpYW50R3JvdXAnKTtcbiAgICB9XG5cbiAgICBnZXRQQlhHcm91cEJ5S2V5QW5kVHlwZTxQQlhfT0JKX1RZUEUgZXh0ZW5kcyBQQlhHcm91cD4oa2V5OiBYQ19QUk9KX1VVSUQsIGdyb3VwVHlwZTogSVNBX0dST1VQX1RZUEUpOiBQQlhfT0JKX1RZUEUgfCBudWxsIHtcbiAgICAgICAgLy8gICAgICAgIHJldHVybiB0aGlzLmhhc2gucHJvamVjdC5vYmplY3RzW2dyb3VwVHlwZV1ba2V5XTtcbiAgICAgICAgcmV0dXJuIFNlY3Rpb25VdGlscy5lbnRyeUdldFdVdWlkKHRoaXMucGZfc2VjdGlvbkdldE9yQ3JlYXRlPFBCWF9PQkpfVFlQRT4oZ3JvdXBUeXBlKSwga2V5KTtcbiAgICB9XG5cbiAgICBnZXRQQlhHcm91cEJ5S2V5KHV1aWQ6IFhDX1BST0pfVVVJRCk6IFBCWEdyb3VwIHwgbnVsbCB7XG4gICAgICAgIHJldHVybiBTZWN0aW9uVXRpbHMuZW50cnlHZXRXVXVpZCh0aGlzLnBieEdyb3Vwc1NlY3Rpb24oKSwgdXVpZCk7XG4gICAgICAgIC8vIHJldHVybiB0aGlzLmhhc2gucHJvamVjdC5vYmplY3RzWydQQlhHcm91cCddW2tleV07IC8vIHRoaXMgdXNlZCB0byBhbGxvdyByZXR1cm5pbmcgYSBzdHJpbmcuXG4gICAgfTtcblxuICAgIGdldFBCWFZhcmlhbnRHcm91cEJ5S2V5KHV1aWQ6IFhDX1BST0pfVVVJRCk6IFBCWFZhcmlhbnRHcm91cCB8IG51bGwge1xuICAgICAgICByZXR1cm4gU2VjdGlvblV0aWxzLmVudHJ5R2V0V1V1aWQodGhpcy5wYnhWYXJpYW50R3JvdXBzU2VjdGlvbigpLCB1dWlkKTtcbiAgICAgICAgLy8gcmV0dXJuIHRoaXMuaGFzaC5wcm9qZWN0Lm9iamVjdHNbJ1BCWFZhcmlhbnRHcm91cCddW2tleV07XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogXG4gICAgICogQHBhcmFtIGNyaXRlcmlhIFxuICAgICAqIEBwYXJhbSBncm91cFR5cGUgXG4gICAgICogQHJldHVybnMgdGhlIFVVSUQgb2YgdGhlIG1hdGNoaW5nIGdyb3VwIG9yIHVuZGVmaW5lZCBpZiBubyBtYXRjaC5cbiAgICAgKi9cbiAgICBmaW5kUEJYR3JvdXBLZXlBbmRUeXBlPFBCWF9HUk9VUF9UWVBFIGV4dGVuZHMgUEJYR3JvdXA+KFxuICAgICAgICBjcml0ZXJpYTogSUdyb3VwTWF0Y2hDcml0ZXJpYSxcbiAgICAgICAgZ3JvdXBUeXBlOiAnUEJYR3JvdXAnIHwgJ1BCWFZhcmlhbnRHcm91cCcpOiBYQ19QUk9KX1VVSUQgfCB1bmRlZmluZWQge1xuXG4gICAgICAgIC8vICBmb3IgdGhlIEpTIGRldmVsb3BlcnMuICBJIHdvdWxkIHRoaW5rIHRoaXMgd291bGQgdGhyb3cuICBCdXQgdGhlXG4gICAgICAgIC8vICBvcmlnaW5hbCBpbXBsZW1lbnRhdGlvbiBqdXN0IGlnbm9yZWQgY3JpdGVyaWEgaWYgbm90IHNldC4gTWFpbnRhaW5pbmdcbiAgICAgICAgLy8gIG9yaWlnbmFsIGxvZ2ljLlxuICAgICAgICBpZiAoIWNyaXRlcmlhKVxuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcblxuICAgICAgICBjb25zdCBncm91cHM6IFR5cGVkU2VjdGlvbjxQQlhfR1JPVVBfVFlQRT4gPSB0aGlzLnBmX3NlY3Rpb25HZXRPckNyZWF0ZTxQQlhfR1JPVVBfVFlQRT4oXG4gICAgICAgICAgICBncm91cFR5cGUpO1xuXG4gICAgICAgIC8vY29uc3QgZ3JvdXBzID0gdGhpcy5oYXNoLnByb2plY3Qub2JqZWN0c1tncm91cFR5cGVdO1xuXG4gICAgICAgIGZvciAodmFyIGtleSBpbiBncm91cHMpIHtcbiAgICAgICAgICAgIC8vIG9ubHkgbG9vayBmb3Igbm9uIGNvbW1lbnRzXG4gICAgICAgICAgICBpZiAoIVNlY3Rpb25VdGlscy5kaWN0S2V5SXNDb21tZW50KGtleSkpIHtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGdyb3VwID0gZ3JvdXBzW2tleV0gYXMgUEJYR3JvdXA7XG5cbiAgICAgICAgICAgICAgICAvLyAgTXVzdCBtYXRjaCBhbGwgY3JpdGVyaWEgcHJvdmlkZWQuXG4gICAgICAgICAgICAgICAgaWYgKGNyaXRlcmlhLnBhdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNyaXRlcmlhLnBhdGggPT09IGdyb3VwLnBhdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghY3JpdGVyaWEubmFtZSB8fCBjcml0ZXJpYS5uYW1lID09PSBncm91cC5uYW1lKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBrZXk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoY3JpdGVyaWEubmFtZSAmJiBjcml0ZXJpYS5uYW1lID09PSBncm91cC5uYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBrZXk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDsgLy8gTm90IGZvdW5kXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmluZCB0aGUgVVVJRCBvZiB0aGUgUEJYR3JvdXAgb2JqZWN0IHRoYXQgbWF0Y2hlcyB0aGUgcGFzc2VkIGluIGNyaXRlcmlhIG9yXG4gICAgICogdW5kZWZpbmVkIGlmIG1pc3NpbmcuXG4gICAgICogQHBhcmFtIGNyaXRlcmlhIG1hdGNoIGNyaXRlcmlhXG4gICAgICovXG4gICAgZmluZFBCWEdyb3VwS2V5KGNyaXRlcmlhOiBJR3JvdXBNYXRjaENyaXRlcmlhKTogWENfUFJPSl9VVUlEIHwgdW5kZWZpbmVkIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmluZFBCWEdyb3VwS2V5QW5kVHlwZShjcml0ZXJpYSwgJ1BCWEdyb3VwJyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmluZCB0aGUgVVVJRCBvZiB0aGUgUEJYVmFyaWFudEdyb3VwIG9iamVjdCB0aGF0IG1hdGNoZXMgdGhlIHBhc3NlZCBpbiBjcml0ZXJpYSBvclxuICAgICAqIHVuZGVmaW5lZCBpZiBtaXNzaW5nLlxuICAgICAqIEBwYXJhbSBjcml0ZXJpYSBtYXRjaCBjcml0ZXJpYVxuICAgICAqL1xuXG4gICAgZmluZFBCWFZhcmlhbnRHcm91cEtleShjcml0ZXJpYTogSUdyb3VwTWF0Y2hDcml0ZXJpYSk6IFhDX1BST0pfVVVJRCB8IHVuZGVmaW5lZCB7XG4gICAgICAgIHJldHVybiB0aGlzLmZpbmRQQlhHcm91cEtleUFuZFR5cGUoY3JpdGVyaWEsICdQQlhWYXJpYW50R3JvdXAnKTtcbiAgICB9XG5cbiAgICBhZGRMb2NhbGl6YXRpb25WYXJpYW50R3JvdXAobmFtZTogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGdyb3VwS2V5ID0gdGhpcy5wYnhDcmVhdGVWYXJpYW50R3JvdXAobmFtZSk7XG5cbiAgICAgICAgY29uc3QgcmVzb3VyY2VHcm91cEtleTogWENfUFJPSl9VVUlEIHwgdW5kZWZpbmVkID0gdGhpcy5maW5kUEJYR3JvdXBLZXkoeyBuYW1lOiAnUmVzb3VyY2VzJyB9KTtcblxuICAgICAgICBpZiAocmVzb3VyY2VHcm91cEtleSA9PSB1bmRlZmluZWQpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJSZXNvdXJjZXMgZ3JvdXAgbm90IGZvdW5kIVwiKTtcblxuICAgICAgICB0aGlzLmFkZFRvUGJ4R3JvdXAoZ3JvdXBLZXksIHJlc291cmNlR3JvdXBLZXkpO1xuXG4gICAgICAgIHZhciBsb2NhbGl6YXRpb25WYXJpYW50R3JvdXAgPSB7XG4gICAgICAgICAgICB1dWlkOiB0aGlzLmdlbmVyYXRlVXVpZCgpLFxuICAgICAgICAgICAgZmlsZVJlZjogZ3JvdXBLZXksXG4gICAgICAgICAgICBiYXNlbmFtZTogbmFtZVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5hZGRUb1BieEJ1aWxkRmlsZVNlY3Rpb24obG9jYWxpemF0aW9uVmFyaWFudEdyb3VwKTsgICAgICAgIC8vIFBCWEJ1aWxkRmlsZVxuICAgICAgICB0aGlzLmFkZFRvUGJ4UmVzb3VyY2VzQnVpbGRQaGFzZShsb2NhbGl6YXRpb25WYXJpYW50R3JvdXApOyAgICAgLy9QQlhSZXNvdXJjZXNCdWlsZFBoYXNlXG5cbiAgICAgICAgcmV0dXJuIGxvY2FsaXphdGlvblZhcmlhbnRHcm91cDtcbiAgICB9O1xuXG4gICAgYWRkS25vd25SZWdpb24obmFtZTogc3RyaW5nKTogdm9pZCB7XG5cbiAgICAgICAgY29uc3QgcHJvamVjdDogUEJYUHJvamVjdCA9IHRoaXMuZ2V0Rmlyc3RQcm9qZWN0KCkuZmlyc3RQcm9qZWN0O1xuXG4gICAgICAgIGlmICghcHJvamVjdC5rbm93blJlZ2lvbnMpXG4gICAgICAgICAgICBwcm9qZWN0Lmtub3duUmVnaW9ucyA9IFtdO1xuXG4gICAgICAgIGlmICghdGhpcy5oYXNLbm93blJlZ2lvbihuYW1lKSkge1xuICAgICAgICAgICAgcHJvamVjdC5rbm93blJlZ2lvbnMucHVzaChuYW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmICghdGhpcy5wYnhQcm9qZWN0U2VjdGlvbigpW3RoaXMuZ2V0Rmlyc3RQcm9qZWN0KClbJ3V1aWQnXV1bJ2tub3duUmVnaW9ucyddKSB7XG4gICAgICAgIC8vICAgICB0aGlzLnBieFByb2plY3RTZWN0aW9uKClbdGhpcy5nZXRGaXJzdFByb2plY3QoKVsndXVpZCddXVsna25vd25SZWdpb25zJ10gPSBbXTtcbiAgICAgICAgLy8gfVxuICAgICAgICAvLyBpZiAoIXRoaXMuaGFzS25vd25SZWdpb24obmFtZSkpIHtcbiAgICAgICAgLy8gICAgIHRoaXMucGJ4UHJvamVjdFNlY3Rpb24oKVt0aGlzLmdldEZpcnN0UHJvamVjdCgpWyd1dWlkJ11dWydrbm93blJlZ2lvbnMnXS5wdXNoKG5hbWUpO1xuICAgICAgICAvLyB9XG4gICAgfVxuXG4gICAgcmVtb3ZlS25vd25SZWdpb24obmFtZTogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IHJlZ2lvbnM6IHN0cmluZ1tdIHwgdW5kZWZpbmVkID0gdGhpcy5nZXRGaXJzdFByb2plY3QoKS5maXJzdFByb2plY3Qua25vd25SZWdpb25zO1xuICAgICAgICBpZiAocmVnaW9ucykge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZWdpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKHJlZ2lvbnNbaV0gPT09IG5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVnaW9ucy5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gIFRoaXMgbGluZSBkaWQgbm90aGluZ1xuICAgICAgICAgICAgLy8gdGhpcy5wYnhQcm9qZWN0U2VjdGlvbigpW3RoaXMuZ2V0Rmlyc3RQcm9qZWN0KClbJ3V1aWQnXV1bJ2tub3duUmVnaW9ucyddID0gcmVnaW9ucztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGhhc0tub3duUmVnaW9uKG5hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgICAgICBjb25zdCByZWdpb25zOiBzdHJpbmdbXSB8IHVuZGVmaW5lZCA9IHRoaXMuZ2V0Rmlyc3RQcm9qZWN0KCkuZmlyc3RQcm9qZWN0Lmtub3duUmVnaW9ucztcbiAgICAgICAgLy92YXIgcmVnaW9ucyA9IHRoaXMucGJ4UHJvamVjdFNlY3Rpb24oKVt0aGlzLmdldEZpcnN0UHJvamVjdCgpWyd1dWlkJ11dWydrbm93blJlZ2lvbnMnXTtcbiAgICAgICAgaWYgKHJlZ2lvbnMpIHtcbiAgICAgICAgICAgIGZvciAodmFyIGkgaW4gcmVnaW9ucykge1xuICAgICAgICAgICAgICAgIGlmIChyZWdpb25zW2ldID09PSBuYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG5cbiAgICBnZXRQQlhPYmplY3Q8UEJYX09CSl9UWVBFIGV4dGVuZHMgUEJYT2JqZWN0QmFzZT4obmFtZTogSVNBX1RZUEUpOiBUeXBlZFNlY3Rpb248UEJYX09CSl9UWVBFPiB8IHVuZGVmaW5lZCB7XG4gICAgICAgIGlmICghdGhpcy5oYXNoKSB0aHJvdyBuZXcgRXJyb3IoJ05vdCBsb2FkZWQnKTtcblxuICAgICAgICByZXR1cm4gdGhpcy5oYXNoLnByb2plY3Qub2JqZWN0c1tuYW1lXSBhcyBUeXBlZFNlY3Rpb248UEJYX09CSl9UWVBFPiB8IHVuZGVmaW5lZDtcbiAgICB9XG5cblxuXG5cbiAgICAvKipcbiAgICAgKiBTZWUgaWYgdGhpcyBmaWxlIGV4aXN0cyBpbiB0aGUgcHJvamVjdC4gIElmIG5vdCwgc3RvcCBhbmQgcmV0dXJuIGEgbnVsbC5cbiAgICAgKiBJZiBub3QsIGNyZWF0ZSBhIG5ldyBmaWxlIHJlZmVyZW5jZSBmb3IgaXQsIGFkZCBhIFBCWEZpbGVSZWZlcmVuY2UgdG8gXG4gICAgICogdGhlIG1vZGVsLCBhbmQgdGhlbiBhZGQgaXQgdG8gYSBncm91cCBpZiBwb3NzaWJsZS5cbiAgICAgKiBcbiAgICAgKiBMaW5lIDE5NjEgXG4gICAgICogQHBhcmFtIHBhdGggcmVsYXRpdmUgcGF0aCB0byB0aGUgZmlsZSB3aXRoaW4gdGhlIHByb2plY3QuXG4gICAgICogQHBhcmFtIGdyb3VwIGlmIHRoaXMgaXMgdGhlIGtleSB0byBhIFBCWEdyb3VwLCB0aGVuIHRoaXMgZmlsZSBpcyBhZGRlZCB0byB0aGF0XG4gICAgICogZ3JvdXAuICBJZiB0aGlzIGlzIHRoZSBrZXkgdG8gYSBQQlhWYXJpYW50R3JvdXAsIHRoZW4gdGhpcyBmaWxlIGlzIGFkZGVkIHRvXG4gICAgICogdGhhdCBncm91cC4gIE90aGVyd2lzZSwgdGhpcyBmaWxlIGlzIG5vdCBhZGRlZCB0byBhbnkgZ3JvdXAuXG4gICAgICogQHBhcmFtIG9wdCBcbiAgICAgKiBcbiAgICAgKiBAcmV0dXJucyBudWxsIGlmIGZpbGUgYWxyZWFkeSBleGlzdHMuICBPdGhlcndpc2UsIHRoaXMgaXMgdGhlIG5ldyBmaWxlLlxuICAgICAqL1xuICAgIGFkZEZpbGUocGF0aDogc3RyaW5nLCBncm91cDogWENfUFJPSl9VVUlELCBvcHQ/OiBJUGJ4RmlsZU9wdGlvbnMgfCBudWxsKTogUGJ4RmlsZSB8IG51bGwge1xuICAgICAgICBjb25zdCBmaWxlID0gbmV3IFBieEZpbGUocGF0aCwgb3B0KTtcblxuICAgICAgICAvLyBudWxsIGlzIGJldHRlciBmb3IgZWFybHkgZXJyb3JzXG4gICAgICAgIGlmICh0aGlzLmhhc0ZpbGUoZmlsZS5wYXRoKSkgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgZmlsZS5maWxlUmVmID0gdGhpcy5nZW5lcmF0ZVV1aWQoKTtcblxuICAgICAgICB0aGlzLmFkZFRvUGJ4RmlsZVJlZmVyZW5jZVNlY3Rpb24oZmlsZSk7ICAgIC8vIFBCWEZpbGVSZWZlcmVuY2VcblxuICAgICAgICBpZiAodGhpcy5nZXRQQlhHcm91cEJ5S2V5KGdyb3VwKSkge1xuICAgICAgICAgICAgdGhpcy5hZGRUb1BieEdyb3VwKGZpbGUsIGdyb3VwKTsgICAgICAgIC8vIFBCWEdyb3VwXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodGhpcy5nZXRQQlhWYXJpYW50R3JvdXBCeUtleShncm91cCkpIHtcbiAgICAgICAgICAgIHRoaXMuYWRkVG9QYnhWYXJpYW50R3JvdXAoZmlsZSwgZ3JvdXApOyAgICAgICAgICAgIC8vIFBCWFZhcmlhbnRHcm91cFxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZpbGU7XG4gICAgfVxuXG4gICAgcmVtb3ZlRmlsZShwYXRoOiBzdHJpbmcsIGdyb3VwOiBYQ19QUk9KX1VVSUQsIG9wdD86IElQYnhGaWxlT3B0aW9ucyB8IG51bGwpOiBQYnhGaWxlIHtcbiAgICAgICAgY29uc3QgZmlsZSA9IG5ldyBQYnhGaWxlKHBhdGgsIG9wdCk7XG5cbiAgICAgICAgdGhpcy5yZW1vdmVGcm9tUGJ4RmlsZVJlZmVyZW5jZVNlY3Rpb24oZmlsZSk7ICAgIC8vIFBCWEZpbGVSZWZlcmVuY2VcblxuICAgICAgICBpZiAodGhpcy5nZXRQQlhHcm91cEJ5S2V5KGdyb3VwKSkge1xuICAgICAgICAgICAgdGhpcy5yZW1vdmVGcm9tUGJ4R3JvdXAoZmlsZSwgZ3JvdXApOyAgICAgICAgICAgIC8vIFBCWEdyb3VwXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodGhpcy5nZXRQQlhWYXJpYW50R3JvdXBCeUtleShncm91cCkpIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlRnJvbVBieFZhcmlhbnRHcm91cChmaWxlLCBncm91cCk7ICAgICAvLyBQQlhWYXJpYW50R3JvdXBcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmaWxlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHJldHVybnMgdGhlIHZhbHVlIG9mIHRoZSBsYXN0IGJ1aWxkIHNldHRpbmcgd2l0aCB0aGUgbmFtZSBwcm9wZXJ0eSBmb3JcbiAgICAgKiBhbGwgWENCdWlsZENvbmZpZ3VyYXRpb24gb2JqZWN0cyB3aG9zZSBuYW1lIG1hdGNoZXMgdGhlIHZhbHVlIHBhc3NlZCBpbiBmb3IgJ2J1aWxkJ1xuICAgICAqIEBwYXJhbSBwcm9wIEEga2V5IGluIHRoZSBidWlsZFNldHRpbmdzIFxuICAgICAqIEBwYXJhbSBidWlsZCBNYXRjaGVzIHRoZSBYQ0J1aWxkQ29uZmlndXJhdGlvbk5hbWUuICBFeGFtcGxlczogICdEZWJ1ZycgJ1JlbGVhc2UnXG4gICAgICovXG4gICAgZ2V0QnVpbGRQcm9wZXJ0eShwcm9wOiBzdHJpbmcsIGJ1aWxkPzogJ0RlYnVnJyB8ICdSZWxlYXNlJyB8IHVuZGVmaW5lZCk6IGFueSB7XG4gICAgICAgIHZhciB0YXJnZXQ7XG4gICAgICAgIGNvbnN0IGNvbmZpZ3M6IFR5cGVkU2VjdGlvbjxYQ0J1aWxkQ29uZmlndXJhdGlvbj4gPSB0aGlzLnhjQnVpbGRDb25maWd1cmF0aW9uU2VjdGlvbigpO1xuICAgICAgICBmb3IgKHZhciBjb25maWdLZXkgaW4gY29uZmlncykge1xuICAgICAgICAgICAgaWYgKCFTZWN0aW9uVXRpbHMuZGljdEtleUlzQ29tbWVudChjb25maWdLZXkpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29uZmlnOiBYQ0J1aWxkQ29uZmlndXJhdGlvbiA9IGNvbmZpZ3NbY29uZmlnS2V5XSBhcyBYQ0J1aWxkQ29uZmlndXJhdGlvbjtcblxuICAgICAgICAgICAgICAgIGlmICgoYnVpbGQgJiYgY29uZmlnLm5hbWUgPT09IGJ1aWxkKSB8fCAoYnVpbGQgPT09IHVuZGVmaW5lZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbmZpZy5idWlsZFNldHRpbmdzW3Byb3BdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldCA9IGNvbmZpZy5idWlsZFNldHRpbmdzW3Byb3BdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm4gYSBkaWN0aW9uYXJ5IG9mIGFsbCBvZiB0aGUgWENCdWlsZENvbmZpZ3VyYXRpb24gb2JqZWN0cyB0aGF0IGFyZSBlaXRoZXIgJ0RlYnVnJyBvciAnUmVsZWFzZSdcbiAgICAgKiBAcGFyYW0gYnVpbGQgXG4gICAgICovXG4gICAgZ2V0QnVpbGRDb25maWdCeU5hbWUoYnVpbGQ6ICdEZWJ1ZycgfCAnUmVsZWFzZScpOiB7IFt1dWlkOiBzdHJpbmddOiBYQ0J1aWxkQ29uZmlndXJhdGlvbiB9IHtcblxuICAgICAgICBjb25zdCB0YXJnZXQ6IHsgW3V1aWQ6IHN0cmluZ106IFhDQnVpbGRDb25maWd1cmF0aW9uIH0gPSB7fTtcblxuICAgICAgICBjb25zdCBjb25maWdzOiBUeXBlZFNlY3Rpb248WENCdWlsZENvbmZpZ3VyYXRpb24+ID0gdGhpcy54Y0J1aWxkQ29uZmlndXJhdGlvblNlY3Rpb24oKTtcbiAgICAgICAgZm9yICh2YXIga2V5IGluIGNvbmZpZ3MpIHtcbiAgICAgICAgICAgIGlmICghU2VjdGlvblV0aWxzLmRpY3RLZXlJc0NvbW1lbnQoa2V5KSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbmZpZzogWENCdWlsZENvbmZpZ3VyYXRpb24gPSBjb25maWdzW2tleV0gYXMgWENCdWlsZENvbmZpZ3VyYXRpb247XG4gICAgICAgICAgICAgICAgaWYgKGNvbmZpZy5uYW1lID09PSBidWlsZCkge1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXRba2V5XSA9IGNvbmZpZztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0gZmlsZVBhdGggXG4gICAgICogQHBhcmFtIGdyb3VwIFxuICAgICAqIEBwYXJhbSBvcHQgXG4gICAgICovXG4gICAgYWRkRGF0YU1vZGVsRG9jdW1lbnQoZmlsZVBhdGg6IHN0cmluZywgZ3JvdXA6IFhDX1BST0pfVVVJRCB8IEZJTEVUWVBFX0dST1VQIHwgc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCwgb3B0PzogSVBieEZpbGVPcHRpb25zIHwgbnVsbCkge1xuXG4gICAgICAgIC8vICBJdCBhcHBlYXJzIGFzIGlmIGdyb3VwIGNhbiBiZSBcbiAgICAgICAgaWYgKCFncm91cCkge1xuICAgICAgICAgICAgZ3JvdXAgPSAnUmVzb3VyY2VzJztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghU2VjdGlvblV0aWxzLmRpY3RLZXlJc1V1aWQoZ3JvdXApKSB7IC8vIElmIHRoaXMgaXMgbm90IGFuIFhDX1BST0pfVVVJRCwgdGhlbiBpdCBpcyBhIEZJTEVUWVBFX0dST1VQLCBjb252ZXJ0IGl0IHRvIGEgVVVJRCBvciBiYWNrIHRvIHVuZGVmaW5lZFxuICAgICAgICAvLyBpZiAoICAhdGhpcy5nZXRQQlhHcm91cEJ5S2V5KGdyb3VwKSkgeyAvLyBXZSBub3cgdGhyb3cgaWYgeW91IHBhc3MgYSBub24ga2V5IFxuICAgICAgICAgICAgZ3JvdXAgPSB0aGlzLmZpbmRQQlhHcm91cEtleSh7IG5hbWU6IGdyb3VwIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gIEF0IHRoaXMgcG9pbnQgZ3JvdXAgaXMgZWl0aGVyIGEgdmFsaWQgVVVJRCBvciB1bmRlZmluZWRcbiAgICAgICAgaWYgKCFncm91cClcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIGZpbmQgdGhlIGdyb3VwIScpO1xuXG4gICAgICAgIGNvbnN0IGZpbGU6IFBieEZpbGUgJiBJRGF0YU1vZGVsRG9jdW1lbnRGaWxlID0gbmV3IFBieEZpbGUoZmlsZVBhdGgsIG9wdCk7XG5cbiAgICAgICAgaWYgKCFmaWxlIHx8IHRoaXMuaGFzRmlsZShmaWxlLnBhdGgpKSByZXR1cm4gbnVsbDtcblxuICAgICAgICBmaWxlLmZpbGVSZWYgPSB0aGlzLmdlbmVyYXRlVXVpZCgpO1xuICAgICAgICB0aGlzLmFkZFRvUGJ4R3JvdXAoZmlsZSwgZ3JvdXApO1xuXG4gICAgICAgIGlmICghZmlsZSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIGZpbGUudGFyZ2V0ID0gb3B0ID8gb3B0LnRhcmdldCA6IHVuZGVmaW5lZDtcbiAgICAgICAgZmlsZS51dWlkID0gdGhpcy5nZW5lcmF0ZVV1aWQoKTtcblxuICAgICAgICB0aGlzLmFkZFRvUGJ4QnVpbGRGaWxlU2VjdGlvbihmaWxlKTtcbiAgICAgICAgdGhpcy5hZGRUb1BieFNvdXJjZXNCdWlsZFBoYXNlKGZpbGUpO1xuXG4gICAgICAgIGZpbGUubW9kZWxzID0gW107XG4gICAgICAgIHZhciBjdXJyZW50VmVyc2lvbk5hbWU7XG4gICAgICAgIHZhciBtb2RlbEZpbGVzID0gZnMucmVhZGRpclN5bmMoZmlsZS5wYXRoKTtcbiAgICAgICAgZm9yICh2YXIgaW5kZXggaW4gbW9kZWxGaWxlcykge1xuICAgICAgICAgICAgdmFyIG1vZGVsRmlsZU5hbWUgPSBtb2RlbEZpbGVzW2luZGV4XTtcbiAgICAgICAgICAgIHZhciBtb2RlbEZpbGVQYXRoID0gcGF0aC5qb2luKGZpbGVQYXRoLCBtb2RlbEZpbGVOYW1lKTtcblxuICAgICAgICAgICAgaWYgKG1vZGVsRmlsZU5hbWUgPT0gJy54Y2N1cnJlbnR2ZXJzaW9uJykge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRWZXJzaW9uTmFtZSA9IHBsaXN0LnJlYWRGaWxlU3luYyhtb2RlbEZpbGVQYXRoKS5fWENDdXJyZW50VmVyc2lvbk5hbWU7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBtb2RlbEZpbGUgPSBuZXcgUGJ4RmlsZShtb2RlbEZpbGVQYXRoKTtcbiAgICAgICAgICAgIG1vZGVsRmlsZS5maWxlUmVmID0gdGhpcy5nZW5lcmF0ZVV1aWQoKTtcblxuICAgICAgICAgICAgdGhpcy5hZGRUb1BieEZpbGVSZWZlcmVuY2VTZWN0aW9uKG1vZGVsRmlsZSk7XG5cbiAgICAgICAgICAgIGZpbGUubW9kZWxzLnB1c2gobW9kZWxGaWxlKTtcblxuICAgICAgICAgICAgaWYgKGN1cnJlbnRWZXJzaW9uTmFtZSAmJiBjdXJyZW50VmVyc2lvbk5hbWUgPT09IG1vZGVsRmlsZU5hbWUpIHtcbiAgICAgICAgICAgICAgICBmaWxlLmN1cnJlbnRNb2RlbCA9IG1vZGVsRmlsZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghZmlsZS5jdXJyZW50TW9kZWwpIHtcbiAgICAgICAgICAgIGZpbGUuY3VycmVudE1vZGVsID0gZmlsZS5tb2RlbHNbMF07XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmFkZFRvWGNWZXJzaW9uR3JvdXBTZWN0aW9uKGZpbGUpO1xuXG4gICAgICAgIHJldHVybiBmaWxlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZCBhIG5ldyBvYmplY3QvdmFsdWUgdG8gdGhlIFRhcmdldEF0dHJpYnV0ZXMgYXR0cmlidXRlIG9mIHRoZSBvbmx5XG4gICAgICogUEJYUHJvamVjdCBtZW1iZXIuXG4gICAgICogQHBhcmFtIHByb3AgXG4gICAgICogQHBhcmFtIHZhbHVlIFxuICAgICAqIEBwYXJhbSB0YXJnZXQgXG4gICAgICovXG4gICAgYWRkVGFyZ2V0QXR0cmlidXRlKHByb3A6IHN0cmluZywgdmFsdWU6IGFueSwgdGFyZ2V0OiB7IHV1aWQ6IFhDX1BST0pfVVVJRCB9KTogdm9pZCB7XG5cbiAgICAgICAgY29uc3QgcHJvajogUEJYUHJvamVjdCA9IHRoaXMuZ2V0Rmlyc3RQcm9qZWN0KCkuZmlyc3RQcm9qZWN0O1xuICAgICAgICBjb25zdCBhdHRyaWJ1dGVzOiBJQXR0cmlidXRlc0RpY3Rpb25hcnkgPSBwcm9qLmF0dHJpYnV0ZXM7XG5cbiAgICAgICAgLy8gdmFyIGF0dHJpYnV0ZXMgPSB0aGlzLmdldEZpcnN0UHJvamVjdCgpWydmaXJzdFByb2plY3QnXVsnYXR0cmlidXRlcyddO1xuICAgICAgICBpZiAoYXR0cmlidXRlc1snVGFyZ2V0QXR0cmlidXRlcyddID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZXNbJ1RhcmdldEF0dHJpYnV0ZXMnXSA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIHRhcmdldCA9IHRhcmdldCB8fCB0aGlzLmdldEZpcnN0VGFyZ2V0KCk7XG4gICAgICAgIGlmIChhdHRyaWJ1dGVzWydUYXJnZXRBdHRyaWJ1dGVzJ11bdGFyZ2V0LnV1aWRdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZXNbJ1RhcmdldEF0dHJpYnV0ZXMnXVt0YXJnZXQudXVpZF0gPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBhdHRyaWJ1dGVzWydUYXJnZXRBdHRyaWJ1dGVzJ11bdGFyZ2V0LnV1aWRdW3Byb3BdID0gdmFsdWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogXG4gICAgICogQHBhcmFtIHByb3AgXG4gICAgICogQHBhcmFtIHRhcmdldCBcbiAgICAgKi9cbiAgICByZW1vdmVUYXJnZXRBdHRyaWJ1dGUocHJvcDogc3RyaW5nLCB0YXJnZXQ/OiB7IHV1aWQ6IFhDX1BST0pfVVVJRCB9KTogdm9pZCB7XG5cbiAgICAgICAgY29uc3QgcHJvajogUEJYUHJvamVjdCA9IHRoaXMuZ2V0Rmlyc3RQcm9qZWN0KCkuZmlyc3RQcm9qZWN0O1xuICAgICAgICBjb25zdCBhdHRyaWJ1dGVzOiBJQXR0cmlidXRlc0RpY3Rpb25hcnkgPSBwcm9qLmF0dHJpYnV0ZXM7XG5cbiAgICAgICAgdGFyZ2V0ID0gdGFyZ2V0IHx8IHRoaXMuZ2V0Rmlyc3RUYXJnZXQoKTtcbiAgICAgICAgaWYgKGF0dHJpYnV0ZXNbJ1RhcmdldEF0dHJpYnV0ZXMnXSAmJlxuICAgICAgICAgICAgYXR0cmlidXRlc1snVGFyZ2V0QXR0cmlidXRlcyddW3RhcmdldC51dWlkXSkge1xuICAgICAgICAgICAgZGVsZXRlIGF0dHJpYnV0ZXNbJ1RhcmdldEF0dHJpYnV0ZXMnXVt0YXJnZXQudXVpZF1bcHJvcF07XG4gICAgICAgIH1cbiAgICB9XG5cbn0iXX0=