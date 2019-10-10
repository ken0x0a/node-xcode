import { XC_PROJ_UUID, XC_COMMENT_KEY } from './IXcodeProjFileSimpleTypes';
import { PBXObjectBase } from './IXcodeProjFileObjTypes';
import { TypedSection, SectionDictUuidToObj } from './IXcodeProjFile';
export declare class SectionUtils {
    /**
     * Sections have UUIDs as keys and comment keys wich are the UUID followed by _comment
     */
    private static COMMENT_KEY;
    /**
     * Create the comment key for the object dictionary that goes with an object.
     * Corresponds to the const COMMENT_KEY.
     *
     * Comment is in the form "<UUID>_comment"
     * @param uuid
     */
    static dictKeyUuidToComment(uuid: XC_PROJ_UUID): XC_COMMENT_KEY;
    static dictKeyCommentToUuid(commentKey: XC_COMMENT_KEY): XC_PROJ_UUID;
    /**
     * Called on the key of a TypedSection object to determine if it is
     * an object or a comment.
     * @param key
     */
    static dictKeyIsComment(key: string): boolean;
    /**
     * Return true if ths uuid is a string, not a comment, and exactly 24 charachters long.
     * @param uuid
     */
    static dictKeyIsUuid(uuid?: string | null): boolean;
    /**
     *
     * @param section
     * @param commentText
     */
    static entryGetWCommentText<PBX_OBJ_TYPE extends PBXObjectBase>(section: TypedSection<PBX_OBJ_TYPE>, commentText: string): PBX_OBJ_TYPE | null;
    static entryGetWCommentKey<PBX_OBJ_TYPE extends PBXObjectBase>(section: TypedSection<PBX_OBJ_TYPE>, commentKey: string): PBX_OBJ_TYPE | null;
    /**
     *
     * @param section
     * @param uuid
     * throws if uuid does not appear to be an actual UUID.  I.e.
     */
    static entryGetWUuid<PBX_OBJ_TYPE extends PBXObjectBase>(section: TypedSection<PBX_OBJ_TYPE>, uuid: XC_PROJ_UUID): PBX_OBJ_TYPE | null;
    /**
     * Set an object and its comment within a section.
     *
     * @param section
     * @param uuid  uuid of the object.  The comment uuid is calculated from this.
     * @param obj the object
     * @param comment  the comment.
     */
    static entrySetWUuid<PBX_OBJ_TYPE extends PBXObjectBase>(section: TypedSection<PBX_OBJ_TYPE>, uuid: XC_PROJ_UUID, obj: PBX_OBJ_TYPE, comment: string): void;
    /**
     * Delete an object and its comment with its UUID.
     * @param section
     * @param uuid
     */
    static entryDeleteWUuid<PBX_OBJ_TYPE extends PBXObjectBase>(section: TypedSection<PBX_OBJ_TYPE>, uuid: XC_PROJ_UUID): void;
    /**
     * Given the text of a comment that is associated with a key, find all keys with
     * that comment and delete them from this section.
     * @param section
     * @param comment
     */
    static entryDeleteWCommentText(section: TypedSection<PBXObjectBase>, comment: string): void;
    /**
     * Given a section from the project file which contains both objects and comments,
     * return a new object that only contains the PBX objects.
     * @param obj
     */
    static createUuidKeyOnlySectionDict<PBX_OBJ_TYPE extends PBXObjectBase>(obj: TypedSection<PBX_OBJ_TYPE>): SectionDictUuidToObj<PBX_OBJ_TYPE>;
}
