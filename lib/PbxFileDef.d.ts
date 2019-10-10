import { XC_PROJ_UUID } from './IXcodeProjFileSimpleTypes';
export declare type XC_FILETYPE = 'archive.ar' | 'wrapper.application' | 'wrapper.app-extension' | 'wrapper.plug-in' | 'compiled.mach-o.dylib' | 'wrapper.framework' | 'sourcecode.c.h' | 'sourcecode.c.objc' | 'text' | 'wrapper.cfbundle' | 'wrapper.cfbundle' | 'sourcecode.c.h' | 'text.plist.xml' | 'text.script.sh' | 'sourcecode.swift' | 'sourcecode.text-based-dylib-definition' | 'folder.assetcatalog' | 'text.xcconfig' | 'wrapper.xcdatamodel' | 'wrapper.pb-project' | 'wrapper.cfbundle' | 'file.xib' | 'text.plist.strings';
export declare type XC_ENCODING_TYPE = 4;
export declare type FILETYPE_GROUP = 'Frameworks' | 'Embed Frameworks' | 'Resources' | 'Sources' | 'Copy Files';
export declare type XC_SOURCETREE = 'SDKROOT' | '"<group>"' | 'BUILT_PRODUCTS_DIR' | '"absolute"' | 'SOURCE_ROOT';
export declare type FILETYPE_PATHS = 'usr/lib/' | 'System/Library/Frameworks/';
/** Options passed in when creating a PBXFile object */
export interface IPbxFileOptions {
    customFramework?: boolean;
    embed?: boolean;
    sign?: boolean;
    defaultEncoding?: XC_ENCODING_TYPE;
    lastKnownFileType?: XC_FILETYPE | null;
    explicitFileType?: XC_FILETYPE;
    sourceTree?: XC_SOURCETREE;
    compilerFlags?: string;
    weak?: boolean;
    target?: string;
}
export interface IPbxFileSettings {
    ATTRIBUTES?: string[];
    COMPILER_FLAGS?: string;
}
export interface ILongCommentObj {
    basename: string;
    group?: FILETYPE_GROUP;
}
export interface IFilePathObj extends ILongCommentObj {
    uuid?: string;
    fileRef?: XC_PROJ_UUID;
    settings?: IPbxFileSettings;
}
/** In memory instance for interacting with a conceptual PbxFile.
 * This is not part of the in memory model of the file contents.
 * This is turned into a PBXFileReference by the non exposed function
 * pbxFileReferenceObj used by the methods addToPbxFileReferenceSection and
 * removeFromPbxFileRefereneSection.
  */
export declare class PbxFile implements IFilePathObj {
    basename: string;
    /** This is a value from the dictionary FILETYPE_BY_EXTENSION
     * within pbxFile.js or 'unknown'
     */
    lastKnownFileType?: XC_FILETYPE | 'unknown';
    explicitFileType?: XC_FILETYPE;
    /**
     * Either:
     * 1) 'Sources'
     * 2) A value in the GROUP_BY_FILETYPE dictionary
     * 3) Falls back to 'Resources'  i.e. DEFAULT_GROUP
     */
    group?: FILETYPE_GROUP;
    /** true if opt is set with customFramework set to true */
    customFramework?: boolean;
    dirname?: string;
    path: string;
    /** Either option.defaultEncoding or a value from ENCODING_BY_FILETYPE */
    defaultEncoding?: XC_ENCODING_TYPE;
    fileEncoding?: XC_ENCODING_TYPE;
    sourceTree: XC_SOURCETREE;
    includeInIndex: number;
    settings?: IPbxFileSettings;
    /** Applicable to product files, not plugins */
    target?: XC_PROJ_UUID;
    fileRef?: XC_PROJ_UUID;
    /** Set when adding the plugin, not sure if loading from disk.
     * All plugins are placed in the same subfolder.
     */
    plugin?: boolean;
    uuid?: XC_PROJ_UUID;
    constructor(filepath: string, opt?: IPbxFileOptions | null);
}
