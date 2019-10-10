import { IPbxFileSettings, XC_SOURCETREE, XC_ENCODING_TYPE, XC_FILETYPE } from "./PbxFileDef";
import { XC_PROJ_UUID } from "./IXcodeProjFileSimpleTypes";

//  Contains all types/interfaces used in a PbxProject
export const cPBXEmbedFrameworksBuildPhase = 'PBXEmbedFrameworksBuildPhase';
export const cPBXBuildFile = 'PBXBuildFile';
export const cPBXBuildPhase = 'PBXBuildPhase';
export const cPBXAppleScriptBuildPhase = 'PBXAppleScriptBuildPhase';
export const cPBXCopyFilesBuildPhase = 'PBXCopyFilesBuildPhase';
export const cPBXFrameworksBuildPhase = 'PBXFrameworksBuildPhase';
export const cPBXHeadersBuildPhase = 'PBXHeadersBuildPhase';
export const cPBXResourcesBuildPhase = 'PBXResourcesBuildPhase';
export const cPBXShellScriptBuildPhase = 'PBXShellScriptBuildPhase';
export const cPBXSourcesBuildPhase = 'PBXSourcesBuildPhase';
export const cPBXBuildRule = 'PBXBuildRule';
export const cPBXContainerItemProxy = 'PBXContainerItemProxy';
export const cPBXFileReference = 'PBXFileReference';
export const cPBXGroup = 'PBXGroup';
export const cPBXTarget = 'PBXTarget';
export const cPBXAggregateTarget = 'PBXAggregateTarget';
export const cPBXLegacyTarget = 'PBXLegacyTarget';
export const cPBXNativeTarget = 'PBXNativeTarget';
export const cPBXProject = 'PBXProject';
export const cPBXReferenceProxy = 'PBXReferenceProxy';
export const cPBXTargetDependency = 'PBXTargetDependency';
export const cPBXVariantGroup = 'PBXVariantGroup';
export const cXCBuildConfiguration = 'XCBuildConfiguration';
export const cXCConfigurationList = 'XCConfigurationList';
export const cXCVersionGroup = 'XCVersionGroup';


export type ISA_BUILD_PHASE_TYPE =
    'PBXBuildPhase' |
    'PBXAppleScriptBuildPhase' |
    'PBXCopyFilesBuildPhase' |
    'PBXFrameworksBuildPhase' |
    'PBXHeadersBuildPhase' |
    'PBXShellScriptBuildPhase' |
    'PBXSourcesBuildPhase' |
    'PBXEmbedFrameworksBuildPhase' |
    'PBXResourcesBuildPhase';

export type ISA_GROUP_TYPE =
    'PBXGroup' |
    'PBXVariantGroup';

/** Every ISectionObject is in a section
 * with the same name as the ISA_TYPE of the
 * object.
 * 
 * The other properties change depending on the type
 * of object.
 */
export type ISA_TYPE = // List built mostly from https://github.com/Monobjc/monobjc-tools
    //  Grouping of types 
    ISA_BUILD_PHASE_TYPE |
    ISA_GROUP_TYPE |
    'PBXBuildFile' |
    'PBXBuildRule' |
    'PBXContainerItemProxy' |
    'PBXFileReference' |
    'PBXTarget' |
    'PBXAggregateTarget' |
    'PBXLegacyTarget' |
    'PBXNativeTarget' |
    'PBXProject' |
    'PBXReferenceProxy' |
    'PBXTargetDependency' |
    'XCBuildConfiguration' |
    'XCConfigurationList' |
    'XCVersionGroup'; // Found XCVersionGroup in cordova-node-xcode and not Monobjc.Tools (assumption is it is newer)


export interface IChildListEntry {
    // Sample file format
    // buildPhases = (
    //         A80672E1233D2A84003EA6BB /* Sources */,
    //         A80672E2233D2A84003EA6BB /* Frameworks */,
    //         A80672E3233D2A84003EA6BB /* Resources */,
    // );
    comment: string; // String such as Sources, Frameworks, Resources
    value: string; // 'A806...'
}


/** Base interface for all of the object types that are
 * in project sections.
 * 
 * All interfaces that extend from this that are concrete (final) interfaces
 * have an isa that matches the interface name.
 */
export interface PBXObjectBase {
    isa: ISA_TYPE;
}

export interface IAttributesDictionary {
    [attributeName: string]: any;
}

export interface PBXProject extends PBXObjectBase {
    attributes: IAttributesDictionary;
    knownRegions?: string[];
    targets: IChildListEntry[];
}

export interface PBXFileElement extends PBXObjectBase {
    name?: string;
}

/** isa == PBXBuildFile */
export interface PBXBuildFile extends PBXObjectBase {
    settings?: IPbxFileSettings;
    fileRef_comment: string;
    fileRef: XC_PROJ_UUID;
}


/**
 * 
 * Sample from file.
 * / * Begin XCBuildConfiguration section * / 
 A80672EF233D2A85003EA6BB / * Debug * / = { 
    isa = XCBuildConfiguration; 
    buildSettings = { 
            CODE_SIGN_IDENTITY = "iPhone Developer"; 
            CODE_SIGN_STYLE = Automatic; 
            DEVELOPMENT_TEAM = HDZHJF9P97; 
            INFOPLIST_FILE = "ad-notification-service-extension/Info.plist"; 
            IPHONEOS_DEPLOYMENT_TARGET = 10.0; 
            LD_RUNPATH_SEARCH_PATHS = ( 
                    "$(inherited)", 
                    "@executable_path/Frameworks", 
                    "@executable_path/../../Frameworks", 
            ); 
            PRODUCT_BUNDLE_IDENTIFIER = "com.ihsada.ent.sandbox-nat-ios.ad-notification-service-extension"; 
            PRODUCT_NAME = "$(TARGET_NAME)"; 
            SKIP_INSTALL = YES; 
            TARGETED_DEVICE_FAMILY = "1,2"; 
    }; 
    name = Debug; 
}; 
 */
export interface XCBuildConfiguration extends PBXObjectBase {
    name: string;

    buildSettings: { [prop: string]: any }; // Includes numbers, strings, and arrays from sample
}

/**
 * 
 * It seems like this should extend PBXGroup.  
 * However, at the time I was converting the code the 
 * js that created this structure created the children as
 * an array of uuids (file references) instead of the
 * standard child references.  My gut tells me this is caused
 * by a difficult to follow code base and multiple authors.  But
 * I don't know so I am leaving it as it is and not deriving from PBXGroup.
 * i.e. my goal is an understandable typescript conversion and not to functionally
 * change logic unless I am 100% certain it is broke.
 */
export interface XCVersionGroup extends PBXFileElement { // PBXGroup

    children: XC_PROJ_UUID[];
    currentVersion: XC_PROJ_UUID,

    path?: string; // mono did not have this.  prev node version did.
    sourceTree?: XC_SOURCETREE;

    // TODO:  Change this to a set of valid types.  At time of writing, I don't have any clue what those are.
    versionGroupType: string; // wrapper.xcdatamodel

    //  Sample code populating this:
    // const newVersionGroup : XCVersionGroup = {
    //             isa: 'XCVersionGroup',
    //             children: file.models.map(function (el) { return el.fileRef; }),
    //             currentVersion: file.currentModel.fileRef,
    //             name: path.basename(file.path),
    //             path: file.path,
    //             sourceTree: '"<group>"',
    //             versionGroupType: 'wrapper.xcdatamodel'
    //         };
}

export interface XCConfigurationList extends PBXObjectBase {
    buildConfigurations: IChildListEntry[];
    defaultConfigurationIsVisible: number; // Sample showed 0.  Assuming 0 or 1.
    defaultConfigurationName: string;
}

/**
 * PBXObjectBase with isa = PBXFileReference
 */
export interface PBXFileReference extends PBXFileElement {
    //  NOTE:  These definitions were inferred and not researched.
    //  Samples:  
    //  04895D7F19A94532AC2599DB /* Pods-sandbox-nat-iosUITests.release.xcconfig */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = text.xcconfig; name = "Pods-sandbox-nat-iosUITests.release.xcconfig"; path = "Target Support Files/Pods-sandbox-nat-iosUITests/Pods-sandbox-nat-iosUITests.release.xcconfig"; sourceTree = "<group>"; };
    //  46C67A06EF915555209989B8 /* libPods-sandbox-nat-ios.a */ = {isa = PBXFileReference; explicitFileType = archive.ar; includeInIndex = 0; path = "libPods-sandbox-nat-ios.a"; sourceTree = BUILT_PRODUCTS_DIR; };
    //  67197E62DDA133A93FC5B625 /* Pods-sandbox-nat-iosUITests.debug.xcconfig */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = text.xcconfig; name = "Pods-sandbox-nat-iosUITests.debug.xcconfig"; path = "Target Support Files/Pods-sandbox-nat-iosUITests/Pods-sandbox-nat-iosUITests.debug.xcconfig"; sourceTree = "<group>"; };
    //  A4B1D716C67E8D3EE0EED6AE /* Pods-sandbox-nat-ios.debug.xcconfig */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = text.xcconfig; name = "Pods-sandbox-nat-ios.debug.xcconfig"; path = "Target Support Files/Pods-sandbox-nat-ios/Pods-sandbox-nat-ios.debug.xcconfig"; sourceTree = "<group>"; };
    //  A86F7EAF2322F0D90009045C /* GoogleService-Info.plist */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = text.plist.xml; path = "GoogleService-Info.plist"; sourceTree = "<group>"; };
    //  A87476BE231831DF005484F4 /* sandbox-nat-iosUITests.xctest */ = {isa = PBXFileReference; explicitFileType = wrapper.cfbundle; includeInIndex = 0; path = "sandbox-nat-iosUITests.xctest"; sourceTree = BUILT_PRODUCTS_DIR; };
    //  A87476C0231831DF005484F4 /* sandbox_nat_iosUITests.m */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.objc; path = sandbox_nat_iosUITests.m; sourceTree = "<group>"; };
    path: string;
    sourceTree: XC_SOURCETREE;
    fileEncoding?: XC_ENCODING_TYPE;
    lastKnownFileType?: XC_FILETYPE | 'unknown'; // Is unknown valid to be written to the file.  The test cases that
                                                // were coded seem to assume so or not consider this.  Allowing 'unknown'
                                                // without throwing an error for now.  Will modify this later when we find out
                                                //  if either XCode knows about 'unknown' or the test cases need to be modified.
    explicitFileType?: XC_FILETYPE;
    /** 
     * Is file included in the index.
     * Only seen 0 or 1 */
    includeInIndex?: number;
}

export interface PBXBuildPhaseBase extends PBXObjectBase {
    files: IChildListEntry[];
    buildActionMask: number;
    runOnlyForDeploymentPostprocessing: number;
}

export interface PBXShellScriptBuildPhase extends PBXBuildPhaseBase {

    name: string;
    inputPaths: string[];
    outputPaths: string[];
    shellPath?: string;
    shellScript?: string;

}

export interface PBXCopyFilesBuildPhase extends PBXBuildPhaseBase {
    name: string;
    dstPath: string;
    dstSubfolderSpec: number;

    //     /* Begin PBXCopyFilesBuildPhase section */ 
    //     A80672EE233D2A85003EA6BB /* Embed App Extensions */ = { 
    //         isa = PBXCopyFilesBuildPhase; 
    //         buildActionMask = 2147483647; 
    //         dstPath = ""; 
    //         dstSubfolderSpec = 13; 
    //         files = ( 
    //                 A80672ED233D2A85003EA6BB /* ad-notification-service-extension.appex in Embed App Extensions */, 
    //         ); 
    //         name = "Embed App Extensions"; 
    //         runOnlyForDeploymentPostprocessing = 0; 
    // }; 
    // /* End PBXCopyFilesBuildPhase section */ 


}


/** PBXObject with isa = PBXSourcesBuildPhase */
export interface PBXSourcesBuildPhase extends PBXBuildPhaseBase {
    // TODO
}

/** PBXObject with isa = PBXResourcesBuildPhase */
export interface PBXResourcesBuildPhase extends PBXBuildPhaseBase {
    // TODO
}

/** PBXObject with isa = PBXFrameworksBuildPhase */
export interface PBXFrameworksBuildPhase extends PBXBuildPhaseBase {
    // TODO
}

/** PBXObject with isa = PBXEmbedFrameworksBuildPhase */
export interface PBXEmbedFrameworksBuildPhase extends PBXBuildPhaseBase {
    // TODO
}

/**
 * Section object with an isa = PBXGroup from the PBXGroups section.
 */
export interface PBXGroup extends PBXFileElement {
    children: IChildListEntry[];
    path?: string; // mono did not have this.  prev node version did.
    sourceTree?: XC_SOURCETREE;
    // TODO
}

export interface PBXVariantGroup extends PBXGroup {
}

/**
 * 
 * Inferred need for this by copying Monobjc.Tools model
 */
export interface PBXTarget extends PBXObjectBase {

    name: string;
    productName: string;

    buildConfigurationList: XC_PROJ_UUID;
    buildPhases: IChildListEntry[];
    dependencies: IChildListEntry[];
}

/**
 * A PBXObject with an isa = PBXNativeTarget and stored in
 * the PBXNativeTarget section.
 */
export interface PBXNativeTarget extends PBXTarget {
    // projectReference: XC_PROJ_UUID; // Don't know where this came from.
    productReference: XC_PROJ_UUID;

    /**
     * The value of PRODUCT_TYPE wrapped in double quotes.
     */
    productType: string; //  "PRODUCT_TYPE";
    buildRules: IChildListEntry[];

    //  Sampe code
    // isa: 'PBXNativeTarget',
    // name: '"' + targetName + '"',
    // productName: '"' + targetName + '"',
    // productReference: productFile.fileRef,
    // productType: '"' + producttypeForTargettype(targetType) + '"',
    // buildConfigurationList: buildConfigurations.uuid,
    // buildPhases: [],
    // buildRules: [],
    // dependencies: []

}

export interface PBXTargetDependency extends PBXObjectBase {
    target: XC_PROJ_UUID,
    target_comment: string,
    targetProxy: XC_PROJ_UUID,
    targetProxy_comment: string

    //  Samnpole file:
    // /* Begin PBXTargetDependency section */
    // A80672EC233D2A85003EA6BB /* PBXTargetDependency */ = {
    //     isa = PBXTargetDependency;
    //     target = A80672E4233D2A84003EA6BB /* ad-notification-service-extension */;
    //     targetProxy = A80672EB233D2A85003EA6BB /* PBXContainerItemProxy */;
    // };


    //  Sample code:
    // isa: cPBXTargetDependency,
    // target: dependencyTargetUuid,
    // target_comment: nativeTargets[dependencyTargetCommentKey],
    // targetProxy: itemProxyUuid,
    // targetProxy_comment: cPBXContainerItemProxy

}

export interface PBXContainerItemProxy extends PBXObjectBase {

    containerPortal: XC_PROJ_UUID,
    containerPortal_comment: string,
    proxyType: number, // examples use 1
    remoteGlobalIDString: XC_PROJ_UUID,
    remoteInfo: string
    //   Sample code:
    // containerPortal: project['rootObject'],
    // containerPortal_comment: project['rootObject_comment'],
    // proxyType: 1,
    // remoteGlobalIDString: dependencyTargetUuid,
    // remoteInfo: (nativeTargets[dependencyTargetUuid] as PBXNativeTarget).name

}

