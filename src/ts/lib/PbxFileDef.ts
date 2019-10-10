
import * as path from 'path';
import * as util from 'util';
import { XC_PROJ_UUID } from './IXcodeProjFileSimpleTypes';

export type XC_FILETYPE =
    'archive.ar' |
    'wrapper.application' |
    'wrapper.app-extension' |
    'wrapper.plug-in' |
    'compiled.mach-o.dylib' |
    'wrapper.framework' |
    'sourcecode.c.h' |
    'sourcecode.c.objc' |
    'text' |
    'wrapper.cfbundle' |
    'wrapper.cfbundle' |
    'sourcecode.c.h' |
    'text.plist.xml' |
    'text.script.sh' |
    'sourcecode.swift' |
    'sourcecode.text-based-dylib-definition' |
    'folder.assetcatalog' |
    'text.xcconfig' |
    'wrapper.xcdatamodel' |
    'wrapper.pb-project' |
    'wrapper.cfbundle' |
    'file.xib' |
    'text.plist.strings';

// Old version used to use 'unknown'.  Removing this 
//  as we don't want to write this to the actual file.
//  using null instead.
// export type XC_FILETYPE = 'unknown' | XC_FILETYPE_KNOWN;
// const DEFAULT_FILETYPE: XC_FILETYPE = 'unknown';


const FILETYPE_BY_EXTENSION: { [fileExtension: string]: XC_FILETYPE } = {
    a: 'archive.ar',
    app: 'wrapper.application',
    appex: 'wrapper.app-extension',
    bundle: 'wrapper.plug-in',
    dylib: 'compiled.mach-o.dylib',
    framework: 'wrapper.framework',
    h: 'sourcecode.c.h',
    m: 'sourcecode.c.objc',
    markdown: 'text',
    mdimporter: 'wrapper.cfbundle',
    octest: 'wrapper.cfbundle',
    pch: 'sourcecode.c.h',
    plist: 'text.plist.xml',
    sh: 'text.script.sh',
    swift: 'sourcecode.swift',
    tbd: 'sourcecode.text-based-dylib-definition',
    xcassets: 'folder.assetcatalog',
    xcconfig: 'text.xcconfig',
    xcdatamodel: 'wrapper.xcdatamodel',
    xcodeproj: 'wrapper.pb-project',
    xctest: 'wrapper.cfbundle',
    xib: 'file.xib',
    strings: 'text.plist.strings'
};

function unquoted(text: string | null | undefined): string {
    return typeof text != 'string' ? '' : text.replace(/(^")|("$)/g, '')
}

/**
 * 
 * @param filePath 
 * @returns undefined if unknown extension.  
 */
function detectType(filePath: string): XC_FILETYPE | 'unknown' {
    const extension = path.extname(filePath).substring(1);

    const filetype: XC_FILETYPE | undefined = FILETYPE_BY_EXTENSION[unquoted(extension)];

    if (filetype == undefined) {
        return 'unknown';
    } else {
        return filetype;
    }
}

function defaultExtension(fileRef: PbxFile): string | undefined {

    const filetype: XC_FILETYPE | 'unknown' | undefined =
        (fileRef.lastKnownFileType && fileRef.lastKnownFileType != 'unknown')? fileRef.lastKnownFileType : fileRef.explicitFileType;

    // Had removed the use of 'unknown'.  However, found that tests were demanding it.  Put back
    //  in for compatibility with existing clients. 
    //    var filetype = fileRef.lastKnownFileType && fileRef.lastKnownFileType != DEFAULT_FILETYPE ?
    //    fileRef.lastKnownFileType : fileRef.explicitFileType;

    for (var extension in FILETYPE_BY_EXTENSION) {
        if (FILETYPE_BY_EXTENSION.hasOwnProperty(unquoted(extension))) {
            if (FILETYPE_BY_EXTENSION[unquoted(extension)] === unquoted(filetype))
                return extension;
        }
    }

    return undefined;
}


export type XC_ENCODING_TYPE = 4;
//const DEFAULT_FILEENCODING: XC_ENCODING_TYPE = 4; // unused?

const ENCODING_BY_FILETYPE: { [fileType: string]: XC_ENCODING_TYPE } = {
    'sourcecode.c.h': 4,
    // 'sourcecode.c.h': 4,  duplicate key removed
    'sourcecode.c.objc': 4,
    'sourcecode.swift': 4,
    'text': 4,
    'text.plist.xml': 4,
    'text.script.sh': 4,
    'text.xcconfig': 4,
    'text.plist.strings': 4
};

/**
 * @param fileRef 
 */
function defaultEncoding(fileRef: PbxFile): XC_ENCODING_TYPE | undefined {
    const filetype: XC_FILETYPE | 'unknown' | undefined = fileRef.lastKnownFileType || fileRef.explicitFileType;

    const encoding = ENCODING_BY_FILETYPE[unquoted(filetype)];

    if (encoding) {
        return encoding;
    } else {
        return undefined;
    }
}

export type FILETYPE_GROUP = 'Frameworks' | 'Embed Frameworks' | 'Resources' | 'Sources' |
    'Copy Files'  // Added Copy Files to support PBXCopyFilesBuildPhase
    ;

const DEFAULT_GROUP: FILETYPE_GROUP = 'Resources';

const GROUP_BY_FILETYPE: { [fileType: string]: FILETYPE_GROUP } = {
    'archive.ar': 'Frameworks',
    'compiled.mach-o.dylib': 'Frameworks',
    'sourcecode.text-based-dylib-definition': 'Frameworks',
    'wrapper.framework': 'Frameworks',
    'embedded.framework': 'Embed Frameworks',
    'sourcecode.c.h': 'Resources',
    'sourcecode.c.objc': 'Sources',
    'sourcecode.swift': 'Sources'
};

function detectGroup(fileRef: PbxFile, opt: IPbxFileOptions): FILETYPE_GROUP {

    if (opt.customFramework && opt.embed) {
        return GROUP_BY_FILETYPE['embedded.framework'] as FILETYPE_GROUP;
    }

    const extension = path.extname(fileRef.basename).substring(1);

    if (extension === 'xcdatamodeld') {
        return 'Sources';
    }

    const filetype = fileRef.lastKnownFileType || fileRef.explicitFileType;
    const groupName = GROUP_BY_FILETYPE[unquoted(filetype)];

    return groupName ? groupName : DEFAULT_GROUP;
}

//  Add other types here or just append string if necessary.
export type XC_SOURCETREE = 'SDKROOT' | '"<group>"' | 'BUILT_PRODUCTS_DIR' | '"absolute"' | 'SOURCE_ROOT';

const SOURCETREE_BY_FILETYPE: { [fileType: string]: XC_SOURCETREE } = {
    'compiled.mach-o.dylib': 'SDKROOT',
    'sourcecode.text-based-dylib-definition': 'SDKROOT',
    'wrapper.framework': 'SDKROOT'
};

const DEFAULT_SOURCETREE: XC_SOURCETREE = '"<group>"';
const DEFAULT_PRODUCT_SOURCETREE: XC_SOURCETREE = 'BUILT_PRODUCTS_DIR';

function detectSourcetree(fileRef: PbxFile): XC_SOURCETREE {

    var filetype = fileRef.lastKnownFileType || fileRef.explicitFileType,
        sourcetree = SOURCETREE_BY_FILETYPE[unquoted(filetype)];

    if (fileRef.explicitFileType) {
        return DEFAULT_PRODUCT_SOURCETREE;
    }

    if (fileRef.customFramework) {
        return DEFAULT_SOURCETREE;
    }

    if (!sourcetree) {
        return DEFAULT_SOURCETREE;
    }

    return sourcetree;
}

export type FILETYPE_PATHS = 'usr/lib/' | 'System/Library/Frameworks/';

const PATH_BY_FILETYPE: { [fileType: string]: FILETYPE_PATHS } = {
    'compiled.mach-o.dylib': 'usr/lib/',
    'sourcecode.text-based-dylib-definition': 'usr/lib/',
    'wrapper.framework': 'System/Library/Frameworks/'
};


function defaultPath(fileRef: PbxFile, filePath: string): FILETYPE_PATHS | string {

    if (fileRef.customFramework) {
        return filePath;
    }

    const filetype = fileRef.lastKnownFileType || fileRef.explicitFileType;
    const defaultPath = PATH_BY_FILETYPE[unquoted(filetype)];

    if (defaultPath) {
        return path.join(defaultPath, path.basename(filePath));
    }

    return filePath;
}

// unused? -- just returned itself.
// function defaultGroup(fileRef:PbxFile):FILETYPE_GROUP {
//     var groupName = GROUP_BY_FILETYPE[fileRef.lastKnownFileType];

//     if (!groupName) {
//         return DEFAULT_GROUP;
//     }

//     return defaultGroup;
// }
/** Options passed in when creating a PBXFile object */
export interface IPbxFileOptions {

    customFramework?: boolean;

    //  If embed and sign are both true, adds ATTRIBUTES 'CodeSignOnCopy'
    embed?: boolean;
    sign?: boolean;
    defaultEncoding?: XC_ENCODING_TYPE;
    lastKnownFileType?: XC_FILETYPE | null;
    explicitFileType?: XC_FILETYPE;
    sourceTree?: XC_SOURCETREE;
    compilerFlags?: string;

    //  Sets the sttings ATTRIBUTES 'Weak'
    weak?: boolean;

    //  Implementation Note:  This property is set on newly
    //  created PbxFiles in multiple places but not in the
    //  constructor.  Why?  Is it the case that some places
    //  should not set it?  
    //  Investigation:  TODO
    //  Changing this after clients are using it could have adverse
    //  affects.
    target?: string; // assumed string

    //  The settings below are not used by PbxFile and should
    //  not be part of this interface as it is confusing. Move them
    //  into the & with the interface.
    // plugin?: boolean;
    //  Applicable to a ProductFile, not a plugin file
    //  group?: FILETYPE_GROUP;
}

export interface IPbxFileSettings {
    ATTRIBUTES?: string[];
    COMPILER_FLAGS?: string;
}

export interface ILongCommentObj {
    basename: string,
    group?: FILETYPE_GROUP
}

export interface IFilePathObj extends ILongCommentObj {
    uuid?: string,
    fileRef?: XC_PROJ_UUID

    settings?: IPbxFileSettings;
}


/** In memory instance for interacting with a conceptual PbxFile.
 * This is not part of the in memory model of the file contents.  
 * This is turned into a PBXFileReference by the non exposed function 
 * pbxFileReferenceObj used by the methods addToPbxFileReferenceSection and 
 * removeFromPbxFileRefereneSection.
  */
export class PbxFile implements IFilePathObj {

    basename: string;

    /** This is a value from the dictionary FILETYPE_BY_EXTENSION
     * within pbxFile.js or 'unknown'
     */
    lastKnownFileType?: XC_FILETYPE | 'unknown';
    //lastKnownFileType?: XC_FILETYPE;  
    //  Would prefer to have unknown or null if it is unknown.  
    //      BUT, the existing code demands 'unkown'

    //  Assuming this must be a known file type
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
    target?: XC_PROJ_UUID; // Assumed string


    fileRef?: XC_PROJ_UUID;
    /** Set when adding the plugin, not sure if loading from disk.
     * All plugins are placed in the same subfolder.
     */
    plugin?: boolean;

    uuid?: XC_PROJ_UUID;


    constructor(filepath: string, opt?: IPbxFileOptions | null) {
        const efOpt: IPbxFileOptions = opt || {};

        this.basename = path.basename(filepath);
        this.lastKnownFileType = efOpt.lastKnownFileType || detectType(filepath);
        this.group = detectGroup(this, efOpt);

        // for custom frameworks
        if (efOpt.customFramework == true) {
            this.customFramework = true;
            this.dirname = path.dirname(filepath).replace(/\\/g, '/');
        }

        this.path = defaultPath(this, filepath).replace(/\\/g, '/');
        this.fileEncoding = this.defaultEncoding = efOpt.defaultEncoding || defaultEncoding(this);

        // When referencing products / build output files
        if (efOpt.explicitFileType) {
            this.explicitFileType = efOpt.explicitFileType;
            this.basename = this.basename + '.' + defaultExtension(this);
            delete this.path;
            delete this.lastKnownFileType;
            delete this.group;
            delete this.defaultEncoding;
        }

        this.sourceTree = efOpt.sourceTree || detectSourcetree(this);
        this.includeInIndex = 0;

        if (efOpt.weak && efOpt.weak === true)
            this.settings = { ATTRIBUTES: ['Weak'] };

        if (efOpt.compilerFlags) {
            if (!this.settings)
                this.settings = {};
            this.settings.COMPILER_FLAGS = util.format('"%s"', efOpt.compilerFlags);
        }

        if (efOpt.embed && efOpt.sign) {
            if (!this.settings)
                this.settings = {};
            if (!this.settings.ATTRIBUTES)
                this.settings.ATTRIBUTES = [];
            this.settings.ATTRIBUTES.push('CodeSignOnCopy');
        }
    }
}