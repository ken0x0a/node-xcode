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
/// <reference types="node" />
import { EventEmitter } from 'events';
import { PbxWriter, PbxWriterOptions } from './pbxWriter';
import { XC_PROJ_UUID, TARGET_TYPE, XC_COMMENT_KEY } from './IXcodeProjFileSimpleTypes';
import { PBXNativeTarget, PBXBuildPhaseBase, XCConfigurationList, PBXBuildFile, PBXFileReference, PBXCopyFilesBuildPhase, PBXGroup, XCVersionGroup, XCBuildConfiguration, PBXTargetDependency, PBXContainerItemProxy, PBXObjectBase, ISA_TYPE, PBXVariantGroup, PBXProject, PBXSourcesBuildPhase, PBXResourcesBuildPhase, PBXFrameworksBuildPhase, ISA_BUILD_PHASE_TYPE, ISA_GROUP_TYPE } from './IXcodeProjFileObjTypes';
import { PbxFile, IFilePathObj, IPbxFileOptions, FILETYPE_GROUP, XC_SOURCETREE } from './PbxFileDef';
import { IXcodeProjFile, TypedSection } from './IXcodeProjFile';
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
export interface IDataModelDocumentFile {
    models?: PbxFile[];
    currentModel?: PbxFile;
}
interface IPbxGroupChildFileInfo {
    fileRef?: XC_PROJ_UUID;
    basename: string;
}
export interface IPbxShellScriptBuildPhaseOptions {
    inputPaths?: string[];
    outputPaths?: string[];
    shellPath?: string;
    shellScript: string;
}
/**
 * Loads an in memory representation of a projct.pbxproj file,
 * allows manipulating that in memory representation, and then
 * saving it back to disk.
 *
 * Used to be called pbxProject.
 */
export declare class XcProjectFileEditor extends EventEmitter {
    readonly filepath: string;
    hash?: IXcodeProjFile;
    writer?: PbxWriter;
    constructor(filename: string);
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
    parse(cb?: (result: Error | null, model: any) => void): this;
    parseSync(): this;
    writeSync(options?: PbxWriterOptions): string;
    allUuids(): XC_PROJ_UUID[];
    /** Return a new 24 charachter Uuid that does not already exist in the project */
    generateUuid(): XC_PROJ_UUID;
    /**
        * Add a plugin file if not already existing.
        * Also adds it to the PbxFileReference Section and the plugins PbxGroup
        * @returns null if file already exists.
        */
    addPluginFile(path: string, opt?: IPbxFileOptions | null): PbxFile | null;
    /** Inverse of addPluginFile.  Always returns a new instance if IPbxFile
     * that was removed.
     */
    removePluginFile(path: string, opt?: IPbxFileOptions | null): PbxFile;
    addProductFile(targetPath: string, opt?: (IPbxFileOptions & {
        /** This will override the default group.  */
        group?: FILETYPE_GROUP;
    }) | null): PbxFile;
    /** This removes this from the products group.  Oddly enough it does not
     * remove it from the PbxReferenceSection as a plugin file.  I don't know
     * why this is at the time of writing.
     */
    removeProductFile(path: string, opt?: IPbxFileOptions | null): PbxFile;
    /**
     *
     * @param path {String}
     * @param opt {Object} see PbxFile for avail options
     * @param group {String} group key
     * @returns {Object} file; see PbxFile
     */
    addSourceFile(path: string, opt?: IPbxFileOptions, group?: string): PbxFile | false;
    /**
     *
     * @param path {String}
     * @param opt {Object} see PbxFile for avail options
     * @param group {String} group key
     * @returns {Object} file; see PbxFile
     */
    removeSourceFile(path: string, opt?: IPbxFileOptions, group?: string | null): PbxFile;
    /**
     *
     * @param path {String}
     * @param opt {Object} see pbxFile for avail options
     * @param group {String} group key
     * @returns {Object} file; see pbxFile
     */
    addHeaderFile(path: string, opt?: IPbxFileOptions, group?: string | null): PbxFile | null;
    /**
     *
     * @param path {String}
     * @param opt {Object} see pbxFile for avail options
     * @param group {String} group key
     * @returns {Object} file; see pbxFile
     */
    removeHeaderFile(path: string, opt?: IPbxFileOptions | null, group?: string | null): PbxFile;
    /**
     *
     * @param path {String}
     * @param opt {Object} see pbxFile for avail options
     * @param group {String} group key
     * @returns {PbxFile} if added or false if it already existed.
     */
    addResourceFile(path: string, opt?: (IPbxFileOptions & {
        plugin?: boolean;
        variantGroup?: boolean;
    }) | null, group?: XC_PROJ_UUID | null): PbxFile | false;
    /**
     *
     * @param path {String}
     * @param opt {Object} see pbxFile for avail options
     * @param groupUuid {String} group key
     * @returns {Object} file; see pbxFile
     */
    removeResourceFile(path: string, opt?: IPbxFileOptions | null, groupUuid?: XC_PROJ_UUID): PbxFile;
    addFramework(fpath: string, opt?: (IPbxFileOptions & {
        /** defaults to true if not specified. */
        link?: boolean;
    }) | null): PbxFile | false;
    removeFramework(fpath: string, opt?: IPbxFileOptions | null): PbxFile;
    addCopyfile(fpath: string, opt?: IPbxFileOptions | null): PbxFile;
    pbxCopyfilesBuildPhaseObj(target?: XC_PROJ_UUID | null): PBXCopyFilesBuildPhase | null;
    addToPbxCopyfilesBuildPhase(file: PbxFile): void;
    removeCopyfile(fpath: string, opt: IPbxFileOptions): PbxFile;
    removeFromPbxCopyfilesBuildPhase(file: PbxFile): void;
    addStaticLibrary(path: string, opt?: (IPbxFileOptions & {
        plugin?: boolean;
    }) | null): PbxFile | false;
    addToPbxBuildFileSection(file: IFilePathObj): void;
    /**
     * Find the PBXBuildFile that is associated with this file based
     * on the basename.
     *
     * If found, set the file's uuid to the found PBXBuildFile instance and
     * delete the PBXBuildFile and its comments from the collection.
     * @param file
     */
    removeFromPbxBuildFileSection(file: PbxFile): void;
    addPbxGroup(filePathsArray: string[], name: string, path?: string, sourceTree?: XC_SOURCETREE | null): {
        uuid: XC_PROJ_UUID;
        pbxGroup: PBXGroup;
    };
    removePbxGroup(groupName: string): void;
    addToPbxProjectSection(target: INativeTargetWrapper): void;
    addToPbxNativeTargetSection(target: INativeTargetWrapper): void;
    addToPbxFileReferenceSection(file: PbxFile): void;
    /**
     * Search for a reference to this file from the PBXFileReference section.
     * The match is made by either the basename or path matching.
     *
     * (It appears that this should be a concern to you if you have files with the same name
     * in different folders.)
     *
     * @param file
     */
    removeFromPbxFileReferenceSection(file: PbxFile): PbxFile;
    addToXcVersionGroupSection(file: PbxFile & IDataModelDocumentFile): void;
    addToOrCreate_PBXGroup_WithName(file: PbxFile, groupName: string): void;
    removeFrom_PBXGroup_WithName(file: PbxFile, groupName: string): void;
    addToPluginsPbxGroup(file: PbxFile): void;
    removeFromPluginsPbxGroup(file: PbxFile): void;
    addToResourcesPbxGroup(file: PbxFile): void;
    removeFromResourcesPbxGroup(file: PbxFile): void;
    addToFrameworksPbxGroup(file: PbxFile): void;
    removeFromFrameworksPbxGroup(file: PbxFile): void;
    addToProductsPbxGroup(file: PbxFile): void;
    removeFromProductsPbxGroup(file: PbxFile): void;
    private pf_addToBuildPhase;
    private pf_removeFromBuildPhase;
    addToPbxEmbedFrameworksBuildPhase(file: PbxFile): void;
    removeFromPbxEmbedFrameworksBuildPhase(file: PbxFile): void;
    addToPbxSourcesBuildPhase(file: PbxFile): void;
    removeFromPbxSourcesBuildPhase(file: PbxFile): void;
    addToPbxResourcesBuildPhase(file: IFilePathObj & {
        target?: XC_PROJ_UUID | null;
    }): void;
    removeFromPbxResourcesBuildPhase(file: PbxFile): void;
    addToPbxFrameworksBuildPhase(file: PbxFile): void;
    removeFromPbxFrameworksBuildPhase(file: PbxFile): void;
    addXCConfigurationList(configurationObjectsArray: XCBuildConfiguration[], defaultConfigurationName: string, comment: string): IConfigurationListWrapper;
    addTargetDependency(target: XC_PROJ_UUID, dependencyTargets: XC_PROJ_UUID[]): INativeTargetWrapper2 | undefined;
    /**
     *
     * @param filePathsArray
     * @param buildPhaseType
     * @param comment
     * @param target UUID of PBXNativeTarget
     * @param optionsOrFolderType A string for "Copy Files" and Options for "Shell Script" build phases.
     * @param subfolderPath
     */
    addBuildPhase(filePathsArray: string[], buildPhaseType: 'PBXCopyFilesBuildPhase' | 'PBXShellScriptBuildPhase', comment: string, target: XC_PROJ_UUID | null | undefined, optionsOrFolderType: string | IPbxShellScriptBuildPhaseOptions, subfolderPath?: string | null): IBuildPhaseWrapper;
    private pf_sectionGetOrCreate;
    pbxGroupsSection(): TypedSection<PBXGroup>;
    pbxVariantGroupsSection(): TypedSection<PBXVariantGroup>;
    pbxProjectSection(): TypedSection<PBXProject>;
    pbxBuildFileSection(): TypedSection<PBXBuildFile>;
    pbxFileReferenceSection(): TypedSection<PBXFileReference>;
    pbxNativeTargetSection(): TypedSection<PBXNativeTarget>;
    pbxTargetDependencySection(): TypedSection<PBXTargetDependency>;
    pbxContainerItemProxySection(): TypedSection<PBXContainerItemProxy>;
    pbxXCBuildConfigurationSection(): TypedSection<XCBuildConfiguration>;
    xcBuildConfigurationSection(): TypedSection<XCBuildConfiguration>;
    xcVersionGroupSection(): TypedSection<XCVersionGroup>;
    pbxXCConfigurationList(): TypedSection<XCConfigurationList>;
    xcConfigurationList(): TypedSection<XCConfigurationList>;
    pbxGroupByName(name: string): PBXGroup | null;
    pbxTargetByName(name: string): PBXNativeTarget | null;
    /**
     * Search the PBXNativeTarget objects for one with the passed in name.
     * Return the UUID if it exists.  Otherwise return null.
     * @param name
     */
    findTargetKey(name: string): XC_PROJ_UUID | null;
    pbxItemByComment<PBX_OBJ_TYPE extends PBXObjectBase>(comment: string, pbxSectionName: ISA_TYPE): PBX_OBJ_TYPE | null;
    pbxSourcesBuildPhaseObj(target?: XC_PROJ_UUID | null): PBXSourcesBuildPhase | null;
    pbxResourcesBuildPhaseObj(target?: XC_PROJ_UUID | null): PBXResourcesBuildPhase | null;
    pbxFrameworksBuildPhaseObj(target?: XC_PROJ_UUID | null): PBXFrameworksBuildPhase | null;
    pbxEmbedFrameworksBuildPhaseObj(target?: XC_PROJ_UUID | null): PBXCopyFilesBuildPhase | null;
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
    buildPhase(group: FILETYPE_GROUP, target?: XC_PROJ_UUID | null): XC_COMMENT_KEY | undefined;
    /**
     *
     * @param name Section Name (type of object)
     * @param group
     * @param target
     */
    buildPhaseObject<PBX_OBJ_TYPE extends PBXObjectBase>(name: ISA_BUILD_PHASE_TYPE, group: FILETYPE_GROUP, target?: XC_PROJ_UUID | null): PBX_OBJ_TYPE | null;
    addBuildProperty(prop: string, value: string, build_name: string): void;
    removeBuildProperty(prop: string, build_name: string): void;
    /**
     * Note, this modifies this property on every build configuration object.
     * There can be many.
     *
     * @param prop {String}
     * @param value {String|Array|Object|Number|Boolean}
     * @param build {String} Release or Debug or pass in null to do all
     */
    updateBuildProperty(prop: string, value: any, build?: 'Release' | 'Debug' | null): void;
    updateProductName(name: string): void;
    private pf_processBuildConfigurationsWithTheProductName;
    template(file: PbxFile): void;
    removeFromFrameworkSearchPaths(file: PbxFile): void;
    addToFrameworkSearchPaths(file: PbxFile): void;
    removeFromLibrarySearchPaths(file: PbxFile): void;
    addToLibrarySearchPaths(file: PbxFile): void;
    removeFromHeaderSearchPaths(file: PbxFile): void;
    addToHeaderSearchPaths(file: PbxFile): void;
    addToOtherLinkerFlags(flag: any): void;
    removeFromOtherLinkerFlags(flag: any): void;
    addToBuildSettings(buildSetting: string, value: any): void;
    removeFromBuildSettings(buildSetting: string): void;
    /**
     * Return the productName of a random XCBuildConfigurationSetting that
     * has a PRODUCT_NAME set.  In reviewing the test projects, all
     * build configurations had the same product name so this works in these
     * cases.  I do not know if it works in all cases.
     */
    readonly productName: string;
    hasFile(filePath: string): PBXFileReference | false;
    addTarget(name: string, type: TARGET_TYPE, subfolder: string): INativeTargetWrapper;
    /**
     * Get the first project that appears in the PBXProject section.
     * Assumes there is at least one project.
     *
     * Most uses of this library likey have one and only one project.
     */
    getFirstProject(): {
        uuid: XC_PROJ_UUID;
        firstProject: PBXProject;
    };
    /**
     * Get the first target in the list of targets of the first (and typically only) project.
     * This has always been the deployed application in test cases I have observed.  But
     * validate this.
     */
    getFirstTarget(): {
        uuid: XC_PROJ_UUID;
        firstTarget: PBXNativeTarget;
    };
    /*** NEW ***/
    /**
     *
     * @param file  when a string, this is the UUID of either a PBXGroup or a PBXVariantGroup object.
     * When an object,
     * @param groupKey
     * @param groupType
     */
    addToPbxGroupType(file: XC_PROJ_UUID | IPbxGroupChildFileInfo, groupKey: XC_PROJ_UUID, groupType: ISA_GROUP_TYPE): void;
    addToPbxVariantGroup(file: string | IPbxGroupChildFileInfo, groupKey: XC_PROJ_UUID): void;
    addToPbxGroup(file: string | IPbxGroupChildFileInfo, groupKey: XC_PROJ_UUID): void;
    pbxCreateGroupWithType(name: string, pathName: string | undefined | null, groupType: ISA_GROUP_TYPE): XC_PROJ_UUID;
    pbxCreateVariantGroup(name: string): XC_PROJ_UUID;
    pbxCreateGroup(name: string, pathName?: string | null): XC_PROJ_UUID;
    removeFromPbxGroupAndType(file: IPbxGroupChildFileInfo, groupKey: XC_PROJ_UUID, groupType: ISA_GROUP_TYPE): void;
    removeFromPbxGroup(file: IPbxGroupChildFileInfo, groupKey: XC_PROJ_UUID): void;
    removeFromPbxVariantGroup(file: IPbxGroupChildFileInfo, groupKey: XC_PROJ_UUID): void;
    getPBXGroupByKeyAndType<PBX_OBJ_TYPE extends PBXGroup>(key: XC_PROJ_UUID, groupType: ISA_GROUP_TYPE): PBX_OBJ_TYPE | null;
    getPBXGroupByKey(uuid: XC_PROJ_UUID): PBXGroup | null;
    getPBXVariantGroupByKey(uuid: XC_PROJ_UUID): PBXVariantGroup | null;
    /**
     *
     * @param criteria
     * @param groupType
     * @returns the UUID of the matching group or undefined if no match.
     */
    findPBXGroupKeyAndType<PBX_GROUP_TYPE extends PBXGroup>(criteria: IGroupMatchCriteria, groupType: 'PBXGroup' | 'PBXVariantGroup'): XC_PROJ_UUID | undefined;
    /**
     * Find the UUID of the PBXGroup object that matches the passed in criteria or
     * undefined if missing.
     * @param criteria match criteria
     */
    findPBXGroupKey(criteria: IGroupMatchCriteria): XC_PROJ_UUID | undefined;
    /**
     * Find the UUID of the PBXVariantGroup object that matches the passed in criteria or
     * undefined if missing.
     * @param criteria match criteria
     */
    findPBXVariantGroupKey(criteria: IGroupMatchCriteria): XC_PROJ_UUID | undefined;
    addLocalizationVariantGroup(name: string): {
        uuid: string;
        fileRef: string;
        basename: string;
    };
    addKnownRegion(name: string): void;
    removeKnownRegion(name: string): void;
    hasKnownRegion(name: string): boolean;
    getPBXObject<PBX_OBJ_TYPE extends PBXObjectBase>(name: ISA_TYPE): TypedSection<PBX_OBJ_TYPE> | undefined;
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
    addFile(path: string, group: XC_PROJ_UUID, opt?: IPbxFileOptions | null): PbxFile | null;
    removeFile(path: string, group: XC_PROJ_UUID, opt?: IPbxFileOptions | null): PbxFile;
    /**
     * returns the value of the last build setting with the name property for
     * all XCBuildConfiguration objects whose name matches the value passed in for 'build'
     * @param prop A key in the buildSettings
     * @param build Matches the XCBuildConfigurationName.  Examples:  'Debug' 'Release'
     */
    getBuildProperty(prop: string, build?: 'Debug' | 'Release' | undefined): any;
    /**
     * Return a dictionary of all of the XCBuildConfiguration objects that are either 'Debug' or 'Release'
     * @param build
     */
    getBuildConfigByName(build: 'Debug' | 'Release'): {
        [uuid: string]: XCBuildConfiguration;
    };
    /**
     *
     * @param filePath
     * @param group
     * @param opt
     */
    addDataModelDocument(filePath: string, group: XC_PROJ_UUID | FILETYPE_GROUP | string | null | undefined, opt?: IPbxFileOptions | null): false | (PbxFile & IDataModelDocumentFile) | null;
    /**
     * Add a new object/value to the TargetAttributes attribute of the only
     * PBXProject member.
     * @param prop
     * @param value
     * @param target
     */
    addTargetAttribute(prop: string, value: any, target: {
        uuid: XC_PROJ_UUID;
    }): void;
    /**
     *
     * @param prop
     * @param target
     */
    removeTargetAttribute(prop: string, target?: {
        uuid: XC_PROJ_UUID;
    }): void;
}
export {};
