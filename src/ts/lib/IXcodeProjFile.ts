import { PBXObjectBase } from "./IXcodeProjFileObjTypes";
import { XC_PROJ_UUID } from "./IXcodeProjFileSimpleTypes";



/**
 * Inferring from the allUuids function, the keys may be a Uuid
 * or other.  They are only a UUid if they are not a comment and they
 * are exactly 24 charachters long.  They are a comment if they end in
 * "_comment"
 * 
 * At the time of writing, it is assumed the comments are stored as strings.
 * Validate this as the code uses the key to determine if it is a comment or not.
 */
export type Section = { [uuidOrComment: string]: PBXObjectBase | string };

export type TypedSection<PBX_OBJECT_TYPE extends PBXObjectBase> =
    { [uuidOrComment: string]: PBX_OBJECT_TYPE | string };

/**
 * Once the comments are removed, only PBXObjects remain:
 */
export type SectionObjOnly = { [uuid: string]: PBXObjectBase };
export type SectionDictUuidToObj<PBX_OBJECT_TYPE extends PBXObjectBase> =
    { [uuid: string]: PBX_OBJECT_TYPE };

export type SECTION_DICT = { [isaTypeKey: string]: Section };
/** there is a single project within the file.  It is 
 * divided into sections under the objects member.
 */
export interface IProject {
    /** objects are grouped by like types.  All objects in the same section
     * have the same ISA_TYPE (isa).   The file store is the ISA_TYPE string.
     */
    objects: SECTION_DICT;

    //  Sample:          rootObject = A829EB71231586460073C8C8 /* Project object */;
    rootObject: XC_PROJ_UUID;
    rootObject_comment: string;
}

/** In memory representation of project.pbxproj (IOS Project) file
 * as parsed by pegjs with custom rule set.
 * 
 * This is the root object held in memory.
 */
export interface IXcodeProjFile {
    project: IProject;
}
