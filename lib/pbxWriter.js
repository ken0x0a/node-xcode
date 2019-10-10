"use strict";
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
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// import * as pbxProj from './pbxProject';
// var pbxProj = require('./pbxProject'),
var util_1 = require("util");
// import * as util from 'util';
var INDENT = '\t';
// COMMENT_KEY = /_comment$/;
// QUOTED = /^"(.*)"$/;
var events_1 = require("events");
var SectionUtils_1 = require("./SectionUtils");
var IXcodeProjFileObjTypes_1 = require("./IXcodeProjFileObjTypes");
// indentation
function i(x) {
    if (x <= 0)
        return '';
    else
        return INDENT + i(x - 1);
}
function comment(key, parent) {
    var text = parent[key + '_comment'];
    if (text)
        return text;
    else
        return null;
}
// copied from underscore
function isObject(obj) {
    return obj === Object(obj);
}
function isArray(obj) {
    return Array.isArray(obj);
}
var PbxWriter = /** @class */ (function (_super) {
    __extends(PbxWriter, _super);
    function PbxWriter(contents, options) {
        var _this = _super.call(this) || this;
        if (!options) {
            options = {};
        }
        if (options.omitEmptyValues === undefined) {
            options.omitEmptyValues = false;
        }
        _this.contents = contents;
        _this.sync = false;
        _this.indentLevel = 0;
        _this.omitEmptyValues = options.omitEmptyValues;
        return _this;
    }
    PbxWriter.prototype.write = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var fmt = util_1.format.apply(null, arguments);
        if (this.sync) {
            this.buffer += util_1.format("%s%s", i(this.indentLevel), fmt);
        }
        else {
            // do stream write
        }
    };
    PbxWriter.prototype.writeFlush = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var oldIndent = this.indentLevel;
        this.indentLevel = 0;
        this.write.apply(this, args);
        //this.write.apply(this, arguments)
        this.indentLevel = oldIndent;
    };
    PbxWriter.prototype.writeSync = function () {
        this.sync = true;
        this.buffer = "";
        this.writeHeadComment();
        this.writeProject();
        return this.buffer;
    };
    PbxWriter.prototype.writeHeadComment = function () {
        if (this.contents.headComment) {
            this.write("// %s\n", this.contents.headComment);
        }
    };
    PbxWriter.prototype.writeProject = function () {
        var proj = this.contents.project, key, cmt, obj;
        this.write("{\n");
        if (proj) {
            this.indentLevel++;
            for (key in proj) {
                // skip comments
                if (SectionUtils_1.SectionUtils.dictKeyIsComment(key))
                    continue;
                cmt = comment(key, proj);
                obj = proj[key];
                if (isArray(obj)) {
                    this.writeArray(obj, key);
                }
                else if (isObject(obj)) {
                    this.write("%s = {\n", key);
                    this.indentLevel++;
                    if (key === 'objects') {
                        this.writeObjectsSections(obj);
                    }
                    else {
                        this.writeObject(obj);
                    }
                    this.indentLevel--;
                    this.write("};\n");
                }
                else if (this.omitEmptyValues && (obj === undefined || obj === null)) {
                    continue;
                }
                else if (cmt) {
                    this.write("%s = %s /* %s */;\n", key, obj, cmt);
                }
                else {
                    this.write("%s = %s;\n", key, obj);
                }
            }
            this.indentLevel--;
        }
        this.write("}\n");
    };
    PbxWriter.prototype.writeObject = function (object) {
        for (var key in object) {
            if (SectionUtils_1.SectionUtils.dictKeyIsComment(key))
                continue;
            var cmt = comment(key, object);
            var obj_1 = object[key];
            if (isArray(obj_1)) {
                this.writeArray(obj_1, key);
            }
            else if (isObject(obj_1)) {
                this.write("%s = {\n", key);
                this.indentLevel++;
                this.writeObject(obj_1);
                this.indentLevel--;
                this.write("};\n");
            }
            else {
                if (this.omitEmptyValues && (obj_1 === undefined || obj_1 === null)) {
                    continue;
                }
                else if (cmt) {
                    this.write("%s = %s /* %s */;\n", key, obj_1, cmt);
                }
                else {
                    this.write("%s = %s;\n", key, obj_1);
                }
            }
        }
    };
    PbxWriter.prototype.writeObjectsSections = function (objects) {
        for (var ISA_TYPE in objects) {
            this.writeFlush("\n");
            var obj_2 = objects[ISA_TYPE];
            if (isObject(obj_2)) {
                this.writeSectionComment(ISA_TYPE, true);
                this.writeSection(obj_2);
                this.writeSectionComment(ISA_TYPE, false);
            }
        }
    };
    PbxWriter.prototype.writeArray = function (arr, name) {
        this.write("%s = (\n", name);
        this.indentLevel++;
        for (var i_1 = 0; i_1 < arr.length; i_1++) {
            var entry = arr[i_1];
            if (entry.value && entry.comment) {
                this.write('%s /* %s */,\n', entry.value, entry.comment);
            }
            else if (isObject(entry)) {
                this.write('{\n');
                this.indentLevel++;
                this.writeObject(entry);
                this.indentLevel--;
                this.write('},\n');
            }
            else {
                this.write('%s,\n', entry);
            }
        }
        this.indentLevel--;
        this.write(");\n");
    };
    PbxWriter.prototype.writeSectionComment = function (name, begin) {
        if (begin) {
            this.writeFlush("/* Begin %s section */\n", name);
        }
        else { // end
            this.writeFlush("/* End %s section */\n", name);
        }
    };
    PbxWriter.prototype.writeSection = function (section) {
        // section should only contain objects
        for (var key in section) {
            if (SectionUtils_1.SectionUtils.dictKeyIsComment(key))
                continue;
            var cmt = comment(key, section);
            var obj_3 = section[key];
            if (obj_3.isa == IXcodeProjFileObjTypes_1.cPBXBuildFile || obj_3.isa == IXcodeProjFileObjTypes_1.cPBXFileReference) {
                this.writeInlineObject(key, cmt, obj_3);
            }
            else {
                if (cmt) {
                    this.write("%s /* %s */ = {\n", key, cmt);
                }
                else {
                    this.write("%s = {\n", key);
                }
                this.indentLevel++;
                this.writeObject(obj_3);
                this.indentLevel--;
                this.write("};\n");
            }
        }
    };
    PbxWriter.prototype.writeInlineObject = function (n, d, r) {
        var output = [];
        var self = this;
        var inlineObjectHelper = function (name, desc, ref) {
            if (desc) {
                output.push(util_1.format("%s /* %s */ = {", name, desc));
            }
            else {
                output.push(util_1.format("%s = {", name));
            }
            for (var key in ref) {
                if (SectionUtils_1.SectionUtils.dictKeyIsComment(key))
                    continue;
                var cmt = comment(key, ref);
                var obj_4 = ref[key];
                if (isArray(obj_4)) {
                    output.push(util_1.format("%s = (", key));
                    for (var i = 0; i < obj_4.length; i++) {
                        output.push(util_1.format("%s, ", obj_4[i]));
                    }
                    output.push("); ");
                }
                else if (isObject(obj_4)) {
                    inlineObjectHelper(key, cmt, obj_4);
                }
                else if (self.omitEmptyValues && (obj_4 === undefined || obj_4 === null)) {
                    continue;
                }
                else if (cmt) {
                    output.push(util_1.format("%s = %s /* %s */; ", key, obj_4, cmt));
                }
                else {
                    output.push(util_1.format("%s = %s; ", key, obj_4));
                }
            }
            output.push("}; ");
        };
        inlineObjectHelper(n, d, r);
        this.write("%s\n", output.join('').trim());
    };
    return PbxWriter;
}(events_1.EventEmitter));
exports.PbxWriter = PbxWriter;
//module.exports = PbxWriter;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGJ4V3JpdGVyLmpzIiwic291cmNlUm9vdCI6Ii4uL3NyYy90cy8iLCJzb3VyY2VzIjpbImxpYi9wYnhXcml0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7Ozs7Ozs7R0FlRzs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsMkNBQTJDO0FBQzNDLHlDQUF5QztBQUN6Qyw2QkFBbUM7QUFDbkMsZ0NBQWdDO0FBQ2hDLElBQU0sTUFBTSxHQUFHLElBQUksQ0FBQztBQUNoQiw2QkFBNkI7QUFDakMsdUJBQXVCO0FBQ3ZCLGlDQUFzQztBQUN0QywrQ0FBOEM7QUFHOUMsbUVBQTJGO0FBRTNGLGNBQWM7QUFDZCxTQUFTLENBQUMsQ0FBQyxDQUFTO0lBQ2hCLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDTixPQUFPLEVBQUUsQ0FBQzs7UUFFVixPQUFPLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ2pDLENBQUM7QUFJRCxTQUFTLE9BQU8sQ0FBQyxHQUFpQixFQUFFLE1BQWdCO0lBRWhELElBQU0sSUFBSSxHQUF1QixNQUFNLENBQUMsR0FBRyxHQUFHLFVBQVUsQ0FBdUIsQ0FBQztJQUVoRixJQUFJLElBQUk7UUFDSixPQUFPLElBQUksQ0FBQzs7UUFFWixPQUFPLElBQUksQ0FBQztBQUNwQixDQUFDO0FBRUQseUJBQXlCO0FBQ3pCLFNBQVMsUUFBUSxDQUFDLEdBQVE7SUFDdEIsT0FBTyxHQUFHLEtBQUssTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQy9CLENBQUM7QUFFRCxTQUFTLE9BQU8sQ0FBQyxHQUFRO0lBQ3JCLE9BQU8sS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM5QixDQUFDO0FBTUQ7SUFBK0IsNkJBQVk7SUFPdkMsbUJBQVksUUFBYSxFQUFFLE9BQTBCO1FBQXJELFlBQ0ksaUJBQU8sU0FjVjtRQVpHLElBQUksQ0FBQyxPQUFPLEVBQUU7WUFDVixPQUFPLEdBQUcsRUFB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QUcsRUFBRTtvQkFDWixNQUFNLENBQUMsSUFBSSxDQUFDLGFBQUMsQ0FBQyxvQkFBb0IsRUFBRSxHQUFHLEVBQUUsS0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUE7aUJBQ3REO3FCQUFNO29CQUNILE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBQyxDQUFDLFdBQVcsRUFBRSxHQUFHLEVBQUUsS0FBRyxDQUFDLENBQUMsQ0FBQTtpQkFDeEM7YUFDSjtZQUVELE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDdkIsQ0FBQyxDQUFBO1FBRUQsa0JBQWtCLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUU1QixJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7SUFDL0MsQ0FBQztJQUNMLGdCQUFDO0FBQUQsQ0FBQyxBQXJRRCxDQUErQixxQkFBWSxHQXFRMUM7QUFyUVksOEJBQVM7QUF1UXRCLDZCQUE2QiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuIExpY2Vuc2VkIHRvIHRoZSBBcGFjaGUgU29mdHdhcmUgRm91bmRhdGlvbiAoQVNGKSB1bmRlciBvbmVcbiBvciBtb3JlIGNvbnRyaWJ1dG9yIGxpY2Vuc2UgYWdyZWVtZW50cy4gIFNlZSB0aGUgTk9USUNFIGZpbGVcbiBkaXN0cmlidXRlZCB3aXRoIHRoaXMgd29yayBmb3IgYWRkaXRpb25hbCBpbmZvcm1hdGlvblxuIHJlZ2FyZGluZyBjb3B5cmlnaHQgb3duZXJzaGlwLiAgVGhlIEFTRiBsaWNlbnNlcyB0aGlzIGZpbGVcbiB0byB5b3UgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlXG4gJ0xpY2Vuc2UnKTsgeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZVxuIHdpdGggdGhlIExpY2Vuc2UuICBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsXG4gc29mdHdhcmUgZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW5cbiAnQVMgSVMnIEJBU0lTLCBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTllcbiBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLiAgU2VlIHRoZSBMaWNlbnNlIGZvciB0aGVcbiBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kIGxpbWl0YXRpb25zXG4gdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxuLy8gaW1wb3J0ICogYXMgcGJ4UHJvaiBmcm9tICcuL3BieFByb2plY3QnO1xuLy8gdmFyIHBieFByb2ogPSByZXF1aXJlKCcuL3BieFByb2plY3QnKSxcbmltcG9ydCB7IGZvcm1hdCBhcyBmIH0gZnJvbSAndXRpbCc7XG4vLyBpbXBvcnQgKiBhcyB1dGlsIGZyb20gJ3V0aWwnO1xuY29uc3QgSU5ERU5UID0gJ1xcdCc7XG4gICAgLy8gQ09NTUVOVF9LRVkgPSAvX2NvbW1lbnQkLztcbi8vIFFVT1RFRCA9IC9eXCIoLiopXCIkLztcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XG5pbXBvcnQgeyBTZWN0aW9uVXRpbHMgfSBmcm9tIFwiLi9TZWN0aW9uVXRpbHNcIjtcbmltcG9ydCB7IFhDX1BST0pfVVVJRCB9IGZyb20gJy4vSVhjb2RlUHJvakZpbGVTaW1wbGVUeXBlcyc7XG5pbXBvcnQgeyBTRUNUSU9OX0RJQ1QsIFNlY3Rpb24gfSBmcm9tICcuL0lYY29kZVByb2pGaWxlJztcbmltcG9ydCB7IFBCWE9iamVjdEJhc2UsIGNQQlhCdWlsZEZpbGUsIGNQQlhGaWxlUmVmZXJlbmNlIH0gZnJvbSAnLi9JWGNvZGVQcm9qRmlsZU9ialR5cGVzJztcblxuLy8gaW5kZW50YXRpb25cbmZ1bmN0aW9uIGkoeDogbnVtYmVyKTogc3RyaW5nIHtcbiAgICBpZiAoeCA8PSAwKVxuICAgICAgICByZXR1cm4gJyc7XG4gICAgZWxzZVxuICAgICAgICByZXR1cm4gSU5ERU5UICsgaSh4IC0gMSk7XG59XG5cbmV4cG9ydCB0eXBlIERJQ1RfQU5ZID0geyBba2V5OiBzdHJpbmddOiBhbnkgfTtcblxuZnVuY3Rpb24gY29tbWVudChrZXk6IFhDX1BST0pfVVVJRCwgcGFyZW50OiBESUNUX0FOWSk6IHN0cmluZyB8IG51bGwge1xuXG4gICAgY29uc3QgdGV4dDogc3RyaW5nIHwgdW5kZWZpbmVkID0gcGFyZW50W2tleSArICdfY29tbWVudCddIGFzIHN0cmluZyB8IHVuZGVmaW5lZDtcblxuICAgIGlmICh0ZXh0KVxuICAgICAgICByZXR1cm4gdGV4dDtcbiAgICBlbHNlXG4gICAgICAgIHJldHVybiBudWxsO1xufVxuXG4vLyBjb3BpZWQgZnJvbSB1bmRlcnNjb3JlXG5mdW5jdGlvbiBpc09iamVjdChvYmo6IGFueSk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBvYmogPT09IE9iamVjdChvYmopO1xufVxuXG5mdW5jdGlvbiBpc0FycmF5KG9iajogYW55KTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkob2JqKTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQYnhXcml0ZXJPcHRpb25zIHtcbiAgICBvbWl0RW1wdHlWYWx1ZXM/OiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgUGJ4V3JpdGVyIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcbiAgICBvbWl0RW1wdHlWYWx1ZXM6IGJvb2xlYW47XG4gICAgaW5kZW50TGV2ZWw6IG51bWJlcjtcbiAgICBzeW5jOiBib29sZWFuO1xuICAgIGNvbnRlbnRzOiBhbnk7XG4gICAgYnVmZmVyPzogc3RyaW5nO1xuXG4gICAgY29uc3RydWN0b3IoY29udGVudHM6IGFueSwgb3B0aW9ucz86IFBieFdyaXRlck9wdGlvbnMpIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICBpZiAoIW9wdGlvbnMpIHtcbiAgICAgICAgICAgIG9wdGlvbnMgPSB7fVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMub21pdEVtcHR5VmFsdWVzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIG9wdGlvbnMub21pdEVtcHR5VmFsdWVzID0gZmFsc2VcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY29udGVudHMgPSBjb250ZW50cztcbiAgICAgICAgdGhpcy5zeW5jID0gZmFsc2U7XG4gICAgICAgIHRoaXMuaW5kZW50TGV2ZWwgPSAwO1xuICAgICAgICB0aGlzLm9taXRFbXB0eVZhbHVlcyA9IG9wdGlvbnMub21pdEVtcHR5VmFsdWVzXG4gICAgfVxuXG4gICAgd3JpdGUoLi4uYXJnczogYW55W10pOiB2b2lkIHtcbiAgICAgICAgY29uc3QgZm10OiBzdHJpbmcgPSBmLmFwcGx5KG51bGwsIGFyZ3VtZW50cyBhcyBhbnkpO1xuXG4gICAgICAgIGlmICh0aGlzLnN5bmMpIHtcbiAgICAgICAgICAgIHRoaXMuYnVmZmVyICs9IGYoXCIlcyVzXCIsIGkodGhpcy5pbmRlbnRMZXZlbCksIGZtdCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBkbyBzdHJlYW0gd3JpdGVcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHdyaXRlRmx1c2goLi4uYXJnczogYW55W10pOiB2b2lkIHtcbiAgICAgICAgdmFyIG9sZEluZGVudCA9IHRoaXMuaW5kZW50TGV2ZWw7XG5cbiAgICAgICAgdGhpcy5pbmRlbnRMZXZlbCA9IDA7XG5cbiAgICAgICAgdGhpcy53cml0ZSguLi5hcmdzKTtcbiAgICAgICAgLy90aGlzLndyaXRlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcblxuICAgICAgICB0aGlzLmluZGVudExldmVsID0gb2xkSW5kZW50O1xuICAgIH1cblxuICAgIHdyaXRlU3luYygpOiBzdHJpbmcge1xuICAgICAgICB0aGlzLnN5bmMgPSB0cnVlO1xuICAgICAgICB0aGlzLmJ1ZmZlciA9IFwiXCI7XG5cbiAgICAgICAgdGhpcy53cml0ZUhlYWRDb21tZW50KCk7XG4gICAgICAgIHRoaXMud3JpdGVQcm9qZWN0KCk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuYnVmZmVyO1xuICAgIH1cblxuICAgIHdyaXRlSGVhZENvbW1lbnQoKTogdm9pZCB7XG4gICAgICAgIGlmICh0aGlzLmNvbnRlbnRzLmhlYWRDb21tZW50KSB7XG4gICAgICAgICAgICB0aGlzLndyaXRlKFwiLy8gJXNcXG5cIiwgdGhpcy5jb250ZW50cy5oZWFkQ29tbWVudClcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHdyaXRlUHJvamVjdCgpOiB2b2lkIHtcbiAgICAgICAgdmFyIHByb2ogPSB0aGlzLmNvbnRlbnRzLnByb2plY3QsXG4gICAgICAgICAgICBrZXksIGNtdCwgb2JqO1xuXG4gICAgICAgIHRoaXMud3JpdGUoXCJ7XFxuXCIpXG5cbiAgICAgICAgaWYgKHByb2opIHtcbiAgICAgICAgICAgIHRoaXMuaW5kZW50TGV2ZWwrKztcblxuICAgICAgICAgICAgZm9yIChrZXkgaW4gcHJvaikge1xuICAgICAgICAgICAgICAgIC8vIHNraXAgY29tbWVudHNcbiAgICAgICAgICAgICAgICBpZiAoU2VjdGlvblV0aWxzLmRpY3RLZXlJc0NvbW1lbnQoa2V5KSkgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICBjbXQgPSBjb21tZW50KGtleSwgcHJvaik7XG4gICAgICAgICAgICAgICAgb2JqID0gcHJvaltrZXldO1xuXG4gICAgICAgICAgICAgICAgaWYgKGlzQXJyYXkob2JqKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLndyaXRlQXJyYXkob2JqLCBrZXkpXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpc09iamVjdChvYmopKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMud3JpdGUoXCIlcyA9IHtcXG5cIiwga2V5KTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5pbmRlbnRMZXZlbCsrO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChrZXkgPT09ICdvYmplY3RzJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy53cml0ZU9iamVjdHNTZWN0aW9ucyhvYmopXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLndyaXRlT2JqZWN0KG9iailcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaW5kZW50TGV2ZWwtLTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy53cml0ZShcIn07XFxuXCIpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5vbWl0RW1wdHlWYWx1ZXMgJiYgKG9iaiA9PT0gdW5kZWZpbmVkIHx8IG9iaiA9PT0gbnVsbCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjbXQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy53cml0ZShcIiVzID0gJXMgLyogJXMgKi87XFxuXCIsIGtleSwgb2JqLCBjbXQpXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy53cml0ZShcIiVzID0gJXM7XFxuXCIsIGtleSwgb2JqKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5pbmRlbnRMZXZlbC0tO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy53cml0ZShcIn1cXG5cIilcbiAgICB9XG5cbiAgICB3cml0ZU9iamVjdChvYmplY3Q6IERJQ1RfQU5ZKTogdm9pZCB7XG5cbiAgICAgICAgZm9yIChsZXQga2V5IGluIG9iamVjdCkge1xuICAgICAgICAgICAgaWYgKFNlY3Rpb25VdGlscy5kaWN0S2V5SXNDb21tZW50KGtleSkpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBjb25zdCBjbXQgPSBjb21tZW50KGtleSwgb2JqZWN0KTtcbiAgICAgICAgICAgIGNvbnN0IG9iaiA9IG9iamVjdFtrZXldO1xuXG4gICAgICAgICAgICBpZiAoaXNBcnJheShvYmopKSB7XG4gICAgICAgICAgICAgICAgdGhpcy53cml0ZUFycmF5KG9iaiwga2V5KVxuICAgICAgICAgICAgfSBlbHNlIGlmIChpc09iamVjdChvYmopKSB7XG4gICAgICAgICAgICAgICAgdGhpcy53cml0ZShcIiVzID0ge1xcblwiLCBrZXkpO1xuICAgICAgICAgICAgICAgIHRoaXMuaW5kZW50TGV2ZWwrKztcblxuICAgICAgICAgICAgICAgIHRoaXMud3JpdGVPYmplY3Qob2JqKVxuXG4gICAgICAgICAgICAgICAgdGhpcy5pbmRlbnRMZXZlbC0tO1xuICAgICAgICAgICAgICAgIHRoaXMud3JpdGUoXCJ9O1xcblwiKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMub21pdEVtcHR5VmFsdWVzICYmIChvYmogPT09IHVuZGVmaW5lZCB8fCBvYmogPT09IG51bGwpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY210KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMud3JpdGUoXCIlcyA9ICVzIC8qICVzICovO1xcblwiLCBrZXksIG9iaiwgY210KVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMud3JpdGUoXCIlcyA9ICVzO1xcblwiLCBrZXksIG9iailcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB3cml0ZU9iamVjdHNTZWN0aW9ucyhvYmplY3RzOiBTRUNUSU9OX0RJQ1QpOiB2b2lkIHtcblxuICAgICAgICBmb3IgKGxldCBJU0FfVFlQRSBpbiBvYmplY3RzKSB7XG4gICAgICAgICAgICB0aGlzLndyaXRlRmx1c2goXCJcXG5cIilcblxuICAgICAgICAgICAgY29uc3Qgb2JqOiBTZWN0aW9uID0gb2JqZWN0c1tJU0FfVFlQRV07XG5cbiAgICAgICAgICAgIGlmIChpc09iamVjdChvYmopKSB7XG4gICAgICAgICAgICAgICAgdGhpcy53cml0ZVNlY3Rpb25Db21tZW50KElTQV9UWVBFLCB0cnVlKTtcblxuICAgICAgICAgICAgICAgIHRoaXMud3JpdGVTZWN0aW9uKG9iaik7XG5cbiAgICAgICAgICAgICAgICB0aGlzLndyaXRlU2VjdGlvbkNvbW1lbnQoSVNBX1RZUEUsIGZhbHNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHdyaXRlQXJyYXkoYXJyOiBhbnlbXSwgbmFtZTogc3RyaW5nKTogdm9pZCB7XG5cbiAgICAgICAgdGhpcy53cml0ZShcIiVzID0gKFxcblwiLCBuYW1lKTtcbiAgICAgICAgdGhpcy5pbmRlbnRMZXZlbCsrO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXJyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBlbnRyeTogYW55ID0gYXJyW2ldXG5cbiAgICAgICAgICAgIGlmIChlbnRyeS52YWx1ZSAmJiBlbnRyeS5jb21tZW50KSB7XG4gICAgICAgICAgICAgICAgdGhpcy53cml0ZSgnJXMgLyogJXMgKi8sXFxuJywgZW50cnkudmFsdWUsIGVudHJ5LmNvbW1lbnQpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChpc09iamVjdChlbnRyeSkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLndyaXRlKCd7XFxuJyk7XG4gICAgICAgICAgICAgICAgdGhpcy5pbmRlbnRMZXZlbCsrO1xuXG4gICAgICAgICAgICAgICAgdGhpcy53cml0ZU9iamVjdChlbnRyeSk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmluZGVudExldmVsLS07XG4gICAgICAgICAgICAgICAgdGhpcy53cml0ZSgnfSxcXG4nKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy53cml0ZSgnJXMsXFxuJywgZW50cnkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5pbmRlbnRMZXZlbC0tO1xuICAgICAgICB0aGlzLndyaXRlKFwiKTtcXG5cIik7XG4gICAgfVxuXG4gICAgd3JpdGVTZWN0aW9uQ29tbWVudChuYW1lOiBzdHJpbmcsIGJlZ2luOiBib29sZWFuKTogdm9pZCB7XG4gICAgICAgIGlmIChiZWdpbikge1xuICAgICAgICAgICAgdGhpcy53cml0ZUZsdXNoKFwiLyogQmVnaW4gJXMgc2VjdGlvbiAqL1xcblwiLCBuYW1lKVxuICAgICAgICB9IGVsc2UgeyAvLyBlbmRcbiAgICAgICAgICAgIHRoaXMud3JpdGVGbHVzaChcIi8qIEVuZCAlcyBzZWN0aW9uICovXFxuXCIsIG5hbWUpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB3cml0ZVNlY3Rpb24oc2VjdGlvbjogU2VjdGlvbik6IHZvaWQge1xuXG4gICAgICAgIC8vIHNlY3Rpb24gc2hvdWxkIG9ubHkgY29udGFpbiBvYmplY3RzXG4gICAgICAgIGZvciAobGV0IGtleSBpbiBzZWN0aW9uKSB7XG5cbiAgICAgICAgICAgIGlmIChTZWN0aW9uVXRpbHMuZGljdEtleUlzQ29tbWVudChrZXkpKSBjb250aW51ZTtcblxuICAgICAgICAgICAgY29uc3QgY210OiBzdHJpbmcgfCBudWxsID0gY29tbWVudChrZXksIHNlY3Rpb24pO1xuICAgICAgICAgICAgY29uc3Qgb2JqOlBCWE9iamVjdEJhc2UgPSBzZWN0aW9uW2tleV0gYXMgUEJYT2JqZWN0QmFzZTtcblxuICAgICAgICAgICAgaWYgKG9iai5pc2EgPT0gY1BCWEJ1aWxkRmlsZSB8fCBvYmouaXNhID09IGNQQlhGaWxlUmVmZXJlbmNlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy53cml0ZUlubGluZU9iamVjdChrZXksIGNtdCwgb2JqKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKGNtdCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLndyaXRlKFwiJXMgLyogJXMgKi8gPSB7XFxuXCIsIGtleSwgY210KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLndyaXRlKFwiJXMgPSB7XFxuXCIsIGtleSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5pbmRlbnRMZXZlbCsrXG5cbiAgICAgICAgICAgICAgICB0aGlzLndyaXRlT2JqZWN0KG9iailcblxuICAgICAgICAgICAgICAgIHRoaXMuaW5kZW50TGV2ZWwtLVxuICAgICAgICAgICAgICAgIHRoaXMud3JpdGUoXCJ9O1xcblwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHdyaXRlSW5saW5lT2JqZWN0KG46WENfUFJPSl9VVUlELCBkOnN0cmluZ3xudWxsLCByOlBCWE9iamVjdEJhc2UpOnZvaWQge1xuICAgICAgICBjb25zdCBvdXRwdXQ6c3RyaW5nW10gPSBbXTtcbiAgICAgICAgY29uc3Qgc2VsZiA9IHRoaXNcblxuICAgICAgICB2YXIgaW5saW5lT2JqZWN0SGVscGVyID0gZnVuY3Rpb24gKG5hbWU6WENfUFJPSl9VVUlELCBkZXNjOnN0cmluZ3xudWxsLCByZWY6UEJYT2JqZWN0QmFzZSk6dm9pZCB7XG5cbiAgICAgICAgICAgIGlmIChkZXNjKSB7XG4gICAgICAgICAgICAgICAgb3V0cHV0LnB1c2goZihcIiVzIC8qICVzICovID0ge1wiLCBuYW1lLCBkZXNjKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG91dHB1dC5wdXNoKGYoXCIlcyA9IHtcIiwgbmFtZSkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKGxldCBrZXkgaW4gcmVmKSB7XG4gICAgICAgICAgICAgICAgaWYgKFNlY3Rpb25VdGlscy5kaWN0S2V5SXNDb21tZW50KGtleSkpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgY210OnN0cmluZ3xudWxsID0gY29tbWVudChrZXksIHJlZik7XG4gICAgICAgICAgICAgICAgY29uc3Qgb2JqOmFueSA9IChyZWYgYXMgRElDVF9BTlkpW2tleV07XG5cbiAgICAgICAgICAgICAgICBpZiAoaXNBcnJheShvYmopKSB7XG4gICAgICAgICAgICAgICAgICAgIG91dHB1dC5wdXNoKGYoXCIlcyA9IChcIiwga2V5KSk7XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYmoubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dC5wdXNoKGYoXCIlcywgXCIsIG9ialtpXSkpXG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBvdXRwdXQucHVzaChcIik7IFwiKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGlzT2JqZWN0KG9iaikpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5saW5lT2JqZWN0SGVscGVyKGtleSwgY210LCBvYmopXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChzZWxmLm9taXRFbXB0eVZhbHVlcyAmJiAob2JqID09PSB1bmRlZmluZWQgfHwgb2JqID09PSBudWxsKSkge1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGNtdCkge1xuICAgICAgICAgICAgICAgICAgICBvdXRwdXQucHVzaChmKFwiJXMgPSAlcyAvKiAlcyAqLzsgXCIsIGtleSwgb2JqLCBjbXQpKVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG91dHB1dC5wdXNoKGYoXCIlcyA9ICVzOyBcIiwga2V5LCBvYmopKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgb3V0cHV0LnB1c2goXCJ9OyBcIik7XG4gICAgICAgIH1cblxuICAgICAgICBpbmxpbmVPYmplY3RIZWxwZXIobiwgZCwgcik7XG5cbiAgICAgICAgdGhpcy53cml0ZShcIiVzXFxuXCIsIG91dHB1dC5qb2luKCcnKS50cmltKCkpO1xuICAgIH1cbn1cblxuLy9tb2R1bGUuZXhwb3J0cyA9IFBieFdyaXRlcjtcbiJdfQ==