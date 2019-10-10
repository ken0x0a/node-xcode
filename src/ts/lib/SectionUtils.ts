import { format as f } from 'util';
import { XC_PROJ_UUID, XC_COMMENT_KEY } from './IXcodeProjFileSimpleTypes';
import { PBXObjectBase } from './IXcodeProjFileObjTypes';
import { TypedSection, SectionDictUuidToObj } from './IXcodeProjFile';

/**
 * Utilities that have to do with sections, objects, keys, and comments.
 */
export class SectionUtils {
    /**
     * Sections have UUIDs as keys and comment keys wich are the UUID followed by _comment
     */
    private static COMMENT_KEY = /_comment$/;
    /**
     * Create the comment key for the object dictionary that goes with an object.
     * Corresponds to the const COMMENT_KEY.
     *
     * Comment is in the form "<UUID>_comment"
     * @param uuid
     */
    static dictKeyUuidToComment(uuid: XC_PROJ_UUID): XC_COMMENT_KEY {
        return f("%s_comment", uuid);
    }
    static dictKeyCommentToUuid(commentKey: XC_COMMENT_KEY): XC_PROJ_UUID {
        return commentKey.split(this.COMMENT_KEY)[0];
    }
    /**
     * Called on the key of a TypedSection object to determine if it is
     * an object or a comment.
     * @param key
     */
    static dictKeyIsComment(key: string): boolean {
        return this.COMMENT_KEY.test(key);
    }
    /**
     * Return true if ths uuid is a string, not a comment, and exactly 24 charachters long.
     * @param uuid
     */
    static dictKeyIsUuid(uuid?: string | null): boolean {
        return typeof uuid == "string" && !this.dictKeyIsComment(uuid) && uuid.length == 24;
    }
    /**
     *
     * @param section
     * @param commentText
     */
    static entryGetWCommentText<PBX_OBJ_TYPE extends PBXObjectBase>(section: TypedSection<PBX_OBJ_TYPE>, commentText: string): PBX_OBJ_TYPE | null {
        for (let key in section) {
            if (this.dictKeyIsComment(key) && section[key] == commentText) {
                return this.entryGetWUuid(section, this.dictKeyCommentToUuid(key));
                // return section[this.dictKeyCommentToUuid(key)] as PBX_OBJ_TYPE;
            }
        }
        return null;
    }
    static entryGetWCommentKey<PBX_OBJ_TYPE extends PBXObjectBase>(section: TypedSection<PBX_OBJ_TYPE>, commentKey: string): PBX_OBJ_TYPE | null {
        if (!this.dictKeyIsComment(commentKey))
            throw new Error(`The passed in comment key is not a comment key.  Key='${commentKey}'`);
        return this.entryGetWUuid(section, this.dictKeyCommentToUuid(commentKey));
    }
    /**
     *
     * @param section
     * @param uuid
     * throws if uuid does not appear to be an actual UUID.  I.e.
     */
    static entryGetWUuid<PBX_OBJ_TYPE extends PBXObjectBase>(section: TypedSection<PBX_OBJ_TYPE>, uuid: XC_PROJ_UUID): PBX_OBJ_TYPE | null {
        if (!this.dictKeyIsUuid(uuid))
            throw new Error(`Expected UUID does not appear to be a uuid.  Value='${uuid}'`);
        const obj = section[uuid];
        if (typeof obj == "object")
            return obj;
        else if (typeof obj == "undefined")
            return null;
        else
            throw new Error('An unexpected type of data was found in the dictionary');
    }
    /**
     * Set an object and its comment within a section.
     *
     * @param section
     * @param uuid  uuid of the object.  The comment uuid is calculated from this.
     * @param obj the object
     * @param comment  the comment.
     */
    static entrySetWUuid<PBX_OBJ_TYPE extends PBXObjectBase>(section: TypedSection<PBX_OBJ_TYPE>, uuid: XC_PROJ_UUID, obj: PBX_OBJ_TYPE, comment: string): void {
        const commentKey: string = this.dictKeyUuidToComment(uuid);
        section[uuid] = obj;
        section[commentKey] = comment;
    }
    /**
     * Delete an object and its comment with its UUID.
     * @param section
     * @param uuid
     */
    static entryDeleteWUuid<PBX_OBJ_TYPE extends PBXObjectBase>(section: TypedSection<PBX_OBJ_TYPE>, uuid: XC_PROJ_UUID): void {
        const commentKey: string = this.dictKeyUuidToComment(uuid);
        delete section[uuid];
        delete section[commentKey];
    }
    /**
     * Given the text of a comment that is associated with a key, find all keys with
     * that comment and delete them from this section.
     * @param section
     * @param comment
     */
    static entryDeleteWCommentText(section: TypedSection<PBXObjectBase>, comment: string): void {
        //  Coming from other languages, I did not know if this was legal.  It is:
        //  https://stackoverflow.com/questions/3463048/is-it-safe-to-delete-an-object-property-while-iterating-over-them
        for (let key in section) {
            if (this.dictKeyIsComment(key) && section[key] == comment) { // The comment is the passed in name of the group.
                const itemKey: XC_PROJ_UUID = this.dictKeyCommentToUuid(key); // get the Uuid
                delete section[itemKey];
                //  this did not delete the key itself before.  It does now.
                delete section[key];
            }
        }
    }
    /**
     * Given a section from the project file which contains both objects and comments,
     * return a new object that only contains the PBX objects.
     * @param obj
     */
    static createUuidKeyOnlySectionDict<PBX_OBJ_TYPE extends PBXObjectBase>(obj: TypedSection<PBX_OBJ_TYPE>): SectionDictUuidToObj<PBX_OBJ_TYPE> {
        const keys = Object.keys(obj);
        const newObj: SectionDictUuidToObj<PBX_OBJ_TYPE> = {};
        let i = 0;
        for (i; i < keys.length; i++) {
            const key: string = keys[i];
            //if (!COMMENT_KEY.test(key)) {
            if (!this.dictKeyIsComment(key)) {
                newObj[key] = obj[key] as PBX_OBJ_TYPE;
            }
        }
        return newObj;
    }
}
