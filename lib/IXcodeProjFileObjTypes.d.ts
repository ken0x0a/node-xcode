import { IPbxFileSettings, XC_SOURCETREE, XC_ENCODING_TYPE, XC_FILETYPE } from "./PbxFileDef";
import { XC_PROJ_UUID } from "./IXcodeProjFileSimpleTypes";
export declare const cPBXEmbedFrameworksBuildPhase = "PBXEmbedFrameworksBuildPhase";
export declare const cPBXBuildFile = "PBXBuildFile";
export declare const cPBXBuildPhase = "PBXBuildPhase";
export declare const cPBXAppleScriptBuildPhase = "PBXAppleScriptBuildPhase";
export declare const cPBXCopyFilesBuildPhase = "PBXCopyFilesBuildPhase";
export declare const cPBXFrameworksBuildPhase = "PBXFrameworksBuildPhase";
export declare const cPBXHeadersBuildPhase = "PBXHeadersBuildPhase";
export declare const cPBXResourcesBuildPhase = "PBXResourcesBuildPhase";
export declare const cPBXShellScriptBuildPhase = "PBXShellScriptBuildPhase";
export declare const cPBXSourcesBuildPhase = "PBXSourcesBuildPhase";
export declare const cPBXBuildRule = "PBXBuildRule";
export declare const cPBXContainerItemProxy = "PBXContainerItemProxy";
export declare const cPBXFileReference = "PBXFileReference";
export declare const cPBXGroup = "PBXGroup";
export declare const cPBXTarget = "PBXTarget";
export declare const cPBXAggregateTarget = "PBXAggregateTarget";
export declare const cPBXLegacyTarget = "PBXLegacyTarget";
export declare const cPBXNativeTarget = "PBXNativeTarget";
export declare const cPBXProject = "PBXProject";
export declare const cPBXReferenceProxy = "PBXReferenceProxy";
export declare const cPBXTargetDependency = "PBXTargetDependency";
export declare const cPBXVariantGroup = "PBXVariantGroup";
export declare const cXCBuildConfiguration = "XCBuildConfiguration";
export declare const cXCConfigurationList = "XCConfigurationList";
export declare const cXCVersionGroup = "XCVersionGroup";
export declare type ISA_BUILD_PHASE_TYPE = 'PBXBuildPhase' | 'PBXAppleScriptBuildPhase' | 'PBXCopyFilesBuildPhase' | 'PBXFrameworksBuildPhase' | 'PBXHeadersBuildPhase' | 'PBXShellScriptBuildPhase' | 'PBXSourcesBuildPhase' | 'PBXEmbedFrameworksBuildPhase' | 'PBXResourcesBuildPhase';
export declare type ISA_GROUP_TYPE = 'PBXGroup' | 'PBXVariantGroup';
/** Every ISectionObject is in a section
 * with the same name as the ISA_TYPE of the
 * object.
 *
 * The other properties change depending on the type
 * of object.
 */
export declare type ISA_TYPE = // List built mostly from https://github.com/Monobjc/monobjc-tools
ISA_BUILD_PHASE_TYPE | ISA_GROUP_TYPE | 'PBXBuildFile' | 'PBXBuildRule' | 'PBXContainerItemProxy' | 'PBXFileReference' | 'PBXTarget' | 'PBXAggregateTarget' | 'PBXLegacyTarget' | 'PBXNativeTarget' | 'PBXProject' | 'PBXReferenceProxy' | 'PBXTargetDependency' | 'XCBuildConfiguration' | 'XCConfigurationList' | 'XCVersionGroup';
export interface IChildListEntry {
    comment: string;
    value: string;
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
    buildSettings: {
        [prop: string]: any;
    };
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
export interface XCVersionGroup extends PBXFileElement {
    children: XC_PROJ_UUID[];
    currentVersion: XC_PROJ_UUID;
    path?: string;
    sourceTree?: XC_SOURCETREE;
    versionGroupType: string;
}
export interface XCConfigurationList extends PBXObjectBase {
    buildConfigurations: IChildListEntry[];
    defaultConfigurationIsVisible: number;
    defaultConfigurationName: string;
}
/**
 * PBXObjectBase with isa = PBXFileReference
 */
export interface PBXFileReference extends PBXFileElement {
    path: string;
    sourceTree: XC_SOURCETREE;
    fileEncoding?: XC_ENCODING_TYPE;
    lastKnownFileType?: XC_FILETYPE | 'unknown';
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
}
/** PBXObject with isa = PBXSourcesBuildPhase */
export interface PBXSourcesBuildPhase extends PBXBuildPhaseBase {
}
/** PBXObject with isa = PBXResourcesBuildPhase */
export interface PBXResourcesBuildPhase extends PBXBuildPhaseBase {
}
/** PBXObject with isa = PBXFrameworksBuildPhase */
export interface PBXFrameworksBuildPhase extends PBXBuildPhaseBase {
}
/** PBXObject with isa = PBXEmbedFrameworksBuildPhase */
export interface PBXEmbedFrameworksBuildPhase extends PBXBuildPhaseBase {
}
/**
 * Section object with an isa = PBXGroup from the PBXGroups section.
 */
export interface PBXGroup extends PBXFileElement {
    children: IChildListEntry[];
    path?: string;
    sourceTree?: XC_SOURCETREE;
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
    productReference: XC_PROJ_UUID;
    /**
     * The value of PRODUCT_TYPE wrapped in double quotes.
     */
    productType: string;
    buildRules: IChildListEntry[];
}
export interface PBXTargetDependency extends PBXObjectBase {
    target: XC_PROJ_UUID;
    target_comment: string;
    targetProxy: XC_PROJ_UUID;
    targetProxy_comment: string;
}
export interface PBXContainerItemProxy extends PBXObjectBase {
    containerPortal: XC_PROJ_UUID;
    containerPortal_comment: string;
    proxyType: number;
    remoteGlobalIDString: XC_PROJ_UUID;
    remoteInfo: string;
}
