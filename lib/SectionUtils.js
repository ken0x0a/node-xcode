"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var util_1 = require("util");
//  should move this into its own static class or file.
//  TODO move all typed section utils in here and put this in its own file
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU2VjdGlvblV0aWxzLmpzIiwic291cmNlUm9vdCI6Ii4uL3NyYy90cy8iLCJzb3VyY2VzIjpbImxpYi9TZWN0aW9uVXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSw2QkFBbUM7QUFLbkMsdURBQXVEO0FBQ3ZELDBFQUEwRTtBQUMxRTtJQUFBO0lBZ0lBLENBQUM7SUEzSEc7Ozs7OztPQU1HO0lBQ0ksaUNBQW9CLEdBQTNCLFVBQTRCLElBQWtCO1FBQzFDLE9BQU8sYUFBQyxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNqQyxDQUFDO0lBQ00saUNBQW9CLEdBQTNCLFVBQTRCLFVBQTBCO1FBQ2xELE9BQU8sVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDakQsQ0FBQztJQUNEOzs7O09BSUc7SUFDSSw2QkFBZ0IsR0FBdkIsVUFBd0IsR0FBVztRQUMvQixPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3RDLENBQUM7SUFDRDs7O09BR0c7SUFDSSwwQkFBYSxHQUFwQixVQUFxQixJQUFvQjtRQUNyQyxPQUFPLE9BQU8sSUFBSSxJQUFJLFFBQVEsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsTUFBTSxJQUFJLEVBQUUsQ0FBQztJQUN4RixDQUFDO0lBQ0Q7Ozs7T0FJRztJQUNJLGlDQUFvQixHQUEzQixVQUFnRSxPQUFtQyxFQUFFLFdBQW1CO1FBQ3BILEtBQUssSUFBSSxHQUFHLElBQUksT0FBTyxFQUFFO1lBQ3JCLElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxXQUFXLEVBQUU7Z0JBQzNELE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixD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QWdCLENBQUMsR0FBRyxDQUFDLEVBQUU7Z0JBQzdCLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFpQixDQUFDO2FBQzFDO1NBQ0o7UUFDRCxPQUFPLE1BQU0sQ0FBQztJQUNsQixDQUFDO0lBOUhEOztPQUVHO0lBQ1ksd0JBQVcsR0FBRyxXQUFXLENBQUM7SUE0SDdDLG1CQUFDO0NBQUEsQUFoSUQsSUFnSUM7QUFoSVksb0NBQVkiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBmb3JtYXQgYXMgZiB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0IHsgWENfUFJPSl9VVUlELCBYQ19DT01NRU5UX0tFWSB9IGZyb20gJy4vSVhjb2RlUHJvakZpbGVTaW1wbGVUeXBlcyc7XG5pbXBvcnQgeyBQQlhPYmplY3RCYXNlIH0gZnJvbSAnLi9JWGNvZGVQcm9qRmlsZU9ialR5cGVzJztcbmltcG9ydCB7IFR5cGVkU2VjdGlvbiwgU2VjdGlvbkRpY3RVdWlkVG9PYmogfSBmcm9tICcuL0lYY29kZVByb2pGaWxlJztcblxuLy8gIHNob3VsZCBtb3ZlIHRoaXMgaW50byBpdHMgb3duIHN0YXRpYyBjbGFzcyBvciBmaWxlLlxuLy8gIFRPRE8gbW92ZSBhbGwgdHlwZWQgc2VjdGlvbiB1dGlscyBpbiBoZXJlIGFuZCBwdXQgdGhpcyBpbiBpdHMgb3duIGZpbGVcbmV4cG9ydCBjbGFzcyBTZWN0aW9uVXRpbHMge1xuICAgIC8qKlxuICAgICAqIFNlY3Rpb25zIGhhdmUgVVVJRHMgYXMga2V5cyBhbmQgY29tbWVudCBrZXlzIHdpY2ggYXJlIHRoZSBVVUlEIGZvbGxvd2VkIGJ5IF9jb21tZW50XG4gICAgICovXG4gICAgcHJpdmF0ZSBzdGF0aWMgQ09NTUVOVF9LRVkgPSAvX2NvbW1lbnQkLztcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgdGhlIGNvbW1lbnQga2V5IGZvciB0aGUgb2JqZWN0IGRpY3Rpb25hcnkgdGhhdCBnb2VzIHdpdGggYW4gb2JqZWN0LlxuICAgICAqIENvcnJlc3BvbmRzIHRvIHRoZSBjb25zdCBDT01NRU5UX0tFWS5cbiAgICAgKlxuICAgICAqIENvbW1lbnQgaXMgaW4gdGhlIGZvcm0gXCI8VVVJRD5fY29tbWVudFwiXG4gICAgICogQHBhcmFtIHV1aWRcbiAgICAgKi9cbiAgICBzdGF0aWMgZGljdEtleVV1aWRUb0NvbW1lbnQodXVpZDogWENfUFJPSl9VVUlEKTogWENfQ09NTUVOVF9LRVkge1xuICAgICAgICByZXR1cm4gZihcIiVzX2NvbW1lbnRcIiwgdXVpZCk7XG4gICAgfVxuICAgIHN0YXRpYyBkaWN0S2V5Q29tbWVudFRvVXVpZChjb21tZW50S2V5OiBYQ19DT01NRU5UX0tFWSk6IFhDX1BST0pfVVVJRCB7XG4gICAgICAgIHJldHVybiBjb21tZW50S2V5LnNwbGl0KHRoaXMuQ09NTUVOVF9LRVkpWzBdO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgb24gdGhlIGtleSBvZiBhIFR5cGVkU2VjdGlvbiBvYmplY3QgdG8gZGV0ZXJtaW5lIGlmIGl0IGlzXG4gICAgICogYW4gb2JqZWN0IG9yIGEgY29tbWVudC5cbiAgICAgKiBAcGFyYW0ga2V5XG4gICAgICovXG4gICAgc3RhdGljIGRpY3RLZXlJc0NvbW1lbnQoa2V5OiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuQ09NTUVOVF9LRVkudGVzdChrZXkpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBSZXR1cm4gdHJ1ZSBpZiB0aHMgdXVpZCBpcyBhIHN0cmluZywgbm90IGEgY29tbWVudCwgYW5kIGV4YWN0bHkgMjQgY2hhcmFjaHRlcnMgbG9uZy5cbiAgICAgKiBAcGFyYW0gdXVpZFxuICAgICAqL1xuICAgIHN0YXRpYyBkaWN0S2V5SXNVdWlkKHV1aWQ/OiBzdHJpbmcgfCBudWxsKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB0eXBlb2YgdXVpZCA9PSBcInN0cmluZ1wiICYmICF0aGlzLmRpY3RLZXlJc0NvbW1lbnQodXVpZCkgJiYgdXVpZC5sZW5ndGggPT0gMjQ7XG4gICAgfVxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHNlY3Rpb25cbiAgICAgKiBAcGFyYW0gY29tbWVudFRleHRcbiAgICAgKi9cbiAgICBzdGF0aWMgZW50cnlHZXRXQ29tbWVudFRleHQ8UEJYX09CSl9UWVBFIGV4dGVuZHMgUEJYT2JqZWN0QmFzZT4oc2VjdGlvbjogVHlwZWRTZWN0aW9uPFBCWF9PQkpfVFlQRT4sIGNvbW1lbnRUZXh0OiBzdHJpbmcpOiBQQlhfT0JKX1RZUEUgfCBudWxsIHtcbiAgICAgICAgZm9yIChsZXQga2V5IGluIHNlY3Rpb24pIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmRpY3RLZXlJc0NvbW1lbnQoa2V5KSAmJiBzZWN0aW9uW2tleV0gPT0gY29tbWVudFRleHQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5lbnRyeUdldFdVdWlkKHNlY3Rpb24sIHRoaXMuZGljdEtleUNvbW1lbnRUb1V1aWQoa2V5KSk7XG4gICAgICAgICAgICAgICAgLy8gcmV0dXJuIHNlY3Rpb25bdGhpcy5kaWN0S2V5Q29tbWVudFRvVXVpZChrZXkpXSBhcyBQQlhfT0JKX1RZUEU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHN0YXRpYyBlbnRyeUdldFdDb21tZW50S2V5PFBCWF9PQkpfVFlQRSBleHRlbmRzIFBCWE9iamVjdEJhc2U+KHNlY3Rpb246IFR5cGVkU2VjdGlvbjxQQlhfT0JKX1RZUEU+LCBjb21tZW50S2V5OiBzdHJpbmcpOiBQQlhfT0JKX1RZUEUgfCBudWxsIHtcbiAgICAgICAgaWYgKCF0aGlzLmRpY3RLZXlJc0NvbW1lbnQoY29tbWVudEtleSkpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFRoZSBwYXNzZWQgaW4gY29tbWVudCBrZXkgaXMgbm90IGEgY29tbWVudCBrZXkuICBLZXk9JyR7Y29tbWVudEtleX0nYCk7XG4gICAgICAgIHJldHVybiB0aGlzLmVudHJ5R2V0V1V1aWQoc2VjdGlvbiwgdGhpcy5kaWN0S2V5Q29tbWVudFRvVXVpZChjb21tZW50S2V5KSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHNlY3Rpb25cbiAgICAgKiBAcGFyYW0gdXVpZFxuICAgICAqIHRocm93cyBpZiB1dWlkIGRvZXMgbm90IGFwcGVhciB0byBiZSBhbiBhY3R1YWwgVVVJRC4gIEkuZS5cbiAgICAgKi9cbiAgICBzdGF0aWMgZW50cnlHZXRXVXVpZDxQQlhfT0JKX1RZUEUgZXh0ZW5kcyBQQlhPYmplY3RCYXNlPihzZWN0aW9uOiBUeXBlZFNlY3Rpb248UEJYX09CSl9UWVBFPiwgdXVpZDogWENfUFJPSl9VVUlEKTogUEJYX09CSl9UWVBFIHwgbnVsbCB7XG4gICAgICAgIGlmICghdGhpcy5kaWN0S2V5SXNVdWlkKHV1aWQpKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBVVUlEIGRvZXMgbm90IGFwcGVhciB0byBiZSBhIHV1aWQuICBWYWx1ZT0nJHt1dWlkfSdgKTtcbiAgICAgICAgY29uc3Qgb2JqID0gc2VjdGlvblt1dWlkXTtcbiAgICAgICAgaWYgKHR5cGVvZiBvYmogPT0gXCJvYmplY3RcIilcbiAgICAgICAgICAgIHJldHVybiBvYmo7XG4gICAgICAgIGVsc2UgaWYgKHR5cGVvZiBvYmogPT0gXCJ1bmRlZmluZWRcIilcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FuIHVuZXhwZWN0ZWQgdHlwZSBvZiBkYXRhIHdhcyBmb3VuZCBpbiB0aGUgZGljdGlvbmFyeScpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBTZXQgYW4gb2JqZWN0IGFuZCBpdHMgY29tbWVudCB3aXRoaW4gYSBzZWN0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHNlY3Rpb25cbiAgICAgKiBAcGFyYW0gdXVpZCAgdXVpZCBvZiB0aGUgb2JqZWN0LiAgVGhlIGNvbW1lbnQgdXVpZCBpcyBjYWxjdWxhdGVkIGZyb20gdGhpcy5cbiAgICAgKiBAcGFyYW0gb2JqIHRoZSBvYmplY3RcbiAgICAgKiBAcGFyYW0gY29tbWVudCAgdGhlIGNvbW1lbnQuXG4gICAgICovXG4gICAgc3RhdGljIGVudHJ5U2V0V1V1aWQ8UEJYX09CSl9UWVBFIGV4dGVuZHMgUEJYT2JqZWN0QmFzZT4oc2VjdGlvbjogVHlwZWRTZWN0aW9uPFBCWF9PQkpfVFlQRT4sIHV1aWQ6IFhDX1BST0pfVVVJRCwgb2JqOiBQQlhfT0JKX1RZUEUsIGNvbW1lbnQ6IHN0cmluZyk6IHZvaWQge1xuICAgICAgICBjb25zdCBjb21tZW50S2V5OiBzdHJpbmcgPSB0aGlzLmRpY3RLZXlVdWlkVG9Db21tZW50KHV1aWQpO1xuICAgICAgICBzZWN0aW9uW3V1aWRdID0gb2JqO1xuICAgICAgICBzZWN0aW9uW2NvbW1lbnRLZXldID0gY29tbWVudDtcbiAgICB9XG4gICAgLyoqXG4gICAgICogRGVsZXRlIGFuIG9iamVjdCBhbmQgaXRzIGNvbW1lbnQgd2l0aCBpdHMgVVVJRC5cbiAgICAgKiBAcGFyYW0gc2VjdGlvblxuICAgICAqIEBwYXJhbSB1dWlkXG4gICAgICovXG4gICAgc3RhdGljIGVudHJ5RGVsZXRlV1V1aWQ8UEJYX09CSl9UWVBFIGV4dGVuZHMgUEJYT2JqZWN0QmFzZT4oc2VjdGlvbjogVHlwZWRTZWN0aW9uPFBCWF9PQkpfVFlQRT4sIHV1aWQ6IFhDX1BST0pfVVVJRCk6IHZvaWQge1xuICAgICAgICBjb25zdCBjb21tZW50S2V5OiBzdHJpbmcgPSB0aGlzLmRpY3RLZXlVdWlkVG9Db21tZW50KHV1aWQpO1xuICAgICAgICBkZWxldGUgc2VjdGlvblt1dWlkXTtcbiAgICAgICAgZGVsZXRlIHNlY3Rpb25bY29tbWVudEtleV07XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEdpdmVuIHRoZSB0ZXh0IG9mIGEgY29tbWVudCB0aGF0IGlzIGFzc29jaWF0ZWQgd2l0aCBhIGtleSwgZmluZCBhbGwga2V5cyB3aXRoXG4gICAgICogdGhhdCBjb21tZW50IGFuZCBkZWxldGUgdGhlbSBmcm9tIHRoaXMgc2VjdGlvbi5cbiAgICAgKiBAcGFyYW0gc2VjdGlvblxuICAgICAqIEBwYXJhbSBjb21tZW50XG4gICAgICovXG4gICAgc3RhdGljIGVudHJ5RGVsZXRlV0NvbW1lbnRUZXh0KHNlY3Rpb246IFR5cGVkU2VjdGlvbjxQQlhPYmplY3RCYXNlPiwgY29tbWVudDogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIC8vICBDb21pbmcgZnJvbSBvdGhlciBsYW5ndWFnZXMsIEkgZGlkIG5vdCBrbm93IGlmIHRoaXMgd2FzIGxlZ2FsLiAgSXQgaXM6XG4gICAgICAgIC8vICBodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8zNDYzMDQ4L2lzLWl0LXNhZmUtdG8tZGVsZXRlLWFuLW9iamVjdC1wcm9wZXJ0eS13aGlsZS1pdGVyYXRpbmctb3Zlci10aGVtXG4gICAgICAgIGZvciAobGV0IGtleSBpbiBzZWN0aW9uKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5kaWN0S2V5SXNDb21tZW50KGtleSkgJiYgc2VjdGlvbltrZXldID09IGNvbW1lbnQpIHsgLy8gVGhlIGNvbW1lbnQgaXMgdGhlIHBhc3NlZCBpbiBuYW1lIG9mIHRoZSBncm91cC5cbiAgICAgICAgICAgICAgICBjb25zdCBpdGVtS2V5OiBYQ19QUk9KX1VVSUQgPSB0aGlzLmRpY3RLZXlDb21tZW50VG9VdWlkKGtleSk7IC8vIGdldCB0aGUgVXVpZFxuICAgICAgICAgICAgICAgIGRlbGV0ZSBzZWN0aW9uW2l0ZW1LZXldO1xuICAgICAgICAgICAgICAgIC8vICB0aGlzIGRpZCBub3QgZGVsZXRlIHRoZSBrZXkgaXRzZWxmIGJlZm9yZS4gIEl0IGRvZXMgbm93LlxuICAgICAgICAgICAgICAgIGRlbGV0ZSBzZWN0aW9uW2tleV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgLyoqXG4gICAgICogR2l2ZW4gYSBzZWN0aW9uIGZyb20gdGhlIHByb2plY3QgZmlsZSB3aGljaCBjb250YWlucyBib3RoIG9iamVjdHMgYW5kIGNvbW1lbnRzLFxuICAgICAqIHJldHVybiBhIG5ldyBvYmplY3QgdGhhdCBvbmx5IGNvbnRhaW5zIHRoZSBQQlggb2JqZWN0cy5cbiAgICAgKiBAcGFyYW0gb2JqXG4gICAgICovXG4gICAgc3RhdGljIGNyZWF0ZVV1aWRLZXlPbmx5U2VjdGlvbkRpY3Q8UEJYX09CSl9UWVBFIGV4dGVuZHMgUEJYT2JqZWN0QmFzZT4ob2JqOiBUeXBlZFNlY3Rpb248UEJYX09CSl9UWVBFPik6IFNlY3Rpb25EaWN0VXVpZFRvT2JqPFBCWF9PQkpfVFlQRT4ge1xuICAgICAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMob2JqKTtcbiAgICAgICAgY29uc3QgbmV3T2JqOiBTZWN0aW9uRGljdFV1aWRUb09iajxQQlhfT0JKX1RZUEU+ID0ge307XG4gICAgICAgIGxldCBpID0gMDtcbiAgICAgICAgZm9yIChpOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qga2V5OiBzdHJpbmcgPSBrZXlzW2ldO1xuICAgICAgICAgICAgLy9pZiAoIUNPTU1FTlRfS0VZLnRlc3Qoa2V5KSkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmRpY3RLZXlJc0NvbW1lbnQoa2V5KSkge1xuICAgICAgICAgICAgICAgIG5ld09ialtrZXldID0gb2JqW2tleV0gYXMgUEJYX09CSl9UWVBFO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXdPYmo7XG4gICAgfVxufVxuIl19