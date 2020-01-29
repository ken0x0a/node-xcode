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


/*
Helpful Background Links:

http://danwright.info/blog/2010/10/xcode-pbxproject-files/
http://www.monobjc.net/xcode-project-file-format.html
https://github.com/Monobjc/monobjc-tools


*/

import { format as f } from 'util';
import * as path from 'path';
import * as uuid from 'uuid';
import * as fs from 'fs';
//  no types file for simple-plist
const plist = require('simple-plist') as any;
//import * as plist from 'simple-plist';

import { EventEmitter } from 'events';
import { fork, ChildProcess } from 'child_process';

import { PbxWriter, PbxWriterOptions } from './pbxWriter';

//  This is a automatically generated .js file from pegjs.
//  So go oldschool and use require.
const parser = require('./parser/pbxproj');

import { SectionUtils } from './SectionUtils';
import { XC_PROJ_UUID, TARGET_TYPE, PRODUCT_TYPE, XC_COMMENT_KEY } from './IXcodeProjFileSimpleTypes';
import { PBXNativeTarget, PBXBuildPhaseBase, XCConfigurationList, PBXBuildFile, PBXFileReference, IChildListEntry, PBXCopyFilesBuildPhase, PBXShellScriptBuildPhase, PBXGroup, cPBXGroup, XCVersionGroup, XCBuildConfiguration, PBXTargetDependency, PBXContainerItemProxy, cPBXContainerItemProxy, cPBXTargetDependency, cPBXCopyFilesBuildPhase, cPBXShellScriptBuildPhase, PBXObjectBase, ISA_TYPE, PBXVariantGroup, cPBXVariantGroup, PBXProject, cPBXProject, cPBXBuildFile, cPBXFileReference, cPBXNativeTarget, cXCBuildConfiguration, cXCVersionGroup, cXCConfigurationList, PBXSourcesBuildPhase, PBXResourcesBuildPhase, PBXFrameworksBuildPhase, ISA_BUILD_PHASE_TYPE, ISA_GROUP_TYPE, IAttributesDictionary } from './IXcodeProjFileObjTypes';
import { PbxFile, IFilePathObj, ILongCommentObj, XC_FILETYPE, IPbxFileOptions, FILETYPE_GROUP, XC_SOURCETREE } from './PbxFileDef';
import { IXcodeProjFile, Section, TypedSection, IProject, SectionDictUuidToObj } from './IXcodeProjFile';


/**
 * Due to a problem debugging code that depends on the fork used in 
 * the parse method, we allow setting an environment variable that 
 * makes calls to parse simulate the fork method.  In reality, we should
 * just remove the fork outright.  But we are for now assuming someone coded
 * it that way for a valid reason and are maintaining that implementation.
 */
const replaceParseWithParseSync = (process.env["XNODE_PARSE_AVOID_FORK"] == "1"); // See if we can pull an environment variable to set this when running out of VSCode or debugger.

export interface INativeTargetWrapper {
    uuid: XC_PROJ_UUID;
    pbxNativeTarget: PBXNativeTarget;
}

export interface INativeTargetWrapper2 {
    uuid: XC_PROJ_UUID;
    target: PBXNativeTarget;
}

export interface IBuildPhaseWrapper {
    uuid: XC_PROJ_UUID;
    buildPhase: PBXBuildPhaseBase;
}

export interface IConfigurationListWrapper {
    uuid: XC_PROJ_UUID;
    xcConfigurationList: XCConfigurationList;
}

export interface IGroupMatchCriteria {
    path?: string;
    name?: string;
}

//  Used to extend PbxFile for data model files.
export interface IDataModelDocumentFile {
    models?: PbxFile[];
    currentModel?: PbxFile;
}

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
function pbxBuildFileObj(file: IFilePathObj): PBXBuildFile {

    //  Making an assumption that a BuildFile without a fileRef
    //  is an illegal condition.
    if (typeof file.fileRef !== 'string') {
        throw new Error('Assuming all BuildFile instances require a fileRef.');
    }

    var obj: PBXBuildFile = {
        isa: 'PBXBuildFile',
        fileRef: file.fileRef,
        fileRef_comment: file.basename
    };

    if (file.settings)
        obj.settings = file.settings;

    return obj;
}

function pbxFileReferenceObj(file: PbxFile): PBXFileReference {
    //  All file references 

    //  Assuming XC can't handle this.  Unsure if this is true or not.

    //  The test cases forced an 'unknown' value here.  Restore this check and fix
    //  the test cases if we determine that xcode can't handle unknown.
    // if (file.lastKnownFileType == 'unknown')
    //     throw new Error('Attempting to set the lastKnownFileType of a PBXFileReference object to "unknown"');

    var fileObject: PBXFileReference = {
        isa: "PBXFileReference",
        name: "\"" + file.basename + "\"",
        path: "\"" + file.path.replace(/\\/g, '/') + "\"",
        sourceTree: file.sourceTree,
        fileEncoding: file.fileEncoding,
        lastKnownFileType: file.lastKnownFileType, // Should we allow this to include "unknown"?
        explicitFileType: file.explicitFileType,
        includeInIndex: file.includeInIndex
    };

    return fileObject;
}

interface IPbxGroupChildFileInfo { fileRef?: XC_PROJ_UUID, basename: string }

function pbxGroupChild(file: IPbxGroupChildFileInfo): IChildListEntry {

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

function pbxBuildPhaseObj(file: IFilePathObj): IChildListEntry {
    var obj = Object.create(null);

    if (!SectionUtils.dictKeyIsUuid(file.uuid)) {
        throw new Error(`The uuid value of '${file.uuid}' is invalid!`);
    }

    obj.value = file.uuid;
    obj.comment = longComment(file);

    return obj;
}

function pbxCopyFilesBuildPhaseObj(
    obj: PBXBuildPhaseBase,
    folderType: string,
    subfolderPath?: string | null,
    phaseName?: string | null): PBXCopyFilesBuildPhase {

    // Add additional properties for 'CopyFiles' build phase
    var DESTINATION_BY_TARGETTYPE: { [targetType: string]: string } = {
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
    }

    var SUBFOLDERSPEC_BY_DESTINATION: { [destination: string]: number } = {
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
    }

    const objOut = obj as PBXCopyFilesBuildPhase;
    objOut.name = '"' + phaseName + '"';
    objOut.dstPath = subfolderPath || '""';
    objOut.dstSubfolderSpec = SUBFOLDERSPEC_BY_DESTINATION[DESTINATION_BY_TARGETTYPE[folderType]];

    return objOut;
}

export interface IPbxShellScriptBuildPhaseOptions {
    inputPaths?: string[],
    outputPaths?: string[],
    shellPath?: string,
    shellScript: string // Required
}

function pbxShellScriptBuildPhaseObj(
    obj: PBXBuildPhaseBase,
    options: IPbxShellScriptBuildPhaseOptions,
    phaseName: string): PBXShellScriptBuildPhase {

    const objOut = obj as PBXShellScriptBuildPhase;
    objOut.name = '"' + phaseName + '"';
    objOut.inputPaths = options.inputPaths || [];
    objOut.outputPaths = options.outputPaths || [];
    objOut.shellPath = options.shellPath;
    objOut.shellScript = '"' + options.shellScript.replace(/"/g, '\\"') + '"';

    return objOut;
}

function pbxBuildFileComment(file: ILongCommentObj) {
    return longComment(file);
}

function pbxFileReferenceComment(file: PbxFile): string {
    return file.basename || path.basename(file.path);
}

function pbxNativeTargetComment(target: PBXNativeTarget): string {
    return target.name;
}

function longComment(file: ILongCommentObj): string {

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

    return f("%s in %s", file.basename, file.group);
}

// respect <group> path
function correctForPluginsPath(file: PbxFile, project: XcProjectFileEditor) {
    return correctForPath(file, project, 'Plugins');
}

function correctForResourcesPath(file: PbxFile, project: XcProjectFileEditor) {
    return correctForPath(file, project, 'Resources');
}


//  not used
// function correctForFrameworksPath(file: PbxFile, project: PbxProject) {
//     return correctForPath(file, project, 'Frameworks');
// }

function correctForPath(file: PbxFile, project: XcProjectFileEditor, group: string): PbxFile {
    var r_group_dir = new RegExp('^' + group + '[\\\\/]');

    const groupObj: PBXGroup | null = project.pbxGroupByName(group);

    if (!groupObj)
        throw new Error("Group not found!");

    if (groupObj.path)
        file.path = file.path.replace(r_group_dir, '');

    return file;
}

function searchPathForFile(file: PbxFile, proj: XcProjectFileEditor): string {
    const plugins = proj.pbxGroupByName('Plugins');
    const pluginsPath = plugins ? plugins.path : null;

    let fileDir = path.dirname(file.path);

    if (fileDir == '.') {
        fileDir = '';
    } else {
        fileDir = '/' + fileDir;
    }

    if (file.plugin && pluginsPath) {
        return '"\\"$(SRCROOT)/' + unquote(pluginsPath) + '\\""';
    } else if (file.customFramework && file.dirname) {
        return '"\\"' + file.dirname + '\\""';
    } else {
        return '"\\"$(SRCROOT)/' + proj.productName + fileDir + '\\""';
    }
}

function unquoteStr(str: string): string {
    return str.replace(/^"(.*)"$/, "$1");
}

function unquote(str: string | undefined): string | undefined {
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

function producttypeForTargettype(targetType: TARGET_TYPE): PRODUCT_TYPE {

    const PRODUCTTYPE_BY_TARGETTYPE: { [targetType: string]: PRODUCT_TYPE } = {
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

    const pt = PRODUCTTYPE_BY_TARGETTYPE[targetType];

    if (pt !== undefined)
        return pt;
    else
        throw new Error(`No product type for target type of '${targetType}'`);
}

function filetypeForProductType(productType: PRODUCT_TYPE): XC_FILETYPE {

    const FILETYPE_BY_PRODUCT_TYPE: { [productType: string]: XC_FILETYPE } = {
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


    return FILETYPE_BY_PRODUCT_TYPE[productType]
}

/**
 * Loads an in memory representation of a projct.pbxproj file,
 * allows manipulating that in memory representation, and then
 * saving it back to disk.
 * 
 * Used to be called pbxProject.
 */
export class XcProjectFileEditor extends EventEmitter {

    readonly filepath: string;

    hash?: IXcodeProjFile;
    writer?: PbxWriter;

    constructor(filename: string) {
        super();
        this.filepath = path.resolve(filename);
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
    parse(cb?: (result: Error | null, model: any) => void): this {

        if (cb) {
            this.on('error', cb);
            this.on('end', cb);
        }

        if (replaceParseWithParseSync) {
            // Required for any effective use of debugging in vscode.
            let error: any = null;
            try {
                this.parseSync();
            } catch (err) {
                error = err;
            }

            //  Schedule the callback to be somewhat close to a fork.
            //  We do this because we want this to behave the same during
            //  debug session as in a normal session that performs the actual fork.
            setTimeout(() => {
                const modelHash = this.hash; // (debugging easier)
                const retErr = error; // Pull out of closure (debugging easier)

                // Check SyntaxError and code to keep logically in sync with fork code.
                //  It is probably unnecessary.
                if (retErr != null && (retErr.name == 'SyntaxError' || retErr.code)) { 
                    this.emit('error', retErr);
                } else {
                    this.emit('end', null, modelHash);
                }
            }, 1);

        } else {

            // Original logic of using fork assuming that the parse process is expensive 
            //  and eating valueable CPU cycles of the process modifying this file.
            var worker: ChildProcess = fork(__dirname + '/parseJob.js', [this.filepath])

            worker.on('message', (msg: any) => {
                if (msg.name == 'SyntaxError' || msg.code) {
                    this.emit('error', msg);
                } else {
                    this.hash = msg;
                    this.emit('end', null, msg)
                }
            });

            //}.bind(this));
        }

        return this;
    }

    /* sync version of parse.  This actually worked in my trials compared to the parse version
     which did not.  The parse version's implementation is an overeager optimization that attempts
     to perform the parsing in a forked process. */
    parseSync(): this {
        var file_contents = fs.readFileSync(this.filepath, 'utf-8');

        this.hash = parser.parse(file_contents);
        return this;
    }

    /*  Generate the contents of the project.pbxproj file.  Note, this does not
    write anything to disk. */
    writeSync(options?: PbxWriterOptions): string {
        this.writer = new PbxWriter(this.hash, options);
        return this.writer.writeSync();
    }


    /* Return all Uuids within all sections of the project */
    allUuids(): XC_PROJ_UUID[] {

        if (!this.hash)
            throw new Error('parse not completed');

        const sections: { [isaTypeKey: string]: Section } = this.hash.project.objects;
        let uuids: XC_PROJ_UUID[] = [];

        for (const key in sections) {
            const section: Section = sections[key]
            uuids = uuids.concat(Object.keys(section))
        }

        uuids = uuids.filter(function (key: XC_PROJ_UUID) {
            //  I am uncomfortable that this assumes there are objects in the dictionary
            //  other than a comment or a 24 long UUID.    But I found it this way and don't know
            //  that the parser may not find a non 24 charachter non comment.   Went all in and assumed
            //  it is 24 chars everywhere.
            // return !SectionUtils.dictKeyIsComment && str.length == 24;
            return SectionUtils.dictKeyIsUuid(key);
        });

        return uuids;
    }

    /** Return a new 24 charachter Uuid that does not already exist in the project */
    generateUuid(): XC_PROJ_UUID {
        const id = uuid.v4()
            .replace(/-/g, '')
            .substr(0, 24)
            .toUpperCase()

        if (this.allUuids().indexOf(id) >= 0) {
            return this.generateUuid();
        } else {
            return id;
        }
    }

    /** 
        * Add a plugin file if not already existing.
        * Also adds it to the PbxFileReference Section and the plugins PbxGroup
        * @returns null if file already exists.
        */
    addPluginFile(path: string, opt?: IPbxFileOptions | null): PbxFile | null {

        const file = new PbxFile(path, opt);

        file.plugin = true; // Assuming a client of this library uses this.  Leaving for no other reason.
        correctForPluginsPath(file, this);

        // null is better for early errors
        if (this.hasFile(file.path)) return null;

        file.fileRef = this.generateUuid();

        this.addToPbxFileReferenceSection(file);    // PBXFileReference
        this.addToPluginsPbxGroup(file);            // PBXGroup

        return file;
    }


    /** Inverse of addPluginFile.  Always returns a new instance if IPbxFile
     * that was removed.
     */
    removePluginFile(path: string, opt?: IPbxFileOptions | null): PbxFile {
        const file = new PbxFile(path, opt);
        correctForPluginsPath(file, this);

        this.removeFromPbxFileReferenceSection(file);    // PBXFileReference
        this.removeFromPluginsPbxGroup(file);            // PBXGroup

        return file;
    }

    /*  Similar to add plugin file but it is added to the ProductsPbxGroup */

    addProductFile(targetPath: string,
        opt?: (IPbxFileOptions &
        {
            /** This will override the default group.  */
            group?: FILETYPE_GROUP
        }
        ) | null): PbxFile {

        const file = new PbxFile(targetPath, opt);

        file.includeInIndex = 0;
        file.fileRef = this.generateUuid();
        file.target = opt ? opt.target : undefined;
        file.group = opt ? opt.group : undefined;
        file.uuid = this.generateUuid();
        file.path = file.basename;

        this.addToPbxFileReferenceSection(file);
        this.addToProductsPbxGroup(file);                // PBXGroup

        return file;
    }

    /** This removes this from the products group.  Oddly enough it does not
     * remove it from the PbxReferenceSection as a plugin file.  I don't know
     * why this is at the time of writing.
     */
    removeProductFile(path: string, opt?: IPbxFileOptions | null): PbxFile {
        const file = new PbxFile(path, opt);

        this.removeFromProductsPbxGroup(file);           // PBXGroup

        return file;
    }

    /**
     *
     * @param path {String}
     * @param opt {Object} see PbxFile for avail options
     * @param group {String} group key
     * @returns {Object} file; see PbxFile
     */
    addSourceFile(path: string, opt?: IPbxFileOptions, group?: string): PbxFile | false {
        let file;
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

        this.addToPbxBuildFileSection(file);        // PBXBuildFile
        this.addToPbxSourcesBuildPhase(file);       // PBXSourcesBuildPhase

        return file;
    }

    /**
     *
     * @param path {String}
     * @param opt {Object} see PbxFile for avail options
     * @param group {String} group key
     * @returns {Object} file; see PbxFile
     */
    removeSourceFile(path: string, opt?: IPbxFileOptions, group?: string | null): PbxFile {

        let file: PbxFile;

        if (group) {
            file = this.removeFile(path, group, opt);
        } else {
            file = this.removePluginFile(path, opt);
        }

        file.target = opt ? opt.target : undefined;
        this.removeFromPbxBuildFileSection(file);        // PBXBuildFile
        this.removeFromPbxSourcesBuildPhase(file);       // PBXSourcesBuildPhase

        return file;
    }

    /**
     *
     * @param path {String}
     * @param opt {Object} see pbxFile for avail options
     * @param group {String} group key
     * @returns {Object} file; see pbxFile
     */
    addHeaderFile(path: string, opt?: IPbxFileOptions, group?: string | null): PbxFile | null {
        if (group) {
            return this.addFile(path, group, opt);
        }
        else {
            return this.addPluginFile(path, opt);
        }
    }

    /**
     *
     * @param path {String}
     * @param opt {Object} see pbxFile for avail options
     * @param group {String} group key
     * @returns {Object} file; see pbxFile
     */
    removeHeaderFile(path: string, opt?: IPbxFileOptions | null, group?: string | null): PbxFile {
        if (group) {
            return this.removeFile(path, group, opt);
        }
        else {
            return this.removePluginFile(path, opt);
        }
    }

    /**
     *
     * @param path {String}
     * @param opt {Object} see pbxFile for avail options
     * @param group {String} group key
     * @returns {PbxFile} if added or false if it already existed.
     */
    addResourceFile(
        path: string,
        opt?: (IPbxFileOptions & { plugin?: boolean; variantGroup?: boolean }) | null,
        group?: XC_PROJ_UUID | null): PbxFile | false {

        opt = opt || {};

        let file: PbxFile | null | undefined;

        if (opt.plugin) {
            file = this.addPluginFile(path, opt);
            if (!file) return false;
        } else {
            file = new PbxFile(path, opt);
            if (this.hasFile(file.path)) return false;
        }

        file.uuid = this.generateUuid();
        file.target = opt ? opt.target : undefined;

        if (!opt.plugin) {
            correctForResourcesPath(file, this);
            file.fileRef = this.generateUuid();
        }

        if (!opt.variantGroup) {
            this.addToPbxBuildFileSection(file);        // PBXBuildFile
            this.addToPbxResourcesBuildPhase(file);     // PBXResourcesBuildPhase
        }

        if (!opt.plugin) {
            this.addToPbxFileReferenceSection(file);    // PBXFileReference
            if (group) {
                if (this.getPBXGroupByKey(group)) {
                    this.addToPbxGroup(file, group);        //Group other than Resources (i.e. 'splash')
                }
                else if (this.getPBXVariantGroupByKey(group)) {
                    this.addToPbxVariantGroup(file, group);  // PBXVariantGroup
                }
            }
            else {
                this.addToResourcesPbxGroup(file);          // PBXGroup
            }

        }

        return file;
    }

    /**
     *
     * @param path {String}
     * @param opt {Object} see pbxFile for avail options
     * @param groupUuid {String} group key
     * @returns {Object} file; see pbxFile
     */
    removeResourceFile(path: string, opt?: IPbxFileOptions | null, groupUuid?: XC_PROJ_UUID): PbxFile {
        var file = new PbxFile(path, opt);
        file.target = opt ? opt.target : undefined;

        correctForResourcesPath(file, this);

        this.removeFromPbxBuildFileSection(file);        // PBXBuildFile
        this.removeFromPbxFileReferenceSection(file);    // PBXFileReference

        if (groupUuid) {
            if (this.getPBXGroupByKey(groupUuid)) {
                this.removeFromPbxGroup(file, groupUuid);        //Group other than Resources (i.e. 'splash')
            }
            else if (this.getPBXVariantGroupByKey(groupUuid)) {
                this.removeFromPbxVariantGroup(file, groupUuid);  // PBXVariantGroup
            }
        }
        else {
            this.removeFromResourcesPbxGroup(file);          // PBXGroup
        }

        this.removeFromPbxResourcesBuildPhase(file);     // PBXResourcesBuildPhase

        return file;
    }

    addFramework(fpath: string,
        opt?: (IPbxFileOptions &
        {
            /** defaults to true if not specified. */
            link?: boolean
        }
        ) | null): PbxFile | false {

        //  We capture these early since the option is modified after calling.
        const customFramework: boolean = !!(opt && opt.customFramework == true);
        const link: boolean = !opt || (opt.link == undefined || opt.link);    //defaults to true if not specified
        const embed: boolean = !!(opt && opt.embed);                              //defaults to false if not specified

        if (opt) {
            delete opt.embed;
        }

        var file = new PbxFile(fpath, opt);

        file.uuid = this.generateUuid();
        file.fileRef = this.generateUuid();
        file.target = opt ? opt.target : undefined;

        if (this.hasFile(file.path)) return false;

        this.addToPbxBuildFileSection(file);        // PBXBuildFile
        this.addToPbxFileReferenceSection(file);    // PBXFileReference
        this.addToFrameworksPbxGroup(file);         // PBXGroup

        if (link) {
            this.addToPbxFrameworksBuildPhase(file);    // PBXFrameworksBuildPhase
        }

        if (opt && customFramework) { // extra check on opt is for Typescript, not logically required
            this.addToFrameworkSearchPaths(file);

            if (embed) {
                opt.embed = embed;
                var embeddedFile = new PbxFile(fpath, opt);

                embeddedFile.uuid = this.generateUuid();
                embeddedFile.fileRef = file.fileRef;

                //keeping a separate PBXBuildFile entry for Embed Frameworks
                this.addToPbxBuildFileSection(embeddedFile);        // PBXBuildFile

                this.addToPbxEmbedFrameworksBuildPhase(embeddedFile); // PBXCopyFilesBuildPhase

                return embeddedFile;
            }
        }

        return file;
    }

    removeFramework(fpath: string, opt?: IPbxFileOptions | null): PbxFile {
        //  This was calculated in the original code, but never used.  Error?  10/2019
        //const embed:boolean = !!(opt && opt.embed);

        if (opt) {
            delete opt.embed;
        }

        const file = new PbxFile(fpath, opt);
        file.target = opt ? opt.target : undefined;

        this.removeFromPbxBuildFileSection(file);          // PBXBuildFile
        this.removeFromPbxFileReferenceSection(file);      // PBXFileReference
        this.removeFromFrameworksPbxGroup(file);           // PBXGroup
        this.removeFromPbxFrameworksBuildPhase(file);      // PBXFrameworksBuildPhase

        if (opt && opt.customFramework) {
            this.removeFromFrameworkSearchPaths(file);
        }

        opt = opt || {};
        opt.embed = true;
        var embeddedFile = new PbxFile(fpath, opt);

        embeddedFile.fileRef = file.fileRef;

        this.removeFromPbxBuildFileSection(embeddedFile);          // PBXBuildFile
        this.removeFromPbxEmbedFrameworksBuildPhase(embeddedFile); // PBXCopyFilesBuildPhase

        return file;
    }


    addCopyfile(fpath: string, opt?: IPbxFileOptions | null): PbxFile {

        let file: PbxFile = new PbxFile(fpath, opt);

        // catch duplicates
        let existingFile: PBXFileReference | false = this.hasFile(file.path);

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
            file = existingFile as any as PbxFile;
        }

        file.fileRef = file.uuid = this.generateUuid();
        file.target = opt ? opt.target : undefined;

        this.addToPbxBuildFileSection(file);        // PBXBuildFile
        this.addToPbxFileReferenceSection(file);    // PBXFileReference
        this.addToPbxCopyfilesBuildPhase(file);     // PBXCopyFilesBuildPhase

        return file;
    }

    pbxCopyfilesBuildPhaseObj(target?: XC_PROJ_UUID | null): PBXCopyFilesBuildPhase | null {
        return this.buildPhaseObject('PBXCopyFilesBuildPhase', 'Copy Files', target);
    }

    addToPbxCopyfilesBuildPhase(file: PbxFile): void {
        const sources =
            this.buildPhaseObject<PBXCopyFilesBuildPhase>('PBXCopyFilesBuildPhase',
                'Copy Files', file.target) as PBXCopyFilesBuildPhase;

        if (!sources) {
            throw new Error('target not found');
        }

        sources.files.push(pbxBuildPhaseObj(file));
    }

    removeCopyfile(fpath: string, opt: IPbxFileOptions) {
        var file = new PbxFile(fpath, opt);
        file.target = opt ? opt.target : undefined;

        this.removeFromPbxBuildFileSection(file);        // PBXBuildFile
        this.removeFromPbxFileReferenceSection(file);    // PBXFileReference
        this.removeFromPbxCopyfilesBuildPhase(file);    // PBXFrameworksBuildPhase

        return file;
    }

    removeFromPbxCopyfilesBuildPhase(file: PbxFile): void {
        const sources: PBXCopyFilesBuildPhase | null = this.pbxCopyfilesBuildPhaseObj(file.target);

        if (!sources) // Nothing to remove it from.
            return;

        for (let i in sources.files) {
            if (sources.files[i].comment == longComment(file as ILongCommentObj)) {
                sources.files.splice(i as unknown as number, 1);
                break;
            }
        }
    }

    addStaticLibrary(
        path: string,
        opt?: (IPbxFileOptions & { plugin?: boolean }) | null): PbxFile | false {

        opt = opt || {};

        let file: PbxFile | null;

        if (opt.plugin) {
            file = this.addPluginFile(path, opt);
            if (!file) return false;
        } else {
            file = new PbxFile(path, opt);
            if (this.hasFile(file.path)) return false;
        }

        file.uuid = this.generateUuid();
        file.target = opt ? opt.target : undefined;

        if (!opt.plugin) {
            file.fileRef = this.generateUuid();
            this.addToPbxFileReferenceSection(file);    // PBXFileReference
        }

        this.addToPbxBuildFileSection(file);        // PBXBuildFile
        this.addToPbxFrameworksBuildPhase(file);    // PBXFrameworksBuildPhase
        this.addToLibrarySearchPaths(file);        // make sure it gets built!

        return file;
    }

    // helper addition functions
    addToPbxBuildFileSection(file: IFilePathObj): void {

        // removed test on file.group needing to be set.
        //  This was failing a test.  For now, let it pass 
        //  until we know for sure that the test was invalid and not the assumption 
        //  that group must be set.
        if (!file.uuid) { //  || !file.group)  {
            throw new Error('uuid or group not set!');
        }

        SectionUtils.entrySetWUuid(
            this.pbxBuildFileSection(),
            file.uuid,
            pbxBuildFileObj(file),
            pbxBuildFileComment(file as ILongCommentObj));

        // const commentKey: string = createUuidCommentKey(file.uuid);
        // // var commentKey = f("%s_comment", file.uuid);

        // this.pbxBuildFileSection()[file.uuid] = pbxBuildFileObj(file);

        // //  I believe TS should have allowed ILongCommentObj without cast due to previos check on group.  
        // //  Forced it.
        // this.pbxBuildFileSection()[commentKey] = pbxBuildFileComment(file as ILongCommentObj);
    }

    /**
     * Find the PBXBuildFile that is associated with this file based 
     * on the basename.
     * 
     * If found, set the file's uuid to the found PBXBuildFile instance and 
     * delete the PBXBuildFile and its comments from the collection.
     * @param file 
     */
    removeFromPbxBuildFileSection(file: PbxFile): void {
        const section: TypedSection<PBXBuildFile> = this.pbxBuildFileSection();

        for (let uuid in section) { // uuid is a uuid or a comment key
            const buildFile: PBXBuildFile | string | undefined = section[uuid];

            if (typeof buildFile == "object" && buildFile.fileRef_comment == file.basename) {
                //  if buildFile is an object, then this is not a comment.
                file.uuid = uuid;

                SectionUtils.entryDeleteWUuid(section, uuid);
                // delete section[uuid];

                // const commentKey = createUuidCommentKey(uuid);
                // delete section[commentKey];
            }
        }
    }

    addPbxGroup(
        filePathsArray: string[],
        name: string,
        path?: string,
        sourceTree?: XC_SOURCETREE | null): { uuid: XC_PROJ_UUID, pbxGroup: PBXGroup } {

        const fileReferenceSection: TypedSection<PBXFileReference> = this.pbxFileReferenceSection();

        //  Build a dictionary of filePath to IPbxGroupChildFileInfo for all PBXFileReference objects
        const filePathToReference: { [filePath: string]: IPbxGroupChildFileInfo } = {};
        for (let key in fileReferenceSection) {
            // only look for comments
            if (SectionUtils.dictKeyIsComment(key)) {

                // const fileReferenceKey: string = key.split(COMMENT_KEY)[0];
                const fileReferenceKey: XC_PROJ_UUID = SectionUtils.dictKeyCommentToUuid(key);
                const fileReference: PBXFileReference = fileReferenceSection[fileReferenceKey] as PBXFileReference;

                filePathToReference[fileReference.path] = { fileRef: fileReferenceKey, basename: fileReferenceSection[key] as string };
            }
        }

        const pbxGroup: PBXGroup = {
            isa: cPBXGroup,
            children: [],
            name: name,
            path: path,
            sourceTree: sourceTree ? sourceTree : '"<group>"'
        };

        for (let index = 0; index < filePathsArray.length; index++) {
            const filePath = filePathsArray[index];
            const filePathQuoted = "\"" + filePath + "\"";

            if (filePathToReference[filePath]) {
                pbxGroup.children.push(pbxGroupChild(filePathToReference[filePath]));
            } else if (filePathToReference[filePathQuoted]) {
                pbxGroup.children.push(pbxGroupChild(filePathToReference[filePathQuoted]));
            } else {
                var file = new PbxFile(filePath);
                file.uuid = this.generateUuid();
                file.fileRef = this.generateUuid();
                this.addToPbxFileReferenceSection(file);    // PBXFileReference
                this.addToPbxBuildFileSection(file);        // PBXBuildFile
                pbxGroup.children.push(pbxGroupChild(file as IPbxGroupChildFileInfo));
            }
        }

        const groups: TypedSection<PBXGroup> = this.pbxGroupsSection();

        const pbxGroupUuid: XC_PROJ_UUID = this.generateUuid();

        SectionUtils.entrySetWUuid(groups, pbxGroupUuid, pbxGroup, name);
        // const commentKey: string = SectionUtils.dictKeyUuidToComment(pbxGroupUuid);

        // groups[pbxGroupUuid] = pbxGroup;
        // groups[commentKey] = name;

        return { uuid: pbxGroupUuid, pbxGroup: pbxGroup };
    }

    removePbxGroup(groupName: string): void {
        const section: TypedSection<PBXGroup> = this.pbxGroupsSection();

        SectionUtils.entryDeleteWCommentText(section, groupName);

        // for (let key in section) {
        //     // only look for comments
        //     if (!COMMENT_KEY.test(key)) continue;

        //     if (section[key] == groupName) { // The comment is the passed in name of the group.
        //         const itemKey: XC_PROJ_UUID = key.split(COMMENT_KEY)[0]; // get the Uuid
        //         delete section[itemKey];
        //     }
        // }
    }

    addToPbxProjectSection(target: INativeTargetWrapper): void {

        const newTarget: IChildListEntry = {
            value: target.uuid,
            comment: pbxNativeTargetComment(target.pbxNativeTarget)
        };

        //  the return type already includes the project it is regetting here.
        //this.pbxProjectSection()[this.getFirstProject()['uuid']]['targets'].push(newTarget);

        this.getFirstProject().firstProject.targets.push(newTarget);
    }

    addToPbxNativeTargetSection(target: INativeTargetWrapper): void {

        SectionUtils.entrySetWUuid(
            this.pbxNativeTargetSection(),
            target.uuid,
            target.pbxNativeTarget,
            target.pbxNativeTarget.name);

        //     var commentKey = dictKeyUuidToComment(target.uuid);

        //     this.pbxNativeTargetSection()[target.uuid] = target.pbxNativeTarget;
        //     this.pbxNativeTargetSection()[commentKey] = target.pbxNativeTarget.name;
    }

    addToPbxFileReferenceSection(file: PbxFile): void {

        if (!file.fileRef)
            throw new Error("fileRef not set.");

        SectionUtils.entrySetWUuid(
            this.pbxFileReferenceSection(),
            file.fileRef,
            pbxFileReferenceObj(file),
            pbxFileReferenceComment(file));

        // var commentKey = dictKeyUuidToComment(file.fileRef);

        // this.pbxFileReferenceSection()[file.fileRef] = pbxFileReferenceObj(file);
        // this.pbxFileReferenceSection()[commentKey] = pbxFileReferenceComment(file);
    }

    /**
     * Search for a reference to this file from the PBXFileReference section.
     * The match is made by either the basename or path matching.
     * 
     * (It appears that this should be a concern to you if you have files with the same name
     * in different folders.)
     * 
     * @param file 
     */
    removeFromPbxFileReferenceSection(file: PbxFile): PbxFile {

        //  Create a template object (not added to model) for comparison
        var refObj: PBXFileReference = pbxFileReferenceObj(file);

        const section: TypedSection<PBXFileReference> = this.pbxFileReferenceSection();

        for (let i in section) {
            const existing: PBXFileReference | string = section[i];
            if (typeof existing == "object" &&
                (existing.name == refObj.name ||
                    ('"' + existing.name + '"') == refObj.name ||
                    existing.path == refObj.path ||
                    ('"' + existing.path + '"') == refObj.path)) {

                //  Pass this back to the caller.  But it is also used
                //  to delete the comment below.
                file.fileRef = file.uuid = i;

                SectionUtils.entryDeleteWUuid(section, i);
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
    }

    addToXcVersionGroupSection(file: PbxFile & IDataModelDocumentFile): void {

        if (!file.models || !file.currentModel) {
            throw new Error("Cannot create a XCVersionGroup section from not a data model document file");
        }

        if (!file.fileRef || !file.currentModel.fileRef) {
            throw new Error('Fileref not set.');
        }

        const section = this.xcVersionGroupSection();

        if (!section[file.fileRef]) {
            const newVersionGroup: XCVersionGroup = {
                isa: 'XCVersionGroup',
                children: file.models.map(function (el: PbxFile) { return el.fileRef as XC_PROJ_UUID; }),
                currentVersion: file.currentModel.fileRef,
                name: path.basename(file.path),
                path: file.path,
                sourceTree: '"<group>"',
                versionGroupType: 'wrapper.xcdatamodel'
            };

            SectionUtils.entrySetWUuid(section, file.fileRef, newVersionGroup, path.basename(file.path));

            // var commentKey = dictKeyUuidToComment(file.fileRef);
            // this.xcVersionGroupSection()[file.fileRef] = newVersionGroup;
            // this.xcVersionGroupSection()[commentKey] = path.basename(file.path);
        }
    }

    addToOrCreate_PBXGroup_WithName(file: PbxFile, groupName: string): void {

        const pbxGroup: PBXGroup | null = this.pbxGroupByName(groupName);
        if (!pbxGroup) {
            this.addPbxGroup([file.path], groupName);
        } else {
            pbxGroup.children.push(pbxGroupChild(file));
        }
    }

    removeFrom_PBXGroup_WithName(file: PbxFile, groupName: string): void {
        const pbxGroup: PBXGroup | null = this.pbxGroupByName(groupName);
        if (!pbxGroup) {
            return;
        }

        const matchChild: IChildListEntry = pbxGroupChild(file);
        const pluginsGroupChildren: IChildListEntry[] = pbxGroup.children;
        for (let i in pluginsGroupChildren) {
            if (matchChild.value == pluginsGroupChildren[i].value &&
                matchChild.comment == pluginsGroupChildren[i].comment) {
                pluginsGroupChildren.splice(i as unknown as number, 1);
                break;
            }
        }
    }

    addToPluginsPbxGroup(file: PbxFile): void {
        this.addToOrCreate_PBXGroup_WithName(file, 'Plugins');
        // const pluginsGroup: PBXGroup | null = this.pbxGroupByName('Plugins');
        // if (!pluginsGroup) {
        //     this.addPbxGroup([file.path], 'Plugins');
        // } else {
        //     pluginsGroup.children.push(pbxGroupChild(file));
        // }
    }

    removeFromPluginsPbxGroup(file: PbxFile): void {
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
    }

    addToResourcesPbxGroup(file: PbxFile): void {
        this.addToOrCreate_PBXGroup_WithName(file, 'Resources');

        // const pluginsGroup:PBXGroup | null = this.pbxGroupByName('Resources');

        // if (!pluginsGroup) {
        //     this.addPbxGroup([file.path], 'Resources');
        // } else {
        //     pluginsGroup.children.push(pbxGroupChild(file));
        // }
    }

    removeFromResourcesPbxGroup(file: PbxFile): void {
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
    }

    addToFrameworksPbxGroup(file: PbxFile): void {
        this.addToOrCreate_PBXGroup_WithName(file, 'Frameworks');
        // var pluginsGroup = this.pbxGroupByName('Frameworks');
        // if (!pluginsGroup) {
        //     this.addPbxGroup([file.path], 'Frameworks');
        // } else {
        //     pluginsGroup.children.push(pbxGroupChild(file));
        // }
    }

    removeFromFrameworksPbxGroup(file: PbxFile): void {
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
    }

    addToProductsPbxGroup(file: PbxFile): void {
        this.addToOrCreate_PBXGroup_WithName(file, 'Products');
        // var productsGroup = this.pbxGroupByName('Products');
        // if (!productsGroup) {
        //     this.addPbxGroup([file.path], 'Products');
        // } else {
        //     productsGroup.children.push(pbxGroupChild(file));
        // }
    }

    removeFromProductsPbxGroup(file: PbxFile): void {
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
    }

    private pf_addToBuildPhase(buildPhase: PBXBuildPhaseBase | null, file: IFilePathObj): void {

        if (!buildPhase) {
            throw new Error('buildPhase not found!');
        }

        buildPhase.files.push(pbxBuildPhaseObj(file));
    }

    private pf_removeFromBuildPhase(buildPhase: PBXBuildPhaseBase | null, file: PbxFile): void {

        if (!buildPhase)
            return;

        //  NOTE:  There were two different duplicated sets of code that
        //  mostly did the same thing.  One used splice after finding one item.
        //  The one we kept assumes the comment may exist multiple times.
        //  Could be issues if some places held the original files handle that
        //  was using splice.
        //  Prefer to have this DRY and clean it up later if there is an issue.
        const files: IChildListEntry[] = [];
        const fileComment: string = longComment(file);

        for (let i in buildPhase.files) {
            if (buildPhase.files[i].comment != fileComment) {
                files.push(buildPhase.files[i]);
            }
        }

        buildPhase.files = files;
    }


    addToPbxEmbedFrameworksBuildPhase(file: PbxFile): void {

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
    }

    removeFromPbxEmbedFrameworksBuildPhase(file: PbxFile): void {

        this.pf_removeFromBuildPhase(
            this.pbxEmbedFrameworksBuildPhaseObj(file.target),
            file);

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
    }

    addToPbxSourcesBuildPhase(file: PbxFile): void {

        this.pf_addToBuildPhase(
            this.pbxSourcesBuildPhaseObj(file.target),
            file);

        // const sources = this.pbxSourcesBuildPhaseObj(file.target,
        //     eHandleNotFound.throw) as PBXSourcesBuildPhase;

        // sources.files.push(pbxBuildPhaseObjThrowIfInvalid(file));
    }

    removeFromPbxSourcesBuildPhase(file: PbxFile): void {

        this.pf_removeFromBuildPhase(
            this.pbxSourcesBuildPhaseObj(file.target),
            file);

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
    }

    addToPbxResourcesBuildPhase(file: IFilePathObj & { target?: XC_PROJ_UUID | null }): void {

        this.pf_addToBuildPhase(
            this.pbxResourcesBuildPhaseObj(file.target),
            file);
        // var sources = this.pbxResourcesBuildPhaseObj(file.target);
        // sources.files.push(pbxBuildPhaseObj(file));
    }

    removeFromPbxResourcesBuildPhase(file: PbxFile): void {

        this.pf_removeFromBuildPhase(
            this.pbxResourcesBuildPhaseObj(file.target),
            file);

        //  Warning:  New implementation creates a new array instead of
        //  splicing the existing one.  This could cause an issue with client code.
        // var sources = this.pbxResourcesBuildPhaseObj(file.target), i;

        // for (i in sources.files) {
        //     if (sources.files[i].comment == longComment(file)) {
        //         sources.files.splice(i, 1);
        //         break;
        //     }
        // }
    }

    addToPbxFrameworksBuildPhase(file: PbxFile): void {

        this.pf_addToBuildPhase(
            this.pbxFrameworksBuildPhaseObj(file.target),
            file);

        // var sources = this.pbxFrameworksBuildPhaseObj(file.target);
        // sources.files.push(pbxBuildPhaseObjThrowIfInvalid(file));
    }

    removeFromPbxFrameworksBuildPhase(file: PbxFile): void {

        this.pf_removeFromBuildPhase(
            this.pbxFrameworksBuildPhaseObj(file.target),
            file);

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
    }

    addXCConfigurationList(
        configurationObjectsArray: XCBuildConfiguration[],
        defaultConfigurationName: string,
        comment: string): IConfigurationListWrapper {

        const pbxBuildConfigurationSection: TypedSection<XCBuildConfiguration> =
            this.xcBuildConfigurationSection();

        const xcConfigurationList: XCConfigurationList = {
            isa: 'XCConfigurationList',
            buildConfigurations: [],
            defaultConfigurationIsVisible: 0,
            defaultConfigurationName: defaultConfigurationName
        };

        for (let index = 0; index < configurationObjectsArray.length; index++) {
            const configuration = configurationObjectsArray[index];

            const configurationUuid: XC_PROJ_UUID = this.generateUuid();

            SectionUtils.entrySetWUuid(pbxBuildConfigurationSection, configurationUuid, configuration, configuration.name);
            // pbxBuildConfigurationSection[configurationUuid] = configuration;
            //     configurationCommentKey = dictKeyUuidToComment(configurationUuid);
            // pbxBuildConfigurationSection[configurationCommentKey] = configuration.name;

            xcConfigurationList.buildConfigurations.push({ value: configurationUuid, comment: configuration.name });
        }

        const xcConfigurationListUuid: XC_PROJ_UUID = this.generateUuid();

        SectionUtils.entrySetWUuid(this.xcConfigurationList(), xcConfigurationListUuid, xcConfigurationList, comment);

        // const pbxXCConfigurationListSection: TypedSection<XCConfigurationList> =
        //     this.pbxXCConfigurationList();
        // const commentKey: string = dictKeyUuidToComment(xcConfigurationListUuid);
        // if (pbxXCConfigurationListSection) {
        //     pbxXCConfigurationListSection[xcConfigurationListUuid] = xcConfigurationList;
        //     pbxXCConfigurationListSection[commentKey] = comment;
        // }

        const wrapper: IConfigurationListWrapper = { uuid: xcConfigurationListUuid, xcConfigurationList: xcConfigurationList };
        return wrapper;
    }

    addTargetDependency(target: XC_PROJ_UUID, dependencyTargets: XC_PROJ_UUID[]): INativeTargetWrapper2 | undefined {

        if (!target)
            return undefined;
        //         throw new Error('No target specified!'); I had thought it made more sense to throw an error.  But a test dictates this returns undefined.
        //  To maintain compatibility with the original version, restoring eating the invalid call. 

        const nativeTargets: TypedSection<PBXNativeTarget> = this.pbxNativeTargetSection();
        const nativeTarget: PBXNativeTarget | string | undefined = nativeTargets[target];

        if (typeof nativeTarget != "object") // switched from != undefined to == object to deal with the possibility someone passed in a comment key
            throw new Error("Invalid target: " + target);

        for (var index = 0; index < dependencyTargets.length; index++) {
            const dependencyTarget = dependencyTargets[index];
            if (typeof nativeTargets[dependencyTarget] != "object") // switched from == "undefined" to != "object" to handle comment keys
                throw new Error("Invalid target: " + dependencyTarget);
        }

        const pbxTargetDependencySection: TypedSection<PBXTargetDependency> = this.pbxTargetDependencySection();
        const pbxContainerItemProxySection: TypedSection<PBXContainerItemProxy> = this.pbxContainerItemProxySection();

        if (!this.hash)  //  Assure TS we can access project.
            throw new Error('Not loaded');

        const project: IProject = this.hash.project;

        for (var index = 0; index < dependencyTargets.length; index++) {

            const dependencyTargetUuid: XC_PROJ_UUID = dependencyTargets[index];
            const dependencyTargetCommentKey: XC_COMMENT_KEY = SectionUtils.dictKeyUuidToComment(dependencyTargetUuid);

            const targetDependencyUuid: XC_PROJ_UUID = this.generateUuid();
            // const targetDependencyCommentKey :XC_COMMENT_KEY = SectionUtils.dictKeyUuidToComment(targetDependencyUuid);

            const itemProxyUuid: XC_PROJ_UUID = this.generateUuid();
            // const itemProxyCommentKey:XC_COMMENT_KEY = SectionUtils.dictKeyUuidToComment(itemProxyUuid);

            const itemProxy: PBXContainerItemProxy = {
                isa: cPBXContainerItemProxy,
                containerPortal: project['rootObject'],
                containerPortal_comment: project['rootObject_comment'],
                proxyType: 1,
                remoteGlobalIDString: dependencyTargetUuid,
                remoteInfo: (nativeTargets[dependencyTargetUuid] as PBXNativeTarget).name
            };

            const targetDependency: PBXTargetDependency = {
                isa: cPBXTargetDependency,
                target: dependencyTargetUuid,
                target_comment: nativeTargets[dependencyTargetCommentKey] as string,
                targetProxy: itemProxyUuid,
                targetProxy_comment: cPBXContainerItemProxy
            };

            //  We now create the sections if they don't exist.  So we don't check if they are set here.
            //            if (pbxContainerItemProxySection && pbxTargetDependencySection) {

            SectionUtils.entrySetWUuid(pbxContainerItemProxySection, itemProxyUuid, itemProxy, cPBXContainerItemProxy);
            // pbxContainerItemProxySection[itemProxyUuid] = itemProxy;
            // pbxContainerItemProxySection[itemProxyCommentKey] = cPBXContainerItemProxy;

            SectionUtils.entrySetWUuid(pbxTargetDependencySection, targetDependencyUuid, targetDependency, cPBXTargetDependency);
            // pbxTargetDependencySection[targetDependencyUuid] = targetDependency;
            // pbxTargetDependencySection[targetDependencyCommentKey] = cPBXTargetDependency;

            nativeTarget.dependencies.push({ value: targetDependencyUuid, comment: cPBXTargetDependency })
            //           }
        }

        return { uuid: target, target: nativeTarget };
    }

    /**
     * 
     * @param filePathsArray 
     * @param buildPhaseType 
     * @param comment 
     * @param target UUID of PBXNativeTarget
     * @param optionsOrFolderType A string for "Copy Files" and Options for "Shell Script" build phases.
     * @param subfolderPath 
     */
    addBuildPhase(
        filePathsArray: string[],
        //  Don't know if this was meant to handle additional phases or not.  
        //  left to only support these two types.
        buildPhaseType: 'PBXCopyFilesBuildPhase' | 'PBXShellScriptBuildPhase',
        comment: string,
        target: XC_PROJ_UUID | null | undefined,
        optionsOrFolderType: string | IPbxShellScriptBuildPhaseOptions,
        subfolderPath?: string | null): IBuildPhaseWrapper {

        const buildFileSection: TypedSection<PBXBuildFile> = this.pbxBuildFileSection();

        let buildPhase: PBXBuildPhaseBase = {
            isa: buildPhaseType,
            buildActionMask: 2147483647,
            files: [],
            runOnlyForDeploymentPostprocessing: 0
        };


        if (buildPhaseType === cPBXCopyFilesBuildPhase) {
            if (typeof optionsOrFolderType != 'string')
                throw new Error(`Invalid folder type for '${cPBXCopyFilesBuildPhase}'`);

            buildPhase = pbxCopyFilesBuildPhaseObj(buildPhase, optionsOrFolderType, subfolderPath, comment);
        } else if (buildPhaseType === cPBXShellScriptBuildPhase) {
            if (typeof optionsOrFolderType != 'object')
                throw new Error(`Invalid folder type for '${cPBXShellScriptBuildPhase}'`);

            buildPhase = pbxShellScriptBuildPhaseObj(buildPhase, optionsOrFolderType, comment)
        }

        // I don't know if this is supposed to handle other build phase types.  Assuming not.
        //  Will function the same when called from javascript, but indicate an error when
        //  calling from typescript sicne we specify only these two phases.


        const buildPhaseUuid: XC_PROJ_UUID = this.generateUuid();

        //  This was being done twice!  Doing it at the end.
        // const commentKey: string = createUuidCommentKey(buildPhaseUuid);
        // // if (!this.hash.project.objects[buildPhaseType][buildPhaseUuid]) { removed this check as this is impossible
        // buildPhaseSection[buildPhaseUuid] = buildPhase;
        // buildPhaseSection[commentKey] = comment;
        // SectionUtils.entrySetWUuid<PBXBuildPhaseBase>(buildPhaseSection, buildPhaseUuid, buildPhase, comment);

        const buildPhaseTargetUuid: XC_PROJ_UUID = target || this.getFirstTarget().uuid;

        const nativeTarget: PBXNativeTarget | null = SectionUtils.entryGetWUuid(this.pbxNativeTargetSection(), buildPhaseTargetUuid);

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

        const fileReferenceSection: TypedSection<PBXFileReference> = this.pbxFileReferenceSection();

        //  Load the filePathToBuildFile dictionary
        const filePathToBuildFile: { [path: string]: IFilePathObj } = {};
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
            if (SectionUtils.dictKeyIsComment(key)) {

                const buildFileKey: XC_PROJ_UUID = SectionUtils.dictKeyCommentToUuid(key);
                const buildFile: PBXBuildFile = buildFileSection[buildFileKey] as PBXBuildFile;
                const fileReference: PBXFileReference | undefined | string = fileReferenceSection[buildFile.fileRef];

                if (typeof fileReference == "object") {
                    const pbxFileObj = new PbxFile(fileReference.path);

                    filePathToBuildFile[fileReference.path] = { uuid: buildFileKey, basename: pbxFileObj.basename, group: pbxFileObj.group };
                }
            }
        }

        for (var index = 0; index < filePathsArray.length; index++) {
            var filePath = filePathsArray[index],
                filePathQuoted = "\"" + filePath + "\"",
                file = new PbxFile(filePath);

            if (filePathToBuildFile[filePath]) {
                buildPhase.files.push(pbxBuildPhaseObj(filePathToBuildFile[filePath]));
                continue;
            } else if (filePathToBuildFile[filePathQuoted]) {
                buildPhase.files.push(pbxBuildPhaseObj(filePathToBuildFile[filePathQuoted]));
                continue;
            }

            file.uuid = this.generateUuid();
            file.fileRef = this.generateUuid();
            this.addToPbxFileReferenceSection(file);    // PBXFileReference
            this.addToPbxBuildFileSection(file);        // PBXBuildFile
            buildPhase.files.push(pbxBuildPhaseObj(file));
        }

        //  This is one of the build phase sections.  There are several.
        const buildPhaseSection: TypedSection<PBXBuildPhaseBase> =
            this.pf_sectionGetOrCreate<PBXBuildPhaseBase>(buildPhaseType);

        SectionUtils.entrySetWUuid<PBXBuildPhaseBase>(buildPhaseSection, buildPhaseUuid, buildPhase, comment);
        // if (buildPhaseSection) {
        //     buildPhaseSection[buildPhaseUuid] = buildPhase;
        //     buildPhaseSection[commentKey] = comment;
        // }

        return { uuid: buildPhaseUuid, buildPhase: buildPhase };
    }

    //  Implementation change:  10/2019 it used to be only XCVersionGroup would
    //  create a section.  Now all missing sections are created.
    private pf_sectionGetOrCreate<PBX_OBJ_TYPE extends PBXObjectBase>(sectionName: ISA_TYPE): TypedSection<PBX_OBJ_TYPE> {

        if (!this.hash) {
            throw new Error('Not Loaded');
        }

        if (typeof this.hash.project.objects[sectionName] !== 'object') {
            this.hash.project.objects[sectionName] = {};
        }

        return this.hash.project.objects[sectionName] as TypedSection<PBX_OBJ_TYPE>;
    }

    pbxGroupsSection(): TypedSection<PBXGroup> {
        return this.pf_sectionGetOrCreate<PBXGroup>(cPBXGroup);
    }

    pbxVariantGroupsSection(): TypedSection<PBXVariantGroup> {
        return this.pf_sectionGetOrCreate<PBXVariantGroup>(cPBXVariantGroup);
    }
    // helper access functions
    pbxProjectSection(): TypedSection<PBXProject> {
        return this.pf_sectionGetOrCreate<PBXProject>(cPBXProject);
    }

    pbxBuildFileSection(): TypedSection<PBXBuildFile> {
        return this.pf_sectionGetOrCreate(cPBXBuildFile);
    }

    pbxFileReferenceSection(): TypedSection<PBXFileReference> {
        return this.pf_sectionGetOrCreate<PBXFileReference>(cPBXFileReference);
    }

    pbxNativeTargetSection(): TypedSection<PBXNativeTarget> {
        return this.pf_sectionGetOrCreate(cPBXNativeTarget);
    }

    pbxTargetDependencySection(): TypedSection<PBXTargetDependency> {
        return this.pf_sectionGetOrCreate(cPBXTargetDependency);
    }

    pbxContainerItemProxySection(): TypedSection<PBXContainerItemProxy> {
        return this.pf_sectionGetOrCreate(cPBXContainerItemProxy);
    }

    //  This was the original name that I did not think made sense.  Tests use
    //  this so I put it back to call the new function name.
    pbxXCBuildConfigurationSection(): TypedSection<XCBuildConfiguration> {
        return this.xcBuildConfigurationSection();
    }

    xcBuildConfigurationSection(): TypedSection<XCBuildConfiguration> {
        return this.pf_sectionGetOrCreate(cXCBuildConfiguration);
    }

    //  Inconsistent naming of not having pbx in front existed when found.
    //  left in case client was using this.
    xcVersionGroupSection(): TypedSection<XCVersionGroup> {
        return this.pf_sectionGetOrCreate(cXCVersionGroup);
    }

    //  This was the original name that I did not think made sense.  Tests use
    //  this so I put it back to call the new function name.
    pbxXCConfigurationList(): TypedSection<XCConfigurationList> {
        return this.xcConfigurationList();
    }

    xcConfigurationList(): TypedSection<XCConfigurationList> {
        return this.pf_sectionGetOrCreate(cXCConfigurationList);
    }

    pbxGroupByName(name: string): PBXGroup | null {

        return SectionUtils.entryGetWCommentText(this.pbxGroupsSection(), name);

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
    }

    pbxTargetByName(name: string): PBXNativeTarget | null {
        return SectionUtils.entryGetWCommentText(this.pbxNativeTargetSection(), name);
        // return this.pbxItemByComment(name, 'PBXNativeTarget');
    }

    /**
     * Search the PBXNativeTarget objects for one with the passed in name.
     * Return the UUID if it exists.  Otherwise return null.
     * @param name 
     */
    findTargetKey(name: string): XC_PROJ_UUID | null {
        const targets: TypedSection<PBXNativeTarget> = this.pbxNativeTargetSection();

        for (let key in targets) {
            if (!SectionUtils.dictKeyIsComment(key)) {
                const target: PBXNativeTarget = targets[key] as PBXNativeTarget;
                if (target.name === name) {
                    return key;
                }
            }
        }

        return null;
    }

    pbxItemByComment<PBX_OBJ_TYPE extends PBXObjectBase>(comment: string, pbxSectionName: ISA_TYPE): PBX_OBJ_TYPE | null {
        return SectionUtils.entryGetWCommentText(this.pf_sectionGetOrCreate<PBX_OBJ_TYPE>(pbxSectionName), comment);
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
    }

    pbxSourcesBuildPhaseObj(target?: XC_PROJ_UUID | null): PBXSourcesBuildPhase | null {
        return this.buildPhaseObject<PBXSourcesBuildPhase>('PBXSourcesBuildPhase', 'Sources', target);
    }

    pbxResourcesBuildPhaseObj(target?: XC_PROJ_UUID | null): PBXResourcesBuildPhase | null {
        return this.buildPhaseObject<PBXResourcesBuildPhase>('PBXResourcesBuildPhase', 'Resources', target);
    }

    pbxFrameworksBuildPhaseObj(target?: XC_PROJ_UUID | null): PBXFrameworksBuildPhase | null {
        return this.buildPhaseObject<PBXFrameworksBuildPhase>('PBXFrameworksBuildPhase', 'Frameworks', target);
    }

    pbxEmbedFrameworksBuildPhaseObj(target?: XC_PROJ_UUID | null): PBXCopyFilesBuildPhase | null {
        return this.buildPhaseObject<PBXCopyFilesBuildPhase>('PBXCopyFilesBuildPhase', 'Embed Frameworks', target);
    };

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
    buildPhase(group: FILETYPE_GROUP, target?: XC_PROJ_UUID | null): XC_COMMENT_KEY | undefined {

        if (!target)
            return undefined;

        const nativeTargets: TypedSection<PBXNativeTarget> = this.pbxNativeTargetSection();
        if (typeof nativeTargets[target] == "undefined")
            throw new Error("Invalid target: " + target);

        //  Assuming target is never the comment string, so nativeTarget is always an object.
        const nativeTarget: PBXNativeTarget = nativeTargets[target] as PBXNativeTarget;
        const buildPhases: IChildListEntry[] = nativeTarget.buildPhases;
        for (let i in buildPhases) {
            const buildPhase = buildPhases[i];
            if (buildPhase.comment == group)
                return buildPhase.value + "_comment";
        }

        return undefined;
    }

    /**
     * 
     * @param name Section Name (type of object)
     * @param group 
     * @param target 
     */
    buildPhaseObject<PBX_OBJ_TYPE extends PBXObjectBase>(
        name: ISA_BUILD_PHASE_TYPE,
        group: FILETYPE_GROUP,
        target?: XC_PROJ_UUID | null): PBX_OBJ_TYPE | null {

        const section: TypedSection<PBX_OBJ_TYPE> = this.pf_sectionGetOrCreate(name);
        const buildPhase: XC_COMMENT_KEY | undefined = this.buildPhase(group, target);

        for (let key in section) {

            // only look for comments
            if (SectionUtils.dictKeyIsComment(key) &&               // This is a comment key
                (buildPhase == undefined || buildPhase == key) &&   //  Build phase is either not set or the phase matches this key
                section[key] == group) { // Value of the Comment key matches the group type

                // const sectionKey = key.split(COMMENT_KEY)[0] as XC_PROJ_UUID;
                // return section[sectionKey] as PBX_OBJ_TYPE;
                return SectionUtils.entryGetWCommentKey(section, key);
            }
        }

        return null;
    }

    addBuildProperty(prop: string, value: string, build_name: string): void {
        const configurations: SectionDictUuidToObj<XCBuildConfiguration> = SectionUtils.createUuidKeyOnlySectionDict(this.xcBuildConfigurationSection());

        for (let key in configurations) {
            const configuration: XCBuildConfiguration = configurations[key];
            if (!build_name || configuration.name === build_name) {
                configuration.buildSettings[prop] = value;
            }
        }
    }

    removeBuildProperty(prop: string, build_name: string): void {
        const configurations: SectionDictUuidToObj<XCBuildConfiguration> = SectionUtils.createUuidKeyOnlySectionDict(this.xcBuildConfigurationSection());

        for (let key in configurations) {
            const configuration = configurations[key];
            if (configuration.buildSettings[prop] &&
                !build_name || configuration.name === build_name) {
                delete configuration.buildSettings[prop];
            }
        }
    }

    /**
     * Note, this modifies this property on every build configuration object.
     * There can be many.
     * 
     * @param prop {String}
     * @param value {String|Array|Object|Number|Boolean}
     * @param build {String} Release or Debug or pass in null to do all
     */
    updateBuildProperty(prop: string, value: any, build?: 'Release' | 'Debug' | null): void {
        var configs: TypedSection<XCBuildConfiguration> = this.xcBuildConfigurationSection();
        for (let configName in configs) {
            if (!SectionUtils.dictKeyIsComment(configName)) {
                var config: XCBuildConfiguration = configs[configName] as XCBuildConfiguration;
                if ((build && config.name === build) || (!build)) {
                    config.buildSettings[prop] = value;
                }
            }
        }
    }

    updateProductName(name: string): void {
        this.updateBuildProperty('PRODUCT_NAME', '"' + name + '"');
    }



    private pf_processBuildConfigurationsWithTheProductName(
        callback: (buildSettings: { [prop: string]: any }, config: XCBuildConfiguration) => void): void {

        const configurations: SectionDictUuidToObj<XCBuildConfiguration> = SectionUtils.createUuidKeyOnlySectionDict(this.xcBuildConfigurationSection());

        //  Get the product name up front to avoid order n squared algorithm
        const productName: string = this.productName;

        for (let configKey in configurations) {
            const config: XCBuildConfiguration = configurations[configKey];
            const buildSettings = config.buildSettings;

            if (unquote(buildSettings['PRODUCT_NAME']) == productName) {
                callback(buildSettings, config);
            }
        }
    }


    template(file: PbxFile): void {

        //  init here

        this.pf_processBuildConfigurationsWithTheProductName(
            (buildSettings: { [prop: string]: any }) => {

                //  process each here
            }
        );
    }

    removeFromFrameworkSearchPaths(file: PbxFile): void {

        const SEARCH_PATHS = 'FRAMEWORK_SEARCH_PATHS';

        const new_path = searchPathForFile(file, this);

        this.pf_processBuildConfigurationsWithTheProductName(
            (buildSettings: { [prop: string]: any }) => {

                const searchPaths = buildSettings[SEARCH_PATHS];

                if (searchPaths && Array.isArray(searchPaths)) {
                    var matches = searchPaths.filter(function (p) {
                        return p.indexOf(new_path) > -1;
                    });
                    matches.forEach(function (m) {
                        var idx = searchPaths.indexOf(m);
                        searchPaths.splice(idx, 1);
                    });
                }
            }
        );
    }

    addToFrameworkSearchPaths(file: PbxFile): void {

        this.pf_processBuildConfigurationsWithTheProductName(
            (buildSettings: { [prop: string]: any }) => {

                const INHERITED = '"$(inherited)"';

                if (!buildSettings['FRAMEWORK_SEARCH_PATHS']
                    || buildSettings['FRAMEWORK_SEARCH_PATHS'] === INHERITED) {
                    buildSettings['FRAMEWORK_SEARCH_PATHS'] = [INHERITED];
                }

                buildSettings['FRAMEWORK_SEARCH_PATHS'].push(searchPathForFile(file, this));

            }
        );
    }

    removeFromLibrarySearchPaths(file: PbxFile): void {
        const new_path = searchPathForFile(file, this);

        this.pf_processBuildConfigurationsWithTheProductName(
            (buildSettings: { [prop: string]: any }) => {

                const SEARCH_PATHS = 'LIBRARY_SEARCH_PATHS',

                    searchPaths = buildSettings[SEARCH_PATHS];

                if (searchPaths && Array.isArray(searchPaths)) {
                    var matches = searchPaths.filter(function (p) {
                        return p.indexOf(new_path) > -1;
                    });
                    matches.forEach(function (m) {
                        var idx = searchPaths.indexOf(m);
                        searchPaths.splice(idx, 1);
                    });
                }
            }
        );

    }

    addToLibrarySearchPaths(file: PbxFile): void {

        this.pf_processBuildConfigurationsWithTheProductName(
            (buildSettings: { [prop: string]: any }) => {

                const INHERITED = '"$(inherited)"';

                if (!buildSettings['LIBRARY_SEARCH_PATHS']
                    || buildSettings['LIBRARY_SEARCH_PATHS'] === INHERITED) {
                    buildSettings['LIBRARY_SEARCH_PATHS'] = [INHERITED];
                }

                if (typeof file === 'string') {
                    buildSettings['LIBRARY_SEARCH_PATHS'].push(file);
                } else {
                    buildSettings['LIBRARY_SEARCH_PATHS'].push(searchPathForFile(file, this));
                }
            }
        );
    }

    removeFromHeaderSearchPaths(file: PbxFile): void {
        const new_path = searchPathForFile(file, this);

        this.pf_processBuildConfigurationsWithTheProductName(
            (buildSettings: { [prop: string]: any }) => {

                const SEARCH_PATHS = 'HEADER_SEARCH_PATHS';

                if (buildSettings[SEARCH_PATHS]) {
                    var matches = buildSettings[SEARCH_PATHS].filter(function (p: string) {
                        return p.indexOf(new_path) > -1;
                    });
                    matches.forEach(function (m: any) {
                        var idx = buildSettings[SEARCH_PATHS].indexOf(m);
                        buildSettings[SEARCH_PATHS].splice(idx, 1);
                    });
                }
            }
        );
    }

    addToHeaderSearchPaths(file: PbxFile): void {

        this.pf_processBuildConfigurationsWithTheProductName(
            (buildSettings: { [prop: string]: any }) => {

                const INHERITED = '"$(inherited)"';

                if (!buildSettings['HEADER_SEARCH_PATHS']) {
                    buildSettings['HEADER_SEARCH_PATHS'] = [INHERITED];
                }

                if (typeof file === 'string') {
                    buildSettings['HEADER_SEARCH_PATHS'].push(file);
                } else {
                    buildSettings['HEADER_SEARCH_PATHS'].push(searchPathForFile(file, this));
                }
            }
        );
    }

    addToOtherLinkerFlags(flag: any): void { // any is a guess -- fix this later

        this.pf_processBuildConfigurationsWithTheProductName(
            (buildSettings: { [prop: string]: any }) => {

                const INHERITED = '"$(inherited)"',
                    OTHER_LDFLAGS = 'OTHER_LDFLAGS';


                if (!buildSettings[OTHER_LDFLAGS]
                    || buildSettings[OTHER_LDFLAGS] === INHERITED) {
                    buildSettings[OTHER_LDFLAGS] = [INHERITED];
                }

                buildSettings[OTHER_LDFLAGS].push(flag);
            }
        );
    }

    removeFromOtherLinkerFlags(flag: any): void { // any is a guess -- fix this later

        this.pf_processBuildConfigurationsWithTheProductName(
            (buildSettings: { [prop: string]: any }) => {

                const OTHER_LDFLAGS = 'OTHER_LDFLAGS';
                if (buildSettings[OTHER_LDFLAGS]) {
                    var matches = buildSettings[OTHER_LDFLAGS].filter(function (p: any) {
                        return p.indexOf(flag) > -1;
                    });
                    matches.forEach(function (m: any) {
                        var idx = buildSettings[OTHER_LDFLAGS].indexOf(m);
                        buildSettings[OTHER_LDFLAGS].splice(idx, 1);
                    });
                }
            }
        );
    }

    addToBuildSettings(buildSetting: string, value: any): void {
        const configurations: SectionDictUuidToObj<XCBuildConfiguration> = SectionUtils.createUuidKeyOnlySectionDict(this.xcBuildConfigurationSection());

        for (let config in configurations) {
            const buildSettings = configurations[config].buildSettings;

            buildSettings[buildSetting] = value;
        }
    }

    removeFromBuildSettings(buildSetting: string): void {
        const configurations: SectionDictUuidToObj<XCBuildConfiguration> = SectionUtils.createUuidKeyOnlySectionDict(this.xcBuildConfigurationSection());

        for (let config in configurations) {
            const buildSettings = configurations[config].buildSettings;

            if (buildSettings[buildSetting]) {
                delete buildSettings[buildSetting];
            }
        }
    }

    // a JS getter. hmmm
    // __defineGetter__("productName", function() {

    /**
     * Return the productName of a random XCBuildConfigurationSetting that
     * has a PRODUCT_NAME set.  In reviewing the test projects, all
     * build configurations had the same product name so this works in these
     * cases.  I do not know if it works in all cases.
     */
    get productName(): string {

        const configurations: SectionDictUuidToObj<XCBuildConfiguration> = SectionUtils.createUuidKeyOnlySectionDict(this.xcBuildConfigurationSection());

        for (let config in configurations) {
            const productName: string | undefined = configurations[config].buildSettings['PRODUCT_NAME'];

            if (productName) {
                return unquoteStr(productName);
            }
        }

        //  This used to just return undefined.
        throw new Error('Failed to find PRODUCT_NAME');
    }

    // check if file is present
    hasFile(filePath: string): PBXFileReference | false {
        const files: SectionDictUuidToObj<PBXFileReference> = SectionUtils.createUuidKeyOnlySectionDict(this.pbxFileReferenceSection());

        for (let id in files) {
            const file: PBXFileReference = files[id];
            if (file.path == filePath || file.path == ('"' + filePath + '"')) {
                return file;
            }
        }

        return false;
    }

    addTarget(name: string, type: TARGET_TYPE, subfolder: string): INativeTargetWrapper {

        // Setup uuid and name of new target
        const targetUuid: XC_PROJ_UUID = this.generateUuid();
        const targetType: TARGET_TYPE = type;
        const targetSubfolder: string = subfolder || name;
        const targetName: string = name.trim();

        // Check type against list of allowed target types
        if (!targetName) {
            throw new Error("Target name missing.");
        }

        // Check type against list of allowed target types
        if (!targetType) {
            throw new Error("Target type missing.");
        }

        // Check type against list of allowed target types
        const productType: PRODUCT_TYPE = producttypeForTargettype(targetType);
        if (!productType) {
            throw new Error("Target type invalid: " + targetType);
        }

        // Build Configuration: Create
        const buildConfigurationsList: XCBuildConfiguration[] = [
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
        const productName: string = targetName;
        const productFileType: XC_FILETYPE = filetypeForProductType(productType);
        const productFile: PbxFile = this.addProductFile(productName, { group: 'Copy Files', 'target': targetUuid, 'explicitFileType': productFileType });
        //            productFileName = productFile.basename;


        // Product: Add to build file list
        this.addToPbxBuildFileSection(productFile);

        // Target: Create
        const target: INativeTargetWrapper = {
            uuid: targetUuid,
            pbxNativeTarget: {
                isa: 'PBXNativeTarget',
                name: '"' + targetName + '"',
                productName: '"' + targetName + '"',
                productReference: productFile.fileRef as XC_PROJ_UUID,
                productType: '"' + producttypeForTargettype(targetType) + '"',
                buildConfigurationList: buildConfigurations.uuid,
                buildPhases: [],
                buildRules: [],
                dependencies: []
            }
        };

        // Target: Add to PBXNativeTarget section
        this.addToPbxNativeTargetSection(target)

        // Product: Embed (only for "extension"-type targets)
        if (targetType === 'app_extension') {

            // TODO: Evaluate if this is sound.

            // Create CopyFiles phase in first target
            this.addBuildPhase([], 'PBXCopyFilesBuildPhase', 'Copy Files', this.getFirstTarget().uuid, targetType)

            // Add product to CopyFiles phase
            this.addToPbxCopyfilesBuildPhase(productFile)

            // this.addBuildPhaseToTarget(newPhase.buildPhase, this.getFirstTarget().uuid)

        } else if (targetType === 'watch2_app') {
            // Create CopyFiles phase in first target
            this.addBuildPhase(
                [targetName + '.app'],
                'PBXCopyFilesBuildPhase',
                'Embed Watch Content',
                this.getFirstTarget().uuid,
                targetType,
                '"$(CONTENTS_FOLDER_PATH)/Watch"'
            );
        } else if (targetType === 'watch2_extension') {
            // Create CopyFiles phase in watch target (if exists)
            var watch2Target = this.getTarget(producttypeForTargettype('watch2_app'));
            if (watch2Target) {
                this.addBuildPhase(
                    [targetName + '.appex'],
                    'PBXCopyFilesBuildPhase',
                    'Embed App Extensions',
                    watch2Target.uuid,
                    targetType
                );
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
        } else {
            this.addTargetDependency(this.getFirstTarget().uuid, [target.uuid]);
        }

        // Return target on success
        return target;
    }

    /** 
     * Get the first project that appears in the PBXProject section.
     * Assumes there is at least one project.
     * 
     * Most uses of this library likey have one and only one project.
     */
    getFirstProject(): { uuid: XC_PROJ_UUID, firstProject: PBXProject } {

        // Get pbxProject container
        const pbxProjectContainer: TypedSection<PBXProject> = this.pbxProjectSection();

        // Get first pbxProject UUID
        //  NOTE:  This only works assuming the comment key always follows the project key.
        //  Is this always true, implementation specific, or just lucky (i.e. TDD)?  I did 
        //  not think keys were guaranteed to be alphabetized.
        //  I will assume for now that whoever wrote this knows something I don't.
        //  Researched:  According to
        //  https://www.stefanjudis.com/today-i-learned/property-order-is-predictable-in-javascript-objects-since-es2015/
        //  these are likely not implementation specific as node is most definately using the latest.
        const firstProjectUuid: XC_PROJ_UUID = Object.keys(pbxProjectContainer)[0];

        // Get first pbxProject
        const firstProject = pbxProjectContainer[firstProjectUuid] as PBXProject;

        return {
            uuid: firstProjectUuid,
            firstProject: firstProject
        }
    }

    /**
     * Get the first target in the list of targets of the first (and typically only) project.
     * This has always been the deployed application in test cases I have observed.  But
     * validate this.
     */
    getFirstTarget(): { uuid: XC_PROJ_UUID, firstTarget: PBXNativeTarget } {

        // Get first target's UUID
        const firstTargetUuid: XC_PROJ_UUID = this.getFirstProject()['firstProject']['targets'][0].value;

        // Get first pbxNativeTarget
        const firstTarget = this.pbxNativeTargetSection()[firstTargetUuid] as PBXNativeTarget;

        return {
            uuid: firstTargetUuid,
            firstTarget: firstTarget
        }
    }

    getTarget(productType: string) {
        // Find target by product type
        var targets = this.getFirstProject()['firstProject']['targets'];
        var nativeTargets = this.pbxNativeTargetSection();
        for (var i = 0; i < targets.length; i++) {
            var target = targets[i];
            var targetUuid = target.value;
            const _nativeTarget = typeof nativeTargets[targetUuid]
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
    }

    /*** NEW ***/


    /**
     * 
     * @param file  when a string, this is the UUID of either a PBXGroup or a PBXVariantGroup object.
     * When an object, 
     * @param groupKey 
     * @param groupType 
     */
    addToPbxGroupType(file: XC_PROJ_UUID | IPbxGroupChildFileInfo, groupKey: XC_PROJ_UUID, groupType: ISA_GROUP_TYPE): void {

        const group: PBXGroup | null = this.getPBXGroupByKeyAndType<PBXGroup>(groupKey, groupType);

        if (group && group.children !== undefined) {
            if (typeof file === 'string') {

                const childGroupUuid: XC_PROJ_UUID = file;

                let comment: string | undefined;

                //Group Key
                const pbxGroup: PBXGroup | null = this.getPBXGroupByKey(childGroupUuid);
                if (pbxGroup) {
                    comment = pbxGroup.name;
                }
                else {
                    const pbxVarGroup: PBXVariantGroup | null = this.getPBXVariantGroupByKey(childGroupUuid);
                    if (pbxVarGroup)
                        comment = pbxVarGroup.name;
                }

                if (comment == undefined)
                    throw new Error(`Failed to find a group with UUID='${childGroupUuid}'`);

                const childGroup: IChildListEntry = {
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
    }

    addToPbxVariantGroup(file: string | IPbxGroupChildFileInfo, groupKey: XC_PROJ_UUID): void {
        this.addToPbxGroupType(file, groupKey, 'PBXVariantGroup');
    }

    addToPbxGroup(file: string | IPbxGroupChildFileInfo, groupKey: XC_PROJ_UUID): void {
        this.addToPbxGroupType(file, groupKey, 'PBXGroup');
    }

    pbxCreateGroupWithType(name: string, pathName: string | undefined | null, groupType: ISA_GROUP_TYPE): XC_PROJ_UUID {
        //Create object
        const model: PBXGroup = {
            //isa: '"' + groupType + '"',
            isa: groupType,
            children: [],
            name: name,
            sourceTree: '"<group>"'
        };

        if (pathName) model.path = pathName;

        const key = this.generateUuid();

        //  PBXGroup is the base interface of all groups
        const groupSection: TypedSection<PBXGroup> = this.pf_sectionGetOrCreate<PBXGroup>(groupType);
        SectionUtils.entrySetWUuid(groupSection, key, model, name);

        // //Create comment
        // var commendId = key + '_comment';

        // //add obj and commentObj to groups;
        // groups[commendId] = name;
        // groups[key] = model;

        return key;
    }

    pbxCreateVariantGroup(name: string): XC_PROJ_UUID {
        return this.pbxCreateGroupWithType(name, undefined, 'PBXVariantGroup')
    }

    pbxCreateGroup(name: string, pathName?: string | null): XC_PROJ_UUID {
        return this.pbxCreateGroupWithType(name, pathName, 'PBXGroup');
    }

    removeFromPbxGroupAndType(file: IPbxGroupChildFileInfo, groupKey: XC_PROJ_UUID, groupType: ISA_GROUP_TYPE): void {

        const group: PBXGroup | null = this.getPBXGroupByKeyAndType(groupKey, groupType);

        if (group) {
            var groupChildren = group.children, i;
            const toMatch = pbxGroupChild(file);
            for (i in groupChildren) {
                if (toMatch.value == groupChildren[i].value &&
                    toMatch.comment == groupChildren[i].comment) {
                    groupChildren.splice(i as unknown as number, 1);
                    break;
                }
            }
        }
    }

    removeFromPbxGroup(file: IPbxGroupChildFileInfo, groupKey: XC_PROJ_UUID): void {
        this.removeFromPbxGroupAndType(file, groupKey, 'PBXGroup');
    }

    removeFromPbxVariantGroup(file: IPbxGroupChildFileInfo, groupKey: XC_PROJ_UUID): void {
        this.removeFromPbxGroupAndType(file, groupKey, 'PBXVariantGroup');
    }

    getPBXGroupByKeyAndType<PBX_OBJ_TYPE extends PBXGroup>(key: XC_PROJ_UUID, groupType: ISA_GROUP_TYPE): PBX_OBJ_TYPE | null {
        //        return this.hash.project.objects[groupType][key];
        return SectionUtils.entryGetWUuid(this.pf_sectionGetOrCreate<PBX_OBJ_TYPE>(groupType), key);
    }

    getPBXGroupByKey(uuid: XC_PROJ_UUID): PBXGroup | null {
        return SectionUtils.entryGetWUuid(this.pbxGroupsSection(), uuid);
        // return this.hash.project.objects['PBXGroup'][key]; // this used to allow returning a string.
    };

    getPBXVariantGroupByKey(uuid: XC_PROJ_UUID): PBXVariantGroup | null {
        return SectionUtils.entryGetWUuid(this.pbxVariantGroupsSection(), uuid);
        // return this.hash.project.objects['PBXVariantGroup'][key];
    };


    /**
     * 
     * @param criteria 
     * @param groupType 
     * @returns the UUID of the matching group or undefined if no match.
     */
    findPBXGroupKeyAndType<PBX_GROUP_TYPE extends PBXGroup>(
        criteria: IGroupMatchCriteria,
        groupType: 'PBXGroup' | 'PBXVariantGroup'): XC_PROJ_UUID | undefined {

        //  for the JS developers.  I would think this would throw.  But the
        //  original implementation just ignored criteria if not set. Maintaining
        //  oriignal logic.
        if (!criteria)
            return undefined;

        const groups: TypedSection<PBX_GROUP_TYPE> = this.pf_sectionGetOrCreate<PBX_GROUP_TYPE>(
            groupType);

        //const groups = this.hash.project.objects[groupType];

        for (var key in groups) {
            // only look for non comments
            if (!SectionUtils.dictKeyIsComment(key)) {

                const group = groups[key] as PBXGroup;

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
    }

    /**
     * Find the UUID of the PBXGroup object that matches the passed in criteria or
     * undefined if missing.
     * @param criteria match criteria
     */
    findPBXGroupKey(criteria: IGroupMatchCriteria): XC_PROJ_UUID | undefined {
        return this.findPBXGroupKeyAndType(criteria, 'PBXGroup');
    }

    /**
     * Find the UUID of the PBXVariantGroup object that matches the passed in criteria or
     * undefined if missing.
     * @param criteria match criteria
     */

    findPBXVariantGroupKey(criteria: IGroupMatchCriteria): XC_PROJ_UUID | undefined {
        return this.findPBXGroupKeyAndType(criteria, 'PBXVariantGroup');
    }

    addLocalizationVariantGroup(name: string) {
        const groupKey = this.pbxCreateVariantGroup(name);

        const resourceGroupKey: XC_PROJ_UUID | undefined = this.findPBXGroupKey({ name: 'Resources' });

        if (resourceGroupKey == undefined)
            throw new Error("Resources group not found!");

        this.addToPbxGroup(groupKey, resourceGroupKey);

        var localizationVariantGroup = {
            uuid: this.generateUuid(),
            fileRef: groupKey,
            basename: name
        }

        this.addToPbxBuildFileSection(localizationVariantGroup);        // PBXBuildFile
        this.addToPbxResourcesBuildPhase(localizationVariantGroup);     //PBXResourcesBuildPhase

        return localizationVariantGroup;
    };

    addKnownRegion(name: string): void {

        const project: PBXProject = this.getFirstProject().firstProject;

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
    }

    removeKnownRegion(name: string): void {
        const regions: string[] | undefined = this.getFirstProject().firstProject.knownRegions;
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
    }

    hasKnownRegion(name: string): boolean {
        const regions: string[] | undefined = this.getFirstProject().firstProject.knownRegions;
        //var regions = this.pbxProjectSection()[this.getFirstProject()['uuid']]['knownRegions'];
        if (regions) {
            for (var i in regions) {
                if (regions[i] === name) {
                    return true;
                }
            }
        }
        return false;
    }


    getPBXObject<PBX_OBJ_TYPE extends PBXObjectBase>(name: ISA_TYPE): TypedSection<PBX_OBJ_TYPE> | undefined {
        if (!this.hash) throw new Error('Not loaded');

        return this.hash.project.objects[name] as TypedSection<PBX_OBJ_TYPE> | undefined;
    }




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
    addFile(path: string, group: XC_PROJ_UUID, opt?: IPbxFileOptions | null): PbxFile | null {
        const file = new PbxFile(path, opt);

        // null is better for early errors
        if (this.hasFile(file.path)) return null;

        file.fileRef = this.generateUuid();

        this.addToPbxFileReferenceSection(file);    // PBXFileReference

        if (this.getPBXGroupByKey(group)) {
            this.addToPbxGroup(file, group);        // PBXGroup
        }
        else if (this.getPBXVariantGroupByKey(group)) {
            this.addToPbxVariantGroup(file, group);            // PBXVariantGroup
        }

        return file;
    }

    removeFile(path: string, group: XC_PROJ_UUID, opt?: IPbxFileOptions | null): PbxFile {
        const file = new PbxFile(path, opt);

        this.removeFromPbxFileReferenceSection(file);    // PBXFileReference

        if (this.getPBXGroupByKey(group)) {
            this.removeFromPbxGroup(file, group);            // PBXGroup
        }
        else if (this.getPBXVariantGroupByKey(group)) {
            this.removeFromPbxVariantGroup(file, group);     // PBXVariantGroup
        }

        return file;
    }

    /**
     * returns the value of the last build setting with the name property for
     * all XCBuildConfiguration objects whose name matches the value passed in for 'build'
     * @param prop A key in the buildSettings 
     * @param build Matches the XCBuildConfigurationName.  Examples:  'Debug' 'Release'
     */
    getBuildProperty(prop: string, build?: 'Debug' | 'Release' | undefined): any {
        var target;
        const configs: TypedSection<XCBuildConfiguration> = this.xcBuildConfigurationSection();
        for (var configKey in configs) {
            if (!SectionUtils.dictKeyIsComment(configKey)) {
                const config: XCBuildConfiguration = configs[configKey] as XCBuildConfiguration;

                if ((build && config.name === build) || (build === undefined)) {
                    if (config.buildSettings[prop] !== undefined) {
                        target = config.buildSettings[prop];
                    }
                }
            }
        }

        return target;
    }

    /**
     * Return a dictionary of all of the XCBuildConfiguration objects that are either 'Debug' or 'Release'
     * @param build 
     */
    getBuildConfigByName(build: 'Debug' | 'Release'): { [uuid: string]: XCBuildConfiguration } {

        const target: { [uuid: string]: XCBuildConfiguration } = {};

        const configs: TypedSection<XCBuildConfiguration> = this.xcBuildConfigurationSection();
        for (var key in configs) {
            if (!SectionUtils.dictKeyIsComment(key)) {
                const config: XCBuildConfiguration = configs[key] as XCBuildConfiguration;
                if (config.name === build) {
                    target[key] = config;
                }
            }
        }
        return target;
    }

    /**
     * 
     * @param filePath 
     * @param group 
     * @param opt 
     */
    addDataModelDocument(filePath: string, group: XC_PROJ_UUID | FILETYPE_GROUP | string | null | undefined, opt?: IPbxFileOptions | null) {

        //  It appears as if group can be 
        if (!group) {
            group = 'Resources';
        }

        if (!SectionUtils.dictKeyIsUuid(group)) { // If this is not an XC_PROJ_UUID, then it is a FILETYPE_GROUP, convert it to a UUID or back to undefined
        // if (  !this.getPBXGroupByKey(group)) { // We now throw if you pass a non key 
            group = this.findPBXGroupKey({ name: group });
        }

        //  At this point group is either a valid UUID or undefined
        if (!group)
            throw new Error('Failed to find the group!');

        const file: PbxFile & IDataModelDocumentFile = new PbxFile(filePath, opt);

        if (!file || this.hasFile(file.path)) return null;

        file.fileRef = this.generateUuid();
        this.addToPbxGroup(file, group);

        if (!file) return false;

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

            var modelFile = new PbxFile(modelFilePath);
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
    }

    /**
     * Add a new object/value to the TargetAttributes attribute of the only
     * PBXProject member.
     * @param prop 
     * @param value 
     * @param target 
     */
    addTargetAttribute(prop: string, value: any, target: { uuid: XC_PROJ_UUID }): void {

        const proj: PBXProject = this.getFirstProject().firstProject;
        const attributes: IAttributesDictionary = proj.attributes;

        // var attributes = this.getFirstProject()['firstProject']['attributes'];
        if (attributes['TargetAttributes'] === undefined) {
            attributes['TargetAttributes'] = {};
        }
        target = target || this.getFirstTarget();
        if (attributes['TargetAttributes'][target.uuid] === undefined) {
            attributes['TargetAttributes'][target.uuid] = {};
        }
        attributes['TargetAttributes'][target.uuid][prop] = value;
    }

    /**
     * 
     * @param prop 
     * @param target 
     */
    removeTargetAttribute(prop: string, target?: { uuid: XC_PROJ_UUID }): void {

        const proj: PBXProject = this.getFirstProject().firstProject;
        const attributes: IAttributesDictionary = proj.attributes;

        target = target || this.getFirstTarget();
        if (attributes['TargetAttributes'] &&
            attributes['TargetAttributes'][target.uuid]) {
            delete attributes['TargetAttributes'][target.uuid][prop];
        }
    }

}