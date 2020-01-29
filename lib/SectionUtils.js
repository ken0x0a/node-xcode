"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var util_1 = require("util");
/**
 * Utilities that have to do with sections, objects, keys, and comments.
 */
var SectionUtils = /** @class */ (function () {
    function SectionUtils() {
    }
    /**
     * Create the comment key for the object dictionary that goes with an object.
     * Corresponds to the const COMMENT_KEY.
     *
     * Comment is in the form "<UUID>_comment"
     * @param uuid
     */
    SectionUtils.dictKeyUuidToComment = function (uuid) {
        return util_1.format("%s_comment", uuid);
    };
    SectionUtils.dictKeyCommentToUuid = function (commentKey) {
        return commentKey.split(this.COMMENT_KEY)[0];
    };
    /**
     * Called on the key of a TypedSection object to determine if it is
     * an object or a comment.
     * @param key
     */
    SectionUtils.dictKeyIsComment = function (key) {
        return this.COMMENT_KEY.test(key);
    };
    /**
     * Return true if ths uuid is a string, not a comment, and exactly 24 charachters long.
     * @param uuid
     */
    SectionUtils.dictKeyIsUuid = function (uuid) {
        return typeof uuid == "string" && !this.dictKeyIsComment(uuid) && uuid.length == 24;
    };
    /**
     *
     * @param section
     * @param commentText
     */
    SectionUtils.entryGetWCommentText = function (section, commentText) {
        for (var key in section) {
            if (this.dictKeyIsComment(key) && section[key] == commentText) {
                return this.entryGetWUuid(section, this.dictKeyCommentToUuid(key));
                // return section[this.dictKeyCommentToUuid(key)] as PBX_OBJ_TYPE;
            }
        }
        return null;
    };
    SectionUtils.entryGetWCommentKey = function (section, commentKey) {
        if (!this.dictKeyIsComment(commentKey))
            throw new Error("The passed in comment key is not a comment key.  Key='" + commentKey + "'");
        return this.entryGetWUuid(section, this.dictKeyCommentToUuid(commentKey));
    };
    /**
     *
     * @param section
     * @param uuid
     * throws if uuid does not appear to be an actual UUID.  I.e.
     */
    SectionUtils.entryGetWUuid = function (section, uuid) {
        if (!this.dictKeyIsUuid(uuid))
            throw new Error("Expected UUID does not appear to be a uuid.  Value='" + uuid + "'");
        var obj = section[uuid];
        if (typeof obj == "object")
            return obj;
        else if (typeof obj == "undefined")
            return null;
        else
            throw new Error('An unexpected type of data was found in the dictionary');
    };
    /**
     * Set an object and its comment within a section.
     *
     * @param section
     * @param uuid  uuid of the object.  The comment uuid is calculated from this.
     * @param obj the object
     * @param comment  the comment.
     */
    SectionUtils.entrySetWUuid = function (section, uuid, obj, comment) {
        var commentKey = this.dictKeyUuidToComment(uuid);
        section[uuid] = obj;
        section[commentKey] = comment;
    };
    /**
     * Delete an object and its comment with its UUID.
     * @param section
     * @param uuid
     */
    SectionUtils.entryDeleteWUuid = function (section, uuid) {
        var commentKey = this.dictKeyUuidToComment(uuid);
        delete section[uuid];
        delete section[commentKey];
    };
    /**
     * Given the text of a comment that is associated with a key, find all keys with
     * that comment and delete them from this section.
     * @param section
     * @param comment
     */
    SectionUtils.entryDeleteWCommentText = function (section, comment) {
        //  Coming from other languages, I did not know if this was legal.  It is:
        //  https://stackoverflow.com/questions/3463048/is-it-safe-to-delete-an-object-property-while-iterating-over-them
        for (var key in section) {
            if (this.dictKeyIsComment(key) && section[key] == comment) { // The comment is the passed in name of the group.
                var itemKey = this.dictKeyCommentToUuid(key); // get the Uuid
                delete section[itemKey];
                //  this did not delete the key itself before.  It does now.
                delete section[key];
            }
        }
    };
    /**
     * Given a section from the project file which contains both objects and comments,
     * return a new object that only contains the PBX objects.
     * @param obj
     */
    SectionUtils.createUuidKeyOnlySectionDict = function (obj) {
        var keys = Object.keys(obj);
        var newObj = {};
        var i = 0;
        for (i; i < keys.length; i++) {
            var key = keys[i];
            //if (!COMMENT_KEY.test(key)) {
            if (!this.dictKeyIsComment(key)) {
                newObj[key] = obj[key];
            }
        }
        return newObj;
    };
    /**
     * Sections have UUIDs as keys and comment keys wich are the UUID followed by _comment
     */
    SectionUtils.COMMENT_KEY = /_comment$/;
    return SectionUtils;
}());
exports.SectionUtils = SectionUtils;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU2VjdGlvblV0aWxzLmpzIiwic291cmNlUm9vdCI6Ii4uL3NyYy90cy8iLCJzb3VyY2VzIjpbImxpYi9TZWN0aW9uVXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSw2QkFBbUM7QUFLbkM7O0dBRUc7QUFDSDtJQUFBO0lBZ0lBLENBQUM7SUEzSEc7Ozs7OztPQU1HO0lBQ0ksaUNBQW9CLEdBQTNCLFVBQTRCLElBQWtCO1FBQzFDLE9BQU8sYUFBQyxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNqQyxDQUFDO0lBQ00saUNBQW9CLEdBQTNCLFVBQTRCLFVBQTBCO1FBQ2xELE9BQU8sVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDakQsQ0FBQztJQUNEOzs7O09BSUc7SUFDSSw2QkFBZ0IsR0FBdkIsVUFBd0IsR0FBVztRQUMvQixPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3RDLENBQUM7SUFDRDs7O09BR0c7SUFDSSwwQkFBYSxHQUFwQixVQUFxQixJQUFvQjtRQUNyQyxPQUFPLE9BQU8sSUFBSSxJQUFJLFFBQVEsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsTUFBTSxJQUFJLEVBQUUsQ0FBQztJQUN4RixDQUFDO0lBQ0Q7Ozs7T0FJRztJQUNJLGlDQUFvQixHQUEzQixVQUFnRSxPQUFtQyxFQUFFLFdBQW1CO1FBQ3BILEtBQUssSUFBSSxHQUFHLElBQUksT0FBTyxFQUFFO1lBQ3JCLElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxXQUFXLEVBQUU7Z0JBQzNELE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxD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QUFDLEVBQUU7Z0JBQzdCLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFpQixDQUFDO2FBQzFDO1NBQ0o7UUFDRCxPQUFPLE1BQU0sQ0FBQztJQUNsQixDQUFDO0lBOUhEOztPQUVHO0lBQ1ksd0JBQVcsR0FBRyxXQUFXLENBQUM7SUE0SDdDLG1CQUFDO0NBQUEsQUFoSUQsSUFnSUM7QUFoSVksb0NBQVkiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBmb3JtYXQgYXMgZiB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0IHsgWENfUFJPSl9VVUlELCBYQ19DT01NRU5UX0tFWSB9IGZyb20gJy4vSVhjb2RlUHJvakZpbGVTaW1wbGVUeXBlcyc7XG5pbXBvcnQgeyBQQlhPYmplY3RCYXNlIH0gZnJvbSAnLi9JWGNvZGVQcm9qRmlsZU9ialR5cGVzJztcbmltcG9ydCB7IFR5cGVkU2VjdGlvbiwgU2VjdGlvbkRpY3RVdWlkVG9PYmogfSBmcm9tICcuL0lYY29kZVByb2pGaWxlJztcblxuLyoqXG4gKiBVdGlsaXRpZXMgdGhhdCBoYXZlIHRvIGRvIHdpdGggc2VjdGlvbnMsIG9iamVjdHMsIGtleXMsIGFuZCBjb21tZW50cy5cbiAqL1xuZXhwb3J0IGNsYXNzIFNlY3Rpb25VdGlscyB7XG4gICAgLyoqXG4gICAgICogU2VjdGlvbnMgaGF2ZSBVVUlEcyBhcyBrZXlzIGFuZCBjb21tZW50IGtleXMgd2ljaCBhcmUgdGhlIFVVSUQgZm9sbG93ZWQgYnkgX2NvbW1lbnRcbiAgICAgKi9cbiAgICBwcml2YXRlIHN0YXRpYyBDT01NRU5UX0tFWSA9IC9fY29tbWVudCQvO1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSB0aGUgY29tbWVudCBrZXkgZm9yIHRoZSBvYmplY3QgZGljdGlvbmFyeSB0aGF0IGdvZXMgd2l0aCBhbiBvYmplY3QuXG4gICAgICogQ29ycmVzcG9uZHMgdG8gdGhlIGNvbnN0IENPTU1FTlRfS0VZLlxuICAgICAqXG4gICAgICogQ29tbWVudCBpcyBpbiB0aGUgZm9ybSBcIjxVVUlEPl9jb21tZW50XCJcbiAgICAgKiBAcGFyYW0gdXVpZFxuICAgICAqL1xuICAgIHN0YXRpYyBkaWN0S2V5VXVpZFRvQ29tbWVudCh1dWlkOiBYQ19QUk9KX1VVSUQpOiBYQ19DT01NRU5UX0tFWSB7XG4gICAgICAgIHJldHVybiBmKFwiJXNfY29tbWVudFwiLCB1dWlkKTtcbiAgICB9XG4gICAgc3RhdGljIGRpY3RLZXlDb21tZW50VG9VdWlkKGNvbW1lbnRLZXk6IFhDX0NPTU1FTlRfS0VZKTogWENfUFJPSl9VVUlEIHtcbiAgICAgICAgcmV0dXJuIGNvbW1lbnRLZXkuc3BsaXQodGhpcy5DT01NRU5UX0tFWSlbMF07XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENhbGxlZCBvbiB0aGUga2V5IG9mIGEgVHlwZWRTZWN0aW9uIG9iamVjdCB0byBkZXRlcm1pbmUgaWYgaXQgaXNcbiAgICAgKiBhbiBvYmplY3Qgb3IgYSBjb21tZW50LlxuICAgICAqIEBwYXJhbSBrZXlcbiAgICAgKi9cbiAgICBzdGF0aWMgZGljdEtleUlzQ29tbWVudChrZXk6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gdGhpcy5DT01NRU5UX0tFWS50ZXN0KGtleSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFJldHVybiB0cnVlIGlmIHRocyB1dWlkIGlzIGEgc3RyaW5nLCBub3QgYSBjb21tZW50LCBhbmQgZXhhY3RseSAyNCBjaGFyYWNodGVycyBsb25nLlxuICAgICAqIEBwYXJhbSB1dWlkXG4gICAgICovXG4gICAgc3RhdGljIGRpY3RLZXlJc1V1aWQodXVpZD86IHN0cmluZyB8IG51bGwpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiB1dWlkID09IFwic3RyaW5nXCIgJiYgIXRoaXMuZGljdEtleUlzQ29tbWVudCh1dWlkKSAmJiB1dWlkLmxlbmd0aCA9PSAyNDtcbiAgICB9XG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0gc2VjdGlvblxuICAgICAqIEBwYXJhbSBjb21tZW50VGV4dFxuICAgICAqL1xuICAgIHN0YXRpYyBlbnRyeUdldFdDb21tZW50VGV4dDxQQlhfT0JKX1RZUEUgZXh0ZW5kcyBQQlhPYmplY3RCYXNlPihzZWN0aW9uOiBUeXBlZFNlY3Rpb248UEJYX09CSl9UWVBFPiwgY29tbWVudFRleHQ6IHN0cmluZyk6IFBCWF9PQkpfVFlQRSB8IG51bGwge1xuICAgICAgICBmb3IgKGxldCBrZXkgaW4gc2VjdGlvbikge1xuICAgICAgICAgICAgaWYgKHRoaXMuZGljdEtleUlzQ29tbWVudChrZXkpICYmIHNlY3Rpb25ba2V5XSA9PSBjb21tZW50VGV4dCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmVudHJ5R2V0V1V1aWQoc2VjdGlvbiwgdGhpcy5kaWN0S2V5Q29tbWVudFRvVXVpZChrZXkpKTtcbiAgICAgICAgICAgICAgICAvLyByZXR1cm4gc2VjdGlvblt0aGlzLmRpY3RLZXlDb21tZW50VG9VdWlkKGtleSldIGFzIFBCWF9PQkpfVFlQRTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgc3RhdGljIGVudHJ5R2V0V0NvbW1lbnRLZXk8UEJYX09CSl9UWVBFIGV4dGVuZHMgUEJYT2JqZWN0QmFzZT4oc2VjdGlvbjogVHlwZWRTZWN0aW9uPFBCWF9PQkpfVFlQRT4sIGNvbW1lbnRLZXk6IHN0cmluZyk6IFBCWF9PQkpfVFlQRSB8IG51bGwge1xuICAgICAgICBpZiAoIXRoaXMuZGljdEtleUlzQ29tbWVudChjb21tZW50S2V5KSlcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVGhlIHBhc3NlZCBpbiBjb21tZW50IGtleSBpcyBub3QgYSBjb21tZW50IGtleS4gIEtleT0nJHtjb21tZW50S2V5fSdgKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZW50cnlHZXRXVXVpZChzZWN0aW9uLCB0aGlzLmRpY3RLZXlDb21tZW50VG9VdWlkKGNvbW1lbnRLZXkpKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0gc2VjdGlvblxuICAgICAqIEBwYXJhbSB1dWlkXG4gICAgICogdGhyb3dzIGlmIHV1aWQgZG9lcyBub3QgYXBwZWFyIHRvIGJlIGFuIGFjdHVhbCBVVUlELiAgSS5lLlxuICAgICAqL1xuICAgIHN0YXRpYyBlbnRyeUdldFdVdWlkPFBCWF9PQkpfVFlQRSBleHRlbmRzIFBCWE9iamVjdEJhc2U+KHNlY3Rpb246IFR5cGVkU2VjdGlvbjxQQlhfT0JKX1RZUEU+LCB1dWlkOiBYQ19QUk9KX1VVSUQpOiBQQlhfT0JKX1RZUEUgfCBudWxsIHtcbiAgICAgICAgaWYgKCF0aGlzLmRpY3RLZXlJc1V1aWQodXVpZCkpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIFVVSUQgZG9lcyBub3QgYXBwZWFyIHRvIGJlIGEgdXVpZC4gIFZhbHVlPScke3V1aWR9J2ApO1xuICAgICAgICBjb25zdCBvYmogPSBzZWN0aW9uW3V1aWRdO1xuICAgICAgICBpZiAodHlwZW9mIG9iaiA9PSBcIm9iamVjdFwiKVxuICAgICAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgICAgZWxzZSBpZiAodHlwZW9mIG9iaiA9PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQW4gdW5leHBlY3RlZCB0eXBlIG9mIGRhdGEgd2FzIGZvdW5kIGluIHRoZSBkaWN0aW9uYXJ5Jyk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFNldCBhbiBvYmplY3QgYW5kIGl0cyBjb21tZW50IHdpdGhpbiBhIHNlY3Rpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0gc2VjdGlvblxuICAgICAqIEBwYXJhbSB1dWlkICB1dWlkIG9mIHRoZSBvYmplY3QuICBUaGUgY29tbWVudCB1dWlkIGlzIGNhbGN1bGF0ZWQgZnJvbSB0aGlzLlxuICAgICAqIEBwYXJhbSBvYmogdGhlIG9iamVjdFxuICAgICAqIEBwYXJhbSBjb21tZW50ICB0aGUgY29tbWVudC5cbiAgICAgKi9cbiAgICBzdGF0aWMgZW50cnlTZXRXVXVpZDxQQlhfT0JKX1RZUEUgZXh0ZW5kcyBQQlhPYmplY3RCYXNlPihzZWN0aW9uOiBUeXBlZFNlY3Rpb248UEJYX09CSl9UWVBFPiwgdXVpZDogWENfUFJPSl9VVUlELCBvYmo6IFBCWF9PQkpfVFlQRSwgY29tbWVudDogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IGNvbW1lbnRLZXk6IHN0cmluZyA9IHRoaXMuZGljdEtleVV1aWRUb0NvbW1lbnQodXVpZCk7XG4gICAgICAgIHNlY3Rpb25bdXVpZF0gPSBvYmo7XG4gICAgICAgIHNlY3Rpb25bY29tbWVudEtleV0gPSBjb21tZW50O1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBEZWxldGUgYW4gb2JqZWN0IGFuZCBpdHMgY29tbWVudCB3aXRoIGl0cyBVVUlELlxuICAgICAqIEBwYXJhbSBzZWN0aW9uXG4gICAgICogQHBhcmFtIHV1aWRcbiAgICAgKi9cbiAgICBzdGF0aWMgZW50cnlEZWxldGVXVXVpZDxQQlhfT0JKX1RZUEUgZXh0ZW5kcyBQQlhPYmplY3RCYXNlPihzZWN0aW9uOiBUeXBlZFNlY3Rpb248UEJYX09CSl9UWVBFPiwgdXVpZDogWENfUFJPSl9VVUlEKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IGNvbW1lbnRLZXk6IHN0cmluZyA9IHRoaXMuZGljdEtleVV1aWRUb0NvbW1lbnQodXVpZCk7XG4gICAgICAgIGRlbGV0ZSBzZWN0aW9uW3V1aWRdO1xuICAgICAgICBkZWxldGUgc2VjdGlvbltjb21tZW50S2V5XTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogR2l2ZW4gdGhlIHRleHQgb2YgYSBjb21tZW50IHRoYXQgaXMgYXNzb2NpYXRlZCB3aXRoIGEga2V5LCBmaW5kIGFsbCBrZXlzIHdpdGhcbiAgICAgKiB0aGF0IGNvbW1lbnQgYW5kIGRlbGV0ZSB0aGVtIGZyb20gdGhpcyBzZWN0aW9uLlxuICAgICAqIEBwYXJhbSBzZWN0aW9uXG4gICAgICogQHBhcmFtIGNvbW1lbnRcbiAgICAgKi9cbiAgICBzdGF0aWMgZW50cnlEZWxldGVXQ29tbWVudFRleHQoc2VjdGlvbjogVHlwZWRTZWN0aW9uPFBCWE9iamVjdEJhc2U+LCBjb21tZW50OiBzdHJpbmcpOiB2b2lkIHtcbiAgICAgICAgLy8gIENvbWluZyBmcm9tIG90aGVyIGxhbmd1YWdlcywgSSBkaWQgbm90IGtub3cgaWYgdGhpcyB3YXMgbGVnYWwuICBJdCBpczpcbiAgICAgICAgLy8gIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzM0NjMwNDgvaXMtaXQtc2FmZS10by1kZWxldGUtYW4tb2JqZWN0LXByb3BlcnR5LXdoaWxlLWl0ZXJhdGluZy1vdmVyLXRoZW1cbiAgICAgICAgZm9yIChsZXQga2V5IGluIHNlY3Rpb24pIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmRpY3RLZXlJc0NvbW1lbnQoa2V5KSAmJiBzZWN0aW9uW2tleV0gPT0gY29tbWVudCkgeyAvLyBUaGUgY29tbWVudCBpcyB0aGUgcGFzc2VkIGluIG5hbWUgb2YgdGhlIGdyb3VwLlxuICAgICAgICAgICAgICAgIGNvbnN0IGl0ZW1LZXk6IFhDX1BST0pfVVVJRCA9IHRoaXMuZGljdEtleUNvbW1lbnRUb1V1aWQoa2V5KTsgLy8gZ2V0IHRoZSBVdWlkXG4gICAgICAgICAgICAgICAgZGVsZXRlIHNlY3Rpb25baXRlbUtleV07XG4gICAgICAgICAgICAgICAgLy8gIHRoaXMgZGlkIG5vdCBkZWxldGUgdGhlIGtleSBpdHNlbGYgYmVmb3JlLiAgSXQgZG9lcyBub3cuXG4gICAgICAgICAgICAgICAgZGVsZXRlIHNlY3Rpb25ba2V5XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICAvKipcbiAgICAgKiBHaXZlbiBhIHNlY3Rpb24gZnJvbSB0aGUgcHJvamVjdCBmaWxlIHdoaWNoIGNvbnRhaW5zIGJvdGggb2JqZWN0cyBhbmQgY29tbWVudHMsXG4gICAgICogcmV0dXJuIGEgbmV3IG9iamVjdCB0aGF0IG9ubHkgY29udGFpbnMgdGhlIFBCWCBvYmplY3RzLlxuICAgICAqIEBwYXJhbSBvYmpcbiAgICAgKi9cbiAgICBzdGF0aWMgY3JlYXRlVXVpZEtleU9ubHlTZWN0aW9uRGljdDxQQlhfT0JKX1RZUEUgZXh0ZW5kcyBQQlhPYmplY3RCYXNlPihvYmo6IFR5cGVkU2VjdGlvbjxQQlhfT0JKX1RZUEU+KTogU2VjdGlvbkRpY3RVdWlkVG9PYmo8UEJYX09CSl9UWVBFPiB7XG4gICAgICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhvYmopO1xuICAgICAgICBjb25zdCBuZXdPYmo6IFNlY3Rpb25EaWN0VXVpZFRvT2JqPFBCWF9PQkpfVFlQRT4gPSB7fTtcbiAgICAgICAgbGV0IGkgPSAwO1xuICAgICAgICBmb3IgKGk7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBrZXk6IHN0cmluZyA9IGtleXNbaV07XG4gICAgICAgICAgICAvL2lmICghQ09NTUVOVF9LRVkudGVzdChrZXkpKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuZGljdEtleUlzQ29tbWVudChrZXkpKSB7XG4gICAgICAgICAgICAgICAgbmV3T2JqW2tleV0gPSBvYmpba2V5XSBhcyBQQlhfT0JKX1RZUEU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ld09iajtcbiAgICB9XG59XG4iXX0=